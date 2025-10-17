import {addNewCustomer,getAgentBranch,searchCustomer,createSavingsAccount,getMinBalance,
    fdChecker,createFixedDepositeAccount,accountChecker,makeDepositeAccount
    ,makeWithdrawAccount,getAccinfo,insertFailedWIthdrawal,accToAccTrans,checkRoleAccount
            ,getMinAge, listCustomers, getCustomerByNIC, updateCustomerByNIC, bulkCreateCustomers, deleteCustomerByNIC, reactivateCustomerByNIC, deleteSavingsAccountByNIC, reactivateSavingsAccountByNIC, deleteFixedDepositByNIC, reactivateFixedDepositByNIC, getSavingsAccountsByNIC, getFixedDepositsByNIC, getAllSavingsAccounts, getAllFixedDeposits, getJointAccountByAccountAndNic} from '../models/agentModel.js';
import { findPlanByAge } from '../models/savingsPlansModel.js';

import {logSystemActivity} from '../models/systemModel.js';
import bcrypt from 'bcrypt';
import pool from '../../database.js';

const addCustomer = async (req,res)=>{
    const {username,name,email,phone,NIC,gender,address,DOB,password} = req.body;
    const agent_id = req.user.userId;
    const normalizedNIC = (NIC || '').trim().toUpperCase();
    const NICs = [normalizedNIC];

    const hashedPassword = await bcrypt.hash(password,10);
    
    const client = await pool.connect();

    try{
        await client.query('BEGIN');
        if(password.length < 8){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Password must be at least 8 characters long"});    
        }
        
        // Validate NIC: 12 digits OR 9 digits + V/v
        const nicValid = (/^\d{12}$/).test(NIC) || (/^\d{9}[Vv]$/).test(NIC);
        if (!nicValid) {
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid NIC. Must be 12 digits or 9 digits followed by V/v."});
        }
        // Validate phone: 10 digits starting with 0 OR +94 and 9 digits
        const phoneValid = (/^0\d{9}$/).test(phone) || (/^\+94\d{9}$/).test(phone);
        if (!phoneValid) {
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Invalid phone number. Must be 10 digits starting with 0 or +94 followed by 9 digits."});
        }
        const branch_id = await getAgentBranch(client,agent_id);
        const result = await searchCustomer(client,NICs);

        if(result.ok === false){
            await addNewCustomer(client,username,name,email,phone,normalizedNIC,gender,address,DOB,agent_id,branch_id,hashedPassword);
            await logSystemActivity(client, 'ADD_CUSTOMER', `Customer ${username} added by agent ID ${agent_id}`, agent_id);
            await client.query('COMMIT');
            return res.status(200).json({message: "Customer added successfully"});
        };
        return res.status(400).json({message: "NIC is already registered"});

    }catch(err){
        await client.query('ROLLBACK');
        if (err && err.code === '23505') { // unique_violation
            const constraint = err.constraint || '';
            if (constraint.includes('customers_username')) {
                return res.status(400).json({ message: 'Username already exists' });
            }
            if (constraint.includes('customers_nic') || constraint.includes('customers_NIC')) {
                return res.status(400).json({ message: 'NIC is already registered' });
            }
            if (constraint.includes('customers_email')) {
                return res.status(400).json({ message: 'Email already exists' });
            }
            return res.status(400).json({ message: 'Duplicate value violates a unique constraint' });
        }
        console.error(err);
        return res.status(500).json({error: err.message});
    }finally{
        client.release();
    }
};

