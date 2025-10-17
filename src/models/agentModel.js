
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
        'select min_age,max_age from savingsPlans where plan_id = $1',[plan_id]
    );
    return rows[0];
};


export const getAgentBranch = async(client,agent_id)=>{
    const {rows} = await client.query(
        'select branch_id from agents where user_id=$1',[agent_id]
    );
    return rows[0].branch_id;
};


export const getMinBalance = async(client,plan_id)=>{
    const {rows} = await client.query(
        'select min_balance from savingsPlans where plan_id = $1',[plan_id]
    );
    return rows[0].min_balance;
};

export const createSavingsAccount = async(client,users,initial_deposit,agent_id,branch_id,plan_id,created_customer)=>{

    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);

    console.log(`[CREATE_SAVINGS_ACCOUNT] Creating account with created_customer: '${created_customer}'`);
    console.log(`[CREATE_SAVINGS_ACCOUNT] Account holders to add:`, users);

    const {rows} = await client.query(
        'insert into savingsAccounts (plan_id,branch_id,created_by,balance,created_customer_nic) values ($1,$2,$3,$4,$5) returning account_no',
        [plan_id,branch_id,agent_id,initial_deposit,created_customer]
    );
    const account_no = rows[0].account_no;

    console.log(`[CREATE_SAVINGS_ACCOUNT] Created account_no: ${account_no}`);

    for (const user of users) {
        console.log(`[CREATE_SAVINGS_ACCOUNT] Adding holder - NIC: '${user.nic}', Role: '${user.role}' to account ${account_no}`);
        await client.query(
            'insert into accountHolders (account_no,customer_nic,role) values ($1,$2,$3)', 
            [account_no,user.nic,user.role]
        );
    }
    
    console.log(`[CREATE_SAVINGS_ACCOUNT] Successfully added ${users.length} account holders`);
    return account_no;
};

export const fdChecker = async(client,account_no)=>{
    const {rows} = await client.query(
        'select * from fixedDepositAccounts where linked_account_no = $1',[account_no]
    );
    return rows.length;
};

export const checkRoleAccount = async(client,account_no,NIC)=>{
    const {rows} = await client.query(
        'select role from accountHolders where account_no = $1 and UPPER(customer_nic) = UPPER($2)',[account_no,NIC]
    );
    return rows[0].role;
};

export const createFixedDepositeAccount = async(client,account_no,fd_plan_id,amount,agent_id)=>{

    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);

    // Get the plan duration to calculate end_date
    const planQuery = await client.query(
        'SELECT plan_duration_months FROM fixedDepositsPlans WHERE fd_plan_id = $1',
        [fd_plan_id]
    );

    if (planQuery.rows.length === 0) {
        throw new Error('Fixed deposit plan not found');
    }

    const durationMonths = planQuery.rows[0].plan_duration_months;

    // Calculate end_date: current timestamp + duration in months
    // PostgreSQL will handle the date arithmetic
    await client.query(
        `INSERT INTO fixedDepositAccounts 
         (linked_account_no, fd_plan_id, deposit_amount, created_by, end_date) 
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + ($5 || ' months')::interval)`,
        [account_no, fd_plan_id, amount, agent_id, durationMonths]
    );
};

export const accountChecker = async(client,account_no,customer_nic)=>{
    // Normalize NIC
    const normalizedNic = (customer_nic || '').trim().toUpperCase();
    
    const {rows} = await client.query(
        'select account_no, customer_nic, role from accountHolders where account_no = $1 and UPPER(TRIM(customer_nic)) = $2',
        [account_no, normalizedNic]
    );
    return rows[0];
};

export const makeDepositeAccount = async(client,account_no,amount,agent_id,customer_nic)=>{

    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);

    await client.query(
    'update savingsAccounts set balance = balance + $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2 where account_no = $3',
    [amount,agent_id,account_no]
    );

    await client.query(
        'insert into acc_to_hand_transactions(amount,status,account_no,description,transaction_done_by,cash_direction,transaction_requested_by) values($1,$2,$3,$4,$5,$6,$7)',
        [amount,'completed',account_no,'Deposit made by agent',agent_id,'deposit',customer_nic]
    );
};

export const makeWithdrawAccount = async(client,account_no,amount,agent_id,customer_nic)=>{

    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);

    await client.query(
    'update savingsAccounts set balance = balance - $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2 where account_no = $3',
    [amount,agent_id,account_no]
    );

    await client.query(
        'insert into acc_to_hand_transactions(amount,status,account_no,description,transaction_done_by,cash_direction,transaction_requested_by) values($1,$2,$3,$4,$5,$6,$7)',
        [amount,'completed',account_no,'withdrawal made by agent',agent_id,'withdraw',customer_nic]
    );
};


export const getAccinfo = async(client,account_no)=>{
    const {rows} = await client.query(
        'select * from savingsAccounts where account_no = $1',[account_no]
    );
    return rows[0];
};

