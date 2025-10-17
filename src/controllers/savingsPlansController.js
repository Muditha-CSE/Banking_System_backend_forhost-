import pool from '../../database.js';
import { getAllSavingsPlans } from '../models/savingsPlansModel.js';

export const getAllSavingsPlansController = async (req, res) => {
    try {
        const plans = await getAllSavingsPlans(pool);
        res.status(200).json({ plans });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
