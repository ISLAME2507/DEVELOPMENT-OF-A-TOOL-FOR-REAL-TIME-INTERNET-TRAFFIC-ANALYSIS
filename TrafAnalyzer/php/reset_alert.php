<?php
header('Content-Type: application/json');
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'No active user session']);
    exit;
}

$user_id = (int)$_SESSION['user_id'];

// Load the alert system
require_once 'email_alert.php';

try {
    $alertSystem = new SessionIndependentAlertSystem('alkahfiislame1@gmail.com', 1000, $user_id);
    
    // Get current status before reset
    $beforeStatus = $alertSystem->getAlertStatus();
    
    // Reset alert state for new capture
    $alertSystem->resetAlertForNewCapture();
    
    // Get status after reset
    $afterStatus = $alertSystem->getAlertStatus();
    
    echo json_encode([
        'success' => true,
        'message' => 'Alert state reset successfully for new capture',
        'user_id' => $user_id,
        'before_reset' => $beforeStatus,
        'after_reset' => $afterStatus,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Error resetting alert state: ' . $e->getMessage()
    ]);
}
?>