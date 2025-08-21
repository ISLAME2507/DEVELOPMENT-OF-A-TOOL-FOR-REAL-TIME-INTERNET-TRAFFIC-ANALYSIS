<?php

header('Content-Type: application/json');
require 'conexion.php';

try {
    
    session_start();
    
  
    if (!isset($_SESSION['user_id'])) {
        throw new Exception("No hay sesión de usuario activa", 401);
    }
    
    $user_id = (int)$_SESSION['user_id'];
    
    
    $sql = "SELECT 
                MIN(tiempo) as min_segundos,
                MAX(tiempo) as max_segundos,
                (MAX(tiempo) - MIN(tiempo)) as duracion_segundos,
                (MAX(tiempo) - MIN(tiempo))/60 as total_minutos
            FROM datos_paquetes
            WHERE protocolo IS NOT NULL";
    
    $params = [];
    

    if ($user_id != 1) {
        $sql .= " AND usuario_id = ?";
        $params[] = $user_id;
    } else {
      
        $sql .= " AND usuario_id IN (2, 3)";
    }
    
  
    $captura_id = $_GET['captura_id'] ?? null;
    if ($captura_id !== null) {
        $sql .= " AND captura_id = ?";
        $params[] = (int)$captura_id;
    }
    
   
    $stmt = $conexion->prepare($sql);
    
 
    if (!empty($params)) {
        $types = '';
        foreach ($params as $param) {
            $types .= 'i'; 
        }
        $stmt->bind_param($types, ...$params);
    }
    
    if (!$stmt->execute()) {
        throw new Exception("Error al ejecutar consulta: " . $stmt->error);
    }
    
    $result = $stmt->get_result();
    
    if (!$result) {
        throw new Exception("Error en consulta: " . $conexion->error);
    }
    
    $rango = $result->fetch_assoc();
    
    echo json_encode([
        'success' => true,
        'rango_total' => [
            'min_segundos' => (float)$rango['min_segundos'],
            'max_segundos' => (float)$rango['max_segundos'],
            'duracion_segundos' => (float)$rango['duracion_segundos'],
            'total_minutos' => (float)$rango['total_minutos']
        ],
        'metadata' => [
            'user_id' => $user_id,
            'captura_id' => $captura_id,
            'fecha_consulta' => date('Y-m-d H:i:s')
        ]
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