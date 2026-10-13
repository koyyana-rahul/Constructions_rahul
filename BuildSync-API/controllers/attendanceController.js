import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import { businessDate } from "../middleware/defaultAttendance.js";

/** R8: canonical TitleCase values, with lowercase accepted and normalised. */
export const ATTENDANCE_STATUSES = ["Present", "Absent", "Sick", "Leave"];

const normalizeStatus = (raw) => {
  if (raw === null || raw === undefined || raw === "") return null;
  const match = ATTENDANCE_STATUSES.find(
    (s) => s.toLowerCase() === String(raw).trim().toLowerCase()
  );
  if (!match) {
    throw ApiError.badRequest(
      `Invalid attendance status "${raw}". Expected one of: ${ATTENDANCE_STATUSES.join(", ")}`,
      { code: "INVALID_ATTENDANCE_STATUS" }
    );
  }
  return match;
};

const getAttendance = async (req, res) => {
  const date = req.query.date || businessDate();

  // Optional per-employee scope. The filter is applied in the database BEFORE
  // the query runs, never in the browser, so the admin attendance board and an
  // individual employee's page read from the same authorised source.
  // `employeeId` here is an Employee._id, matching the rest of the admin
  // employee-scoped routes.
  const filter = { date };
  if (req.query.employeeId) {
    if (!mongoose.isValidObjectId(req.query.employeeId)) {
      throw ApiError.badRequest("Invalid employee identifier", { code: "INVALID_ID" });
    }
    const employee = await Employee.findById(req.query.employeeId).select("_id");
    if (!employee) throw ApiError.notFound("Employee not found");
    filter.employeeId = employee._id;
  }

  const attendance = await Attendance.find(filter)
    .populate({
      path: "employeeId",
      populate: ["department", "userId"],
    })
    .sort({ "employeeId.employeeId": 1 });

  return res.status(200).json({ success: true, date, attendance });
};

/**
 * Mark or correct an employee's attendance for a business date.
 *
 * - `runValidators: true` so the enum is actually enforced (R8).
 * - `overwrite` of an already-marked day is allowed but audited as a
 *   correction rather than silently overwritten (Section 6).
 */
const updateAttendance = async (req, res) => {
  const { employeeId } = req.params;
  const date = req.body.date || businessDate();
  const status = normalizeStatus(req.body.status);
  const reason = (req.body.reason || "").trim();

  const employee = await Employee.findOne({ employeeId });
  if (!employee) {
    throw ApiError.notFound(`No employee with ID "${employeeId}"`, {
      code: "NO_EMPLOYEE",
    });
  }

  const existing = await Attendance.findOne({ employeeId: employee._id, date });

  if (existing && existing.status !== null && existing.status !== undefined) {
    if (!reason) {
      throw ApiError.badRequest(
        `"${existing.status}" has already been recorded for ${date}. Provide a reason to correct it.`,
        { code: "CORRECTION_REASON_REQUIRED" }
      );
    }
  }

  const attendance = await Attendance.findOneAndUpdate(
    { employeeId: employee._id, date },
    {
      $set: {
        status,
        markedBy: req.user._id,
        ...(existing && existing.status ? { correctedAt: new Date(), correctionReason: reason } : {}),
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  await recordAudit({
    actor: req.user,
    entityType: "Attendance",
    entityId: attendance._id,
    action: existing && existing.status ? "attendance.corrected" : "attendance.marked",
    fromState: existing?.status ?? null,
    toState: status,
    reason: reason || undefined,
  });

  return res.status(200).json({ success: true, attendance });
};

const attendanceReport = async (req, res) => {
  const { date, page = 1, limit = 5 } = req.query;
  const take = Math.min(parseInt(limit, 10) || 5, 50);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const query = date ? { date } : {};

  const attendanceData = await Attendance.find(query)
    .populate({ path: "employeeId", populate: ["department", "userId"] })
    .sort({ date: -1, "employeeId.employeeId": 1 })
    .skip(skip)
    .limit(take);

  const groupData = attendanceData.reduce((result, record) => {
    if (!record.employeeId) return result;
    const key = record.date;
    if (!result[key]) result[key] = [];
    result[key].push({
      employeeId: record.employeeId.employeeId,
      employeeName: record.employeeId.userId?.name ?? "Unknown employee",
      departmentName: record.employeeId.department?.dep_name ?? "Unassigned site",
      status: record.status || "Not Marked",
    });
    return result;
  }, {});

  return res.status(200).json({
    success: true,
    groupData,
    pagination: { page, limit: take, daysReturned: attendanceData.length },
  });
};

export { getAttendance, updateAttendance, attendanceReport };