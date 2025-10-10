import express from 'express';
import { Router } from 'express';
import adminController from '../controllers/adminController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.post('/addAdmin',authMiddleware.authenticateRole(['admin']),adminController.addAdmin);
router.post('/addAgent',authMiddleware.authenticateRole(['admin']),adminController.addAgent);
router.post('/addbranch',authMiddleware.authenticateRole(['admin']),adminController.addBranch);

router.get('/getAgentwiseTransactions',authMiddleware.authenticateRole(['admin']),adminController.agentWiseTransactions);
router.get('/getAccountwiseTransactions',authMiddleware.authenticateRole(['admin']),adminController.accountWiseTransactions);
router.get('/getActiveFDs',authMiddleware.authenticateRole(['admin']),adminController.activeFDs);
router.get('/getMonthlyInterestDistribution',authMiddleware.authenticateRole(['admin']),adminController.interestDistribution);
router.get('/getCustomerActivity/:nic',authMiddleware.authenticateRole(['admin']),adminController.customerActivity);
router.get('/getCustomerActivityForAcc/:nic/:account_no',authMiddleware.authenticateRole(['admin']),adminController.customerActivityForAcc);


export default router;


