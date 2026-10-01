const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Create a connection pool for efficient resource reuse and concurrency
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'banking_simulation',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true // Return MySQL DECIMAL types as JavaScript numbers for clean calculations
});

/**
 * Verifies connectivity to the database
 */
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log(`[Database] Successfully connected to MySQL database: ${process.env.DB_NAME || 'banking_simulation'}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('[Database] Connection failed:', error.message);
        throw error;
    }
}

module.exports = {
    pool,
    testConnection
};
