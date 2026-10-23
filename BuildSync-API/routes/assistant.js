import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { chat } from "../controllers/assistantController.js";

const router = express.Router();

/**
 * Benny, the in-app operations assistant. The reply is generated from live,
 * role-scoped database queries; no external AI key or network call is needed.
 */
router.post("/chat", authenticate, asyncHandler(chat));

export default router;
