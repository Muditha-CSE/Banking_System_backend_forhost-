import express from 'express';
import { Router } from 'express';
import { 
    addCustomer, 
    addSavingsAccount, 
    addFixedDepositeAccount, 
    makeDeposit, 
    makeWithdraw, 
    accToAccTransfer, 
    listCustomersController, 
    getCustomerController, 
    updateCustomerController, 
    bulkCreateCustomersController, 
    deleteCustomerController, 
    reactivateCustomerController, 
    deleteSavingsAccountController,
    deleteSavingsAccountByAccountNoController,
    reactivateSavingsAccountController, 
    deleteFixedDepositController, 
    reactivateFixedDepositController, 
    getCustomerAccountsController, 
    getAllSavingsAccountsController, 
    getAllFixedDepositsController, 
    getSavingsAccountController,
    getJointAccountController,
    getAccountHoldersController,
    deleteJointAccountController,
    getAllSavingsPlansController
} from '../controllers/agentController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

// Customer Management Routes
router.post('/addcustomer', authMiddleware.authenticateRole(['agent']), addCustomer);
router.get('/customers', authMiddleware.authenticateRole(['agent']), listCustomersController);
router.get('/customer/:nic', authMiddleware.authenticateRole(['agent']), getCustomerController);
router.get('/customers/:nic', authMiddleware.authenticateRole(['agent']), getCustomerController); // Alternative plural route
router.put('/customer/:nic', authMiddleware.authenticateRole(['agent']), updateCustomerController);
router.put('/customers/:nic', authMiddleware.authenticateRole(['agent']), updateCustomerController); // Alternative plural route
router.post('/customers/bulk', authMiddleware.authenticateRole(['agent']), bulkCreateCustomersController);
router.delete('/customer/:nic', authMiddleware.authenticateRole(['agent']), deleteCustomerController);
router.delete('/customers/:nic', authMiddleware.authenticateRole(['agent']), deleteCustomerController); // Alternative plural route
router.patch('/customer/:nic/reactivate', authMiddleware.authenticateRole(['agent']), reactivateCustomerController);
router.patch('/customers/:nic/reactivate', authMiddleware.authenticateRole(['agent']), reactivateCustomerController); // Alternative plural route

// Account Creation Routes
router.post('/addsavingsaccount', authMiddleware.authenticateRole(['agent']), addSavingsAccount);
router.post('/addfixeddeposit', authMiddleware.authenticateRole(['agent']), addFixedDepositeAccount);

// Transaction Routes
router.post('/deposit', authMiddleware.authenticateRole(['agent']), makeDeposit);
router.post('/withdraw', authMiddleware.authenticateRole(['agent']), makeWithdraw);
router.post('/transfer', authMiddleware.authenticateRole(['agent']), accToAccTransfer);

// Account Management Routes
router.get('/customer/:nic/accounts', authMiddleware.authenticateRole(['agent']), getCustomerAccountsController);
router.get('/savingsaccounts', authMiddleware.authenticateRole(['agent']), getAllSavingsAccountsController);
router.delete('/savingsaccounts/:accountNo', authMiddleware.authenticateRole(['agent']), deleteSavingsAccountByAccountNoController);
router.get('/savingsaccounts/:accountNo', authMiddleware.authenticateRole(['agent']), getSavingsAccountController);
router.get('/fixeddeposits', authMiddleware.authenticateRole(['agent']), getAllFixedDepositsController);
router.delete('/fixeddeposits/:fd_account_no', authMiddleware.authenticateRole(['agent']), deleteFixedDepositController);
router.patch('/fixeddeposits/:fd_account_no/reactivate', authMiddleware.authenticateRole(['agent']), reactivateFixedDepositController);

// Joint Account Management Routes (query parameters version - must come before URL params)
router.get('/jointaccount', authMiddleware.authenticateRole(['agent']), getJointAccountController);
router.get('/jointaccount/:accountNo/holders', authMiddleware.authenticateRole(['agent']), getAccountHoldersController);
router.delete('/jointaccount/:accountNo', authMiddleware.authenticateRole(['agent']), deleteJointAccountController);

// Savings Account Management
router.delete('/savingsaccount/:nic/:accountNo', authMiddleware.authenticateRole(['agent']), deleteSavingsAccountController);
router.patch('/savingsaccounts/:accountNo/reactivate', authMiddleware.authenticateRole(['agent']), reactivateSavingsAccountController);
router.patch('/savingsaccount/:nic/:accountNo/reactivate', authMiddleware.authenticateRole(['agent']), reactivateSavingsAccountController);

// Savings Plans Routes
router.get('/savingsplans', authMiddleware.authenticateRole(['agent']), getAllSavingsPlansController);



export default router;


