import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin } from "../middleware/authorize.js";
import {
  attendanceReport,
  getAttendance,
  updateAttendance,
} from "../controllers/attendanceController.js";
import defaultAttendance from "../middleware/defaultAttendance.js";

const router = express.Router();

/** Attendance is workforce administration: admins only (R3). */
router.get("/", authenticate, requireAdmin, defaultAttendance, asyncHandler(getAttendance));
router.put("/update/:employeeId", authenticate, requireAdmin, asyncHandler(updateAttendance));
router.get("/report", authenticate, requireAdmin, asyncHandler(attendanceReport));

export default router;