<?php
header('Content-Type: application/json');
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);


$servidor = "localhost:3306";
$usuario = "root";
$contraseña = "root";
$basededatos = "db_paquetes";
$emailDestino = "alkahfiislame1@gmail.com";
$ALERT_THRESHOLD = 1000;


$userNames = [
    2 => "Usuario 1",
    3 => "Usuario 2"
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

function getUserName($user_id, $userNames) {
    return isset($userNames[$user_id]) ? $userNames[$user_id] : "Usuario ID: $user_id";
}

session_start();

if (!isset($_SESSION['user_id'])) {
    handleError("No active user session", 401);
}

$user_id = (int)$_SESSION['user_id'];

$filtroActivo = false;
$startSegundo = null;
$endSegundo = null;

if (isset($_GET['segundo_inicio']) && isset($_GET['segundo_fin'])) {
    $startSegundo = floatval($_GET['segundo_inicio']);
    $endSegundo = floatval($_GET['segundo_fin']);
    $filtroActivo = true;
}

try {
    
    $alertFile = 'email_alert.php'; 
    $alertSystem = null;
    
    if (file_exists($alertFile)) {
        require $alertFile;
        
        if (class_exists('SessionIndependentAlertSystem')) {
            // Pasar el mapeo de nombres de usuario al sistema de alertas
            $alertSystem = new SessionIndependentAlertSystem($emailDestino, $ALERT_THRESHOLD, $user_id, $userNames);
        }
    }
    
    $conexion = new PDO("mysql:host=$servidor;dbname=$basededatos", $usuario, $contraseña);
    $conexion->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
 
    $userFilter = "";
    $userParams = [];
    
    if ($user_id == 1) {
        $userFilter = " WHERE usuario_id IN (2, 3)";
    } else {
        $userFilter = " WHERE usuario_id = :user_id";
        $userParams[':user_id'] = $user_id;
    }
    
    
    $sql = "SELECT COUNT(*) as total FROM datos_paquetes" . $userFilter;
    $stmt = $conexion->prepare($sql);
    
    foreach ($userParams as $param => $value) {
        $stmt->bindValue($param, $value);
    }
    
    $stmt->execute();
    $totalPackets = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
   
    $sqlBase = "SELECT tiempo, arrivaltime FROM datos_paquetes" . $userFilter;
    
    $whereOrAnd = $userFilter ? " AND" : " WHERE";
    $timeFilter = "";
    $params = $userParams;
    
    if ($filtroActivo) {
        $timeFilter = $whereOrAnd . " tiempo >= :startTime AND tiempo <= :endTime";
        $params[':startTime'] = $startSegundo;
        $params[':endTime'] = $endSegundo;
    }
    
    $sqlWithFilter = $sqlBase . $timeFilter . " ORDER BY tiempo ASC";
    $stmt = $conexion->prepare($sqlWithFilter);
    
    foreach ($params as $param => $value) {
        $stmt->bindValue($param, $value);
    }
    
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $formattedData = [];
    $sampleInterval = max(1, floor(count($results) / 1000));
    foreach ($results as $index => $row) {
        if ($index % $sampleInterval === 0) {
            $formattedData[] = [
                'time' => number_format($row['tiempo'], 6, '.', ''),
                'count' => $index + 1,
                'arrivaltime' => $row['arrivaltime']
            ];
        }
    }
    
    
    $alertSent = false;
    $alertResult = ['sent' => false];
    $alertMarkers = [];
    
    if (!$filtroActivo && $totalPackets >= $ALERT_THRESHOLD && $alertSystem) {
       
        $currentUserName = getUserName($user_id, $userNames);
        $currentTime = date("Y-m-d H:i:s");
        
        $alertResult = $alertSystem->checkAndSendAlert($totalPackets, $currentTime, $currentUserName);
        $alertSent = $alertResult['sent'];
    }
    
   
    if ($totalPackets >= $ALERT_THRESHOLD) {
        $sqlAlertPacket = "SELECT tiempo, arrivaltime FROM datos_paquetes" . $userFilter . 
                          " ORDER BY tiempo ASC LIMIT 1 OFFSET " . ($ALERT_THRESHOLD - 1);
        $stmtAlertPacket = $conexion->prepare($sqlAlertPacket);
        
        foreach ($userParams as $param => $value) {
            $stmtAlertPacket->bindValue($param, $value);
        }
        
        $stmtAlertPacket->execute();
        $alertPacket = $stmtAlertPacket->fetch(PDO::FETCH_ASSOC);
        
        if ($alertPacket) {
            $includeAlert = true;
            
            if ($filtroActivo) {
                $alertTime = floatval($alertPacket['tiempo']);
                $includeAlert = ($alertTime >= $startSegundo && $alertTime <= $endSegundo);
            }
            
            if ($includeAlert) {
                $alertMarkers[] = [
                    'time' => number_format($alertPacket['tiempo'], 6, '.', ''),
                    'count' => $ALERT_THRESHOLD,
                    'email' => $emailDestino,
                    'arrivaltime' => $alertPacket['arrivaltime'],
                    'username' => getUserName($user_id, $userNames)
                ];
            }
        }
    }
    
    
    $sqlMinMax = "SELECT MIN(tiempo) as min_tiempo, MAX(tiempo) as max_tiempo FROM datos_paquetes" . $userFilter;
    $stmtMinMax = $conexion->prepare($sqlMinMax);
    
    foreach ($userParams as $param => $value) {
        $stmtMinMax->bindValue($param, $value);
    }
    
    $stmtMinMax->execute();
    $rangeData = $stmtMinMax->fetch(PDO::FETCH_ASSOC);
    
    
    $alertStatus = $alertSystem ? $alertSystem->getAlertStatus() : null;
    
    
    if (class_exists('SessionIndependentAlertSystem') && mt_rand(1, 100) === 1) {
        $cleaned = SessionIndependentAlertSystem::cleanupOldStateFiles();
        if ($cleaned > 0) {
            error_log("Cleaned up $cleaned old alert state files");
        }
    }
    
    echo json_encode([
        'trafficData' => $formattedData,
        'alertMarkers' => $alertMarkers,
        'totalPackets' => $totalPackets,
        'alertSent' => $alertSent,
        'alertInfo' => $alertResult,
        'alertStatus' => $alertStatus,
        'timeRange' => [
            'min' => $rangeData['min_tiempo'] ? number_format($rangeData['min_tiempo'], 6, '.', '') : '0.000000',
            'max' => $rangeData['max_tiempo'] ? number_format($rangeData['max_tiempo'], 6, '.', '') : '0.000000'
        ],
        'filtered' => $filtroActivo,
        'user_id' => $user_id,
        'username' => getUserName($user_id, $userNames)
    ]);
    
} catch(Exception $e) {
    handleError('Error: ' . $e->getMessage());
}
?>