const addSavingsAccount = async (req,res)=>{
    const {created_customer,users,initial_deposit,plan_id} = req.body;
    const agent_id = req.user.userId;
    // Normalize NICs early: trim + uppercase to avoid whitespace/case mismatches
    const normalizedUsers = (Array.isArray(users) ? users : []).map(u => ({
        ...u,
        nic: (u.nic || '').trim().toUpperCase()
    }));
    let normalizedCreatedCustomer = (created_customer || '').trim().toUpperCase();
    // Basic diagnostics
    console.log('addSavingsAccount payload:', {
        created_customer,
        normalizedCreatedCustomer,
        users: normalizedUsers,
        initial_deposit,
        plan_id
    });
    const NICs = normalizedUsers.map(user => user.nic);
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
        // Validate created_customer
        if (!normalizedCreatedCustomer) {
            return res.status(400).json({ message: "Creating customer NIC is required" });
        }
        const createdCustomerNicValid = (/^\d{12}$/).test(normalizedCreatedCustomer) || (/^\d{9}[Vv]$/).test(normalizedCreatedCustomer);
        if (!createdCustomerNicValid) {
            return res.status(400).json({ message: "Invalid creating customer NIC. Must be 12 digits or 9 digits followed by V/v." });
        }
    // Check that creating customer is in holders and is primary
    const creatingHolder = normalizedUsers.find(u => u.nic === normalizedCreatedCustomer);
    if (!creatingHolder) {
        return res.status(400).json({ message: "Creating customer must be in the account holders list" });
    }
    if ((creatingHolder.role || '').toLowerCase() !== 'primary') {
        return res.status(400).json({ message: "Creating customer must be a primary account holder" });
    }

        // Validate NIC format for each user: 12 digits OR 9 digits + V/v
        const nicSet = new Set();
        for (const raw of users) {
            const nicOriginal = raw?.nic ?? '';
            const nic = (nicOriginal || '').trim();
            const isValid = (/^\d{12}$/).test(nic) || (/^\d{9}[Vv]$/).test(nic);
            if (!isValid) nicSet.add(nicOriginal);
        }
        if(nicSet.size > 0){
            return res.status(400).json({message: `The following NICs have invalid format or length: ${Array.from(nicSet).join(', ')}`});
        }
    // Check customers exist (case-insensitive + trimmed inside model as well)
    const checkCustomer = await searchCustomer(client,NICs);
    // Check created_customer exists
    const checkCreated = await searchCustomer(client,[normalizedCreatedCustomer]);
    console.log('Customer existence check:', { holders: checkCustomer, created: checkCreated });
        
        // Check if any holders are deactivated
        if (!checkCustomer.ok) {
            return res.status(400).json({ 
                message: `Cannot create account. Some customers are deactivated: ${checkCustomer.deactivated.join(', ')}` 
            });
        }
        
        // Check if creating customer is deactivated
        if (!checkCreated.ok) {
            return res.status(400).json({ 
                message: `Cannot create account. Creating customer is deactivated: ${checkCreated.deactivated.join(', ')}` 
            });
        }
        
        const branch_id = await getAgentBranch(client,agent_id);
        
        // Determine final plan_id: use provided plan_id (for joint accounts) or calculate by age (for single accounts)
        let finalPlanId;
        let planDetails;
        
        if (plan_id) {
            // Plan provided (joint account case)
            finalPlanId = plan_id;
            // Get plan details including age range
            const planQuery = await client.query(
                'SELECT plan_id, plan_name, min_age, max_age, min_balance FROM savingsPlans WHERE plan_id = $1',
                [plan_id]
            );
            if (planQuery.rows.length === 0) {
                return res.status(400).json({ message: `Invalid plan_id: ${plan_id}` });
            }
            planDetails = planQuery.rows[0];
            
            // For joint accounts (plan_id 5), validate ALL holders are within age range
            if (normalizedUsers.length > 1) {
                // Get all holders' ages
                const holdersData = checkCustomer.existing;
                const invalidAgeHolders = [];
                
                for (const holder of holdersData) {
                    const birthDate = new Date(holder.dob);
                    const ageDifMs = Date.now() - birthDate.getTime();
                    const holderAge = Math.floor(ageDifMs / 31557600000);
                    
                    // Check if age is within plan range
                    if (holderAge < planDetails.min_age || (planDetails.max_age && holderAge > planDetails.max_age)) {
                        invalidAgeHolders.push(`${holder.nic} (age ${holderAge})`);
                    }
                }
                
                if (invalidAgeHolders.length > 0) {
                    return res.status(400).json({ 
                        message: `The following holders are outside the age range (${planDetails.min_age}-${planDetails.max_age}) for ${planDetails.plan_name}: ${invalidAgeHolders.join(', ')}` 
                    });
                }
            }
        } else {
            // No plan provided, calculate by creating customer's age (single account case)
            const creatingCustomer = checkCreated.existing && checkCreated.existing[0];
            if (!creatingCustomer) {
                return res.status(400).json({ message: "Creating customer not found" });
            }
            const birthDate = new Date(creatingCustomer.dob);
            const ageDifMs = Date.now() - birthDate.getTime();
            const age = Math.floor(ageDifMs / 31557600000);
            // Find plan by age
            const plan = await findPlanByAge(client, age);
            if (!plan) {
                return res.status(400).json({ message: `No savings plan available for age ${age}` });
            }
            finalPlanId = plan.plan_id;
            planDetails = plan;
        }

        if(checkCustomer.ok === false){
            if(checkCustomer.deactivated){
                return res.status(400).json({message: `The following customers are deactivated and cannot open accounts: ${checkCustomer.deactivated.join(', ')}`});
            }
            return res.status(400).json({message: `The following NICs are not registered: ${checkCustomer.missing.join(', ')}`});
        }
        if(checkCreated.ok === false){
            if(checkCreated.deactivated){
                return res.status(400).json({message: `created_customer is deactivated: ${normalizedCreatedCustomer}`});
            }
            return res.status(400).json({message: `created_customer NIC is not registered: ${normalizedCreatedCustomer}`});
        }
        const min_balance = await getMinBalance(client, finalPlanId);
        if (initial_deposit < min_balance) {
            return res.status(400).json({ message: `Initial deposit should be at least ${min_balance}` });
        }
        // Use normalizedUsers when creating account holders to avoid FK mismatches
        const account_no = await createSavingsAccount(client, normalizedUsers, initial_deposit, agent_id, branch_id, finalPlanId, normalizedCreatedCustomer);
        // Verify insert before committing
        const verify = await client.query(
            'select account_no, balance, branch_id, created_customer_nic from savingsAccounts where account_no = $1',
            [account_no]
        );
        if (verify.rows.length === 0) {
            throw new Error('Verification failed: savings account not found after insert');
        }
        await logSystemActivity(client, 'CREATE_SAVINGS_ACCOUNT', `Savings account ${account_no} created by agent ID ${agent_id}`, agent_id);
        await logSystemActivity(client, 'DEPOSIT', `Amount ${initial_deposit} deposited to account ${account_no} by agent ID ${agent_id}`, agent_id);
        await client.query('COMMIT');
        return res.status(200).json({
            message: "Savings account created successfully with account number: " + account_no,
            account_no: account_no,
            account: verify.rows[0]
        });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('addSavingsAccount error:', err);
            return res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    };



