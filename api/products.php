<?php
// api/products.php
session_start();
header('Content-Type: application/json');
require 'db.php';

// GET -> Fetch products (with Recommendations Logic)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $category = isset($_GET['category']) ? $_GET['category'] : 'all';
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $excludeId = isset($_GET['exclude_id']) ? (int)$_GET['exclude_id'] : 0;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 0;
    
    // Hide sold items securely handling schema migrations
    $sql = "SELECT p.*, u.full_name as seller_name, u.trust_score 
            FROM products p 
            JOIN users u ON p.seller_id = u.id 
            WHERE IFNULL(p.is_sold, 0) = 0";
    $params = [];

    if ($category !== 'all') {
        $sql .= " AND p.category = :category";
        $params[':category'] = $category;
    }

    if (!empty($search)) {
        $sql .= " AND (p.title LIKE :search OR p.description LIKE :search)";
        $params[':search'] = '%' . $search . '%';
    }

    if ($excludeId > 0) {
        $sql .= " AND p.id != :exclude_id";
        $params[':exclude_id'] = $excludeId;
    }

    $sql .= " ORDER BY p.created_at DESC";
    
    if ($limit > 0) {
        $sql .= " LIMIT " . $limit;
    }

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll();
        echo json_encode(['status' => 'success', 'data' => $products]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Failed to fetch products']);
    }
    exit();
}

// POST -> Add a new product
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
        exit();
    }
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['title']) || empty($input['price']) || empty($input['category'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Title, price, and category are required.']);
        exit();
    }
    try {
        $stmt = $pdo->prepare('
            INSERT INTO products (seller_id, title, description, price, category, image_url, condition_status, is_safe_zone) 
            VALUES (:seller, :t, :d, :price, :cat, :img, :cond, :safe)
        ');
        $stmt->execute([
            ':seller' => $_SESSION['user_id'],
            ':t'      => strip_tags($input['title']),
            ':d'      => strip_tags($input['description']),
            ':price'  => (float)$input['price'],
            ':cat'    => strip_tags($input['category']),
            ':img'    => !empty($input['image_url']) ? strip_tags($input['image_url']) : 'assets/placeholder.png',
            ':cond'   => !empty($input['condition']) ? strip_tags($input['condition']) : 'Good',
            ':safe'   => isset($input['safe_zone']) ? (int)$input['safe_zone'] : 1
        ]);
        echo json_encode(['status' => 'success', 'message' => 'Product posted!']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Failed to post']);
    }
    exit();
}
?>
