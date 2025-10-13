import {addNewAdminToLog,addNewAgentToLog,transactionsByAgents,accontWiseTransactions,getFDInfo,
    getMonthlyInterestDistribution,customerId,GetCustomerActivity,createBranch,branchChecker,checkAccount
,GetCustomerActivityByAcc} from '../models/adminModel.js'; 

import {logSystemActivity} from '../models/systemModel.js';
import {searchUser} from '../models/publicModel.js';
import bcrypt from 'bcrypt';
import pool from '../../database.js';


const addAdmin = async (req,res)=>{
    const {username,password,name,email,phone,NIC} = req.body;
    const created_by = req.user.userId;

    const hashedPassword = await bcrypt.hash(password,10);

    const client = await pool.connect();
    
    try{
        await client.query('BEGIN');
        if(password.length < 8){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Password must be at least 8 characters long"});
        }
        if(NIC.length !== 12 && NIC.length !== 11){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid NIC length"});
        }
        else if(NIC.length === 11 && !NIC.endsWith('V')){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid NIC format"});
        }
        if(phone.length !== 10 || !phone.startsWith('07')){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid phone number"});
        }
        const result = await searchUser(client,username);
        if(!result){
            await addNewAdminToLog(client,username,hashedPassword,name,email,phone,NIC,created_by);
            await logSystemActivity(client, 'ADD_ADMIN', `Admin ${username} added by user ID ${created_by}`, created_by);
            await client.query('COMMIT');
            return res.status(200).json({message: "Admin added successfully"});
        }
        return res.status(400).json({message: "Username already exists"});
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({error: err.message});
    }finally{
        client.release();
    }
};

const addAgent = async (req,res)=>{
    const {username,password,name,email,phone,NIC,branch_id} = req.body;
    const created_by = req.user.userId;

    const hashedPassword = await bcrypt.hash(password,10);
    const client = await pool.connect();
    
    try{
        await client.query('BEGIN');
        if(password.length < 8){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Password must be at least 8 characters long"});
        }
        if(NIC.length !== 12 && NIC.length !== 11){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid NIC length"});
        }
        else if(NIC.length === 11 && !NIC.endsWith('V')){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid NIC format"});
        }
        if(phone.length !== 10 || !phone.startsWith('07')){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid phone number"});
        }
        const result = await searchUser(pool,username);
        if(!result){
            await addNewAgentToLog(pool,username,hashedPassword,name,email,phone,NIC,created_by,branch_id);
            await logSystemActivity(pool, 'ADD_AGENT', `Agent ${username} added by user ID ${created_by}`, created_by);
            await client.query('COMMIT');
            return res.status(200).json({message: "Agent added successfully"});
        }
        return res.status(400).json({message: "Username already exists"});
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({error: err.message});
    }finally{
        client.release();

    }
};

const addBranch = async (req,res)=>{
    const {branch_name,branch_address,telephone_no,working_hours_start,working_hours_end} = req.body;
    const created_by = req.user.userId;
    const client = await pool.connect();

    try{
        await client.query('BEGIN');
        if(telephone_no.length !== 10 || !telephone_no.startsWith('07')){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid phone number"});
        }
        const branchExists =await branchChecker(client,branch_name);
        if(branchExists){
            return res.status(400).json({message: "Branch name already exists"});
        }
        createBranch(client,branch_name,branch_address,telephone_no,working_hours_start,working_hours_end,created_by);
        await logSystemActivity(client, 'ADD_BRANCH', `Branch ${branch_name} added by user ID ${created_by}`, created_by);
        await client.query('COMMIT');
        return res.status(200).json({message: "Branch added successfully"});
    }catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({error: err.message});
    }finally{
        client.release();
    }
};

const agentWiseTransactions = async (req,res)=>{
    
    try{
        const agentWiseTrans = await transactionsByAgents(pool);
        await logSystemActivity(pool, 'VIEW_AGENTWISE_TRANSACTIONS', `User ID ${req.user.userId} viewed agent-wise transactions`, req.user.userId);
        return res.status(200).json({agentWiseTrans});
    }catch(err){
        console.error(err);
        return res.status(500).json({error: err.message});
    }
};

const accountWiseTransactions = async (req,res)=>{
    try{
        const accountWiseTrans = await accontWiseTransactions(pool);
        await logSystemActivity(pool, 'VIEW_ACCOUNTWISE_TRANSACTIONS', `User ID ${req.user.userId} viewed account-wise transactions`, req.user.userId);
        return res.status(200).json({accountWiseTrans});
    }catch(err){
        console.error(err);
        return res.status(500).json({error: err.message});
    }
};

const activeFDs = async (req,res)=>{
    try{
        const activeFDInfo = await getFDInfo(pool);
        await logSystemActivity(pool, 'VIEW_ACTIVE_FDS', `User ID ${req.user.userId} viewed active fixed deposits`, req.user.userId);
        return res.status(200).json({activeFDInfo});
    }catch(err){
        console.error(err);
        return res.status(500).json({error: err.message});
    }
};

const interestDistribution = async (req,res)=>{
    try{
        const interestDist = await getMonthlyInterestDistribution(pool);
        await logSystemActivity(pool, 'VIEW_INTEREST_DISTRIBUTION', `User ID ${req.user.userId} viewed interest distribution`, req.user.userId);
        return res.status(200).json({interestDist});
    }catch(err){
        console.error(err);
        return res.status(500).json({error: err.message});
    }
};

const customerActivity = async (req,res)=>{
    const {nic} = req.params;

    try{
        if(nic.length !== 12 && nic.length !== 11){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid NIC length"});
        }
        else if(NIC.length === 11 && !NIC.endsWith('V')){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid NIC format"});
        }
        const getCustomerId = await customerId(pool,nic);
        if(!getCustomerId){
            return res.status(400).json({message: "Customer not found"});
        }
        const getCusActivity = await GetCustomerActivity(pool,nic)
        await logSystemActivity(pool, 'VIEW_CUSTOMER_ACTIVITY', `User ID ${req.user.userId} viewed activity of customer NIC ${nic}`, req.user.userId);
        return res.status(200).json({getCusActivity});
    }catch(err){
        console.error(err);
        return res.status(500).json({error: err.message});
    }
};

const customerActivityForAcc = async (req,res)=>{
    const {nic,account_no} = req.params;
    const acc_no = parseInt(account_no,10);

    try{
        if(nic.length !== 12 && nic.length !== 11){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid NIC length"});
        }
        else if(NIC.length === 11 && !NIC.endsWith('V')){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid NIC format"});
        }
        const getCustomerId = await customerId(pool,nic);
        if(!getCustomerId){
            return res.status(400).json({message: "Customer not found"});
        }
        const checkAcc = await checkAccount(pool,acc_no,nic);
        if(!checkAcc){
            return res.status(400).json({message: "Account not found for this customer"});
        }
        const getCusActivity = await GetCustomerActivityByAcc(pool,nic,acc_no);
        await logSystemActivity(pool, 'VIEW_CUSTOMER_ACTIVITY_FOR_ACCOUNT', `User ID ${req.user.userId} viewed activity of customer NIC ${nic} for account ${account_no}`, req.user.userId);
        return res.status(200).json({getCusActivity});
    }catch(err){
        console.error(err);
        return res.status(500).json({error: err.message});
    }
};
        



export default { addAdmin,addAgent,addBranch,agentWiseTransactions,accountWiseTransactions,activeFDs,interestDistribution,customerActivity,customerActivityForAcc};