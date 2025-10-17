import { listDeactivatedAdmins, reactivateAdmin } from '../models/adminModel.js';
// List all deactivated admins
const listDeactivatedAdminsController = async (req, res) => {
    try {
        const admins = await listDeactivatedAdmins(pool);
        res.status(200).json(admins);
    } catch (err) {
        console.error('LIST DEACTIVATED ADMINS ERROR:', err);
        res.status(500).json({ error: err.message });
    }
};

// Reactivate a deactivated admin
const reactivateAdminController = async (req, res) => {
    const actingAdminId = req.user.userId;
    const { user_id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await reactivateAdmin(client, actingAdminId, user_id);
        await logSystemActivity(client, 'REACTIVATE_ADMIN', `Admin ${actingAdminId} reactivated admin ${user_id}`, actingAdminId);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Admin reactivated successfully', user_id: result.user_id });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('REACTIVATE ADMIN ERROR:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};
import {addNewAdminToLog,addNewAgentToLog,transactionsByAgents,accontWiseTransactions,getFDInfo,
    getMonthlyInterestDistribution,customerId,GetCustomerActivity,createBranch,branchChecker,checkAccount
,GetCustomerActivityByAcc,getsystemLogs,getauditLogs, listAgents, getAgentByUsername, updateAgentByUsername, deleteAgentByUsername, deactivateSelfAdmin} from '../models/adminModel.js'; 

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
        const result = await searchUser(client,username);
        if(!result){
            await addNewAgentToLog(client,username,hashedPassword,name,email,phone,NIC,created_by,branch_id);
            await logSystemActivity(client, 'ADD_AGENT', `Agent ${username} added by user ID ${created_by}`, created_by);
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
        // Accept 0XXXXXXXXX or +94XXXXXXXXX formats
        const validPhone = (/^0\d{9}$/.test(telephone_no) || /^\+94\d{9}$/.test(telephone_no));
        if (!validPhone) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Invalid phone number. Use 0XXXXXXXXX or +94XXXXXXXXX" });
        }
        const branchExists =await branchChecker(client,branch_name);
        if(branchExists){
            return res.status(400).json({message: "Branch name already exists"});
        }
    await createBranch(client,branch_name,branch_address,telephone_no,working_hours_start,working_hours_end,created_by);
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
    try {
        const activeFDInfo = await getFDInfo(pool);
        if (!activeFDInfo || activeFDInfo.length === 0) {
            return res.status(404).json({message: 'No active fixed deposits found.'});
        }
        await logSystemActivity(pool, 'VIEW_ACTIVE_FDS', `User ID ${req.user.userId} viewed active fixed deposits`, req.user.userId);
        return res.status(200).json({activeFDInfo});
    } catch (err) {
        console.error(err);
        return res.status(500).json({message: 'Failed to fetch active fixed deposits.'});
    }
};

