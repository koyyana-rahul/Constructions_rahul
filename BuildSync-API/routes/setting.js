import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { changePassword, adminResetPassword } from "../controllers/settingController.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin } from "../middleware/authorize.js";

const router = express.Router();

// Self-service: identity is derived from the verified token (R0 fix).
router.put("/change-password", authenticate, asyncHandler(changePassword));

// Administrative recovery: separate, explicitly authorized workflow.
router.put("/admin/reset-password/:userId", authenticate, requireAdmin, asyncHandler(adminResetPassword));

export default router;