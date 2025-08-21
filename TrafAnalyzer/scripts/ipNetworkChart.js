

let network = null;
let currentIpFilter = '';
let currentTimeFilter = null;
let refreshTimer = null;
let isInitialized = false;
let networkContainer = null;



/**
 * Inicializa el gráfico IP Network
 * @returns {Promise} Promesa que se resuelve cuando la inicialización está completa
 */
function initializeIpNetworkChart() {
    return new Promise((resolve, reject) => {
        try {
            console.log('[IP Network] Iniciando inicialización...');

      
            networkContainer = document.getElementById('ipNetworkChart');
            if (!networkContainer) {
                throw new Error('Contenedor ipNetworkChart no encontrado en el DOM');
            }

            if (network) {
                network.destroy();
                network = null;
            }

         
            loadNetworkData()
                .then(() => {
                    isInitialized = true;
                    console.log('[IP Network] Inicialización completada con éxito');
                    resolve();
                })
                .catch(error => {
                    console.error('[IP Network] Error al cargar datos iniciales:', error);
                    reject(error);
                });

        } catch (error) {
            console.error('[IP Network] Error en la inicialización:', error);
            reject(error);
        }
    });
}

/**
 * Carga datos de red desde el servidor
 * @returns {Promise} Promesa que se resuelve cuando los datos están cargados
 */
function loadNetworkData() {
    return new Promise((resolve, reject) => {
        if (!networkContainer) {
            reject(new Error('Contenedor no disponible'));
            return;
        }

  
        const params = new URLSearchParams();
        if (currentIpFilter) params.append('iporigen', currentIpFilter);
        if (currentTimeFilter) {
            params.append('segundo_inicio', currentTimeFilter.segundo_inicio);
            params.append('segundo_fin', currentTimeFilter.segundo_fin);
        }
        params.append('t', Date.now());

        const url = `php/grafico_dispersion.php?${params.toString()}`;

     
        if (refreshTimer) clearTimeout(refreshTimer);
        networkContainer.classList.add('loading');

    
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (!data || data.length === 0) {
                    networkContainer.innerHTML = '<div class="no-data-message">No hay datos disponibles</div>';
                    resolve(data);
                    return;
                }

                updateNetworkGraph(data);
                scheduleRefresh();
                resolve(data);
            })
            .catch(error => {
                console.error('[IP Network] Error al cargar datos:', error);

            
                refreshTimer = setTimeout(() => {
                    loadNetworkData().then(resolve).catch(reject);
                }, 10000);

                reject(error);
            })
            .finally(() => {
                networkContainer.classList.remove('loading');
            });
    });
}

/**
 * Actualiza el gráfico con nuevos datos
 * @param {Array} data - Datos de conexiones de red
 */
function updateNetworkGraph(data) {
    if (!networkContainer) return;

    try {
        console.log(`[IP Network] Actualizando gráfico con ${data.length} conexiones`);

      
        networkContainer.innerHTML = '';
        if (network) network.destroy();

     
        const nodes = new vis.DataSet();
        const edges = new vis.DataSet();
        const nodeIds = new Set();

        data.forEach(conn => {
          
            if (!nodeIds.has(conn.source)) {
                nodes.add({
                    id: conn.source,
                    label: conn.source,
                    title: `IP: ${conn.source}`,
                    color: '#2B7CE9',
                    shape: 'dot',
                    font: { size: 10 },
                    type: 'ip'
                });
                nodeIds.add(conn.source);
            }

           
            if (!nodeIds.has(conn.target)) {
                nodes.add({
                    id: conn.target,
                    label: conn.target,
                    title: `Dominio: ${conn.target}`,
                    color: '#FF6384',
                    shape: 'square',
                    font: { size: 10 },
                    type: 'domain'
                });
                nodeIds.add(conn.target);
            }

          
            edges.add({
                from: conn.source,
                to: conn.target,
                value: conn.value || 1,
                title: `${conn.tipomensaje || 'desconocido'} (${conn.value || 1} conexiones)`,
                color: {
                    color: conn.tipomensaje === 'consulta' ? '#36A2EB' : '#FFCE56',
                    highlight: conn.tipomensaje === 'consulta' ? '#1A8FD8' : '#FFBD33'
                },
                arrows: 'to',
                width: Math.min(Math.max(1, Math.sqrt(conn.value) * 0.5), 5)
            });
        });

        
        const options = {
            nodes: {
                size: 12,
                font: { size: 10 },
                borderWidth: 1,
                fixed: false
            },
            edges: {
                smooth: { type: 'continuous', roundness: 0.5 },
                font: { size: 0 },
                selectionWidth: 2
            },
            physics: {
                stabilization: { iterations: 100 }
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                hideEdgesOnDrag: true
            }
        };

     
        network = new vis.Network(networkContainer, { nodes, edges }, options);

  
        setupNetworkEvents();

      
        createNetworkLegend();

    } catch (error) {
        console.error('[IP Network] Error al actualizar gráfico:', error);
        networkContainer.innerHTML = '<div class="error-message">Error al mostrar los datos</div>';
    }
}




