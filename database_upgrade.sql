-- =========================================
-- CampusTrade "x100" Database Upgrade
-- Please run this in your phpMyAdmin SQL tab
-- =========================================

USE `campus_trade`;

-- 1. Messages Table (Live Chat & Negotiation)
CREATE TABLE IF NOT EXISTS `messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `sender_id` INT NOT NULL,
    `receiver_id` INT NOT NULL,
    `message_text` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Transactions Table (Digital Bills)
CREATE TABLE IF NOT EXISTS `transactions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `buyer_id` INT NOT NULL,
    `seller_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(50) DEFAULT 'Completed',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`),
    FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`),
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Modify Products Table to support Sold states
-- We check if it exists before adding (MySQL trick: we can safely run this if we ignore errors or just standard alter)
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `is_sold` BOOLEAN DEFAULT FALSE;
