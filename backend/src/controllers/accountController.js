const { pool } = require('../config/db');

/**
 * Fetch all simulated accounts owned by the authenticated customer
 */
async function getMyAccounts(req, res, next) {
    try {
        const userId = req.user.id;

        const [accounts] = await pool.query(
            `SELECT id, account_number, account_type, balance, status, created_at, updated_at
             FROM accounts
             WHERE user_id = ?
             ORDER BY id ASC`,
            [userId]
        );

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
 * Fetch specific account details owned by the authenticated customer
 */
async function getAccountDetails(req, res, next) {
    try {
        const userId = req.user.id;
        const accountId = parseInt(req.params.id, 10);

        if (isNaN(accountId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid account ID parameter.'
            });
        }

        // If admin, allow viewing any account; if customer, enforce ownership
        const query = req.user.role === 'admin'
            ? `SELECT a.*, u.username, u.email, u.full_name
               FROM accounts a
               JOIN users u ON a.user_id = u.id
               WHERE a.id = ? LIMIT 1`
            : `SELECT * FROM accounts WHERE id = ? AND user_id = ? LIMIT 1`;

        const params = req.user.role === 'admin' ? [accountId] : [accountId, userId];

        const [rows] = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Account not found or access unauthorized.'
            });
        }

        return res.status(200).json({
            success: true,
            account: rows[0]
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getMyAccounts,
    getAccountDetails
};
