<?php
session_start();
header('Content-Type: application/json; charset=utf-8'); 


$servername = "localhost";
$username = "root";
$password = "root";
$dbname = "db_paquetes";

$response = ['status' => 'error', 'message' => 'Unknown error']; 

try {
    
    if (empty($_SESSION['user_id'])) {
        $response = [
            "status" => "error",
            "message" => "No autorizado. Inicie sesión para continuar."
        ];
    } 
   
    else if (empty($_POST['user_id']) || (int)$_SESSION['user_id'] !== (int)$_POST['user_id']) {
        $response = [
            "status" => "error",
            "message" => "No autorizado. ID de usuario no válido."
        ];
    } 
    else {
        $user_id = (int)$_POST['user_id'];

        
        $conn = new mysqli($servername, $username, $password, $dbname);
        
       
        if ($conn->connect_error) {
            throw new Exception("Error de conexión: " . $conn->connect_error);
        }

        
        if ($user_id === 1) {
            
            $response = [
                "status" => "success",
                "message" => "No se eliminaron paquetes para el administrador (user_id = 1)."
            ];
        } elseif ($user_id === 2 || $user_id === 3) {
            
            $sql = "DELETE FROM datos_paquetes WHERE usuario_id = $user_id";
            if ($conn->query($sql) === TRUE) {
                $response = [
                    "status" => "success",
                    "message" => "Se eliminaron los paquetes de usuario_id = $user_id."
                ];
            } else {
                throw new Exception("Error al eliminar datos: " . $conn->error);
            }
        } else {
            
            $response = [
                "status" => "error",
                "message" => "No autorizado para realizar esta acción."
            ];
        }

        $conn->close(); 
    }
} catch (Exception $e) {
    $response = [
        "status" => "error",
        "message" => $e->getMessage()
    ];
}


echo json_encode($response, JSON_UNESCAPED_UNICODE);
?>
