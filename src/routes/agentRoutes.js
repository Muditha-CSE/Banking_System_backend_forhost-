import express from 'express';
import { Router } from 'express';
import agentController from '../controllers/agentController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import manageCustRoutes from '../routes/manageCustRoutes.js'
//import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.post('/addcustomer',authMiddleware.authenticateRole(['agent']),agentController.addCustomer);
router.use('/managecustomer',manageCustRoutes);
export default router;