const addFixedDepositeAccount = async (req,res)=>{
    const {account_no,fd_plan_id,amount,NIC} = req.body;
    const agent_id = req.user.userId;
    
    // DEBUG: Log the entire request body to see what frontend is sending
    console.log('FD Request body:', JSON.stringify(req.body, null, 2));
    console.log('FD Extracted values:', { account_no, fd_plan_id, amount, NIC });

    const client = await pool.connect();

    try{
        await client.query('BEGIN');
        const nicRaw = (NIC || '').trim();
        const nicUpper = nicRaw.toUpperCase();
        console.log('FD NIC validation - raw:', nicRaw, 'length:', nicRaw.length, 'upper:', nicUpper);
        // Validate NIC (12 digits or 9 digits + V/v, case-insensitive)
        if (!/^(?:\d{12}|\d{9}V)$/i.test(nicUpper)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: `Invalid NIC format. Received '${nicRaw}' with ${nicRaw.length} characters. Must be exactly 12 digits or 9 digits followed by V/v.`
            });
        }

        // Check if customer exists and is active
        const getUserAge = await searchCustomer(client,[nicUpper]);
        
        if(getUserAge.ok === false){
            if(getUserAge.deactivated){
                await client.query('ROLLBACK');
                return res.status(400).json({message: `Customer is deactivated and cannot open fixed deposit accounts: ${nicUpper}`});
            }
            await client.query('ROLLBACK');
            return res.status(400).json({message: `Customer with NIC ${nicUpper} is not registered`});
        }
        
        if(getUserAge.ok === true){
            const birthDate = new Date(getUserAge.existing[0].dob);
            const ageDifMs = Date.now() - birthDate.getTime();
            const age = Math.floor(ageDifMs / 31557600000);
            if(age < 18){
                await client.query('ROLLBACK');
                return res.status(400).json({message: "Customer must be at least 18 years old to open a fixed deposit account"});
            }
        }

        // Check if NIC is associated with the account and get holder details
        const accountCheck = await accountChecker(client,account_no,nicUpper);
        if(!accountCheck){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "This NIC is not associated with the specified account number"});
        }

        // Check if it's a joint account (more than one holder)
        const holderCountQuery = await client.query(
            'SELECT COUNT(*) as holder_count FROM accountHolders WHERE account_no = $1',
            [account_no]
        );
        const holderCount = parseInt(holderCountQuery.rows[0].holder_count);

        // For joint accounts, only primary holder can create FD
        if (holderCount > 1 && accountCheck.role !== 'primary') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: "Only the primary account holder can create a fixed deposit for a joint account"
            });
        }
        // Ensure linked savings account is active
        const savingsAccInfo = await getAccinfo(client, account_no);
        if (!savingsAccInfo) {
            return res.status(400).json({ message: "Linked savings account not found" });
        }
        if (savingsAccInfo.active_status === false) {
            return res.status(400).json({ message: "Linked savings account is deactivated. Cannot create fixed deposit." });
        }
        const fdCheck = await fdChecker(client,account_no);

        if(fdCheck > 0){
            return res.status(400).json({message: "Fixed deposit account already exists for the given savings account"});
        }

        const checkRole = await checkRoleAccount(client,account_no,nicUpper);
        if(checkRole !== 'primary'){
            return res.status(400).json({message: "Only primary account holder can create a fixed deposit account"});
        }
        
        await createFixedDepositeAccount(client,account_no,fd_plan_id,amount,agent_id);
        await logSystemActivity(client, 'CREATE_FD_ACCOUNT', `Fixed deposit account linked to ${account_no} created by agent ID ${agent_id}`, agent_id);
        await client.query('COMMIT');
        return res.status(200).json({message: "Fixed deposit account created successfully"});

    }catch(err){
        await client.query('ROLLBACK');
        console.error('FD Creation Error:', err);
        return res.status(500).json({
            message: err.message || 'Failed to create fixed deposit',
            error: err.message
        });
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
        // Validate NIC (12 digits or 9 digits + V/v)
        if (!/^(?:\d{12}|\d{9}[Vv])$/.test(customer_nic)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Invalid NIC format. Must be 12 digits or 9 digits followed by V/v." });
        }
        const accountCheck = await accountChecker(client,account_no,customer_nic);
        if(accountCheck === 0){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "Account does not exist"});
        }
        if(accountCheck.customer_nic !== customer_nic){
            await client.query('ROLLBACK');
            return res.status(400).json({message: "NIC does not match with the account number"});
        }

        // Enforce active account only
        const accInfo = await getAccinfo(client, account_no);
        if (!accInfo) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Account does not exist" });
        }
        if (accInfo.active_status === false) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Account is deactivated. Transactions are not allowed." });
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
        // Validate NIC (12 digits or 9 digits + V/v)
        if (!/^(?:\d{12}|\d{9}[Vv])$/.test(customer_nic)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Invalid NIC format. Must be 12 digits or 9 digits followed by V/v." });
        }
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
        if (Accinfo && Accinfo.active_status === false) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Account is deactivated. Transactions are not allowed." });
        }
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
        // Validate sender NIC (12 digits or 9 digits + V/v)
        if (!/^(?:\d{12}|\d{9}[Vv])$/.test(sender_NIC)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Invalid sender NIC format. Must be 12 digits or 9 digits followed by V/v." });
        }
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
        const receiverInfo = await getAccinfo(client, receiver_account_no);
        if (receiverInfo && receiverInfo.active_status === false) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Receiver account is deactivated. Transactions are not allowed." });
        }
        const accinfo = await getAccinfo(client,sender_account_no);
        if (accinfo && accinfo.active_status === false) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Sender account is deactivated. Transactions are not allowed." });
        }
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


