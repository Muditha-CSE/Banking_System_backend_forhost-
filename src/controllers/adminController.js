import {addNewAdminToLog,addNewAgentToLog} from '../models/adminModel.js'; 
import {searchUser} from '../models/publicModel.js';
import bcrypt from 'bcrypt';

const addAdmin = async (req,res)=>{
    const {username,password,name,email,phone,NIC} = req.body;
    const created_by = req.user.userId;

    const hashedPassword = await bcrypt.hash(password,10);
    
    try{
        const result = await searchUser(username);
        if(!result){
            await addNewAdminToLog(username,hashedPassword,name,email,phone,NIC,created_by);
            return res.status(200).json({message: "Admin added successfully"});
        }
        return res.status(400).json({message: "Username already exists"});
    }catch(err){
        console.error(err);
        return res.status(500).json({error: err.message});
    }
}

const addAgent = async (req,res)=>{
    const {username,password,name,email,phone,NIC,branch_id} = req.body;
    const created_by = req.user.userId;

    const hashedPassword = await bcrypt.hash(password,10);
    
    try{
        const result = await searchUser(username);
        if(!result){
            await addNewAgentToLog(username,hashedPassword,name,email,phone,NIC,created_by,branch_id);
            return res.status(200).json({message: "Agent added successfully"});
        }
        return res.status(400).json({message: "Username already exists"});
    }catch(err){
        console.error(err);
        return res.status(500).json({error: err.message});
    }
}

export default { addAdmin,addAgent };