export const insertFailedWIthdrawal = async(client,amount,account_no,agent_id)=>{
    await client.query(
        'insert into acc_to_hand_transactions(amount,status,account_no,description,transaction_done_by,cash_direction) values($1,$2,$3,$4,$5,$6)',
        [amount,'failed',account_no,'Failed withdrawal due to insufficient balance',agent_id,'withdraw']
    );
};

export const accToAccTrans = async(client,sender_account_no,receiver_account_no,amount,agent_id,customer_nic)=>{

    await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);

    await client.query(
        'update savingsAccounts set balance = balance - $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2 where account_no = $3',
        [amount,agent_id,sender_account_no]
    );
    await client.query(
        'update savingsAccounts set balance = balance + $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2 where account_no = $3',
        [amount,agent_id,receiver_account_no]
    );
    await client.query(
        'insert into acc_to_acc_transactions(amount,status,sender_account_no,receiver_account_no,description,transaction_done_by,transaction_requested_by) values($1,$2,$3,$4,$5,$6,$7)',
        [amount,'completed',sender_account_no,receiver_account_no,'Account to account transfer done by agent',agent_id,customer_nic] 
    );
};

// List customers (optionally by agent's branch)
export const listCustomers = async (pool, agentId = null) => {
    let query = `SELECT customer_id, username, name, email, phone, nic, gender, address, DOB, is_active, branch_id, registered_by, registered_at FROM customers ORDER BY name`;
    const { rows } = await pool.query(query);
    return rows;
};

// Get single customer by NIC
export const getCustomerByNIC = async (pool, nic) => {
    const { rows } = await pool.query(
        `SELECT customer_id, username, name, email, phone, nic, gender, address, DOB, is_active, branch_id, registered_by, registered_at FROM customers WHERE UPPER(nic) = UPPER($1)`,
        [nic]
    );
    return rows[0];
};

// Update customer by NIC
export const updateCustomerByNIC = async (client, agentId, currentNic, updates) => {
    await client.query(`SET LOCAL app.current_user_id = '${agentId}'`);

    // Resolve customer_id
    const { rows: cu } = await client.query(
        `SELECT customer_id FROM customers WHERE UPPER(nic) = UPPER($1)`,
        [currentNic]
    );
    if (cu.length === 0) {
        throw new Error('Customer not found');
    }
    const customerId = cu[0].customer_id;

    // Dynamically build update
    const sets = [];
    const vals = [];
    let idx = 1;
    if (updates.username) { sets.push(`username = $${idx++}`); vals.push(updates.username); }
    if (updates.name) { sets.push(`name = $${idx++}`); vals.push(updates.name); }
    if (updates.email) { sets.push(`email = $${idx++}`); vals.push(updates.email); }
    if (updates.phone) { sets.push(`phone = $${idx++}`); vals.push(updates.phone); }
    if (updates.nic) { sets.push(`nic = UPPER($${idx++})`); vals.push(updates.nic); }
    if (updates.gender) { sets.push(`gender = $${idx++}`); vals.push(updates.gender); }
    if (updates.address) { sets.push(`address = $${idx++}`); vals.push(updates.address); }
    if (updates.DOB) { sets.push(`DOB = $${idx++}`); vals.push(updates.DOB); }
    if (typeof updates.is_active !== 'undefined') { sets.push(`is_active = $${idx++}`); vals.push(updates.is_active); }
    if (updates.passwordHash) { sets.push(`password = $${idx++}`); vals.push(updates.passwordHash); }

    if (sets.length > 0) {
        sets.push(`updated_at = CURRENT_TIMESTAMP`);
        vals.push(customerId);
        await client.query(
            `UPDATE customers SET ${sets.join(', ')} WHERE customer_id = $${idx}`,
            vals
        );
    }

    // Return updated row
    const { rows: out } = await client.query(
        `SELECT customer_id, username, name, email, phone, nic, gender, address, DOB, is_active, branch_id, registered_by, registered_at FROM customers WHERE customer_id = $1`,
        [customerId]
    );
    return out[0];
};

// Bulk insert customers (from CSV rows)
export const bulkCreateCustomers = async (client, agentId, branchId, customers) => {
    await client.query(`SET LOCAL app.current_user_id = '${agentId}'`);
    const inserted = [];
    for (const c of customers) {
        const { rows } = await client.query(
            `INSERT INTO customers (username, password, name, email, phone, nic, gender, address, DOB, registered_by, branch_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING customer_id, username, name, email, phone, nic, gender, address, DOB, is_active, branch_id, registered_by, registered_at`,
            [c.username, c.password, c.name, c.email, c.phone, c.nic, c.gender, c.address, c.DOB, agentId, branchId]
        );
        inserted.push(rows[0]);
    }
    return inserted;
};

