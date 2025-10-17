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
select * from login_authentication;

--@block
select * from admins;


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
alter table agents
add column is_active BOOLEAN DEFAULT TRUE;

--@block
CREATE TABLE admins(
    admin_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    user_id INT REFERENCES login_authentication(user_id),
    nic VARCHAR(12) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES login_authentication(user_id)
);

--@block
alter table admins
add column updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
--@block
alter table admins
add column is_active BOOLEAN DEFAULT TRUE;
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
CREATE TABLE savingsPlans(
    plan_id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL,
    interest_rate NUMERIC(5,2) NOT NULL,
    min_balance NUMERIC(15,2) NOT NULL,
    min_age INT NOT NULL,
    max_age INT DEFAULT NULL
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
CREATE TABLE fixedDepositsPlans(
    fd_plan_id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL,
    plan_duration_months INT NOT NULL,
    interest_rate NUMERIC(5,2) NOT NULL
);

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
CREATE TYPE cash_direction AS ENUM ('deposit','withdrawal')

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
                                    'VIEW_ACTIVE_FDS','VIEW_ACCOUNTWISE_TRANSACTIONS','VIEW_AGENTWISE_TRANSACTIONS','ADD_AGENT','DEACTIVATE_CUSTOMER','REACTIVATE_CUSTOMER','DEACTIVATE_SAVINGS_ACCOUNT','REACTIVATE_SAVINGS_ACCOUNT','DEACTIVATE_FIXED_DEPOSIT',
                                    ,'ADD_ADMIN','ADD_BRANCH','VIEW_CUSTOMER_ACTIVITY_FOR_ACCOUNT','VIEW_AUDIT_LOGS','VIEW_SYSTEM_LOGS','DEACTIVATE_AGENT','ACTIVATE_AGENT','DELETE_SAVINGS_ACCOUNT','DELETE_FIXED_DEPOSIT','DEACTIVATE_SELF','REACTIVATE_ADMIN');

--@block
CREATE TABLE systemLogs(
    log_id SERIAL PRIMARY KEY,
    activity_type activity_type NOT NULL,
    description TEXT NOT NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    performed_by INT REFERENCES login_authentication(user_id)
);

--@block
INSERT INTO login_authentication (username, password, role)
VALUES ('testadmin','$2b$10$OB2.0O6hP.CAWD3.S3QwKu2Ogyy16rQiGI/xuE5i.iVaa8krVQnq2','admin'); --testadmin password is testadmin
---@block

--@block
INSERT INTO admins (name, email, phone, user_id, nic, created_by)
VALUES ('testadmin', 'ffvbdv@gmail.com', '057127545455', 1, '444233323v', 1);

--@block
insert into  savingsplans (plan_name, interest_rate, min_balance, min_age,max_age) VALUES
('children savings plan',12,0,0,12),
('Teen savings plan',11,500,13,17),
('Adult savings plan',10,1000,18,59),
('Senior citizen savings plan',13,1000,60,100),
('joint savings plan',7,5000,18,75);

--@block
insert into fixeddepositsplans (plan_name, plan_duration_months, interest_rate) VALUES
('6 month fixed deposit',6,13),
('1 year fixed deposit',12,14),
('3 year fixed deposit',36,15);


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
CREATE TRIGGER trg_audit_hand_transactions
AFTER INSERT OR UPDATE OR DELETE ON acc_to_hand_transactions
FOR EACH ROW
EXECUTE FUNCTION log_audit();

--@block
CREATE TRIGGER trg_audit_acc_to_acc_transactions
AFTER INSERT OR UPDATE OR DELETE ON acc_to_acc_transactions
FOR EACH ROW
EXECUTE FUNCTION log_audit();
--@block
CREATE TRIGGER trg_audit_interest_payments
AFTER INSERT OR UPDATE OR DELETE ON interest_payments
FOR EACH ROW
EXECUTE FUNCTION log_audit();

--@block

INSERT INTO login_authentication (user_id, username, role, password)
VALUES (0, 'SYSTEM', 'system',''); 