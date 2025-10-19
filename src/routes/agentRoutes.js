import express from 'express';
import { Router } from 'express';
import { addCustomer, addSavingsAccount, addFixedDepositeAccount, makeDeposit, makeWithdraw, accToAccTransfer, listCustomersController, getCustomerController, updateCustomerController, bulkCreateCustomersController, deleteCustomerController, reactivateCustomerController, deleteSavingsAccountController, reactivateSavingsAccountController, deleteFixedDepositController, reactivateFixedDepositController, getCustomerAccountsController, getAllSavingsAccountsController, getAllFixedDepositsController, getJointAccountController } from '../controllers/agentController.js';
import { getAllSavingsPlansController } from '../controllers/savingsPlansController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import manageCustRoutes from '../routes/manageCustRoutes.js'
//import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.post('/addcustomer',authMiddleware.authenticateRole(['agent']),agentController.addCustomer);
router.use('/managecustomer',manageCustRoutes);
export default router;