// Delete customer by NIC
export const deleteCustomerByNIC = async (client, agentId, nic) => {
    await client.query(`SET LOCAL app.current_user_id = '${agentId}'`);

    // First check if customer exists and get user_id and is_active status
    const { rows: customer } = await client.query(
        `SELECT c.customer_id, la.user_id, c.nic, c.username, c.is_active
         FROM customers c
         LEFT JOIN login_authentication la ON c.username = la.username
         WHERE UPPER(c.nic) = UPPER($1)`,
        [nic]
    );
    if (customer.length === 0) {
        throw new Error('Customer not found');
    }
    
    const customerId = customer[0].customer_id;
    const userId = customer[0].user_id; // may be null for customers not present in login_authentication
    const customerNIC = customer[0].nic;
    const isActive = customer[0].is_active;

    // Check if customer is already deactivated
    if (isActive === false) {
        throw new Error('Customer is already deactivated');
    }

    console.log(`[DEACTIVATE] Starting deactivation for customer NIC: ${customerNIC}`);

        // 1. Find all savings accounts where this customer is an accountHolder
        console.log(`[DEACTIVATE] Querying accountHolders for NIC: '${customerNIC}' (length: ${customerNIC.length})`);
        
        // First, let's see what NICs are actually in the accountHolders table for debugging
        const { rows: allAccountHolders } = await client.query(
            `SELECT DISTINCT customer_nic FROM accountHolders LIMIT 10`
        );
        console.log(`[DEACTIVATE] Sample NICs in accountHolders table:`, allAccountHolders.map(r => `'${r.customer_nic}' (len: ${r.customer_nic?.length || 0})`));
        
        const { rows: accHolders } = await client.query(
            `SELECT account_no, role FROM accountHolders WHERE UPPER(customer_nic) = UPPER($1)`,
            [customerNIC]
        );

        console.log(`[DEACTIVATE] Found ${accHolders.length} accounts for customer:`, accHolders);

        for (const holder of accHolders) {
            const accountNo = holder.account_no;
            const myRole = holder.role;

            // Get all holders for this account along with their active status
            const { rows: allHolders } = await client.query(
                `SELECT ah.customer_nic, ah.role, c.is_active
                 FROM accountHolders ah
                 JOIN customers c ON UPPER(ah.customer_nic) = UPPER(c.nic)
                 WHERE ah.account_no = $1`,
                [accountNo]
            );
            console.log(`[DEACTIVATE] Account ${accountNo} has ${allHolders.length} holders:`, allHolders);
            
            const numHolders = allHolders.length;
            const primaries = allHolders.filter(h => h.role === 'primary');
            const activePrimaries = primaries.filter(h => h.is_active === true);
            console.log(`[DEACTIVATE] Account ${accountNo} has ${primaries.length} primary holders (${activePrimaries.length} active):`, primaries);

            // Check if this customer is the LAST ACTIVE primary holder
            // After deactivating this customer, will there be any active primary holders left?
            const otherActivePrimaries = activePrimaries.filter(h => h.customer_nic.toUpperCase() !== customerNIC.toUpperCase());
            const isLastActivePrimary = otherActivePrimaries.length === 0;
            
            if (isLastActivePrimary) {
                console.log(`[DEACTIVATE] Deactivating account ${accountNo} due to customer deactivation`);
                
                // Close all active FDs linked to this savings account with 2% early closure penalty
                const { rows: linkedFDs } = await client.query(
                    `SELECT fd.fd_account_no, fd.deposit_amount, fd.start_date, fd.end_date, fd.is_active,
                            fp.plan_duration_months, fp.interest_rate
                     FROM fixedDepositAccounts fd
                     JOIN fixedDepositsPlans fp ON fd.fd_plan_id = fp.fd_plan_id
                     WHERE fd.linked_account_no = $1 AND fd.is_active = TRUE`,
                    [accountNo]
                );
                console.log(`[DEACTIVATE] Found ${linkedFDs.length} active FDs linked to account ${accountNo}`);
                
                for (const fd of linkedFDs) {
                    // Check if FD has matured naturally using stored end_date
                    const now = new Date();
                    const endDate = new Date(fd.end_date);
                    const isMatured = now >= endDate;

                    // Validate depositAmount and interestRate
                    let depositAmount = parseFloat(fd.deposit_amount);
                    if (isNaN(depositAmount) || depositAmount < 0) depositAmount = 0;
                    let interestRate = parseFloat(fd.interest_rate);
                    if (isNaN(interestRate) || interestRate < 0) interestRate = 0;

                    if (isMatured) {
                        // Natural maturity: Transfer full amount with interest
                        const totalAmount = depositAmount * (1 + interestRate / 100);

                        await client.query(
                            'UPDATE savingsAccounts SET balance = balance + $1 WHERE account_no = $2',
                            [totalAmount, accountNo]
                        );

                        await client.query(
                            `UPDATE fixedDepositAccounts SET is_active = FALSE, status = 'matured' WHERE fd_account_no = $1`,
                            [fd.fd_account_no]
                        );

                        console.log(`[DEACTIVATE] FD ${fd.fd_account_no} matured - credited ${totalAmount} (with interest)`);
                    } else {
                        // Early closure: Apply 2% penalty
                        const penaltyPercentage = 0.02;
                        const penaltyAmount = depositAmount * penaltyPercentage;
                        const amountToCredit = depositAmount - penaltyAmount;

                        await client.query(
                            'UPDATE savingsAccounts SET balance = balance + $1 WHERE account_no = $2',
                            [amountToCredit, accountNo]
                        );

                        await client.query(
                            `UPDATE fixedDepositAccounts SET is_active = FALSE WHERE fd_account_no = $1`,
                            [fd.fd_account_no]
                        );

                        console.log(`[DEACTIVATE] FD ${fd.fd_account_no} closed early - credited ${amountToCredit} (2% penalty: ${penaltyAmount})`);
                    }
                }
                
                // Set deleted_by_customer = FALSE because this deactivation is due to customer deactivation, not manual
                await client.query(
                    `UPDATE savingsAccounts 
                     SET active_status = FALSE, deleted_by_customer = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = $2 
                     WHERE account_no = $1`,
                    [accountNo, agentId]
                );
            } else {
                console.log(`[DEACTIVATE] Skipping account ${accountNo} - not sole primary holder (joint account with other primary holders)`);
                console.log(`[DEACTIVATE] Account and FDs will remain active since other primary holders exist`);
                
                // For joint accounts where customer is NOT the only primary holder:
                // Don't deactivate the account and don't close any FDs
                // The account and its FDs belong to all primary holders, not just this customer
                // Other primary holders should still have full access to the account and its FDs
            }

            // NOTE: We do NOT delete from accountHolders to allow reactivation later
            // The account is just deactivated, not fully deleted
        }

    // 2. Null out references to this customer's NIC to preserve history without FK conflicts
    // NOTE: We keep these NULL to maintain audit trail
    await client.query(`UPDATE transactions SET transaction_requested_by = NULL WHERE UPPER(transaction_requested_by) = UPPER($1)`, [customerNIC]);
    await client.query(`UPDATE savingsAccounts SET created_customer_nic = NULL WHERE UPPER(created_customer_nic) = UPPER($1)`, [customerNIC]);

    // 3. Deactivate customer (soft delete)
    await client.query(`UPDATE customers SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = $1 WHERE customer_id = $2`, [agentId, customerId]);
    
    // 4. Optionally deactivate login_authentication (if exists)
    if (userId) {
        await client.query(`UPDATE login_authentication SET is_active = FALSE WHERE user_id = $1`, [userId]);
    }

    return { message: 'Customer deactivated successfully', customer_id: customerId };
};

