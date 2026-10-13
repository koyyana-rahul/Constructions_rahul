import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin, requireRole, requireSelfOrAdmin } from "../middleware/authorize.js";
import {
  addLeave,
  getLeave,
  getLeaves,
  getLeaveDetail,
  updateLeave,
  cancelLeave,
} from "../controllers/leaveController.js";
import Employee from "../models/Employee.js";
import Leave from "../models/Leave.js";

const router = express.Router();

/**
 * Ownership resolver for a single leave document (compared by Employee._id).
 */
const resolveLeaveRequestOwner = async (req) => {
  const leave = await Leave.findById(req.params.id).select("employeeId");
  return leave?.employeeId ?? null;
};

/** Employees (and admins acting as themselves) submit; identity from token. */
router.post("/add", authenticate, requireRole("employee", "admin"), asyncHandler(addLeave));

// Admin queue.
router.get("/", authenticate, requireAdmin, asyncHandler(getLeaves));

/**
 * Scoped list. For a non-admin the `:id` is IGNORED and the controller resolves
 * the employee from the verified token, so a worker cannot read another
 * worker's history by swapping the id.
 */
// `/detail/:id` must stay ABOVE `/:id/:role`, otherwise Express matches
// `/leave/detail/<id>` against `/:id/:role` with id="detail" and the controller
// casts that literal string into a _id field.
router.get(
  "/detail/:id",
  authenticate,
  requireSelfOrAdmin(resolveLeaveRequestOwner),
  asyncHandler(getLeaveDetail)
);

router.get("/:id/:role", authenticate, requireRole("admin", "employee"), asyncHandler(getLeave));

// Only admins decide leave. Employees previously could approve anyone's leave.
router.put("/:id", authenticate, requireAdmin, asyncHandler(updateLeave));

// Employees may withdraw their own pending request.
router.put("/:id/cancel", authenticate, requireRole("employee", "admin"), asyncHandler(cancelLeave));

export default router;