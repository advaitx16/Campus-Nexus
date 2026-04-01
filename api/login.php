<?php
// api/login.php
session_start();
header('Content-Type: application/json');

require 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['email']) || !isset($input['password'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Missing email or password']);
    exit();
}

$email = strtolower(trim($input['email']));
$password = $input['password'];

try {
    $stmt = $pdo->prepare('SELECT id, full_name, password_hash, is_verified_student FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    // Verify Password against hash
    if ($user && password_verify($password, $user['password_hash'])) {
        // Prevent Session Fixation attacks
        session_regenerate_id(true);
        
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['full_name'] = $user['full_name'];
        $_SESSION['is_verified'] = $user['is_verified_student'];

        echo json_encode([
            'status' => 'success', 
            'message' => 'Login successful', 
            'user' => [
                'id' => $user['id'], 
                'name' => $user['full_name'],
                'verified' => $user['is_verified_student']
            ]
        ]);
    } else {
        http_response_code(401); // Unauthorized
        echo json_encode(['status' => 'error', 'message' => 'Invalid email or password']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error']);
}
?>
