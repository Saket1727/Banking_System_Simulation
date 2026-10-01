const crypto = require('crypto');
const { pool } = require('../config/db');

/**
 * Generate a unique, professional transaction reference ID
 * @param {string} prefix 
 */
function generateReference(prefix = 'TXN') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-${timestamp}-${randomHex}`;
}

/**
 * Simulate cash/check deposit into a bank account
 */
async function deposit(req, res, next) {
    const { accountId, amount, description } = req.body;
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Deposit amount must be a positive number greater than 0.'
        });
    }

    if (numAmount > 100000) {
        return res.status(400).json({
            success: false,
            error: 'Single simulated deposit exceeds the maximum allowed limit of $100,000.00.'
        });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Lock target account row for ACID update
        const [accounts] = await connection.query(
            'SELECT id, user_id, account_number, balance, status FROM accounts WHERE id = ? FOR UPDATE',
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

        // Ensure user owns this account (or is admin)
        if (req.user.role !== 'admin' && account.user_id !== req.user.id) {
            await connection.rollback();
            return res.status(403).json({
                success: false,
                error: 'Unauthorized. You cannot deposit into an account you do not own.'
            });
        }

        if (account.status !== 'ACTIVE') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: `Simulated deposit rejected. Account is currently ${account.status}.`
            });
        }

        // Credit balance
        const newBalance = (parseFloat(account.balance) + numAmount).toFixed(2);
        await connection.query(
            'UPDATE accounts SET balance = ? WHERE id = ?',
            [newBalance, account.id]
        );

        // Record in ledger
        const referenceId = generateReference('DEP');
        const desc = description ? description.trim() : 'Simulated cash deposit';

        const [txResult] = await connection.query(
            `INSERT INTO transactions (reference_id, source_account_id, destination_account_id, transaction_type, amount, status, description)
             VALUES (?, NULL, ?, 'DEPOSIT', ?, 'COMPLETED', ?)`,
            [referenceId, account.id, numAmount.toFixed(2), desc]
        );

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: `Successfully deposited $${numAmount.toFixed(2)} into account ${account.account_number}.`,
            transaction: {
                id: txResult.insertId,
                referenceId,
                type: 'DEPOSIT',
                amount: numAmount,
                destinationAccount: account.account_number,
                status: 'COMPLETED',
                description: desc
            },
            newBalance: parseFloat(newBalance)
        });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
}

/**
 * Simulate cash withdrawal from a bank account
 */
async function withdraw(req, res, next) {
    const { accountId, amount, description } = req.body;
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Withdrawal amount must be a positive number greater than 0.'
        });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Lock row to prevent race conditions during concurrent withdrawal attempts
        const [accounts] = await connection.query(
            'SELECT id, user_id, account_number, balance, status FROM accounts WHERE id = ? FOR UPDATE',
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

        // Ensure user owns this account
        if (req.user.role !== 'admin' && account.user_id !== req.user.id) {
            await connection.rollback();
            return res.status(403).json({
                success: false,
                error: 'Unauthorized. You cannot withdraw from an account you do not own.'
            });
        }

        if (account.status !== 'ACTIVE') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: `Simulated withdrawal rejected. Account is currently ${account.status}.`
            });
        }

        const currentBalance = parseFloat(account.balance);
        if (currentBalance < numAmount) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: `Insufficient funds. Available balance is $${currentBalance.toFixed(2)}, attempted withdrawal is $${numAmount.toFixed(2)}.`
            });
        }

        // Debit balance
        const newBalance = (currentBalance - numAmount).toFixed(2);
        await connection.query(
            'UPDATE accounts SET balance = ? WHERE id = ?',
            [newBalance, account.id]
        );

        // Record in ledger
        const referenceId = generateReference('WTH');
        const desc = description ? description.trim() : 'Simulated ATM/Branch withdrawal';

        const [txResult] = await connection.query(
            `INSERT INTO transactions (reference_id, source_account_id, destination_account_id, transaction_type, amount, status, description)
             VALUES (?, ?, NULL, 'WITHDRAWAL', ?, 'COMPLETED', ?)`,
            [referenceId, account.id, numAmount.toFixed(2), desc]
        );

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: `Successfully withdrew $${numAmount.toFixed(2)} from account ${account.account_number}.`,
            transaction: {
                id: txResult.insertId,
                referenceId,
                type: 'WITHDRAWAL',
                amount: numAmount,
                sourceAccount: account.account_number,
                status: 'COMPLETED',
                description: desc
            },
            newBalance: parseFloat(newBalance)
        });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
}

/**
 * Simulate inter-account fund transfer
 * Employs deterministic lock acquisition ordering to avoid database deadlocks.
 */
async function transfer(req, res, next) {
    const { sourceAccountId, destinationAccountNumber, amount, description } = req.body;
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Transfer amount must be a positive number greater than 0.'
        });
    }

    if (!destinationAccountNumber || typeof destinationAccountNumber !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Destination account number is required.'
        });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Fetch Source Account
        const [sourceRows] = await connection.query(
            'SELECT id, user_id, account_number, balance, status FROM accounts WHERE id = ?',
            [sourceAccountId]
        );

        if (sourceRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: 'Source account not found.'
            });
        }

        const sourceAccount = sourceRows[0];

        // Enforce ownership
        if (req.user.role !== 'admin' && sourceAccount.user_id !== req.user.id) {
            await connection.rollback();
            return res.status(403).json({
                success: false,
                error: 'Unauthorized. You cannot transfer from an account you do not own.'
            });
        }

        // 2. Fetch Destination Account
        const [destRows] = await connection.query(
            'SELECT id, user_id, account_number, balance, status FROM accounts WHERE account_number = ?',
            [destinationAccountNumber.trim()]
        );

        if (destRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: `Destination account '${destinationAccountNumber.trim()}' was not found.`
            });
        }

        const destAccount = destRows[0];

        // 3. Self-transfer check
        if (sourceAccount.id === destAccount.id) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: 'Cannot transfer funds to the exact same account.'
            });
        }

        // 4. DEADLOCK PREVENTION STRATEGY:
        // Lock both account rows in ascending ID order (SELECT ... FOR UPDATE)
        const firstId = Math.min(sourceAccount.id, destAccount.id);
        const secondId = Math.max(sourceAccount.id, destAccount.id);

        const [lockedRows] = await connection.query(
            'SELECT id, balance, status FROM accounts WHERE id IN (?, ?) ORDER BY id ASC FOR UPDATE',
            [firstId, secondId]
        );

        const lockedSource = lockedRows.find(r => r.id === sourceAccount.id);
        const lockedDest = lockedRows.find(r => r.id === destAccount.id);

        // 5. Account Status Validations
        if (lockedSource.status !== 'ACTIVE') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: `Transfer failed: Source account is ${lockedSource.status}.`
            });
        }

        if (lockedDest.status !== 'ACTIVE') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: `Transfer failed: Destination account is ${lockedDest.status} and cannot receive funds.`
            });
        }

        // 6. Sufficient Balance Check
        const sourceCurrentBalance = parseFloat(lockedSource.balance);
        if (sourceCurrentBalance < numAmount) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: `Insufficient balance for transfer. Available: $${sourceCurrentBalance.toFixed(2)}, required: $${numAmount.toFixed(2)}.`
            });
        }

        // 7. Atomic Balance Updates
        const sourceNewBalance = (sourceCurrentBalance - numAmount).toFixed(2);
        const destNewBalance = (parseFloat(lockedDest.balance) + numAmount).toFixed(2);

        await connection.query('UPDATE accounts SET balance = ? WHERE id = ?', [sourceNewBalance, sourceAccount.id]);
        await connection.query('UPDATE accounts SET balance = ? WHERE id = ?', [destNewBalance, destAccount.id]);

        // 8. Ledger Recording
        const referenceId = generateReference('TRF');
        const desc = description ? description.trim() : `Transfer to ${destAccount.account_number}`;

        const [txResult] = await connection.query(
            `INSERT INTO transactions (reference_id, source_account_id, destination_account_id, transaction_type, amount, status, description)
             VALUES (?, ?, ?, 'TRANSFER', ?, 'COMPLETED', ?)`,
            [referenceId, sourceAccount.id, destAccount.id, numAmount.toFixed(2), desc]
        );

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: `Successfully transferred $${numAmount.toFixed(2)} to ${destAccount.account_number}.`,
            transaction: {
                id: txResult.insertId,
                referenceId,
                type: 'TRANSFER',
                amount: numAmount,
                sourceAccount: sourceAccount.account_number,
                destinationAccount: destAccount.account_number,
                status: 'COMPLETED',
                description: desc
            },
            sourceNewBalance: parseFloat(sourceNewBalance)
        });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
}

/**
 * Fetch transaction history for user accounts with pagination and filters
 */
async function getTransactionHistory(req, res, next) {
    try {
        const userId = req.user.id;
        const { accountId, type, limit = 20, offset = 0 } = req.query;

        const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

        let whereClauses = [];
        let params = [];

        if (req.user.role === 'admin') {
            // Admin can see everything or filter by specific accountId
            if (accountId) {
                whereClauses.push('(t.source_account_id = ? OR t.destination_account_id = ?)');
                params.push(accountId, accountId);
            }
        } else {
            // Customer can ONLY see transactions involving their own accounts
            const [userAccounts] = await pool.query('SELECT id FROM accounts WHERE user_id = ?', [userId]);
            const userAccountIds = userAccounts.map(a => a.id);

            if (userAccountIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    transactions: [],
                    pagination: { total: 0, limit: parsedLimit, offset: parsedOffset }
                });
            }

            if (accountId) {
                const targetId = parseInt(accountId, 10);
                if (!userAccountIds.includes(targetId)) {
                    return res.status(403).json({
                        success: false,
                        error: 'Unauthorized to view transactions for this account.'
                    });
                }
                whereClauses.push('(t.source_account_id = ? OR t.destination_account_id = ?)');
                params.push(targetId, targetId);
            } else {
                whereClauses.push(`(t.source_account_id IN (${userAccountIds.join(',')}) OR t.destination_account_id IN (${userAccountIds.join(',')}))`);
            }
        }

        if (type && ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'].includes(type.toUpperCase())) {
            whereClauses.push('t.transaction_type = ?');
            params.push(type.toUpperCase());
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Count total matching transactions for pagination
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM transactions t ${whereSql}`,
            params
        );
        const total = countResult[0].total;

        // Fetch paginated transactions with source and destination account metadata
        const query = `
            SELECT 
                t.id,
                t.reference_id,
                t.transaction_type,
                t.amount,
                t.status,
                t.description,
                t.created_at,
                src.account_number AS source_account_number,
                dest.account_number AS destination_account_number
            FROM transactions t
            LEFT JOIN accounts src ON t.source_account_id = src.id
            LEFT JOIN accounts dest ON t.destination_account_id = dest.id
            ${whereSql}
            ORDER BY t.created_at DESC, t.id DESC
            LIMIT ? OFFSET ?
        `;

        const [transactions] = await pool.query(query, [...params, parsedLimit, parsedOffset]);

        return res.status(200).json({
            success: true,
            transactions,
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
    deposit,
    withdraw,
    transfer,
    getTransactionHistory
};
