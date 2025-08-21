<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once 'PHPMailer.php';
require_once 'Exception.php';
require_once 'SMTP.php'; 

class SessionIndependentAlertSystem {
    private $mailer;
    private $alertInterval;
    private $recipientEmail;
    private $logFile;
    private $alertStateFile;
    private $userId;
    private $userNames;
    private $statusDir = "C:\\WiresharkScripts\\";
    private $lastKnownPacketCount = 0;
    private $alertSentForThisCapture = false;
    private $captureStartTime = null;

    public function __construct($recipientEmail, $alertInterval = 1000, $userId = null, $userNames = []) {
        $this->recipientEmail = $recipientEmail;
        $this->alertInterval = $alertInterval;
        $this->userId = $userId ?? 'default';
        
      
        $this->userNames = !empty($userNames) ? $userNames : [
            2 => "Usuario 1",
            3 => "Usuario 2"
        ];
        
        $this->logFile = 'C:\xampp\htdocs\TrafAnalyzer\php\traffic_alerts.log';
        
       
        $this->alertStateFile = 'C:\xampp\htdocs\TrafAnalyzer\php\alert_state_user_' . $this->userId . '.json';
        
        $this->initializeMailer();
        $this->loadAlertState();
    }

    private function getUserName($userId = null) {
        $id = $userId ?? $this->userId;
        return isset($this->userNames[$id]) ? $this->userNames[$id] : "Usuario ID: $id";
    }

    private function initializeMailer() {
        $this->mailer = new PHPMailer(true);
        try {
            $this->mailer->isSMTP();
            $this->mailer->Host = 'smtp.gmail.com';
            $this->mailer->SMTPAuth = true;
            $this->mailer->Username = 'alkahfiislame1@gmail.com';
            $this->mailer->Password = 'tnhplexbcntnbuhc';
            $this->mailer->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $this->mailer->Port = 587;
            $this->mailer->setFrom('alkahfiislame1@gmail.com', 'Traffic Alert System');
        } catch (Exception $e) {
            $this->log("Mailer initialization error: " . $e->getMessage());
        }
    }

    private function log($message) {
        try {
            file_put_contents($this->logFile, 
                date('[Y-m-d H:i:s] ') . "[User:{$this->userId}] " . $message . PHP_EOL, 
                FILE_APPEND
            );
        } catch (Exception $e) {
            error_log($message);
        }
    }

    private function loadAlertState() {
        if (file_exists($this->alertStateFile)) {
            $state = json_decode(file_get_contents($this->alertStateFile), true);
            if ($state && is_array($state)) {
                $this->lastKnownPacketCount = $state['last_packet_count'] ?? 0;
                $this->alertSentForThisCapture = $state['alert_sent'] ?? false;
                $this->captureStartTime = $state['capture_start_time'] ?? null;
                
                $this->log("Loaded state - Last count: {$this->lastKnownPacketCount}, Alert sent: " . 
                          ($this->alertSentForThisCapture ? 'YES' : 'NO'));
            }
        } else {
            $this->log("No previous state found. Starting fresh.");
        }
    }

    private function saveAlertState() {
        $state = [
            'last_packet_count' => $this->lastKnownPacketCount,
            'alert_sent' => $this->alertSentForThisCapture,
            'capture_start_time' => $this->captureStartTime,
            'threshold' => $this->alertInterval,
            'user_id' => $this->userId,
            'username' => $this->getUserName(),
            'updated_at' => time(),
            'updated_timestamp' => date('Y-m-d H:i:s')
        ];
        
        try {
            file_put_contents($this->alertStateFile, json_encode($state, JSON_PRETTY_PRINT));
            $this->log("State saved successfully");
        } catch (Exception $e) {
            $this->log("Error saving state: " . $e->getMessage());
        }
    }

    private function isCaptureActive() {
        $statusFile = $this->statusDir . "status_user_" . $this->userId . ".txt";
        
        if (file_exists($statusFile)) {
            $lastModified = filemtime($statusFile);
            $timeout = 300; 
            
            if (time() - $lastModified > $timeout) {
                return false;
            }
            
            return [
                'active' => true,
                'last_modified' => $lastModified,
                'file_path' => $statusFile
            ];
        }
        
        return false;
    }

    private function detectNewCapture($currentPacketCount) {
        
        if ($currentPacketCount < $this->lastKnownPacketCount * 0.1) {
            $this->log("New capture detected - packet count dropped significantly");
            $this->log("Previous: {$this->lastKnownPacketCount}, Current: $currentPacketCount");
            return true;
        }
        
       
        if ($this->lastKnownPacketCount == 0 && $currentPacketCount > 0) {
            $this->log("New capture detected - first packets received");
            return true;
        }
        
       
        $captureStatus = $this->isCaptureActive();
        if ($captureStatus && $this->captureStartTime) {
            $timeSinceStart = time() - $this->captureStartTime;
            $fileAge = time() - $captureStatus['last_modified'];
            
           
            if ($captureStatus['last_modified'] > $this->captureStartTime + 60) {
                $this->log("New capture detected - status file updated after capture start");
                return true;
            }
        }
        
        return false;
    }

