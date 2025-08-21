<?php
session_start();

// Comprobar si el usuario est� autenticado
if (isset($_SESSION['active']) && $_SESSION['active'] === true) {
    // Usuario autenticado, devolver informaci�n necesaria
    echo json_encode([
        'authenticated' => true,
        'user_id' => $_SESSION['user_id'],
        'username' => $_SESSION['user'],
        'is_admin' => isset($_SESSION['is_admin']) ? $_SESSION['is_admin'] : false
    ]);
} else {
    // Usuario no autenticado
    echo json_encode([
        'authenticated' => false,
        'message' => 'No ha iniciado sesi�n'
    ]);
}
?>