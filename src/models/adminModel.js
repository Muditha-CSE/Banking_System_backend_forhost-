

export const addNewAdminToLog = async (client,username,password,name,email,phone,NIC,created_by)=>{

    await client.query(`SET LOCAL app.current_user_id = '${created_by}'`);

    const {rows} = await client.query(
        'insert into login_authentication (username,password,role) values ($1,$2,$3) Returning user_id',[username,password,'admin']
    );
    const user_id = rows[0].user_id;

    await client.query(
        'insert into admins (user_id,name,email,phone,NIC,created_by) values ($1,$2,$3,$4,$5,$6)',[user_id,name,email,phone,NIC,created_by]
    );
};

export const addNewAgentToLog = async (client,username,password,name,email,phone,NIC,created_by,branch_id)=>{

    await client.query(`SET LOCAL app.current_user_id = '${created_by}'`);

    const {rows} = await client.query(
        'insert into login_authentication (username,password,role) values ($1,$2,$3) Returning user_id',[username,password,'agent']
    );
    const user_id = rows[0].user_id;

    await client.query(
        'insert into agents (user_id,name,email,phone,NIC,created_by,branch_id) values ($1,$2,$3,$4,$5,$6,$7)',[user_id,name,email,phone,NIC,created_by,branch_id]
    );
};

export const branchChecker = async (client,branch_name)=>{
    const {rows} = await client.query(
        'select * from branches where branch_name=$1',[branch_name]
    );
    return rows.length>0;
};

export const createBranch = async (client,branch_name,branch_address,telephone_no,working_hours_start,working_hours_end,created_by)=>{
    
    await client.query(`SET LOCAL app.current_user_id = '${created_by}'`);
    
    await client.query(
        'insert into branches (branch_name,branch_address,telephone_no,working_hours_start,working_hours_end,created_by) values ($1,$2,$3,$4,$5,$6)',
        [branch_name,branch_address,telephone_no,working_hours_start,working_hours_end,created_by]
    );
};

export const getAgentId = async (client,username)=>{
    const {rows} = await client.query(
        'select user_id from login_authentication where username=$1 and role=$2',[username,'agent']
    );
    return rows[0].user_id;
};

// Fetch a single agent by username (for editing)
export const getAgentByUsername = async (pool, username) => {
    const { rows } = await pool.query(
        `SELECT 
            l.user_id,
            l.username,
            a.name,
            a.email,
            a.phone,
            a.nic,
            a.branch_id
         FROM login_authentication l
         JOIN agents a ON a.user_id = l.user_id
         WHERE l.role = 'agent' AND l.username = $1`,
        [username]
    );
    return rows[0];
};

// List agents (basic info)
export const listAgents = async (pool) => {
    const { rows } = await pool.query(
        `SELECT 
            l.user_id,
            l.username,
            a.name,
            a.email,
            a.phone,
            a.nic,
            a.branch_id,
            a.is_active
         FROM login_authentication l
         JOIN agents a ON a.user_id = l.user_id
         WHERE l.role = 'agent'
         ORDER BY l.username`
    );
    return rows;
};

