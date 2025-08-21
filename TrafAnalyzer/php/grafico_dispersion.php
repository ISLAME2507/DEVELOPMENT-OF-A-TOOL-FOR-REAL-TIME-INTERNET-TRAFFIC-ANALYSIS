<?php
header('Content-Type: application/json');

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$servidor = "localhost:3306";
$usuario = "root";
$contraseña = "root";
$basededatos = "db_paquetes";

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
    
    $conn = new mysqli($servidor, $usuario, $contraseña, $basededatos);
    if ($conn->connect_error) {
        handleError("Conexión fallida: " . $conn->connect_error);
    }

    
    $ipOrigen = isset($_GET['iporigen']) ? $_GET['iporigen'] : '';
    $segundoInicio = isset($_GET['segundo_inicio']) ? floatval($_GET['segundo_inicio']) : null;
    $segundoFin = isset($_GET['segundo_fin']) ? floatval($_GET['segundo_fin']) : null;

    
    $condicionUsuario = "";
    if ($user_id != 1) {
        $condicionUsuario = "AND usuario_id = ?";
    } else {
        $condicionUsuario = "AND usuario_id IN (2, 3)";
    }

   
    $condicionTiempo = "";
    
    
    $params = [];
    
   
    $params[] = $ipOrigen;
    $params[] = $ipOrigen;
    
    
    if ($user_id != 1) {
        $params[] = $user_id;
    }
    
  
    if ($segundoInicio !== null && $segundoFin !== null) {
        $condicionTiempo = "AND (tiempo BETWEEN ? AND ?)";
        $params[] = $segundoInicio;
        $params[] = $segundoFin;
    }
    
    
    $allParams = array_merge($params, $params);

   
    $sql = "
        SELECT iporigen AS source, queryname AS target, COUNT(*) AS value, 'consulta' AS tipomensaje 
        FROM datos_paquetes 
        WHERE protocolo = 'DNS' 
        AND (? = '' OR iporigen = ?)
        $condicionUsuario
        $condicionTiempo
        AND queryname IS NOT NULL 
        AND queryname != '' 
        GROUP BY iporigen, queryname
        UNION ALL
        SELECT iporigen AS source, respname AS target, COUNT(*) AS value, 'respuesta' AS tipomensaje 
        FROM datos_paquetes 
        WHERE protocolo = 'DNS'
        AND (? = '' OR iporigen = ?) 
        $condicionUsuario
        $condicionTiempo
        AND respname IS NOT NULL 
        AND respname != '' 
        GROUP BY iporigen, respname
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        handleError("Error al preparar consulta: " . $conn->error);
    }

    
    $types = '';
    foreach ($allParams as $param) {
        if (is_int($param)) {
            $types .= 'i'; 
        } elseif (is_float($param)) {
            $types .= 'd'; 
        } else {
            $types .= 's'; 
        }
    }
    
    
    if (!empty($allParams)) {
        $stmt->bind_param($types, ...$allParams);
    }

    if (!$stmt->execute()) {
        handleError("Error al ejecutar consulta: " . $stmt->error);
    }

    $result = $stmt->get_result();
    if (!$result) {
        handleError("Error al obtener resultados: " . $stmt->error);
    }

    $connections = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $connections[] = [
                'source' => $row['source'],
                'target' => $row['target'],
                'value' => intval($row['value']),
                'tipomensaje' => $row['tipomensaje']
            ];
        }
    }

    $stmt->close();
    $conn->close();
    
    
    echo json_encode($connections);
    
} catch (Exception $e) {
    handleError("Excepción no controlada: " . $e->getMessage());
}
?>