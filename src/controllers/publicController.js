import {loginmodel, loginCustomerModel} from '../models/publicModel.js';
import {logSystemActivity} from '../models/systemModel.js';
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
import pool from '../../database.js';

dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET_KEY;

const login = async (req,res)=>{

    const {username, password} = req.body;
    try {
        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }
        if(password.length < 8){
            return res.status(400).json({message: "Password must be at least 8 characters long"});
        }
        const result = await loginmodel(pool,username);  
        
        if(!result){
           return res.status(401).json({ message: "Invalid username or password" });
        }
        
        // Check if user is active (for admins and agents)
        if (result.role === 'admin' && result.admin_is_active === false) {
            return res.status(403).json({ message: "Account is deactivated. Please contact system administrator." });
        }
        if (result.role === 'agent' && result.agent_is_active === false) {
            return res.status(403).json({ message: "Account is deactivated. Please contact your administrator." });
        }
        
        const isValid = await bcrypt.compare(password, result.password);

        if(!isValid){
           return res.status(401).json({ message: "Invalid username or password" });
        }

        const token = jwt.sign(
            {userId: result.user_id, role: result.role},
           SECRET_KEY,
            {expiresIn: '1h'}
        );
        await logSystemActivity(pool, 'LOGIN', `User ${username} logged in`, result.user_id);
    return res.status(200).json({ message: "Login successful", token });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: err.message});
    }
}

const logincustomer = async (req, res) => {
    const { nic, password } = req.body;
    
    try {
        // Validate input
        if (!nic || !password) {
            return res.status(400).json({ message: "NIC and password are required" });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters long" });
        }

        // Find customer
        const customer = await loginCustomerModel(pool, nic);
        
        if (!customer) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // Check if customer account is active
        if (!customer.is_active) {
            return res.status(403).json({ message: "Account is inactive. Please contact your branch." });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, customer.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // Generate JWT token with customer_id and nic only
        const token = jwt.sign(
            {
                userId: customer.customer_id,
                nic: customer.nic,
                role: 'customer'
            },
            SECRET_KEY,
            { expiresIn: '8h' }
        );

        // Log the login activity
        await logSystemActivity(
            pool, 
            'LOGIN', 
            `Customer ${customer.nic} logged in`, 
            customer.customer_id
        );

        // Return success with token and user info
        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                userId: customer.customer_id,
                nic: customer.nic,
                role: 'customer'
            }
        });
    } catch (err) {
        console.error('Customer login error:', err);
        return res.status(500).json({ error: "An error occurred during login. Please try again." });
    }
};

export default {login, logincustomer}