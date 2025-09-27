import express from 'express';
import { Router } from 'express';
import publicController from '../controllers/publicController.js';

const router = Router();

router.post('/login',publicController.login);

export default router;


