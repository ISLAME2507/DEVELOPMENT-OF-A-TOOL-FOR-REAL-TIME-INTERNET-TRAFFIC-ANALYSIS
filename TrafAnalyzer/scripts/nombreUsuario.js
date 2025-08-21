document.addEventListener("DOMContentLoaded", function () {
    fetch('php/usuario_nombre.php')
        .then(response => response.text())
        .then(nombre => {
            const spanNombre = document.getElementById('nombreUsuario');
            if (spanNombre) {
                spanNombre.textContent = nombre;
            }
        })
        .catch(error => {
            console.error("Error al obtener el nombre del usuario:", error);
        });
});
