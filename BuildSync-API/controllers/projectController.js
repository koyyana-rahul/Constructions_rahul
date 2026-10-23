import mongoose from "mongoose";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Expense from "../models/Expense.js";
import Invoice from "../models/Invoice.js";
import DailyReport from "../models/DailyReport.js";
import DocumentFile from "../models/DocumentFile.js";
import Equipment from "../models/Equipment.js";
import SafetyIncident from "../models/SafetyIncident.js";
import Employee from "../models/Employee.js";
import Client from "../models/Client.js";
import Department from "../models/Department.js";
import WorkRequest from "../models/Work.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import {
  isAdmin,
  projectVisibilityFilter,
  assertProjectAccess,
  escapeRegex,
} from "../services/accessService.js";
import { projectDetailPayload, projectFinance } from "../services/reportService.js";
import { nextProjectCode } from "../services/numberingService.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { notifyUser } from "../services/notificationService.js";

export const PROJECT_STATUSES = [
  "Planning",
  "Mobilisation",
  "In Progress",
  "On Hold",
  "Completed",
  "Handover",
  "Closed",
  "Cancelled",
];

const PROJECT_TRANSITIONS = {
  Planning: ["Mobilisation", "In Progress", "On Hold", "Cancelled"],
  Mobilisation: ["In Progress", "On Hold", "Cancelled"],
  "In Progress": ["On Hold", "Completed", "Cancelled"],
  "On Hold": ["In Progress", "Mobilisation", "Cancelled"],
  Completed: ["Handover", "In Progress"],
  Handover: ["Closed", "In Progress"],
  Closed: [],
  Cancelled: ["Planning"],
};

export const canTransitionProject = (from, to) =>
  from === to || (PROJECT_TRANSITIONS[from] || []).includes(to);

const parseDate = (value, field) => {
  if (!value) throw ApiError.badRequest(`${field} is required`, { code: "MISSING_FIELD" });
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`${field} is not a valid date`, { code: "INVALID_DATE" });
  }
  return date;
};

const nonNegative = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw ApiError.badRequest(`${field} must be zero or a positive number`, {
      code: "INVALID_AMOUNT",
    });
  }
  return number;
};

const assertEmployees = async (employeeIds = []) => {
  const ids = [...new Set(employeeIds.filter((id) => mongoose.isValidObjectId(id)).map(String))];
  if (!ids.length) return [];
  const count = await Employee.countDocuments({ _id: { $in: ids } });
  if (count !== ids.length) {
    throw ApiError.badRequest("One or more selected team members do not exist", {
      code: "INVALID_REFERENCE",
    });
  }
  return ids;
};

const populateProject = (query) =>
  query
    .populate("site", "dep_name description")
    .populate({ path: "client", select: "companyName entityType phone userId", populate: { path: "userId", select: "name email" } })
    .populate({ path: "manager", select: "employeeId designation userId", populate: { path: "userId", select: "name" } })
    .populate("workRequest", "name status appliedAt");

export const listProjects = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 25 });
  const visible = await projectVisibilityFilter(req.user);

  const filter = { ...visible };
  if (req.query.includeArchived !== "true") filter.isArchived = { $ne: true };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.site && mongoose.isValidObjectId(req.query.site)) filter.site = req.query.site;
  if (req.query.client && isAdmin(req.user) && mongoose.isValidObjectId(req.query.client)) {
    filter.client = req.query.client;
  }
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$and = [...(filter.$and || []), { $or: [{ name: rx }, { code: rx }] }];
  }
  if (req.query.mine === "true" && req.user.role === "employee") {
    // Already site-scoped; `mine` narrows to explicit assignment.
    const employee = await Employee.findOne({ userId: req.user._id }).select("_id");
    if (employee) {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ manager: employee._id }, { team: employee._id }] },
      ];
    }
  }

  let query = Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  if (req.user.role === "employee") query = query.select("-estimatedCost -contractValue");
  else if (req.user.role === "client") query = query.select("-estimatedCost");

  const [projects, total] = await Promise.all([
    populateProject(query).lean(),
    Project.countDocuments(filter),
  ]);

  // Attach a compact finance summary only where it is appropriate.
  if (isAdmin(req.user) && projects.length) {
    const financeMap = await Promise.all(
      projects.map(async (project) => ({
        id: String(project._id),
        finance: await projectFinance(project._id),
      }))
    );
    const byId = financeMap.reduce((acc, row) => {
      acc[row.id] = row.finance;
      return acc;
    }, {});
    for (const project of projects) project.finance = byId[String(project._id)];
  }

  return res.status(200).json({
    success: true,
    projects,
    pagination: paginationMeta({ page, limit }, total),
  });
};

