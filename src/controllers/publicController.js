import {loginmodel} from '../models/publicModel.js';
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';

dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET_KEY;

const login = async (req,res)=>{

    const {username, password} = req.body;

    try {
        const result = await loginmodel(username);  // ✅ call the model function
        
        if(!result){
            res.status(400).json({error: "User not found"});
        }
        const isValid = await bcrypt.compare(password, result.password);

        if(!isValid){
            res.status(200).json({message: "invalid password"});
        }

        const token = jwt.sign(
            {userId: result.user_id, role: result.role},
           SECRET_KEY,
            {expiresIn: '1h'}
        );
        res.status(200).json({ message: "Login successful", token });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: err.message});
    }
}

export default {login}