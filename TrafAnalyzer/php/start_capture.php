<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'C:\\WiresharkScripts\\php_errors.log');

ob_clean();
header('Content-Type: application/json');

$statusDir = "C:\\WiresharkScripts\\";
$statusFileBase = $statusDir . "status_user_";

if (!is_dir($statusDir) || !is_writable($statusDir)) {
    http_response_code(500);
    die(json_encode([
        'status' => 'error',
        'message' => 'El sistema de captura no esta configurado correctamente'
    ]));
}

$authorizedUsers = [
    2 => "CapturaWireshark_Usuario2",
    3 => "CapturaWireshark_Usuario3"
];

$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;
if (!$user_id || !isset($authorizedUsers[$user_id])) {
    http_response_code(400);
    die(json_encode([
        'status' => 'error',
        'message' => 'Usuario no autorizado o ID inválido',
        'received_id' => $user_id,
        'authorized_users' => array_keys($authorizedUsers)
    ]));
}

$taskName = $authorizedUsers[$user_id];
$statusFile = $statusFileBase . $user_id . ".txt";
$lockFile = $statusDir . "lock_user_" . $user_id . ".lock";
$stopFile = $statusDir . "stop_" . $user_id . ".txt";


function cleanupUserFiles($user_id, $statusDir) {
    $files = [
        $statusDir . "status_user_" . $user_id . ".txt",
        $statusDir . "stop_" . $user_id . ".txt",
        $statusDir . "lock_user_" . $user_id . ".lock"
    ];
    
    foreach ($files as $file) {
        if (file_exists($file)) {
            @unlink($file);
        }
    }
}


function isProcessReallyRunning($user_id) {
 
    $output = [];
    exec('tasklist /FI "IMAGENAME eq python.exe" /FO CSV 2>NUL', $output);
    
    foreach ($output as $line) {
        if (strpos($line, 'python.exe') !== false && strpos($line, (string)$user_id) !== false) {
            return true;
        }
    }
    return false;
}


