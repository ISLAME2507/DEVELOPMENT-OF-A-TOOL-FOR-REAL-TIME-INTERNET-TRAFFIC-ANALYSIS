document.addEventListener('DOMContentLoaded', function () {
    const submitButton = document.getElementById('submitDomainQuery');
    const domainForm = document.getElementById('domainForm');
    const resultsContainer = document.getElementById('domainResults');

    // Estado del filtro
    let filtroActivo = false;
    let filtroTiempo = {
        segundo_inicio: null,
        segundo_fin: null
    };

    // Escuchar evento de filtro de tiempo
    document.addEventListener('timeFilterUpdated', function (event) {
        console.log('Filtro actualizado:', event.detail);

        filtroActivo = true;
        filtroTiempo = {
            segundo_inicio: parseFloat(event.detail.segundo_inicio),
            segundo_fin: parseFloat(event.detail.segundo_fin)
        };
    });

    // Mensaje inicial (sin tabla)
    function showInitialMessage() {
        resultsContainer.innerHTML = `
            <div class="initial-message">
                <i class="fas fa-search"></i> Ingrese la cantidad y haga clic en "Consultar".
            </div>`;
    }

    // Función para renderizar resultados 
    function renderResults(data, meta) {
        let html = '';

        if (meta.filtro_tiempo) {
            html += `<div class="time-filter-info">
                <i class="fas fa-filter"></i> Filtro activo: 
                ${meta.filtro_tiempo.inicio.toFixed(6)}s - ${meta.filtro_tiempo.fin.toFixed(2)}s
            </div>`;
        }

        if (data.length > 0) {
            html += `<h3>Dominios ${meta.tipo_consulta.replace('_', ' ')}</h3>
            <div class="table-responsive">
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Dominio (queryname)</th>
                            <th>Total de Solicitudes</th>
                        </tr>
                    </thead>
                    <tbody>`;

            data.forEach(row => {
                html += `<tr>
                    <td>${escapeHtml(row.queryname)}</td>
                    <td>${row.total}</td>
                </tr>`;
            });

            html += `</tbody></table></div>`;
        } else {
            html += `<div class="no-results">
                <i class="fas fa-info-circle"></i> No se encontraron resultados
                ${meta.filtro_tiempo ? 'para el rango de tiempo seleccionado' : ''}
            </div>`;
        }

        resultsContainer.innerHTML = html;
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function ejecutarConsulta() {
        const formData = new FormData(domainForm);
        const params = new URLSearchParams();

        for (let [key, value] of formData.entries()) {
            params.append(key, value);
        }

        if (filtroActivo) {
            params.append('segundo_inicio', filtroTiempo.segundo_inicio);
            params.append('segundo_fin', filtroTiempo.segundo_fin);
        }

        resultsContainer.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i> Cargando resultados...
            </div>`;

        fetch('php/consulta_dominios.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    renderResults(data.data, data.meta);
                } else {
                    throw new Error(data.error || 'Error desconocido');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                resultsContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Error al cargar los resultados: ${error.message}
                </div>`;
            });
    }

   
    submitButton.addEventListener('click', function (e) {
        e.preventDefault();
        ejecutarConsulta();
    });


    showInitialMessage();
});