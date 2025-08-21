document.addEventListener('DOMContentLoaded', function () {
    // Elementos del DOM
    const form = document.getElementById('domainComparisonForm');
    const compareButton = document.getElementById('compareDomains');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const alertContainer = document.getElementById('alertContainer');
    const chartCanvas = document.getElementById('dnsQueryChart');
    const dnsRecordTypeSelect = document.getElementById('dnsRecordType');
    const chartModal = document.getElementById('chartModal');

    // Variables de estado
    let dnsQueryChart = null;
    let activeChart = null;
    let currentChartData = null;
    let timeFilter = {
        start: null,
        end: null,
        active: false
    };

    // Colores para los datasets
    const domainColors = ['#FF6384', '#36A2EB', '#FFCE56'];

    // Escuchar evento de actualización de filtro de tiempo
    document.addEventListener('timeFilterUpdated', function (e) {
        timeFilter = {
            start: parseFloat(e.detail.segundo_inicio),
            end: parseFloat(e.detail.segundo_fin),
            active: true
        };

       
        if (currentChartData) {
            fetchDomainData();
        }
    });

    //  Función principal para obtener datos
    async function fetchDomainData() {
        const dominio1 = document.getElementById('dominio1').value.trim();
        const dominio2 = document.getElementById('dominio2').value.trim();
        const dominio3 = document.getElementById('dominio3').value.trim();

        if (!dominio1 || !dominio2 || !dominio3) {
            showAlert('Por favor, ingrese los tres dominios para comparar');
            return;
        }

        loadingIndicator.style.display = 'block';
        alertContainer.innerHTML = '';

        try {
         
            if (dnsQueryChart) {
                try {
                    dnsQueryChart.destroy();
                } catch (e) {
                    
                }
                dnsQueryChart = null;
            }

           
            const chartContainer = document.getElementById('chartContainer');
            if (chartContainer) {
           
                const oldCanvas = document.getElementById('dnsQueryChart');
                if (oldCanvas) {
                    oldCanvas.remove();
                }

         
                const newCanvas = document.createElement('canvas');
                newCanvas.id = 'dnsQueryChart';
                newCanvas.style.width = '100%';
                newCanvas.style.height = '400px';
                chartContainer.appendChild(newCanvas);
            }

         
            await new Promise(resolve => setTimeout(resolve, 50));

      
            const formData = new FormData(form);

      
            if (timeFilter.active) {
                formData.append('segundo_inicio', timeFilter.start);
                formData.append('segundo_fin', timeFilter.end);
            }

  
            const response = await fetch('php/comparacion_dominios.php', {
                method: 'POST',
                body: formData
            });


            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error en la respuesta del servidor');
            }

         
            currentChartData = {
                domains: [dominio1, dominio2, dominio3],
                data: data,
                recordType: dnsRecordTypeSelect.value,
                timeFilter: data.meta.timeFilter
            };

   
            dnsQueryChart = createChart('dnsQueryChart', currentChartData);

            

       
            if (timeFilter.active && dnsQueryChart) {
                showAlert(`Filtro aplicado: ${timeFilter.start}s - ${timeFilter.end}s`, 'info');
            }

        } catch (error) {
   
            if (error.message &&
                !error.message.includes('Canvas is already in use') &&
                !error.message.includes('No se pudo crear el gráfico')) {
                showAlert(`Error en la operación: ${error.message}`);
            }
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    //Función mejorada para crear gráficos
    function createChart(canvasId, chartData) {
       
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            return null;
        }


        if (!chartData || !chartData.data || !chartData.domains) {
            return null;
        }


        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            return null;
        }

        const { domains, data, recordType, timeFilter } = chartData;

    
        for (let i = 1; i <= domains.length; i++) {
            const domainKey = `domain${i}`;
            if (!data[domainKey] || !data[domainKey].requests || !data[domainKey].responses) {
                return null;
            }
        }

        // Configurar título con información de filtros
        let chartTitle = `Comparación DNS - Tipo: ${recordType === 'todo' ? 'Todos' : recordType}`;
        if (timeFilter) {
            chartTitle += ` | Filtro: ${timeFilter.start}s - ${timeFilter.end}s`;
        }

        // Preparar datasets con validación
        const datasets = [];

        domains.forEach((domain, index) => {
            const domainKey = `domain${index + 1}`;

           
            datasets.push({
                label: `${domain} - Solicitudes`,
                data: data[domainKey].requests || [],
                borderColor: domainColors[index],
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 3
            });

         
            datasets.push({
                label: `${domain} - Respuestas`,
                data: data[domainKey].responses || [],
                borderColor: domainColors[index],
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.1,
                pointRadius: 3
            });
        });

   
        const labels = data.timeLabels || [];

        // Configuración del gráfico
        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: chartTitle,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: ${context.raw}`;
                            },
                            afterLabel: function (context) {
                                const domainIndex = Math.floor(context.datasetIndex / 2);
                                const domainKey = `domain${domainIndex + 1}`;
                                const arrivalTimes = data[domainKey]?.arrivalTimes || [];
                                return arrivalTimes[context.dataIndex] ?
                                    `Hora: ${arrivalTimes[context.dataIndex]}` : '';
                            }
                        }
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Tiempo (segundos)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Cantidad'
                        },
                        beginAtZero: true
                    }
                }
            }
        };

        try {
        
            return new Chart(ctx, config);
        } catch (error) {
            return null;
        }
    }

    //  Función para mostrar alertas
    function showAlert(message, type = 'error') {
        const icon = type === 'error' ? 'exclamation-triangle' :
            type === 'info' ? 'info-circle' : 'check-circle';
        const bgColor = type === 'error' ? '#f8d7da' :
            type === 'info' ? '#d1ecf1' : '#d4edda';
        const textColor = type === 'error' ? '#721c24' :
            type === 'info' ? '#0c5460' : '#155724';

        alertContainer.innerHTML = `
            <div style="background-color: ${bgColor}; color: ${textColor}; 
                 padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                <i class="fas fa-${icon}"></i> ${message}
            </div>`;
    }

    //  Event listeners
    compareButton.addEventListener('click', fetchDomainData);
    dnsRecordTypeSelect.addEventListener('change', function () {
        if (currentChartData) {
            currentChartData.recordType = this.value;
            fetchDomainData();
        }
    });

    //  Carga inicial si hay dominios prellenados
    if (document.getElementById('dominio1').value &&
        document.getElementById('dominio2').value &&
        document.getElementById('dominio3').value) {
        fetchDomainData();
    }
});