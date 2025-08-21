<?php
header('Content-Type: application/json');

// Configuración de la base de datos
$config = [
    'host' => 'localhost:3306',
    'user' => 'root',
    'password' => 'root',
    'database' => 'db_paquetes'
];


function handleError($message, $code = 500) {
    http_response_code($code);
    echo json_encode([
        'error' => true,
        'message' => $message,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

try {
    
    session_start();
    
  
    if (!isset($_SESSION['user_id'])) {
        handleError("No hay sesión de usuario activa", 401);
    }
    
    $user_id = (int)$_SESSION['user_id'];
    
    
    $conexion = new mysqli($config['host'], $config['user'], $config['password'], $config['database']);
    
    if ($conexion->connect_errno) {
        handleError("Error de conexión MySQL: " . $conexion->connect_error);
    }
    
    
    $sql = "SELECT MIN(arrivaltime) AS inicio_captura, MAX(arrivaltime) AS fin_captura FROM datos_paquetes WHERE 1=1";
    
    
    if ($user_id != 1) {
        $sql .= " AND usuario_id = ?";
        $params = [$user_id];
    } else {

        $sql .= " AND usuario_id IN (2, 3)";
        $params = [];
    }
    

    $stmt = $conexion->prepare($sql);
    if (!$stmt) {
        handleError("Error al preparar consulta: " . $conexion->error);
    }
    

    if (!empty($params)) {
        $stmt->bind_param('i', $params[0]);
    }
    

    if (!$stmt->execute()) {
        handleError("Error al ejecutar consulta: " . $stmt->error);
    }
    
 
    $resultado = $stmt->get_result();
    if (!$resultado) {
        handleError("Error al obtener resultados: " . $stmt->error);
    }
    
    if ($resultado->num_rows > 0) {
        $row = $resultado->fetch_assoc();
        
        
        echo json_encode([
            'inicioCaptura' => $row['inicio_captura'] ?? 'No disponible',
            'finCaptura' => $row['fin_captura'] ?? 'No disponible'
        ]);
    } else {
        echo json_encode([
            'inicioCaptura' => 'No disponible',
            'finCaptura' => 'No disponible'
        ]);
    }
    
 
    $stmt->close();
    $conexion->close();
    
} catch (Exception $e) {
    handleError("Excepción no controlada: " . $e->getMessage());
}
?>