export const getProject = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid project identifier", { code: "INVALID_ID" });
  }

  const project = await populateProject(Project.findById(req.params.id));
  if (!project) throw ApiError.notFound("Project not found");
  await assertProjectAccess(req.user, project);

  const payload = await projectDetailPayload(project, { role: req.user.role });

  return res.status(200).json({ success: true, project: payload });
};

/** Defaults for the "create project from a work request" form. */
export const prefillFromWorkRequest = async (req, res) => {
  const workRequest = await WorkRequest.findById(req.params.workRequestId)
    .populate({ path: "clientId", populate: { path: "userId", select: "name" } })
    .lean();

  if (!workRequest) throw ApiError.notFound("Work request not found");

  const existing = await Project.findOne({ workRequest: workRequest._id }).select("_id code");
  if (existing) {
    throw ApiError.conflict("A project has already been created from this work request", {
      code: "PROJECT_EXISTS",
      details: { projectId: existing._id, code: existing.code },
    });
  }
  if (["Rejected", "Cancelled"].includes(workRequest.status)) {
    throw ApiError.conflict("A rejected or cancelled work request cannot become a project", {
      code: "WORK_REQUEST_CLOSED",
    });
  }

  return res.status(200).json({
    success: true,
    draft: {
      workRequestId: workRequest._id,
      name: workRequest.name,
      description: workRequest.description,
      startDate: workRequest.startDate,
      endDate: workRequest.endDate,
      client: workRequest.clientId?._id || null,
      clientName: workRequest.clientId?.userId?.name || workRequest.clientId?.companyName || null,
    },
  });
};

