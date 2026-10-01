const express = require('express');
const router = express.Router();
const { deposit, withdraw, transfer, getTransactionHistory } = require('../controllers/transactionController');
const { authenticateToken, authorizeRoles } = require('../middlewares/authMiddleware');

// All transaction operations require authentication
router.use(authenticateToken);

// Simulated Banking Operations
router.post('/deposit', authorizeRoles('customer', 'admin'), deposit);
router.post('/withdraw', authorizeRoles('customer', 'admin'), withdraw);
router.post('/transfer', authorizeRoles('customer', 'admin'), transfer);
router.get('/history', authorizeRoles('customer', 'admin'), getTransactionHistory);

module.exports = router;
