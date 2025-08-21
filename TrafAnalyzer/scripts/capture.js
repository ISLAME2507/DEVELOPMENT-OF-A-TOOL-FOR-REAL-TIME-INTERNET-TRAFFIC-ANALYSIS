// Variables de estado
let isCapturing = false;
let currentUserId = null;
let statusCheckInterval = null;
let chartsUpdateInterval = null;
let chartsInitialized = false;
let chartInitializationAttempts = 0;
const MAX_INITIALIZATION_ATTEMPTS = 3;

// Elementos UI
const startBtn = document.getElementById('startCaptureBtn');
const stopBtn = document.getElementById('stopCaptureBtn');
const loader = document.getElementById('loader');
const statusDisplay = document.getElementById('captureStatus');

// Inicialización
document.addEventListener('DOMContentLoaded', function () {
    loadUserInfo();
    initializeEventListeners();
});

// Obtener información del usuario
async function loadUserInfo() {
    try {
        const response = await fetch('php/userinfo.php');
        if (!response.ok) throw new Error('Error al obtener información de usuario');

        const data = await response.json();
        if (!data.user_id) throw new Error('ID de usuario no recibido');

        currentUserId = parseInt(data.user_id);
        console.log(`Usuario ID cargado: ${currentUserId}`);

   
        const userNameElement = document.getElementById('nombreUsuario');
        if (userNameElement && data.user_name) {
            userNameElement.textContent = data.user_name;
        }

        await checkCaptureStatus(); 
    } catch (error) {
        console.error('Error en loadUserInfo:', error);
        showError('Error al cargar información de usuario. Recargue la página.');
    }
}

//  Función startCapture para incluir eventos
async function startCapture() {
    if (!currentUserId) {
        showError('No se pudo identificar al usuario');
        return;
    }
    try {
        setLoading(true);
        updateStatus('Iniciando captura...', 'blue');
        const timestamp = Date.now();
        const response = await fetch(`php/start_capture.php?user_id=${currentUserId}&t=${timestamp}`, {
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
       
        if (response.status === 409) {
            console.warn('Captura previa bloqueada - error 409 silenciado');
            return; // Termina la función sin mostrar error
        }
       
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || `Error HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.status === 'success') {
            updateStatus('Captura en progreso...', 'green');
            isCapturing = true;
            updateButtons();
            startStatusCheck();
            
            if (typeof window.startCaptureCoordinated === 'function') {
                await window.startCaptureCoordinated();
            } else {
                dispatchCaptureEvents('captureStarted');
                await initializeChartsWithRetry();
                startChartsUpdate();
            }
            setTimeout(() => verifyCaptureStatus(), 5000);
        } else {
            throw new Error(data.message || 'Error al iniciar captura');
        }
    } catch (error) {
        console.error('Error en startCapture:', error);
        showError(error.message);
        dispatchCaptureEvents('captureError');
    } finally {
        setLoading(false);
    }
}

// Modificar también la función stopCapture:
async function stopCapture() {
    if (!currentUserId) return;

    try {
        setLoading(true);
        updateStatus('Deteniendo captura...', 'orange');

        const response = await fetch(`php/stop_capture.php?user_id=${currentUserId}&t=${Date.now()}`);

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}`);
        }

        let data;
        try {
            const responseText = await response.text();
            data = responseText ? JSON.parse(responseText) : { status: 'stopped' };
        } catch (parseError) {
            console.warn('Error al parsear respuesta como JSON, asumiendo que la captura se detuvo:', parseError);
            data = { status: 'stopped' };
        }

        if (data.status === 'stopped') {
            updateStatus('Captura detenida', 'gray');
            isCapturing = false;
            chartsInitialized = false;
            chartInitializationAttempts = 0;
            updateButtons();
            stopStatusCheck();
            stopChartsUpdate();

          
            if (typeof window.stopCaptureCoordinated === 'function') {
                window.stopCaptureCoordinated();
            } else {
         
                dispatchCaptureEvents('captureStopped');
            }

            setTimeout(checkCaptureStatus, 1000);
        } else {
            throw new Error(data.message || 'Respuesta inesperada del servidor');
        }
    } catch (error) {
        console.error('Error en stopCapture:', error);
        showError(error.message);
        setTimeout(checkCaptureStatus, 1000);
    } finally {
        setLoading(false);
    }
}





//  Función para forzar actualización de todos los gráficos
function forceAllChartsUpdate() {
    console.log('Forzando actualización de todos los gráficos...');

   
    document.dispatchEvent(new CustomEvent('forceChartUpdate', {
        detail: {
            source: 'manual',
            timestamp: Date.now()
        }
    }));

    const updateFunctions = [
        'updateProtocolChart',
        'updateDnsChart',
        'updateFlowChart',
        'updateTrafficVolumeChart',
        'updateMapChart',
        'loadNetworkData' 
    ];

    updateFunctions.forEach(funcName => {
        if (typeof window[funcName] === 'function') {
            try {
                window[funcName]();
                console.log(`? ${funcName} ejecutado`);
            } catch (error) {
                console.warn(`? Error en ${funcName}:`, error);
            }
        }
    });
}

