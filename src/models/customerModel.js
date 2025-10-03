import pool from '../../database.js';

export const createAccount = async ({
    customer_id,
    balance,
    active_status,
    plan_id,
    last_transaction_time = null,
    last_transaction_id = null
}) => {
    const client = await pool.connect();
    try {
        const numericBalance = Number(balance);
        if (Number.isNaN(numericBalance)) {
            throw new Error("Invalid balance value");
        }

        // Start transaction
        await client.query('BEGIN');

        // 1) Get customer DOB (and optionally ensure customer exists)
        const customerRes = await client.query(
            'SELECT DOB FROM customers WHERE customer_id = $1',
            [customer_id]
        );
        if (customerRes.rowCount === 0) {
            throw new Error(`Customer not found with ID ${customer_id}`);
        }

        const dob = new Date(customerRes.rows[0].dob);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        if (
            today.getMonth() < dob.getMonth() ||
            (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
        ) {
            age--;
        }

        // 2) Get plan info
        const planRes = await client.query(
            'SELECT plan_id, min_balance, min_age, max_age FROM savings_plans WHERE plan_id = $1',
            [plan_id]
        );

        if (planRes.rowCount === 0) {
            throw new Error(`Plan not found for plan_id=${plan_id}`);
        }

        const plan = planRes.rows[0];
        const minBalance = Number(plan.min_balance);
        const minAge = Number(plan.min_age);
        const maxAge = plan.max_age ? Number(plan.max_age) : null;

        // 3) Validate balance and age
        if (numericBalance < minBalance) {
            throw new Error(`Insufficient balance. Minimum required is ${minBalance}`);
        }

        if (age < minAge || (maxAge && age > maxAge)) {
            throw new Error(`Customer age ${age} does not fit plan age limits (${minAge} - ${maxAge ?? '∞'})`);
        }

        // 4) Insert into accounts and get account_no
        const insertAccountQ = `
      INSERT INTO accounts
        (created_date, balance, active_status, last_transaction_time, last_transaction_id)
      VALUES (NOW(), $1, $2, $3, $4)
      RETURNING account_no
    `;

        const insertAccountRes = await client.query(insertAccountQ, [
            numericBalance,
            active_status,
            last_transaction_time,
            last_transaction_id
        ]);

        const accountNo = insertAccountRes.rows[0].account_no;
        if (!accountNo) {
            throw new Error('Failed to create account (no account_no returned)');
        }

        // 5) Insert into savings_accounts linking the account to the customer and plan
        // Note: adjust table/column names/types if your DB uses different names
        const insertSavingsLinkQ = `
      INSERT INTO savings_accounts (account_no, customer_id, plan_id)
      VALUES ($1, $2, $3)
    `;

        await client.query(insertSavingsLinkQ, [accountNo, customer_id, plan_id]);

        // commit the whole transaction
        await client.query('COMMIT');

        return accountNo;
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (e) { /* ignore rollback errors */ }
        throw err;
    } finally {
        client.release();
    }
};
