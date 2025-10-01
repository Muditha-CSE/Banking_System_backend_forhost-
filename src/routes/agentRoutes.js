import express from 'express';
import { Router } from 'express';
import agentController from '../controllers/agentController.js';
import authMiddleware from '../middleware/authMiddleware.js';
//import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.post('/addcustomer',authMiddleware.authenticateRole(['agent']),agentController.addCustomer);

export default router;


