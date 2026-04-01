<?php
// api/auth_status.php
session_start();
header('Content-Type: application/json');

if (isset($_SESSION['user_id'])) {
    echo json_encode([
        'authenticated' => true,
        'user' => [
            'id' => $_SESSION['user_id'],
            'name' => $_SESSION['full_name'],
            'verified' => isset($_SESSION['is_verified']) ? $_SESSION['is_verified'] : true
        ]
    ]);
} else {
    echo json_encode(['authenticated' => false]);
}
?>
