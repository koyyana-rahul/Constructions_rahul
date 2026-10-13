import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import Leave from "../models/Leave.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";

/** Leave decisions are a fixed, auditable set. */
export const LEAVE_STATES = ["Pending", "Approved", "Rejected", "Cancelled"];

/** Allowed target states per current state. */
const LEAVE_TRANSITIONS = {
  Pending: ["Approved", "Rejected", "Cancelled"],
  Approved: [],
  Rejected: [],
  Cancelled: [],
};

export const canTransitionLeave = (from, to) =>
  Array.isArray(LEAVE_TRANSITIONS[from]) && LEAVE_TRANSITIONS[from].includes(to);

/**
 * Employee submits leave.
 *
 * R6 fix: the employee is resolved from the verified token, not from a body
 * `userId`, so an employee can no longer file leave against someone else.
 */
const addLeave = async (req, res) => {
  const { leaveType, startDate, endDate, reason } = req.body;

  if (req.user.role === "client") {
    throw ApiError.forbidden("Clients cannot apply for leave", { code: "FORBIDDEN_ROLE" });
  }

  if (!["Sick Leave", "Casual Leave", "Annual Leave"].includes(leaveType)) {
    throw ApiError.badRequest("Invalid leave type", { code: "INVALID_LEAVE_TYPE" });
  }
  if (!startDate || !endDate) {
    throw ApiError.badRequest("Start and end dates are required", { code: "MISSING_FIELD" });
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ApiError.badRequest("Invalid dates", { code: "INVALID_DATE" });
  }
  if (start > end) {
    throw ApiError.badRequest("Start date must be on or before the end date", {
      code: "INVALID_RANGE",
    });
  }
  if (!reason || !reason.trim()) {
    throw ApiError.badRequest("A reason is required", { code: "MISSING_FIELD" });
  }

  const employee = await Employee.findOne({ userId: req.user._id });
  if (!employee) {
    throw ApiError.notFound("No employee profile is linked to this account", {
      code: "NO_EMPLOYEE_PROFILE",
    });
  }

  // Duplicate / overlap prevention (Section 7 edge cases).
  const overlapping = await Leave.findOne({
    employeeId: employee._id,
    status: { $in: ["Pending", "Approved"] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });
  if (overlapping) {
    throw ApiError.conflict(
      "An existing leave request already covers part of that date range",
      { code: "OVERLAPPING_LEAVE" }
    );
  }

  const newLeave = await Leave.create({
    employeeId: employee._id,
    leaveType,
    startDate: start,
    endDate: end,
    reason: reason.trim(),
    // status defaults server-side; never read from the body
  });

  await recordAudit({
    actor: req.user,
    entityType: "Leave",
    entityId: newLeave._id,
    action: "leave.applied",
    fromState: null,
    toState: "Pending",
  });

  return res.status(201).json({ success: true, leave: newLeave });
};

/**
 * Scoped list (legacy `GET /leave/:id/:role` contract).
 *
 * For a non-admin the `:id` is ignored and the employee is resolved from the
 * verified token, so a worker cannot read another worker's history by swapping
 * the id in the URL.
 */
const getLeave = async (req, res) => {
  const { id } = req.params;
  let leaves;

  // `:role` is client-supplied and is deliberately IGNORED. Previously the
  // check was `role === "admin" || req.user.role === "admin"`, so any employee
  // could append `/admin` to the URL and read another employee's leave history.
  // Authority comes from the verified token alone.
  if (req.user.role === "admin") {
    // Admins pass an Employee._id.
    if (!mongoose.isValidObjectId(id)) {
      throw ApiError.badRequest("Invalid employee identifier", { code: "INVALID_ID" });
    }
    const employee = await Employee.findById(id).select("_id");
    if (!employee) throw ApiError.notFound("Employee not found");
    leaves = await Leave.find({ employeeId: employee._id });
  } else {
    // Everyone else: resolved strictly from the token, never from the URL.
    const employee = await Employee.findOne({ userId: req.user._id }).select("_id");
    if (!employee) return res.status(200).json({ success: true, leaves: [] });
    leaves = await Leave.find({ employeeId: employee._id });
  }

  return res.status(200).json({ success: true, leaves });
};

/** Admin queue with pagination. */
const getLeaves = async (req, res) => {
  const { page = 1, limit = 25, status } = req.query;
  const take = Math.min(parseInt(limit, 10) || 25, 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const filter = status ? { status } : {};

  const [leaves, total] = await Promise.all([
    Leave.find(filter)
      .populate({
        path: "employeeId",
        populate: [
          { path: "department", select: "dep_name" },
          { path: "userId", select: "name" },
        ],
      })
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(take),
    Leave.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    leaves,
    pagination: { page: Math.floor(skip / take) + 1, limit: take, total },
  });
};

const getLeaveDetail = async (req, res) => {
  const leave = await Leave.findById(req.params.id).populate({
    path: "employeeId",
    populate: [
      { path: "department", select: "dep_name" },
      { path: "userId", select: "name profileImage" },
    ],
  });

  if (!leave) throw ApiError.notFound("Leave request not found");

  return res.status(200).json({ success: true, leave });
};

/**
 * Admin decision on a leave request.
 *
 * Uses an atomic conditional update so two admins acting simultaneously cannot
 * both win - the second receives 409 rather than silently overwriting.
 */
const updateLeave = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!LEAVE_STATES.includes(status)) {
    throw ApiError.badRequest("Invalid leave status", { code: "INVALID_STATUS" });
  }

  const existing = await Leave.findById(id);
  if (!existing) throw ApiError.notFound("Leave request not found");

  if (existing.status !== status && !canTransitionLeave(existing.status, status)) {
    throw ApiError.conflict(
      `Cannot move a leave request from "${existing.status}" to "${status}"`,
      { code: "INVALID_TRANSITION" }
    );
  }

  // Optimistic concurrency: only update while the status is still what we read.
  const updated = await Leave.findOneAndUpdate(
    { _id: id, status: existing.status },
    { $set: { status, updatedAt: new Date() } },
    { new: true }
  );

  if (!updated) {
    throw ApiError.conflict("This leave request was already actioned by someone else", {
      code: "CONCURRENT_UPDATE",
    });
  }

  await recordAudit({
    actor: req.user,
    entityType: "Leave",
    entityId: updated._id,
    action: `leave.${status.toLowerCase()}`,
    fromState: existing.status,
    toState: status,
  });

  return res.status(200).json({ success: true, leave: updated });
};

/** Employee withdraws their own pending request. */
const cancelLeave = async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave) throw ApiError.notFound("Leave request not found");

  const employee = await Employee.findOne({ userId: req.user._id });
  if (!employee || String(employee._id) !== String(leave.employeeId)) {
    throw ApiError.forbidden("You can only cancel your own leave requests", {
      code: "FORBIDDEN_OWNERSHIP",
    });
  }

  if (leave.status !== "Pending") {
    throw ApiError.conflict("Only pending leave requests can be cancelled", {
      code: "INVALID_TRANSITION",
    });
  }

  leave.status = "Cancelled";
  leave.updatedAt = new Date();
  await leave.save();

  await recordAudit({
    actor: req.user,
    entityType: "Leave",
    entityId: leave._id,
    action: "leave.cancelled",
    fromState: "Pending",
    toState: "Cancelled",
  });

  return res.status(200).json({ success: true, leave });
};

export {
  addLeave,
  getLeave,
  getLeaves,
  getLeaveDetail,
  updateLeave,
  cancelLeave,
};