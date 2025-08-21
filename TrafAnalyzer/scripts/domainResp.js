document.addEventListener('DOMContentLoaded', function () {
    const submitButton = document.getElementById('submitDomainResponseQuery');
    const resultsContainer = document.getElementById('domainResponseResults');
    let timeFilter = null;


    document.addEventListener('timeFilterUpdated', function (e) {
        timeFilter = {
            start: e.detail.segundo_inicio,
            end: e.detail.segundo_fin
        };
    });

 
    function showInitialMessage() {
        resultsContainer.innerHTML = `
            <div class="initial-message">
                <i class="fas fa-search"></i> Ingrese la cantidad y haga clic en "Consultar".
            </div>`;
    }

    // Función principal 
    async function loadDomainResponses() {
        try {
     
            resultsContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i> Cargando datos...
                </div>`;

           
            const tipo = document.getElementById('tipo_respuesta').value;
            const cantidad = document.getElementById('cantidad_respuesta').value;

            let url = `php/respuesta_dominios.php?tipo_respuesta=${tipo}&cantidad_respuesta=${cantidad}`;

       
            if (timeFilter) {
                url += `&segundo_inicio=${timeFilter.start}&segundo_fin=${timeFilter.end}`;
            }

          
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error del servidor');
            }

       
            displayResults(data.data, timeFilter);

        } catch (error) {
            console.error('Error:', error);
            resultsContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i> ${error.message}
                </div>`;
        }
    }

    // Función para mostrar resultados
    function displayResults(data, filter) {
        if (!data || data.length === 0) {
            let message = 'No se encontraron resultados';
            if (filter) {
                message += ` para el rango de tiempo ${filter.start}s - ${filter.end}s`;
            }
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-info-circle"></i> ${message}
                </div>`;
            return;
        }

        let html = `
            ${filter ? `
                <div class="time-filter-banner">
                    <i class="fas fa-filter"></i> Filtro aplicado: ${filter.start}s - ${filter.end}s
                </div>` : ''}
            <div class="table-wrapper">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>Dominio</th>
                            <th>Total Respuestas</th>
                        </tr>
                    </thead>
                    <tbody>`;

        data.forEach(item => {
            html += `
                <tr>
                    <td>${item.respname || 'N/A'}</td>
                    <td>${item.total || 0}</td>
                </tr>`;
        });

        html += `</tbody></table></div>`;

        resultsContainer.innerHTML = html;
    }


    submitButton.addEventListener('click', function (e) {
        e.preventDefault();
        loadDomainResponses();
    });

 
    showInitialMessage();
});