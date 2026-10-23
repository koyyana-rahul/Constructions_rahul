import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import upload from "../middleware/multerConfig.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin, requireRole } from "../middleware/authorize.js";
import {
  addWorkRequest,
  getWorkRequest,
  getWorkRequests,
  getWorkRequestDetail,
  updateWorkRequest,
  addWorkRequestValidation,
} from "../controllers/workController.js";

const router = express.Router();

/**
 * R2 fix: creation now requires authentication and derives the owning client
 * from the verified token instead of trusting a body `userId`.
 * R5: reads are scoped - a client only ever sees their own requests.
 */
router.post(
  "/add",
  authenticate,
  requireRole("client"),
  upload.single("details"),
  addWorkRequestValidation,
  asyncHandler(addWorkRequest)
);

// Admin queue + the client's own list. Employees must not read client
// requests: they contain contact details and commercial scope, and employees
// have no work-request feature in their portal.
router.get("/", authenticate, requireRole("admin", "client"), asyncHandler(getWorkRequests));

// `/detail/:id` must stay ABOVE `/:id/:role`, otherwise Express matches
// `/work-request/detail/<id>` against `/:id/:role` with id="detail" and the
// controller casts that literal string into a _id field.
router.get(
  "/detail/:id",
  authenticate,
  requireRole("admin", "client"),
  asyncHandler(getWorkRequestDetail)
);

// Scoped read for the owning client. Legacy :id/:role signature preserved,
// but only a client (or an admin) may use it - employees are excluded.
router.get("/:id/:role", authenticate, requireRole("admin", "client"), asyncHandler(getWorkRequest));

// Only admins may drive state transitions.
router.put("/:id", authenticate, requireAdmin, asyncHandler(updateWorkRequest));

export default router;