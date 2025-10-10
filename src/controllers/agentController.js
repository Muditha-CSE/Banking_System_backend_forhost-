import {addNewCustomer,getAgentBranch,searchCustomer,createSavingsAccount,getMinBalance,
    fdChecker,createFixedDepositeAccount,accountChecker,makeDepositeAccount
    ,makeWithdrawAccount,getAccinfo,insertFailedWIthdrawal,accToAccTrans,checkRoleAccount
            ,getMinAge} from '../models/agentModel.js';

import {logSystemActivity} from '../models/systemModel.js';

import pool from '../../database.js';

const addCustomer = async (req,res)=>{
    const {username,name,email,phone,NIC,gender,address,DOB} = req.body;
    const agent_id = req.user.userId;
    const NICs = [NIC];
    
    const client = await pool.connect();

    try{
        await client.query('BEGIN');
        const branch_id = await getAgentBranch(client,agent_id);
        const result = await searchCustomer(client,NICs);

        if(result.ok === false){
            await addNewCustomer(client,username,name,email,phone,NIC,gender,address,DOB,agent_id,branch_id);
            await logSystemActivity(client, 'ADD_CUSTOMER', `Customer ${username} added by agent ID ${agent_id}`, agent_id);
            await client.query('COMMIT');
            return res.status(200).json({message: "Customer added successfully"});
        };
        return res.status(400).json({message: "NIC is already registered"});

    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({error: err.message});
    }finally{
        client.release();
    }
};

const addSavingsAccount = async (req,res)=>{
    const {customer_created,users,initial_deposit,plan_id} = req.body;
    const agent_id = req.user.userId;
    const NICs = users.map(user => user.nic);
    const client = await pool.connect();

    try{
        await client.query('BEGIN');

        if(users.length === 0){
            return res.status(400).json({ message: "At least one account holder is required" });
        }
        else if(users.length ===1){
            if(users[0].role !== 'primary'){
                return res.status(400).json({ message: "Single account holder must be primary" });
            }
        }

        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ message: "Users array is required" });
        }

        const checkCustomer = await searchCustomer(client,NICs);
        const branch_id = await getAgentBranch(client,agent_id);
        const ageRange = await getMinAge(client,plan_id);
        const invalid_age_users =[];

        if(checkCustomer.ok === false){
            return res.status(400).json({message: `The following NICs are not registered: ${checkCustomer.missing.join(', ')}`});
        }
        for (const user of checkCustomer.existing) {
            const birthDate = new Date(user.dob);
            const ageDifMs = Date.now() - birthDate.getTime();
            const age = Math.floor(ageDifMs / 31557600000); 
            if(age < ageRange.min_age || age > ageRange.max_age){
                invalid_age_users.push(user.nic);
            }
        }
        if(invalid_age_users.length > 0){
            return res.status(400).json({ message: `The following NICs do not meet the allowed age range of ${ageRange.min_age} - ${ageRange.max_age}: ${invalid_age_users.join(', ')}`}
            );
        }

        const min_balance = await getMinBalance(client,plan_id);

        if(initial_deposit < min_balance){
            return res.status(400).json({message: `Initial deposit should be at least ${min_balance}`});
        }

        const account_no = await createSavingsAccount(client,users,initial_deposit,agent_id,branch_id,plan_id,customer_created);
        await logSystemActivity(client, 'CREATE_SAVINGS_ACCOUNT', `Savings account ${account_no} created by agent ID ${agent_id}`, agent_id);
        await logSystemActivity(client, 'DEPOSIT', `Amount ${initial_deposit} deposited to account ${account_no} by agent ID ${agent_id}`, agent_id);
        await client.query('COMMIT');
        return res.status(200).json({message: "Savings account created successfully with account number: "+account_no, account_no: account_no});
    
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({error: err.message});
    }finally{
        client.release();
    }
};