// Reactivate customer by NIC
export const reactivateCustomerByNIC = async (client, agentId, nic) => {
    await client.query(`SET LOCAL app.current_user_id = '${agentId}'`);

    // First check if customer exists and get user_id and is_active status
    const { rows: customer } = await client.query(
        `SELECT c.customer_id, la.user_id, c.nic, c.username, c.is_active
         FROM customers c
         LEFT JOIN login_authentication la ON c.username = la.username
         WHERE UPPER(c.nic) = UPPER($1)`,
        [nic]
    );
    if (customer.length === 0) {
        throw new Error('Customer not found');
    }
    const customerId = customer[0].customer_id;
    const userId = customer[0].user_id;
    const isActive = customer[0].is_active;

    // Check if customer is already active
    if (isActive === true) {
        throw new Error('Customer is already active');
    }

    const customerNIC = customer[0].nic;

    // 1. Reactivate all savings accounts where this customer is an account holder
    // This mirrors the deactivation logic - we reactivate accounts that were deactivated when this customer was deactivated
    // IMPORTANT: We only reactivate accounts where deleted_by_customer = FALSE
    // This ensures manually deactivated accounts stay deactivated
    console.log(`[REACTIVATE] Looking for deactivated accounts for customer NIC: '${customerNIC}' (length: ${customerNIC.length})`);
    
    // First, let's see what NICs are actually in the accountHolders table for debugging
    const { rows: allAccountHolders } = await client.query(
        `SELECT DISTINCT customer_nic FROM accountHolders LIMIT 10`
    );
    console.log(`[REACTIVATE] Sample NICs in accountHolders table:`, allAccountHolders.map(r => `'${r.customer_nic}' (len: ${r.customer_nic?.length || 0})`));
    
    // Only find accounts that were deactivated due to customer deactivation (deleted_by_customer = FALSE)
    const { rows: accHolders } = await client.query(
        `SELECT DISTINCT ah.account_no, ah.role 
         FROM accountHolders ah
         JOIN savingsAccounts sa ON ah.account_no = sa.account_no
         WHERE UPPER(ah.customer_nic) = UPPER($1) 
           AND sa.active_status = FALSE 
           AND sa.deleted_by_customer = FALSE`,
        [customerNIC]
    );

    console.log(`[REACTIVATE] Found ${accHolders.length} deactivated accounts (excluding manually deactivated):`, accHolders);

    for (const holder of accHolders) {
        const accountNo = holder.account_no;

        // Get all holders for this account to check if this customer is/was the primary
        const { rows: allHolders } = await client.query(
            `SELECT customer_nic, role FROM accountHolders WHERE account_no = $1`,
            [accountNo]
        );
        console.log(`[REACTIVATE] Account ${accountNo} has ${allHolders.length} holders:`, allHolders);
        
        const primaries = allHolders.filter(h => h.role === 'primary');
        console.log(`[REACTIVATE] Account ${accountNo} has ${primaries.length} primary holders:`, primaries);

        // If this customer is the only primary holder of this account, reactivate the account
        // This ensures we only reactivate accounts that were deactivated because of THIS customer
        if (primaries.length === 1 && primaries[0].customer_nic.toUpperCase() === customerNIC.toUpperCase()) {
            console.log(`[REACTIVATE] Reactivating account ${accountNo}`);
            await client.query(
                `UPDATE savingsAccounts SET active_status = TRUE, updated_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE account_no = $1`,
                [accountNo, agentId]
            );
            
            // Also reactivate all matured fixed deposits linked to this savings account
            const { rows: linkedFDs } = await client.query(
                `SELECT fd_account_no FROM fixedDepositAccounts WHERE linked_account_no = $1 AND status = 'matured'`,
                [accountNo]
            );
            console.log(`[REACTIVATE] Found ${linkedFDs.length} matured FDs linked to account ${accountNo}`);
            
            if (linkedFDs.length > 0) {
                await client.query(
                    `UPDATE fixedDepositAccounts SET status = 'active' WHERE linked_account_no = $1 AND status = 'matured'`,
                    [accountNo]
                );
                console.log(`[REACTIVATE] Reactivated ${linkedFDs.length} fixed deposits for account ${accountNo}`);
            }
        } else {
            console.log(`[REACTIVATE] Skipping account ${accountNo} - not sole primary holder`);
        }
    }

    // 2. Reactivate customer
    await client.query(`UPDATE customers SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP, updated_by = $1 WHERE customer_id = $2`, [agentId, customerId]);
    
    // 3. Optionally reactivate login_authentication (if exists)
    if (userId) {
        await client.query(`UPDATE login_authentication SET is_active = TRUE WHERE user_id = $1`, [userId]);
    }

    return { message: 'Customer reactivated successfully', customer_id: customerId };
};

