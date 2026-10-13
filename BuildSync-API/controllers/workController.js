import Client from "../models/Client.js";
import WorkRequest from "../models/Work.js";
import { body, validationResult } from "express-validator";
import path from "path";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";

/**
 * Work-request lifecycle.
 *
 * The legacy contract (`Pending | Approved | Rejected`) is preserved and
 * extended rather than replaced, so existing clients keep working. New
 * operational states are opt-in via the transition table below - a request
 * cannot be moved into a state that is not reachable from its current one.
 */
export const WORK_REQUEST_STATES = [
  "Pending", // legacy initial state (unchanged for backward compatibility)
  "Under Review",
  "Approved",
  "Assigned",
  "In Progress",
  "Completed",
  "Verified",
  "Closed",
  "Rejected",
  "Returned for Correction",
  "On Hold",
  "Blocked",
  "Cancelled",
];

/** States that require a non-empty rejection/correction reason. */
const REASON_REQUIRED = new Set(["Rejected", "Returned for Correction", "Cancelled"]);

/** Allowed target states per current state. */
const TRANSITIONS = {
  Pending: ["Under Review", "Approved", "Rejected", "Cancelled", "On Hold"],
  "Under Review": ["Approved", "Rejected", "Returned for Correction", "On Hold", "Blocked", "Cancelled"],
  Approved: ["Assigned", "In Progress", "Cancelled", "On Hold", "Blocked"],
  Assigned: ["In Progress", "On Hold", "Blocked", "Cancelled"],
  "In Progress": ["Completed", "Blocked", "On Hold", "Cancelled"],
  Completed: ["Verified", "In Progress"],
  Verified: ["Closed", "In Progress"],
  Closed: [],
  Rejected: ["Pending"], // re-open for correction
  "Returned for Correction": ["Pending"],
  "On Hold": ["Pending", "Blocked", "Cancelled"],
  Blocked: ["On Hold", "In Progress", "Cancelled"],
  Cancelled: ["Pending"],
};

export const canTransition = (from, to) =>
  Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);

const addWorkRequestValidation = [
  body("name").trim().notEmpty().withMessage("Request name is required").isLength({ max: 160 }),
  body("description").trim().notEmpty().withMessage("Scope of work is required"),
  body("startDate").isISO8601().withMessage("Valid start date is required"),
  body("endDate").isISO8601().withMessage("Valid end date is required"),
  body("startDate").custom((startDate, { req }) => {
    if (new Date(startDate) > new Date(req.body.endDate)) {
      throw new Error("Start date must be on or before the end date");
    }
    return true;
  }),
];

