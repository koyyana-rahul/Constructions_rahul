import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin } from "../middleware/authorize.js";
import { getSummary } from "../controllers/dashboardController.js";

const router = express.Router();

/** Organisation-wide metrics: admin only (R3). */
router.get("/summary", authenticate, requireAdmin, asyncHandler(getSummary));

export default router;