<?php
// api/db.php
// God-Level Database Connection configuration using PDO
// Prevents SQL injection by enforcing prepared statements.

$host = 'localhost';
$db   = 'campus_trade';
$user = 'root'; // Default XAMPP username
$pass = '';     // Default XAMPP password (no password)
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    // Exception mode for robust error handling inside API
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    // Fetch objects or associative arrays exclusively
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    // Disable emulation to guarantee integer bindings work & security is maximized
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
     // In production, we log this instead of outputting to user.
     // For hackathon, we output JSON string error so JS fetch can parse it.
     http_response_code(500);
     echo json_encode(['status' => 'error', 'message' => 'Database connection failed. Ensure MySQL XAMPP is running and database imported.', 'debug' => $e->getMessage()]);
     exit();
}
?>
