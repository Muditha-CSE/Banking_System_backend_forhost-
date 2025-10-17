import express from 'express';
import { Router } from 'express';
import publicController from '../controllers/publicController.js';

const router = Router();

router.post('/loginofficers',publicController.login);
router.post('/logincustomer',publicController.logincustomer);


export default router;


