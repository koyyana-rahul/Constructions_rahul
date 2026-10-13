import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin, requireSelfOrAdmin } from "../middleware/authorize.js";
import {
  addEmployee,
  upload,
  getEmployees,
  getEmployee,
  updateEmployee,
  fetchEmployeesByDepId,
} from "../controllers/employeeController.js";
import Employee from "../models/Employee.js";

/** Resolves the `User._id` owning an Employee record, for the ownership check. */
const resolveEmployeeUserId = async (req) => {
  const employee = await Employee.findById(req.params.id).select("userId");
  return employee?.userId ?? null;
};

const router = express.Router();

/** Workforce administration is admin-only (R3). */
router.get("/", authenticate, requireAdmin, asyncHandler(getEmployees));
router.post("/add", authenticate, requireAdmin, upload.single("image"), asyncHandler(addEmployee));

// An employee may read their own profile; admins may read any.
router.get("/:id", authenticate, requireSelfOrAdmin(resolveEmployeeUserId), asyncHandler(getEmployee));

router.put("/:id", authenticate, requireAdmin, asyncHandler(updateEmployee));

router.get("/department/:id", authenticate, requireAdmin, asyncHandler(fetchEmployeesByDepId));

export default router;