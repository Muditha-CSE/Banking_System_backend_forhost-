import { Router } from "express";
import { addSevAccount, addJointAccount, addFixedDeposit } from "../controllers/customerController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// Only agents can create accounts for customers
router.post(
    "/addservingsaccount",
    authMiddleware.authenticateRole(["agent"]),
    addSevAccount
);

router.post(
    "/addjointaccount",
    authMiddleware.authenticateRole(["agent"]),
    addJointAccount
);

router.post(
    "/addfixeddeposit",
    authMiddleware.authenticateRole(["agent"]),
    addJointAccount
);
export default router;
