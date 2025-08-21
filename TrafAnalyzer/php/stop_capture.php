<?php
header('Content-Type: application/json');


error_log("POST data: " . print_r($_POST, true));
error_log("GET data: " . print_r($_GET, true));
error_log("Raw input: " . file_get_contents('php://input'));


$user_id = 0;

if (isset($_POST['user_id'])) {
    $user_id = intval($_POST['user_id']);
} elseif (isset($_GET['user_id'])) {
    $user_id = intval($_GET['user_id']);
} else {
   
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['user_id'])) {
        $user_id = intval($input['user_id']);
    }
}

error_log("User ID obtenido: " . $user_id);

if ($user_id <= 0) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'ID de usuario inválido o no proporcionado',
        'debug' => [
            'post' => $_POST,
            'get' => $_GET,
            'user_id_received' => $user_id
        ]
    ]);
    exit;
}


$statusDir = "C:\\WiresharkScripts\\";


$statusFile = $statusDir . "status_user_" . $user_id . ".txt";
if (!file_exists($statusFile)) {
    echo json_encode([
        'status' => 'stopped',
        'message' => 'No había captura activa'
    ]);
    exit;
}


$stopFile = $statusDir . "stop_" . $user_id . ".txt";
if (file_put_contents($stopFile, time()) === false) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'No se pudo crear el archivo de señal de detención'
    ]);
    exit;
}


sleep(2);


$maxWaitTime = 10; 
$startTime = time();

while (file_exists($statusFile) && (time() - $startTime) < $maxWaitTime) {
    sleep(1);
}


if (file_exists($statusFile)) {
    echo json_encode([
        'status' => 'warning',
        'message' => 'Señal de detención enviada, pero la captura puede seguir activa'
    ]);
} else {
    echo json_encode([
        'status' => 'stopped',
        'message' => 'Captura detenida correctamente'
    ]);
}

exit;
?>