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

/**
 * Resolves the `User._id` owning an Employee record, for the ownership check.
 *
 * The `:id` in the URL is NOT always an `Employee._id`:
 *   - the admin route addresses an employee by `Employee._id`;
 *   - the self-service route (`/employee-dashboard/profile/:id`) addresses
 *     them by `User._id`.
 *
 * `getEmployee` already accepts either, so this resolver MUST accept either
 * too. When it did not, an employee opening their OWN profile was rejected
 * with 403 FORBIDDEN_OWNERSHIP - the page was unreachable for the only person
 * allowed to see it.
 */
const resolveEmployeeUserId = async (req) => {
  const { id } = req.params;

  let employee = await Employee.findById(id).select("userId");
  if (!employee) {
    employee = await Employee.findOne({ userId: id }).select("userId");
  }

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