async function addWorkRequest(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest(errors.array()[0].msg, {
      code: "VALIDATION_ERROR",
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }

  /**
   * R2 fix: the owning client is derived from the verified token. The body's
   * `userId` is ignored entirely, so a client can no longer file a request as
   * a different client by guessing their id.
   */
  const client = await Client.findOne({ userId: req.user._id });
  if (!client) {
    throw ApiError.notFound(
      "No client profile is linked to this account. Clients are created by an administrator, which links the profile automatically.",
      { code: "NO_CLIENT_PROFILE" }
    );
  }

  const { name, startDate, endDate, description } = req.body;

  // Initial state is set server-side and is never taken from the request.
  const workRequest = await WorkRequest.create({
    clientId: client._id,
    name,
    startDate,
    endDate,
    description,
    details: req.file ? path.basename(req.file.path) : null,
    status: "Pending",
  });

  await recordAudit({
    actor: req.user,
    entityType: "WorkRequest",
    entityId: workRequest._id,
    action: "work_request.submitted",
    fromState: null,
    toState: "Pending",
  });

  return res.status(201).json({ success: true, request: workRequest });
}

async function getWorkRequest(req, res) {
  const { id } = req.params;
  let workRequests;

  // `:role` is client-supplied and is IGNORED - it used to be the first half of
  // an `if (role === "admin")` branch, which let any client read any other
  // client's requests simply by putting `/admin` in the URL. Authority comes
  // from the verified token only.
  if (req.user.role === "admin") {
    workRequests = await WorkRequest.find({ clientId: id });
  } else {
    // Ownership is resolved from the token, then confirmed against the id.
    const client = await Client.findOne({ userId: req.user._id });
    if (!client) return res.status(200).json({ success: true, requests: [] });
    if (String(client._id) !== String(id)) {
      throw ApiError.forbidden("You can only view your own work requests", {
        code: "FORBIDDEN_OWNERSHIP",
      });
    }
    workRequests = await WorkRequest.find({ clientId: client._id });
  }

  return res.status(200).json({ success: true, requests: workRequests });
}

async function getWorkRequests(req, res) {
  const { page = 1, limit = 25 } = req.query;
  const take = Math.min(parseInt(limit, 10) || 25, 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const filter =
    req.user.role === "client"
      ? { clientId: await clientIdFor(req.user._id) }
      : {};

  const [requests, total] = await Promise.all([
    WorkRequest.find(filter)
      .populate({ path: "clientId", populate: { path: "userId", select: "name email" } })
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(take),
    WorkRequest.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    requests,
    pagination: { page: Math.floor(skip / take) + 1, limit: take, total },
  });
}

async function getWorkRequestDetail(req, res) {
  const workRequest = await WorkRequest.findById(req.params.id).populate({
    path: "clientId",
    populate: { path: "userId", select: "name email profileImage" },
  });

  if (!workRequest) throw ApiError.notFound("Work request not found");

  // R5: a client may only open their own request.
  if (req.user.role === "client") {
    const ownClientId = await clientIdFor(req.user._id);
    if (String(workRequest.clientId?._id) !== String(ownClientId)) {
      throw ApiError.forbidden("You can only view your own work requests", {
        code: "FORBIDDEN_OWNERSHIP",
      });
    }
  }

  return res.status(200).json({ success: true, request: workRequest });
}

async function updateWorkRequest(req, res) {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;

  if (!WORK_REQUEST_STATES.includes(status)) {
    throw ApiError.badRequest("Invalid work request status", { code: "INVALID_STATUS" });
  }

  const existing = await WorkRequest.findById(id);
  if (!existing) throw ApiError.notFound("Work request not found");

  // Server-side transition rules - the frontend cannot set an arbitrary state.
  if (existing.status !== status && !canTransition(existing.status, status)) {
    throw ApiError.conflict(
      `Cannot move a work request from "${existing.status}" to "${status}"`,
      { code: "INVALID_TRANSITION", allowed: TRANSITIONS[existing.status] || [] }
    );
  }

  const trimmedReason = (rejectionReason || "").trim();
  if (REASON_REQUIRED.has(status) && !trimmedReason) {
    throw ApiError.badRequest(
      `A reason is required when setting status to "${status}"`,
      { code: "REASON_REQUIRED" }
    );
  }

  const updateData = { status, updatedAt: Date.now() };
  // The live rejection reason is cleared on approval, but the original stays
  // in the audit trail (see recordAudit below).
  updateData.rejectionReason = status === "Rejected" ? trimmedReason : null;

  const workRequest = await WorkRequest.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  await recordAudit({
    actor: req.user,
    entityType: "WorkRequest",
    entityId: workRequest._id,
    action: `work_request.${status.toLowerCase().replace(/\s+/g, "_")}`,
    fromState: existing.status,
    toState: status,
    reason: trimmedReason || undefined,
  });

  return res.status(200).json({ success: true, request: workRequest });
}

/** Resolves the Client._id for a User._id, or null. */
async function clientIdFor(userId) {
  const client = await Client.findOne({ userId }).select("_id");
  return client ? client._id : null;
}

export {
  addWorkRequest,
  getWorkRequest,
  getWorkRequests,
  getWorkRequestDetail,
  updateWorkRequest,
  addWorkRequestValidation,
};