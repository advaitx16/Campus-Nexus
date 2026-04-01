<?php
// api/register.php
session_start();
header('Content-Type: application/json');

require 'db.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
    exit();
}

// Get JSON input from fetch body
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['full_name']) || !isset($input['email']) || !isset($input['password'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Missing required fields']);
    exit();
}

$fullName = trim($input['full_name']);
$email = strtolower(trim($input['email']));
$password = $input['password'];

// Basic validation
if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Password must be at least 6 characters']);
    exit();
}

// Optional constraint: Only .edu domains for students (Campus feature)
if (!str_ends_with($email, '.edu') && !str_ends_with($email, '.edu.in')) {
    // We will bypass this constraint for the hackathon but normally we'd block it.
    // For demo purposes, we will just set 'is_verified_student' = true.
}

// God-Level Security: Hash the password via bcrypt framework default
$hash = password_hash($password, PASSWORD_DEFAULT);

try {
    // PDO prepared statement absolutely stops SQL Injection payload
    $stmt = $pdo->prepare('INSERT INTO users (full_name, email, password_hash, is_verified_student) VALUES (:name, :email, :hash, :verified)');
    $stmt->execute([
        ':name' => $fullName,
        ':email' => $email,
        ':hash' => $hash,
        ':verified' => 1 // Auto-verify for hackathon
    ]);

    $userId = $pdo->lastInsertId();
    
    // Auto-login the user after registration
    $_SESSION['user_id'] = $userId;
    $_SESSION['full_name'] = $fullName;

    echo json_encode(['status' => 'success', 'message' => 'Registration successful', 'user' => ['id' => $userId, 'name' => $fullName]]);

} catch (PDOException $e) {
    // Error code 23000 indicates a unique constraint violation (Duplicate Email)
    if ($e->getCode() == 23000) {
        http_response_code(409);
        echo json_encode(['status' => 'error', 'message' => 'Email already registered']);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Database error']);
    }
}
?>
