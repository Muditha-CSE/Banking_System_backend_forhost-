// db.js
import pkg from 'pg';
const { Pool } = pkg;

// Create a pool of connections
const pool = new Pool({
    user: 'muditha',           // your PostgreSQL username
    host: 'localhost',         // usually localhost
    database: 'banking_db',    // the database you want to connect
    password: 'Muditha21250@pcc',  // the password for your user
    port: 5432,                // default PostgreSQL port
    max: 20,                   // max number of connections in pool
    idleTimeoutMillis: 30000,  // close idle clients after 30s
    connectionTimeoutMillis: 2000 // timeout for acquiring a client
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
