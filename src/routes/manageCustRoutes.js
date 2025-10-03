import { Router } from "express";
import { addAccount } from "../controllers/customerController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// Only agents can create accounts for customers
router.post(
    "/addservingsaccount",
    authMiddleware.authenticateRole(["agent"]),
    addAccount
);

export default router;
