-- =========================================
-- CampusTrade "God-Level" Database Setup
-- Setup Instructions: Run this script in phpMyAdmin 
-- =========================================

CREATE DATABASE IF NOT EXISTS `campus_trade`;
USE `campus_trade`;

-- 1. Users Table (Secure storage)
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL, -- Storing bcrypt hash
    `trust_score` DECIMAL(3, 1) DEFAULT 5.0,
    `is_verified_student` BOOLEAN DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `slug` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default categories
INSERT IGNORE INTO `categories` (`slug`, `name`) VALUES 
('textbooks', 'Textbooks'),
('electronics', 'Electronics'),
('vehicles', 'Vehicles'),
('dorm', 'Dorm Gear');

-- 3. Products Table
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `seller_id` INT NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `price` DECIMAL(10, 2) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `image_url` VARCHAR(255) DEFAULT 'assets/placeholder.png',
    `condition_status` VARCHAR(50) DEFAULT 'Good',
    `is_safe_zone` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Initial Dummy Data (Optional, but great for presentation)
INSERT IGNORE INTO `users` (`id`, `full_name`, `email`, `password_hash`, `trust_score`, `is_verified_student`) VALUES
(1, 'Admin Student', 'admin@vidyalankar.edu.in', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 5.0, TRUE); -- Password is 'password'

INSERT IGNORE INTO `products` (`seller_id`, `title`, `description`, `price`, `category`, `image_url`, `condition_status`, `is_safe_zone`) VALUES
(1, 'Calculus Early Transcendentals 8th Ed.', 'Bought this last semester but ended up dropping the course. No highlights, mint condition. Can meet near the central library.', 1200.00, 'textbooks', 'assets/textbook.png', 'Excellent - Almost New', TRUE),
(1, 'Sony WH-1000XM4 Noise Cancelling', 'Upgraded to XM5s so I don\'t need these anymore. Comes with original case and cables. Perfect for coding in noisy dorms!', 15500.00, 'electronics', 'assets/headphones.png', 'Good - Used for 6 months', TRUE),
(1, 'Firefox Mountain Bike 21-Gear', 'Great bike for getting around campus quickly. Tires are in good shape, brakes might need a little tightening. Leaving college so selling cheap.', 8000.00, 'vehicles', 'assets/bike.png', 'Fair - Needs minor tuning', FALSE),
(1, 'Mini Dorm Fridge (45L)', 'Perfect size for under the desk. Chills very fast and is extremely quiet. Only used for one academic year.', 4500.00, 'dorm', 'assets/fridge.png', 'Like New', TRUE);
