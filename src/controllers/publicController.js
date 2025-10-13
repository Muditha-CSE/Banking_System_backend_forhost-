import {loginmodel} from '../models/publicModel.js';
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
        if(password.length < 8){
            return res.status(400).json({message: "Password must be at least 8 characters long"});
        }
        const result = await loginmodel(pool,username);  
        
        if(!result){
           return res.status(400).json({error: "User not found"});
        }
        const isValid = await bcrypt.compare(password, result.password);

        if(!isValid){
           return res.status(200).json({message: "invalid password"});
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

export default {login}