export const createProject = async (req, res) => {
  const {
    name,
    code,
    description,
    site,
    client,
    workRequestId,
    manager,
    team,
    status = "Planning",
    priority = "Normal",
    health = "On Track",
    startDate,
    endDate,
    contractValue = 0,
    estimatedCost = 0,
    progress = 0,
    tags = [],
    milestones = [],
  } = req.body;

  if (!name?.trim() && !workRequestId) {
    throw ApiError.badRequest("Project name is required", { code: "MISSING_FIELD" });
  }
  if (!site || !mongoose.isValidObjectId(site)) {
    throw ApiError.badRequest("A construction site is required", { code: "MISSING_FIELD" });
  }
  const siteDoc = await Department.findById(site);
  if (!siteDoc) throw ApiError.badRequest("The selected site does not exist", { code: "INVALID_REFERENCE" });
  if (siteDoc.isArchived) {
    throw ApiError.conflict("A project cannot be started on an archived site", {
      code: "SITE_ARCHIVED",
    });
  }

  if (!PROJECT_STATUSES.includes(status)) {
    throw ApiError.badRequest("Invalid project status", { code: "INVALID_STATUS" });
  }
  if (!["Low", "Normal", "High", "Critical"].includes(priority)) {
    throw ApiError.badRequest("Invalid priority", { code: "INVALID_PRIORITY" });
  }
  if (!["On Track", "At Risk", "Delayed", "On Hold"].includes(health)) {
    throw ApiError.badRequest("Invalid project health", { code: "INVALID_HEALTH" });
  }

  let workRequest = null;
  let resolvedClient = client || null;
  let resolvedName = name?.trim() || "";
  let resolvedStart = startDate;
  let resolvedEnd = endDate;
  let resolvedDescription = description;

  if (workRequestId) {
    if (!mongoose.isValidObjectId(workRequestId)) {
      throw ApiError.badRequest("Invalid work request", { code: "INVALID_ID" });
    }
    workRequest = await WorkRequest.findById(workRequestId);
    if (!workRequest) throw ApiError.notFound("Work request not found");
    if (["Rejected", "Cancelled"].includes(workRequest.status)) {
      throw ApiError.conflict("A rejected or cancelled work request cannot become a project", {
        code: "WORK_REQUEST_CLOSED",
      });
    }
    if (await Project.exists({ workRequest: workRequest._id })) {
      throw ApiError.conflict("A project already exists for this work request", {
        code: "PROJECT_EXISTS",
      });
    }
    resolvedClient = workRequest.clientId;
    resolvedName = resolvedName || workRequest.name;
    resolvedStart = resolvedStart || workRequest.startDate;
    resolvedEnd = resolvedEnd || workRequest.endDate;
    resolvedDescription = resolvedDescription || workRequest.description;
  }

  const start = parseDate(resolvedStart, "Start date");
  const end = parseDate(resolvedEnd, "End date");
  if (end < start) {
    throw ApiError.badRequest("End date must be on or after the start date", {
      code: "INVALID_RANGE",
    });
  }

  if (resolvedClient && !mongoose.isValidObjectId(resolvedClient)) {
    throw ApiError.badRequest("Invalid client", { code: "INVALID_ID" });
  }
  if (resolvedClient && !(await Client.exists({ _id: resolvedClient }))) {
    throw ApiError.badRequest("The selected client does not exist", { code: "INVALID_REFERENCE" });
  }

  const validManager = manager ? (await assertEmployees([manager]))[0] : null;
  const teamIds = await assertEmployees(Array.isArray(team) ? team : []);

  const progressValue = Math.min(100, Math.max(0, Number(progress) || 0));
  const projectCode = code?.trim()?.toUpperCase() || (await nextProjectCode());

  if (await Project.exists({ code: projectCode })) {
    throw ApiError.conflict("That project code is already in use", { code: "DUPLICATE_CODE" });
  }

  const project = await Project.create({
    code: projectCode,
    name: resolvedName,
    description: resolvedDescription,
    site,
    client: resolvedClient || undefined,
    workRequest: workRequest?._id,
    manager: validManager || undefined,
    team: teamIds,
    status,
    priority,
    health,
    startDate: start,
    endDate: end,
    contractValue: nonNegative(contractValue, "Contract value"),
    estimatedCost: nonNegative(estimatedCost, "Estimated cost"),
    progress: progressValue,
    tags: Array.isArray(tags) ? tags.filter(Boolean).slice(0, 20) : [],
    milestones: Array.isArray(milestones)
      ? milestones
          .filter((m) => m?.title)
          .map((m) => ({
            title: String(m.title).slice(0, 200),
            dueDate: m.dueDate ? new Date(m.dueDate) : undefined,
            weight: Math.min(100, Math.max(0, Number(m.weight) || 1)),
          }))
      : [],
    createdBy: req.user._id,
  });

  // Creating a project from a request is the acceptance step.
  if (workRequest && ["Pending", "Under Review", "Approved"].includes(workRequest.status)) {
    const previousStatus = workRequest.status;
    workRequest.status = "Assigned";
    workRequest.updatedAt = new Date();
    await workRequest.save();
    await recordAudit({
      actor: req.user,
      entityType: "WorkRequest",
      entityId: workRequest._id,
      action: "work_request.assigned_to_project",
      fromState: previousStatus,
      toState: "Assigned",
      reason: `Project ${project.code}`,
    });
  }

  await recordAudit({
    actor: req.user,
    entityType: "Project",
    entityId: project._id,
    action: "project.created",
    toState: project.status,
  });

  if (project.client) {
    const clientDoc = await Client.findById(project.client).populate("userId", "name");
    await notifyUser({
      userId: clientDoc?.userId,
      type: "Assignment",
      title: "Your project has started",
      message: `${project.name} (${project.code}) is now being managed by your contractor.`,
      link: `/client-dashboard/projects/${project._id}`,
    });
  }
  if (project.manager) {
    const managerDoc = await Employee.findById(project.manager).populate("userId", "name");
    await notifyUser({
      userId: managerDoc?.userId,
      type: "Assignment",
      title: "You are managing a new project",
      message: `${project.name} (${project.code}) has been assigned to you.`,
      link: `/employee-dashboard/projects/${project._id}`,
    });
  }

  const populated = await populateProject(Project.findById(project._id));
  const payload = await projectDetailPayload(populated, { role: "admin" });
  return res.status(201).json({ success: true, project: payload });
};