function setupNetworkEvents() {
    if (!network || !networkContainer) return;


    const tooltip = document.createElement('div');
    tooltip.className = 'network-tooltip';
    networkContainer.appendChild(tooltip);


    network.on('hoverNode', params => {
        const node = network.body.data.nodes.get(params.node);
        const edges = network.body.data.edges.get({
            filter: edge => edge.from === node.id || edge.to === node.id
        });

        let tooltipContent = `<strong>${node.label}</strong><br>`;
        tooltipContent += `<strong>Tipo:</strong> ${node.type === 'ip' ? 'IP' : 'Dominio'}<br>`;

        if (node.type === 'ip') {
            tooltipContent += `<strong>Dominios conectados:</strong><br>`;
            edges.filter(e => e.from === node.id)
                .forEach(e => {
                    tooltipContent += `- ${e.to} (${e.tipomensaje})<br>`;
                });
        } else {
            tooltipContent += `<strong>IPs conectadas:</strong><br>`;
            edges.filter(e => e.to === node.id)
                .forEach(e => {
                    tooltipContent += `- ${e.from} (${e.tipomensaje})<br>`;
                });
        }

        tooltip.innerHTML = tooltipContent;
        tooltip.style.display = 'block';

        const position = network.canvasToDOM(network.getPositions([node.id])[node.id]);
        const containerRect = networkContainer.getBoundingClientRect();
        tooltip.style.left = `${position.x - containerRect.left + 10}px`;
        tooltip.style.top = `${position.y - containerRect.top + 10}px`;
    });

 
    network.on('blurNode', () => {
        tooltip.style.display = 'none';
    });

 
    network.on('click', params => {
        if (params.nodes.length > 0) {
            openModal(params.nodes[0]);
        }
    });
}


function createNetworkLegend() {
    if (!networkContainer) return;

    const legend = document.createElement('div');
    legend.id = 'network-legend';
    legend.innerHTML = `
        <div class="legend-title"><strong>Leyenda</strong></div>
        <div class="legend-item">
            <span class="legend-color" style="background:#2B7CE9;"></span>
            <span>Direccion IP</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background:#FF6384;"></span>
            <span>Dominio</span>
        </div>
        <div class="legend-item">
            <span class="legend-line" style="background:#36A2EB;"></span>
            <span>Consulta</span>
        </div>
        <div class="legend-item">
            <span class="legend-line" style="background:#FFCE56;"></span>
            <span>Respuesta</span>
        </div>
    `;
    networkContainer.appendChild(legend);
}

/**
 * Abre el modal con detalles del nodo seleccionado
 * @param {string} nodeId - ID del nodo seleccionado
 */
function openModal(nodeId) {
    if (!network || !networkContainer) return;

    const modal = document.getElementById('chartModal');
    const modalContainer = document.querySelector('.modal-chart-container');
    if (!modal || !modalContainer) return;

    const node = network.body.data.nodes.get(nodeId);
    if (!node) return;

  
    modal.style.display = 'block';
    modalContainer.innerHTML = '';


    const title = document.createElement('h3');
    title.textContent = `Detalle de ${node.type === 'ip' ? 'IP' : 'Dominio'}: ${node.label}`;
    title.style.marginBottom = '10px';
    title.style.textAlign = 'center';
    modalContainer.appendChild(title);

 
    const networkDiv = document.createElement('div');
    networkDiv.id = 'ipNetworkChartModal';
    networkDiv.style.width = '100%';
    networkDiv.style.height = '400px';
    modalContainer.appendChild(networkDiv);


    const connectedNodes = new Set([nodeId]);
    const connectedEdges = network.body.data.edges.get({
        filter: edge => edge.from === nodeId || edge.to === nodeId
    });

    connectedEdges.forEach(edge => {
        connectedNodes.add(edge.from);
        connectedNodes.add(edge.to);
    });

 
    const modalNodes = new vis.DataSet();
    const modalEdges = new vis.DataSet();

    Array.from(connectedNodes).forEach(id => {
        const nodeData = network.body.data.nodes.get(id);
        if (nodeData) {
            modalNodes.add({
                ...nodeData,
                font: { size: 14 },
                size: 16
            });
        }
    });

    connectedEdges.forEach(edge => {
        modalEdges.add({
            ...edge,
            width: Math.min(Math.max(2, Math.sqrt(edge.value) * 0.8), 8)
        });
    });


    new vis.Network(networkDiv, {
        nodes: modalNodes,
        edges: modalEdges
    }, {
        nodes: { size: 20, font: { size: 14 } },
        edges: { smooth: { type: 'continuous' } },
        interaction: { zoomView: true }
    });

  
    const infoTable = document.createElement('div');
    infoTable.className = 'info-table';
    infoTable.innerHTML = `
        <h4>Conexiones de ${node.label}</h4>
        <table>
            <thead>
                <tr>
                    <th>${node.type === 'ip' ? 'Dominio' : 'IP'}</th>
                    <th>Tipo</th>
                    <th>Conexiones</th>
                </tr>
            </thead>
            <tbody>
                ${connectedEdges.map(edge => {
        const targetId = edge.from === nodeId ? edge.to : edge.from;
        const targetNode = network.body.data.nodes.get(targetId);
        return `
                        <tr>
                            <td>${targetNode ? targetNode.label : targetId}</td>
                            <td>${edge.tipomensaje}</td>
                            <td>${edge.value}</td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
    modalContainer.appendChild(infoTable);
}


