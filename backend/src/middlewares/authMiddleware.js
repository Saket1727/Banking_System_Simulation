const { verifyJwt } = require('../utils/token');

/**
 * Middleware: Authenticates incoming request using JWT Bearer token
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access denied. No authentication token provided.'
        });
    }

    try {
        const decoded = verifyJwt(token);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired token.'
        });
    }
}

/**
 * Middleware factory: Enforces Role-Based Access Control (RBAC)
 * @param {...string} allowedRoles - Roles allowed to access the route
 */
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required prior to authorization.'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
            });
        }

        next();
    };
}

module.exports = {
    authenticateToken,
    authorizeRoles
};
