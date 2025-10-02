import pool from '../../database.js';

export const addNewCustomer = async (username, name, email, phone, NIC,
        gender, address, DOB, agent_id,branch_id)=>{

    await pool.query(
        'insert into customers (username,name,email,phone,NIC,gender,address,DOB,registered_by,branch_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [username,name,email,phone,NIC,gender,address,DOB,agent_id,branch_id]
    );
}

export const searchCustomer = async(username)=>{
    const {rows} = await pool.query(
        'select * from customers where username=$1',[username]
    );
    return rows[0];
};

export const getAgentBranch = async(agent_id)=>{
    const {rows} = await pool.query(
        'select branch_id from agents where user_id=$1',[agent_id]
    );
    return rows[0].branch_id;
};