import pool from './database.js';

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Database time:', res.rows[0]);
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    pool.end(); // close the pool
  }
}

testConnection();
