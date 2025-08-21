<?php

$servidor = "localhost:3306";
$usuario = "root";
$contraseña = "root";
$basededatos = "db_paquetes";



$conexion = mysqli_connect($servidor, $usuario,$contraseña,$basededatos) or die ("No se ha podido conectar al servidr de la base de datos");

if (!$conexion) {
	die("No se ha podido conectar a la base de datos db_hotel");
}
$db = mysqli_select_db( $conexion, $basededatos ) or die ( "No se ha podido conectar con la base de datos " );
?>