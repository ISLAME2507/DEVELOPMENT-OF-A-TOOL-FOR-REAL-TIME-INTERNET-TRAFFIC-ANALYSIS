document.addEventListener('DOMContentLoaded', function () {
    //  Verificar que el canvas existe
    const dnsCanvas = document.getElementById('dnsChart');
    if (!dnsCanvas) {
        console.error('No se encontr� el elemento con ID "dnsChart"');
        return;
    }

    //  Asegurar que el canvas tenga dimensiones adecuadas
    dnsCanvas.style.width = '100%';
    dnsCanvas.style.height = '400px'; // Ajusta seg�n necesites

    //  Configuraci�n inicial del gr�fico
    const dnsCtx = dnsCanvas.getContext('2d');

    // Colores DNS
    const coloresDNS = {
        'A': '#ff6384',       // Rojo
        'NS': '#36a2eb',      // Azul
        'CNAME': '#cc65fe',   // Morado
        'SOA': '#ffce56',     // Amarillo
        'PTR': '#ff9f40',     // Naranja
        'MX': '#4bc0c0',      // Turquesa
        'TXT': '#f77825',     // Naranja oscuro
        'AAAA': '#8d6cab',    // Lila
        'SRV': '#e6194b',     // Rojo oscuro
        'HTTPS': '#3cb44b'    // Verde
    };

    // Funci�n para generar un color aleatorio si hay un nuevo tipo de registro
    function getColorForType(type) {
        if (!coloresDNS[type]) {
         
            coloresDNS[type] = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
        }
        return coloresDNS[type];
    }

    //  Crear el gr�fico con datos iniciales
    const dnsChart = new Chart(dnsCtx, {
        type: 'pie',
        data: {
            labels: [], 
            datasets: [{
                label: 'Registros DNS',
                data: [], 
                backgroundColor: [], 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.label}: ${context.raw} (${context.parsed.toFixed(1)}%)`;
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });

    // Variables para controlar la actualizaci�n autom�tica
    let currentFilter = null;
    let intervalId = null;
    let isCapturing = false;
    const UPDATE_INTERVAL = 5000; // 5 segundos

    //  Funci�n para actualizar el gr�fico
    async function actualizarGraficoDNS(filter = null) {
        try {
            // Construir URL con timestamp para evitar cach�
            const url = new URL(`${window.location.origin}/TrafAnalyzer/php/tipos_registros.php`);
            url.searchParams.append('_', Date.now());

            // A�adir par�metros de filtro
            if (filter) {
                if (filter.segundo_inicio !== undefined) {
                    url.searchParams.append('segundo_inicio', filter.segundo_inicio);
                }
                if (filter.segundo_fin !== undefined) {
                    url.searchParams.append('segundo_fin', filter.segundo_fin);
                }
            }

            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            if (!data.labels || !data.values) {
                throw new Error('Datos en formato incorrecto');
            }

         
            dnsChart.data.labels = data.labels;
            dnsChart.data.datasets[0].data = data.values;

    
            dnsChart.data.datasets[0].backgroundColor = data.labels.map(label => getColorForType(label));

            dnsChart.update();

        } catch (error) {
            console.error('Error actualizando gr�fico DNS:', error);

            dnsChart.data.labels = ['Error cargando datos'];
            dnsChart.data.datasets[0].data = [1];
            dnsChart.data.datasets[0].backgroundColor = ['#ffcccc'];
            dnsChart.update();
        }
    }

    // Iniciar actualizaci�n autom�tica
    function iniciarActualizacionDNS() {
  
        detenerActualizacionDNS();

  
        if (isCapturing) {
            console.log('Iniciando actualizaciones autom�ticas del gr�fico DNS');

            actualizarGraficoDNS(currentFilter);

      
            intervalId = setInterval(() => {
                actualizarGraficoDNS(currentFilter);
            }, UPDATE_INTERVAL);
        } else {

            actualizarGraficoDNS(currentFilter);
        }
    }

    // Detener actualizaci�n autom�tica
    function detenerActualizacionDNS() {
        if (intervalId) {
            console.log('Deteniendo actualizaciones autom�ticas del gr�fico DNS');
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    //  Escuchar evento de filtro de tiempo
    document.addEventListener('timeFilterUpdated', function (e) {
        currentFilter = e.detail;
        actualizarGraficoDNS(currentFilter);
    });

    // Sincronizar con el gr�fico de protocolos
    document.addEventListener('automaticUpdatesStarted', function () {
        isCapturing = true;
        iniciarActualizacionDNS();
    });

    document.addEventListener('automaticUpdatesStopped', function () {
        isCapturing = false;
        detenerActualizacionDNS();
        // Actualizar una �ltima vez para mostrar los datos finales
        actualizarGraficoDNS(currentFilter);
    });

    document.addEventListener('captureStarted', function () {
        isCapturing = true;
        iniciarActualizacionDNS();
    });

    document.addEventListener('captureStopped', function () {
        isCapturing = false;
        detenerActualizacionDNS();
      
        actualizarGraficoDNS(currentFilter);
    });

    document.addEventListener('newPacketsDetected', function () {

        if (!intervalId) {
            isCapturing = true;
            iniciarActualizacionDNS();
        }
    });

    //  Actualizaci�n inicial (para comenzar)
    actualizarGraficoDNS();


    isCapturing = true;
    iniciarActualizacionDNS();

    // Forzar redimensionamiento en caso de problemas visuales
    window.addEventListener('resize', function () {
        dnsChart.resize();
    });
});