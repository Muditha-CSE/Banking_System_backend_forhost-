import pool from '../../database.js';

export const createSavingsAccount = async ({
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

        // 1) Get customer DOB (and optionally ensure customer exists)....
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

import pool from '../../database.js';

/**
 * Create a joint account:
 *  - validate plan (min_balance, min_age)
 *  - validate holders (existence, age)
 *  - insert into accounts -> get account_no
 *  - insert into joint_account (account_no, plan_id)
 *  - insert into acc_holders for each holder
 *
 * @param {Object} params
 * @param {number} params.balance
 * @param {boolean} params.active_status
 * @param {string} params.plan_id
 * @param {Array<{customer_id:number, role:string}>} params.holders
 * @param {string|null} params.last_transaction_time
 * @param {string|null} params.last_transaction_id
 *
 * @returns {Object} { accountNo, insertedHolders: [{customer_id, role}, ...] }
 */
export const createJointAccount = async ({
    balance,
    active_status,
    plan_id,
    holders = [],
    last_transaction_time = null,
    last_transaction_id = null
}) => {
    if (!Array.isArray(holders) || holders.length === 0) {
        throw new Error('holders must be a non-empty array');
    }

    const client = await pool.connect();
    try {
        // numeric conversions
        const numericBalance = Number(balance);
        if (Number.isNaN(numericBalance)) throw new Error('Invalid balance value');

        // begin transaction
        await client.query('BEGIN');

        // 1) load joint plan and its rules
        const planRes = await client.query(
            'SELECT plan_id, min_balance, min_age FROM joint_plans WHERE plan_id = $1',
            [plan_id]
        );
        if (planRes.rowCount === 0) throw new Error(`Plan not found for plan_id=${plan_id}`);
        const plan = planRes.rows[0];
        const minBalance = Number(plan.min_balance);
        const minAge = Number(plan.min_age);

        if (Number.isNaN(minBalance) || Number.isNaN(minAge)) {
            throw new Error('Invalid plan configuration (min_balance/min_age)');
        }

        // 2) validate overall balance against plan min_balance
        if (numericBalance < minBalance) {
            throw new Error(`Insufficient balance. Minimum required for this joint plan is ${minBalance}`);
        }

        // Helper to calculate age from DOB
        const calcAge = (dobVal) => {
            const dob = new Date(dobVal);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            if (
                today.getMonth() < dob.getMonth() ||
                (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
            ) {
                age--;
            }
            return age;
        };

        // Optional: ensure there's at least one primary holder in the input
        const hasPrimary = holders.some(h => String(h.role).toLowerCase() === 'primary');
        if (!hasPrimary) {
            throw new Error('At least one holder must have role "primary"');
        }

        // 3) Validate each holder: ensure customer exists and age >= minAge
        // Also check duplicates in supplied holders array
        const seenIds = new Set();
        for (const h of holders) {
            if (!h || typeof h.customer_id === 'undefined' || h.customer_id === null) {
                throw new Error('Each holder must include customer_id');
            }
            const cid = Number(h.customer_id);
            if (Number.isNaN(cid)) throw new Error(`Invalid customer_id: ${h.customer_id}`);
            if (seenIds.has(cid)) throw new Error(`Duplicate customer_id in holders list: ${cid}`);
            seenIds.add(cid);

            // fetch customer's DOB
            const custRes = await client.query(
                'SELECT customer_id, DOB FROM customers WHERE customer_id = $1',
                [cid]
            );
            if (custRes.rowCount === 0) throw new Error(`Customer not found with ID ${cid}`);
            const dobVal = custRes.rows[0].dob;
            const age = calcAge(dobVal);
            if (age < minAge) {
                throw new Error(`Customer ${cid} (age ${age}) does not meet plan minimum age ${minAge}`);
            }
            // NOTE: no upper age limit in joint_plans per your schema; add if needed
        }

        // 4) Insert into accounts and get account_no
        const insertAccountQ = `
      INSERT INTO accounts (created_date, balance, active_status, last_transaction_time, last_transaction_id)
      VALUES (NOW(), $1, $2, $3, $4)
      RETURNING account_no
    `;
        const insertAccountRes = await client.query(insertAccountQ, [
            numericBalance,
            active_status,
            last_transaction_time,
            last_transaction_id
        ]);
        if (insertAccountRes.rowCount === 0) {
            throw new Error('Failed to create account');
        }
        const accountNo = insertAccountRes.rows[0].account_no;

        // 5) Insert into joint_account (link account to plan)
        await client.query(
            'INSERT INTO joint_account (account_no, plan_id) VALUES ($1, $2)',
            [accountNo, plan_id]
        );

        // 6) Insert holders into acc_holders (prevent duplicates there too)
        const insertedHolders = [];
        for (const h of holders) {
            const cid = Number(h.customer_id);
            const role = String(h.role);

            // ensure not already a holder (in DB)
            const dupRes = await client.query(
                'SELECT 1 FROM acc_holders WHERE account_no = $1 AND customer_id = $2',
                [accountNo, cid]
            );
            if (dupRes.rowCount > 0) {
                throw new Error(`Customer ${cid} is already a holder for account ${accountNo}`);
            }

            await client.query(
                'INSERT INTO acc_holders (account_no, customer_id, role) VALUES ($1, $2, $3)',
                [accountNo, cid, role]
            );
            insertedHolders.push({ customer_id: cid, role });
        }

        // commit
        await client.query('COMMIT');
        return { accountNo, insertedHolders };
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) { }
        throw err;
    } finally {
        client.release();
    }
};
