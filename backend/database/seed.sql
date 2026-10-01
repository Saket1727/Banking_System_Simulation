-- Banking System Simulation Seed Data
-- Provides demo users, initial simulated accounts, and ledger entries for testing

USE banking_simulation;

-- Insert Users
-- Passwords:
-- Admin: Admin@12345
-- Customers: Customer@12345
INSERT INTO users (id, username, email, password_hash, full_name, role) VALUES
(1, 'admin', 'admin@banksim.local', '$2a$10$NG9V5y2M8Wi1DTjJXysRFuJ4m8.Rc2BJwBoKoHvi2VN9fv1O8WnVa', 'System Administrator', 'admin'),
(2, 'john_doe', 'john@example.com', '$2a$10$r21WnUdYB951mWvWGVfJCOS5aaqQrlPRcFeqJazvgcYF7lhNVoMGG', 'John Doe', 'customer'),
(3, 'jane_smith', 'jane@example.com', '$2a$10$r21WnUdYB951mWvWGVfJCOS5aaqQrlPRcFeqJazvgcYF7lhNVoMGG', 'Jane Smith', 'customer');

-- Insert Accounts
INSERT INTO accounts (id, account_number, user_id, account_type, balance, status) VALUES
(1, 'ACC-1001', 2, 'CHECKING', 5000.00, 'ACTIVE'),
(2, 'ACC-1002', 2, 'SAVINGS', 12500.00, 'ACTIVE'),
(3, 'ACC-2001', 3, 'CHECKING', 3200.00, 'ACTIVE');

-- Insert Initial Transactions (Simulation audit trail)
INSERT INTO transactions (id, reference_id, source_account_id, destination_account_id, transaction_type, amount, status, description) VALUES
(1, 'TXN-INIT-0001', NULL, 1, 'DEPOSIT', 5000.00, 'COMPLETED', 'Initial simulated demo deposit'),
(2, 'TXN-INIT-0002', NULL, 2, 'DEPOSIT', 12500.00, 'COMPLETED', 'Initial simulated savings deposit'),
(3, 'TXN-INIT-0003', NULL, 3, 'DEPOSIT', 3200.00, 'COMPLETED', 'Initial simulated demo deposit');

-- Insert Audit Log for account creation
INSERT INTO audit_logs (id, admin_id, action, target_account_id, details) VALUES
(1, 1, 'SYSTEM_INITIALIZATION', NULL, 'Initialized demonstration accounts and seed balances');
