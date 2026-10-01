const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_banking_sim_2026_secure';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Signs a JWT with standard user claims
 * @param {Object} user - User object from database
 * @returns {string} - Signed JWT token
 */
function generateToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
}

/**
 * Synchronously verifies a JWT token
 * @param {string} token 
 * @returns {Object} decoded payload
 */
function verifyJwt(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = {
    generateToken,
    verifyJwt
};