//  función forceChartsRefresh para incluir eventos
function forceChartsRefresh() {
    console.log('Forzando actualización manual de gráficos...');
    updateStatus('Actualizando gráficos...', 'blue');

    
    forceAllChartsUpdate();

    if (isCapturing) {
        if (!chartsInitialized) {
            initializeChartsWithRetry().then(() => {
                updateStatus('Gráficos reinicializados', 'green');
             
                setTimeout(() => {
                    dispatchCaptureEvents('captureStarted');
                    forceAllChartsUpdate();
                }, 1000);
                setTimeout(() => {
                    if (isCapturing) {
                        updateStatus('Captura activa - Todos los gráficos inicializados', 'green');
                    }
                }, 2000);
            });
        } else {
            forceAllChartsUpdate();
            updateStatus('Gráficos actualizados', 'green');
            setTimeout(() => {
                if (isCapturing) {
                    updateStatus('Captura activa - Todos los gráficos inicializados', 'green');
                }
            }, 2000);
        }
    } else {
        forceAllChartsUpdate();
        updateStatus('Gráficos actualizados', 'gray');
    }
}


//Función para inicializar gráficos con reintentos 
async function initializeChartsWithRetry() {
    console.log(`Intentando inicializar gráficos (intento ${chartInitializationAttempts + 1}/${MAX_INITIALIZATION_ATTEMPTS})`);

    try {
        chartInitializationAttempts++;

      
        const waitTime = chartInitializationAttempts * 2000; 
        await new Promise(resolve => setTimeout(resolve, waitTime));

      
        const hasData = await checkDataAvailability();
        if (!hasData && chartInitializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
            console.log('No hay datos suficientes aún, reintentando...');
            setTimeout(() => initializeChartsWithRetry(), 3000);
            return;
        }

        const result = await initializeAllCharts();

        chartsInitialized = true;
        chartInitializationAttempts = 0; 
        console.log('Gráficos inicializados correctamente');

       
        if (result.criticalFailures === 0) {
            updateStatus('Captura activa - Todos los gráficos inicializados', 'green');
        } else if (result.success >= result.total * 0.7) { 
            updateStatus('Captura activa - Gráficos principales funcionando', 'green');
        } else {
            updateStatus('Captura activa', 'green'); 
        }

    } catch (error) {
        console.error('Error al inicializar gráficos:', error);

     
        if (chartInitializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
            console.log('Reintentando inicialización de gráficos...');
            setTimeout(() => initializeChartsWithRetry(), 5000);
        } else {
            console.error('Se alcanzó el máximo de intentos de inicialización');
            chartsInitialized = false;
            chartInitializationAttempts = 0;
          
            updateStatus('Captura activa', 'green');
        }
    }
}

//  Verificar disponibilidad de datos
async function checkDataAvailability() {
    try {
        
       
        const ipNetworkReady = typeof window.isIpNetworkChartReady === 'function' &&
            window.isIpNetworkChartReady();

        if (!ipNetworkReady) {
            console.log('IP Network Chart container no está listo aún...');
            return false;
        }

    } catch (error) {
        console.warn('Error al verificar disponibilidad de datos:', error);
        return true; // Asumir que hay datos si no podemos verificar
    }
}


