<?php
session_start();

// Verificar si el usuario está autenticado
if (!isset($_SESSION['active']) || $_SESSION['active'] !== true) {
    echo json_encode(['status' => 'error', 'message' => 'No autorizado']);
    exit();
}

// Obtener el ID del usuario de la consulta y de la sesión
$query_user_id = isset($_GET['user_id']) ? $_GET['user_id'] : '';
$session_user_id = $_SESSION['user_id'];

// Validar que el ID de usuario sea correcto
if (empty($query_user_id) || $query_user_id != $session_user_id) {
    echo json_encode(['status' => 'error', 'message' => 'ID de usuario no válido']);
    exit();
}

// Comprobar si hay una captura en curso para este usuario
$status_file = dirname(__DIR__) . "/temp/capture_status_{$session_user_id}.txt";
if (file_exists($status_file)) {
    echo json_encode(['status' => 'active']);
} else {
    echo json_encode(['status' => 'inactive']);
}
?>