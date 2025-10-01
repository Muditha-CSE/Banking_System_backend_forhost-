import {addNewCustomer,searchCustomer} from '../models/agentModel.js';

const addCustomer = async (req,res)=>{
    const {username,name,email,phone,NIC,gender,address,DOB} = req.body;
    const agent_id = req.user.userId;
    
    try{
        const result = await searchCustomer(username);
        if(!result){
            await addNewCustomer(username,name,email,phone,NIC,gender,address,DOB,agent_id);
            return res.status(200).json({message: "Customer added successfully"});
        };
        return res.status(400).json({message: "Username already exists"});
    }catch(err){
        console.error(err);
        return res.status(500).json({error: err.message});
    }
};

export default {addCustomer}