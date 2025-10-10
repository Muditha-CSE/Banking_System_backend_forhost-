import { calculateMonthlyInterest,fdInterestPayment,removeFDAfterMaturity } from '../models/systemModel.js';
import cron from 'node-cron';


cron.schedule('0 0 * * *', async () => {
    console.log('Running daily interest calculation task');
    
    try {
        try{
            await calculateMonthlyInterest();
        }catch(err){
            console.error('Error during monthly interest calculation', err);
        }
        try{
            await fdInterestPayment();
        }catch(err){
            console.error('Error during FD interest payment', err);
        }
        try{
            await removeFDAfterMaturity();
        }catch(err){
            console.error('Error during FD maturity processing', err);
        }
        console.log('Interest calculation completed successfully');
    } catch (err) {
        console.error('Error during daily check', err);
    }
});


