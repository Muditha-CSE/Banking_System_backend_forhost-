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



export const createFixedDepositIfNone = async ({
    account_no,
    fd_plan_id,
    amount
}) => {
    const client = await pool.connect();
    try {
        const numericAmount = Number(amount);
        if (Number.isNaN(numericAmount) || numericAmount <= 0) {
            throw new Error('Invalid amount');
        }

        await client.query('BEGIN');

        // 1) ensure account exists
        const accRes = await client.query(
            'SELECT account_no FROM accounts WHERE account_no = $1',
            [account_no]
        );
        if (accRes.rowCount === 0) {
            throw new Error(`Account not found: ${account_no}`);
        }

        // 2) check for any active FD that uses this account
        // Active = end_date IS NULL OR end_date > NOW()
        const existingFd = await client.query(
            `SELECT fd_account_no 
       FROM fixed_deposit_account 
       WHERE account_no = $1 AND (end_date IS NULL OR end_date > NOW())
       LIMIT 1`,
            [account_no]
        );
        if (existingFd.rowCount > 0) {
            throw new Error(`An active fixed deposit already exists for account ${account_no}`);
        }

        // 3) load FD plan and months
        const planRes = await client.query(
            'SELECT fd_plan_id, months FROM fixed_deposit_plans WHERE fd_plan_id = $1',
            [fd_plan_id]
        );
        if (planRes.rowCount === 0) {
            throw new Error(`FD plan not found for id=${fd_plan_id}`);
        }
        const months = Number(planRes.rows[0].months);
        if (Number.isNaN(months) || months <= 0) {
            throw new Error('Invalid plan months value');
        }

        // 4) insert FD, compute end_date using SQL interval (DB time)
        const insertQ = `
      INSERT INTO fixed_deposit_account
        (account_no, fd_plan_id, amount, start_date, end_date)
      VALUES ($1, $2, $3, NOW(), NOW() + (INTERVAL '1 month' * $4))
      RETURNING fd_account_no, account_no, fd_plan_id, amount, start_date, end_date
    `;
        const insertRes = await client.query(insertQ, [
            account_no,
            fd_plan_id,
            numericAmount,
            months
        ]);

        await client.query('COMMIT');
        return insertRes.rows[0];
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) { }
        throw err;
    } finally {
        client.release();
    }
};

/**
 * Check if a customer has any accounts
 * @param {Object} pool - Database connection pool
 * @param {string} nic - Customer NIC
 * @returns {Promise<Array>} - Array of accounts or empty array
 */
export const checkAccounts = async (pool, nic) => {
    const { rows } = await pool.query(
        `SELECT DISTINCT sa.account_no, ah.customer_nic AS nic
         FROM savingsaccounts sa
         JOIN accountholders ah ON ah.account_no = sa.account_no
         WHERE UPPER(TRIM(ah.customer_nic)) = $1`,
        [nic.toUpperCase().trim()]
    );
    return rows;
};

/**
 * Get comprehensive customer details including all accounts, transactions, and fixed deposits
 * @param {Object} pool - Database connection pool
 * @param {string} nic - Customer NIC
 * @returns {Promise<Array>} - Array of detailed customer data
 */
