document.addEventListener('DOMContentLoaded', function () {
    const trafficCtx = document.getElementById('trafficVolumeChart').getContext('2d');


    let currentFilter = null;
    let intervalId = null;
    let isCapturing = false;
    let lastUpdateTime = 0; 
    let lastPacketCount = 0; 
    const UPDATE_INTERVAL = 2000;
    const INACTIVITY_THRESHOLD = 10000; 

   
    const trafficChart = new Chart(trafficCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Paquetes acumulados',
                    data: [],
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 5
                },
                {
                    label: 'Alerta de 1000 paquetes',
                    data: [],
                    backgroundColor: 'rgba(255, 99, 132, 1)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 0,
                    pointRadius: 8,
                    pointHoverRadius: 12,
                    pointStyle: 'rectRot',
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            const dataItem = context.raw;
                            if (context.datasetIndex === 1) {
                                return [
                                    `ALERTA en ${dataItem.x}s`,
                                    `Paquetes: ${dataItem.y}`,
                                    `Hora: ${dataItem.arrivaltime}`,
                                ];
                            } else {
                                return [
                                    `Paquetes: ${dataItem.y}`,
                                    `Hora: ${dataItem.arrivaltime || 'N/A'}`,
                                    `Tiempo: ${dataItem.x}s`
                                ];
                            }
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Volumen de Tráfico en Tiempo Real',
                    font: { size: 16 }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Tiempo (segundos)' },
                    ticks: { callback: value => value + 's' }
                },
                y: {
                    title: { display: true, text: 'Paquetes acumulados' },
                    beginAtZero: true
                }
            }
        }
    });

    // Función mejorada para verificar el estado de captura
    async function checkCaptureStatus() {
        try {
            const response = await fetch(`${window.location.origin}/TrafAnalyzer/php/capture_status.php`, {
                cache: 'no-store'
            });
            const data = await response.json();
            return data.is_active || false;
        } catch (error) {
            console.error('Error verificando estado de captura:', error);
            return false;
        }
    }

    // Función optimizada para actualizar el gráfico
    async function updateTrafficChart() {
        try {
            const now = Date.now();
            const url = new URL(`${window.location.origin}/TrafAnalyzer/php/control_volumen.php`);
            url.searchParams.append('t', now);
            
            if (currentFilter) {
                url.searchParams.append('segundo_inicio', currentFilter.segundo_inicio);
                url.searchParams.append('segundo_fin', currentFilter.segundo_fin);
            }

            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            
            const data = await response.json();
            if (data.error) throw new Error(data.message || 'Error del servidor');
            if (!data.trafficData) throw new Error('Formato de datos incorrecto');

           
            trafficChart.data.datasets[0].data = data.trafficData.map(item => ({
                x: parseFloat(item.time),
                y: parseInt(item.count),
                arrivaltime: item.arrivaltime
            }));

          
            if (data.alertMarkers?.length > 0) {
                trafficChart.data.datasets[1].data = data.alertMarkers.map(marker => ({
                    x: parseFloat(marker.time),
                    y: parseInt(marker.count),
                    arrivaltime: marker.arrivaltime,
                    email: marker.email
                }));
            }

        
            trafficChart.options.plugins.title.text = currentFilter
                ? `Volumen de Tráfico (${currentFilter.segundo_inicio.toFixed(2)}-${currentFilter.segundo_fin.toFixed(2)}s)`
                : 'Volumen de Tráfico en Tiempo Real';

            trafficChart.update();
            updateTimeFilterInfo(data.timeRange);

           
            const currentPacketCount = data.totalPackets || 0;
            const hasNewPackets = currentPacketCount > lastPacketCount;
            lastPacketCount = currentPacketCount;
            lastUpdateTime = now;

           
            if (hasNewPackets) {
                if (!isCapturing) {
                    isCapturing = true;
                    console.log('Nueva captura detectada - Iniciando actualizaciones automáticas');
                    iniciarActualizacionAutomatica();
                }
            } else if (isCapturing && (now - lastUpdateTime) > INACTIVITY_THRESHOLD) {
                isCapturing = false;
                console.log('Inactividad detectada - Deteniendo actualizaciones automáticas');
                detenerActualizacionAutomatica();
            }

        } catch (error) {
            console.error('Error actualizando gráfico:', error);
            showError('traffic-volume-error', 'Error en gráfico de volumen', error.message);
        }
    }

    // Funciones auxiliares 
    function updateTimeFilterInfo(timeRange) {
        if (!timeRange) return;

        
        const minSegundosElement = document.getElementById('minSegundos');
        const maxSegundosElement = document.getElementById('maxSegundos');
        const totalMinutesElement = document.getElementById('totalMinutes');

        if (minSegundosElement && maxSegundosElement && timeRange.min && timeRange.max) {
            minSegundosElement.textContent = parseFloat(timeRange.min).toFixed(6);
            maxSegundosElement.textContent = parseFloat(timeRange.max).toFixed(6);

            if (totalMinutesElement) {
                const durationSeconds = parseFloat(timeRange.max) - parseFloat(timeRange.min);
                const durationMinutes = durationSeconds / 60;
                totalMinutesElement.textContent =
                    `${durationMinutes.toFixed(2)} minutos (${durationSeconds.toFixed(2)} segundos)`;
            }
        }

    
        const currentFilterElement = document.getElementById('currentFilter');
        if (currentFilterElement) {
            let filterText = currentFilter
                ? `${currentFilter.segundo_inicio.toFixed(6)}s a ${currentFilter.segundo_fin.toFixed(6)}s`
                : "Sin filtro (mostrando todos los datos)";
            currentFilterElement.textContent = filterText;
        }

       
        const timestampElement = document.getElementById('lastUpdateTimestamp');
        if (timestampElement) {
            const now = new Date();
            timestampElement.textContent = `Última actualización: ${now.toLocaleTimeString()}`;
        }
    }
    function setupTimeFilter() {
        const applyFilterBtn = document.getElementById('applySegundoFilter');
        const startInput = document.getElementById('startSegundo');
        const endInput = document.getElementById('endSegundo');

        if (applyFilterBtn && startInput && endInput) {
       
            applyFilterBtn.addEventListener('click', function () {
                const startSegundo = parseFloat(startInput.value);
                const endSegundo = parseFloat(endInput.value);

             
                if (startSegundo > endSegundo) {
                    alert('El tiempo de inicio debe ser menor que el tiempo final');
                    return;
                }

               
                currentFilter = {
                    segundo_inicio: startSegundo,
                    segundo_fin: endSegundo
                };

                
                document.dispatchEvent(new CustomEvent('timeFilterUpdated', {
                    detail: currentFilter
                }));

                
                updateTrafficChart();
            });

            // Navegación entre valores exactos usando flechas arriba/abajo
            function setupTimeNavigation(input, isStart) {
                input.addEventListener('keydown', function (e) {
                    if (!allTrafficData || allTrafficData.length === 0) return;

                    const times = allTrafficData.map(item => parseFloat(item.time)).sort((a, b) => a - b);
                    const currentValue = parseFloat(this.value) || 0;
                    let newIndex;

                    if (e.key === 'ArrowUp') {
                        e.preventDefault();
                       
                        newIndex = times.findIndex(time => time > currentValue);
                        if (newIndex !== -1) {
                            this.value = times[newIndex];
                        }
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        
                        const reversedIndex = [...times].reverse().findIndex(time => time < currentValue);
                        if (reversedIndex !== -1) {
                            newIndex = times.length - 1 - reversedIndex;
                            this.value = times[newIndex];
                        }
                    }
                });
            }

            setupTimeNavigation(startInput, true);
            setupTimeNavigation(endInput, false);
        }
    }

    // Control de actualización automática mejorado
    function iniciarActualizacionAutomatica() {
        detenerActualizacionAutomatica();
        updateTrafficChart();
        intervalId = setInterval(updateTrafficChart, UPDATE_INTERVAL);
    }

    function detenerActualizacionAutomatica() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    // Manejadores de eventos mejorados
    document.addEventListener('timeFilterUpdated', (e) => {
        currentFilter = e.detail;
        if (isCapturing) iniciarActualizacionAutomatica();
        else updateTrafficChart();
    });

    document.addEventListener('captureStarted', async () => {
        isCapturing = true;
        console.log('Evento captureStarted recibido - Iniciando captura');
        iniciarActualizacionAutomatica();
    });

    document.addEventListener('captureStopped', () => {
        isCapturing = false;
        console.log('Evento captureStopped recibido - Deteniendo captura');
        detenerActualizacionAutomatica();
        updateTrafficChart();
    });

    // Inicialización mejorada
    async function initialize() {
        setupTimeFilter();
        
       
        isCapturing = await checkCaptureStatus();
        console.log(`Estado inicial de captura: ${isCapturing ? 'ACTIVA' : 'INACTIVA'}`);
        
  
        await updateTrafficChart();
        
       
        if (isCapturing) {
            iniciarActualizacionAutomatica();
        }
    }

    initialize();
});