const crypto = require('crypto');
const { pool } = require('../config/db');

/**
 * Fetch all registered users in the simulation
 */
async function getAllUsers(req, res, next) {
    try {
        const { role } = req.query;
        let query = `
            SELECT 
                u.id, 
                u.username, 
                u.email, 
                u.full_name, 
                u.role, 
                u.created_at,
                COUNT(a.id) AS account_count,
                COALESCE(SUM(a.balance), 0.00) AS total_simulated_balance
            FROM users u
            LEFT JOIN accounts a ON u.id = a.user_id
        `;
        const params = [];

        if (role) {
            query += ' WHERE u.role = ?';
            params.push(role);
        }

        query += ' GROUP BY u.id ORDER BY u.id ASC';

        const [users] = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Fetch all system accounts across all customers
 */
async function getAllAccounts(req, res, next) {
    try {
        const { status, type } = req.query;
        let whereClauses = [];
        let params = [];

        if (status) {
            whereClauses.push('a.status = ?');
            params.push(status.toUpperCase());
        }

        if (type) {
            whereClauses.push('a.account_type = ?');
            params.push(type.toUpperCase());
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT 
                a.id,
                a.account_number,
                a.user_id,
                a.account_type,
                a.balance,
                a.status,
                a.created_at,
                a.updated_at,
                u.username,
                u.email,
                u.full_name
            FROM accounts a
            JOIN users u ON a.user_id = u.id
            ${whereSql}
            ORDER BY a.id ASC
        `;

        const [accounts] = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            count: accounts.length,
            accounts
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Admin action: Provision a new bank account for an existing customer
 */
async function createAccountForCustomer(req, res, next) {
    const { userId, accountType = 'CHECKING', initialBalance = 0.00 } = req.body;
    const numBalance = parseFloat(initialBalance) || 0.00;

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'Target customer userId is required.'
        });
    }

    const normalizedType = accountType.toUpperCase();
    if (!['CHECKING', 'SAVINGS'].includes(normalizedType)) {
        return res.status(400).json({
            success: false,
            error: "Account type must be either 'CHECKING' or 'SAVINGS'."
        });
    }

    if (numBalance < 0) {
        return res.status(400).json({
            success: false,
            error: 'Initial balance cannot be negative.'
        });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check if customer exists
        const [users] = await connection.query(
            'SELECT id, username, full_name, role FROM users WHERE id = ? LIMIT 1',
            [userId]
        );

        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: `User with ID ${userId} does not exist.`
            });
        }

        const targetUser = users[0];

        // Generate unique account number
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const accountNumber = `ACC-${targetUser.id}${randomSuffix}`;

        // Insert new account
        const [accResult] = await connection.query(
            `INSERT INTO accounts (account_number, user_id, account_type, balance, status)
             VALUES (?, ?, ?, ?, 'ACTIVE')`,
            [accountNumber, targetUser.id, normalizedType, numBalance.toFixed(2)]
        );

        const newAccountId = accResult.insertId;

        // If funded with an initial balance, log transaction
        if (numBalance > 0) {
            const refId = `TXN-OPEN-${Date.now().toString(36).toUpperCase()}`;
            await connection.query(
                `INSERT INTO transactions (reference_id, source_account_id, destination_account_id, transaction_type, amount, status, description)
                 VALUES (?, NULL, ?, 'DEPOSIT', ?, 'COMPLETED', 'Initial account opening simulated balance')`,
                [refId, newAccountId, numBalance.toFixed(2)]
            );
        }

        // Record privileged action in audit_logs
        await connection.query(
            `INSERT INTO audit_logs (admin_id, action, target_account_id, details)
             VALUES (?, 'ACCOUNT_CREATED', ?, ?)`,
            [
                req.user.id,
                newAccountId,
                `Admin ${req.user.username} created a new ${normalizedType} account (${accountNumber}) for customer ${targetUser.username} with initial balance $${numBalance.toFixed(2)}.`
            ]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: `New ${normalizedType} account created successfully for customer ${targetUser.username}.`,
            account: {
                id: newAccountId,
                accountNumber,
                accountType: normalizedType,
                balance: numBalance,
                status: 'ACTIVE',
                userId: targetUser.id,
                ownerName: targetUser.full_name
            }
        });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
}

/**
 * Admin action: Manage account status (FREEZE, UNFREEZE, CLOSE)
 * Enforces business invariants:
 * 1. An account can only be closed if its balance is strictly 0.00.
 * 2. A CLOSED account cannot be reopened or unfrozen (terminal state).
 */
async function updateAccountStatus(req, res, next) {
    const accountId = parseInt(req.params.id, 10);
    const { status, reason } = req.body;

    if (isNaN(accountId)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid account ID parameter.'
        });
    }

    if (!status || !['ACTIVE', 'FROZEN', 'CLOSED'].includes(status.toUpperCase())) {
        return res.status(400).json({
            success: false,
            error: "Status must be one of: 'ACTIVE', 'FROZEN', or 'CLOSED'."
        });
    }

    const targetStatus = status.toUpperCase();

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Lock row to evaluate status state transition
        const [accounts] = await connection.query(
            'SELECT id, account_number, balance, status, user_id FROM accounts WHERE id = ? FOR UPDATE',
            [accountId]
        );

        if (accounts.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: 'Account not found.'
            });
        }

        const account = accounts[0];
        const currentStatus = account.status;
        const currentBalance = parseFloat(account.balance);

        // Rule 1: No-op transition
        if (currentStatus === targetStatus) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: `Account ${account.account_number} is already ${targetStatus}.`
            });
        }

        // Rule 2: CLOSED is a terminal state
        if (currentStatus === 'CLOSED') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: `Account ${account.account_number} is permanently CLOSED and cannot be modified or reopened.`
            });
        }

        // Rule 3: Cannot close account if funds remain
        if (targetStatus === 'CLOSED' && currentBalance !== 0.00) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: `Cannot close account ${account.account_number}. Outstanding balance is $${currentBalance.toFixed(2)}. Account balance must be strictly $0.00 before closing.`
            });
        }

        // Apply status update
        await connection.query(
            'UPDATE accounts SET status = ? WHERE id = ?',
            [targetStatus, accountId]
        );

        // Log administrative action
        const actionName = targetStatus === 'FROZEN' ? 'ACCOUNT_FROZEN' :
                           targetStatus === 'ACTIVE' ? 'ACCOUNT_UNFROZEN' : 'ACCOUNT_CLOSED';

        const auditDetail = `Status changed from ${currentStatus} to ${targetStatus}. Reason: ${reason ? reason.trim() : 'Administrative review'}`;

        await connection.query(
            `INSERT INTO audit_logs (admin_id, action, target_account_id, details)
             VALUES (?, ?, ?, ?)`,
            [req.user.id, actionName, accountId, auditDetail]
        );

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: `Account ${account.account_number} status transitioned from ${currentStatus} to ${targetStatus}.`,
            account: {
                id: account.id,
                accountNumber: account.account_number,
                previousStatus: currentStatus,
                status: targetStatus,
                balance: currentBalance
            }
        });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
}

/**
 * Fetch immutable administrative audit logs
 */
async function getAuditLogs(req, res, next) {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 50, 100);
        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

        const [countResult] = await pool.query('SELECT COUNT(*) AS total FROM audit_logs');
        const total = countResult[0].total;

        const query = `
            SELECT 
                al.id,
                al.action,
                al.details,
                al.created_at,
                al.target_account_id,
                u.username AS admin_username,
                a.account_number AS target_account_number
            FROM audit_logs al
            LEFT JOIN users u ON al.admin_id = u.id
            LEFT JOIN accounts a ON al.target_account_id = a.id
            ORDER BY al.created_at DESC, al.id DESC
            LIMIT ? OFFSET ?
        `;

        const [logs] = await pool.query(query, [parsedLimit, parsedOffset]);

        return res.status(200).json({
            success: true,
            logs,
            pagination: {
                total,
                limit: parsedLimit,
                offset: parsedOffset
            }
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getAllUsers,
    getAllAccounts,
    createAccountForCustomer,
    updateAccountStatus,
    getAuditLogs
};
