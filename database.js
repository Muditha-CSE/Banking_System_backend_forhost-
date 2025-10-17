// db.js
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Create a pool of connections using environment variables
const pool = new Pool({
    user: process.env.DB_USER || 'muditha',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'banking_db',
    password: process.env.DB_PASSWORD || 'Muditha21250@pcc',
    port: parseInt(process.env.DB_PORT) || 5432,
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000
});

// Test the connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error acquiring client', err.stack);
    } else {
        console.log('Database connected successfully');
        release(); // release client back to pool
    }
});

export default pool;
