<?php

session_start();
header('Content-Type: application/json');


error_log("Session in userinfo.php: " . print_r($_SESSION, true));


echo json_encode([
    'user_id' => $_SESSION['user_id'] ?? null,
    
]);
?>