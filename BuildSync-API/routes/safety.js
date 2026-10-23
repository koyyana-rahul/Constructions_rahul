import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin, requireRole } from "../middleware/authorize.js";
import {
  listIncidents,
  getIncident,
  createIncident,
  updateIncident,
  deleteIncident,
  safetySummary,
} from "../controllers/safetyController.js";

const router = express.Router();

/** Safety is an internal record; clients never receive incident details. */
const internalOnly = requireRole("admin", "employee");

router.get("/summary", authenticate, internalOnly, asyncHandler(safetySummary));
router.get("/", authenticate, internalOnly, asyncHandler(listIncidents));
router.post("/", authenticate, internalOnly, asyncHandler(createIncident));

router.get("/:id", authenticate, internalOnly, asyncHandler(getIncident));
router.put("/:id", authenticate, internalOnly, asyncHandler(updateIncident));
router.delete("/:id", authenticate, requireAdmin, asyncHandler(deleteIncident));

export default router;
