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

// Inicializaci�n
document.addEventListener('DOMContentLoaded', function () {
    loadUserInfo();
    initializeEventListeners();
});

// Obtener informaci�n del usuario
async function loadUserInfo() {
    try {
        const response = await fetch('php/userinfo.php');
        if (!response.ok) throw new Error('Error al obtener informaci�n de usuario');

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
        showError('Error al cargar informaci�n de usuario. Recargue la p�gina.');
    }
}

//  Funci�n startCapture para incluir eventos
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
            return; // Termina la funci�n sin mostrar error
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

// Modificar tambi�n la funci�n stopCapture:
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





//  Funci�n para forzar actualizaci�n de todos los gr�ficos
function forceAllChartsUpdate() {
    console.log('Forzando actualizaci�n de todos los gr�ficos...');

   
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

//  funci�n forceChartsRefresh para incluir eventos
function forceChartsRefresh() {
    console.log('Forzando actualizaci�n manual de gr�ficos...');
    updateStatus('Actualizando gr�ficos...', 'blue');

    
    forceAllChartsUpdate();

    if (isCapturing) {
        if (!chartsInitialized) {
            initializeChartsWithRetry().then(() => {
                updateStatus('Gr�ficos reinicializados', 'green');
             
                setTimeout(() => {
                    dispatchCaptureEvents('captureStarted');
                    forceAllChartsUpdate();
                }, 1000);
                setTimeout(() => {
                    if (isCapturing) {
                        updateStatus('Captura activa - Todos los gr�ficos inicializados', 'green');
                    }
                }, 2000);
            });
        } else {
            forceAllChartsUpdate();
            updateStatus('Gr�ficos actualizados', 'green');
            setTimeout(() => {
                if (isCapturing) {
                    updateStatus('Captura activa - Todos los gr�ficos inicializados', 'green');
                }
            }, 2000);
        }
    } else {
        forceAllChartsUpdate();
        updateStatus('Gr�ficos actualizados', 'gray');
    }
}


//Funci�n para inicializar gr�ficos con reintentos 
async function initializeChartsWithRetry() {
    console.log(`Intentando inicializar gr�ficos (intento ${chartInitializationAttempts + 1}/${MAX_INITIALIZATION_ATTEMPTS})`);

    try {
        chartInitializationAttempts++;

      
        const waitTime = chartInitializationAttempts * 2000; 
        await new Promise(resolve => setTimeout(resolve, waitTime));

      
        const hasData = await checkDataAvailability();
        if (!hasData && chartInitializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
            console.log('No hay datos suficientes a�n, reintentando...');
            setTimeout(() => initializeChartsWithRetry(), 3000);
            return;
        }

        const result = await initializeAllCharts();

        chartsInitialized = true;
        chartInitializationAttempts = 0; 
        console.log('Gr�ficos inicializados correctamente');

       
        if (result.criticalFailures === 0) {
            updateStatus('Captura activa - Todos los gr�ficos inicializados', 'green');
        } else if (result.success >= result.total * 0.7) { 
            updateStatus('Captura activa - Gr�ficos principales funcionando', 'green');
        } else {
            updateStatus('Captura activa', 'green'); 
        }

    } catch (error) {
        console.error('Error al inicializar gr�ficos:', error);

     
        if (chartInitializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
            console.log('Reintentando inicializaci�n de gr�ficos...');
            setTimeout(() => initializeChartsWithRetry(), 5000);
        } else {
            console.error('Se alcanz� el m�ximo de intentos de inicializaci�n');
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
            console.log('IP Network Chart container no est� listo a�n...');
            return false;
        }

    } catch (error) {
        console.warn('Error al verificar disponibilidad de datos:', error);
        return true; // Asumir que hay datos si no podemos verificar
    }
}


//  Funci�n para inicializar todos los gr�ficos disponibles
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
                console.log(`? ${chart.name} inicializado con funci�n espec�fica`);
            }
       
            else if (typeof window[chart.updateFunc] === 'function') {
                await window[chart.updateFunc]();
                console.log(`? ${chart.name} inicializado con funci�n de actualizaci�n`);
            }
       
            else {
                const altFuncName = chart.name.toLowerCase().replace(/\s+/g, '') + 'Init';
                if (typeof window[altFuncName] === 'function') {
                    await window[altFuncName]();
                    console.log(`? ${chart.name} inicializado con funci�n alternativa`);
                } else {
                    throw new Error(`No se encontr� funci�n de inicializaci�n para ${chart.name}`);
                }
            }

            successCount++;

            
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.warn(`? Error al inicializar ${chart.name}:`, error);

          
            if (chart.required) {
                console.error(`? Fallo cr�tico en ${chart.name} (requerido)`);
                criticalFailures++;
            }
        }
    }

    console.log(`Inicializaci�n completada: ${successCount}/${totalCharts} gr�ficos exitosos`);


    await loadAdditionalData();

 
    if (criticalFailures > 2) { // Solo si fallan m�s de 2 gr�ficos cr�ticos
        throw new Error(`Demasiados fallos cr�ticos: ${criticalFailures} gr�ficos requeridos fallaron`);
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

// Funci�n para actualizar todos los gr�ficos
function updateAllCharts() {
   
    if (!chartsInitialized) {
        console.log('Gr�ficos no inicializados a�n, omitiendo actualizaci�n');
        return;
    }

    console.log('Actualizando todos los gr�ficos...');

    // Lista de funciones de actualizaci�n disponibles
    const updateFunctions = [
        'updateProtocolChart',
        'updateDnsChart',
        'updateFlowChart',
        'updateTrafficVolumeChart',
        'updateMapChart',
        'loadNetworkData' 
    ];

    let updatedCount = 0;

    // Actualizar cada gr�fico disponible
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

    console.log(`${updatedCount} gr�ficos actualizados`);

  
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
        console.warn('Error al actualizar informaci�n de tiempo:', error);
    }
}

