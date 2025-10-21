--@ block
CREATE TYPE user_role AS ENUM ('admin','agent','customer','system');

--@block
CREATE TABLE login_authentication(
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL
);
--@block
select *from admins
--@block
DELETE FROM login_authentication
WHERE user_id != 2 AND user_id !=0;



--@block
CREATE TABLE branches(
    branch_id SERIAL PRIMARY KEY,
    branch_name VARCHAR(100) UNIQUE NOT NULL,
    branch_address TEXT NOT NULL,
    telephone_no VARCHAR(15) UNIQUE NOT NULL,
    working_hours_start TIME NOT NULL,
    working_hours_end TIME NOT NULL,
    created_by INT REFERENCES login_authentication(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--@block
CREATE TABLE admins(
    admin_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    user_id INT REFERENCES login_authentication(user_id),
    nic VARCHAR(12) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES login_authentication(user_id)
);

--@block
INSERT INTO login_authentication (username, password, role)
VALUES ('testadmin','$2b$10$OB2.0O6hP.CAWD3.S3QwKu2Ogyy16rQiGI/xuE5i.iVaa8krVQnq2','admin'); --testadmin password is testadmin


--@block
INSERT INTO admins (name, email, phone, user_id, nic, created_by)
VALUES ('testadmin', 'ffvbdv@gmail.com', '057127545455', 1, '444233323v', 1);

--@block
insert into login_authentication (user_id,username, password, role) VALUES
(0,'system','','system')



--@block
INSERT INTO branches (
    branch_name,
    branch_address,
    telephone_no,
    working_hours_start,
    working_hours_end,
    created_by
)
VALUES (
    'Colombo Main Branch',
    '123 Galle Road, Colombo 03',
    '0112345678',
    '08:30:00',
    '17:00:00',
    1  -- assuming user_id = 1 exists in login_authentication
);


--@block
CREATE TABLE savingsPlans(
    plan_id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL,
    interest_rate NUMERIC(5,2) NOT NULL,
    min_balance NUMERIC(15,2) NOT NULL,
    min_age INT NOT NULL,
    max_age INT DEFAULT NULL
);

--@block
if not Exists CREATE TABLE fixedDepositsPlans(
    fd_plan_id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL,
    plan_duration_months INT NOT NULL,
    interest_rate NUMERIC(5,2) NOT NULL,
    min_age INT NOT NULL DEFAULT 0,
    max_age INT DEFAULT NULL
);


--@block
insert into  savingsplans (plan_name, interest_rate, min_balance, min_age,max_age) VALUES
('children savings plan',12,0,0,12),
('Teen savings plan',11,500,13,17),
('Adult savings plan',10,1000,18,59),
('Senior citizen savings plan',13,1000,60,100),
('joint savings plan',7,5000,18,75);
--@block
select * from savingsaccounts
--@block

insert into fixeddepositsplans (plan_name, plan_duration_months, interest_rate, min_age, max_age) VALUES
('6 month fixed deposit',6,13,18,59),
('1 year fixed deposit',12,14,18,59),
('3 year fixed deposit',36,15,18,59);
--@block
-- Procedure: can_open_savings_account
CREATE OR REPLACE FUNCTION can_open_savings_account(p_customer_nic VARCHAR, p_plan_id INT)
RETURNS TABLE(is_eligible BOOLEAN, message TEXT) AS $$
DECLARE
    v_dob DATE;
    v_min_age INT;
    v_max_age INT;
    v_age INT;
    v_plan_name VARCHAR;
BEGIN
    SELECT DOB INTO v_dob FROM customers WHERE nic = p_customer_nic;
    IF v_dob IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Customer not found';
        RETURN;
    END IF;
    SELECT min_age, max_age, plan_name INTO v_min_age, v_max_age, v_plan_name 
    FROM savingsPlans WHERE plan_id = p_plan_id;
    IF v_min_age IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Savings plan not found';
        RETURN;
    END IF;
    v_age := DATE_PART('year', AGE(CURRENT_DATE, v_dob));
    
    IF v_age < v_min_age THEN
        RETURN QUERY SELECT FALSE, 
            format('Customer age (%s) is too young for %s (minimum age: %s)', v_age, v_plan_name, v_min_age);
        RETURN;
    END IF;
    
    IF v_max_age IS NOT NULL AND v_age > v_max_age THEN
        RETURN QUERY SELECT FALSE, 
            format('Customer age (%s) is too old for %s (maximum age: %s)', v_age, v_plan_name, v_max_age);
        RETURN;
    END IF;
    
    RETURN QUERY SELECT TRUE, 'Eligible';
END;
$$ LANGUAGE plpgsql;

--@block
-- Procedure: can_open_fd_account
CREATE OR REPLACE FUNCTION can_open_fd_account(p_customer_nic VARCHAR, p_fd_plan_id INT)
RETURNS TABLE(is_eligible BOOLEAN, message TEXT) AS $$
DECLARE
    v_dob DATE;
    v_min_age INT;
    v_max_age INT;
    v_age INT;
    v_plan_name VARCHAR;
BEGIN
    SELECT DOB INTO v_dob FROM customers WHERE nic = p_customer_nic;
    IF v_dob IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Customer not found';
        RETURN;
    END IF;
    SELECT min_age, max_age, plan_name INTO v_min_age, v_max_age, v_plan_name 
    FROM fixedDepositsPlans WHERE fd_plan_id = p_fd_plan_id;
    IF v_min_age IS NULL THEN
        RETURN QUERY SELECT FALSE, 'FD plan not found';
        RETURN;
    END IF;
    v_age := DATE_PART('year', AGE(CURRENT_DATE, v_dob));
    
    IF v_age < v_min_age THEN
        RETURN QUERY SELECT FALSE, 
            format('Customer age (%s) is too young for %s (minimum age: %s)', v_age, v_plan_name, v_min_age);
        RETURN;
    END IF;
    
    IF v_max_age IS NOT NULL AND v_age > v_max_age THEN
        RETURN QUERY SELECT FALSE, 
            format('Customer age (%s) is too old for %s (maximum age: %s)', v_age, v_plan_name, v_max_age);
        RETURN;
    END IF;
    
    RETURN QUERY SELECT TRUE, 'Eligible';
END;
$$ LANGUAGE plpgsql;

--@block
-- Procedure: create_savings_account_with_age_check
CREATE OR REPLACE FUNCTION create_savings_account_with_age_check(
    p_customer_nic VARCHAR,
    p_plan_id INT,
    p_initial_balance NUMERIC(15,2),
    p_created_by INT,
    p_branch_id INT
)
RETURNS TABLE(account_no INT, status TEXT, message TEXT) AS $$
DECLARE
    v_eligible BOOLEAN;
    v_msg TEXT;
    v_account_no INT;
BEGIN
    -- Check age eligibility
    SELECT eligibility.is_eligible, eligibility.message 
    INTO v_eligible, v_msg 
    FROM can_open_savings_account(p_customer_nic, p_plan_id) AS eligibility;
    
    IF NOT v_eligible THEN
        RETURN QUERY SELECT NULL::INT, 'FAILED'::TEXT, v_msg;
        RETURN;
    END IF;
    
    -- Create the account
    INSERT INTO savingsAccounts (balance, plan_id, created_by, branch_id, created_customer_nic)
    VALUES (p_initial_balance, p_plan_id, p_created_by, p_branch_id, p_customer_nic)
    RETURNING savingsAccounts.account_no INTO v_account_no;
    
    -- Insert into accountHolders
    INSERT INTO accountHolders (role, account_no, customer_nic)
    VALUES ('primary', v_account_no, p_customer_nic);
    
    RETURN QUERY SELECT v_account_no, 'SUCCESS'::TEXT, 'Savings account created successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

--@block
-- Procedure: create_fd_account_with_age_check
CREATE OR REPLACE FUNCTION create_fd_account_with_age_check(
    p_customer_nic VARCHAR,
    p_fd_plan_id INT,
    p_deposit_amount NUMERIC(15,2),
    p_linked_account_no INT,
    p_created_by INT
)
RETURNS TABLE(fd_account_no INT, status TEXT, message TEXT) AS $$
DECLARE
    v_eligible BOOLEAN;
    v_msg TEXT;
    v_fd_account_no INT;
    v_end_date TIMESTAMP;
    v_duration INT;
BEGIN
    -- Check age eligibility
    SELECT eligibility.is_eligible, eligibility.message 
    INTO v_eligible, v_msg 
    FROM can_open_fd_account(p_customer_nic, p_fd_plan_id) AS eligibility;
    
    IF NOT v_eligible THEN
        RETURN QUERY SELECT NULL::INT, 'FAILED'::TEXT, v_msg;
        RETURN;
    END IF;
    
    -- Get plan duration and calculate end date
    SELECT plan_duration_months INTO v_duration 
    FROM fixedDepositsPlans 
    WHERE fd_plan_id = p_fd_plan_id;
    
    v_end_date := NOW() + (v_duration || ' months')::INTERVAL;
    
    -- Create the FD account
    INSERT INTO fixedDepositAccounts (start_date, end_date, deposit_amount, linked_account_no, fd_plan_id, created_by)
    VALUES (NOW(), v_end_date, p_deposit_amount, p_linked_account_no, p_fd_plan_id, p_created_by)
    RETURNING fixedDepositAccounts.fd_account_no INTO v_fd_account_no;
    
    RETURN QUERY SELECT v_fd_account_no, 'SUCCESS'::TEXT, 'Fixed deposit account created successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;



--@block
CREATE TABLE agents(
    agent_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    user_id INT REFERENCES login_authentication(user_id),
    nic VARCHAR(12) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES login_authentication(user_id),
    branch_id INT REFERENCES branches(branch_id),
    is_active BOOLEAN DEFAULT TRUE
);

--@block

select *from customers;

--@block
DELETE FROM branches
WHERE branch_id =6;


--@block

CREATE TYPE gender AS ENUM ('male','female')

--@block
CREATE TABLE customers(
    customer_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255),
    role user_role DEFAULT 'customer';
    is_active BOOLEAN DEFAULT TRUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    nic VARCHAR(12) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    gender gender NOT NULL,
    DOB DATE NOT NULL,
    branch_id INT REFERENCES branches(branch_id),
    registered_by INT REFERENCES login_authentication(user_id),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT REFERENCES login_authentication(user_id),
);


--@block
CREATE TABLE savingsAccounts(
    account_no SERIAL PRIMARY KEY,
    balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    active_status BOOLEAN DEFAULT TRUE,
    last_interest_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    plan_id INT REFERENCES savingsPlans(plan_id),
    created_by INT REFERENCES login_authentication(user_id),
    branch_id INT REFERENCES branches(branch_id),
    updated_by INT REFERENCES login_authentication(user_id),
    created_customer_nic VARCHAR(12) REFERENCES customers(nic),
    deleted_by_customer BOOLEAN DEFAULT FALSE
);

--@block
CREATE TYPE accRole AS ENUM ('primary','secondary')

--@block
CREATE TABLE accountHolders(
    role accRole NOT NULL,
    account_no INT REFERENCES savingsAccounts(account_no),
    customer_nic VARCHAR(12) REFERENCES customers(nic),
    PRIMARY KEY (account_no, customer_nic)
);

--@block
select * from agents

--@block
CREATE TYPE fd_status AS ENUM ('active','matured')

--@block
CREATE TABLE fixedDepositAccounts(
    fd_account_no SERIAL PRIMARY KEY,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    status fd_status DEFAULT 'active' NOT NULL ,
    deposit_amount NUMERIC(15,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_interest_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    linked_account_no INT REFERENCES savingsAccounts(account_no),
    fd_plan_id INT REFERENCES fixedDepositsPlans(fd_plan_id),
    created_by INT REFERENCES login_authentication(user_id)
);
--@block
CREATE TYPE transaction_status AS ENUM ('pending','completed','failed')

--@block

CREATE TABLE transactions(
    transaction_id SERIAL PRIMARY KEY,
    amount NUMERIC(15,2) NOT NULL,
    status transaction_status DEFAULT 'pending',
    description TEXT,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_done_by INT REFERENCES login_authentication(user_id),
    transaction_requested_by VARCHAR(12) REFERENCES customers(nic)
);





--@block
CREATE INDEX idx_transaction_done_by 
ON transactions(transaction_done_by);

--@block
CREATE TABLE acc_to_acc_transactions(
    sender_account_no INT REFERENCES savingsAccounts(account_no),
    receiver_account_no INT REFERENCES savingsAccounts(account_no)
)inherits (transactions);

--@block
CREATE INDEX idx_account_no_acc_to_acc_sender
ON acc_to_acc_transactions(sender_account_no);

--@block
CREATE INDEX idx_account_no_acc_to_acc_receiver
ON acc_to_acc_transactions(receiver_account_no);

--@block
CREATE TYPE cash_direction AS ENUM ('deposit','withdraw')

--@block
CREATE TABLE acc_to_hand_transactions(
    account_no INT REFERENCES savingsAccounts(account_no),
    cash_direction cash_direction NOT NULL
)inherits (transactions);


--@block
CREATE INDEX idx_account_no
ON acc_to_hand_transactions(account_no);

--@block
CREATE TYPE interest_type AS ENUM ('savings','fixed_deposit')

--@block
CREATE TABLE interest_payments(
    savings_account_no INT REFERENCES savingsAccounts(account_no),
    interest_type interest_type NOT NULL
)inherits (transactions);

--@block
CREATE INDEX idx_interest_payments_completed_savings
ON interest_payments(savings_account_no)
WHERE interest_type = 'savings' AND status = 'completed';


--@block

CREATE TYPE activity_type AS ENUM ('FD_MATURITY','FD_INTEREST_PAYMENT','INTEREST_PAYMENT','LOGIN','ACC_TO_ACC_TRANSFER','WITHDRAW','DEPOSIT','CREATE_FD_ACCOUNT','CREATE_SAVINGS_ACCOUNT','ADD_CUSTOMER','VIEW_CUSTOMER_ACTIVITY','VIEW_INTEREST_DISTRIBUTION',
                                    'VIEW_ACTIVE_FDS','VIEW_ACCOUNTWISE_TRANSACTIONS','VIEW_AGENTWISE_TRANSACTIONS','ADD_AGENT','DEACTIVATE_CUSTOMER','REACTIVATE_CUSTOMER','DEACTIVATE_SAVINGS_ACCOUNT','REACTIVATE_SAVINGS_ACCOUNT','DEACTIVATE_FIXED_DEPOSIT','DEACTIVATE_JOINT_ACCOUNT'
                                    ,'ADD_ADMIN','ADD_BRANCH','VIEW_CUSTOMER_ACTIVITY_FOR_ACCOUNT','VIEW_AUDIT_LOGS','VIEW_SYSTEM_LOGS','DEACTIVATE_AGENT','ACTIVATE_AGENT','DELETE_SAVINGS_ACCOUNT','DELETE_FIXED_DEPOSIT','DEACTIVATE_SELF','REACTIVATE_ADMIN');




CREATE TABLE systemLogs(
    log_id SERIAL PRIMARY KEY,
    activity_type activity_type NOT NULL,
    description TEXT NOT NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    performed_by INT REFERENCES login_authentication(user_id)
);


--@block
create table audit_logs(
    log_id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation_type  VARCHAR(10) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by INT REFERENCES login_authentication(user_id)
);
--@block
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
    user_id_value INT;
BEGIN
    -- Try to get the current user ID from session variable, default to 0 (SYSTEM) if not set
    BEGIN
        user_id_value := current_setting('app.current_user_id', true)::INT;
        IF user_id_value IS NULL THEN
            user_id_value := 0;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            user_id_value := 0;  -- Default to SYSTEM user
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, operation_type, new_data, changed_by)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW), user_id_value);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, operation_type, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW), user_id_value);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, operation_type, old_data, changed_by)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), user_id_value);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

