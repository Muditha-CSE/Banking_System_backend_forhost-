import pool from '../../database.js';

export const calculateMonthlyInterest = async () => {

    const client = await pool.connect();
    try{
        await client.query('BEGIN');

        await client.query(`SET LOCAL app.current_user_id = 0`);

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

        await client.query(`SET LOCAL app.current_user_id = 0`)

        const {rows:Accounts} = await client.query(
            `select f.deposit_amount, f.fd_account_no, p.interest_rate, s.account_no, f.last_interest_date from savingsAccounts s 
            join 
            fixedDepositAccounts f on f.linked_account_no = s.account_no
            join
            fixedDepositsPlans p on f.fd_plan_id = p.fd_plan_id
            where NOW() - f.last_interest_date >= interval '30 days'
            and f.is_active = TRUE;`
        );
        for(const account of Accounts){

            const interest = (account.deposit_amount*(account.interest_rate/100))/12;
            await client.query(
                `update savingsAccounts set balance = balance + $1 where account_no = $2`,
                [interest, account.account_no]
            );
            await client.query(
                `update fixedDepositAccounts set last_interest_date = NOW() where fd_account_no = $1`,
                [account.fd_account_no]
            );
            await client.query(
                `insert into interest_payments (savings_account_no, amount, status, description, interest_type) values($1,$2,$3,$4,$5)`,
                [account.account_no, interest, 'completed', 'monthly Fixed Deposit interest payment', 'fd']
            )
            await logSystemActivity(client, 'FD_INTEREST_PAYMENT', `Monthly FD interest of ${interest} added to savings account ${account.account_no} from FD ${account.fd_account_no}`, null);
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
                
        await client.query(`SET LOCAL app.current_user_id = 0`);

        const {rows:FDacc} = await client.query(
            `select f.fd_account_no, f.deposit_amount, f.linked_account_no as account_no, p.interest_rate, p.plan_duration_months 
            from fixedDepositAccounts f
            join fixedDepositsPlans p on f.fd_plan_id = p.fd_plan_id
            where NOW() >= f.end_date
            and f.is_active = TRUE;`
        );
        
        console.log(`Found ${FDacc.length} matured FDs to process`);
        
        for(const fd of FDacc){
            // Calculate total amount with interest
            const interestAmount = fd.deposit_amount * (fd.interest_rate / 100);
            const totalAmount = fd.deposit_amount + interestAmount;

            // Mark FD as matured and inactive
            await client.query(
                `update fixedDepositAccounts set status = 'matured', is_active = FALSE where fd_account_no = $1`,
                [fd.fd_account_no]
            );
            
            // Credit full amount + interest to linked savings account
            await client.query(
                `update savingsAccounts set balance = balance + $1 where account_no = $2`,
                [totalAmount, fd.account_no]
            );
            
            // Log interest payment
            await client.query(
                `insert into interest_payments (savings_account_no, amount, status, description, interest_type) values($1,$2,$3,$4,$5)`,
                [fd.account_no, interestAmount, 'completed', 'Fixed Deposit maturity interest', 'fd']
            );
            
            await logSystemActivity(client, 'FD_MATURITY', `Fixed Deposit ${fd.fd_account_no} matured. Total amount ${totalAmount} (principal: ${fd.deposit_amount}, interest: ${interestAmount}) credited to savings account ${fd.account_no}`, null);
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

