document.addEventListener('DOMContentLoaded', function () {
    // Configuraci�n del gr�fico de mapa
    const ipOriginInput = document.getElementById('ipOriginInput');
    const filterButton = document.getElementById('filterIpOrigin');

    // Variables para almacenar el filtro actual y estado de captura
    let currentFilter = null;
    let currentIpFilter = '';
    let intervalId = null;
    let isCapturing = false;
    let lastTotalCountries = 0;
    let inactiveCount = 0;
    const MAX_INACTIVE_UPDATES = 3;
    const UPDATE_INTERVAL = 5000; // 5 segundos

    // Variable para el gr�fico principal
    let mainChart;

    // Cargar la API de Google Charts
    google.charts.load('current', {
        'packages': ['geochart'],
        'mapsApiKey': 'AIzaSyAiW1wpfXHWfFjB1HSW2V4YoTPfISZbaP0'
    });

    google.charts.setOnLoadCallback(function () {
       
        actualizarGrafico(false, currentFilter).then(() => {
           
            if (lastTotalCountries > 0) {
                isCapturing = true;
                iniciarActualizacionAutomatica();
            }
        });
    });

    // Funci�n para actualizar el gr�fico con filtro
    async function actualizarGrafico(isModal = false, filter = null) {
        const loadingMessage = 'Cargando datos...';
        const errorContainerId = 'map-chart-error';
        const containerId = 'mapChart';

        try {
          
            const url = new URL(`${window.location.origin}/TrafAnalyzer/php/mapa_pais.php`);
            url.searchParams.append('t', new Date().getTime());

            
            if (currentIpFilter) {
                url.searchParams.append('iporigen', currentIpFilter);
            }

            
            if (filter) {
                url.searchParams.append('segundo_inicio', filter.segundo_inicio);
                url.searchParams.append('segundo_fin', filter.segundo_fin);
            }

            console.log(`Actualizando gr�fico de mapa con URL: ${url.toString()}`);

            
            const response = await fetch(url, { cache: 'no-store' });

            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.details ||
                    `Error del servidor (${response.status})`
                );
            }

            
            const data = await response.json();

            
            if (typeof data !== 'object') {
                throw new Error('Datos recibidos en formato incorrecto');
            }

            
            const totalCountries = Object.keys(data).length;
            console.log(`Datos recibidos: ${totalCountries} pa�ses`);

           
            if (totalCountries > 0 && !isModal) {
                if (totalCountries !== lastTotalCountries) {
                    console.log(`Detectados cambios en pa�ses: ${totalCountries} (Anterior: ${lastTotalCountries})`);
                }
                lastTotalCountries = totalCountries;
                isCapturing = true;
                inactiveCount = 0;

                
                if (!intervalId && isCapturing) {
                    iniciarActualizacionAutomatica();
                }
            } else if (!isModal) {
                
                inactiveCount++;
                console.log(`Sin nuevos pa�ses. Actualizaciones inactivas: ${inactiveCount}/${MAX_INACTIVE_UPDATES}`);

                
                if (inactiveCount >= MAX_INACTIVE_UPDATES) {
                    console.log('Captura parece estar detenida. Deteniendo actualizaciones autom�ticas.');
                    isCapturing = false;
                    detenerActualizacionAutomatica();
                }
            }

          
            const chartData = [['Country', 'Cantidad de Paquetes']];
            for (const pais in data) {
                chartData.push([pais, parseInt(data[pais])]);
            }

            const dataTable = google.visualization.arrayToDataTable(chartData);
            const options = {
                colorAxis: { colors: ['#e7711c', '#4374e0'] },
                backgroundColor: '#f0f0f0',
                datalessRegionColor: '#d1d1d1',
                title: filter ?
                    `Distribuci�n geogr�fica (${filter.segundo_inicio.toFixed(2)}s - ${filter.segundo_fin.toFixed(2)}s)` :
                    'Distribuci�n geogr�fica'
            };

            
            if (!mainChart) {
                mainChart = new google.visualization.GeoChart(
                    document.getElementById(containerId)
                );
            }
            mainChart.draw(dataTable, options);

            
            const errorContainer = document.getElementById(errorContainerId);
            if (errorContainer) errorContainer.remove();

        } catch (error) {
            console.error('Error actualizando gr�fico de mapa:', error);

            
            let errorContainer = document.getElementById(errorContainerId);
            if (!errorContainer) {
                errorContainer = document.createElement('div');
                errorContainer.id = errorContainerId;
                errorContainer.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #ffebee;
                    padding: 15px;
                    border: 1px solid #f44336;
                    border-radius: 4px;
                    max-width: 300px;
                    z-index: 1000;
                `;
                document.body.appendChild(errorContainer);
            }

            errorContainer.innerHTML = `
                <strong>Error en gr�fico de mapa:</strong>
                <p>${error.message}</p>
                <small>${new Date().toLocaleString()}</small>
                <button onclick="this.parentElement.remove()" 
                        style="float: right; background: none; border: none; cursor: pointer;">
                    �
                </button>
            `;
        }
    }

    // Iniciar actualizaci�n autom�tica
    function iniciarActualizacionAutomatica() {
      
        detenerActualizacionAutomatica();

        
        if (isCapturing) {
            console.log('Iniciando actualizaciones autom�ticas del mapa');

            
            actualizarGrafico(false, currentFilter);

          
            intervalId = setInterval(() => {
                actualizarGrafico(false, currentFilter);
            }, UPDATE_INTERVAL);

            
            document.dispatchEvent(new CustomEvent('mapUpdatesStarted'));
        } else {
            
            actualizarGrafico(false, currentFilter);
        }
    }

    // Detener actualizaci�n autom�tica
    function detenerActualizacionAutomatica() {
        if (intervalId) {
            console.log('Deteniendo actualizaciones autom�ticas del mapa');
            clearInterval(intervalId);
            intervalId = null;

          
            document.dispatchEvent(new CustomEvent('mapUpdatesStopped'));
        }
    }

    // Manejar el clic en el bot�n "Filtrar IP"
    filterButton.addEventListener('click', function () {
        currentIpFilter = ipOriginInput.value.trim();
        console.log(`Filtro de IP aplicado: ${currentIpFilter}`);
        iniciarActualizacionAutomatica();
    });

    // Escuchar evento de filtro de tiempo
    document.addEventListener('timeFilterUpdated', function (e) {
        currentFilter = e.detail;
        console.log('Filtro de tiempo recibido en mapa:', currentFilter);
       
        iniciarActualizacionAutomatica();
    });

    // Mantener compatibilidad con eventos de captura expl�citos
    document.addEventListener('captureStarted', function () {
        console.log('Evento captureStarted recibido en mapa');
        isCapturing = true;
        inactiveCount = 0;
        iniciarActualizacionAutomatica();
    });

    document.addEventListener('captureStopped', function () {
        console.log('Evento captureStopped recibido en mapa');
        isCapturing = false;
        inactiveCount = MAX_INACTIVE_UPDATES;
        detenerActualizacionAutomatica();
       
        actualizarGrafico(false, currentFilter);
    });

   
    window.addEventListener('beforeunload', function () {
        detenerActualizacionAutomatica();
    });

  
    document.addEventListener('initializeMapChart', function (e) {
        console.log('???  Evento de inicializaci�n de mapa recibido:', e.detail);

        // Configurar el estado de captura
        if (e.detail.isCapturing) {
            isCapturing = true;
            lastTotalCountries = 0;
            inactiveCount = 0;
        }

        // Si Google Charts est� listo, inicializar inmediatamente
        if (typeof google !== 'undefined' && google.charts) {
            console.log('Google Charts disponible, inicializando mapa...');
            actualizarGrafico(false, currentFilter).then(() => {
                console.log('? Mapa inicializado desde evento coordinado');

                
                document.dispatchEvent(new CustomEvent('mapChartReady', {
                    detail: {
                        initialized: true,
                        hasData: lastTotalCountries > 0
                    }
                }));
            });
        } else {
            console.log('? Google Charts no disponible, reintentando...');
            setTimeout(() => {
                if (typeof google !== 'undefined' && google.charts) {
                    actualizarGrafico(false, currentFilter);
                }
            }, 2000);
        }
    });

    // Escuchar eventos de actualizaci�n coordinada
    document.addEventListener('updateAllCharts', function (e) {
        if (e.detail.source === 'coordinator') {
            console.log('?? Actualizando mapa desde coordinador');
            actualizarGrafico(false, currentFilter);
        }
    });

    // Notificar cuando el mapa tenga datos nuevos
    const originalActualizarGrafico = actualizarGrafico;
    actualizarGrafico = async function (isModal = false, filter = null) {
        const result = await originalActualizarGrafico(isModal, filter);

       
        if (!isModal && lastTotalCountries > 0) {
            document.dispatchEvent(new CustomEvent('mapDataUpdated', {
                detail: {
                    totalCountries: lastTotalCountries,
                    hasData: true
                }
            }));
        }

        return result;
    };
});