--@block
CREATE TRIGGER trg_audit_login_authentication
AFTER INSERT OR UPDATE OR DELETE ON login_authentication
FOR EACH ROW
EXECUTE FUNCTION log_audit();

--@block
CREATE TRIGGER trg_audit_customers
AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW
EXECUTE FUNCTION log_audit();

--@block
CREATE TRIGGER trg_audit_savingsAccounts
AFTER INSERT OR UPDATE OR DELETE ON savingsAccounts
FOR EACH ROW
EXECUTE FUNCTION log_audit();
--@block
CREATE TRIGGER trg_audit_fixedDepositAccounts
AFTER INSERT OR UPDATE OR DELETE ON fixedDepositAccounts
FOR EACH ROW
EXECUTE FUNCTION log_audit();

--@block
CREATE TRIGGER trg_audit_branches
AFTER INSERT OR UPDATE OR DELETE ON branches
FOR EACH ROW
EXECUTE FUNCTION log_audit();
--@block
CREATE TRIGGER trg_audit_agents
AFTER INSERT OR UPDATE OR DELETE ON agents
FOR EACH ROW
EXECUTE FUNCTION log_audit();

--@block
CREATE TRIGGER trg_audit_admins
AFTER INSERT OR UPDATE OR DELETE ON admins
FOR EACH ROW
EXECUTE FUNCTION log_audit();


