<?php

error_reporting(E_ALL);
ini_set('display_errors', 0); 
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

header('Content-Type: application/json');

// Validar método HTTP
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Se requiere POST']);
    exit;
}

// Configuración de la base de datos
$db_host = 'localhost';
$db_user = 'root';
$db_password = 'root';
$db_name = 'db_paquetes';

try {
    // Iniciar sesión para verificar permisos
    session_start();
    
    // Verificar sesión de usuario
    if (!isset($_SESSION['user_id'])) {
        throw new Exception("Acceso no autorizado: sesión no iniciada", 401);
    }
    
    $user_id = (int)$_SESSION['user_id'];

    // Conexión a la base de datos
    $conn = new mysqli($db_host, $db_user, $db_password, $db_name);
    
    if ($conn->connect_error) {
        throw new Exception("Error de conexión a la base de datos: " . $conn->connect_error);
    }

    // Desactivar ONLY_FULL_GROUP_BY para compatibilidad
    if (!$conn->query("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))")) {
        throw new Exception("Error al configurar SQL mode: " . $conn->error);
    }

    // Obtener y validar parámetros
    $dominio1 = $conn->real_escape_string($_POST['dominio1'] ?? '');
    $dominio2 = $conn->real_escape_string($_POST['dominio2'] ?? '');
    $dominio3 = $conn->real_escape_string($_POST['dominio3'] ?? '');
    $tipoRegistro = $_POST['dnsRecordType'] ?? 'todo';
    $segundo_inicio = isset($_POST['segundo_inicio']) ? (float)$_POST['segundo_inicio'] : null;
    $segundo_fin = isset($_POST['segundo_fin']) ? (float)$_POST['segundo_fin'] : null;

    // Validaciones básicas
    if (empty($dominio1) || empty($dominio2) || empty($dominio3)) {
        throw new Exception("Debe proporcionar los tres dominios para comparar");
    }

    // Función para obtener datos con filtros (ahora incluye filtro de usuario)
    function getDnsData($conn, $query, $tipoRegistro, $segundo_inicio, $segundo_fin, $user_id) {
        $sql = "SELECT tiempo, tipomensaje, queryname, respname, tiporegistro, arrivaltime 
                FROM datos_paquetes 
                WHERE ((tipomensaje = 'consulta' AND queryname = ?) 
                   OR (tipomensaje = 'respuesta' AND respname = ?))";
        
        $params = [$query, $query];
        $types = "ss";
        
        // Aplicar filtro de usuario
        if ($user_id != 1) {
            $sql .= " AND usuario_id = ?";
            $params[] = $user_id;
            $types .= "i";
        } else {
            // Usuario admin (id=1) ve solo datos de usuarios 2 y 3
            $sql .= " AND usuario_id IN (2, 3)";
        }
        
        if ($tipoRegistro !== 'todo') {
            $sql .= " AND tiporegistro = ?";
            $params[] = $tipoRegistro;
            $types .= "s";
        }
        
        if ($segundo_inicio !== null && $segundo_fin !== null) {
            $sql .= " AND tiempo BETWEEN ? AND ?";
            $params[] = $segundo_inicio;
            $params[] = $segundo_fin;
            $types .= "dd";
        }
        
        $sql .= " ORDER BY tiempo ASC";
        
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Error en preparación de consulta: " . $conn->error);
        }
        
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $data = [];
        while ($row = $result->fetch_assoc()) {
            $data[] = $row;
        }
        $stmt->close();
        
        return $data;
    }

    // Obtener datos para cada dominio (pasando el user_id)
    $data1 = getDnsData($conn, $dominio1, $tipoRegistro, $segundo_inicio, $segundo_fin, $user_id);
    $data2 = getDnsData($conn, $dominio2, $tipoRegistro, $segundo_inicio, $segundo_fin, $user_id);
    $data3 = getDnsData($conn, $dominio3, $tipoRegistro, $segundo_inicio, $segundo_fin, $user_id);

    // Función para procesar datos 
    function processDnsData($dnsData) {
        $times = [];
        $requestCount = [];
        $responseCount = [];
        $arrivalTimes = [];
        
        $reqCount = 0;
        $respCount = 0;
        
        foreach ($dnsData as $record) {
            $time = (float)$record['tiempo'];
            $times[] = $time;
            $arrivalTimes[] = $record['arrivaltime'] ?? 'N/A';
            
            if ($record['tipomensaje'] === 'consulta') {
                $reqCount++;
            } else if ($record['tipomensaje'] === 'respuesta') {
                $respCount++;
            }
            
            $requestCount[] = $reqCount;
            $responseCount[] = $respCount;
        }
        
        return [
            'times' => $times,
            'requests' => $requestCount,
            'responses' => $responseCount,
            'arrivalTimes' => $arrivalTimes
        ];
    }

    // Procesar datos
    $processedData1 = processDnsData($data1);
    $processedData2 = processDnsData($data2);
    $processedData3 = processDnsData($data3);

    // Combinar todos los tiempos
    $allTimes = array_merge($processedData1['times'], $processedData2['times'], $processedData3['times']);
    $uniqueTimes = array_unique($allTimes);
    sort($uniqueTimes);

    // Función para interpolar datos (sin cambios)
    function interpolateData($data, $times, $allTimes) {
        $result = [];
        $currentIdx = 0;
        $lastValue = 0;
        
        foreach ($allTimes as $time) {
            while ($currentIdx < count($times) && $times[$currentIdx] <= $time) {
                $lastValue = $data[$currentIdx];
                $currentIdx++;
            }
            $result[] = $lastValue;
        }
        
        return $result;
    }

    // Preparar respuesta (añadiendo user_id en meta para depuración)
    $response = [
        'success' => true,
        'timeLabels' => array_map(function($t) { return number_format($t, 2); }, $uniqueTimes),
        'domain1' => [
            'requests' => interpolateData($processedData1['requests'], $processedData1['times'], $uniqueTimes),
            'responses' => interpolateData($processedData1['responses'], $processedData1['times'], $uniqueTimes),
            'arrivalTimes' => $processedData1['arrivalTimes']
        ],
        'domain2' => [
            'requests' => interpolateData($processedData2['requests'], $processedData2['times'], $uniqueTimes),
            'responses' => interpolateData($processedData2['responses'], $processedData2['times'], $uniqueTimes),
            'arrivalTimes' => $processedData2['arrivalTimes']
        ],
        'domain3' => [
            'requests' => interpolateData($processedData3['requests'], $processedData3['times'], $uniqueTimes),
            'responses' => interpolateData($processedData3['responses'], $processedData3['times'], $uniqueTimes),
            'arrivalTimes' => $processedData3['arrivalTimes']
        ],
        'meta' => [
            'user_id' => $user_id, 
            'timeFilter' => ($segundo_inicio !== null && $segundo_fin !== null) ? [
                'start' => $segundo_inicio,
                'end' => $segundo_fin
            ] : null,
            'recordType' => $tipoRegistro
        ]
    ];

    echo json_encode($response);

} catch (Exception $e) {
    // Determinar código de estado HTTP
    $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
    http_response_code($code);
    
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => (ini_get('display_errors')) ? $e->getTrace() : null,
        'code' => $code
    ]);
} finally {
    if (isset($conn)) $conn->close();
}