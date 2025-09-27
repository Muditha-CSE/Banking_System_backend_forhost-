import {addUser} from '../models/agentModel.js';

const adduser = async (req,res)=>{
    console.log("Reached adduser controller");
    await addUser();
}

export default {adduser}