// Delete Savings Account - Can only be deleted by the customer who created it
export const deleteSavingsAccountByNIC = async (client, account_no, customer_nic, agent_id) => {
    try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);

        // Normalize NIC
        const normalizedNic = (customer_nic || '').trim().toUpperCase();

        // 1. Check if the account exists
        const accountCheck = await client.query(
            'SELECT account_no, created_customer_nic FROM savingsAccounts WHERE account_no = $1',
            [account_no]
        );

        if (accountCheck.rows.length === 0) {
            throw new Error('Savings account not found');
        }

        const account = accountCheck.rows[0];

        // 2. Check if customer exists and is active
        const customerCheck = await client.query(
            'SELECT is_active FROM customers WHERE UPPER(TRIM(nic)) = $1',
            [normalizedNic]
        );

        if (customerCheck.rows.length === 0) {
            throw new Error('Customer not found');
        }

        if (!customerCheck.rows[0].is_active) {
            throw new Error('This customer is inactive and cannot perform this action');
        }

        // 3. Verify that the customer is a PRIMARY account holder
        const holderCheck = await client.query(
            'SELECT role FROM accountHolders WHERE account_no = $1 AND UPPER(TRIM(customer_nic)) = $2',
            [account_no, normalizedNic]
        );

        if (holderCheck.rows.length === 0) {
            throw new Error('This customer is not an account holder for this savings account');
        }

        if (holderCheck.rows[0].role !== 'primary') {
            throw new Error('Only the PRIMARY account holder can deactivate this savings account');
        }

        // 3. Deactivate all fixed deposits linked to this savings account (mark as matured)
        await client.query(
            `UPDATE fixedDepositAccounts SET status = 'matured' WHERE linked_account_no = $1`,
            [account_no]
        );

        // 4. Deactivate the savings account (do not delete holders)
        // Set deleted_by_customer = TRUE to mark this as a manual deactivation
        await client.query(
            'UPDATE savingsAccounts SET active_status = FALSE, deleted_by_customer = TRUE, updated_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE account_no = $1',
            [account_no, agent_id]
        );

        await client.query('COMMIT');
        return { message: 'Savings account deactivated and all linked fixed deposits marked as matured', account_no };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
};

