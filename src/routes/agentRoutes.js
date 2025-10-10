import express from 'express';
import { Router } from 'express';
import agentController from '../controllers/agentController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.post('/addcustomer',authMiddleware.authenticateRole(['agent']),agentController.addCustomer);
router.post('/addsavingsaccount',authMiddleware.authenticateRole(['agent']),agentController.addSavingsAccount);
router.post('/addfixeddeposite',authMiddleware.authenticateRole(['agent']),agentController.addFixedDepositeAccount);

router.post('/makedeposit',authMiddleware.authenticateRole(['agent']),agentController.makeDeposit);
router.post('/makewithdraw',authMiddleware.authenticateRole(['agent']),agentController.makeWithdraw);
router.post('/acctocctransfer',authMiddleware.authenticateRole(['agent']),agentController.accToAccTransfer);



export default router;