// Update agent details by username; updates optional fields; returns updated record
export const updateAgentByUsername = async (client, actingUserId, currentUsername, updates) => {
    await client.query(`SET LOCAL app.current_user_id = '${actingUserId}'`);

    // Resolve user_id
    const { rows: lu } = await client.query(
        `SELECT user_id FROM login_authentication WHERE username=$1 AND role='agent'`,
        [currentUsername]
    );
    if (lu.length === 0) {
        throw new Error('Agent not found');
    }
    const userId = lu[0].user_id;

    // Optionally update login_authentication (username/password)
    const loginSets = [];
    const loginVals = [];
    let idx = 1;
    if (updates.newUsername) {
        loginSets.push(`username = $${idx++}`);
        loginVals.push(updates.newUsername);
    }
    if (updates.passwordHash) {
        loginSets.push(`password = $${idx++}`);
        loginVals.push(updates.passwordHash);
    }
    if (loginSets.length > 0) {
        loginVals.push(userId);
        await client.query(
            `UPDATE login_authentication SET ${loginSets.join(', ')} WHERE user_id = $${idx}`,
            loginVals
        );
    }

    // Dynamically build agents update
    const agentSets = [];
    const agentVals = [];
    idx = 1;
    if (updates.name) { agentSets.push(`name = $${idx++}`); agentVals.push(updates.name); }
    if (updates.email) { agentSets.push(`email = $${idx++}`); agentVals.push(updates.email); }
    if (updates.phone) { agentSets.push(`phone = $${idx++}`); agentVals.push(updates.phone); }
    if (updates.nic) { agentSets.push(`nic = UPPER($${idx++})`); agentVals.push(updates.nic); }
    if (typeof updates.branch_id !== 'undefined') { agentSets.push(`branch_id = $${idx++}`); agentVals.push(updates.branch_id); }

    if (agentSets.length > 0) {
        agentVals.push(userId);
        await client.query(
            `UPDATE agents SET ${agentSets.join(', ')} WHERE user_id = $${idx}`,
            agentVals
        );
    }

    // Return updated view
    const { rows: out } = await client.query(
        `SELECT 
            l.user_id,
            l.username,
            a.name,
            a.email,
            a.phone,
            a.nic,
            a.branch_id
         FROM login_authentication l
         JOIN agents a ON a.user_id = l.user_id
         WHERE l.user_id = $1`,
        [userId]
    );
    return out[0];
};



export const transactionsByAgents = async (pool)=>{
    const {rows} = await pool.query(
        `SELECT l.username AS username,
        COALESCE(d.total_amount, 0) AS total_deposits,
        COALESCE(w.total_amount, 0) AS total_withdrawals,
        COALESCE(a.total_amount, 0) AS total_accToacc,
        COALESCE(d.tx_count, 0) AS deposit_count,
        COALESCE(w.tx_count, 0) AS withdrawal_count,
        COALESCE(a.tx_count, 0) AS accToacc_count,
        COALESCE(d.tx_count, 0) + COALESCE(w.tx_count, 0) + COALESCE(a.tx_count, 0) AS total_transactions,
        COALESCE(d.total_amount, 0) + COALESCE(w.total_amount, 0) + COALESCE(a.total_amount, 0) AS total_amount
        FROM login_authentication l

        LEFT JOIN (
            SELECT transaction_done_by, SUM(amount) AS total_amount, COUNT(*) AS tx_count
            FROM acc_to_hand_transactions
            WHERE cash_direction = $1
            GROUP BY transaction_done_by
        ) d ON d.transaction_done_by = l.user_id

        LEFT JOIN (
            SELECT transaction_done_by, SUM(amount) AS total_amount, COUNT(*) AS tx_count
            FROM acc_to_hand_transactions
            WHERE cash_direction = $2
            GROUP BY transaction_done_by
        ) w ON w.transaction_done_by = l.user_id

        LEFT JOIN (
            SELECT 
                COALESCE(t.transaction_done_by, sa.created_by) AS agent_user_id,
                SUM(t.amount) AS total_amount,
                COUNT(*) AS tx_count
            FROM acc_to_acc_transactions t
            LEFT JOIN savingsaccounts sa ON sa.account_no = t.sender_account_no
            /* Count only completed transfers if status is used; remove this line if not applicable */
            /* WHERE t.status = 'completed' */
            GROUP BY COALESCE(t.transaction_done_by, sa.created_by)
        ) a ON a.agent_user_id = l.user_id

        WHERE l.role = $3
        ORDER BY l.username;`,
        ['deposit','withdraw','agent']
    );
    return rows;
};


