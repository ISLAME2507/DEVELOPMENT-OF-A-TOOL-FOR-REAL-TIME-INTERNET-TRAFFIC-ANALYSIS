<?php

header('Content-Type: application/json');
require 'conexion.php';

try {
  
    session_start();
    
   
    if (!isset($_SESSION['user_id'])) {
        throw new Exception("No hay sesión de usuario activa", 401);
    }
    
    $user_id = (int)$_SESSION['user_id'];
    
  
    $sql = "SELECT DISTINCT tiempo FROM datos_paquetes WHERE 1=1";
    $params = [];
    
   
    if ($user_id != 1) {
        $sql .= " AND usuario_id = ?";
        $params[] = $user_id;
    } else {
        
        $sql .= " AND usuario_id IN (2, 3)";
    }
    

    $sql .= " ORDER BY tiempo ASC";
    
    
    $stmt = $conexion->prepare($sql);
    
    
    if (!empty($params)) {
        $types = str_repeat('i', count($params)); 
        $stmt->bind_param($types, ...$params);
    }
    
    if (!$stmt->execute()) {
        throw new Exception("Error al ejecutar consulta: " . $stmt->error);
    }
    
    $result = $stmt->get_result();
    
    if (!$result) {
        throw new Exception("Error en consulta: " . $conexion->error);
    }
    
    $tiempos = [];
    while($row = $result->fetch_assoc()) {
        $tiempos[] = (float)$row['tiempo'];
    }
    
    if (empty($tiempos)) {
        throw new Exception("No se encontraron registros de tiempo para este usuario");
    }
    
    echo json_encode([
        'success' => true,
        'tiempos' => $tiempos,
        'min' => min($tiempos),
        'max' => max($tiempos),
        'count' => count($tiempos),
        'user_id' => $user_id
    ]);
    
    $stmt->close();
    
} catch (Exception $e) {
    http_response_code($e->getCode() ?: 500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>