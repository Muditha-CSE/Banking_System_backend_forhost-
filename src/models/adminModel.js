import pool from '../../database.js'


export const addNewAdminToLog = async (username,password,name,email,phone,NIC)=>{

    const client = await pool.connect(); 

    try{
        await client.query('BEGIN');
        const {rows} = await client.query(
            'insert into login_authentication (username,password,role) values ($1,$2,$3) Returning user_id',[username,password,'admin']
        );
        const user_id = rows[0].user_id;

        await client.query(
            'insert into admins (user_id,name,email,phone,NIC) values ($1,$2,$3,$4,$5)',[user_id,name,email,phone,NIC]
        );
        await client.query('COMMIT');
    }catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const addNewAgentToLog = async (username,password,name,email,phone,NIC)=>{

    const client = await pool.connect()
    try{
        await client.query('BEGIN');
        const {rows} = await client.query(
            'insert into login_authentication (username,password,role) values ($1,$2,$3) Returning user_id',[username,password,'agent']
        );
        const user_id = rows[0].user_id;

        await client.query(
            'insert into agents (user_id,name,email,phone,NIC) values ($1,$2,$3,$4,$5)',[user_id,name,email,phone,NIC]
        );
        await client.query('COMMIT');
    }catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