// Reactivate Savings Account - Set active_status back to TRUE
export const reactivateSavingsAccountByNIC = async (client, account_no, customer_nic, agent_id) => {
    try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);

        // Normalize NIC
        const normalizedNic = (customer_nic || '').trim().toUpperCase();

        // 1. Check if savings account exists
        const accountCheck = await client.query(
            'SELECT account_no, created_customer_nic, active_status FROM savingsAccounts WHERE account_no = $1',
            [account_no]
        );

        if (accountCheck.rows.length === 0) {
            throw new Error('Savings account not found');
        }

        const account = accountCheck.rows[0];

        // 2. Check if customer exists and is active
        const customerCheck = await client.query(
            'SELECT is_active FROM customers WHERE UPPER(TRIM(nic)) = $1',
            [normalizedNic]
        );

        if (customerCheck.rows.length === 0) {
            throw new Error('Customer not found');
        }

        if (!customerCheck.rows[0].is_active) {
            throw new Error('This customer is inactive and cannot perform this action');
        }

        // 3. Verify that the customer is a PRIMARY account holder
        const holderCheck = await client.query(
            'SELECT role FROM accountHolders WHERE account_no = $1 AND UPPER(TRIM(customer_nic)) = $2',
            [account_no, normalizedNic]
        );

        if (holderCheck.rows.length === 0) {
            throw new Error('This customer is not an account holder for this savings account');
        }

        if (holderCheck.rows[0].role !== 'primary') {
            throw new Error('Only the PRIMARY account holder can reactivate this savings account');
        }

        // 3. Check if already active
        if (account.active_status === true) {
            throw new Error('Savings account is already active');
        }

        // 4. Reactivate the savings account
        // Set deleted_by_customer = FALSE so it can be managed by customer deactivation/reactivation in the future
        await client.query(
            'UPDATE savingsAccounts SET active_status = TRUE, deleted_by_customer = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE account_no = $1',
            [account_no, agent_id]
        );

        // 5. Reactivate all matured fixed deposits linked to this savings account
        const { rows: linkedFDs } = await client.query(
            'SELECT fd_account_no FROM fixedDepositAccounts WHERE linked_account_no = $1 AND status = \'matured\'',
            [account_no]
        );

        if (linkedFDs.length > 0) {
            await client.query(
                'UPDATE fixedDepositAccounts SET status = \'active\' WHERE linked_account_no = $1 AND status = \'matured\'',
                [account_no]
            );
        }

        await client.query('COMMIT');
        return { 
            message: `Savings account reactivated successfully${linkedFDs.length > 0 ? ` and ${linkedFDs.length} fixed deposit(s) reactivated` : ''}`, 
            account_no,
            reactivated_fds: linkedFDs.length
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
};