//  Función para inicializar todos los gráficos disponibles
async function initializeAllCharts() {
    const chartInitializers = [
        {
            name: 'Protocol Chart',
            initFunc: 'initializeProtocolChart',
            updateFunc: 'updateProtocolChart',
            required: true
        },
        {
            name: 'DNS Chart',
            initFunc: 'initializeDnsChart',
            updateFunc: 'updateDnsChart',
            required: true
        },
        {
            name: 'Flow Chart',
            initFunc: 'initializeFlowChart',
            updateFunc: 'updateFlowChart',
            required: true
        },
        {
            name: 'Traffic Volume Chart',
            initFunc: 'initializeTrafficVolumeChart',
            updateFunc: 'updateTrafficVolumeChart',
            required: true
        },
        {
            name: 'Map Chart',
            initFunc: 'initializeMapChart',
            updateFunc: 'updateMapChart',
            required: false
        },
        {
            name: 'IP Network Chart',
            initFunc: 'initializeIpNetworkChart',
            updateFunc: 'loadNetworkData', 
            required: true
        }
    ];

    let successCount = 0;
    let totalCharts = chartInitializers.length;
    let criticalFailures = 0;

    for (const chart of chartInitializers) {
        try {
            console.log(`Inicializando ${chart.name}...`);

            
            if (typeof window[chart.initFunc] === 'function') {
                await window[chart.initFunc]();
                console.log(`? ${chart.name} inicializado con función específica`);
            }
       
            else if (typeof window[chart.updateFunc] === 'function') {
                await window[chart.updateFunc]();
                console.log(`? ${chart.name} inicializado con función de actualización`);
            }
       
            else {
                const altFuncName = chart.name.toLowerCase().replace(/\s+/g, '') + 'Init';
                if (typeof window[altFuncName] === 'function') {
                    await window[altFuncName]();
                    console.log(`? ${chart.name} inicializado con función alternativa`);
                } else {
                    throw new Error(`No se encontró función de inicialización para ${chart.name}`);
                }
            }

            successCount++;

            
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.warn(`? Error al inicializar ${chart.name}:`, error);

          
            if (chart.required) {
                console.error(`? Fallo crítico en ${chart.name} (requerido)`);
                criticalFailures++;
            }
        }
    }

    console.log(`Inicialización completada: ${successCount}/${totalCharts} gráficos exitosos`);


    await loadAdditionalData();

 
    if (criticalFailures > 2) { // Solo si fallan más de 2 gráficos críticos
        throw new Error(`Demasiados fallos críticos: ${criticalFailures} gráficos requeridos fallaron`);
    }


    return {
        success: successCount,
        total: totalCharts,
        criticalFailures: criticalFailures
    };
}


//  Cargar datos adicionales
async function loadAdditionalData() {
    const additionalLoaders = [
        { name: 'IP List', func: 'loadIpList' },
        { name: 'Capture Time Info', func: 'updateCaptureTimeInfo' },
        { name: 'Network Stats', func: 'loadNetworkStats' },
        { name: 'Protocol Stats', func: 'loadProtocolStats' }
    ];

    for (const loader of additionalLoaders) {
        try {
            if (typeof window[loader.func] === 'function') {
                await window[loader.func]();
                console.log(`? ${loader.name} cargado`);
            }
        } catch (error) {
            console.warn(`? Error al cargar ${loader.name}:`, error);
        }
    }
}

// Función para actualizar todos los gráficos
function updateAllCharts() {
   
    if (!chartsInitialized) {
        console.log('Gráficos no inicializados aún, omitiendo actualización');
        return;
    }

    console.log('Actualizando todos los gráficos...');

    // Lista de funciones de actualización disponibles
    const updateFunctions = [
        'updateProtocolChart',
        'updateDnsChart',
        'updateFlowChart',
        'updateTrafficVolumeChart',
        'updateMapChart',
        'loadNetworkData' 
    ];

    let updatedCount = 0;

    // Actualizar cada gráfico disponible
    updateFunctions.forEach(funcName => {
        try {
            if (typeof window[funcName] === 'function') {
                window[funcName]();
                updatedCount++;
            }
        } catch (error) {
            console.warn(`Error al actualizar ${funcName}:`, error);
        }
    });

    console.log(`${updatedCount} gráficos actualizados`);

  
    try {
        if (typeof loadIpList === 'function') {
            loadIpList();
        }
    } catch (error) {
        console.warn('Error al actualizar lista de IPs:', error);
    }

  
    try {
        if (typeof updateCaptureTimeInfo === 'function') {
            updateCaptureTimeInfo();
        }
    } catch (error) {
        console.warn('Error al actualizar información de tiempo:', error);
    }
}

//  Control del intervalo de actualización de gráficos
function startChartsUpdate() {
    stopChartsUpdate();

    
    if (chartsInitialized) {
       
        updateAllCharts();
  
        chartsUpdateInterval = setInterval(updateAllCharts, 5000);
        console.log('Actualización automática de gráficos iniciada');
    } else {
        console.log('Esperando inicialización de gráficos...');
  
        setTimeout(() => {
            if (isCapturing) {
                if (chartsInitialized) {
                    startChartsUpdate();
                } else {
                  
                    initializeChartsWithRetry();
                }
            }
        }, 3000);
    }
}

