/**
 * Validates registration payload
 */
function validateRegistration(req, res, next) {
    const { username, email, password, fullName } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return res.status(400).json({
            success: false,
            error: 'Username must be at least 3 characters long.'
        });
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username.trim())) {
        return res.status(400).json({
            success: false,
            error: 'Username can only contain alphanumeric characters and underscores.'
        });
    }

    if (!email || typeof email !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'A valid email address is required.'
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
            success: false,
            error: 'Please provide a valid email format (e.g. user@example.com).'
        });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({
            success: false,
            error: 'Password must be at least 8 characters long.'
        });
    }

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
        return res.status(400).json({
            success: false,
            error: 'Full name must be at least 2 characters long.'
        });
    }

    next();
}

/**
 * Validates login payload
 */
function validateLogin(req, res, next) {
    const { identifier, username, email, password } = req.body;
    const loginUser = identifier || username || email;

    if (!loginUser || typeof loginUser !== 'string' || !loginUser.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Username or email is required.'
        });
    }

    if (!password || typeof password !== 'string' || !password) {
        return res.status(400).json({
            success: false,
            error: 'Password is required.'
        });
    }

    req.body.loginUser = loginUser.trim();
    next();
}

module.exports = {
    validateRegistration,
    validateLogin
};
