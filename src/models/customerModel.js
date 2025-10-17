export const customerDetails = async(pool,nic)=>{
    const result = await pool.query(
        `SELECT 
            ah.account_no,
            ah.role,
            s.balance as savings_balance,
            s.active_status as savings_status,
            f.fd_account_no,
            f.deposit_amount as fd_amount,
            f.start_date as fd_start_date,
            (f.start_date + (p.plan_duration_months::text || ' months')::interval) as fd_maturity_date,
            f.status as fd_status,
            f.last_interest_date as fd_last_interest_date,
            f.fd_plan_id as fd_plan_id,
            p.plan_name as fd_plan_name,
            p.plan_duration_months as fd_duration_months,
            p.interest_rate as fd_interest_rate,
            atas.transaction_id as transfer_sent_id,
            atas.amount as transfer_sent_amount,
            atas.receiver_account_no as transfer_sent_to,
            atas.transaction_done_by as transfer_sent_by,
            atas.transaction_date as transfer_sent_date,
            atar.transaction_id as transfer_received_id,
            atar.amount as transfer_received_amount,
            atar.sender_account_no as transfer_received_from,
            atar.transaction_done_by as transfer_received_by,
            atar.transaction_date as transfer_received_date,
            athd.transaction_id as deposit_id,
            athd.amount as deposit_amount,
            athd.transaction_done_by as deposit_by,
            athd.transaction_date as deposit_date,
            athw.transaction_id as withdraw_id,
            athw.amount as withdraw_amount,
            athw.transaction_done_by as withdraw_by,
            athw.transaction_date as withdraw_date,
            ips.transaction_id as savings_interest_id,
            ips.amount as savings_interest_amount,
            ips.transaction_done_by as savings_interest_by,
            ips.transaction_date as savings_interest_date,
            ipf.transaction_id as fd_interest_id,
            ipf.amount as fd_interest_amount,
            ipf.transaction_done_by as fd_interest_by,
            ipf.transaction_date as fd_interest_date
        FROM accountHolders ah
        LEFT JOIN savingsAccounts s ON ah.account_no = s.account_no
        LEFT JOIN fixedDepositAccounts f ON ah.account_no = f.linked_account_no
        LEFT JOIN fixedDepositsPlans p ON f.fd_plan_id = p.fd_plan_id
        LEFT JOIN acc_to_acc_transactions atas ON ah.account_no = atas.sender_account_no
        LEFT JOIN acc_to_acc_transactions atar ON ah.account_no = atar.receiver_account_no
        LEFT JOIN acc_to_hand_transactions athd ON ah.account_no = athd.account_no AND athd.cash_direction='deposit'
        LEFT JOIN acc_to_hand_transactions athw ON ah.account_no = athw.account_no AND athw.cash_direction='withdraw'
    LEFT JOIN interest_payments ips ON ah.account_no = ips.savings_account_no AND ips.interest_type='savings'
    LEFT JOIN interest_payments ipf ON ah.account_no = ipf.savings_account_no AND ipf.interest_type='fixed_deposit'
        WHERE UPPER(ah.customer_nic) = UPPER($1)
        ORDER BY ah.account_no, 
            COALESCE(atas.transaction_date, atar.transaction_date, athd.transaction_date, athw.transaction_date, ips.transaction_date, ipf.transaction_date) DESC`,
        [nic]
    );
    return result.rows;
};

export const checkAccounts = async(pool,nic)=>{
    const {rows} = await pool.query(
        'select * from accountHolders where UPPER(customer_nic) = UPPER($1)',
        [nic]
    );
    return rows;
};