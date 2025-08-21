<?php
session_start();

// Verificar autenticación
if (!isset($_SESSION['active'])) {
    http_response_code(401);
    die("Acceso no autorizado");
}

// Configuración de la base de datos
$servidor = "localhost:3306";
$usuario = "root";
$contraseña = "root";
$basededatos = "db_paquetes";

// Establecer conexión
$conexion = mysqli_connect($servidor, $usuario, $contraseña, $basededatos);

if (!$conexion) {
    error_log("Error de conexión: " . mysqli_connect_error());
    die("Error al conectar con la base de datos");
}

// Procesar datos de tshark
$data = file_get_contents('php://input');
$lines = explode("\n", trim($data));

// Saltar encabezado si existe
if (count($lines) > 0 && strpos($lines[0], 'frame.number') !== false) {
    array_shift($lines);
}

foreach ($lines as $line) {
    $packet = str_getcsv($line);
    
    if (count($packet) < 4) continue; // Validación básica
    
    // Sanitizar y validar datos
    $frame_number = mysqli_real_escape_string($conexion, $packet[0]);
    $ip_src = mysqli_real_escape_string($conexion, $packet[1]);
    $ip_dst = mysqli_real_escape_string($conexion, $packet[2]);
    $frame_time = mysqli_real_escape_string($conexion, $packet[3]);
    
    // Insertar en base de datos
    $query = "INSERT INTO paquetes (frame_number, ip_origen, ip_destino, tiempo)
              VALUES ('$frame_number', '$ip_src', '$ip_dst', '$frame_time')";
    
    if (!mysqli_query($conexion, $query)) {
        error_log("Error al insertar paquete: " . mysqli_error($conexion));
    }
}

// Cerrar conexión
mysqli_close($conexion);

// Respuesta exitosa
http_response_code(200);
echo "Datos procesados correctamente";
?>