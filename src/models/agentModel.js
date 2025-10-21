import pool from '../../database.js';

export const addNewCustomer = async (client,username, name, email, phone, NIC,
        gender, address, DOB, agent_id,branch_id,hashedPassword)=>{

    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);

    await client.query(
        'insert into customers (username,password,name,email,phone,NIC,gender,address,DOB,registered_by,branch_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [username, hashedPassword, name, email, phone, NIC, gender, address, DOB, agent_id, branch_id]
    );
}
export const searchCustomer = async (client, NICs) => {
    const normalized = NICs.map(n => (n || '').trim().toUpperCase());
    const { rows } = await client.query(
        'SELECT * FROM customers WHERE UPPER(nic) = ANY($1)',
        [normalized]
    );

    const existingNICs = rows.map(r => (r.nic || '').trim().toUpperCase());
    const missing = normalized.filter(nic => !existingNICs.includes(nic));
    if(missing.length > 0){
        return {ok: false, missing};
    }
    
    // Check if any customer is deactivated
    const deactivated = rows.filter(r => r.is_active === false);
    if(deactivated.length > 0){
        const deactivatedNICs = deactivated.map(r => r.nic);
        return {ok: false, deactivated: deactivatedNICs, message: 'Some customers are deactivated'};
    }
    
    return {ok: true,existing:rows};
};

export const getMinAge = async(client,plan_id)=>{
    const {rows} = await client.query(
        'select min_age,max_age from savingsplans where plan_id = $1',[plan_id]
    );
    return rows[0];
};


export const getAgentBranch = async(client,agent_id)=>{
    const {rows} = await client.query(
        'select branch_id from agents where user_id=$1',[agent_id]
    );
    return rows[0].branch_id;
};

export const searchCustomerByNIC = async (username) => {
    const { rows } = await pool.query(
        'select * from customers where NIC=$1', [username]
    );
    return rows[0];
};

// Find savings plan by age
export const findPlanByAge = async (client, age) => {
    const { rows } = await client.query(
        `SELECT plan_id, plan_name 
         FROM savingsplans 
         WHERE min_age <= $1 AND (max_age IS NULL OR max_age >= $1) 
         ORDER BY min_age 
         LIMIT 1`,
        [age]
    );
    return rows[0];
};

// Get all savings plans (for dropdowns etc)
export const getAllSavingsPlans = async (client) => {
    const { rows } = await client.query(
        `SELECT plan_id, plan_name 
         FROM savingsplans 
         ORDER BY plan_name`
    );
    return rows;
};

// Get minimum balance for a savings plan
export const getMinBalance = async (client, plan_id) => {
    const { rows } = await client.query(
        'SELECT min_balance FROM savingsplans WHERE plan_id = $1',
        [plan_id]
    );
    return rows[0]?.min_balance || 0;
};

// Create a savings account
export const createSavingsAccount = async (client, NICs, initial_deposit, agent_id, branch_id, plan_id, createdCustomer) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    
    // Normalize NICs - handle both string arrays and object arrays
    const normalizedNICs = NICs.map(item => {
        if (typeof item === 'string') {
            return item.toUpperCase();
        } else if (item && item.nic) {
            return String(item.nic).toUpperCase();
        } else {
            throw new Error('Invalid NIC format');
        }
    });
    
    // Get the first NIC as the primary account creator
    const primaryNIC = normalizedNICs[0];
    
    // Use stored procedure to create savings account with age validation
    const { rows: accountRows } = await client.query(
        `SELECT * FROM create_savings_account_with_age_check($1, $2, $3, $4, $5)`,
        [primaryNIC, plan_id, initial_deposit, agent_id, branch_id]
    );
    
    const result = accountRows[0];
    
    // Check if account creation failed due to age validation
    if (result.status === 'FAILED') {
        throw new Error(result.message);
    }
    
    const account_no = result.account_no;

    // Add secondary account holders if this is a joint account
    for (let i = 1; i < normalizedNICs.length; i++) {
        const nic = normalizedNICs[i];
        
        await client.query(
            'INSERT INTO accountholders (account_no, customer_nic, role) VALUES ($1, $2, $3)',
            [account_no, nic, 'secondary']
        );
    }

    return account_no;
};