// Detener actualización de gráficos
function stopChartsUpdate() {
    if (chartsUpdateInterval) {
        clearInterval(chartsUpdateInterval);
        chartsUpdateInterval = null;
        console.log('Actualización automática de gráficos detenida');
    }
}
// Función para disparar eventos de captura
function dispatchCaptureEvents(eventType) {
    console.log(`Disparando evento: ${eventType}`);

    // Eventos para todos los gráficos
    document.dispatchEvent(new CustomEvent(eventType, {
        detail: {
            timestamp: Date.now(),
            userId: currentUserId
        }
    }));

    // Evento específico para forzar actualización
    if (eventType === 'captureStarted') {
        setTimeout(() => {
            document.dispatchEvent(new CustomEvent('forceChartUpdate', {
                detail: { source: 'captureStart' }
            }));
        }, 2000);
    }
}
// checkCaptureStatus para incluir eventos
async function checkCaptureStatus() {
    if (!currentUserId) return;

    try {
        const response = await fetch(`php/check_status.php?user_id=${currentUserId}&t=${Date.now()}`);
        if (!response.ok) return;

        const data = await response.json();
        const wasCapturing = isCapturing;
        isCapturing = data.running;

        updateButtons();
        updateStatus(
            isCapturing ? 'CAPTURA ACTIVA' : 'No hay captura activa',
            isCapturing ? 'green' : 'gray'
        );


        if (!wasCapturing && isCapturing) {
            console.log('Detectado cambio: captura iniciada');
            dispatchCaptureEvents('captureStarted');
            startStatusCheck();

            if (!chartsInitialized) {
                await initializeChartsWithRetry();
            }
            startChartsUpdate();
        } else if (wasCapturing && !isCapturing) {
            console.log('Detectado cambio: captura detenida');
            dispatchCaptureEvents('captureStopped');
            stopStatusCheck();
            stopChartsUpdate();
            chartsInitialized = false;
            chartInitializationAttempts = 0;
        }
    } catch (error) {
        console.error('Error en checkCaptureStatus:', error);
    }
}

// Verificación adicional del estado
async function verifyCaptureStatus() {
    await checkCaptureStatus();

    if (isCapturing) {
        console.log('Verificación: La captura sigue activa')
        if (!chartsInitialized) {
            console.log('Gráficos no inicializados después de la verificación, reinicializando...');
            await initializeChartsWithRetry();
            startChartsUpdate();
        }
    } else {
        console.warn('Verificación: La captura se detuvo inesperadamente');
        showError('La captura se detuvo automáticamente. Verifique los logs.');
    }
}

// Control del intervalo de verificación
function startStatusCheck() {
    stopStatusCheck();
    statusCheckInterval = setInterval(checkCaptureStatus, 5000);
}

function stopStatusCheck() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}

// Actualizar interfaz de usuario
function updateButtons() {
    if (startBtn) startBtn.disabled = isCapturing || loader.style.display === 'block';
    if (stopBtn) stopBtn.disabled = !isCapturing || loader.style.display === 'block';
}

function updateStatus(message, color) {
    if (statusDisplay) {
        statusDisplay.textContent = message;
        statusDisplay.style.color = color;
    }
}

function showError(message) {
    console.error('Error:', message);
    updateStatus(`Error: ${message}`, 'red');
}

function setLoading(loading) {
    if (loader) {
        loader.style.display = loading ? 'block' : 'none';
    }
    updateButtons();
}

// Inicializar event listeners
function initializeEventListeners() {
    if (startBtn) {
        startBtn.addEventListener('click', startCapture);
        startBtn.disabled = false;
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', stopCapture);
        stopBtn.disabled = true;
    }
}

//  Función para forzar actualización manual de gráficos
function forceChartsRefresh() {
    console.log('Forzando actualización manual de gráficos...');
    updateStatus('Actualizando gráficos...', 'blue');

 
    forceAllChartsUpdate();

    if (isCapturing) {
        if (!chartsInitialized) {
            initializeChartsWithRetry().then(() => {
                updateStatus('Gráficos reinicializados', 'green');
            
                setTimeout(() => {
                    dispatchCaptureEvents('captureStarted');
                    forceAllChartsUpdate();
                }, 1000);
                setTimeout(() => {
                    if (isCapturing) {
                        updateStatus('Captura activa', 'green'); 
                    }
                }, 2000);
            });
        } else {
            forceAllChartsUpdate();
            updateStatus('Gráficos actualizados', 'green');
            setTimeout(() => {
                if (isCapturing) {
                    updateStatus('Captura activa', 'green');
                }
            }, 2000);
        }
    } else {
        forceAllChartsUpdate();
        updateStatus('Gráficos actualizados', 'gray');
    }
}


window.addEventListener('beforeunload', function () {
    stopStatusCheck();
    stopChartsUpdate();
});


window.forceChartsRefresh = forceChartsRefresh;


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        startCapture,
        stopCapture,
        checkCaptureStatus,
        updateAllCharts,
        initializeChartsWithRetry,
        forceChartsRefresh
    };
}

// AGREGAR listener para cuando los gráficos estén listos
document.addEventListener('protocolChartReady', (e) => {
    console.log('Protocol Chart está listo:', e.detail);

 
    if (isCapturing && typeof window.setProtocolChartCaptureState === 'function') {
        setTimeout(() => {
            window.setProtocolChartCaptureState(true);
        }, 500);
    }
});

// Exportar funciones adicionales
window.dispatchCaptureEvents = dispatchCaptureEvents;
window.forceAllChartsUpdate = forceAllChartsUpdate;