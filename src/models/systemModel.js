import pool from '../../database.js';

export const calculateMonthlyInterest = async () => {

    const client = await pool.connect();
    try{
        await client.query('BEGIN');

        const {rows:Accounts} = await client.query(
            `select s.account_no,s.balance,p.interest_rate from savingsAccounts s 
            join 
            savingsPlans p on s.plan_id = p.plan_id 
            where NOW()-s.last_interest_date >= interval '30 days';`
        );
        for(const account of Accounts){

            const interest = (account.balance*(account.interest_rate/100))/12;
            await client.query(
                `update savingsAccounts set balance = balance + $1, last_interest_date = NOW() where account_no = $2`,
                [interest,account.account_no]
            );
            await client.query(
                `insert into interest_payments (savings_account_no,amount,status,description) values($1,$2,$3,$4)`,
                [account.account_no,interest,'completed','monthly savings Acount interest payment']
            )
            await logSystemActivity(client, 'INTEREST_PAYMENT', `Monthly interest of ${interest} added to account ${account.account_no}`, null);
        }
        await client.query('COMMIT');
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        throw err;
    }finally{
        client.release();
    }
};



export const fdInterestPayment = async () => {

    const client = await pool.connect();
    try{
        await client.query('BEGIN');

        const {rows:Accounts} = await client.query(
            `select f.deposite_amount,p.interest_rate,s.account_no from savingsAccounts s 
            join 
            fixedDepositAccounts f on f.linked_account_no = s.account_no
            join
            fixedDepositPlans p on f.fd_plan_id = p.fd_plan_id
            where NOW()-s.last_interest_date >= interval '30 days'
            and f.status = 'active';`
        );
        for(const account of Accounts){

            const interest = (account.deposite_amount*(account.interest_rate/100))/12;
            await client.query(
                `update savingsAccounts set balance = balance + $1, last_interest_date = NOW() where account_no = $2`,
                [interest,account.account_no]
            );
            await client.query(
                `insert into interest_payments (savings_account_no,amount,status,description) values($1,$2,$3,$4)`,
                [account.account_no,interest,'completed','monthly Fixed Deposit interest payment']
            )
            await logSystemActivity(client, 'FD_INTEREST_PAYMENT', `Monthly FD_interest of ${interest} added to account ${account.account_no}`, null);
        }
        await client.query('COMMIT');
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        throw err;
    }finally{
        client.release();
    }
};

export const removeFDAfterMaturity = async () => {

    const client = await pool.connect();
    try{
        await client.query('BEGIN');

        const {rows:FDacc} = await client.query(
            `select f.deposite_amount,s.account_no,p.plan_duration_months from savingsAccounts s
            join
            fixedDepositAccounts f on f.linked_account_no = s.account_no
            join
            fixedDepositPlans p on f.fd_plan_id = p.fd_plan_id
            where NOW() >= f.start_date + (p.plan_duration_months || ' months')::interval;`
        );
        for(const account of FDacc){

            await client.query(
                `update fixedDepositAccounts set status = 'matured' where account_no = $1`,
                [account.account_no]
            );
            await client.query(
                `update savingsAccounts set balance = balance + $1 where account_no = $2`,
                [account.deposite_amount,account.account_no]
            );
            await logSystemActivity(client, 'FD_MATURITY', `Fixed Deposit account ${account.account_no} matured and amount ${account.deposite_amount} credited to savings account`, null);
        }
        await client.query('COMMIT');
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        throw err;
    }finally{
        client.release();
    }
};

export const logSystemActivity = async (client, activity_type, description, performed_by) => {

    await client.query(
        'INSERT INTO systemLogs (activity_type, description, performed_by) VALUES ($1, $2, $3)',
        [activity_type, description, performed_by]
    );
}

