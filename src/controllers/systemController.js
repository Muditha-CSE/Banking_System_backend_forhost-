import { calculateMonthlyInterest, fdInterestPayment, removeFDAfterMaturity } from '../models/systemModel.js';
import cron from 'node-cron';

cron.schedule('0 0 * * *', async () => {
    console.log('🕐 Running daily interest calculation task');
    
    const results = {
        monthlyInterest: { success: false, error: null, data: null },
        fdInterest: { success: false, error: null, data: null },
        fdMaturity: { success: false, error: null, count: 0 }
    };
    
    try {
        const monthlyResult = await calculateMonthlyInterest();
        results.monthlyInterest.success = true;
        results.monthlyInterest.data = monthlyResult;
        if (monthlyResult.run_status === 'SUCCESS') {
            console.log(`✅ Monthly interest: ${monthlyResult.accounts_processed} accounts, $${monthlyResult.total_interest_paid}`);
        } else if (monthlyResult.run_status === 'SKIPPED') {
            console.log(`⏭️  Monthly interest skipped: ${monthlyResult.message}`);
        }
    } catch (err) {
        console.error('❌ Monthly interest calculation failed:', err.message);
        results.monthlyInterest.error = err.message;
    }
    
    try {
        const fdResult = await fdInterestPayment();
        results.fdInterest.success = true;
        results.fdInterest.data = fdResult;
        if (fdResult.run_status === 'SUCCESS') {
            console.log(`✅ FD interest: ${fdResult.fds_processed} FDs, $${fdResult.total_interest_paid}`);
        } else if (fdResult.run_status === 'SKIPPED') {
            console.log(`⏭️  FD interest skipped: ${fdResult.message}`);
        }
    } catch (err) {
        console.error('❌ FD interest payment failed:', err.message);
        results.fdInterest.error = err.message;
    }
    
    try {
        const maturityCount = await removeFDAfterMaturity();
        results.fdMaturity.success = true;
        results.fdMaturity.count = maturityCount;
        console.log(`✅ FD maturity: ${maturityCount} FDs processed`);
    } catch (err) {
        console.error('❌ FD maturity processing failed:', err.message);
        results.fdMaturity.error = err.message;
    }
    
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalTasks = Object.keys(results).length;
    
    if (successCount === totalTasks) {
        console.log(`✅ Daily task completed successfully (${successCount}/${totalTasks} tasks succeeded)`);
    } else {
        console.error(`⚠️  Daily task completed with errors (${successCount}/${totalTasks} succeeded)`);
        const failedTasks = Object.entries(results)
            .filter(([_, r]) => !r.success)
            .map(([name, r]) => `${name}: ${r.error}`);
        console.error('Failed tasks:', failedTasks.join(', '));
    }
});
