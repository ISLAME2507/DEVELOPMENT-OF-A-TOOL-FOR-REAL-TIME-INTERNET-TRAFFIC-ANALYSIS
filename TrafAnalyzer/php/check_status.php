<?php
header('Content-Type: application/json');

// Obtener ID de usuario
$user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;
if (!$user_id) {
    http_response_code(400);
    die(json_encode(['running' => false, 'message' => 'ID de usuario inválido']));
}

// Verificar archivo de estado
$statusFile = "C:\\WiresharkScripts\\status_user_" . $user_id . ".txt";
$running = file_exists($statusFile);

// Si existe, verificar que no esté obsoleto (más de 5 minutos)
if ($running) {
    $lastModified = filemtime($statusFile);
    if ((time() - $lastModified) > 300) {
        // El archivo está obsoleto, eliminarlo
        @unlink($statusFile);
        $running = false;
    }
}

// Verificar si el proceso Python está en ejecución 
$pythonRunning = false;
if ($running) {
    exec("tasklist /FI \"IMAGENAME eq python.exe\" /FO CSV", $output);
    foreach ($output as $line) {
        if (strpos($line, 'python.exe') !== false) {
            $pythonRunning = true;
            break;
        }
    }
}

echo json_encode([
    'running' => $running && $pythonRunning,
    'status' => $running ? 'active' : 'inactive',
    'process_found' => $pythonRunning
]);
?>