import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin } from "../middleware/authorize.js";
import {
  getOverview,
  projectReport,
  financeReport,
  inventoryReport,
  safetyReport,
  fieldReport,
  exportReport,
  reportIndex,
} from "../controllers/reportController.js";

const router = express.Router();

/**
 * Role-aware reporting hub. `/overview` adapts to the caller's role; every
 * detailed or financial report is administrator-only and enforced in the
 * controller as well as at the route.
 */
router.get("/overview", authenticate, asyncHandler(getOverview));
router.get("/index", authenticate, asyncHandler(reportIndex));

router.get("/project", authenticate, requireAdmin, asyncHandler(projectReport));
router.get("/finance", authenticate, requireAdmin, asyncHandler(financeReport));
router.get("/inventory", authenticate, requireAdmin, asyncHandler(inventoryReport));
router.get("/safety", authenticate, requireAdmin, asyncHandler(safetyReport));
router.get("/field", authenticate, requireAdmin, asyncHandler(fieldReport));
router.get("/export/:type", authenticate, requireAdmin, asyncHandler(exportReport));

export default router;
