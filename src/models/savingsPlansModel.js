// Find plan by age
export const findPlanByAge = async (client, age) => {
    const { rows } = await client.query('SELECT plan_id, plan_name FROM savingsPlans WHERE min_age <= $1 AND (max_age IS NULL OR max_age >= $1) ORDER BY min_age LIMIT 1', [age]);
    return rows[0];
};
// Get all savings plans (for dropdowns etc)
export const getAllSavingsPlans = async (client) => {
    const { rows } = await client.query('SELECT plan_id, plan_name FROM savingsPlans ORDER BY plan_name');
    return rows;
};