$fp = null;
try {
    $fp = fopen($lockFile, 'c+');
    if (!$fp || !flock($fp, LOCK_EX | LOCK_NB)) {
        if ($fp) fclose($fp);
        
       
        if (file_exists($lockFile)) {
            $lockAge = time() - filemtime($lockFile);
            if ($lockAge > 60 && !isProcessReallyRunning($user_id)) { 
                cleanupUserFiles($user_id, $statusDir);
                file_put_contents($statusDir . 'capture.log', 
                    date('[Y-m-d H:i:s]') . " User $user_id - Lock huérfano limpiado\n", 
                    FILE_APPEND | LOCK_EX);
                
              
                $fp = fopen($lockFile, 'c+');
                if (!$fp || !flock($fp, LOCK_EX | LOCK_NB)) {
                    http_response_code(409);
                    die(json_encode([
                        'status' => 'error',
                        'message' => 'Ya hay una operación en curso para este usuario'
                    ]));
                }
            } else {
                http_response_code(409);
                die(json_encode([
                    'status' => 'error',
                    'message' => 'Hay una captura previa bloqueada. Intenta más tarde o contacta al administrador.'
                ]));
            }
        }
    }

    
    if (file_exists($statusFile)) {
        $lastModified = filemtime($statusFile);
        $timeout = 180; 
        $statusAge = time() - $lastModified;
        
        
        if ($statusAge > $timeout || !isProcessReallyRunning($user_id)) {
            cleanupUserFiles($user_id, $statusDir);
            file_put_contents($statusDir . 'capture.log', 
                date('[Y-m-d H:i:s]') . " User $user_id - Estado anterior limpiado (age: {$statusAge}s)\n", 
                FILE_APPEND | LOCK_EX);
        } else {
         
            throw new Exception('Ya hay una captura en curso para este usuario');
        }
    }

    if (file_exists($stopFile)) {
        unlink($stopFile);
    }

    function executeCapture($taskName, $statusFile, $statusDir, $user_id, $maxRetries = 2) {
        $lastError = null;
        
        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                $output = [];
                $returnCode = 0;
                $command = 'schtasks /Run /TN "' . $taskName . '" 2>&1';
                
                if ($attempt === 1) {
                    $checkCommand = 'schtasks /Query /TN "' . $taskName . '" /FO LIST 2>&1';
                    $checkOutput = [];
                    exec($checkCommand, $checkOutput, $checkReturnCode);
                    
                    if ($checkReturnCode !== 0) {
                        throw new Exception("Tarea '$taskName' no existe");
                    }
                    
                  
                    $taskRunning = false;
                    foreach ($checkOutput as $line) {
                        if (strpos($line, 'Status:') !== false && strpos($line, 'Running') !== false) {
                            $taskRunning = true;
                            break;
                        }
                    }
                    
                    if ($taskRunning) {
                        throw new Exception("La tarea ya está ejecutándose");
                    }
                }
                
                exec($command, $output, $returnCode);
                
                $logMessage = date('[Y-m-d H:i:s]') . " User $user_id - Intento $attempt\n";
                $logMessage .= "Comando: $command\n";
                $logMessage .= "Salida: " . implode("\n", $output) . "\n";
                $logMessage .= "Código: $returnCode\n";
                
                if ($returnCode === 0) {
                 
                    sleep(2); 
                    
                   
                    $statusData = json_encode([
                        'start_time' => time(),
                        'attempt' => $attempt,
                        'pid_check' => isProcessReallyRunning($user_id)
                    ]);
                    
                    if (!file_put_contents($statusFile, $statusData)) {
                        throw new Exception("No se pudo crear archivo de estado");
                    }
                    
                    $logMessage .= "ÉXITO\n";
                    file_put_contents($statusDir . 'capture.log', $logMessage . "\n", FILE_APPEND | LOCK_EX);
                    
                    return [
                        'success' => true,
                        'data' => [
                            'status' => 'success',
                            'message' => 'Captura iniciada correctamente',
                            'task' => $taskName,
                            'attempt' => $attempt,
                            'timestamp' => time()
                        ]
                    ];
                } else {
                    $lastError = "Error ejecutando tarea (Código: $returnCode). " . implode(", ", $output);
                    $logMessage .= "ERROR: $lastError\n";
                    file_put_contents($statusDir . 'capture.log', $logMessage, FILE_APPEND | LOCK_EX);
                    
                    if ($attempt < $maxRetries) {
                        sleep($attempt); 
                    }
                }
                
            } catch (Exception $e) {
                $lastError = $e->getMessage();
                file_put_contents($statusDir . 'capture.log', 
                    date('[Y-m-d H:i:s]') . " User $user_id - EXCEPCIÓN intento $attempt: $lastError\n", 
                    FILE_APPEND | LOCK_EX);
                
                if ($attempt < $maxRetries) {
                    sleep($attempt);
                }
            }
        }
        
        return [
            'success' => false,
            'error' => $lastError ?: 'Error desconocido tras todos los intentos',
            'attempts_made' => $maxRetries
        ];
    }


    file_put_contents($statusDir . 'capture.log', 
        date('[Y-m-d H:i:s]') . " User $user_id - INICIANDO captura\n", 
        FILE_APPEND | LOCK_EX);

  
    $result = executeCapture($taskName, $statusFile, $statusDir, $user_id, 2);


    if ($result['success']) {
        echo json_encode($result['data']);
    } else {
        http_response_code(500);
        echo json_encode([
            'status' => 'error',
            'message' => $result['error'],
            'attempts_made' => $result['attempts_made']
        ]);
    }

} catch (Exception $e) {
    http_response_code(409);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
    
} finally {
  
    if ($fp) {
        flock($fp, LOCK_UN);
        fclose($fp);
        if (file_exists($lockFile)) {
            @unlink($lockFile);
        }
    }
    
    file_put_contents($statusDir . 'capture.log', 
        date('[Y-m-d H:i:s]') . " User $user_id - Proceso start finalizado\n", 
        FILE_APPEND | LOCK_EX);
}
?>