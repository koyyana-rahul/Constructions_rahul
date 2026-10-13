import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin, requireRole } from "../middleware/authorize.js";
import { addSalary, getSalary } from "../controllers/salaryController.js";

const router = express.Router();

/**
 * Payroll is private (Section 9).
 *
 * `GET /salary/:id/:role` keeps its legacy signature for backward
 * compatibility, but `:role` is IGNORED. The controller resolves the employee
 * from the verified token unless the caller is an admin explicitly asking for
 * another employee's payroll via `?scope=admin`.
 */
router.get("/:id/:role", authenticate, requireRole("admin", "employee"), asyncHandler(getSalary));

router.post("/add", authenticate, requireAdmin, asyncHandler(addSalary));

export default router;