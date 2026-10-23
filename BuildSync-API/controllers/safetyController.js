import mongoose from "mongoose";
import SafetyIncident from "../models/SafetyIncident.js";
import Project from "../models/Project.js";
import Department from "../models/Department.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import { employeeForUser, escapeRegex, isAdmin, canAccessProject } from "../services/accessService.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { notifyRoles } from "../services/notificationService.js";
import { businessDate } from "../middleware/defaultAttendance.js";

export const SAFETY_TYPES = [
  "Near Miss",
  "First Aid",
  "Lost Time Injury",
  "Property Damage",
  "Environmental",
  "Unsafe Act",
  "Unsafe Condition",
  "Other",
];
export const SAFETY_SEVERITIES = ["Low", "Medium", "High", "Critical"];
export const SAFETY_STATUSES = ["Open", "Investigating", "Resolved", "Closed"];

export const SAFETY_TRANSITIONS = {
  Open: ["Investigating", "Resolved", "Closed"],
  Investigating: ["Resolved", "Closed", "Open"],
  Resolved: ["Closed", "Investigating"],
  Closed: ["Investigating"],
};

const populateIncident = (query) =>
  query
    .populate("project", "code name status")
    .populate("site", "dep_name")
    .populate("reportedBy", "name role")
    .populate("assignedTo", "name role");

const requireSafetyRole = (user) => {
  if (user.role === "client") {
    throw ApiError.forbidden("Safety records are not available to client accounts", {
      code: "FORBIDDEN_ROLE",
    });
  }
};

export const listIncidents = async (req, res) => {
  requireSafetyRole(req.user);
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50 });
  const filter = {};

  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee) {
      return res.status(200).json({ success: true, incidents: [], pagination: paginationMeta({ page, limit }, 0) });
    }
    filter.$or = [{ site: employee.department }, { reportedBy: req.user._id }];
  }

  if (req.query.site && isAdmin(req.user)) filter.site = req.query.site;
  if (req.query.project) filter.project = req.query.project;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.severity) filter.severity = req.query.severity;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) {
      const to = new Date(req.query.to);
      to.setHours(23, 59, 59, 999);
      filter.date.$lte = to;
    }
  }
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$and = [...(filter.$and || []), { $or: [{ title: rx }, { description: rx }] }];
  }

  const [incidents, total] = await Promise.all([
    populateIncident(SafetyIncident.find(filter)).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    SafetyIncident.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    incidents,
    pagination: paginationMeta({ page, limit }, total),
  });
};

export const getIncident = async (req, res) => {
  requireSafetyRole(req.user);
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid incident identifier", { code: "INVALID_ID" });
  }
  const incident = await populateIncident(SafetyIncident.findById(req.params.id)).lean();
  if (!incident) throw ApiError.notFound("Safety incident not found");

  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    const own =
      String(incident.site?._id) === String(employee?.department) ||
      String(incident.reportedBy?._id) === String(req.user._id);
    if (!own) throw ApiError.forbidden("You can only view incidents on your own site", { code: "FORBIDDEN_SITE" });
  }

  return res.status(200).json({ success: true, incident });
};

