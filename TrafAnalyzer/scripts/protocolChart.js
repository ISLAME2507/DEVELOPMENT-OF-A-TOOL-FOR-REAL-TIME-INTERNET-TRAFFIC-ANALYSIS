document.addEventListener('DOMContentLoaded', function () {
    const protocolCtx = document.getElementById('protocolChart').getContext('2d');
    const protocolChart = new Chart(protocolCtx, {
        type: 'bar',
        data: {
            labels: [], datasets: [{
                label: 'Paquetes',
                data: [],
                backgroundColor: ['#6ab0de', '#5ca8db', '#4a90e2', '#357abd', '#2a6bb6', '#1e5a9b', '#144782', '#0a366b'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });

    let currentFilter = null;
    let intervalId = null;
    let isCapturing = false;
    let lastTotalPackets = 0;
    let inactiveCount = 0;
    const MAX_INACTIVE_UPDATES = 3;
    const UPDATE_INTERVAL = 5000;

    // Función optimizada para actualizar el gráfico
    async function actualizarGrafico(grafico, filter = null) {
        try {
            const url = new URL(`${window.location.origin}/TrafAnalyzer/php/tabla_protocolos.php`);
            url.searchParams.append('t', new Date().getTime());
            if (filter) {
                url.searchParams.append('segundo_inicio', filter.segundo_inicio);
                url.searchParams.append('segundo_fin', filter.segundo_fin);
            }

            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

            const data = await response.json();
            if (!data.labels || !data.values) throw new Error('Formato de datos incorrecto');

         
            const totalPackets = data.values.reduce((sum, value) => sum + value, 0);
            const hasNewPackets = totalPackets > lastTotalPackets;
            lastTotalPackets = totalPackets;

            if (hasNewPackets) {
                inactiveCount = 0;
                if (!isCapturing) {
                    isCapturing = true;
                    iniciarActualizacionAutomatica();
                }
            } else {
                inactiveCount++;
                if (inactiveCount >= MAX_INACTIVE_UPDATES && isCapturing) {
                    isCapturing = false;
                    detenerActualizacionAutomatica();
                }
            }

            grafico.data.labels = data.labels;
            grafico.data.datasets[0].data = data.values;
            grafico.update();

            console.log('Protocol Chart actualizado:', {
                totalPackets,
                hasNewPackets,
                isCapturing,
                labelsCount: data.labels.length
            });

        } catch (error) {
            console.error('Error actualizando gráfico de protocolos:', error);
            grafico.data.labels = ['Error cargando datos'];
            grafico.data.datasets[0].data = [1];
            grafico.update();
        }
    }

    function iniciarActualizacionAutomatica() {
        console.log('Iniciando actualización automática del gráfico de protocolos');
        detenerActualizacionAutomatica();
        actualizarGrafico(protocolChart, currentFilter);
        intervalId = setInterval(() => {
            actualizarGrafico(protocolChart, currentFilter);
        }, UPDATE_INTERVAL);
    }

    function detenerActualizacionAutomatica() {
        if (intervalId) {
            console.log('Deteniendo actualización automática del gráfico de protocolos');
            clearInterval(intervalId);
            intervalId = null;
        }
    }

 
    window.initializeProtocolChart = function () {
        console.log('Inicializando Protocol Chart...');
        return new Promise((resolve) => {
            actualizarGrafico(protocolChart, currentFilter);
            setTimeout(resolve, 500); 
        });
    };

    window.updateProtocolChart = function () {
        console.log('Actualizando Protocol Chart...');
        actualizarGrafico(protocolChart, currentFilter);
    };

    // Función para establecer el estado de captura externamente
    window.setProtocolChartCaptureState = function (capturing) {
        console.log(`Estableciendo estado de captura del Protocol Chart: ${capturing}`);
        isCapturing = capturing;
        if (capturing) {
            iniciarActualizacionAutomatica();
        } else {
            detenerActualizacionAutomatica();
            actualizarGrafico(protocolChart, currentFilter);
        }
    };

    // Función para obtener el estado actual
    window.getProtocolChartState = function () {
        return {
            isCapturing,
            lastTotalPackets,
            inactiveCount,
            hasInterval: !!intervalId
        };
    };

    // Manejadores de eventos mejorados
    document.addEventListener('timeFilterUpdated', (e) => {
        currentFilter = e.detail;
        console.log('Time filter updated para Protocol Chart:', currentFilter);
        if (isCapturing) iniciarActualizacionAutomatica();
        else actualizarGrafico(protocolChart, currentFilter);
    });

    document.addEventListener('captureStarted', () => {
        console.log('Evento captureStarted recibido en Protocol Chart');
        isCapturing = true;
        inactiveCount = 0;
        iniciarActualizacionAutomatica();
    });

    document.addEventListener('captureStopped', () => {
        console.log('Evento captureStopped recibido en Protocol Chart');
        isCapturing = false;
        detenerActualizacionAutomatica();
        actualizarGrafico(protocolChart, currentFilter);
    });

    // Sincronización con updateAllCharts()
    document.addEventListener('forceChartUpdate', () => {
        console.log('Evento forceChartUpdate recibido en Protocol Chart');
        actualizarGrafico(protocolChart, currentFilter);
    });

    // VERIFICACIÓN DE ESTADO MEJORADA
    async function checkInitialCaptureStatus() {
        try {
          
            const endpoints = [
                `${window.location.origin}/TrafAnalyzer/php/capture_status.php`,
                `${window.location.origin}/TrafAnalyzer/php/check_status.php?user_id=${window.currentUserId || ''}`
            ];

            let statusData = null;

            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint);
                    if (response.ok) {
                        statusData = await response.json();
                        break;
                    }
                } catch (e) {
                    console.warn(`Error con endpoint ${endpoint}:`, e);
                }
            }

            if (statusData) {
                const capturing = statusData.is_active || statusData.running || false;
                console.log(`Estado inicial de captura detectado: ${capturing}`);

                if (capturing) {
                    isCapturing = true;
                    iniciarActualizacionAutomatica();
                } else {
                    actualizarGrafico(protocolChart, currentFilter);
                }
            } else {
                console.log('No se pudo obtener estado inicial, cargando datos una vez');
                actualizarGrafico(protocolChart, currentFilter);
            }
        } catch (error) {
            console.warn('Error verificando estado inicial:', error);
            actualizarGrafico(protocolChart, currentFilter);
        }
    }

    // Carga inicial con delay para asegurar que otros scripts estén listos
    setTimeout(() => {
        checkInitialCaptureStatus();
    }, 1000);

  
    window.addEventListener('beforeunload', () => {
        detenerActualizacionAutomatica();
    });

  
    document.dispatchEvent(new CustomEvent('protocolChartReady', {
        detail: {
            chart: protocolChart,
            functions: ['initializeProtocolChart', 'updateProtocolChart', 'setProtocolChartCaptureState']
        }
    }));

    console.log('Protocol Chart script inicializado y funciones expuestas globalmente');
});