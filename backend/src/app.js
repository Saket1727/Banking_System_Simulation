const express = require('express');
const cors = require('cors');

const app = express();

// Security and Cross-Origin Resource Sharing
// Security and Cross-Origin Resource Sharing
const configuredClientUrl = process.env.CLIENT_URL;

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server healthchecks)
        if (!origin) return callback(null, true);

        // Allow configured CLIENT_URL, local dev ports, or Vercel preview domains
        const isAllowedLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
        const isConfiguredUrl = configuredClientUrl && origin === configuredClientUrl;
        const isVercelDomain = origin.endsWith('.vercel.app');

        if (isAllowedLocal || isConfiguredUrl || isVercelDomain) {
            callback(null, true);
        } else {
            callback(new Error(`Blocked by CORS policy for origin: ${origin}`));
        }
    },
    credentials: true
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simulation Disclaimer Header
app.use((req, res, next) => {
    res.setHeader('X-Simulation-Mode', 'Educational-Simulation-Only');
    next();
});

// Health & System Info Endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        mode: 'SIMULATION_ONLY',
        disclaimer: 'This application is a strictly educational banking simulation. No real funds, banks, or external payment gateways are involved.',
        timestamp: new Date().toISOString()
    });
});

// Routes
const authRoutes = require('./routes/authRoutes');
const accountRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);

// 404 Route Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.originalUrl} not found.`
    });
});

// Centralized Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Unhandled Error]', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

module.exports = app;