export const createIncident = async (req, res) => {
  requireSafetyRole(req.user);
  const { title, site: siteId, project: projectId, date, type = "Near Miss", severity = "Low", description, peopleInvolved, immediateAction } = req.body;

  if (!title?.trim()) throw ApiError.badRequest("Incident title is required", { code: "MISSING_FIELD" });
  if (!description?.trim()) throw ApiError.badRequest("Describe what happened", { code: "MISSING_FIELD" });
  if (!SAFETY_TYPES.includes(type)) throw ApiError.badRequest("Invalid incident type", { code: "INVALID_TYPE" });
  if (!SAFETY_SEVERITIES.includes(severity)) {
    throw ApiError.badRequest("Invalid severity", { code: "INVALID_SEVERITY" });
  }

  let resolvedSite = siteId;
  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee) throw ApiError.forbidden("No employee profile is linked to this account", { code: "NO_EMPLOYEE_PROFILE" });
    resolvedSite = employee.department;
  }
  if (!resolvedSite || !mongoose.isValidObjectId(resolvedSite)) {
    throw ApiError.badRequest("A site is required", { code: "MISSING_FIELD" });
  }
  const site = await Department.findById(resolvedSite);
  if (!site) throw ApiError.badRequest("The selected site does not exist", { code: "INVALID_REFERENCE" });

  let project = null;
  if (projectId) {
    if (!mongoose.isValidObjectId(projectId)) throw ApiError.badRequest("Invalid project", { code: "INVALID_ID" });
    project = await Project.findById(projectId);
    if (!project) throw ApiError.badRequest("The selected project does not exist", { code: "INVALID_REFERENCE" });
    if (req.user.role === "employee" && !(await canAccessProject(req.user, project))) {
      throw ApiError.forbidden("You can only report incidents for your own project", { code: "FORBIDDEN_PROJECT" });
    }
  }

  const incidentDate = date ? new Date(date) : new Date();
  if (Number.isNaN(incidentDate.getTime())) throw ApiError.badRequest("Invalid incident date", { code: "INVALID_DATE" });
  // Compare calendar dates in the company timezone, not raw instants: a
  // YYYY-MM-DD value parses as UTC midnight and is still "today" for an Indian
  // user while the server clock is on the previous UTC day.
  if (businessDate(incidentDate) > businessDate()) {
    throw ApiError.badRequest("An incident cannot be reported for a future date", { code: "INVALID_DATE" });
  }

  const incident = await SafetyIncident.create({
    title: title.trim(),
    project: project?._id,
    site: site._id,
    date: incidentDate,
    type,
    severity,
    description: description.trim(),
    peopleInvolved,
    immediateAction,
    status: "Open",
    reportedBy: req.user._id,
  });

  await recordAudit({
    actor: req.user,
    entityType: "SafetyIncident",
    entityId: incident._id,
    action: "safety.reported",
    toState: "Open",
    reason: `${severity} ${type}: ${incident.title}`,
  });

  if (["High", "Critical"].includes(severity)) {
    await notifyRoles(["admin"], {
      type: "Safety",
      title: `${severity} safety incident reported`,
      message: `${incident.title} at ${site.dep_name}. Immediate review is required.`,
      link: "/admin-dashboard/safety",
      excludeUserId: req.user._id,
    });
  }

  const populated = await populateIncident(SafetyIncident.findById(incident._id));
  return res.status(201).json({ success: true, incident: populated });
};

export const updateIncident = async (req, res) => {
  const incident = await SafetyIncident.findById(req.params.id);
  if (!incident) throw ApiError.notFound("Safety incident not found");

  // An employee may only act on an incident reported for their own site. The
  // administrative queue is unscoped, but a guessed id must not open another
  // site's record.
  if (!isAdmin(req.user)) {
    const employee = await employeeForUser(req.user._id);
    if (!employee || String(incident.site) !== String(employee.department)) {
      throw ApiError.forbidden("You can only update incidents on your own site", {
        code: "FORBIDDEN_SITE",
      });
    }
  }

  const before = incident.toObject();

  if (req.body.title !== undefined) {
    if (!req.body.title.trim()) throw ApiError.badRequest("Title cannot be empty", { code: "MISSING_FIELD" });
    incident.title = req.body.title.trim();
  }
  if (req.body.type !== undefined) {
    if (!SAFETY_TYPES.includes(req.body.type)) throw ApiError.badRequest("Invalid incident type", { code: "INVALID_TYPE" });
    incident.type = req.body.type;
  }
  if (req.body.severity !== undefined) {
    if (!SAFETY_SEVERITIES.includes(req.body.severity)) {
      throw ApiError.badRequest("Invalid severity", { code: "INVALID_SEVERITY" });
    }
    incident.severity = req.body.severity;
  }
  if (req.body.description !== undefined) {
    if (!req.body.description.trim()) throw ApiError.badRequest("Description cannot be empty", { code: "MISSING_FIELD" });
    incident.description = req.body.description.trim();
  }
  if (req.body.peopleInvolved !== undefined) incident.peopleInvolved = req.body.peopleInvolved;
  if (req.body.immediateAction !== undefined) incident.immediateAction = req.body.immediateAction;
  if (req.body.correctiveAction !== undefined) incident.correctiveAction = req.body.correctiveAction;
  if (req.body.lostTimeDays !== undefined) {
    incident.lostTimeDays = Math.max(0, Number(req.body.lostTimeDays) || 0);
  }
  if (req.body.assignedTo !== undefined) {
    // Assignment control is an administrative action. Employees may add
    // corrective notes and move the workflow, but must not reassign an
    // investigation to someone else through a crafted API call.
    if (!isAdmin(req.user)) {
      throw ApiError.forbidden("Only an administrator can assign an incident", {
        code: "FORBIDDEN_FIELD",
      });
    }
    if (!req.body.assignedTo) {
      incident.assignedTo = undefined;
    } else {
      if (!mongoose.isValidObjectId(req.body.assignedTo)) {
        throw ApiError.badRequest("Invalid assignee", { code: "INVALID_ID" });
      }
      const assignee = await User.findOne({
        _id: req.body.assignedTo,
        role: { $in: ["admin", "employee"] },
      }).select("_id");
      if (!assignee) {
        throw ApiError.badRequest("The selected assignee does not exist", {
          code: "INVALID_REFERENCE",
        });
      }
      incident.assignedTo = assignee._id;
    }
  }
  if (req.body.date !== undefined) {
    const date = new Date(req.body.date);
    if (Number.isNaN(date.getTime())) throw ApiError.badRequest("Invalid incident date", { code: "INVALID_DATE" });
    if (businessDate(date) > businessDate()) {
      throw ApiError.badRequest("An incident cannot be reported for a future date", { code: "INVALID_DATE" });
    }
    incident.date = date;
  }
  if (req.body.status !== undefined) {
    if (!SAFETY_STATUSES.includes(req.body.status)) {
      throw ApiError.badRequest("Invalid incident status", { code: "INVALID_STATUS" });
    }
    if (incident.status !== req.body.status) {
      const allowed = SAFETY_TRANSITIONS[incident.status] || [];
      if (!allowed.includes(req.body.status)) {
        throw ApiError.conflict(`Cannot move an incident from ${incident.status} to ${req.body.status}`, {
          code: "INVALID_TRANSITION",
          details: { allowed },
        });
      }
      incident.status = req.body.status;
      incident.closedAt = req.body.status === "Closed" ? new Date() : undefined;
    }
  }

  await incident.save();
  await recordAudit({
    actor: req.user,
    entityType: "SafetyIncident",
    entityId: incident._id,
    action: "safety.updated",
    fromState: before.status,
    toState: incident.status,
    reason: req.body.correctiveAction || incident.title,
  });

  const populated = await populateIncident(SafetyIncident.findById(incident._id));
  return res.status(200).json({ success: true, incident: populated });
};

