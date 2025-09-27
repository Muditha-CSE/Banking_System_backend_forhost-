import express from 'express';
import { Router } from 'express';
import agentController from '../controllers/agentController.js';
//import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.get('/adduser',agentController.adduser);

export default router;