export const accontWiseTransactions = async (client)=>{
    const {rows} = await client.query(
        `select a.account_no AS Account_No,
        COALESCE(d.amount,0) AS total_deposits,
        COALESCE(w.amount,0) AS total_withdrawals,
        COALESCE(s.amount,0) AS total_sent,
        COALESCE(r.amount,0) AS total_received,
        COALESCE(d.t_count,0) AS deposit_count,
        COALESCE(w.t_count,0) AS withdrawal_count,
        COALESCE(s.t_count,0) AS sent_count,
        COALESCE(r.t_count,0) AS received_count,

        COALESCE(d.amount,0)+COALESCE(w.amount,0)+COALESCE(r.amount,0)+COALESCE(s.amount,0) AS total_transaction_amount,

        COALESCE(d.t_count,0)+COALESCE(w.t_count,0)+COALESCE(r.t_count,0)+COALESCE(s.t_count,0) AS total_transaction_count

        from savingsaccounts a
        left join (
            select account_no, sum(amount) AS amount, count(amount) AS t_count
            from acc_to_hand_transactions
            where cash_direction=$1
            group by account_no
        ) AS d ON d.account_no = a.account_no

        left join (
            select account_no, sum(amount) AS amount, count(amount) AS t_count
            from acc_to_hand_transactions
            where cash_direction=$2
            group by account_no
        ) AS w ON w.account_no = a.account_no
        left join (
            select sender_account_no, sum(amount) AS amount, count(amount) AS t_count
            from acc_to_acc_transactions
            group by sender_account_no
        ) AS s ON s.sender_account_no = a.account_no
        left join (
            select receiver_account_no, sum(amount) AS amount, count(amount) AS t_count
            from acc_to_acc_transactions
            group by receiver_account_no
        ) AS r ON r.receiver_account_no = a.account_no`,

        ['deposit','withdraw']
    );
    return rows;
};

export const getFDInfo = async (client)=>{
    // Return all required fields for frontend FD report
    const {rows} = await client.query(
        `SELECT 
            f.fd_account_no,
            (f.deposit_amount)::float AS amount,
            f.start_date,
            f.end_date,
            p.interest_rate,
            f.status,
            f.is_active,
            f.last_interest_date + INTERVAL '30 days' AS next_interest_date,
            ah.customer_nic,
            c.name AS customer_name,
            la.username AS agent_username
        FROM fixeddepositaccounts f
        LEFT JOIN savingsaccounts sa ON sa.account_no = f.linked_account_no
        LEFT JOIN accountholders ah ON ah.account_no = sa.account_no AND ah.role = 'primary'
        LEFT JOIN customers c ON c.nic = ah.customer_nic
        LEFT JOIN login_authentication la ON la.user_id = f.created_by
        LEFT JOIN fixeddepositsplans p ON p.fd_plan_id = f.fd_plan_id
        WHERE f.status = 'active' AND f.is_active = TRUE`
    );
    return rows;
};

export const getMonthlyInterestDistribution = async (pool)=>{
    const {rows} = await pool.query(
        `SELECT 
            date_trunc('month', CURRENT_DATE) AS month_start_date,
            p.plan_name,
            COALESCE(sum(t.amount), 0) AS total_interest_distributed,
            COUNT(t.transaction_id) AS interest_payment_count
        FROM savingsplans p
        LEFT JOIN savingsaccounts s ON s.plan_id = p.plan_id
        LEFT JOIN interest_payments t ON t.savings_account_no = s.account_no 
            AND t.interest_type = 'savings'
            AND t.status = 'completed' 
            AND t.transaction_date >= date_trunc('month', CURRENT_DATE)
        GROUP BY p.plan_name, date_trunc('month', CURRENT_DATE)
        ORDER BY p.plan_name`
    );
    return rows;
};

export const customerId = async (client,NIC)=>{
    const {rows} = await client.query(
        `select customer_id from customers where nic = $1`,[NIC]
    );
    return rows.length > 0 ? rows[0].customer_id : null;
};

