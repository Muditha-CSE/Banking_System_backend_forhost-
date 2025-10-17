
import express from 'express';
import { Router } from 'express';
import adminController from '../controllers/adminController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();
// List deactivated admins
router.get('/deactivated-admins', authMiddleware.authenticateRole(['admin']), adminController.listDeactivatedAdminsController);

// Reactivate admin
router.post('/reactivate-admin', authMiddleware.authenticateRole(['admin']), adminController.reactivateAdminController);

router.post('/addAdmin',authMiddleware.authenticateRole(['admin']),adminController.addAdmin);
router.post('/addAgent',authMiddleware.authenticateRole(['admin']),adminController.addAgent);
router.post('/addbranch',authMiddleware.authenticateRole(['admin']),adminController.addBranch);

router.get('/getAgentwiseTransactions',authMiddleware.authenticateRole(['admin']),adminController.agentWiseTransactions);
router.get('/getAccountwiseTransactions',authMiddleware.authenticateRole(['admin']),adminController.accountWiseTransactions);
router.get('/getActiveFDs',authMiddleware.authenticateRole(['admin']),adminController.activeFDs);
router.get('/getMonthlyInterestDistribution',authMiddleware.authenticateRole(['admin']),adminController.interestDistribution);
router.get('/getCustomerActivity/:nic',authMiddleware.authenticateRole(['admin']),adminController.customerActivity);
router.get('/getCustomerActivityForAcc/:nic/:account_no',authMiddleware.authenticateRole(['admin']),adminController.customerActivityForAcc);
router.get('/getSystemLogs',authMiddleware.authenticateRole(['admin']),adminController.systemLogs);
router.get('/auditlogs',authMiddleware.authenticateRole(['admin']),adminController.auditlogs);
// Agent management
router.get('/agents',authMiddleware.authenticateRole(['admin']),adminController.listAgentsController);
router.get('/agents/:username',authMiddleware.authenticateRole(['admin']),adminController.getAgentController);
router.put('/agents/:username',authMiddleware.authenticateRole(['admin']),adminController.updateAgentController);
router.delete('/agents/:username',authMiddleware.authenticateRole(['admin']),adminController.deleteAgentController);
router.post('/agents/:username/deactivate', authMiddleware.authenticateRole(['admin']), adminController.deactivateAgentController);
router.post('/agents/:username/activate', authMiddleware.authenticateRole(['admin']), adminController.activateAgentController);

// Admin self-deactivation
router.post('/deactivate-self', authMiddleware.authenticateRole(['admin']), adminController.deactivateSelfController);

export default router;