export const deleteIncident = async (req, res) => {
  const incident = await SafetyIncident.findById(req.params.id);
  if (!incident) throw ApiError.notFound("Safety incident not found");
  if (incident.status !== "Open") {
    throw ApiError.conflict("Only an open incident can be deleted. Close it to keep the record instead.", {
      code: "INCIDENT_LOCKED",
    });
  }

  await SafetyIncident.deleteOne({ _id: incident._id });
  await recordAudit({
    actor: req.user,
    entityType: "SafetyIncident",
    entityId: incident._id,
    action: "safety.deleted",
    fromState: incident.status,
    reason: incident.title,
  });
  return res.status(200).json({ success: true, message: "Incident deleted" });
};

export const safetySummary = async (req, res) => {
  requireSafetyRole(req.user);
  const match = {};
  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee) return res.status(200).json({ success: true, summary: { open: 0, criticalOpen: 0, thisMonth: 0, lostTimeDays: 0, bySeverity: {}, byType: {} } });
    match.site = employee.department;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [byStatus, bySeverity, byType, thisMonth, lostTime] = await Promise.all([
    SafetyIncident.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    SafetyIncident.aggregate([{ $match: match }, { $group: { _id: "$severity", count: { $sum: 1 } } }]),
    SafetyIncident.aggregate([{ $match: match }, { $group: { _id: "$type", count: { $sum: 1 } } }]),
    SafetyIncident.countDocuments({ ...match, date: { $gte: monthStart } }),
    SafetyIncident.aggregate([
      { $match: { ...match, date: { $gte: monthStart } } },
      { $group: { _id: null, days: { $sum: "$lostTimeDays" } } },
    ]),
  ]);

  const statuses = byStatus.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  return res.status(200).json({
    success: true,
    summary: {
      open: (statuses.Open || 0) + (statuses.Investigating || 0),
      criticalOpen: await SafetyIncident.countDocuments({
        ...match,
        status: { $in: ["Open", "Investigating"] },
        severity: { $in: ["High", "Critical"] },
      }),
      thisMonth,
      lostTimeDays: lostTime[0]?.days || 0,
      byStatus: statuses,
      bySeverity: bySeverity.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {}),
      byType: byType.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {}),
    },
  });
};

export default {
  listIncidents,
  getIncident,
  createIncident,
  updateIncident,
  deleteIncident,
  safetySummary,
};
