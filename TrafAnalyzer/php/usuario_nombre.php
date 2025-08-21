<?php
session_start();
$nombre = "Desconocido"; 


if (isset($_SESSION['cliente_id'])) {
    switch ($_SESSION['cliente_id']) {
        case 1:
            $nombre = "Admin";
            break;
        case 2:
            $nombre = "Usuario1";
            break;
        case 3:
            $nombre = "Usuario2";
            break;
        default:
            $nombre = "Desconocido";
    }
}

echo $nombre;

?>
