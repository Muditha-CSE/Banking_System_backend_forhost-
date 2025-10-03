create type user_role as ENUM ('admin','agent');

--@block
CREATE TABLE login_authentication (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(50) NOT NULL,
    role user_role NOT NULL
);

--@block
insert into login_authentication (username, password, role) values
('muditha', '$2b$10$YjKwxQsrZNKqmInX7/q.s.dYe13DD7Zjg1NzOiZGkQcouy5Fix5Dy', 'admin');

--@block 
insert into admins (name, email, phone, user_id, NIC,created_by) values
('muditha','mudithja@gmail.com','0771234567',49,'123456789V',49);
--@block
select * from login_authentication;
--@block
select * from agents;

--@block
select * from admins;

--@block
create table agents (
    agent_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL UNIQUE,
    user_id INT REFERENCES login_authentication(user_id),
    NIC VARCHAR(12) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--@block
create table admins (
    agent_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL UNIQUE,
    user_id INT REFERENCES login_authentication(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--@block
ALTER TABLE login_authentication
ALTER COLUMN password TYPE VARCHAR(255);

--@block
ALTER TABLE admins
RENAME COLUMN agent_id TO admin_id;

--@block
ALTER TABLE admins
ADD COLUMN NIC VARCHAR(12) NOT NULL UNIQUE;

--@block
TRUNCATE TABLE  login_authentication cascade;

--@block
create table customers(
    customer_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL UNIQUE,
    address VARCHAR(255) NOT NULL,
    NIC VARCHAR(12) NOT NULL UNIQUE,
    gender VARCHAR(10) NOT NULL,
    DOB DATE NOT NULL,
    registered_by INT REFERENCES agents(agent_id),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

--@block
select * from customers;

--@block
DROP TABLE IF EXISTS customers;

CREATE TABLE customers(
    customer_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL UNIQUE,
    address VARCHAR(255) NOT NULL,
    NIC VARCHAR(12) NOT NULL UNIQUE,
    gender VARCHAR(10) NOT NULL,
    DOB DATE NOT NULL,
    registered_by INT REFERENCES login_authentication(user_id),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--@block
alter table admins
drop column created_by;
--@block
ALTER TABLE admins 
add column created_by INT references login_authentication(user_id) NOT NULL;

--@block
create table branches (
    branch_id SERIAL PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL,
    branch_address VARCHAR(255) NOT NULL,
    telephone_no VARCHAR(15) NOT NULL UNIQUE,
    working_hours_start TIME NOT NULL,
    working_hours_end TIME NOT NULL
);

--@block

ALTER TABLE customers
ADD column branch_id INT references branches(branch_id) NOT NULL;

--@block
ALTER TABLE agents
add column branch_id INT references branches(branch_id) NOT NULL;

--@block
insert into branches (branch_name, branch_address, telephone_no, working_hours_start, working_hours_end) values
('Colombo Main Branch', '123 Main St, Colombo', '0112345678', '09:00', '17:00');

--@block
select * from branches;

--@block
select * from customers;


--@block
CREATE TABLE accounts(
	account_no SERIAL PRIMARY KEY,
	created_date TIMESTAMP,
	balance DECIMAL(10, 2) NOT NULL,
	active_status BOOLEAN NOT NULL,
	last_transaction_time TIMESTAMP,
	last_transaction_id CHAR(10)
);

--@block
CREATE TABLE savings_plans(
	plan_id CHAR(5) PRIMARY KEY,
	plan_name VARCHAR(25) NOT NULL,
	min_age CHAR(2) NOT NULL,
	max_age CHAR(2),
	min_balance DECIMAL(5, 2) NOT NULL,
	interest_rate DECIMAL(2, 2) NOT NULL
);

insert into savings_plans (plan_id, plan_name, min_age, max_age, min_balance,interest_rate) values
('S0001', 'Adalt', '18', '60', '0','0.11');

--@block
CREATE TABLE savings_acccount(
	account_no INT PRIMARY KEY REFERENCES accounts(account_no),
	customer_id CHAR(7) NOT NULL REFERENCES customer(customer_id),
	plan_id CHAR(5) REFERENCES savings_plans(plan_id)
);

--@block
CREATE TABLE joint_plans(
	plan_id CHAR(5) PRIMARY KEY,
	plan_name VARCHAR(25),
	min_age CHAR(2),
	min_balance DECIMAL (5, 2) NOT NULL,
	interest_rate DECIMAL (2, 2) NOT NULL
);

--@block
CREATE TABLE joint_account(
	account_no CHAR(16) PRIMARY KEY REFERENCES accounts(account_no),
	plan_id CHAR(5) REFERENCES joint_plans(plan_id)
);


--@block
CREATE TYPE roles AS ENUM ('primary', 'joint', 'nominee');

CREATE TABLE acc_holders (
    account_no INT REFERENCES accounts(account_no) ON DELETE CASCADE,
    customer_id INT REFERENCES customers(customer_id) ON DELETE CASCADE,
    role roles NOT NULL,
    PRIMARY KEY (account_no, customer_id)
);