// Delete Fixed Deposit - Can only be deleted by the customer who created the linked savings account
export const deleteFixedDepositByNIC = async (client, fd_account_no, customer_nic, agent_id) => {
    try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);

        // 1. Check if the fixed deposit exists and get the linked savings account
        const fdCheck = await client.query(
            `SELECT fd.fd_account_no, fd.linked_account_no, fd.end_date, fd.is_active, sa.created_customer_nic
             FROM fixedDepositAccounts fd
             JOIN savingsAccounts sa ON fd.linked_account_no = sa.account_no
             WHERE fd.fd_account_no = $1`,
            [fd_account_no]
        );

        if (fdCheck.rows.length === 0) {
            throw new Error('Fixed deposit not found');
        }

        const fd = fdCheck.rows[0];

        // 2. Check if customer exists and is active
        const normalizedNic = (customer_nic || '').trim().toUpperCase();
        const customerCheck = await client.query(
            'SELECT is_active FROM customers WHERE UPPER(TRIM(nic)) = $1',
            [normalizedNic]
        );

        if (customerCheck.rows.length === 0) {
            throw new Error('Customer not found');
        }

        if (!customerCheck.rows[0].is_active) {
            throw new Error('This customer is inactive and cannot perform this action');
        }

        // 3. Verify that the customer is a PRIMARY holder of the linked savings account
        const holderCheck = await client.query(
            'SELECT role FROM accountHolders WHERE account_no = $1 AND UPPER(TRIM(customer_nic)) = $2',
            [fd.linked_account_no, normalizedNic]
        );

        if (holderCheck.rows.length === 0) {
            throw new Error('This customer is not an account holder for the linked savings account');
        }

        if (holderCheck.rows[0].role !== 'primary') {
            throw new Error('Only the PRIMARY account holder of the linked savings account can deactivate this fixed deposit');
        }

        // 4. Check if FD is already inactive
        if (fd.is_active === false) {
            throw new Error('Fixed deposit is already deactivated');
        }

        // 5. Check if FD has matured naturally using stored end_date
        const now = new Date();
        const endDate = new Date(fd.end_date);
        const isMatured = now >= endDate;

        if (isMatured) {
            // Natural maturity: Transfer full amount + interest to linked savings account
            // Calculate total amount with interest
            const fdDetailsQuery = await client.query(
                `SELECT fd.deposit_amount, fp.interest_rate, fp.plan_duration_months
                 FROM fixedDepositAccounts fd
                 JOIN fixedDepositsPlans fp ON fd.fd_plan_id = fp.fd_plan_id
                 WHERE fd.fd_account_no = $1`,
                [fd_account_no]
            );
            
            const { deposit_amount, interest_rate } = fdDetailsQuery.rows[0];
            const totalAmount = parseFloat(deposit_amount) * (1 + parseFloat(interest_rate) / 100);

            // Transfer to linked savings account
            await client.query(
                'UPDATE savingsAccounts SET balance = balance + $1 WHERE account_no = $2',
                [totalAmount, fd.linked_account_no]
            );

            // Mark FD as matured and inactive
            await client.query(
                'UPDATE fixedDepositAccounts SET is_active = FALSE, status = $1 WHERE fd_account_no = $2',
                ['matured', fd_account_no]
            );

            await client.query('COMMIT');
            return { 
                message: 'Fixed deposit matured successfully. Full amount with interest transferred to linked savings account.',
                fd_account_no,
                amount_transferred: totalAmount,
                is_matured: true
            };
        } else {
            // Manual deactivation before maturity: Apply 2% penalty
            // Fetch deposit amount for this FD
            const fdAmountQuery = await client.query(
                'SELECT deposit_amount FROM fixedDepositAccounts WHERE fd_account_no = $1',
                [fd_account_no]
            );
            
            const depositAmount = parseFloat(fdAmountQuery.rows[0].deposit_amount);
            
            // Validate depositAmount to prevent NaN
            if (isNaN(depositAmount) || depositAmount < 0) {
                throw new Error('Invalid deposit amount found for this fixed deposit');
            }
            
            // Penalty: 2% of deposit amount goes to bank, remaining credited to savings account
            const penaltyPercentage = 0.02; // 2%
            const penaltyAmount = depositAmount * penaltyPercentage;
            const amountToCredit = depositAmount - penaltyAmount;

            // Transfer remaining amount (after 2% penalty) to linked savings account
            await client.query(
                'UPDATE savingsAccounts SET balance = balance + $1 WHERE account_no = $2',
                [amountToCredit, fd.linked_account_no]
            );

            // Deactivate FD but keep status as 'active' (not matured)
            await client.query(
                'UPDATE fixedDepositAccounts SET is_active = FALSE WHERE fd_account_no = $1',
                [fd_account_no]
            );

            await client.query('COMMIT');
            return { 
                message: 'Fixed deposit deactivated before maturity. 2% penalty deducted, remaining amount credited to savings account.',
                fd_account_no,
                original_amount: depositAmount,
                penalty_amount: penaltyAmount,
                amount_transferred: amountToCredit,
                penalty_applied: true,
                is_matured: false
            };
        }
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
};