function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadNetworkData, 30000); 
}


function applyIpFilter() {
    const ipInput = document.getElementById('ipOriginFilterInput');
    if (!ipInput) return;

    const ip = ipInput.value.trim();
    if (ip !== currentIpFilter) {
        console.log('[IP Network] Aplicando filtro IP:', ip);
        currentIpFilter = ip;
        if (isInitialized) loadNetworkData();
    }
}


function setupEventListeners() {

    const filterBtn = document.getElementById('filterIpOriginButton');
    const filterInput = document.getElementById('ipOriginFilterInput');

    if (filterBtn && filterInput) {
        filterBtn.addEventListener('click', applyIpFilter);
        filterInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') applyIpFilter();
        });
    }

 
    const closeBtn = document.getElementsByClassName('close-modal')[0];
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('chartModal');
            if (modal) modal.style.display = 'none';
        });
    }

  
    document.addEventListener('timeFilterUpdated', e => {
        if (e.detail) {
            currentTimeFilter = {
                segundo_inicio: e.detail.segundo_inicio,
                segundo_fin: e.detail.segundo_fin
            };
            if (isInitialized) loadNetworkData();
        }
    });

    document.addEventListener('captureStarted', () => {
        if (!isInitialized) {
            initializeIpNetworkChart().catch(error => {
                console.error('[IP Network] Error al inicializar con captura:', error);
            });
        }
    });

    document.addEventListener('captureStopped', () => {
        if (refreshTimer) clearTimeout(refreshTimer);
    });

    document.addEventListener('forceChartUpdate', () => {
        if (isInitialized) loadNetworkData();
    });
}


document.addEventListener('DOMContentLoaded', () => {

    const style = document.createElement('style');
    style.textContent = `
        #ipNetworkChart {
            position: relative;
            min-height: 500px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #fafafa;
        }
        .network-tooltip {
            position: absolute;
            background: white;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            pointer-events: none;
            z-index: 100;
            max-width: 300px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            font-size: 12px;
            display: none;
        }
        #network-legend {
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.9);
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #ddd;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
            z-index: 10;
        }
        .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 4px;
        }
        .legend-color {
            display: inline-block;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            margin-right: 6px;
        }
        .legend-line {
            display: inline-block;
            width: 20px;
            height: 3px;
            margin-right: 6px;
        }
        #ipNetworkChart.loading::before {
            content: "Cargando...";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255,255,255,0.8);
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 10;
        }
        .no-data-message {
            padding: 20px;
            text-align: center;
            color: #555;
            background: #f5f5f5;
            border-radius: 4px;
            border: 1px dashed #ddd;
        }
        .info-table {
            margin-top: 20px;
            width: 100%;
            overflow-x: auto;
        }
        .info-table table {
            width: 100%;
            border-collapse: collapse;
        }
        .info-table th, .info-table td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
    `;
    document.head.appendChild(style);

 
    setupEventListeners();


    if (document.getElementById('ipNetworkChart')) {
        initializeIpNetworkChart().catch(error => {
            console.error('[IP Network] Error en inicialización inicial:', error);
        });
    }
});



window.ipNetworkChart = {
    initialize: initializeIpNetworkChart,
    update: loadNetworkData,
    applyFilter: (ipFilter, timeFilter) => {
        currentIpFilter = ipFilter || '';
        currentTimeFilter = timeFilter || null;
        if (isInitialized) loadNetworkData();
    },
    forceRefresh: () => {
        if (isInitialized) {
            if (refreshTimer) clearTimeout(refreshTimer);
            loadNetworkData();
        }
    }
};