export const updateProject = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound("Project not found");
  if (project.isArchived && req.body.isArchived !== false) {
    throw ApiError.conflict("Restore this archived project before editing it", {
      code: "PROJECT_ARCHIVED",
    });
  }

  const before = project.toObject();
  const {
    name,
    description,
    site,
    client,
    manager,
    team,
    status,
    priority,
    health,
    startDate,
    endDate,
    actualEndDate,
    contractValue,
    estimatedCost,
    progress,
    tags,
  } = req.body;

  if (name !== undefined) {
    if (!name.trim()) throw ApiError.badRequest("Project name cannot be empty", { code: "MISSING_FIELD" });
    project.name = name.trim();
  }
  if (description !== undefined) project.description = description;
  if (site !== undefined) {
    if (!mongoose.isValidObjectId(site)) {
      throw ApiError.badRequest("Invalid site", { code: "INVALID_ID" });
    }
    const siteDoc = await Department.findById(site);
    if (!siteDoc) throw ApiError.badRequest("The selected site does not exist", { code: "INVALID_REFERENCE" });
    if (siteDoc.isArchived) throw ApiError.conflict("Cannot move a project to an archived site", { code: "SITE_ARCHIVED" });
    project.site = site;
  }
  if (client !== undefined) {
    if (client && !(await Client.exists({ _id: client }))) {
      throw ApiError.badRequest("The selected client does not exist", { code: "INVALID_REFERENCE" });
    }
    project.client = client || undefined;
  }
  if (manager !== undefined) {
    const ids = manager ? await assertEmployees([manager]) : [];
    project.manager = ids[0] || undefined;
  }
  if (team !== undefined) project.team = await assertEmployees(Array.isArray(team) ? team : []);
  if (status !== undefined) {
    if (!PROJECT_STATUSES.includes(status)) {
      throw ApiError.badRequest("Invalid project status", { code: "INVALID_STATUS" });
    }
    if (!canTransitionProject(project.status, status)) {
      throw ApiError.conflict(
        `Cannot move a project from "${project.status}" to "${status}"`,
        { code: "INVALID_TRANSITION", allowed: PROJECT_TRANSITIONS[project.status] || [] }
      );
    }
    project.status = status;
    if (["Completed", "Handover", "Closed"].includes(status) && !project.actualEndDate) {
      project.actualEndDate = new Date();
    }
    if (["In Progress", "Mobilisation"].includes(status) && project.health === "On Hold") {
      project.health = "On Track";
    }
  }
  if (priority !== undefined) {
    if (!["Low", "Normal", "High", "Critical"].includes(priority)) {
      throw ApiError.badRequest("Invalid priority", { code: "INVALID_PRIORITY" });
    }
    project.priority = priority;
  }
  if (health !== undefined) {
    if (!["On Track", "At Risk", "Delayed", "On Hold"].includes(health)) {
      throw ApiError.badRequest("Invalid project health", { code: "INVALID_HEALTH" });
    }
    project.health = health;
  }
  if (startDate !== undefined) project.startDate = parseDate(startDate, "Start date");
  if (endDate !== undefined) project.endDate = parseDate(endDate, "End date");
  if (actualEndDate !== undefined) {
    project.actualEndDate = actualEndDate ? parseDate(actualEndDate, "Actual end date") : undefined;
  }
  if (project.endDate < project.startDate) {
    throw ApiError.badRequest("End date must be on or after the start date", {
      code: "INVALID_RANGE",
    });
  }
  if (contractValue !== undefined) project.contractValue = nonNegative(contractValue, "Contract value");
  if (estimatedCost !== undefined) project.estimatedCost = nonNegative(estimatedCost, "Estimated cost");
  if (progress !== undefined) project.progress = Math.min(100, Math.max(0, Number(progress) || 0));
  if (tags !== undefined) project.tags = Array.isArray(tags) ? tags.filter(Boolean).slice(0, 20) : [];
  if (req.body.isArchived === false) {
    project.isArchived = false;
    project.archivedAt = undefined;
  }

  await project.save();

  const changed = Object.keys(req.body).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(project.toObject()[key])
  );

  await recordAudit({
    actor: req.user,
    entityType: "Project",
    entityId: project._id,
    action: "project.updated",
    fromState: before.status,
    toState: project.status,
    reason: changed.length ? changed.join(", ") : "no field changes",
  });

  if (status && status !== before.status && project.client) {
    const clientDoc = await Client.findById(project.client).populate("userId", "name");
    await notifyUser({
      userId: clientDoc?.userId,
      type: "Info",
      title: `Project status: ${project.status}`,
      message: `${project.name} (${project.code}) moved to ${project.status}.`,
      link: `/client-dashboard/projects/${project._id}`,
    });
  }
  if (manager !== undefined && project.manager) {
    const managerDoc = await Employee.findById(project.manager).populate("userId", "name");
    await notifyUser({
      userId: managerDoc?.userId,
      type: "Assignment",
      title: "You are managing a project",
      message: `${project.name} (${project.code}) has been assigned to you.`,
      link: `/employee-dashboard/projects/${project._id}`,
    });
  }

  const populated = await populateProject(Project.findById(project._id));
  const payload = await projectDetailPayload(populated, { role: "admin" });
  return res.status(200).json({ success: true, project: payload });
};

export const archiveProject = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound("Project not found");
  if (project.isArchived) throw ApiError.conflict("Project is already archived", { code: "PROJECT_ARCHIVED" });

  project.isArchived = true;
  project.archivedAt = new Date();
  await project.save();

  await recordAudit({
    actor: req.user,
    entityType: "Project",
    entityId: project._id,
    action: "project.archived",
    fromState: project.status,
    toState: "Archived",
    reason: req.body?.reason,
  });

  return res.status(200).json({ success: true, message: "Project archived. History preserved." });
};

