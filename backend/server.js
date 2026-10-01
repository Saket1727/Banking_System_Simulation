const app = require('./src/app');
const { testConnection } = require('./src/config/db');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 5001;

async function startServer() {
    try {
        // Verify database connectivity prior to accepting incoming traffic
        await testConnection();

        app.listen(PORT, () => {
            console.log(`====================================================`);
            console.log(`🏦 Banking System Simulation API is running!`);
            console.log(`🌐 Server Port   : ${PORT}`);
            console.log(`🔒 Mode          : ${process.env.NODE_ENV || 'development'}`);
            console.log(`⚠️  Disclaimer    : Strictly educational simulated system.`);
            console.log(`====================================================`);
        });
    } catch (error) {
        console.error('Fatal: Failed to connect to MySQL database during startup.', error.message);
        process.exit(1);
    }
}

startServer();