export const GetCustomerActivity = async (pool,nic)=>{
    const {rows:allaccdetails} = await pool.query(
   `SELECT 
    a.account_no,
    sa.balance,
    sp.plan_name,
    COALESCE(d.total_deposits, 0) AS total_deposits,
    COALESCE(w.total_withdrawals, 0) AS total_withdrawals,
    COALESCE(s.total_accToacc_sent, 0) AS total_accToacc_sent,
    COALESCE(r.total_accToacc_received, 0) AS total_accToacc_received
    FROM accountholders a
    JOIN customers c ON c.nic = a.customer_nic
    JOIN savingsaccounts sa ON sa.account_no = a.account_no
    JOIN savingsplans sp ON sp.plan_id = sa.plan_id
    LEFT JOIN (
        SELECT account_no, SUM(amount) AS total_deposits
        FROM acc_to_hand_transactions 
        WHERE cash_direction = 'deposit'
        GROUP BY account_no
    ) d ON d.account_no = a.account_no
    LEFT JOIN (
        SELECT account_no, SUM(amount) AS total_withdrawals
        FROM acc_to_hand_transactions
        WHERE cash_direction = 'withdraw'
        GROUP BY account_no
    ) w ON w.account_no = a.account_no
    LEFT JOIN (
        SELECT sender_account_no, SUM(amount) AS total_accToacc_sent
        FROM acc_to_acc_transactions
        GROUP BY sender_account_no
    ) s ON s.sender_account_no = a.account_no
    LEFT JOIN (
        SELECT receiver_account_no, SUM(amount) AS total_accToacc_received
        FROM acc_to_acc_transactions
        GROUP BY receiver_account_no
    ) r ON r.receiver_account_no = a.account_no
    WHERE c.nic = $1;`,
    [nic]
    );

    const {rows:nameNIC} = await pool.query(
        `select name,username,nic from customers where nic = $1`,[nic]
    );

    return {nameNIC:nameNIC[0],allaccdetails:allaccdetails};
};

export const checkAccount = async (client,acc_no,nic)=>{
    const {rows} = await client.query(
        `select * from accountholders where account_no = $1 and customer_nic = $2`,[acc_no,nic]
    );
    return rows.length>0;
};

export const GetCustomerActivityByAcc = async (pool,nic,acc_no)=>{
    
    const { rows } = await pool.query(
   `SELECT 
    c.nic,
    c.name,
    a.account_no,
    sa.balance,
    sp.plan_name,
    COALESCE(d.total_deposits, 0) AS total_deposits,
    COALESCE(w.total_withdrawals, 0) AS total_withdrawals,
    COALESCE(s.total_accToacc_sent, 0) AS total_accToacc_sent,
    COALESCE(r.total_accToacc_received, 0) AS total_accToacc_received
    FROM accountholders a
    JOIN customers c ON c.nic = a.customer_nic
    JOIN savingsaccounts sa ON sa.account_no = a.account_no
    JOIN savingsplans sp ON sp.plan_id = sa.plan_id
    LEFT JOIN (
        SELECT account_no, SUM(amount) AS total_deposits
        FROM acc_to_hand_transactions 
        WHERE cash_direction = 'deposit'
        GROUP BY account_no
    ) d ON d.account_no = a.account_no
    LEFT JOIN (
        SELECT account_no, SUM(amount) AS total_withdrawals
        FROM acc_to_hand_transactions
        WHERE cash_direction = 'withdraw'
        GROUP BY account_no
    ) w ON w.account_no = a.account_no
    LEFT JOIN (
        SELECT sender_account_no, SUM(amount) AS total_accToacc_sent
        FROM acc_to_acc_transactions
        GROUP BY sender_account_no
    ) s ON s.sender_account_no = a.account_no
    LEFT JOIN (
        SELECT receiver_account_no, SUM(amount) AS total_accToacc_received
        FROM acc_to_acc_transactions
        GROUP BY receiver_account_no
    ) r ON r.receiver_account_no = a.account_no
    WHERE c.nic = $1 AND a.account_no = $2
    GROUP BY c.nic, c.name, a.account_no, sa.balance, sp.plan_name, d.total_deposits, w.total_withdrawals, s.total_accToacc_sent, r.total_accToacc_received;`,
[nic, acc_no]
);
    return rows[0];
};