// List all customers (agent can see all)
const listCustomersController = async (req, res) => {
    const agentId = req.user.userId;
    try {
        const customers = await listCustomers(pool, agentId);
        return res.status(200).json({ customers });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};

// Get single customer by NIC
const getCustomerController = async (req, res) => {
    const { nic } = req.params;
    try {
        const customer = await getCustomerByNIC(pool, nic);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });
        return res.status(200).json({ customer });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};

// Update customer by NIC
const updateCustomerController = async (req, res) => {
    const { nic } = req.params;
    const agentId = req.user.userId;
    const { username, name, email, phone, newNic, gender, address, DOB, is_active, password } = req.body;

    // Validations
    if (phone && !(/^0\d{9}$/.test(phone) || /^\+94\d{9}$/.test(phone))) {
        return res.status(400).json({ message: 'Invalid phone format' });
    }
    if (newNic && !(/^(?:\d{12}|\d{9}[Vv])$/.test(newNic))) {
        return res.status(400).json({ message: 'Invalid NIC format' });
    }
    if (gender && !['male', 'female'].includes(gender)) {
        return res.status(400).json({ message: 'Gender must be male or female' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updates = { username, name, email, phone, nic: newNic, gender, address, DOB, is_active };
        if (password) {
            if (password.length < 8) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Password must be at least 8 characters long' });
            }
            const hash = await bcrypt.hash(password, 10);
            updates.passwordHash = hash;
        }
        const updated = await updateCustomerByNIC(client, agentId, nic, updates);
        await logSystemActivity(client, 'ADD_CUSTOMER', `Agent ${agentId} updated customer ${nic}`, agentId);
        await client.query('COMMIT');
        return res.status(200).json({ message: 'Customer updated successfully', customer: updated });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err && err.code === '23505') {
            const constraint = err.constraint || '';
            if (constraint.includes('customers_email')) return res.status(400).json({ message: 'Email already exists' });
            if (constraint.includes('customers_phone')) return res.status(400).json({ message: 'Phone already exists' });
            if (constraint.includes('customers_nic')) return res.status(400).json({ message: 'NIC already exists' });
            if (constraint.includes('customers_username')) return res.status(400).json({ message: 'Username already exists' });
        }
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Bulk create customers from CSV
const bulkCreateCustomersController = async (req, res) => {
    const agentId = req.user.userId;
    const { customers } = req.body; // array of { username, name, email, phone, nic, gender, address, DOB, password }

    console.log('Received bulk customer data:', JSON.stringify(customers, null, 2));
    console.log('Number of customers:', customers?.length);
    
    if (!Array.isArray(customers) || customers.length === 0) {
        return res.status(400).json({ message: 'No customers provided' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const branchId = await getAgentBranch(client, agentId);

        // Validate and hash passwords
        const validated = [];
        for (const c of customers) {
            // Log the customer data for debugging
            console.log(`Validating customer ${c.username}:`, {
                username: c.username,
                name: c.name,
                email: c.email,
                phone: c.phone,
                nic: c.nic,
                gender: c.gender,
                address: c.address,
                DOB: c.DOB,
                hasPassword: !!c.password
            });
            
            if (!c.username || !c.name || !c.email || !c.phone || !c.nic || !c.gender || !c.address || !c.DOB || !c.password) {
                throw new Error(`Missing required fields for customer: ${JSON.stringify(c)}`);
            }
            if (c.password.length < 8) {
                throw new Error(`Password too short for customer ${c.username}`);
            }
            const nicValid = (/^\d{12}$/).test(c.nic) || (/^\d{9}[Vv]$/).test(c.nic);
            if (!nicValid) {
                throw new Error(`Invalid NIC for customer ${c.username}`);
            }
            const phoneValid = (/^0\d{9}$/).test(c.phone) || (/^\+94\d{9}$/).test(c.phone);
            if (!phoneValid) {
                throw new Error(`Invalid phone for customer ${c.username}`);
            }
            // Normalize gender to lowercase and trim
            const normalizedGender = (c.gender || '').toString().trim().toLowerCase();
            if (!['male', 'female'].includes(normalizedGender)) {
                throw new Error(`Invalid gender for customer ${c.username}. Must be 'male' or 'female', got: '${c.gender}'`);
            }
            const hashedPassword = await bcrypt.hash(c.password, 10);
            validated.push({
                username: c.username,
                password: hashedPassword,
                name: c.name,
                email: c.email,
                phone: c.phone,
                nic: c.nic.trim().toUpperCase(),
                gender: normalizedGender,  // Use normalized gender
                address: c.address,
                DOB: c.DOB,
            });
        }

        const inserted = await bulkCreateCustomers(client, agentId, branchId, validated);
        await logSystemActivity(client, 'ADD_CUSTOMER', `Agent ${agentId} bulk-created ${inserted.length} customers`, agentId);
        await client.query('COMMIT');
        return res.status(200).json({ message: `${inserted.length} customers created successfully`, customers: inserted });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Delete customer by NIC
const deleteCustomerController = async (req, res) => {
    const { nic } = req.params;
    const agentId = req.user.userId;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await deleteCustomerByNIC(client, agentId, nic);
        await logSystemActivity(client, 'DEACTIVATE_CUSTOMER', `Agent ${agentId} deactivated customer with NIC ${nic}`, agentId);
        await client.query('COMMIT');
        return res.status(200).json({ message: result.message });
    } catch (err) {
        await client.query('ROLLBACK');
        // Map not-found to 404
        if (String(err?.message || '').toLowerCase().includes('customer not found')) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Reactivate customer by NIC
const reactivateCustomerController = async (req, res) => {
    const { nic } = req.params;
    const agentId = req.user.userId;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await reactivateCustomerByNIC(client, agentId, nic);
        await logSystemActivity(client, 'REACTIVATE_CUSTOMER', `Agent ${agentId} reactivated customer with NIC ${nic}`, agentId);
        await client.query('COMMIT');
        return res.status(200).json({ message: result.message });
    } catch (err) {
        await client.query('ROLLBACK');
        // Map not-found to 404
        if (String(err?.message || '').toLowerCase().includes('customer not found')) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Delete Savings Account
const deleteSavingsAccountController = async (req, res) => {
    const { account_no } = req.params;
    const { customer_nic } = req.body;
    const agentId = req.user.userId;
    const client = await pool.connect();

    try {
        if (!customer_nic) {
            return res.status(400).json({ error: 'Customer NIC is required' });
        }

        const result = await deleteSavingsAccountByNIC(client, account_no, customer_nic, agentId);
        await logSystemActivity(client, 'DEACTIVATE_SAVINGS_ACCOUNT', `Agent ${agentId} deactivated savings account ${account_no} by customer NIC ${customer_nic}`, agentId);
        return res.status(200).json({ message: result.message });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Reactivate Savings Account
const reactivateSavingsAccountController = async (req, res) => {
    const { account_no } = req.params;
    const { customer_nic } = req.body;
    const agentId = req.user.userId;
    const client = await pool.connect();

    try {
        if (!customer_nic) {
            return res.status(400).json({ error: 'Customer NIC is required' });
        }

        const result = await reactivateSavingsAccountByNIC(client, account_no, customer_nic, agentId);
        await logSystemActivity(client, 'REACTIVATE_SAVINGS_ACCOUNT', `Agent ${agentId} reactivated savings account ${account_no} by customer NIC ${customer_nic}`, agentId);
        return res.status(200).json({ message: result.message });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Delete Fixed Deposit
const deleteFixedDepositController = async (req, res) => {
    const { fd_account_no } = req.params;
    const { customer_nic } = req.body;
    const agentId = req.user.userId;
    const client = await pool.connect();

    try {
        if (!customer_nic) {
            return res.status(400).json({ error: 'Customer NIC is required' });
        }

        const result = await deleteFixedDepositByNIC(client, fd_account_no, customer_nic, agentId);
        await logSystemActivity(client, 'DEACTIVATE_FIXED_DEPOSIT', `Agent ${agentId} deactivated fixed deposit ${fd_account_no} by customer NIC ${customer_nic}`, agentId);
        return res.status(200).json({ message: result.message });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Reactivate Fixed Deposit
const reactivateFixedDepositController = async (req, res) => {
    const { fd_account_no } = req.params;
    const { customer_nic } = req.body;
    const agentId = req.user.userId;
    const client = await pool.connect();

    try {
        if (!customer_nic) {
            return res.status(400).json({ error: 'Customer NIC is required' });
        }

        const result = await reactivateFixedDepositByNIC(client, fd_account_no, customer_nic, agentId);
        await logSystemActivity(client, 'REACTIVATE_FIXED_DEPOSIT', `Agent ${agentId} reactivated fixed deposit ${fd_account_no} by customer NIC ${customer_nic}`, agentId);
        return res.status(200).json({ message: result.message });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// Get customer accounts (savings accounts and fixed deposits) by NIC
const getCustomerAccountsController = async (req, res) => {
    const { nic } = req.params;
    
    try {
        const savingsAccounts = await getSavingsAccountsByNIC(pool, nic);
        const fixedDeposits = await getFixedDepositsByNIC(pool, nic);
        
        return res.status(200).json({
            savingsAccounts,
            fixedDeposits
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};

// Get all savings accounts
const getAllSavingsAccountsController = async (req, res) => {
    try {
        const accounts = await getAllSavingsAccounts(pool);
        return res.status(200).json({ accounts });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};

// Get all fixed deposits
const getAllFixedDepositsController = async (req, res) => {
    try {
        const deposits = await getAllFixedDeposits(pool);
        return res.status(200).json({ deposits });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};

// Get joint account by account number and NIC
const getJointAccountController = async (req, res) => {
    const { account_no, nic } = req.query;
    const client = await pool.connect();
    
    try {
        if (!account_no || !nic) {
            return res.status(400).json({ error: 'Both account number and NIC are required' });
        }
        
        const result = await getJointAccountByAccountAndNic(client, account_no, nic);
        
        if (!result.ok) {
            return res.status(404).json({ message: result.message });
        }
        
        return res.status(200).json({ account: result.account });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

export { addCustomer, addSavingsAccount, addFixedDepositeAccount, fdChecker, makeDeposit, makeWithdraw, accToAccTransfer, listCustomersController, getCustomerController, updateCustomerController, bulkCreateCustomersController, deleteCustomerController, reactivateCustomerController, deleteSavingsAccountController, reactivateSavingsAccountController, deleteFixedDepositController, reactivateFixedDepositController, getCustomerAccountsController, getAllSavingsAccountsController, getAllFixedDepositsController, getJointAccountController };