const addFixedDepositeAccount = async (req,res)=>{
    const {account_no,fd_plan_id,amount,NIC} = req.body;
    const agent_id = req.user.userId;

    const client = await pool.connect();

    try{
        await client.query('BEGIN');
        const accountCheck = await accountChecker(client,account_no,NIC);
        const getUserAge = await searchCustomer(client,[NIC]);
        if(getUserAge.ok === true){
            const birthDate = new Date(getUserAge.existing[0].dob);
            const ageDifMs = Date.now() - birthDate.getTime();
            const age = Math.floor(ageDifMs / 31557600000);
            if(age < 18){
                return res.status(400).json({message: "Customer must be at least 18 years old to open a fixed deposit account"});
            }
        }
        if(accountCheck === 0){
            return res.status(400).json({message: "Account does not exist"});
        }
        if(accountCheck.customer_nic !== NIC){
            return res.status(400).json({message: "NIC does not match with the account number"});
        }
        const fdCheck = await fdChecker(client,account_no);

        if(fdCheck > 0){
            return res.status(400).json({message: "Fixed deposit account already exists for the given savings account"});
        }

        const checkRole = await checkRoleAccount(client,account_no,NIC);
        if(checkRole !== 'primary'){
            return res.status(400).json({message: "Only primary account holder can create a fixed deposit account"});
        }
        
        await createFixedDepositeAccount(client,account_no,fd_plan_id,amount,agent_id);
        await logSystemActivity(client, 'CREATE_FD_ACCOUNT', `Fixed deposit account linked to ${account_no} created by agent ID ${agent_id}`, agent_id);
        await client.query('COMMIT');
        return res.status(200).json({message: "Fixed deposit account created successfully"});

    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({error: err.message});
    }finally{
        client.release();
    }
};






const makeDeposit = async (req,res)=>{
    const {customer_nic,account_no,amount} = req.body;
    const agent_id = req.user.userId;
    const client = await pool.connect();
    
    try{
        await client.query('BEGIN');
        const accountCheck = await accountChecker(client,account_no,customer_nic);
        if(accountCheck === 0){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Account does not exist"});
        }
        if(accountCheck.customer_nic !== customer_nic){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "NIC does not match with the account number"});
        }

        await makeDepositeAccount(client,account_no,amount,agent_id,customer_nic);
        await logSystemActivity(client, 'DEPOSIT', `Amount ${amount} deposited to account ${account_no} by agent ID ${agent_id}`, agent_id);

        await client.query('COMMIT');

        return res.status(200).json({message: "Deposit successful"});
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({error: err.message});
    }
    finally{
        client.release();
    }
};


const makeWithdraw = async (req,res)=>{
    const {customer_nic,account_no,amount} = req.body;
    const agent_id = req.user.userId;
    const client = await pool.connect();
    
    try{
        await client.query('BEGIN');

        const accountCheck = await accountChecker(client,account_no,customer_nic);
        if(accountCheck === 0){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Account does not exist"});
        }
        if(accountCheck.customer_nic !== customer_nic){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "NIC does not match with the account number"});
        }

        const Accinfo = await getAccinfo(client,account_no);
        const current_balance = Accinfo.balance;
        const min_balance = await getMinBalance(client,Accinfo.plan_id);

        if(current_balance - min_balance < amount){
            insertFailedWIthdrawal(client,amount,account_no,agent_id);
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Insufficient balance"});
        }

        await makeWithdrawAccount(client,account_no,amount,agent_id,customer_nic);
        await logSystemActivity(client, 'WITHDRAW', `Amount ${amount} withdrawn from account ${account_no} by agent ID ${agent_id}`, agent_id);

        await client.query('COMMIT');

        return res.status(200).json({message: "Withdraw successful"});
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({error: err.message});
    }
    finally{
        client.release();
    }
};

const accToAccTransfer = async (req,res)=>{
    const {sender_account_no,receiver_account_no,amount,sender_NIC} = req.body;
    const agent_id = req.user.userId;

    const client = await pool.connect();
    try{
        await client.query('BEGIN');
        const senderAccount = await accountChecker(client,sender_account_no,sender_NIC);
        if(senderAccount === 0){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Sender account does not exist"});
        }
        if(senderAccount.customer_nic !== sender_NIC){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Sender NIC does not match with the account number"});
        }
        const receiverAccount = await accountChecker(client,receiver_account_no);
        if(receiverAccount === 0){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Receiver account does not exist"});
        }
        const accinfo = await getAccinfo(client,sender_account_no);
        const sender_balance = accinfo.balance;
        const min_balance = await getMinBalance(client,accinfo.plan_id);
        
        if(sender_balance-min_balance < amount){
            insertFailedWIthdrawal(client,amount,sender_account_no,agent_id);
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Insufficient balance in sender account"});
        }
        await accToAccTrans(client,sender_account_no,receiver_account_no,amount,agent_id,senderAccount.customer_nic);
        await logSystemActivity(client, 'ACC_TO_ACC_TRANSFER', `Amount ${amount} transferred from account ${sender_account_no} to account ${receiver_account_no} by agent ID ${agent_id}`, agent_id);
        await client.query('COMMIT');
        return res.status(200).json({message: "Account to account transfer successful"});
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({error: err.message});
    }finally{
        client.release();
    }
};

export default {addCustomer,addSavingsAccount,addFixedDepositeAccount,fdChecker,makeDeposit,makeWithdraw,accToAccTransfer};

