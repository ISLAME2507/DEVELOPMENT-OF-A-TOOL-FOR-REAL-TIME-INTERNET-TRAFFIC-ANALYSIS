// Función para mostrar/ocultar el panel de control
function toggleControlPanel() {
    const controlPanel = document.getElementById('controlPanel');
    controlPanel.classList.toggle('active');
}

// Función para mostrar/ocultar la lista de IPs
function toggleIpList() {
    const ipList = document.getElementById('ipList');
    const toggleIcon = document.getElementById('toggleIcon');

 
    ipList.classList.toggle('show');


    toggleIcon.classList.toggle('rotate');
}

// Función para cargar las IPs de origen desde el servidor
function loadOriginIps() {
    fetch('php/get_origen_ips.php') 
        .then(response => response.json())
        .then(data => {
            const ipList = document.getElementById('ipList');
            ipList.innerHTML = ''; 
            if (data.length > 0) {
                data.forEach(ip => {
                    const li = document.createElement('li');
                    li.innerHTML = `<i class="fas fa-desktop"></i> ${ip}`;
                    ipList.appendChild(li);
                });
            } else {
                const li = document.createElement('li');
                li.textContent = 'No se encontraron IPs de origen.';
                ipList.appendChild(li);
            }
        })
        .catch(error => {
            console.error('Error al cargar las IPs de origen:', error);
            const ipList = document.getElementById('ipList');
            ipList.innerHTML = '<li>Error al cargar las IPs de origen.</li>';
        });
}

// Cargar las IPs de origen cuando la página se cargue
document.addEventListener('DOMContentLoaded', function () {
    loadOriginIps();

    // Inicializar el panel cerrado
    const ipList = document.getElementById('ipList');
    ipList.classList.remove('show');
});

// Desplazamiento suave al hacer clic en un ítem del panel
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.control-panel ul li').forEach(item => {
        item.addEventListener('click', () => {
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });
});