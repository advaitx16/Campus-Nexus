<?php
// api/chat.php
session_start();
header('Content-Type: application/json');
require 'db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit();
}

$userId = $_SESSION['user_id'];

// Method GET: Fetch messages
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $productId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : 0;
    $otherUserId = isset($_GET['other_user_id']) ? (int)$_GET['other_user_id'] : 0;

    if (!$productId || !$otherUserId) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Missing product or user identification']);
        exit();
    }

    try {
        $stmt = $pdo->prepare('
            SELECT m.*, u.full_name as sender_name 
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.product_id = :pid 
              AND ((m.sender_id = :uid AND m.receiver_id = :oid) OR (m.sender_id = :oid AND m.receiver_id = :uid))
            ORDER BY m.created_at ASC
        ');
        $stmt->execute([':pid' => $productId, ':uid' => $userId, ':oid' => $otherUserId]);
        $messages = $stmt->fetchAll();
        
        echo json_encode(['status' => 'success', 'data' => $messages]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Chat fetch failed']);
    }
    exit();
}

// Method POST: Send message
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $productId = isset($input['product_id']) ? (int)$input['product_id'] : 0;
    $receiverId = isset($input['receiver_id']) ? (int)$input['receiver_id'] : 0;
    $message = isset($input['message']) ? trim(strip_tags($input['message'])) : '';

    if (!$productId || !$receiverId || empty($message)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid message payload']);
        exit();
    }

    try {
        $stmt = $pdo->prepare('
            INSERT INTO messages (product_id, sender_id, receiver_id, message_text) 
            VALUES (:pid, :sid, :rid, :msg)
        ');
        $stmt->execute([
            ':pid' => $productId,
            ':sid' => $userId,
            ':rid' => $receiverId,
            ':msg' => $message
        ]);
        
        echo json_encode(['status' => 'success', 'message' => 'Message sent safely']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Failed to send message']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
?>
