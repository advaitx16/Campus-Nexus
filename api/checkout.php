<?php
// api/checkout.php - The GOD LEVEL Payment System
session_start();
header('Content-Type: application/json');
require 'db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);

$productId = isset($input['product_id']) ? (int)$input['product_id'] : 0;
$sellerId = isset($input['seller_id']) ? (int)$input['seller_id'] : 0;
$buyerId = $_SESSION['user_id'];
// Simulated Card Details just structurally validated (NOT SAVED securely for mock)
$cardNumber = isset($input['card_number']) ? trim($input['card_number']) : '';
$rating = isset($input['rating']) ? (float)$input['rating'] : 5.0; // Trust algorithm

if (!$productId || !$sellerId || empty($cardNumber)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid checkout data payload']);
    exit();
}

// Ensure the user isn't buying their own product
if ($sellerId == $buyerId) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'You cannot buy your own product']);
    exit();
}

try {
    // 1. Get the product price
    $stmt = $pdo->prepare('SELECT price, is_sold FROM products WHERE id = :id');
    $stmt->execute([':id' => $productId]);
    $product = $stmt->fetch();

    if (!$product || $product['is_sold']) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Product no longer available']);
        exit();
    }

    $amount = $product['price'];

    // Begin standard SQL Atomic Transaction
    $pdo->beginTransaction();

    // 2. Insert into transactions table (Digital Bill generation)
    $stmt = $pdo->prepare('
        INSERT INTO transactions (buyer_id, seller_id, product_id, amount, status) 
        VALUES (:buyer, :seller, :product, :amt, "Completed")
    ');
    $stmt->execute([
        ':buyer' => $buyerId,
        ':seller' => $sellerId,
        ':product' => $productId,
        ':amt' => $amount
    ]);
    
    $transactionId = $pdo->lastInsertId();

    // 3. Mark Product as Sold
    $stmt = $pdo->prepare('UPDATE products SET is_sold = 1 WHERE id = :id');
    $stmt->execute([':id' => $productId]);

    // 4. ALGORITHM: Update Seller Trust Score
    // If rating is 5, slightly boost score (+0.1). If bad, decrease. Max 5.0
    // Fetch current trust
    $stmt = $pdo->prepare('SELECT trust_score FROM users WHERE id = :id');
    $stmt->execute([':id' => $sellerId]);
    $seller = $stmt->fetch();
    
    $currentScore = (float)$seller['trust_score'];
    $newScore = $currentScore;
    
    if ($rating >= 4) {
        $newScore = min(5.0, $currentScore + 0.1);
    } else {
        $newScore = max(1.0, $currentScore - 0.2); // Harsher penalty for bad trades
    }

    $stmt = $pdo->prepare('UPDATE users SET trust_score = :score WHERE id = :id');
    $stmt->execute([':score' => $newScore, ':id' => $sellerId]);

    // Commit changes safely
    $pdo->commit();

    // Generate response for Digital Bill interface
    echo json_encode([
        'status' => 'success', 
        'message' => 'Payment Authorized & Processed Successfully',
        'digital_bill' => [
            'transaction_id' => 'CT-' . str_pad($transactionId, 6, "0", STR_PAD_LEFT),
            'amount_paid' => $amount,
            'timestamp' => date('Y-m-d H:i:s'),
            'seller_trust_updated' => round($newScore, 1)
        ]
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Transaction failed securely handled']);
}
?>
