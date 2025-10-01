import pool from '../../database.js';

export const addNewCustomer = async(username, name, email, phone, NIC,
        gender, address, DOB, agent_id)=>{

    await pool.query(
        'insert into customers (username,name,email,phone,NIC,gender,address,DOB,registered_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [username,name,email,phone,NIC,gender,address,DOB,agent_id]
    );
}

export const searchCustomer = async(username)=>{
    const {rows} = await pool.query(
        'select * from customers where username=$1',[username]
    );
    return rows[0];
};
