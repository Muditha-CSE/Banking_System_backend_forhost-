
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

export const searchCustomerByNIC = async (username) => {
    const { rows } = await pool.query(
        'select * from customers where NIC=$1', [username]
    );
    return rows[0];
};