--@block
select * from customers;



select * from branches

--@block
-- Stored Procedure: Atomic Account-to-Account Transfer
CREATE OR REPLACE FUNCTION transfer_between_accounts(
    p_sender_account_no INT,
    p_receiver_account_no INT,
    p_amount NUMERIC(15,2),
    p_agent_id INT,
    p_sender_nic VARCHAR(12)
) RETURNS TABLE (
    transaction_id INT,
    status VARCHAR,
    message VARCHAR
) AS $$
DECLARE
    v_transaction_id INT;
    v_sender_balance NUMERIC(15,2);
    v_receiver_exists BOOLEAN;
BEGIN
    -- Validation: Check sender balance
    SELECT balance INTO v_sender_balance 
    FROM savingsaccounts 
    WHERE account_no = p_sender_account_no;
    
    IF v_sender_balance IS NULL THEN
        RETURN QUERY SELECT NULL::INT, 'FAILED'::VARCHAR, 'Sender account not found'::VARCHAR;
        RETURN;
    END IF;
    IF v_sender_balance < p_amount THEN
        RETURN QUERY SELECT NULL::INT, 'FAILED'::VARCHAR, 'Insufficient balance'::VARCHAR;
        RETURN;
    END IF;
    
    -- Validation: Check receiver exists
    SELECT EXISTS(SELECT 1 FROM savingsaccounts WHERE account_no = p_receiver_account_no) 
    INTO v_receiver_exists;
    IF NOT v_receiver_exists THEN
        RETURN QUERY SELECT NULL::INT, 'FAILED'::VARCHAR, 'Receiver account not found'::VARCHAR;
        RETURN;
    END IF;
    
    -- Deduct from sender
    UPDATE savingsaccounts 
    SET balance = balance - p_amount, updated_at = NOW() 
    WHERE account_no = p_sender_account_no;
    
    -- Add to receiver
    UPDATE savingsaccounts 
    SET balance = balance + p_amount, updated_at = NOW() 
    WHERE account_no = p_receiver_account_no;
    
    -- Record transfer in acc_to_acc_transactions
    INSERT INTO acc_to_acc_transactions (
        amount, sender_account_no, receiver_account_no, 
        transaction_done_by, status, transaction_date, transaction_requested_by
    )
    VALUES (p_amount, p_sender_account_no, p_receiver_account_no, p_agent_id, 'completed', NOW(), p_sender_nic)
    RETURNING acc_to_acc_transactions.transaction_id INTO v_transaction_id;
    
    -- Return success
    RETURN QUERY SELECT v_transaction_id, 'SUCCESS'::VARCHAR, 'Transfer completed'::VARCHAR;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Automatic rollback by PostgreSQL
        RETURN QUERY SELECT NULL::INT, 'FAILED'::VARCHAR, SQLERRM::VARCHAR;
