import pool from '../../database.js';

export const loginmodel = async (username)=>{
    console.log("Reached login model");
    const {rows} = await pool.query(
        'select * from login_authenticator where username=$1',[username]
    );
    return rows[0];
}

