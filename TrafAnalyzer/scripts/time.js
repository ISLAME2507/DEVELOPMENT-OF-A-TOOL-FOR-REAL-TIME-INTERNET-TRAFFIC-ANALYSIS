// Función para cargar los tiempos de captura
function cargarTiemposCaptura() {
    fetch('php/tiempo_captura.php')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al obtener los tiempos de captura');
            }
            return response.json();
        })
        .then(data => {
           
            document.getElementById('inicioCaptura').textContent = data.inicioCaptura;
            document.getElementById('finCaptura').textContent = data.finCaptura;
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('inicioCaptura').textContent = 'Error';
            document.getElementById('finCaptura').textContent = 'Error';
        });
}


document.addEventListener('DOMContentLoaded', cargarTiemposCaptura);