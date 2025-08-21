document.addEventListener('DOMContentLoaded', function () {
    // Elementos del DOM
    const applyFilterBtn = document.getElementById('applySegundoFilter');
    const startSegundoInput = document.getElementById('startSegundo');
    const endSegundoInput = document.getElementById('endSegundo');
    const totalMinutesElement = document.getElementById('totalMinutes');
    const minSegundoElement = document.getElementById('minSegundos');
    const maxSegundoElement = document.getElementById('maxSegundos');
    const rangeInfoElement = document.getElementById('rangoInfo');

    // Variables para almacenar datos
    let minSegundosAvailable = 0;
    let maxSegundosAvailable = 0;
    let totalDuration = 0;
    let tiemposDisponibles = [];
    let currentStartIndex = 0;
    let currentEndIndex = 0;

    // Inicialización
    cargarRangoTiempoDisponible();
    cargarTiemposDisponibles();

    // Función para cargar los tiempos exactos de la base de datos
    function cargarTiemposDisponibles() {
        fetch('php/obtener_tiempos_disponibles.php')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.tiempos.length > 0) {
                    tiemposDisponibles = data.tiempos;

                
                    startSegundoInput.value = tiemposDisponibles[0].toFixed(6);
                    endSegundoInput.value = tiemposDisponibles[tiemposDisponibles.length - 1].toFixed(6);

                    currentStartIndex = 0;
                    currentEndIndex = tiemposDisponibles.length - 1;

                    configurarNavegacionConFlechas();
                }
            });
    }

    function configurarNavegacionConFlechas() {
        startSegundoInput.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                handleArrowNavigation(this, e.key, 'start');
            }
        });

        endSegundoInput.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                handleArrowNavigation(this, e.key, 'end');
            }
        });
    }

    function handleArrowNavigation(input, direction, type) {
        if (tiemposDisponibles.length === 0) return;

        let currentIndex = type === 'start' ? currentStartIndex : currentEndIndex;
        let newIndex = currentIndex;

        if (direction === 'ArrowUp' && currentIndex < tiemposDisponibles.length - 1) {
            newIndex = currentIndex + 1;
        } else if (direction === 'ArrowDown' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        }

      
        const newValue = tiemposDisponibles[newIndex];
        input.value = newValue.toFixed(6);

        if (type === 'start') {
            currentStartIndex = newIndex;
       
            if (newIndex > currentEndIndex) {
                endSegundoInput.value = newValue.toFixed(6);
                currentEndIndex = newIndex;
            }
        } else {
            currentEndIndex = newIndex;
         
            if (newIndex < currentStartIndex) {
                startSegundoInput.value = newValue.toFixed(6);
                currentStartIndex = newIndex;
            }
        }
    }

    // Búsqueda binaria para encontrar el índice más cercano
    function findClosestIndex(value) {
        let left = 0;
        let right = tiemposDisponibles.length - 1;
        let mid;

        while (left <= right) {
            mid = Math.floor((left + right) / 2);
            if (tiemposDisponibles[mid] === value) return mid;
            if (tiemposDisponibles[mid] < value) left = mid + 1;
            else right = mid - 1;
        }

        return left < tiemposDisponibles.length ? left : tiemposDisponibles.length - 1;
    }

    function cargarRangoTiempoDisponible() {
        fetch('php/obtener_tiempo.php')
            .then(response => {
                if (!response.ok) throw new Error('Error al obtener el rango de tiempo');
                return response.json();
            })
            .then(data => {
                if (data.success) {
              
                    minSegundosAvailable = parseFloat(data.rango_total.min_segundos);
                    maxSegundosAvailable = parseFloat(data.rango_total.max_segundos);
                    totalDuration = parseFloat(data.rango_total.total_minutos);

                  
                    actualizarUIconValoresReales();
                    habilitarControles();
                } else {
                    mostrarErrorRango(data.error || 'Error en los datos recibidos');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                mostrarErrorRango('Error al cargar el rango de tiempo');
            });
    }

    function actualizarUIconValoresReales() {
       
        totalMinutesElement.textContent = `${totalDuration.toFixed(2)} minutos`;
        minSegundoElement.textContent = minSegundosAvailable.toFixed(6);
        maxSegundoElement.textContent = maxSegundosAvailable.toFixed(1);
        document.getElementById('currentFilter').textContent = 'Ninguno (mostrando todos los datos)';

      
        startSegundoInput.min = minSegundosAvailable.toFixed(6);
        startSegundoInput.max = maxSegundosAvailable.toFixed(1);
        startSegundoInput.value = minSegundosAvailable.toFixed(6);
        startSegundoInput.placeholder = minSegundosAvailable.toFixed(6);

        endSegundoInput.min = minSegundosAvailable.toFixed(6);
        endSegundoInput.max = maxSegundosAvailable.toFixed(1);
        endSegundoInput.value = maxSegundosAvailable.toFixed(1);
        endSegundoInput.placeholder = maxSegundosAvailable.toFixed(1);
    }

    function habilitarControles() {
        startSegundoInput.removeAttribute('disabled');
        endSegundoInput.removeAttribute('disabled');
        applyFilterBtn.removeAttribute('disabled');
    }

    function mostrarErrorRango(mensaje) {
        rangeInfoElement.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i> ${mensaje}
            </div>
        `;
    }

    function actualizarInfoRangoTotal() {
        rangeInfoElement.innerHTML = `
            <div class="info-item">
                <span class="info-label">Duración total:</span>
                <span class="info-value">${totalDuration.toFixed(2)} minutos</span>
            </div>
            <div class="info-item">
                <span class="info-label">Rango disponible:</span>
                <span class="info-value">${minSegundosAvailable.toFixed(6)} a ${maxSegundosAvailable.toFixed(1)} segundos</span>
            </div>
            <div class="info-item">
                <span class="info-label">Filtro actual:</span>
                <span class="info-value">Ninguno (mostrando todos los datos)</span>
            </div>
        `;
    }

    function actualizarInfoRango(inicio, fin) {
        rangeInfoElement.innerHTML = `
            <div class="info-item">
                <span class="info-label">Duración total:</span>
                <span class="info-value">${totalDuration.toFixed(2)} minutos</span>
            </div>
            <div class="info-item">
                <span class="info-label">Rango disponible:</span>
                <span class="info-value">${minSegundosAvailable.toFixed(6)} a ${maxSegundosAvailable.toFixed(1)} segundos</span>
            </div>
            <div class="info-item highlight">
                <span class="info-label">Filtrando:</span>
                <span class="info-value">${inicio.toFixed(6)} a ${fin.toFixed(1)} segundos</span>
            </div>
            <div class="info-item">
                <span class="info-label">Duración seleccionada:</span>
                <span class="info-value">${((fin - inicio) / 60).toFixed(2)} minutos</span>
            </div>
        `;
    }

    function getSegundoFilterValues() {
        return {
            segundo_inicio: parseFloat(startSegundoInput.value),
            segundo_fin: parseFloat(endSegundoInput.value)
        };
    }

    function validateSegundoFilter() {
        const start = parseFloat(startSegundoInput.value);
        const end = parseFloat(endSegundoInput.value);

        if (isNaN(start) || isNaN(end)) {
            alert('Los valores deben ser numéricos');
            return false;
        }

        if (start < minSegundosAvailable || end > maxSegundosAvailable) {
            alert(`El rango válido es de ${minSegundosAvailable.toFixed(6)} a ${maxSegundosAvailable.toFixed(1)} segundos`);
            return false;
        }

        if (start >= end) {
            alert('El valor inicial debe ser menor al final');
            return false;
        }

        return true;
    }

    // Función para notificar a los gráficos que deben actualizarse
    function updateAllCharts() {
        if (!validateSegundoFilter()) return;

        const filter = getSegundoFilterValues();
        actualizarInfoRango(filter.segundo_inicio, filter.segundo_fin);

     
        const event = new CustomEvent('timeFilterUpdated', {
            detail: {
                segundo_inicio: filter.segundo_inicio,
                segundo_fin: filter.segundo_fin
            }
        });
        document.dispatchEvent(event);

        document.getElementById('lastUpdateTimestamp').textContent =
            `Última actualización: ${new Date().toLocaleTimeString()}`;
    }


    applyFilterBtn.addEventListener('click', updateAllCharts);

    document.getElementById('segundoFilterForm')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            updateAllCharts();
        }
    });

    [startSegundoInput, endSegundoInput].forEach(input => {
        input.addEventListener('change', function () {
            const value = parseFloat(this.value);
            if (!isNaN(value)) {
                if (this === startSegundoInput) {
                    currentStartIndex = findClosestIndex(value);
                    if (value > parseFloat(endSegundoInput.value)) {
                        endSegundoInput.value = value.toFixed(1);
                        currentEndIndex = currentStartIndex;
                    }
                } else {
                    currentEndIndex = findClosestIndex(value);
                    if (value < parseFloat(startSegundoInput.value)) {
                        startSegundoInput.value = value.toFixed(6);
                        currentStartIndex = currentEndIndex;
                    }
                }

                this.value = Math.max(
                    minSegundosAvailable,
                    Math.min(maxSegundosAvailable, value)
                ).toFixed(this === startSegundoInput ? 6 : 1);
            }
        });
    });
});