export const restoreProject = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound("Project not found");
  if (!project.isArchived) throw ApiError.conflict("Project is not archived", { code: "PROJECT_NOT_ARCHIVED" });

  project.isArchived = false;
  project.archivedAt = undefined;
  await project.save();

  await recordAudit({
    actor: req.user,
    entityType: "Project",
    entityId: project._id,
    action: "project.restored",
  });

  return res.status(200).json({ success: true, project });
};

export const deleteProject = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound("Project not found");

  const [invoices, expenses, reports, tasks, documents, equipment, safety] = await Promise.all([
    Invoice.countDocuments({ project: project._id }),
    Expense.countDocuments({ project: project._id }),
    DailyReport.countDocuments({ project: project._id }),
    Task.countDocuments({ project: project._id }),
    DocumentFile.countDocuments({ project: project._id }),
    Equipment.countDocuments({ project: project._id }),
    SafetyIncident.countDocuments({ project: project._id }),
  ]);

  const workRequest = project.workRequest ? 1 : 0;
  const dependencies = {
    invoices,
    expenses,
    reports,
    tasks,
    documents,
    equipment,
    safetyIncidents: safety,
    workRequests: workRequest,
  };

  if (Object.values(dependencies).some((count) => count > 0)) {
    throw ApiError.conflict(
      "This project has financial, field, document or equipment records. Archive it instead so billing and site history are preserved.",
      {
        code: "HISTORICAL_DEPENDENCIES",
        details: dependencies,
      }
    );
  }

  await Project.deleteOne({ _id: project._id });
  await recordAudit({
    actor: req.user,
    entityType: "Project",
    entityId: project._id,
    action: "project.deleted",
  });

  return res.status(200).json({ success: true, message: "Project permanently deleted" });
};

/* ------------------------------------------------------------- Milestones */

export const addMilestone = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound("Project not found");
  if (!req.body.title?.trim()) {
    throw ApiError.badRequest("Milestone title is required", { code: "MISSING_FIELD" });
  }

  project.milestones.push({
    title: req.body.title.trim().slice(0, 200),
    dueDate: req.body.dueDate ? parseDate(req.body.dueDate, "Due date") : undefined,
    status: ["Pending", "In Progress", "Completed", "Delayed"].includes(req.body.status)
      ? req.body.status
      : "Pending",
    weight: Math.min(100, Math.max(0, Number(req.body.weight) || 1)),
    completedAt: req.body.status === "Completed" ? new Date() : undefined,
  });
  await project.save();

  await recordAudit({
    actor: req.user,
    entityType: "Project",
    entityId: project._id,
    action: "project.milestone_added",
    reason: req.body.title,
  });

  return res.status(201).json({ success: true, milestones: project.milestones });
};

export const updateMilestone = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound("Project not found");

  const milestone = project.milestones.id(req.params.milestoneId);
  if (!milestone) throw ApiError.notFound("Milestone not found");

  if (req.body.title !== undefined) {
    if (!req.body.title.trim()) throw ApiError.badRequest("Milestone title is required", { code: "MISSING_FIELD" });
    milestone.title = req.body.title.trim().slice(0, 200);
  }
  if (req.body.dueDate !== undefined) {
    milestone.dueDate = req.body.dueDate ? parseDate(req.body.dueDate, "Due date") : undefined;
  }
  if (req.body.weight !== undefined) {
    milestone.weight = Math.min(100, Math.max(0, Number(req.body.weight) || 0));
  }
  if (req.body.status !== undefined) {
    if (!["Pending", "In Progress", "Completed", "Delayed"].includes(req.body.status)) {
      throw ApiError.badRequest("Invalid milestone status", { code: "INVALID_STATUS" });
    }
    milestone.status = req.body.status;
    milestone.completedAt = req.body.status === "Completed" ? milestone.completedAt || new Date() : undefined;
  }
  await project.save();

  await recordAudit({
    actor: req.user,
    entityType: "Project",
    entityId: project._id,
    action: "project.milestone_updated",
    fromState: null,
    toState: milestone.status,
    reason: milestone.title,
  });

  return res.status(200).json({ success: true, milestones: project.milestones });
};

export const deleteMilestone = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound("Project not found");
  const milestone = project.milestones.id(req.params.milestoneId);
  if (!milestone) throw ApiError.notFound("Milestone not found");

  project.milestones.pull({ _id: milestone._id });
  await project.save();

  return res.status(200).json({ success: true, milestones: project.milestones });
};

export { populateProject };
