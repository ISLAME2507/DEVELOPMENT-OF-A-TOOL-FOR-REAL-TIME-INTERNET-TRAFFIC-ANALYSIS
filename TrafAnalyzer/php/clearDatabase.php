<?php
session_start();

// Verificar si el usuario está autenticado
if (!isset($_SESSION['active']) || $_SESSION['active'] !== true) {
    echo json_encode(['status' => 'error', 'message' => 'No autorizado']);
    exit();
}

// Obtener el ID del usuario del formulario y de la sesión
$form_user_id = isset($_POST['user_id']) ? $_POST['user_id'] : '';
$session_user_id = $_SESSION['user_id'];

// Validar que el ID de usuario sea correcto
if (empty($form_user_id) || $form_user_id != $session_user_id) {
    echo json_encode(['status' => 'error', 'message' => 'ID de usuario no válido']);
    exit();
}

// Incluir archivo de conexión a la base de datos
require_once "conexion.php";

// Borrar solo los datos relacionados con este usuario

$queries = [
    "DELETE FROM packet_data WHERE user_id = '$session_user_id'",
    "DELETE FROM dns_queries WHERE user_id = '$session_user_id'",
    "DELETE FROM dns_responses WHERE user_id = '$session_user_id'",
    "DELETE FROM capture_sessions WHERE user_id = '$session_user_id'"
   
];

$success = true;
$error_message = '';

foreach ($queries as $query) {
    if (!mysqli_query($conexion, $query)) {
        $success = false;
        $error_message = mysqli_error($conexion);
        break;
    }
}

mysqli_close($conexion);

if ($success) {
    echo json_encode(['status' => 'success', 'message' => 'Base de datos vaciada correctamente']);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Error al vaciar la base de datos: ' . $error_message]);
}
?>