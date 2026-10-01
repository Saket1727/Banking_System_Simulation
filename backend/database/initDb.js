const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function initDatabase() {
    console.log('[InitDB] Connecting to MySQL server...');
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT, 10) || 3306;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';

    // Step 1: Connect to server without database to run DDL
    const connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        multipleStatements: true
    });

    try {
        console.log('[InitDB] Reading schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('[InitDB] Executing schema.sql...');
        await connection.query(schemaSql);
        console.log('[InitDB] Database and tables created successfully.');

        console.log('[InitDB] Reading seed.sql...');
        const seedPath = path.join(__dirname, 'seed.sql');
        const seedSql = fs.readFileSync(seedPath, 'utf8');

        console.log('[InitDB] Executing seed.sql...');
        await connection.query(seedSql);
        console.log('[InitDB] Seed data inserted successfully.');

        console.log('[InitDB] Database initialization complete!');
    } catch (error) {
        console.error('[InitDB] Initialization failed:', error);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

initDatabase();
