-- Create Database
CREATE DATABASE IF NOT EXISTS wealthwise;
USE wealthwise;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platforms Table (e.g., Alipay, WeChat, Brokers)
CREATE TABLE IF NOT EXISTS platforms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_platform_user (user_id, name)
);

-- Stock Holdings Table
CREATE TABLE IF NOT EXISTS assets_stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    platform_id INT NOT NULL,
    stock_code VARCHAR(20) NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
);

-- Fund Holdings Table
-- "Fund adds are not holding cost/quantity, but Name, Holding Amount, Holding Return"
CREATE TABLE IF NOT EXISTS assets_fund (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    platform_id INT NOT NULL,
    fund_code VARCHAR(20) NOT NULL,
    fund_name VARCHAR(100) NOT NULL,
    holding_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00, -- Current Value held
    holding_return DECIMAL(15, 2) NOT NULL DEFAULT 0.00, -- Total return amount
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
);

-- Watchlist Table (Self-selected)
CREATE TABLE IF NOT EXISTS watchlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('stock', 'fund') NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_watchlist_item (user_id, type, code)
);

-- Daily Asset Snapshot (For History Charts/Calendar)
CREATE TABLE IF NOT EXISTS daily_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    total_asset DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    daily_profit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    accumulated_profit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_daily_snapshot (user_id, date)
);

-- Insert Default User (root/123456 for demo purposes, hash in real app)
-- For this demo, we will store plain text or simple mock hash.
INSERT INTO users (username, password_hash) VALUES ('admin', '123456') ON DUPLICATE KEY UPDATE id=id;

-- Insert Default Platforms
INSERT INTO platforms (user_id, name) VALUES (1, '支付宝'), (1, '同花顺'), (1, '理财通') ON DUPLICATE KEY UPDATE id=id;
