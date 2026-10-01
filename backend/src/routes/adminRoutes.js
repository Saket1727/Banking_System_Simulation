const express = require('express');
const router = express.Router();
const {
    getAllUsers,
    getAllAccounts,
    createAccountForCustomer,
    updateAccountStatus,
    getAuditLogs
} = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Enforce authentication AND admin role for every route in this router
router.use(authenticateToken, authorizeRoles('admin'));

// Admin Management Endpoints
router.get('/users', getAllUsers);
router.get('/accounts', getAllAccounts);
router.post('/accounts', createAccountForCustomer);
router.patch('/accounts/:id/status', updateAccountStatus);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
