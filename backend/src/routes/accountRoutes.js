const express = require('express');
const router = express.Router();
const { getMyAccounts, getAccountDetails } = require('../controllers/accountController');
const { authenticateToken, authorizeRoles } = require('../middlewares/authMiddleware');

// All account routes require authentication
router.use(authenticateToken);

// Customer and Admin can retrieve user accounts
router.get('/my-accounts', authorizeRoles('customer', 'admin'), getMyAccounts);
router.get('/:id', authorizeRoles('customer', 'admin'), getAccountDetails);

module.exports = router;
