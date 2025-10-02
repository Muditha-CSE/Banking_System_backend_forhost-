import express from 'express';
import { Router } from 'express';
import adminController from '../controllers/adminController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.post('/addAdmin',authMiddleware.authenticateRole(['admin']),adminController.addAdmin);
router.post('/addAgent',authMiddleware.authenticateRole(['admin']),adminController.addAgent);


export default router;


