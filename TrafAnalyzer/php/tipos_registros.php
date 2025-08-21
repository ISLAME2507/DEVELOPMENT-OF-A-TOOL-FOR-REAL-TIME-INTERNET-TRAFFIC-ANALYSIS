<?php
header('Content-Type: application/json');

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
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
        'php_version' => PHP_VERSION,
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

    if (!$conexion->query("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))")) {
        handleError("Error al configurar SQL mode: " . $conexion->error);
    }
    

    $sql = "SELECT tiporegistro AS tipo, COUNT(*) AS cantidad 
            FROM datos_paquetes 
            WHERE tiporegistro IS NOT NULL AND tiporegistro <> ''";
    
    
    if ($user_id != 1) {
        $sql .= " AND usuario_id = ?";
    } else {
     
        $sql .= " AND usuario_id IN (2, 3)";
    }
    
  
    $params = [];
    if ($user_id != 1) {
        $params[] = $user_id;
    }
    
    if (isset($_GET['segundo_inicio']) && isset($_GET['segundo_fin'])) {
        $sql .= " AND tiempo BETWEEN ? AND ?";
        $params[] = floatval($_GET['segundo_inicio']);
        $params[] = floatval($_GET['segundo_fin']);
    }
    
    
    $sql .= " GROUP BY tiporegistro";
    
  
    $stmt = $conexion->prepare($sql);

    if (!$stmt) {
        handleError("Error al preparar consulta: " . $conexion->error);
    }
    
 
    if (!empty($params)) {
 
        $types = '';
        foreach ($params as $param) {
            if (is_int($param)) {
                $types .= 'i'; 
            } elseif (is_float($param)) {
                $types .= 'd'; 
            } else {
                $types .= 's'; 
            }
        }
        
       
        $stmt->bind_param($types, ...$params);
    }
    
   
    if (!$stmt->execute()) {
        handleError("Error al ejecutar consulta: " . $stmt->error);
    }
    

    $resultado = $stmt->get_result();
    if (!$resultado) {
        handleError("Error al obtener resultados: " . $stmt->error);
    }
    
  
    $data = ['labels' => [], 'values' => []];
    while ($fila = $resultado->fetch_assoc()) {
        $data['labels'][] = $fila["tipo"];
        $data['values'][] = (int)$fila["cantidad"];
    }
    
  
    $stmt->close();
    $conexion->close();
    
   
    echo json_encode($data);
    
} catch (Exception $e) {
    handleError("Excepción no controlada: " . $e->getMessage());
}
?>