// Check if account belongs to customer
export const accountChecker = async (client, account_no, customer_nic = null) => {
    if (customer_nic) {
        const { rows } = await client.query(
            `SELECT sa.account_no, c.nic as customer_nic 
             FROM savingsaccounts sa
             JOIN customers c ON sa.created_customer_nic = c.nic
             WHERE sa.account_no = $1 AND UPPER(c.nic) = $2`,
            [account_no, customer_nic.toUpperCase()]
        );
        return rows.length > 0 ? rows[0] : 0;
    } else {
        const { rows } = await client.query(
            'SELECT account_no FROM savingsaccounts WHERE account_no = $1',
            [account_no]
        );
        return rows.length > 0 ? rows[0] : 0;
    }
};

// Get account information
export const getAccinfo = async (client, account_no) => {
    const { rows } = await client.query(
        `SELECT sa.* 
         FROM savingsaccounts sa
         WHERE sa.account_no = $1`,
        [account_no]
    );
    return rows[0];
};

// Check if account has fixed deposit
export const fdChecker = async (client, account_no) => {
    const { rows } = await client.query(
        'SELECT * FROM fixeddepositaccounts WHERE linked_account_no = $1 AND status = $2',
        [account_no, 'active']
    );
    return rows.length > 0;
};

// Check role in account (for joint accounts)
export const checkRoleAccount = async (client, account_no, customer_nic) => {
    const { rows } = await client.query(
        `SELECT ah.role 
         FROM accountholders ah
         WHERE ah.account_no = $1 AND UPPER(ah.customer_nic) = $2`,
        [account_no, customer_nic.toUpperCase()]
    );
    return rows[0]?.role;
};

// Create fixed deposit account
export const createFixedDepositeAccount = async (client, account_no, fd_plan_id, amount, agent_id) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    
    // Get customer NIC from linked savings account for age validation
    const { rows: accountRows } = await client.query(
        'SELECT created_customer_nic FROM savingsaccounts WHERE account_no = $1',
        [account_no]
    );
    
    if (accountRows.length === 0) {
        throw new Error('Linked savings account not found');
    }
    
    const customer_nic = accountRows[0].created_customer_nic;
    
    // Use stored procedure to create FD with age validation
    const { rows: fdRows } = await client.query(
        `SELECT * FROM create_fd_account_with_age_check($1, $2, $3, $4, $5)`,
        [customer_nic, fd_plan_id, amount, account_no, agent_id]
    );
    
    const result = fdRows[0];
    
    // Check if FD creation failed due to age validation
    if (result.status === 'FAILED') {
        throw new Error(result.message);
    }
    
    return result.fd_account_no;
};

// Make deposit to account
export const makeDepositeAccount = async (client, account_no, amount, agent_id, customer_nic) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    
    await client.query(
        'UPDATE savingsaccounts SET balance = balance + $1, updated_at = NOW() WHERE account_no = $2',
        [amount, account_no]
    );

    const { rows } = await client.query(
        `INSERT INTO acc_to_hand_transactions (amount, account_no, cash_direction, transaction_done_by, status) 
         VALUES ($1, $2, $3, $4, $5) RETURNING transaction_id`,
        [amount, account_no, 'deposit', agent_id, 'completed']
    );

    return rows[0].transaction_id;
};

// Make withdrawal from account
export const makeWithdrawAccount = async (client, account_no, amount, agent_id, customer_nic) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    
    await client.query(
        'UPDATE savingsaccounts SET balance = balance - $1, updated_at = NOW() WHERE account_no = $2',
        [amount, account_no]
    );

    const { rows } = await client.query(
        `INSERT INTO acc_to_hand_transactions (amount, account_no, cash_direction, transaction_done_by, status) 
         VALUES ($1, $2, $3, $4, $5) RETURNING transaction_id`,
        [amount, account_no, 'withdraw', agent_id, 'completed']
    );

    return rows[0].transaction_id;
};

