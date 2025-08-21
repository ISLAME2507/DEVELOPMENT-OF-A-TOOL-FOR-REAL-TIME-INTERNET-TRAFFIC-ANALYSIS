<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');

// Información del servidor
$server_info = [
    'php_version' => phpversion(),
    'server_software' => $_SERVER['SERVER_SOFTWARE'],
    'user' => get_current_user(),
    'script_owner' => fileowner(__FILE__),
    'script_perms' => substr(sprintf('%o', fileperms(__FILE__)), -4),
    'python_exists' => file_exists("C:\\Users\\hp\\AppData\\Local\\Programs\\Python\\Python313\\python.exe"),
    'script_exists' => file_exists("C:\\WiresharkScripts\\script.py"),
    'log_dir_exists' => file_exists("C:\\WiresharkScripts\\logs"),
    'log_dir_writable' => is_writable("C:\\WiresharkScripts\\logs"),
    'can_execute_tasklist' => function_exists('exec') && !in_array('exec', explode(',', ini_get('disable_functions')))
];

// Intentar ejecutar python para verificar que funciona
$python_output = [];
$python_result = -1;
if ($server_info['can_execute_tasklist']) {
    exec("\"C:\\Users\\hp\\AppData\\Local\\Programs\\Python\\Python313\\python.exe\" --version 2>&1", $python_output, $python_result);
    $server_info['python_test'] = [
        'output' => $python_output,
        'result_code' => $python_result
    ];
}

echo json_encode($server_info, JSON_PRETTY_PRINT);
?>