export const customerDetails = async (pool, nic) => {
    const { rows } = await pool.query(
        `SELECT 
            -- Account information
            sa.account_no,
            sa.balance as savings_balance,
            sa.active_status as savings_status,
            
            -- Account holder role (for joint accounts)
            ah.role as role,
            
            -- Fixed deposit information
            fd.fd_account_no,
            fd.deposit_amount as fd_amount,
            fd.start_date as fd_start_date,
            fd.end_date as fd_maturity_date,
            fd.status as fd_status,
            fd.last_interest_date as fd_last_interest_date,
            fdp.fd_plan_id,
            fdp.plan_name as fd_plan_name,
            fdp.plan_duration_months as fd_duration_months,
            fdp.interest_rate as fd_interest_rate,
            
            -- Transfers sent
            ts.transaction_id as transfer_sent_id,
            ts.amount as transfer_sent_amount,
            ts.receiver_account_no as transfer_sent_to,
            ts.transaction_done_by as transfer_sent_by,
            ts.transaction_date as transfer_sent_date,
            
            -- Transfers received
            tr.transaction_id as transfer_received_id,
            tr.amount as transfer_received_amount,
            tr.sender_account_no as transfer_received_from,
            tr.transaction_done_by as transfer_received_by,
            tr.transaction_date as transfer_received_date,
            
            -- Deposits
            d.transaction_id as deposit_id,
            d.amount as deposit_amount,
            d.transaction_done_by as deposit_by,
            d.transaction_date as deposit_date,
            
            -- Withdrawals
            w.transaction_id as withdraw_id,
            w.amount as withdraw_amount,
            w.transaction_done_by as withdraw_by,
            w.transaction_date as withdraw_date,
            
            -- Savings interest
            si.transaction_id as savings_interest_id,
            si.amount as savings_interest_amount,
            si.transaction_done_by as savings_interest_by,
            si.transaction_date as savings_interest_date,
            
            -- FD interest (recorded against savings account with type = 'fixed_deposit')
            fdi.transaction_id as fd_interest_id,
            fdi.amount as fd_interest_amount,
            fdi.transaction_done_by as fd_interest_by,
            fdi.transaction_date as fd_interest_date
            
        FROM accountholders ah
        JOIN customers c ON UPPER(TRIM(c.nic)) = $1 AND UPPER(TRIM(ah.customer_nic)) = UPPER(TRIM(c.nic))
        JOIN savingsaccounts sa ON sa.account_no = ah.account_no
        
        -- Fixed deposits linked to this savings account
        LEFT JOIN fixeddepositaccounts fd ON fd.linked_account_no = sa.account_no
        LEFT JOIN fixeddepositsplans fdp ON fdp.fd_plan_id = fd.fd_plan_id
        
        -- Transfers
        LEFT JOIN acc_to_acc_transactions ts ON sa.account_no = ts.sender_account_no
        LEFT JOIN acc_to_acc_transactions tr ON sa.account_no = tr.receiver_account_no
        
    -- Cash deposits/withdrawals
    LEFT JOIN acc_to_hand_transactions d ON sa.account_no = d.account_no AND d.cash_direction = 'deposit'
    -- Be robust to either enum value 'withdraw' or 'withdrawal' by casting to text
    LEFT JOIN acc_to_hand_transactions w ON sa.account_no = w.account_no AND (w.cash_direction::text = 'withdraw' OR w.cash_direction::text = 'withdrawal')
        
    -- Interest payments
    LEFT JOIN interest_payments si ON si.savings_account_no = sa.account_no AND si.interest_type = 'savings'
    LEFT JOIN interest_payments fdi ON fdi.savings_account_no = sa.account_no AND fdi.interest_type = 'fixed_deposit'
        
        ORDER BY sa.account_no, fd.fd_account_no, 
                 ts.transaction_date DESC NULLS LAST, tr.transaction_date DESC NULLS LAST,
                 d.transaction_date DESC NULLS LAST, w.transaction_date DESC NULLS LAST,
                 si.transaction_date DESC NULLS LAST, fdi.transaction_date DESC NULLS LAST`,
        [nic.toUpperCase().trim()]
    );
    return rows;
};

/**
 * Delete (deactivate) a savings account by customer
 * Sets deleted_by_customer to TRUE when customer deactivates their own account
 * @param {Object} client - Database client
 * @param {number} account_no - Account number to deactivate
 * @param {string} customer_nic - Customer NIC (must be account holder)
 * @param {number} customer_user_id - Customer's user ID
 * @returns {Promise<Object>} - Deactivated account data
 */
export const deleteSavingsAccountByCustomer = async (client, account_no, customer_nic, customer_user_id) => {
    await client.query(`SET LOCAL app.current_user_id = '${customer_user_id}'`);
    
    // Verify the customer is an account holder before deactivating
    const { rows } = await client.query(
        `UPDATE savingsaccounts 
         SET active_status = false, 
             deleted_by_customer = true 
         WHERE account_no = $1 
         AND account_no IN (
             SELECT ah.account_no 
             FROM accountholders ah
             WHERE UPPER(ah.customer_nic) = $2
         )
         RETURNING *`,
        [account_no, customer_nic.toUpperCase()]
    );
    
    if (rows.length === 0) {
        throw new Error('Savings account not found or you are not authorized to deactivate this account');
    }
    
    return rows[0];
};