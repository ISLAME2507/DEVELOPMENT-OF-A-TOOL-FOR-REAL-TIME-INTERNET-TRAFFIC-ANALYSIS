<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);


function handleError($message, $code = 500) {
    http_response_code($code);
    echo json_encode([
        'error' => true,
        'message' => $message,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}


$db_host = 'localhost:3306';
$db_user = 'root';
$db_password = 'root';
$db_name = 'db_paquetes';

try {
  
    session_start();
    
  
    if (!isset($_SESSION['user_id'])) {
        handleError("No hay sesión de usuario activa", 401);
    }
    
    $user_id = (int)$_SESSION['user_id'];
    
    
    $conn = new mysqli($db_host, $db_user, $db_password, $db_name);
    
   
    if ($conn->connect_error) {
        handleError("Error de conexión: " . $conn->connect_error);
    }
    
    
    if (!$conn->query("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))")) {
        handleError("Error al configurar SQL mode: " . $conn->error);
    }

   
    $request_data = $_SERVER['REQUEST_METHOD'] === 'POST' ? $_POST : $_GET;
    $tipo_consulta = $request_data['tipo_consulta'] ?? 'mas_visitados';
    $cantidad = isset($request_data['cantidad']) ? intval($request_data['cantidad']) : 10;
    $segundo_inicio = isset($request_data['segundo_inicio']) ? floatval($request_data['segundo_inicio']) : null;
    $segundo_fin = isset($request_data['segundo_fin']) ? floatval($request_data['segundo_fin']) : null;


    $has_time_filter = $segundo_inicio !== null && $segundo_fin !== null;

   
    $sql = "SELECT queryname, COUNT(*) as total FROM datos_paquetes WHERE queryname != ''";
    
 
    if ($user_id != 1) {
        $sql .= " AND usuario_id = ?";
    } else {
        
        $sql .= " AND usuario_id IN (2, 3)";
    }

   
    if ($has_time_filter) {
        $sql .= " AND tiempo >= ? AND tiempo <= ?";
    }


    $sql .= " GROUP BY queryname ORDER BY total ";
    $sql .= ($tipo_consulta == 'mas_visitados') ? 'DESC' : 'ASC';
    $sql .= " LIMIT ?";

 
    $stmt = $conn->prepare($sql);
    
    if ($stmt === false) {
        handleError("Error en la preparación: " . $conn->error);
    }
    
  
    $params = [];
    $types = '';
    
    
    if ($user_id != 1) {
        $params[] = $user_id;
        $types .= 'i';
    }
    
   
    if ($has_time_filter) {
        $params[] = $segundo_inicio;
        $params[] = $segundo_fin;
        $types .= 'dd';
    }
    
  
    $params[] = $cantidad;
    $types .= 'i';
    
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
   
    $stmt->execute();
    $result = $stmt->get_result();
    
    
    $results = [];
    while ($row = $result->fetch_assoc()) {
      
        $results[] = $row;
    }
    
   
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'data' => $results,
        'meta' => [
            'user_id' => $user_id,
            'tipo_consulta' => $tipo_consulta,
            'filtro_tiempo' => $has_time_filter ? [
                'inicio' => $segundo_inicio,
                'fin' => $segundo_fin
            ] : null
        ]
    ]);
    
} catch (Exception $e) {
    handleError("Excepción no controlada: " . $e->getMessage());
}


if (isset($conn)) {
    $conn->close();
}
?>