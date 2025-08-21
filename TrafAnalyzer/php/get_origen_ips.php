<?php
$servidor = "localhost:3306";
$usuario = "root";
$contraseña = "root";
$basededatos = "db_paquetes";

$conn = new mysqli($servidor, $usuario, $contraseña, $basededatos);
if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}


$sql = "SELECT DISTINCT iporigen FROM datos_paquetes WHERE iporigen IS NOT NULL AND iporigen != ''";
$result = $conn->query($sql);

$ips = [];

if ($result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $ips[] = $row["iporigen"];
    }
}

$conn->close();


header('Content-Type: application/json');
echo json_encode($ips);
?>