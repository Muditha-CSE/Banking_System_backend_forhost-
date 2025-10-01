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
('admin', 'admin123', 'admin'),
('agent1', 'agent123', 'agent'),
('agent2', 'agent123', 'agent');

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
TRUNCATE TABLE  agents;

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