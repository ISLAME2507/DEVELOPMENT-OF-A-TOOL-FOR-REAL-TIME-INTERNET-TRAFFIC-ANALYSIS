<?php
header('Content-Type: application/json');


$db_host = 'localhost';
$db_user = 'root';
$db_password = 'root';
$db_name = 'db_paquetes';

try {

    session_start();
    

    if (!isset($_SESSION['user_id'])) {
        throw new Exception("Acceso no autorizado: sesión no iniciada", 401);
    }
    
    $user_id = (int)$_SESSION['user_id'];

  
    $conn = new mysqli($db_host, $db_user, $db_password, $db_name);
    
    if ($conn->connect_error) {
        throw new Exception("Error de conexión: " . $conn->connect_error);
    }


    if (!$conn->query("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))")) {
        throw new Exception("Error al configurar SQL mode: " . $conn->error);
    }

   
    $tipo_respuesta = $_GET['tipo_respuesta'] ?? 'respuestas_exitosas';
    $cantidad = intval($_GET['cantidad_respuesta'] ?? 10);
    $segundo_inicio = isset($_GET['segundo_inicio']) ? floatval($_GET['segundo_inicio']) : null;
    $segundo_fin = isset($_GET['segundo_fin']) ? floatval($_GET['segundo_fin']) : null;

    if ($cantidad < 1 || $cantidad > 100) {
        throw new Exception("Cantidad inválida. Debe ser entre 1 y 100");
    }

 
    $sql = "SELECT respname, COUNT(*) as total FROM datos_paquetes WHERE respname != ''";
    
   
    if ($user_id != 1) {
        $sql .= " AND usuario_id = ?";
    } else {
       
        $sql .= " AND usuario_id IN (2, 3)";
    }
    

    $params = [];
    $types = '';
    
   
    if ($user_id != 1) {
        $params[] = $user_id;
        $types .= 'i';
    }

 
    if ($segundo_inicio !== null && $segundo_fin !== null) {
        $sql .= " AND tiempo BETWEEN ? AND ?";
        $params[] = $segundo_inicio;
        $params[] = $segundo_fin;
        $types .= 'dd';
    }


    $sql .= " GROUP BY respname ORDER BY total " . 
           ($tipo_respuesta === 'respuestas_exitosas' ? 'DESC' : 'ASC') . 
           " LIMIT ?";
    
    $params[] = $cantidad;
    $types .= 'i';

   
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Error en preparación: " . $conn->error);
    }


    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    if (!$stmt->execute()) {
        throw new Exception("Error en ejecución: " . $stmt->error);
    }

    $result = $stmt->get_result();
    $data = [];
    while ($row = $result->fetch_assoc()) {
    
    $data[] = $row;
}


  
    echo json_encode([
        'success' => true,
        'data' => $data,
        'meta' => [
            'user_id' => $user_id, 
            'filtro_tiempo' => ($segundo_inicio !== null && $segundo_fin !== null) ? [
                'inicio' => $segundo_inicio,
                'fin' => $segundo_fin
            ] : null
        ]
    ]);

} catch (Exception $e) {
  
    $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
    http_response_code($code);
    
 
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'code' => $code
    ]);
} finally {
    if (isset($conn)) $conn->close();
}