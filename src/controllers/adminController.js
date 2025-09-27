import {addnewAdmin} from '../models/adminModel.js';

const addAdmin = async (req,res)=>{
    console.log("Reached addAdmin controller");
    await addnewAdmin();
}



export default { addAdmin };