END;
$$ LANGUAGE plpgsql;

--@block
-- ============================================
-- Monthly Interest Calculation Procedures
-- Banking System - Stored Procedures
-- Created: October 20, 2025
-- ============================================

-- 1. SAVINGS ACCOUNT MONTHLY INTEREST
--@block
CREATE OR REPLACE FUNCTION calculate_monthly_interest()
RETURNS TABLE (
    accounts_processed INT,
    total_interest_paid NUMERIC(15,2),
    execution_time INTERVAL,
    status TEXT
) AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_account_count INT := 0;
    v_total_interest NUMERIC(15,2) := 0;
    v_interest NUMERIC(15,2);
    v_account RECORD;
BEGIN
    v_start_time := NOW();
    PERFORM set_config('app.current_user_id', '0', true);
    FOR v_account IN 
        SELECT 
            s.account_no,
            s.balance,
            p.interest_rate,
            s.last_interest_date
        FROM savingsAccounts s 
        JOIN savingsPlans p ON s.plan_id = p.plan_id 
        WHERE s.active_status = TRUE
        AND (s.last_interest_date IS NULL OR NOW() - s.last_interest_date >= INTERVAL '30 days')
        ORDER BY s.account_no
    LOOP
        v_interest := ROUND((v_account.balance * (v_account.interest_rate / 100.0)) / 12.0, 2);
        IF v_interest <= 0 THEN CONTINUE; END IF;
        UPDATE savingsAccounts 
        SET 
            balance = balance + v_interest,
            last_interest_date = NOW(),
            updated_at = NOW()
        WHERE account_no = v_account.account_no;
        INSERT INTO interest_payments (
            savings_account_no,
            amount,
            status,
            description,
            interest_type
        ) VALUES (
            v_account.account_no,
            v_interest,
            'completed',
            'Monthly savings account interest payment',
            'savings'
        );
        INSERT INTO systemLogs (
            activity_type,
            description,
            performed_by
        ) VALUES (
            'INTEREST_PAYMENT',
            format('Monthly interest of %s added to account %s', v_interest, v_account.account_no),
            0
        );
        v_account_count := v_account_count + 1;
        v_total_interest := v_total_interest + v_interest;
    END LOOP;
    RETURN QUERY SELECT 
        v_account_count,
        v_total_interest,
        NOW() - v_start_time,
        'SUCCESS'::TEXT;
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 
            0::INT,
            0::NUMERIC(15,2),
            NOW() - v_start_time,
            format('ERROR: %s', SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 2. FIXED DEPOSIT MONTHLY INTEREST

CREATE OR REPLACE FUNCTION calculate_fd_interest()
RETURNS TABLE (
    fds_processed INT,
    total_interest_paid NUMERIC(15,2),
    execution_time INTERVAL,
    status TEXT
) AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_fd_count INT := 0;
    v_total_interest NUMERIC(15,2) := 0;
    v_interest NUMERIC(15,2);
    v_fd RECORD;
BEGIN
    v_start_time := NOW();
    PERFORM set_config('app.current_user_id', '0', true);
    FOR v_fd IN 
        SELECT 
            f.deposit_amount,
            f.fd_account_no,
            p.interest_rate,
            s.account_no,
            f.last_interest_date
        FROM fixedDepositAccounts f
        JOIN savingsAccounts s ON f.linked_account_no = s.account_no
        JOIN fixedDepositsPlans p ON f.fd_plan_id = p.fd_plan_id
        WHERE f.is_active = TRUE
        AND f.status = 'active'
        AND (f.last_interest_date IS NULL OR NOW() - f.last_interest_date >= INTERVAL '30 days')
        ORDER BY f.fd_account_no
    LOOP
        v_interest := ROUND((v_fd.deposit_amount * (v_fd.interest_rate / 100.0)) / 12.0, 2);
        IF v_interest <= 0 THEN CONTINUE; END IF;
        UPDATE savingsAccounts 
        SET 
            balance = balance + v_interest,
            updated_at = NOW()
        WHERE account_no = v_fd.account_no;
        UPDATE fixedDepositAccounts 
        SET last_interest_date = NOW()
        WHERE fd_account_no = v_fd.fd_account_no;
        INSERT INTO interest_payments (
            savings_account_no,
            amount,
            status,
            description,
            interest_type
        ) VALUES (
            v_fd.account_no,
            v_interest,
            'completed',
            format('Monthly Fixed Deposit interest payment (FD: %s)', v_fd.fd_account_no),
            'fixed_deposit'
        );
        INSERT INTO systemLogs (
            activity_type,
            description,
            performed_by
        ) VALUES (
            'FD_INTEREST_PAYMENT',
            format('Monthly FD interest of %s added to savings account %s from FD %s', 
                   v_interest, v_fd.account_no, v_fd.fd_account_no),
            0
        );
        v_fd_count := v_fd_count + 1;
        v_total_interest := v_total_interest + v_interest;
    END LOOP;
    RETURN QUERY SELECT 
        v_fd_count,
        v_total_interest,
        NOW() - v_start_time,
        'SUCCESS'::TEXT;
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 
            0::INT,
            0::NUMERIC(15,2),
            NOW() - v_start_time,
            format('ERROR: %s', SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION transfer_between_accounts(
    p_sender_account_no INT,
    p_receiver_account_no INT,
    p_amount NUMERIC(15,2),
    p_agent_id INT,
    p_sender_nic VARCHAR(12)
) RETURNS TABLE (
    transaction_id INT,
    status VARCHAR,
    message VARCHAR
) AS $$
DECLARE
    v_transaction_id INT;
    v_sender_balance NUMERIC(15,2);
    v_receiver_exists BOOLEAN;
BEGIN
    SELECT balance INTO v_sender_balance 
    FROM savingsaccounts 
    WHERE account_no = p_sender_account_no;
    IF v_sender_balance IS NULL THEN
        RETURN QUERY SELECT NULL::INT, 'FAILED'::VARCHAR, 'Sender account not found'::VARCHAR;
        RETURN;
    END IF;
    IF v_sender_balance < p_amount THEN
        RETURN QUERY SELECT NULL::INT, 'FAILED'::VARCHAR, 'Insufficient balance'::VARCHAR;
        RETURN;
    END IF;
    SELECT EXISTS(SELECT 1 FROM savingsaccounts WHERE account_no = p_receiver_account_no) 
    INTO v_receiver_exists;
    IF NOT v_receiver_exists THEN
        RETURN QUERY SELECT NULL::INT, 'FAILED'::VARCHAR, 'Receiver account not found'::VARCHAR;
        RETURN;
    END IF;
    UPDATE savingsaccounts 
    SET balance = balance - p_amount, updated_at = NOW() 
    WHERE account_no = p_sender_account_no;
    UPDATE savingsaccounts 
    SET balance = balance + p_amount, updated_at = NOW() 
    WHERE account_no = p_receiver_account_no;
    INSERT INTO acc_to_acc_transactions (
        amount, sender_account_no, receiver_account_no, 
        transaction_done_by, status, transaction_date, transaction_requested_by
    )
    VALUES (p_amount, p_sender_account_no, p_receiver_account_no, p_agent_id, 'completed', NOW(), p_sender_nic)
    RETURNING acc_to_acc_transactions.transaction_id INTO v_transaction_id;
    RETURN QUERY SELECT v_transaction_id, 'SUCCESS'::VARCHAR, 'Transfer completed'::VARCHAR;
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT NULL::INT, 'FAILED'::VARCHAR, SQLERRM::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- End of procedures
--@block
-- Procedure: Remove FD After Maturity
DROP FUNCTION IF EXISTS remove_fd_after_maturity();

CREATE OR REPLACE FUNCTION remove_fd_after_maturity()
RETURNS TABLE(out_fd_account_no INT, out_account_no INT, principal NUMERIC(15,2), interest NUMERIC(15,2), total_amount NUMERIC(15,2), status TEXT, message TEXT) AS $$
DECLARE
    v_fd RECORD;
    v_interest NUMERIC(15,2);
    v_total NUMERIC(15,2);
BEGIN
    PERFORM set_config('app.current_user_id', '0', true);
    FOR v_fd IN 
        SELECT f.fd_account_no, f.deposit_amount, f.linked_account_no as account_no, p.interest_rate
        FROM fixedDepositAccounts f
        JOIN fixedDepositsPlans p ON f.fd_plan_id = p.fd_plan_id
        WHERE  NOW() >= f.end_date AND f.is_active = TRUE
    LOOP
        v_interest := ROUND(v_fd.deposit_amount * (v_fd.interest_rate / 100.0), 2);
        v_total := v_fd.deposit_amount + v_interest;
        UPDATE fixedDepositAccounts 
            SET status = 'matured', is_active = FALSE 
            WHERE fd_account_no = v_fd.fd_account_no;
        UPDATE savingsAccounts 
            SET balance = balance + v_total 
            WHERE account_no = v_fd.account_no;
        INSERT INTO interest_payments (savings_account_no, amount, status, description, interest_type) 
            VALUES (v_fd.account_no, v_interest, 'completed', 'Fixed Deposit maturity interest', 'fixed_deposit');
        INSERT INTO systemLogs (
            activity_type, description, performed_by
        ) VALUES (
            'FD_MATURITY',
            format('Fixed Deposit %s matured. Total amount %s (principal: %s, interest: %s) credited to savings account %s',
                   v_fd.fd_account_no, v_total, v_fd.deposit_amount, v_interest, v_fd.account_no),
            0
        );
        RETURN QUERY SELECT v_fd.fd_account_no::INT, v_fd.account_no::INT, v_fd.deposit_amount::NUMERIC(15,2), v_interest, v_total, 'SUCCESS'::TEXT, 'FD matured and credited'::TEXT;
    END LOOP;
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::INT, NULL::INT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'SKIPPED'::TEXT, 'No matured FDs found'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

--@block
SELECT * FROM remove_fd_after_maturity()
--@block
select * from savingsaccounts