<?php
// Iniciar sesión para obtener información del usuario
session_start();

// Configuración de depuración
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Guardar datos de depuración
$debug = [
    'received_params' => $_GET,
    'session_data' => $_SESSION,
    'segundo_inicio' => isset($_GET['segundo_inicio']) ? $_GET['segundo_inicio'] : 'no establecido',
    'segundo_fin' => isset($_GET['segundo_fin']) ? $_GET['segundo_fin'] : 'no establecido',
    'timestamp' => date('Y-m-d H:i:s'),
];
file_put_contents('debug_chart_data.log', json_encode($debug) . "\n", FILE_APPEND);

// Verificar que el usuario esté autenticado
if (!isset($_SESSION['user_id'])) {
    // Para pruebas, asignar un ID de usuario temporal (quitar en producción)
    $_SESSION['user_id'] = 1; // Asignar como admin para pruebas
    
    // En producción, descomentar la siguiente línea y eliminar la asignación anterior
    // header('HTTP/1.1 401 Unauthorized');
    // echo json_encode(['error' => 'Usuario no autenticado']);
    // exit;
}

$user_id = $_SESSION['user_id'];

// Establecer conexión a la base de datos
$servidor = "localhost:3306";
$usuario = "root";
$contraseña = "root";
$basededatos = "db_paquetes";
$conn = new mysqli($servidor, $usuario, $contraseña, $basededatos);
if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}

// Obtener el dominio del parámetro GET (si está presente)
$dominio = isset($_GET['queryname']) ? $_GET['queryname'] : '';

// Obtener parámetros de filtro de tiempo (si están presentes)
$segundo_inicio = isset($_GET['segundo_inicio']) ? floatval($_GET['segundo_inicio']) : null;
$segundo_fin = isset($_GET['segundo_fin']) ? floatval($_GET['segundo_fin']) : null;

// Construir la consulta SQL base
$sql = "SELECT tipomensaje, tiempo, queryname, respname, arrivaltime FROM datos_paquetes WHERE tipomensaje IN ('consulta', 'respuesta')";

// Aplicar restricciones según el ID del usuario
if ($user_id == 1) {
    // El usuario 1 puede ver datos de los usuarios 2 y 3
    $sql .= " AND (usuario_id = 2 OR usuario_id = 3)";
} else if ($user_id == 2 || $user_id == 3) {
    // Los usuarios 2 y 3 solo pueden ver sus propios datos
    $sql .= " AND usuario_id = $user_id";
} else {
    // Cualquier otro usuario no tiene acceso
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['error' => 'Acceso denegado: No tienes permisos para ver estos datos']);
    exit;
}

// Añadir la condición de filtro de tiempo si se proporciona
if ($segundo_inicio !== null && $segundo_fin !== null) {
    $sql .= " AND tiempo BETWEEN $segundo_inicio AND $segundo_fin";
}

// Ordenar por tiempo
$sql .= " ORDER BY tiempo";

// Para depuración
file_put_contents('debug_chart_data_sql.log', "User ID: $user_id, SQL: $sql\n", FILE_APPEND);

$result = $conn->query($sql);

// Arreglo para almacenar los datos necesarios para el gráfico lineal
$lineChartData = [
    'labels' => [], 
    'solicitudes_totales' => [], 
    'respuestas_totales' => [],
    'solicitudes_dominio' => [], 
    'respuestas_dominio' => [],
    'arrivaltimes' => [],
    'user_id' => $user_id, // Incluir el ID del usuario para depuración
    'access_level' => ($user_id == 1) ? 'admin' : 'user', // Nivel de acceso
    'sql_query' => $sql // Incluir la consulta SQL para depuración
];

$totalSolicitudes = 0;
$totalRespuestas = 0;
$solicitudesDominio = 0;
$respuestasDominio = 0;

if ($result) {
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $tiempo_captura = round($row["tiempo"], 2); // Redondear a 2 decimales
            $tipo_mensaje = $row["tipomensaje"];
            $queryname = $row["queryname"];
            $respname = $row["respname"];
            $arrivaltime = $row["arrivaltime"]; 
            
            // Actualizar contadores de solicitudes y respuestas totales
            if ($tipo_mensaje === "consulta") {
                $totalSolicitudes++;
            } elseif ($tipo_mensaje === "respuesta") {
                $totalRespuestas++;
            }
            
            // Actualizar contadores de solicitudes y respuestas del dominio específico
            if ($dominio) {
                if ($tipo_mensaje === "consulta" && $queryname === $dominio) {
                    $solicitudesDominio++;
                } elseif ($tipo_mensaje === "respuesta" && $respname === $dominio) {
                    $respuestasDominio++;
                }
            }
            
            // Agregar datos al arreglo para el gráfico
            $lineChartData['labels'][] = $tiempo_captura;
            $lineChartData['solicitudes_totales'][] = $totalSolicitudes;
            $lineChartData['respuestas_totales'][] = $totalRespuestas;
            $lineChartData['solicitudes_dominio'][] = $solicitudesDominio;
            $lineChartData['respuestas_dominio'][] = $respuestasDominio;
            $lineChartData['arrivaltimes'][] = $arrivaltime; 
        }
    } else {
        // No hay resultados - añadir información para depuración
        $lineChartData['error'] = "No se encontraron datos que coincidan con los criterios";
    }
} else {
    // Error en la consulta
    $lineChartData['error'] = "Error en la consulta: " . $conn->error;
}

// Si se aplicó un filtro, añadir metadatos sobre el filtro
if ($segundo_inicio !== null && $segundo_fin !== null) {
    $lineChartData['filter_applied'] = true;
    $lineChartData['filter_start'] = $segundo_inicio;
    $lineChartData['filter_end'] = $segundo_fin;
}

// Añadir información de cantidad de registros
$lineChartData['total_records'] = count($lineChartData['labels']);

$conn->close();

// Convertir los datos a JSON y devolverlos
header('Content-Type: application/json');
echo json_encode($lineChartData);
?>