export const getsystemLogs = async (pool)=>{
    const {rows} = await pool.query(
        `select * from systemlogs order by performed_at DESC`
    );
    return rows;
}

export const getauditLogs = async (pool)=>{
    const {rows} = await pool.query(
        `select * from audit_logs order by changed_at DESC`
    );
    return rows;
}

// Delete agent by username
// replacementAgentId: user_id of the agent to whom customers should be reassigned
// replacementAgentUsername: username of the agent to whom customers should be reassigned
export const deleteAgentByUsername = async (client, adminId, username, replacementAgentUsername) => {
    try {
        await client.query(`SET LOCAL app.current_user_id = '${adminId}'`);

        // First check if agent exists and get user_id from login_authentication
        const { rows: agent } = await client.query(
            `SELECT la.user_id
             FROM login_authentication la
             JOIN agents a ON a.user_id = la.user_id
             WHERE UPPER(la.username) = UPPER($1) AND la.role = 'agent'`,
            [username]
        );
        if (agent.length === 0) {
            throw new Error('Agent not found');
        }
        const userId = agent[0].user_id;

        // Resolve replacement agent username to user_id from login_authentication
        const { rows: replacement } = await client.query(
            `SELECT la.user_id
             FROM login_authentication la
             JOIN agents a ON a.user_id = la.user_id
             WHERE UPPER(la.username) = UPPER($1) AND la.role = 'agent'`,
            [replacementAgentUsername]
        );
        if (replacement.length === 0) {
            throw new Error('Replacement agent not found');
        }
        const replacementAgentId = replacement[0].user_id;

        // Reassign all customers registered by this agent to the replacement agent
        await client.query(
            `UPDATE customers SET registered_by = $1 WHERE registered_by = $2`,
            [replacementAgentId, userId]
        );

        // Deactivate the agent (set is_active = false)
        await client.query(`UPDATE agents SET is_active = FALSE WHERE user_id = $1`, [userId]);

        return { message: 'Agent deactivated and customers reassigned to replacement agent', user_id: userId };
    } catch (err) {
        throw err;
    }
}

// Deactivate self (for admin to deactivate their own account)
export const deactivateSelfAdmin = async (client, adminId) => {
    try {
        await client.query(`SET LOCAL app.current_user_id = '${adminId}'`);
        
        // Check if admin exists and is currently active
        const { rows: adminCheck } = await client.query(
            `SELECT user_id, is_active FROM admins WHERE user_id = $1`,
            [adminId]
        );
        
        if (adminCheck.length === 0) {
            throw new Error('Admin not found');
        }
        
        if (adminCheck[0].is_active === false) {
            throw new Error('Admin account is already deactivated');
        }
        
        // Deactivate the admin
        await client.query(
            `UPDATE admins SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
            [adminId]
        );
        
        return { message: 'Admin account deactivated successfully', user_id: adminId };
    } catch (err) {
        throw err;
    }
}

// List all deactivated admins
export const listDeactivatedAdmins = async (pool) => {
    const { rows } = await pool.query(
        `SELECT a.user_id, l.username, a.name, a.email, a.phone, a.nic, a.is_active, a.created_by
         FROM admins a
         JOIN login_authentication l ON l.user_id = a.user_id
         WHERE a.is_active = FALSE
         ORDER BY a.name`);
    return rows;
};

// Reactivate a deactivated admin
export const reactivateAdmin = async (client, actingAdminId, adminUserId) => {
    await client.query(`SET LOCAL app.current_user_id = '${actingAdminId}'`);
    const { rows } = await client.query(
        `UPDATE admins SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING user_id`,
        [adminUserId]
    );
    return rows[0];
};