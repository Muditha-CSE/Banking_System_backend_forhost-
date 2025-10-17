
export const loginmodel = async (pool,username)=>{
    const {rows} = await pool.query(
        'select la.*, adm.is_active as admin_is_active, ag.is_active as agent_is_active from login_authentication la left join admins adm on la.user_id = adm.user_id left join agents ag on la.user_id = ag.user_id where la.username=$1',[username]
    );
    return rows[0];
};

export const loginCustomerModel = async (pool, nic) => {
    const {rows} = await pool.query(
        `SELECT 
            c.customer_id,
            c.nic,
            c.password,
            c.is_active
        FROM customers c
        WHERE UPPER(c.nic) = UPPER($1)`,
        [nic]
    );
    return rows[0];
};

export const searchUser = async (client,username)=>{
    const {rows} = await client.query(
        'select * from login_authentication where username=$1',[username]
    );
    return rows[0];
}
