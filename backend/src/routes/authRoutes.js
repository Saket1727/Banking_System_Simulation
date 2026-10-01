const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { validateRegistration, validateLogin } = require('../middlewares/validationMiddleware');

// Public authentication routes
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);

// Authenticated user profile
router.get('/me', authenticateToken, getMe);

// Role-Based Access Control verification routes
router.get('/customer-area', authenticateToken, authorizeRoles('customer'), (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to the Customer Portal.',
        user: req.user
    });
});

router.get('/admin-area', authenticateToken, authorizeRoles('admin'), (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to the Admin Command Center.',
        user: req.user
    });
});

module.exports = router;
