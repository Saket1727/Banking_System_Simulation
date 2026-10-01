const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateToken } = require('../utils/token');

/**
 * Public Customer Registration
 * Enforces role = 'customer' strictly. Public users can NEVER register as admin.
 */
async function register(req, res, next) {
    const { username, email, password, fullName } = req.body;
    
    // SECURITY ENFORCEMENT:
    // Disregard any client-provided role. Public registrations are strictly 'customer'.
    const enforcedRole = 'customer';

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check if username or email already exists
        const [existing] = await connection.query(
            'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
            [username.trim(), email.trim().toLowerCase()]
        );

        if (existing.length > 0) {
            const conflictField = existing[0].username === username.trim() ? 'Username' : 'Email';
            await connection.rollback();
            return res.status(409).json({
                success: false,
                error: `${conflictField} is already registered.`
            });
        }

        // Hash the password with bcrypt (10 salt rounds)
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert new customer record
        const [userResult] = await connection.query(
            `INSERT INTO users (username, email, password_hash, full_name, role)
             VALUES (?, ?, ?, ?, ?)`,
            [username.trim(), email.trim().toLowerCase(), passwordHash, fullName.trim(), enforcedRole]
        );

        const newUserId = userResult.insertId;

        // Automatically provision an initial simulated Checking account for convenience
        // Format: ACC- + 4-digit unique random padding
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const accountNumber = `ACC-${newUserId}${randomSuffix}`;
        const initialBalance = 1000.00; // Simulated demo starting balance

        const [accountResult] = await connection.query(
            `INSERT INTO accounts (account_number, user_id, account_type, balance, status)
             VALUES (?, ?, 'CHECKING', ?, 'ACTIVE')`,
            [accountNumber, newUserId, initialBalance]
        );

        const newAccountId = accountResult.insertId;

        // Record initial ledger transaction for the starting simulated balance
        const initialRef = `TXN-WELCOME-${Date.now().toString(36).toUpperCase()}`;
        await connection.query(
            `INSERT INTO transactions (reference_id, source_account_id, destination_account_id, transaction_type, amount, status, description)
             VALUES (?, NULL, ?, 'DEPOSIT', ?, 'COMPLETED', 'Initial simulated demo balance credit')`,
            [initialRef, newAccountId, initialBalance]
        );

        await connection.commit();

        const userPayload = {
            id: newUserId,
            username: username.trim(),
            email: email.trim().toLowerCase(),
            fullName: fullName.trim(),
            role: enforcedRole
        };

        const token = generateToken(userPayload);

        return res.status(201).json({
            success: true,
            message: 'Customer account created successfully.',
            token,
            user: userPayload,
            initialAccount: {
                accountNumber,
                balance: initialBalance,
                status: 'ACTIVE'
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
 * User Login (supports customers and administrators)
 */
async function login(req, res, next) {
    const { loginUser, password } = req.body;

    try {
        // Query user by username or email
        const [rows] = await pool.query(
            'SELECT id, username, email, password_hash, full_name, role FROM users WHERE username = ? OR email = ? LIMIT 1',
            [loginUser, loginUser.toLowerCase()]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username/email or password.'
            });
        }

        const user = rows[0];

        // Compare password hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username/email or password.'
            });
        }

        const userPayload = {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            role: user.role
        };

        const token = generateToken(userPayload);

        return res.status(200).json({
            success: true,
            message: 'Authentication successful.',
            token,
            user: userPayload
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Fetch profile of currently authenticated user
 */
async function getMe(req, res, next) {
    try {
        const [rows] = await pool.query(
            'SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ? LIMIT 1',
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User profile not found.'
            });
        }

        const user = rows[0];

        return res.status(200).json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    register,
    login,
    getMe
};
