import express from 'express';
import { Router } from 'express';
import adminController from '../controllers/adminController.js';
//import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.get('/addAdmin',adminController.addAdmin);

export default router;


