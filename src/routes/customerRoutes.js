import express from 'express';
import { Router } from 'express';
import customerController from '../controllers/customerControlller.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.get('/getCustomerDetails/:nic',authMiddleware.authenticateRole(['customer']),customerController.getCustomerDetails);

export default router;