// Reactivate Fixed Deposit - DISABLED: Once deactivated, FDs cannot be reactivated
export const reactivateFixedDepositByNIC = async (client, fd_account_no, customer_nic, agent_id) => {
    try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_user_id = '${agent_id}'`);

        // Fixed deposits cannot be reactivated once deactivated
        throw new Error('Fixed deposits cannot be reactivated once deactivated. Please create a new fixed deposit instead.');

        // OLD CODE - Disabled
        /*
        // 1. Check if the fixed deposit exists and get the linked savings account
        const fdCheck = await client.query(
            `SELECT fd.fd_account_no, fd.linked_account_no, fd.status, sa.created_customer_nic, sa.active_status
             FROM fixedDepositAccounts fd
             JOIN savingsAccounts sa ON fd.linked_account_no = sa.account_no
             WHERE fd.fd_account_no = $1`,
            [fd_account_no]
        );
        */

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
};

// Get all savings accounts for a customer by NIC
export const getSavingsAccountsByNIC = async (client, customer_nic) => {
    const { rows } = await client.query(
        `SELECT 
            sa.account_no,
            sa.balance,
            sa.active_status,
            sa.branch_id,
            sa.created_at,
            sa.created_customer_nic,
            sp.plan_name,
            sp.interest_rate
        FROM savingsAccounts sa
        INNER JOIN accountHolders ah ON sa.account_no = ah.account_no
        LEFT JOIN savingsPlans sp ON sa.plan_id = sp.plan_id
        WHERE UPPER(ah.customer_nic) = UPPER($1)
        ORDER BY sa.account_no DESC`,
        [customer_nic]
    );
    return rows;
};

// Get all fixed deposits for a customer by NIC
export const getFixedDepositsByNIC = async (client, customer_nic) => {
    const { rows } = await client.query(
        `SELECT 
            fd.fd_account_no,
            fd.linked_account_no,
            fd.deposit_amount,
            fd.start_date,
            fd.end_date,
            fdp.plan_name,
            fdp.interest_rate,
            fdp.duration
        FROM fixedDepositAccounts fd
        INNER JOIN accountHolders ah ON fd.linked_account_no = ah.account_no
        LEFT JOIN fixedDepositsPlans fdp ON fd.fd_plan_id = fdp.fd_plan_id
        WHERE UPPER(ah.customer_nic) = UPPER($1)
        ORDER BY fd.fd_account_no DESC`,
        [customer_nic]
    );
    return rows;
};

// Get all savings accounts (for viewing all accounts without NIC filter)
export const getAllSavingsAccounts = async (client) => {
    const { rows } = await client.query(
        `SELECT 
            sa.account_no,
            sa.balance,
            sa.active_status,
            sa.branch_id,
            sa.created_at,
            sa.created_customer_nic,
            sp.plan_name,
            sp.interest_rate,
            STRING_AGG(DISTINCT ah.customer_nic, ', ') as account_holders
        FROM savingsAccounts sa
        LEFT JOIN accountHolders ah ON sa.account_no = ah.account_no
        LEFT JOIN savingsPlans sp ON sa.plan_id = sp.plan_id
        GROUP BY sa.account_no, sa.balance, sa.active_status, sa.branch_id, sa.created_at, sa.created_customer_nic, sp.plan_name, sp.interest_rate
        ORDER BY sa.account_no DESC
        LIMIT 100`
    );
    return rows;
};

// Get all fixed deposits (for viewing all FDs without NIC filter)
export const getAllFixedDeposits = async (client) => {
    const { rows } = await client.query(
        `SELECT 
            fd.fd_account_no,
            fd.linked_account_no,
            fd.deposit_amount,
            fd.start_date,
            fd.end_date,
            fd.status,
            fd.is_active,
            sa.created_customer_nic,
            fdp.plan_name,
            fdp.interest_rate,
            fdp.plan_duration_months,
            STRING_AGG(DISTINCT ah.customer_nic, ', ') as account_holders
        FROM fixedDepositAccounts fd
        LEFT JOIN accountHolders ah ON fd.linked_account_no = ah.account_no
        LEFT JOIN fixedDepositsPlans fdp ON fd.fd_plan_id = fdp.fd_plan_id
        LEFT JOIN savingsAccounts sa ON fd.linked_account_no = sa.account_no
        GROUP BY fd.fd_account_no, fd.linked_account_no, fd.deposit_amount, fd.start_date, fd.end_date, fd.status, fd.is_active, sa.created_customer_nic, fdp.plan_name, fdp.interest_rate, fdp.plan_duration_months
        ORDER BY fd.fd_account_no DESC
        LIMIT 100`
    );
    return rows;
};

// Get joint account by account number and NIC with role validation
export const getJointAccountByAccountAndNic = async (client, account_no, nic) => {
    const normalizedNic = (nic || '').trim().toUpperCase();
    
    // First check if account exists and is a joint account (has multiple holders)
    const accountQuery = await client.query(
        `SELECT 
            sa.account_no,
            sa.balance,
            sa.active_status,
            sa.created_customer_nic,
            sp.plan_name,
            COUNT(ah.customer_nic) as holder_count
        FROM savingsAccounts sa
        LEFT JOIN accountHolders ah ON sa.account_no = ah.account_no
        LEFT JOIN savingsPlans sp ON sa.plan_id = sp.plan_id
        WHERE sa.account_no = $1
        GROUP BY sa.account_no, sa.balance, sa.active_status, sa.created_customer_nic, sp.plan_name
        HAVING COUNT(ah.customer_nic) > 1`,
        [account_no]
    );
    
    if (accountQuery.rows.length === 0) {
        return { ok: false, message: 'No joint account found with this account number' };
    }
    
    // Check if customer exists and is active
    const customerCheck = await client.query(
        'SELECT is_active FROM customers WHERE UPPER(TRIM(nic)) = $1',
        [normalizedNic]
    );

    if (customerCheck.rows.length === 0) {
        return { ok: false, message: 'Customer not found' };
    }

    if (!customerCheck.rows[0].is_active) {
        return { ok: false, message: 'This customer is inactive and cannot perform any actions on this account' };
    }
    
    // Check if NIC is a holder of this account
    const holderQuery = await client.query(
        `SELECT role, customer_nic
        FROM accountHolders
        WHERE account_no = $1 AND UPPER(customer_nic) = $2`,
        [account_no, normalizedNic]
    );
    
    if (holderQuery.rows.length === 0) {
        return { ok: false, message: 'This NIC is not associated with the specified account' };
    }
    
    const holderRole = holderQuery.rows[0].role;
    
    if (holderRole !== 'primary') {
        return { ok: false, message: 'Only primary account holders can activate/deactivate the account' };
    }
    
    // Get all holders for display
    const holdersQuery = await client.query(
        `SELECT customer_nic as nic, role
        FROM accountHolders
        WHERE account_no = $1
        ORDER BY role DESC`,
        [account_no]
    );
    
    return {
        ok: true,
        account: {
            ...accountQuery.rows[0],
            holders: holdersQuery.rows
        }
    };
};