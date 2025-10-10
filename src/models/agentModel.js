
export const addNewCustomer = async (client,username, name, email, phone, NIC,
        gender, address, DOB, agent_id,branch_id)=>{

    await client.query(
        'insert into customers (username,name,email,phone,NIC,gender,address,DOB,registered_by,branch_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [username,name,email,phone,NIC,gender,address,DOB,agent_id,branch_id]
    );
}
export const searchCustomer = async (client, NICs) => {
    const { rows } = await client.query(
        'SELECT * FROM customers WHERE nic = ANY($1)',
    [NICs]
    );

    const existingNICs = rows.map(r => r.nic);
    const missing = NICs.filter(nic => !existingNICs.includes(nic));
    if(missing.length > 0){
        return {ok: false, missing};
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

export const createSavingsAccount = async(client,users,initial_deposit,agent_id,branch_id,plan_id,customer_created)=>{

    const {rows} = await client.query(
        'insert into savingsAccounts (plan_id,branch_id,created_by,balance,created_customer_nic) values ($1,$2,$3,$4,$5) returning account_no',
        [plan_id,branch_id,agent_id,initial_deposit,customer_created]
    );
    const account_no = rows[0].account_no;

    for (const user of users) {
        await client.query(
            'insert into accountHolders (account_no,customer_nic,role) values ($1,$2,$3)', 
            [account_no,user.nic,user.role]
        );
    }
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
        'select role from accountHolders where account_no = $1 and customer_nic = $2',[account_no,NIC]
    );
    return rows[0].role;
};

export const createFixedDepositeAccount = async(client,account_no,fd_plan_id,amount,agent_id)=>{
    await client.query(
        'insert into fixedDepositAccounts (linked_account_no,fd_plan_id,deposit_amount,created_by) values ($1,$2,$3,$4)',
        [account_no,fd_plan_id,amount,agent_id]
    );
};

export const accountChecker = async(client,account_no,customer_nic)=>{
    const {rows} = await client.query(
        'select * from accountHolders where account_no = $1 and customer_nic = $2',[account_no,customer_nic]
    );
    return rows[0];
};

export const makeDepositeAccount = async(client,account_no,amount,agent_id,customer_nic)=>{

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