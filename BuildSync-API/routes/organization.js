import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin } from "../middleware/authorize.js";
import {
  getOrganizationProfile,
  updateOrganization,
  nextNumbers,
} from "../controllers/organizationController.js";

const router = express.Router();

/**
 * The company profile is readable by every signed-in user because it is used
 * on invoices, reports and printed documents. Only administrators can change
 * it, and sequence counters are never exposed.
 */
router.get("/", authenticate, asyncHandler(getOrganizationProfile));
router.put("/", authenticate, requireAdmin, asyncHandler(updateOrganization));
router.get("/next-numbers", authenticate, requireAdmin, asyncHandler(nextNumbers));

export default router;