//  Control del intervalo de actualizaci�n de gr�ficos
function startChartsUpdate() {
    stopChartsUpdate();

    
    if (chartsInitialized) {
       
        updateAllCharts();
  
        chartsUpdateInterval = setInterval(updateAllCharts, 5000);
        console.log('Actualizaci�n autom�tica de gr�ficos iniciada');
    } else {
        console.log('Esperando inicializaci�n de gr�ficos...');
  
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

// Detener actualizaci�n de gr�ficos
function stopChartsUpdate() {
    if (chartsUpdateInterval) {
        clearInterval(chartsUpdateInterval);
        chartsUpdateInterval = null;
        console.log('Actualizaci�n autom�tica de gr�ficos detenida');
    }
}
// Funci�n para disparar eventos de captura
function dispatchCaptureEvents(eventType) {
    console.log(`Disparando evento: ${eventType}`);

    // Eventos para todos los gr�ficos
    document.dispatchEvent(new CustomEvent(eventType, {
        detail: {
            timestamp: Date.now(),
            userId: currentUserId
        }
    }));

    // Evento espec�fico para forzar actualizaci�n
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

// Verificaci�n adicional del estado
async function verifyCaptureStatus() {
    await checkCaptureStatus();

    if (isCapturing) {
        console.log('Verificaci�n: La captura sigue activa')
        if (!chartsInitialized) {
            console.log('Gr�ficos no inicializados despu�s de la verificaci�n, reinicializando...');
            await initializeChartsWithRetry();
            startChartsUpdate();
        }
    } else {
        console.warn('Verificaci�n: La captura se detuvo inesperadamente');
        showError('La captura se detuvo autom�ticamente. Verifique los logs.');
    }
}

// Control del intervalo de verificaci�n
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

//  Funci�n para forzar actualizaci�n manual de gr�ficos
function forceChartsRefresh() {
    console.log('Forzando actualizaci�n manual de gr�ficos...');
    updateStatus('Actualizando gr�ficos...', 'blue');

 
    forceAllChartsUpdate();

    if (isCapturing) {
        if (!chartsInitialized) {
            initializeChartsWithRetry().then(() => {
                updateStatus('Gr�ficos reinicializados', 'green');
            
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
            updateStatus('Gr�ficos actualizados', 'green');
            setTimeout(() => {
                if (isCapturing) {
                    updateStatus('Captura activa', 'green');
                }
            }, 2000);
        }
    } else {
        forceAllChartsUpdate();
        updateStatus('Gr�ficos actualizados', 'gray');
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

// AGREGAR listener para cuando los gr�ficos est�n listos
document.addEventListener('protocolChartReady', (e) => {
    console.log('Protocol Chart est� listo:', e.detail);

 
    if (isCapturing && typeof window.setProtocolChartCaptureState === 'function') {
        setTimeout(() => {
            window.setProtocolChartCaptureState(true);
        }, 500);
    }
});

// Exportar funciones adicionales
window.dispatchCaptureEvents = dispatchCaptureEvents;
window.forceAllChartsUpdate = forceAllChartsUpdate;