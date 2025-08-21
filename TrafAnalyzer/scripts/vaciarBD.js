function clearDatabase() {
    const userId = document.getElementById('current_user_id').value;
    if (!userId) {
        console.error("No se ha encontrado el ID de usuario");
        alert('Error: sesi�n no v�lida. Por favor, vuelva a iniciar sesi�n.');
        return;
    }

    if (confirm('�Estas seguro de que deseas vaciar los datos segun tu usuario?')) {
        fetch('php/vaciar_base_datos.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `user_id=${userId}`
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    console.log("Datos limpiados correctamente. Actualizando gr�ficos...");
                    updateAllCharts(); 
                } else {
                    console.error("Error al vaciar la base de datos:", data.message);
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error en la solicitud:', error);
                alert('Error inesperado. Por favor, int�ntalo de nuevo.');
            });
    }
}