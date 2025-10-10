--@ block
CREATE TYPE user_role AS ENUM ('admin','agent')

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
    add column creted_by INT REFERENCES login_authentication(user_id),
    add column created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


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
    branch_id INT REFERENCES branches(branch_id)
);

--@block
CREATE TABLE admins(
    admin_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    user_id INT REFERENCES login_authentication(user_id),
    nic VARCHAR(12) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES login_authentication(user_id)
);

--@block

CREATE TYPE gender AS ENUM ('male','female')

--@block
CREATE TABLE customers(
    customer_id SERIAL PRIMARY KEY,
    add column username VARCHAR(50) UNIQUE NOT NULL,
    add column is_active BOOLEAN DEFAULT TRUE;
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    nic VARCHAR(12) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    gender gender NOT NULL,
    DOB DATE NOT NULL,
    branch_id INT REFERENCES branches(branch_id),
    registered_by INT REFERENCES login_authentication(user_id);,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    updated_by INT REFERENCES alogin_authentication(user_id),
    created_customer_nic VARCHAR(12) REFERENCES customers(nic);
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
SELECT customer_id
FROM accountHolders
WHERE customer_id NOT IN (SELECT customer_id FROM customers);


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
    status fd_status DEFAULT 'active' NOT NULL ,
    deposit_amount NUMERIC(15,2) NOT NULL,
    last_interest_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    linked_account_no INT REFERENCES savingsAccounts(account_no),
    fd_plan_id INT REFERENCES fixedDepositsPlans(fd_plan_id),
    created_by INT REFERENCES login_authentication(user_id)
);
--@block
drop table fixedDepositAccounts;
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
drop table transactions cascade;
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
                                    'VIEW_ACTIVE_FDS','VIEW_ACCOUNTWISE_TRANSACTIONS','VIEW_AGENTWISE_TRANSACTIONS','ADD_AGENT'
                                    ,'ADD_ADMIN','ADD_BRANCH','VIEW_CUSTOMER_ACTIVITY_FOR_ACCOUNT');

--@block
alter type activity_type
add value 'VIEW_CUSTOMER_ACTIVITY_FOR_ACCOUNT';


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
VALUES ('muditha', '$2b$10$l4vH2dEfePjkJadJ1mEpqe.QZfmXHWjpDKLuPp919b6triuqODpBq','admin');


--@block
INSERT INTO admins (name, email, phone, user_id, nic, created_by)
VALUES ('muditha jayashan', 'muditha@gmail.com', '0771278933', 7, '2323232323v', 7);

--@block
select * from customers;

--@block
select * from login_authentication;

--@block
insert into  savingsplans (plan_name, interest_rate, min_balance, min_age,max_age) VALUES
('children savings plan',12,0,0,12),
('Teen savings plan',11,500,13,17),
('Adult savings plan',10,1000,18,59),
('Senior citizen savings plan',13,1000,60,100),
('joint savings plan',7,5000,18,75);

--@block
select * from systemlogs;

--@block
insert into fixeddepositsplans (plan_name, plan_duration_months, interest_rate) VALUES
('6 month fixed deposit',6,13),
('1 year fixed deposit',12,14),
('3 year fixed deposit',36,15);


--@block
select * from accountHolders;

--@block
select * from customers;

--@block
select * from systemlogs;

--@block
select * from savingsaccounts;

--@block
select * from accountHolders;;

--@block
select * from customers;

--@block
select * from fixeddepositaccounts;

--@block

    SELECT 
    c.nic,
    c.name,
    a.account_no,
    sa.balance,
    sp.plan_name,
    COALESCE(d.total_deposits, 0) AS total_deposits,
    COALESCE(w.total_withdrawals, 0) AS total_withdrawals,
    COALESCE(s.total_accToacc_sent, 0) AS total_accToacc_sent,
    COALESCE(r.total_accToacc_received, 0) AS total_accToacc_received
FROM accountholders a
JOIN customers c ON c.nic = a.customer_nic
JOIN savingsAccounts sa ON sa.account_no = a.account_no
JOIN savingsPlans sp ON sp.plan_id = sa.plan_id
LEFT JOIN (
    SELECT account_no, SUM(amount) AS total_deposits
    FROM acc_to_hand_transactions 
    WHERE cash_direction = 'deposit'
    GROUP BY account_no
) d ON d.account_no = a.account_no
LEFT JOIN (
    SELECT account_no, SUM(amount) AS total_withdrawals
    FROM acc_to_hand_transactions
    WHERE cash_direction = 'withdraw'
    GROUP BY account_no
) w ON w.account_no = a.account_no
LEFT JOIN (
    SELECT sender_account_no, SUM(amount) AS total_accToacc_sent
    FROM acc_to_acc_transactions
    GROUP BY sender_account_no
) s ON s.sender_account_no = a.account_no
LEFT JOIN (
    SELECT receiver_account_no, SUM(amount) AS total_accToacc_received
    FROM acc_to_acc_transactions
    GROUP BY receiver_account_no
) r ON r.receiver_account_no = a.account_no
WHERE c.nic = '9856989V' AND a.account_no = 15
GROUP BY c.nic, c.name, a.account_no, sa.balance, sp.plan_name, d.total_deposits, w.total_withdrawals, s.total_accToacc_sent, r.total_accToacc_received;


