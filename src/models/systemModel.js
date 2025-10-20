import pool from '../../database.js';

const SYSTEM_USER_ID = 0;

export const calculateMonthlyInterest = async () => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM calculate_monthly_interest');
        const data = result.rows[0];
        
        if (data.run_status === 'FAILED') {
            throw new Error(data.message);
        }
        
        return data;
    } catch (err) {
        throw err;
    } finally {
        client.release();
    }
};

export const fdInterestPayment = async () => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM calculate_fd_interest');
        const data = result.rows[0];
        
        if (data.run_status === 'FAILED') {
            throw new Error(data.message);
        }
        
        return data;
    } catch (err) {
        throw err;
    } finally {
        client.release();
    }
};

export const removeFDAfterMaturity = async () => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM remove_fd_after_maturity()');
        // Filter out skipped rows
        const maturedFDs = result.rows.filter(row => row.status === 'SUCCESS');
        return maturedFDs.length;
    } catch (err) {
        throw err;
    } finally {
        client.release();
    }
};

export const logSystemActivity = async (client, activity_type, description, performed_by) => {
    await client.query(
        'INSERT INTO systemLogs (activity_type, description, performed_by) VALUES ($1, $2, $3)',
        [activity_type, description, performed_by]
    );
};