// Insert failed withdrawal attempt
export const insertFailedWIthdrawal = async (client, amount, account_no, agent_id) => {
    await client.query(
        `INSERT INTO acc_to_hand_transactions (amount, account_no, cash_direction, transaction_done_by, status, description) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [amount, account_no, 'withdraw', agent_id, 'failed', 'Failed withdrawal attempt - insufficient balance']
    );
};

// Account to account transfer

// Account to account transfer using stored procedure
export const accToAccTrans = async (client, sender_account_no, receiver_account_no, amount, agent_id, sender_nic) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    const { rows } = await client.query(
        'SELECT * FROM transfer_between_accounts($1, $2, $3, $4, $5)',
        [sender_account_no, receiver_account_no, amount, agent_id, sender_nic]
    );
    return rows[0]; // { transaction_id, status, message }
};

// List all customers
export const listCustomers = async (pool, agent_id = null) => {
    let query = 'SELECT customer_id, username, name, email, phone, nic, gender, address, dob, is_active FROM customers';
    const params = [];
    
    if (agent_id) {
        query += ' WHERE registered_by = $1';
        params.push(agent_id);
    }
    
    query += ' ORDER BY customer_id DESC';
    
    const { rows } = await pool.query(query, params);
    return rows;
};

// Get customer by NIC
export const getCustomerByNIC = async (pool, nic) => {
    const { rows } = await pool.query(
        'SELECT customer_id, username, name, email, phone, nic, gender, address, dob, is_active, registered_by, branch_id FROM customers WHERE UPPER(nic) = $1',
        [nic.toUpperCase()]
    );
    return rows[0];
};

// Update customer by NIC
export const updateCustomerByNIC = async (client, agent_id, nic, updates) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.name) {
        fields.push(`name = $${paramCount++}`);
        values.push(updates.name);
    }
    if (updates.email) {
        fields.push(`email = $${paramCount++}`);
        values.push(updates.email);
    }
    if (updates.phone) {
        fields.push(`phone = $${paramCount++}`);
        values.push(updates.phone);
    }
    if (updates.gender) {
        fields.push(`gender = $${paramCount++}`);
        values.push(updates.gender);
    }
    if (updates.address) {
        fields.push(`address = $${paramCount++}`);
        values.push(updates.address);
    }

    if (fields.length === 0) {
        return null;
    }

    values.push(nic.toUpperCase());
    
    const query = `UPDATE customers SET ${fields.join(', ')} WHERE UPPER(nic) = $${paramCount} RETURNING *`;
    const { rows } = await client.query(query, values);
    return rows[0];
};

// Bulk create customers
export const bulkCreateCustomers = async (client, agent_id, branch_id, customers) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    
    const inserted = [];
    
    for (const customer of customers) {
        const { rows } = await client.query(
            `INSERT INTO customers (username, password, name, email, phone, nic, gender, address, dob, registered_by, branch_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING customer_id, username, name, nic`,
            [
                customer.username,
                customer.hashedPassword,
                customer.name,
                customer.email,
                customer.phone,
                customer.nic,
                customer.gender,
                customer.address,
                customer.dob,
                agent_id,
                branch_id
            ]
        );
        inserted.push(rows[0]);
    }
    
    return inserted;
};

// Delete (deactivate) customer by NIC
// Also cascade-deactivates all savings accounts where the customer is a holder
// and all fixed deposits linked to those accounts
export const deleteCustomerByNIC = async (client, agent_id, nic) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    const normalizedNic = nic.toUpperCase();

    // 1. Deactivate the customer
    const { rows } = await client.query(
        'UPDATE customers SET is_active = false WHERE UPPER(nic) = $1 RETURNING *',
        [normalizedNic]
    );
    if (rows.length === 0) {
        return null; // Customer not found
    }

    // 2. Get all savings accounts where this customer is a holder
    const accountsResult = await client.query(
        `SELECT DISTINCT ah.account_no, sa.active_status
         FROM accountholders ah
         JOIN savingsaccounts sa ON sa.account_no = ah.account_no
         WHERE UPPER(ah.customer_nic) = $1`,
        [normalizedNic]
    );
    const accountNos = accountsResult.rows.map(r => r.account_no);

    for (const accRow of accountsResult.rows) {
        const accountNo = accRow.account_no;
        // Check if joint account (multiple holders)
        const holdersRes = await client.query(
            `SELECT role FROM accountholders WHERE account_no = $1`,
            [accountNo]
        );
        const roles = holdersRes.rows.map(r => String(r.role).toLowerCase());
        const isJoint = holdersRes.rowCount > 1;
        const myRoleRes = await client.query(
            `SELECT role FROM accountholders WHERE account_no = $1 AND UPPER(customer_nic) = $2`,
            [accountNo, normalizedNic]
        );
        const myRole = myRoleRes.rows[0]?.role?.toLowerCase();

        if (!isJoint) {
            // Normal account: always deactivate
            await client.query(
                `UPDATE savingsaccounts SET active_status = false WHERE account_no = $1`,
                [accountNo]
            );
            // For each FD linked to this account, deactivate and credit 98% to account (2% penalty)
            const fds = await client.query(
                `SELECT fd_account_no, deposit_amount FROM fixeddepositaccounts WHERE linked_account_no = $1 AND is_active = true`,
                [accountNo]
            );
            for (const fd of fds.rows) {
                await client.query(
                    `UPDATE fixeddepositaccounts SET is_active = false WHERE fd_account_no = $1`,
                    [fd.fd_account_no]
                );
                const payout = Number(fd.deposit_amount) * 0.98;
                if (payout > 0) {
                    await client.query(
                        `UPDATE savingsaccounts SET balance = balance + $1 WHERE account_no = $2`,
                        [payout, accountNo]
                    );
                }
                // Optionally: log penalty
            }
        } else {
            if (myRole === 'secondary') {
                // Secondary holder: only deactivate customer
                continue;
            }
            // Primary holder: check if any other primary holders exist
            const otherPrimaryRes = await client.query(
                `SELECT COUNT(*) FROM accountholders WHERE account_no = $1 AND LOWER(role::text) = 'primary' AND UPPER(customer_nic) <> $2`,
                [accountNo, normalizedNic]
            );
            const otherPrimaryCount = Number(otherPrimaryRes.rows[0].count);
            if (otherPrimaryCount === 0) {
                // Last primary holder: deactivate account and FDs
                await client.query(
                    `UPDATE savingsaccounts SET active_status = false WHERE account_no = $1`,
                    [accountNo]
                );
                await client.query(
                    `UPDATE fixeddepositaccounts SET is_active = false WHERE linked_account_no = $1`,
                    [accountNo]
                );
            }
            // If there are other primary holders, do NOT deactivate account or FDs
        }
    }
    return rows[0];
};

// Reactivate customer by NIC
export const reactivateCustomerByNIC = async (client, agent_id, nic) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    const normalizedNic = nic.toUpperCase();
    // 1. Reactivate the customer
    const { rows } = await client.query(
        'UPDATE customers SET is_active = true WHERE UPPER(nic) = $1 RETURNING *',
        [normalizedNic]
    );
    if (rows.length === 0) {
        return null; // Customer not found
    }
    // 2. Reactivate all savings accounts (including joint accounts) where this customer is a holder and account is inactive
    const accountsResult = await client.query(
        `SELECT DISTINCT ah.account_no
         FROM accountholders ah
         JOIN savingsaccounts sa ON sa.account_no = ah.account_no
         WHERE UPPER(ah.customer_nic) = $1 AND sa.active_status = false`,
        [normalizedNic]
    );
    const accountNos = accountsResult.rows.map(r => r.account_no);
    if (accountNos.length > 0) {
        await client.query(
            `UPDATE savingsaccounts SET active_status = true WHERE account_no = ANY($1::int[])`,
            [accountNos]
        );
    }
    // Do NOT reactivate fixed deposits
    return rows[0];
};

// Delete (deactivate) savings account
export const deleteSavingsAccountByNIC = async (client, account_no, customer_nic, agentId, isCustomerRequest = false) => {
    await client.query(`SET LOCAL app.current_user_id = '${agentId}'`);
    
    // Normalize NIC: trim and uppercase
    const normalizedNic = (customer_nic || '').trim().toUpperCase();
    
    const { rows } = await client.query(
        `UPDATE savingsaccounts 
         SET active_status = false, 
             deleted_by_customer = $3 
         WHERE account_no = $1 
         AND account_no IN (
             SELECT ah.account_no FROM accountholders ah
             WHERE UPPER(TRIM(ah.customer_nic)) = $2
         )
         RETURNING *`,
        [account_no, normalizedNic, isCustomerRequest]
    );
    return rows[0];
};

// Delete savings account by account number only (no NIC required)
export const deleteSavingsAccountByAccountNo = async (client, account_no, agent_id, isCustomerRequest = false) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    
    const { rows } = await client.query(
        `UPDATE savingsaccounts 
         SET active_status = false, 
             deleted_by_customer = $2 
         WHERE account_no = $1 
         RETURNING *`,
        [account_no, isCustomerRequest]
    );
    
    if (rows.length === 0) {
        throw new Error('Savings account not found');
    }
    
    return rows[0];
};

// Reactivate savings account
export const reactivateSavingsAccountByNIC = async (client, account_no, customer_nic, agent_id) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    
    const { rows } = await client.query(
        `UPDATE savingsaccounts 
         SET active_status = true,
             deleted_by_customer = false 
         WHERE account_no = $1 
         AND account_no IN (
             SELECT ah.account_no FROM accountholders ah
             WHERE UPPER(ah.customer_nic) = $2
         )
         RETURNING *`,
        [account_no, (customer_nic || '').trim().toUpperCase()]
    );
    return rows[0];
};

// Delete (deactivate) fixed deposit
export const deleteFixedDepositByNIC = async (client, fd_account_no, customer_nic, agent_id) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    
    // Check if FD exists and is active, and get amount and linked account
    const checkFd = await client.query(
        `SELECT fd.fd_account_no, fd.status, fd.is_active, fd.end_date, fd.deposit_amount, fd.linked_account_no
         FROM fixeddepositaccounts fd
         JOIN accountholders ah ON fd.linked_account_no = ah.account_no
         WHERE fd.fd_account_no = $1 AND UPPER(ah.customer_nic) = $2`,
        [fd_account_no, customer_nic.toUpperCase()]
    );
    if (checkFd.rows.length === 0) {
        throw new Error('Fixed deposit not found or you are not authorized');
    }
    const fd = checkFd.rows[0];
    if (fd.is_active === false) {
        throw new Error('Fixed deposit is already deactivated');
    }
    
    // Check if FD has matured (past end date or status is 'matured')
    const currentDate = new Date();
    const endDate = new Date(fd.end_date);
    const hasMatured = fd.status === 'matured' || currentDate >= endDate;
    
    // Calculate payout: 100% if matured, 98% if early withdrawal (2% penalty)
    const payout = hasMatured 
        ? Number(fd.deposit_amount) 
        : Number(fd.deposit_amount) * 0.98;
    
    // Update FD status to matured if it has reached end date
    const newStatus = hasMatured ? 'matured' : fd.status;
    
    // Deactivate FD
    const { rows } = await client.query(
        `UPDATE fixeddepositaccounts 
         SET is_active = false, status = $2
         WHERE fd_account_no = $1
         RETURNING *`,
        [fd_account_no, newStatus]
    );
    
    // Credit payout to linked savings account
    if (payout > 0) {
        await client.query(
            `UPDATE savingsaccounts SET balance = balance + $1 WHERE account_no = $2`,
            [payout, fd.linked_account_no]
        );
    }
    
    return rows[0];
};

// Reactivate fixed deposit
export const reactivateFixedDepositByNIC = async (client, fd_account_no, customer_nic, agent_id) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    
    const { rows } = await client.query(
        `UPDATE fixeddepositaccounts SET is_active = true 
         WHERE fd_account_no = $1 
         AND linked_account_no IN (
             SELECT ah.account_no FROM accountholders ah
             WHERE UPPER(ah.customer_nic) = $2
         )
         RETURNING *`,
        [fd_account_no, customer_nic.toUpperCase()]
    );
    return rows[0];
};

// Get savings accounts by customer NIC
export const getSavingsAccountsByNIC = async (pool, nic) => {
    const { rows } = await pool.query(
        `SELECT sa.account_no, sa.balance, sa.active_status, sa.created_at, sp.plan_name
         FROM savingsaccounts sa
         JOIN accountholders ah ON sa.account_no = ah.account_no
         JOIN savingsplans sp ON sa.plan_id = sp.plan_id
         WHERE UPPER(ah.customer_nic) = $1`,
        [nic.toUpperCase()]
    );
    return rows;
};

// Get fixed deposits by customer NIC
export const getFixedDepositsByNIC = async (pool, nic) => {
    const { rows } = await pool.query(
        `SELECT fd.fd_account_no, fd.deposit_amount, fd.start_date, fd.end_date, fd.status, fdp.plan_name
         FROM fixeddepositaccounts fd
         JOIN accountholders ah ON fd.linked_account_no = ah.account_no
         JOIN fixeddepositsplans fdp ON fd.fd_plan_id = fdp.fd_plan_id
         WHERE UPPER(ah.customer_nic) = $1`,
        [nic.toUpperCase()]
    );
    return rows;
};

// Get all savings accounts
export const getAllSavingsAccounts = async (pool) => {
    const { rows } = await pool.query(
        `SELECT 
            sa.account_no, 
            sa.balance, 
            sa.active_status, 
            sa.created_at as created_date,
            sp.plan_name,
            STRING_AGG(c.name || ' (' || c.nic || ')', ', ' ORDER BY ah.role DESC) as account_holders,
            sa.created_customer_nic
         FROM savingsaccounts sa
         JOIN accountholders ah ON sa.account_no = ah.account_no
         JOIN customers c ON ah.customer_nic = c.nic
         JOIN savingsplans sp ON sa.plan_id = sp.plan_id
         GROUP BY sa.account_no, sa.balance, sa.active_status, sa.created_at, sp.plan_name, sa.created_customer_nic
         ORDER BY sa.created_at DESC`
    );
    return rows;
};

// Get all fixed deposits
export const getAllFixedDeposits = async (pool) => {
    const { rows } = await pool.query(
        `SELECT 
            fd.fd_account_no,
            fd.linked_account_no,
            fd.deposit_amount,
            fd.start_date,
            fd.end_date,
            fd.status,
            fd.is_active,
            fdp.plan_name,
            fdp.interest_rate,
            c.name as customer_name,
            c.nic
         FROM fixeddepositaccounts fd
         JOIN accountholders ah ON fd.linked_account_no = ah.account_no
         JOIN customers c ON ah.customer_nic = c.nic
         JOIN fixeddepositsplans fdp ON fd.fd_plan_id = fdp.fd_plan_id
         WHERE ah.role = 'primary'
         ORDER BY fd.start_date DESC`
    );
    return rows;
};

// Get joint account by account number and NIC
export const getJointAccountByAccountAndNic = async (client, account_no, nic) => {
    const { rows } = await client.query(
        `SELECT 
            sa.account_no,
            sa.balance,
            sa.active_status,
            sa.created_at,
            sa.plan_id,
            c.name,
            c.nic,
            c.email,
            c.phone,
            ah.role
         FROM savingsaccounts sa
         JOIN accountholders ah ON sa.account_no = ah.account_no
         JOIN customers c ON ah.customer_nic = c.nic
         WHERE sa.account_no = $1 AND UPPER(ah.customer_nic) = $2`,
        [account_no, nic.toUpperCase()]
    );

    // Debug log
    console.log('[getJointAccountByAccountAndNic] Query result:', rows);

    if (rows.length === 0) {
        return {
            ok: false,
            message: 'No joint account found for this NIC and account number.'
        };
    }

    return {
        ok: true,
        account: rows[0]
    };
};

// Get all account holders for a joint account
export const getAccountHolders = async (client, account_no) => {
    const { rows } = await client.query(
        `SELECT 
            c.nic,
            c.name,
            c.email,
            c.phone,
            ah.role
         FROM accountholders ah
         JOIN customers c ON ah.customer_nic = c.nic
         WHERE ah.account_no = $1
         ORDER BY ah.role DESC`,  // Primary first, then secondary
        [account_no]
    );
    
    return rows;
};

// Delete joint account - Only PRIMARY user can deactivate
export const deleteJointAccountByPrimary = async (client, account_no, customer_nic, agent_id, isCustomerRequest = false) => {
    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);
    
    // Normalize NIC: trim and uppercase
    const normalizedNic = (customer_nic || '').trim().toUpperCase();
    
    // First, check if the user is the primary account holder
    const roleCheck = await client.query(
        `SELECT role FROM accountholders 
         WHERE account_no = $1 AND UPPER(TRIM(customer_nic)) = $2`,
        [account_no, normalizedNic]
    );
    
    if (roleCheck.rows.length === 0) {
        throw new Error('You are not an account holder of this account');
    }
    
    if (roleCheck.rows[0].role !== 'primary') {
        throw new Error('Only the primary account holder can deactivate this joint account');
    }
    
    // If user is primary, proceed with deactivation
    const { rows } = await client.query(
        `UPDATE savingsaccounts 
         SET active_status = false, 
             deleted_by_customer = true 
         WHERE account_no = $1 
         RETURNING *`,
        [account_no]
    );
    
    if (rows.length === 0) {
        throw new Error('Savings account not found');
    }
    
    return rows[0];
};

