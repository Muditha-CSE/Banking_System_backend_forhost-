import { createSavingsAccount, createJointAccount, createFixedDepositIfNone } from '../models/customerModel';

export const addSevAccount = async (req, res) => {
    const agent_id = req.user?.userId; // still validate ownership elsewhere if required
    const { customer_id, balance, active_status, plan_id } = req.body;

    try {
        const accountNo = await createSavingsAccount({
            customer_id,
            balance,
            active_status,
            plan_id
        });

        return res.status(201).json({ message: 'Account created', accountNo });
    } catch (err) {
        // classify business errors vs server errors by message or custom error types
        const msg = err.message || 'Server error';
        if (msg.startsWith('Insufficient') || msg.startsWith('Customer age') || msg.startsWith('Plan not found') || msg.startsWith('Customer not found') || msg.startsWith('Invalid')) {
            return res.status(400).json({ message: msg });
        }
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};


export const addJointAccount = async (req, res) => {
    // const agent_id = req.user?.userId; // use this if you want ownership/branch checks later
    const { balance, active_status, plan_id, holders, last_transaction_time, last_transaction_id } = req.body;

    try {
        const { accountNo, insertedHolders } = await createJointAccount({
            balance,
            active_status,
            plan_id,
            holders,
            last_transaction_time,
            last_transaction_id
        });

        return res.status(201).json({
            message: 'Joint account created successfully',
            accountNo,
            holders: insertedHolders
        });

    } catch (err) {
        const msg = err.message || 'Server error';

        // classify known business validation errors
        if (
            msg.startsWith('Insufficient') ||
            msg.startsWith('Customer') ||
            msg.startsWith('Plan not found') ||
            msg.startsWith('holders') ||
            msg.startsWith('Invalid') ||
            msg.startsWith('At least one')
        ) {
            return res.status(400).json({ message: msg });
        }

        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const addFixedDeposit = async (req, res) => {

    const { account_no, fd_plan_id, amount } = req.body;

    try {
        const fd = await createFixedDepositIfNone({
            account_no: Number(account_no),
            fd_plan_id,
            amount
        });
        return res.status(201).json({ message: 'Fixed deposit created', fd });
    } catch (err) {
        const msg = err.message || 'Server error';
        if (
            msg.startsWith('Invalid') ||
            msg.startsWith('FD plan not found') ||
            msg.startsWith('Account not found') ||
            msg.startsWith('An active fixed deposit')
        ) {
            return res.status(400).json({ message: msg });
        }
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};