    public function checkAndSendAlert($currentPacketCount, $timestamp = null, $userName = null) {
        $timestamp = $timestamp ?? date("Y-m-d H:i:s");
        $userName = $userName ?? $this->getUserName();
        
       
        $captureStatus = $this->isCaptureActive();
        if (!$captureStatus) {
            $this->log("Capture not active - skipping alert check");
            return [
                'sent' => false,
                'reason' => 'capture_not_active',
                'packet_count' => $currentPacketCount,
                'username' => $userName
            ];
        }
        
       
        if ($this->detectNewCapture($currentPacketCount)) {
            $this->log("New capture detected - resetting alert state");
            $this->alertSentForThisCapture = false;
            $this->captureStartTime = time();
            $this->saveAlertState();
        }
        
      
        $this->lastKnownPacketCount = $currentPacketCount;
        
        $this->log("Alert check - Count: $currentPacketCount, Threshold: {$this->alertInterval}, Alert sent: " . 
                  ($this->alertSentForThisCapture ? 'YES' : 'NO'));
        
       
        if ($this->alertSentForThisCapture) {
            $this->log("Alert already sent for current capture");
            return [
                'sent' => false,
                'reason' => 'already_sent',
                'packet_count' => $currentPacketCount,
                'username' => $userName
            ];
        }
        
      
        if ($currentPacketCount >= $this->alertInterval) {
            $this->log("Threshold reached - attempting to send alert");
            
            try {
                $this->mailer->clearAddresses();
                $this->mailer->addAddress($this->recipientEmail);
                
                $this->mailer->Subject = "Alerta de Tráfico - Umbral Alcanzado";
                $this->mailer->isHTML(true); 
               $this->mailer->Body = "<strong>ALERTA DE TRÁFICO</strong><br>El sistema ha llegado a 1000 paquetes acumulados.<br><br><strong>Nombre de usuario:</strong> {$userName}<br><strong>Tiempo de Alerta:</strong> {$timestamp}";

                
                if ($this->mailer->send()) {
                    $this->alertSentForThisCapture = true;
                    $this->saveAlertState();
                    $this->log("✓ Alert sent successfully to {$this->recipientEmail} for user {$userName}");
                    
                    return [
                        'sent' => true,
                        'packet_count' => $currentPacketCount,
                        'timestamp' => $timestamp,
                        'username' => $userName
                    ];
                } else {
                    $this->log("✗ Failed to send alert - mailer error");
                }
            } catch (Exception $e) {
                $this->log("Error sending alert: " . $e->getMessage());
            }
        } else {
            $remaining = $this->alertInterval - $currentPacketCount;
            $this->log("Threshold not reached - need $remaining more packets");
        }
        
      
        $this->saveAlertState();
        
        return [
            'sent' => false,
            'reason' => 'below_threshold',
            'packet_count' => $currentPacketCount,
            'remaining_packets' => $this->alertInterval - $currentPacketCount,
            'username' => $userName
        ];
    }

    private function getCaptureInfo() {
        $captureStatus = $this->isCaptureActive();
        if ($captureStatus) {
            $statusFileTime = date('Y-m-d H:i:s', $captureStatus['last_modified']);
            return "<p><strong>Capture Status:</strong> Active (last update: {$statusFileTime})</p>";
        }
        return "<p><strong>Capture Status:</strong> Inactive</p>";
    }

    private function formatDuration($seconds) {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $secs = $seconds % 60;
        
        if ($hours > 0) {
            return sprintf("%d hours, %d minutes, %d seconds", $hours, $minutes, $secs);
        } elseif ($minutes > 0) {
            return sprintf("%d minutes, %d seconds", $minutes, $secs);
        } else {
            return sprintf("%d seconds", $secs);
        }
    }

    public function resetAlertForNewCapture() {
        $this->log("Manually resetting alert state for new capture");
        $this->alertSentForThisCapture = false;
        $this->lastKnownPacketCount = 0;
        $this->captureStartTime = time();
        $this->saveAlertState();
    }

    public function getAlertStatus() {
        return [
            'alert_sent' => $this->alertSentForThisCapture,
            'last_packet_count' => $this->lastKnownPacketCount,
            'capture_start_time' => $this->captureStartTime,
            'threshold' => $this->alertInterval,
            'capture_active' => $this->isCaptureActive() !== false,
            'username' => $this->getUserName()
        ];
    }

    public function hasAlertBeenSent() {
        return $this->alertSentForThisCapture;
    }

    public static function cleanupOldStateFiles($directory = 'C:\xampp\htdocs\TrafAnalyzer\php\\', $maxAge = 86400) {
        $files = glob($directory . 'alert_state_user_*.json');
        $cleaned = 0;
        
        foreach ($files as $file) {
            if (file_exists($file) && (time() - filemtime($file)) > $maxAge) {
                unlink($file);
                $cleaned++;
            }
        }
        
        return $cleaned;
    }
}
?>