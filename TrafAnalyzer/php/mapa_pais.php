<?php
header('Content-Type: application/json');

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);


session_start();


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
        'details' => $message,
        'php_version' => PHP_VERSION,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}


$logFile = __DIR__ . '/map_debug.log';
$timestamp = date('Y-m-d H:i:s');
$logContent = "[$timestamp] Petición recibida en mapa_pais.php\n";
$logContent .= "[$timestamp] SESSION: " . json_encode($_SESSION) . "\n";
$logContent .= "[$timestamp] GET: " . json_encode($_GET) . "\n";
file_put_contents($logFile, $logContent, FILE_APPEND);


if (!isset($_SESSION['user_id'])) {
    
    $_SESSION['user_id'] = 1; 
    
    
}

$user_id = $_SESSION['user_id'];

try {
   
    $conexion = new mysqli($config['host'], $config['user'], $config['password'], $config['database']);
    
    if ($conexion->connect_errno) {
        handleError("Error de conexión MySQL: " . $conexion->connect_error);
    }
    
    
    if (!$conexion->query("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))")) {
        handleError("Error al configurar SQL mode: " . $conexion->error);
    }
    
   
    $ipOrigen = isset($_GET['iporigen']) ? $_GET['iporigen'] : '';
    
    
    $sql = "SELECT geoippais, COUNT(numero) AS cantidad_paquetes 
            FROM datos_paquetes 
            WHERE geoippais IS NOT NULL AND geoippais <> ''";
    
    
    if ($user_id == 1) {
       
        $sql .= " AND (usuario_id = 2 OR usuario_id = 3)";
    } else if ($user_id == 2 || $user_id == 3) {
       
        $sql .= " AND usuario_id = ?";
    } else {
       
        handleError("Acceso denegado: No tienes permisos para ver estos datos", 403);
    }
    
    
    $params = [];
    
    
    if ($user_id == 2 || $user_id == 3) {
        $params[] = $user_id;
    }
    
    if (!empty($ipOrigen)) {
        $sql .= " AND iporigen = ?";
        $params[] = $ipOrigen;
    }
    
  
    if (isset($_GET['segundo_inicio']) && isset($_GET['segundo_fin'])) {
        $sql .= " AND tiempo BETWEEN ? AND ?";
        $params[] = floatval($_GET['segundo_inicio']);
        $params[] = floatval($_GET['segundo_fin']);
    }
    
    
    $sql .= " GROUP BY geoippais";
    
   
    $logContent = "[$timestamp] User ID: $user_id\n";
    $logContent .= "[$timestamp] SQL: $sql\n";
    $logContent .= "[$timestamp] Params: " . json_encode($params) . "\n";
    file_put_contents($logFile, $logContent, FILE_APPEND);
    
    
    $stmt = $conexion->prepare($sql);
    if (!$stmt) {
        handleError("Error al preparar consulta: " . $conexion->error);
    }
    
   
    if (!empty($params)) {
        
        $types = str_repeat('s', count($params)); 
        
       
        if (isset($_GET['segundo_inicio'])) {
           
            $floatParamCount = 2; 
           
            $types = substr($types, 0, strlen($types) - $floatParamCount) . str_repeat('d', $floatParamCount);
        }
        
        $bindParams = array_merge([$types], $params);
        $stmt->bind_param(...$bindParams);
    }
    
    
    if (!$stmt->execute()) {
        handleError("Error al ejecutar consulta: " . $stmt->error);
    }
    
  
    $resultado = $stmt->get_result();
    if (!$resultado) {
        handleError("Error al obtener resultados: " . $stmt->error);
    }
    
    
    $distribucionPaises = [];
    while ($fila = $resultado->fetch_assoc()) {
        $pais = !empty($fila["geoippais"]) ? $fila["geoippais"] : "Desconocido";
        $distribucionPaises[$pais] = (int)$fila["cantidad_paquetes"];
    }
    
    
    $stmt->close();
    $conexion->close();
    
    echo json_encode($distribucionPaises);
    
} catch (Exception $e) {
    handleError("Excepción no controlada: " . $e->getMessage());
}
?>