// Variable global para compartir el estado del filtro entre scripts
window.dnsChartTimeFilter = {
    segundo_inicio: null,
    segundo_fin: null
};

document.addEventListener('DOMContentLoaded', function () {
    // Elementos del DOM para el gráfico DNS
    const flowCtx = document.getElementById('flowChart').getContext('2d');
    const domainInput = document.getElementById('domainInput');
    const compareButton = document.getElementById('compareDomainFlow');
    const modal = document.getElementById('chartModal');
    const modalCanvas = document.getElementById('modalChart');
    const span = document.getElementsByClassName('close-modal')[0];
    let activeChart = null;
    let updateInterval;
    const UPDATE_INTERVAL_MS = 5000; // 5 segundos

    // Variables para almacenar los filtros de tiempo (locales)
    let timeFilter = {
        segundo_inicio: null,
        segundo_fin: null
    };

    console.log("Script del gráfico DNS inicializado");

    // Escuchar el evento de actualización de filtro de tiempo
    document.addEventListener('timeFilterUpdated', function (event) {
        console.log("Evento timeFilterUpdated recibido en el gráfico DNS:", event.detail);

        // Actualizar filtros locales
        timeFilter.segundo_inicio = event.detail.segundo_inicio;
        timeFilter.segundo_fin = event.detail.segundo_fin;

        // También actualizar la variable global
        window.dnsChartTimeFilter.segundo_inicio = event.detail.segundo_inicio;
        window.dnsChartTimeFilter.segundo_fin = event.detail.segundo_fin;

        console.log("Filtros actualizados - Local:", timeFilter, "Global:", window.dnsChartTimeFilter);

        // Reiniciar la actualización con el nuevo filtro
        startAutoUpdate();
    });

    // Función para iniciar la actualización automática
    function startAutoUpdate() {
        // Detener cualquier intervalo existente
        if (updateInterval) {
            clearInterval(updateInterval);
        }

        // Iniciar nuevo intervalo
        updateInterval = setInterval(() => {
            const dominio = domainInput.value.trim();
            actualizarGrafico(flowChart, 'php/chart_data.php', dominio);

            // Si hay un gráfico en el modal, actualizarlo también
            if (activeChart) {
                actualizarGrafico(activeChart, 'php/chart_data.php', dominio);
            }
        }, UPDATE_INTERVAL_MS);

        // Primera actualización inmediata
        const dominio = domainInput.value.trim();
        actualizarGrafico(flowChart, 'php/chart_data.php', dominio);
    }

    // Inicializar el gráfico principal
    const flowChart = new Chart(flowCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Solicitudes DNS Totales',
                    data: [],
                    borderColor: '#ff6384',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: false
                },
                {
                    label: 'Respuestas DNS Totales',
                    data: [],
                    borderColor: '#36a2eb',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: false
                },
                {
                    label: 'Solicitudes DNS del Dominio',
                    data: [],
                    borderColor: '#4bc0c0',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: false,
                    hidden: true
                },
                {
                    label: 'Respuestas DNS del Dominio',
                    data: [],
                    borderColor: '#ff9f40',
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    fill: false,
                    hidden: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Tiempo de Captura (s)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Número de Paquetes'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function (context) {
                            const tiempoCaptura = context[0].label;
                            return `${tiempoCaptura}s`;
                        },
                        label: function (context) {
                            const label = context.dataset.label || '';
                            const value = context.raw || 0;
                            const arrivaltime = context.chart.data.arrivaltimes[context.dataIndex];

                            return [
                                `${label}: ${value}`,
                                `Hora De Llegada: ${arrivaltime}`
                            ];
                        }
                    }
                }
            },
            onClick: (event, elements) => {
                const rect = flowChart.canvas.getBoundingClientRect();
                const clickX = event.x - rect.left;
                const axisYRange = 20;

                if (clickX <= axisYRange) {
                    modal.style.display = 'block';

                    if (activeChart) {
                        activeChart.destroy();
                        activeChart = null;
                    }

                    activeChart = new Chart(modalCanvas, {
                        type: 'line',
                        data: {
                            labels: flowChart.data.labels,
                            datasets: flowChart.data.datasets
                        },
                        options: {
                            responsive: true,
                            scales: {
                                x: {
                                    type: 'linear',
                                    title: {
                                        display: true,
                                        text: 'Tiempo de Captura (s)'
                                    }
                                },
                                y: {
                                    title: {
                                        display: true,
                                        text: 'Número de Paquetes'
                                    }
                                }
                            },
                            plugins: {
                                tooltip: {
                                    callbacks: {
                                        title: function (context) {
                                            const tiempoCaptura = context[0].label;
                                            return `${tiempoCaptura}s`;
                                        },
                                        label: function (context) {
                                            const label = context.dataset.label || '';
                                            const value = context.raw || 0;
                                            const arrivaltime = context.chart.data.arrivaltimes[context.dataIndex];

                                            return [
                                                `${label}: ${value}`,
                                                `Hora De Llegada: ${arrivaltime}`
                                            ];
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }
    });

    // Función para actualizar el gráfico con los filtros
    function actualizarGrafico(grafico, url, dominio = '') {
        // Usar tanto los filtros locales como globales para mayor seguridad
        const filtroTiempo = {
            segundo_inicio: timeFilter.segundo_inicio !== null ? timeFilter.segundo_inicio : window.dnsChartTimeFilter.segundo_inicio,
            segundo_fin: timeFilter.segundo_fin !== null ? timeFilter.segundo_fin : window.dnsChartTimeFilter.segundo_fin
        };

        const params = new URLSearchParams();
        if (dominio) {
            params.append('queryname', dominio);
        }

        // Añadir parámetros de filtro de tiempo si están disponibles
        if (filtroTiempo.segundo_inicio !== null) {
            params.append('segundo_inicio', filtroTiempo.segundo_inicio);
        }
        if (filtroTiempo.segundo_fin !== null) {
            params.append('segundo_fin', filtroTiempo.segundo_fin);
        }

        // Añadir timestamp para evitar caché
        params.append('_', Date.now());

        // Depuración - mostrar la URL completa
        console.log('URL de solicitud:', `${url}?${params.toString()}`);

        fetch(`${url}?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error en la respuesta del servidor: ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                // Depuración - mostrar si el filtro está aplicado
                console.log('Datos recibidos:', {
                    filtro_aplicado: data.filter_applied || false,
                    inicio: data.filter_start,
                    fin: data.filter_end,
                    puntos_datos: data.labels.length
                });

                // Actualizar datos del gráfico
                grafico.data.labels = data.labels;
                grafico.data.datasets[0].data = data.solicitudes_totales;
                grafico.data.datasets[1].data = data.respuestas_totales;
                grafico.data.arrivaltimes = data.arrivaltimes;

                // Manejar datos del dominio
                const hasDomainData = data.solicitudes_dominio && data.respuestas_dominio;
                grafico.data.datasets[2].hidden = !hasDomainData;
                grafico.data.datasets[3].hidden = !hasDomainData;

                if (hasDomainData) {
                    grafico.data.datasets[2].data = data.solicitudes_dominio;
                    grafico.data.datasets[3].data = data.respuestas_dominio;
                }

                // Actualización optimizada
                grafico.update({
                    preservation: true,
                    duration: 0 // Sin animación para mejor rendimiento
                });
            })
            .catch(error => {
                console.error('Error obteniendo datos del gráfico:', error);
                // Mostrar mensaje de error en la consola pero seguir intentando
            });
    }

    // Iniciar la actualización automática al cargar la página
    startAutoUpdate();

    // Modificar el evento de comparación para reiniciar la actualización
    compareButton.addEventListener('click', function () {
        const dominio = domainInput.value.trim();
        if (dominio) {
            startAutoUpdate(); // Reiniciar la actualización con el nuevo dominio
        } else {
            alert('Por favor, ingrese un dominio válido.');
            startAutoUpdate(); // Reiniciar la actualización sin dominio
        }
    });

    // Conexión directa con el formulario de filtro de tiempo (como alternativa al evento)
    if (document.getElementById('applySegundoFilter')) {
        document.getElementById('applySegundoFilter').addEventListener('click', function () {
            const startSegundo = parseFloat(document.getElementById('startSegundo').value);
            const endSegundo = parseFloat(document.getElementById('endSegundo').value);

            if (!isNaN(startSegundo) && !isNaN(endSegundo) && startSegundo < endSegundo) {
                console.log("Aplicando filtro directamente:", startSegundo, endSegundo);

                // Actualizar variables locales y globales
                timeFilter.segundo_inicio = startSegundo;
                timeFilter.segundo_fin = endSegundo;
                window.dnsChartTimeFilter.segundo_inicio = startSegundo;
                window.dnsChartTimeFilter.segundo_fin = endSegundo;

                // Forzar actualización
                startAutoUpdate();
            }
        });
    }

    // Cerrar el modal
    span.onclick = function () {
        modal.style.display = 'none';
        if (activeChart) {
            activeChart.destroy();
            activeChart = null;
        }
    };

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = 'none';
            if (activeChart) {
                activeChart.destroy();
                activeChart = null;
            }
        }
    };

    window.addEventListener('resize', function () {
        if (activeChart) {
            activeChart.resize();
        }
    });
});