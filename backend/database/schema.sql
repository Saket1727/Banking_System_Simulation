-- Banking System Simulation Database Schema
-- Ensures financial data integrity, ACID consistency, and role-based models.

CREATE DATABASE IF NOT EXISTS banking_simulation;
USE banking_simulation;

-- Disable foreign key checks for clean tear down during re-runs
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users Table
-- Stores customer and administrative accounts
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_username (username),
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Accounts Table
-- Represents simulated bank accounts owned by users
-- Financial precision is preserved with DECIMAL(15, 2)
CREATE TABLE accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_number VARCHAR(20) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    account_type ENUM('CHECKING', 'SAVINGS') NOT NULL DEFAULT 'CHECKING',
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status ENUM('ACTIVE', 'FROZEN', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_balance_non_negative CHECK (balance >= 0.00),
    INDEX idx_accounts_user (user_id),
    INDEX idx_accounts_number (account_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Transactions Table (The Financial Ledger)
-- Double-entry-capable ledger tracking simulated movements
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reference_id VARCHAR(36) NOT NULL UNIQUE,
    source_account_id INT NULL,
    destination_account_id INT NULL,
    transaction_type ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status ENUM('COMPLETED', 'FAILED', 'PENDING') NOT NULL DEFAULT 'COMPLETED',
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (destination_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    CONSTRAINT chk_amount_positive CHECK (amount > 0.00),
    INDEX idx_transactions_source (source_account_id),
    INDEX idx_transactions_destination (destination_account_id),
    INDEX idx_transactions_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Audit Logs Table
-- Immutable log of privileged actions executed by Administrators
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NULL,
    action VARCHAR(100) NOT NULL,
    target_account_id INT NULL,
    details TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_admin (admin_id),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
