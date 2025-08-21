<?php
session_start();
require_once "conexion.php";

$mensaje_error = '';

if (!empty($_SESSION['user_id'])) {
    header('Location: index.html');
    exit();
}

if (!empty($_POST['usuario']) && !empty($_POST['clave'])) {
    $user = mysqli_real_escape_string($conexion, $_POST['usuario']);
    $clave = mysqli_real_escape_string($conexion, $_POST['clave']);
    
   
    $query = mysqli_query($conexion, "SELECT id, correo, pass FROM usuario WHERE correo = '$user'");
    
    if (mysqli_num_rows($query) > 0) {
        $dato = mysqli_fetch_assoc($query);
        
        
        if ($clave === $dato['pass']) {
           
            $_SESSION['user_id'] = $dato['id'];
            $_SESSION['user_email'] = $dato['correo'];
            $_SESSION['cliente_id'] = $dato['id']; 
            header("Location: index.html?auth=".bin2hex(random_bytes(4)));
            exit();
        }
    }
    
    $mensaje_error = 'Credenciales incorrectas';
}
?>


<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Iniciar Sesión</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background: url('./imagen/fondoazul.jpg') no-repeat center center fixed;
            background-size: cover;
            text-align: center;
        }
        #page-wrapper {
            margin-top: 50px;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        h1 {
            color: #fff;
            font-size: 48px;
            margin-bottom: 30px;
        }
        form {
            background: rgba(255, 255, 255, 0.8);
            padding: 30px;
            border-radius: 10px;
            width: 400px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        input {
            width: 100%;
            padding: 10px;
            margin-bottom: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            margin-top: 20px;
            text-decoration: none;
            color: #fff;
            background-color: #6ab0de;
            border-radius: 5px;
            font-size: 20px;
            cursor: pointer;
        }
        .button:hover {
            background-color: #5ca8db;
        }
        .error-box {
            color: red;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div id="page-wrapper">
        <h1>TRAFANALYZER    </h1>
        <form name="frmContact" method="post" action="" role="form">
            <div class="form-group">
                <label for="usuario">Email</label>
                <input type="email" id="usuario" name="usuario" placeholder="Email" required>
            </div>
            <div class="form-group">
                <label for="clave">Password</label>
                <input type="password" id="clave" name="clave" placeholder="Password" required>
            </div>
            <button type="submit" class="button">Iniciar Sesión</button>
            <?php if (!empty($mensaje_error)): ?>
                <div id="error-container" class="error-box visible"><?= htmlspecialchars($mensaje_error) ?></div>
            <?php endif; ?>
        </form>
    </div>
</body>
</html>