const interestDistribution = async (req,res)=>{
    try {
        let interestDist = await getMonthlyInterestDistribution(pool);
        // Only filter out rows with truly invalid or missing month_start_date (should not happen with LEFT JOIN)
        interestDist = interestDist.filter(row => row.month_start_date && row.plan_name);
        const monthStart = interestDist[0]?.month_start_date;

        // Calculate grand total from all plan-wise totals
        const grandTotalInterest = interestDist.reduce((sum, plan) =>
            sum + parseFloat(plan.total_interest_distributed || 0), 0);
        const grandTotalPayments = interestDist.reduce((sum, plan) =>
            sum + parseInt(plan.interest_payment_count || 0), 0);

        // Add grand total row
        const interestDistWithTotal = [
            ...interestDist,
            {
                plan_name: 'GRAND TOTAL',
                total_interest_distributed: grandTotalInterest,
                interest_payment_count: grandTotalPayments
            }
        ];

        await logSystemActivity(pool, 'VIEW_INTEREST_DISTRIBUTION', `User ID ${req.user.userId} viewed interest distribution`, req.user.userId);
        // Send month_start_date separately for display at the top
        return res.status(200).json({
            month_start_date: monthStart,
            interestDist: interestDistWithTotal
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to fetch interest distribution.' });
    }
};

const customerActivity = async (req,res)=>{
    const {nic} = req.params;

    try{
        if(nic.length !== 12 && nic.length !== 11){
            return res.status(400).json({message: "Invalid NIC length"});
        }
        else if(nic.length === 11 && !nic.endsWith('V') && !nic.endsWith('v')){
            return res.status(400).json({message: "Invalid NIC format"});
        }
        const getCustomerId = await customerId(pool,nic);
        if(!getCustomerId){
            return res.status(404).json({message: "Customer not found"});
        }
        const getCusActivity = await GetCustomerActivity(pool,nic)
        if (!getCusActivity || !getCusActivity.allaccdetails || getCusActivity.allaccdetails.length === 0) {
            return res.status(404).json({message: "No account activity found for this customer."});
        }
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
            return res.status(400).json({message: "Invalid NIC length"});
        }
        else if(nic.length === 11 && !nic.endsWith('V') && !nic.endsWith('v')){
            return res.status(400).json({message: "Invalid NIC format"});
        }
        const getCustomerId = await customerId(pool,nic);
        if(!getCustomerId){
            return res.status(404).json({message: "Customer not found"});
        }
        const checkAcc = await checkAccount(pool,acc_no,nic);
        if(!checkAcc){
            return res.status(404).json({message: "Account not found for this customer"});
        }
        const getCusActivity = await GetCustomerActivityByAcc(pool,nic,acc_no);
        if (!getCusActivity) {
            return res.status(404).json({message: "No account activity found for this customer/account."});
        }
        await logSystemActivity(pool, 'VIEW_CUSTOMER_ACTIVITY_FOR_ACCOUNT', `User ID ${req.user.userId} viewed activity of customer NIC ${nic} for account ${account_no}`, req.user.userId);
        return res.status(200).json({getCusActivity});
    }catch(err){
        console.error(err);
        return res.status(500).json({error: err.message});
    }
};

const systemLogs = async (req, res) => {
    try {
        const systemLogs = await getsystemLogs(pool);
        await logSystemActivity(pool, 'VIEW_SYSTEM_LOGS', `User ID ${req.user.userId} viewed system logs`, req.user.userId);
        return res.status(200).json({systemLogs});
    } catch (err) {
        console.error(err);
        return res.status(500).json({error: err.message});
    }
};

const auditlogs = async (req, res) => {
    try {
        const oditLogs = await getauditLogs(pool);
        await logSystemActivity(pool, 'VIEW_AUDIT_LOGS', `User ID ${req.user.userId} viewed audit logs`, req.user.userId);
        return res.status(200).json({oditLogs});
    } catch (err) {
        console.error(err);
        return res.status(500).json({error: err.message});
    }
};

// List all agents (basic info)
const listAgentsController = async (req, res) => {
    try {
        const agents = await listAgents(pool);
        return res.status(200).json({ agents });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};

// Get single agent by username
const getAgentController = async (req, res) => {
    const { username } = req.params;
    try {
        const agent = await getAgentByUsername(pool, username);
        if (!agent) return res.status(404).json({ message: 'Agent not found' });
        return res.status(200).json({ agent });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};

// Update agent by username
const updateAgentController = async (req, res) => {
    const { username } = req.params; // current username
    const actingUserId = req.user.userId;
    const { name, email, phone, nic, branch_id, newUsername, password } = req.body;

    // Basic validations
    if (phone && !(/^0\d{9}$/.test(phone) || /^\+94\d{9}$/.test(phone))) {
        return res.status(400).json({ message: 'Invalid phone format' });
    }
    if (nic && !(/^(?:\d{12}|\d{9}[Vv])$/.test(nic))) {
        return res.status(400).json({ message: 'Invalid NIC format' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updates = { name, email, phone, nic, branch_id };
        if (newUsername) updates.newUsername = newUsername;
        if (password) {
            const bcrypt = (await import('bcrypt')).default;
            const hash = await bcrypt.hash(password, 10);
            updates.passwordHash = hash;
        }
        const updated = await updateAgentByUsername(client, actingUserId, username, updates);
        await logSystemActivity(client, 'ADD_AGENT', `Admin ${actingUserId} updated agent ${username}`, actingUserId);
        await client.query('COMMIT');
        return res.status(200).json({ message: 'Agent updated successfully', agent: updated });
    } catch (err) {
        await client.query('ROLLBACK');
        // Duplicate handling
        if (err && err.code === '23505') {
            const constraint = err.constraint || '';
            if (constraint.includes('agents_email')) return res.status(400).json({ message: 'Email already exists' });
            if (constraint.includes('agents_phone')) return res.status(400).json({ message: 'Phone already exists' });
            if (constraint.includes('agents_nic')) return res.status(400).json({ message: 'NIC already exists' });
            if (constraint.includes('login_authentication_username')) return res.status(400).json({ message: 'Username already exists' });
        }
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Delete agent by username, with replacement agent username
const deleteAgentController = async (req, res) => {
    const { username } = req.params;
    const { replacementAgentUsername } = req.query;
    const actingUserId = req.user.userId;

    if (!replacementAgentUsername) {
        return res.status(400).json({ error: 'replacementAgentUsername is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await deleteAgentByUsername(client, actingUserId, username, replacementAgentUsername);
        await logSystemActivity(client, 'DELETE_AGENT', `Admin ${actingUserId} deleted agent ${username}`, actingUserId);
        await client.query('COMMIT');
        return res.status(200).json({ message: result.message });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Deactivate agent by username, with replacement agent username
const deactivateAgentController = async (req, res) => {
    const { username } = req.params;
    const { replacementAgentUsername } = req.body;
    const actingUserId = req.user.userId;

    if (!replacementAgentUsername) {
        return res.status(400).json({ error: 'replacementAgentUsername is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await deleteAgentByUsername(client, actingUserId, username, replacementAgentUsername);
        await logSystemActivity(client, 'DEACTIVATE_AGENT', `Admin ${actingUserId} deactivated agent ${username}`, actingUserId);
        await client.query('COMMIT');
        return res.status(200).json({ message: result.message });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('AGENT DEACTIVATION ERROR:', err);
        return res.status(500).json({ error: err.message, stack: err.stack });
    } finally {
        client.release();
    }
};

// Activate agent by username
const activateAgentController = async (req, res) => {
    const { username } = req.params;
    const actingUserId = req.user.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_user_id = '${actingUserId}'`);
        
        // Check if agent exists
        const { rows: agent } = await client.query(
            `SELECT la.user_id
             FROM login_authentication la
             JOIN agents a ON a.user_id = la.user_id
             WHERE UPPER(la.username) = UPPER($1) AND la.role = 'agent'`,
            [username]
        );
        if (agent.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Agent not found' });
        }
        const userId = agent[0].user_id;

        // Activate the agent (set is_active = true)
        await client.query(`UPDATE agents SET is_active = TRUE WHERE user_id = $1`, [userId]);
        
        await logSystemActivity(client, 'ACTIVATE_AGENT', `Admin ${actingUserId} activated agent ${username}`, actingUserId);
        await client.query('COMMIT');
        return res.status(200).json({ message: 'Agent activated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('AGENT ACTIVATION ERROR:', err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Admin self-deactivation endpoint
const deactivateSelfController = async (req, res) => {
    const adminId = req.user.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const result = await deactivateSelfAdmin(client, adminId);
        
        await logSystemActivity(client, 'DEACTIVATE_SELF', `Admin ${adminId} deactivated their own account`, adminId);
        await client.query('COMMIT');
        
        return res.status(200).json({ 
            message: result.message,
            logout: true  // Signal to frontend to logout
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('ADMIN SELF-DEACTIVATION ERROR:', err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};


export default { addAdmin,addAgent,addBranch,agentWiseTransactions,accountWiseTransactions,activeFDs,interestDistribution,customerActivity,customerActivityForAcc,systemLogs,auditlogs, listAgentsController, getAgentController, updateAgentController, deleteAgentController, deactivateAgentController, activateAgentController, deactivateSelfController, listDeactivatedAdminsController, reactivateAdminController };