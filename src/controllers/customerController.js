import { createAccount } from '../models/customerModel';

export const addAccount = async (req, res) => {
    const agent_id = req.user?.userId; // still validate ownership elsewhere if required
    const { customer_id, balance, active_status, plan_id } = req.body;

    try {
        const accountNo = await createAccount({
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