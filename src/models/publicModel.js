
export const loginmodel = async (pool,username)=>{
    const {rows} = await pool.query(
        'select * from login_authentication where username=$1',[username]
    );
    return rows[0];
}

export const searchUser = async (client,username)=>{
    const {rows} = await client.query(
        'select * from login_authentication where username=$1',[username]
    );
    return rows[0];
}
