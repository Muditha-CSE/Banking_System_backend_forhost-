import express from 'express';
import { Router } from 'express';
import { getCustomerDetails, deleteSavingsAccountByCustomerController, addSevAccount, addJointAccount, addFixedDeposit } from '../controllers/customerController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.get('/getCustomerDetails/:nic', authMiddleware.authenticateRole(['customer']), getCustomerDetails);

// Delete (deactivate) savings account by customer
router.delete('/savingsaccounts/:accountNo', authMiddleware.authenticateRole(['agent']), deleteSavingsAccountByCustomerController);

// Moved from manageCustRoutes: agent-only endpoints to manage customers
router.post(
	'/addservingsaccount',
	authMiddleware.authenticateRole(['agent']),
	addSevAccount
);

router.post(
	'/addjointaccount',
	authMiddleware.authenticateRole(['agent']),
	addJointAccount
);

router.post(
	'/addfixeddeposit',
	authMiddleware.authenticateRole(['agent']),
	addFixedDeposit
);

export default router;