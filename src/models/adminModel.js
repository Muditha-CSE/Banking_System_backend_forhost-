
export const addNewAdminToLog = async (client,username,password,name,email,phone,NIC,created_by)=>{

    const {rows} = await client.query(
        'insert into login_authentication (username,password,role) values ($1,$2,$3) Returning user_id',[username,password,'admin']
    );
    const user_id = rows[0].user_id;

    await client.query(
        'insert into admins (user_id,name,email,phone,NIC,created_by) values ($1,$2,$3,$4,$5,$6)',[user_id,name,email,phone,NIC,created_by]
    );
};

export const addNewAgentToLog = async (client,username,password,name,email,phone,NIC,created_by,branch_id)=>{

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
    await client.query(
        'insert into branches (branch_name,branch_address,telephone_no,working_hours_start,working_hours_end,creted_by) values ($1,$2,$3,$4,$5,$6)',
        [branch_name,branch_address,telephone_no,working_hours_start,working_hours_end,created_by]
    );
};

export const getAgentId = async (client,username)=>{
    const {rows} = await client.query(
        'select user_id from login_authentication where username=$1 and role=$2',[username,'agent']
    );
    return rows[0].user_id;
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
            SELECT transaction_done_by, SUM(amount) AS total_amount, COUNT(*) AS tx_count
            FROM acc_to_acc_transactions
            GROUP BY transaction_done_by
        ) a ON a.transaction_done_by = l.user_id

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

        from savingsAccounts a
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
    const {rows} = await client.query(
        `select fd_account_no, 
        last_interest_date + INTERVAL '30 days' AS next_interest_date
        from fixedDepositAccounts
        where status = 'active'`
    );
    return rows;
};

export const getMonthlyInterestDistribution = async (pool)=>{
    const {rows} = await pool.query(
        `select p.plan_name,COALESCE(sum(t.amount),0) AS total_interest_distributed
        from savingsPlans p
        left join savingsAccounts s on s.plan_id = p.plan_id
        left join interest_payments t on t.savings_account_no = s.account_no and t.interest_type = 'savings'
        and t.status = 'completed' and t.transaction_date >= date_trunc('month', CURRENT_DATE)
        group by p.plan_name`
    );
    return rows;
};

export const customerId = async (client,NIC)=>{
    const {rows} = await client.query(
        `select customer_id from customers where nic = $1`,[NIC]
    );
    return rows[0].customer_id;
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
    JOIN savingsAccounts sa ON sa.account_no = a.account_no
    JOIN savingsPlans sp ON sp.plan_id = sa.plan_id
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
    JOIN savingsAccounts sa ON sa.account_no = a.account_no
    JOIN savingsPlans sp ON sp.plan_id = sa.plan_id
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
