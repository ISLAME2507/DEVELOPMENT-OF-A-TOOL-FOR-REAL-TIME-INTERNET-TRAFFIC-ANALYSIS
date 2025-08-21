<?php
session_start();
require_once "../conexion.php";
header('Content-Type: application/json');

// Verificar si el usuario es administrador
if (empty($_SESSION['user_id']) || empty($_SESSION['is_admin']) || !$_SESSION['is_admin']) {
    http_response_code(403);
    die(json_encode(['error' => 'Acceso no autorizado']));
}

// Consultar lista de usuarios (solo devuelve usuarios 2 y 3 para el admin)
$query = mysqli_query($conexion, "SELECT id, correo, nombre FROM usuario WHERE id IN (2, 3)");

$users = [];
while ($row = mysqli_fetch_assoc($query)) {
    $users[] = $row;
}

echo json_encode($users);
mysqli_close($conexion);
?>