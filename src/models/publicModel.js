import pool from '../../database.js';

export const loginmodel = async (username)=>{
    const {rows} = await pool.query(
        'select * from login_authentication where username=$1',[username]
    );
    return rows[0];
}

export const searchUser = async (username)=>{
    const {rows} = await pool.query(
        'select * from login_authentication where username=$1',[username]
    );
    return rows[0];
}
