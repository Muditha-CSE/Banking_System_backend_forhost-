import express from 'express';
import { Router } from 'express';
import { addCustomer, addSavingsAccount, addFixedDepositeAccount, makeDeposit, makeWithdraw, accToAccTransfer, listCustomersController, getCustomerController, updateCustomerController, bulkCreateCustomersController, deleteCustomerController, reactivateCustomerController, deleteSavingsAccountController, reactivateSavingsAccountController, deleteFixedDepositController, reactivateFixedDepositController, getCustomerAccountsController, getAllSavingsAccountsController, getAllFixedDepositsController, getJointAccountController } from '../controllers/agentController.js';
import { getAllSavingsPlansController } from '../controllers/savingsPlansController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.post('/addcustomer',authMiddleware.authenticateRole(['agent']),addCustomer);
router.post('/addsavingsaccount',authMiddleware.authenticateRole(['agent']),addSavingsAccount);
router.post('/addfixeddeposite',authMiddleware.authenticateRole(['agent']),addFixedDepositeAccount);

router.post('/makedeposit',authMiddleware.authenticateRole(['agent']),makeDeposit);
router.post('/makewithdraw',authMiddleware.authenticateRole(['agent']),makeWithdraw);
router.post('/acctocctransfer',authMiddleware.authenticateRole(['agent']),accToAccTransfer);

// Customer management
router.get('/customers',authMiddleware.authenticateRole(['agent']),listCustomersController);
router.get('/customers/:nic',authMiddleware.authenticateRole(['agent']),getCustomerController);
router.get('/customers/:nic/accounts',authMiddleware.authenticateRole(['agent']),getCustomerAccountsController);
router.put('/customers/:nic',authMiddleware.authenticateRole(['agent']),updateCustomerController);
router.post('/customers/bulk',authMiddleware.authenticateRole(['agent']),bulkCreateCustomersController);
router.delete('/customers/:nic',authMiddleware.authenticateRole(['agent']),deleteCustomerController);
router.patch('/customers/:nic/reactivate',authMiddleware.authenticateRole(['agent']),reactivateCustomerController);

// Savings Account & Fixed Deposit management
router.get('/savingsaccounts',authMiddleware.authenticateRole(['agent']),getAllSavingsAccountsController);
router.get('/jointaccount',authMiddleware.authenticateRole(['agent']),getJointAccountController);
router.delete('/savingsaccounts/:account_no',authMiddleware.authenticateRole(['agent']),deleteSavingsAccountController);
router.patch('/savingsaccounts/:account_no/deactivate',authMiddleware.authenticateRole(['agent']),deleteSavingsAccountController);
router.patch('/savingsaccounts/:account_no/reactivate',authMiddleware.authenticateRole(['agent']),reactivateSavingsAccountController);
router.get('/fixeddeposits',authMiddleware.authenticateRole(['agent']),getAllFixedDepositsController);
router.delete('/fixeddeposits/:fd_account_no',authMiddleware.authenticateRole(['agent']),deleteFixedDepositController);
router.patch('/fixeddeposits/:fd_account_no/reactivate',authMiddleware.authenticateRole(['agent']),reactivateFixedDepositController);
router.get('/savingsplans', authMiddleware.authenticateRole(['agent']), getAllSavingsPlansController);

export default router;


