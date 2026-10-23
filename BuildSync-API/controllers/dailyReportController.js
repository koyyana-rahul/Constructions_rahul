import mongoose from "mongoose";
import DailyReport from "../models/DailyReport.js";
import Project from "../models/Project.js";
import Material from "../models/Material.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import {
  isAdmin,
  employeeForUser,
  canAccessProject,
  escapeRegex,
} from "../services/accessService.js";
import { businessDate } from "../middleware/defaultAttendance.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { notifyRoles, notifyUser } from "../services/notificationService.js";
import { recordMovement } from "../services/inventoryService.js";
import { withTransaction } from "../utils/transaction.js";

const populateReport = (query) =>
  query
    .populate("project", "code name status site")
    .populate("site", "dep_name")
    .populate("submittedBy", "name role")
    .populate("approvedBy", "name")
    .populate("materialsUsed.material", "name sku unit");

const assertReportAccess = async (user, report) => {
  if (isAdmin(user)) return true;

  if (user.role === "employee") {
    const employee = await employeeForUser(user._id);
    if (!employee) throw ApiError.forbidden("No employee profile is linked to this account", { code: "NO_EMPLOYEE_PROFILE" });
    const ownSubmission = String(report.submittedBy?._id || report.submittedBy) === String(user._id);
    const allowed = ownSubmission || (await canAccessProject(user, report.project?._id || report.project));
    if (!allowed) {
      throw ApiError.forbidden("You can only view reports for your own site or submissions", {
        code: "FORBIDDEN_OWNERSHIP",
      });
    }
    return true;
  }

  if (user.role === "client") {
    const project = await Project.findById(report.project?._id || report.project).select("client");
    if (!project) throw ApiError.notFound("Project not found");
    const { clientForUser } = await import("../services/accessService.js");
    const client = await clientForUser(user._id);
    if (!client || String(project.client) !== String(client._id)) {
      throw ApiError.forbidden("You can only view your own project reports", {
        code: "FORBIDDEN_OWNERSHIP",
      });
    }
    if (report.status !== "Approved") {
      throw ApiError.forbidden("Only approved reports are shared with clients", {
        code: "REPORT_NOT_APPROVED",
      });
    }
    return true;
  }

  throw ApiError.forbidden("You do not have access to daily reports", { code: "FORBIDDEN_ROLE" });
};

/**
 * Multipart text fields arrive as strings. A daily report submitted with
 * photos sends `workforce` and `materialsUsed` as JSON strings, so normalise
 * them here rather than requiring every client to hand-build bracket keys.
 */
const parseJsonField = (value, fallback = undefined) => {
  if (typeof value !== "string") return value ?? fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
};

const validateMaterials = async (items) => {
  if (!Array.isArray(items) || !items.length) return [];
  const ids = items.filter((i) => mongoose.isValidObjectId(i.material)).map((i) => i.material);
  const materials = await Material.find({ _id: { $in: ids } }).select("name unit");
  const byId = new Map(materials.map((m) => [String(m._id), m]));

  return items.map((item) => {
    const material = byId.get(String(item.material));
    if (!material) {
      throw ApiError.badRequest("One of the selected materials does not exist", {
        code: "INVALID_REFERENCE",
      });
    }
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw ApiError.badRequest("Material quantities must be greater than zero", {
        code: "INVALID_QUANTITY",
      });
    }
    return { material: material._id, quantity, unit: item.unit || material.unit };
  });
};

export const listReports = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 25 });
  const filter = {};

  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee) {
      return res.status(200).json({
        success: true,
        reports: [],
        pagination: paginationMeta({ page, limit }, 0),
      });
    }
    filter.$or = [{ submittedBy: req.user._id }, { site: employee.department }];
  } else if (req.user.role === "client") {
    const { clientForUser } = await import("../services/accessService.js");
    const client = await clientForUser(req.user._id);
    if (!client) {
      return res.status(200).json({
        success: true,
        reports: [],
        pagination: paginationMeta({ page, limit }, 0),
      });
    }
    const projectIds = await Project.find({ client: client._id }).select("_id").lean();
    filter.project = { $in: projectIds.map((p) => p._id) };
    filter.status = "Approved";
  } else if (!isAdmin(req.user)) {
    throw ApiError.forbidden("Daily reports are not available to this role", { code: "FORBIDDEN_ROLE" });
  }

  if (req.query.project) {
    if (!mongoose.isValidObjectId(req.query.project)) {
      throw ApiError.badRequest("Invalid project", { code: "INVALID_ID" });
    }
    filter.project = req.query.project;
  }
  if (req.query.site && isAdmin(req.user)) filter.site = req.query.site;
  if (req.query.status && isAdmin(req.user)) filter.status = req.query.status;
  if (req.query.date) filter.date = String(req.query.date);
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.workCompleted = rx;
  }

  const [reports, total] = await Promise.all([
    populateReport(DailyReport.find(filter))
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DailyReport.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    reports,
    pagination: paginationMeta({ page, limit }, total),
  });
};

export const getReport = async (req, res) => {
  const report = await populateReport(DailyReport.findById(req.params.id));
  if (!report) throw ApiError.notFound("Daily report not found");
  await assertReportAccess(req.user, report);
  return res.status(200).json({ success: true, report });
};

export const createReport = async (req, res) => {
  const { project: projectId, date, weather, workCompleted, issues, safetyNotes } = req.body;

  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    throw ApiError.badRequest("A project is required", { code: "MISSING_FIELD" });
  }
  if (!workCompleted?.trim()) {
    throw ApiError.badRequest("Describe the work completed today", { code: "MISSING_FIELD" });
  }
  const project = await Project.findById(projectId);
  if (!project) throw ApiError.badRequest("The selected project does not exist", { code: "INVALID_REFERENCE" });
  if (project.isArchived) {
    throw ApiError.conflict("Reports cannot be added to an archived project", { code: "PROJECT_ARCHIVED" });
  }
  if (req.user.role === "employee") {
    const allowed = await canAccessProject(req.user, project);
    if (!allowed) {
      throw ApiError.forbidden("You can only submit reports for your assigned site or project", {
        code: "FORBIDDEN_PROJECT",
      });
    }
  }

  const reportDate = date ? String(date) : businessDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    throw ApiError.badRequest("Date must be in YYYY-MM-DD format", { code: "INVALID_DATE" });
  }
  if (reportDate > businessDate()) {
    throw ApiError.badRequest("A daily report cannot be filed for a future date", {
      code: "INVALID_DATE",
    });
  }

  if (await DailyReport.exists({ project: project._id, date: reportDate })) {
    throw ApiError.conflict("A daily report already exists for this project and date", {
      code: "DUPLICATE_REPORT",
    });
  }

  const materialsUsed = await validateMaterials(parseJsonField(req.body.materialsUsed, []));
  const workforce = parseJsonField(req.body.workforce, {}) || {};
  const photos = (req.files || []).map((file) => file.filename).slice(0, 6);

  const report = await DailyReport.create({
    project: project._id,
    site: project.site,
    date: reportDate,
    weather: weather || "Clear",
    workforce: {
      planned: Math.max(0, Number(workforce.planned) || 0),
      present: Math.max(0, Number(workforce.present) || 0),
    },
    workCompleted: workCompleted.trim(),
    issues,
    safetyNotes,
    materialsUsed,
    photos,
    status: "Draft",
    submittedBy: req.user._id,
  });

  await recordAudit({
    actor: req.user,
    entityType: "DailyReport",
    entityId: report._id,
    action: "daily_report.created",
    toState: "Draft",
    reason: `${project.code} ${reportDate}`,
  });

  const populated = await populateReport(DailyReport.findById(report._id));
  return res.status(201).json({ success: true, report: populated });
};

export const updateReport = async (req, res) => {
  const report = await DailyReport.findById(req.params.id);
  if (!report) throw ApiError.notFound("Daily report not found");

  const admin = isAdmin(req.user);
  if (!admin && String(report.submittedBy) !== String(req.user._id)) {
    throw ApiError.forbidden("You can only edit your own report", { code: "FORBIDDEN_OWNERSHIP" });
  }
  if (!admin && report.status !== "Draft") {
    throw ApiError.conflict("A submitted report can no longer be edited", {
      code: "REPORT_LOCKED",
    });
  }
  // Approval may have posted material usage to the append-only stock ledger.
  // Editing the report afterwards would leave the two records inconsistent.
  if (report.status === "Approved") {
    throw ApiError.conflict("An approved daily report is locked for audit", {
      code: "REPORT_APPROVED_LOCKED",
    });
  }

  if (req.body.weather !== undefined) report.weather = req.body.weather;
  if (req.body.workCompleted !== undefined) {
    if (!req.body.workCompleted.trim()) {
      throw ApiError.badRequest("Work completed cannot be empty", { code: "MISSING_FIELD" });
    }
    report.workCompleted = req.body.workCompleted.trim();
  }
  if (req.body.issues !== undefined) report.issues = req.body.issues;
  if (req.body.safetyNotes !== undefined) report.safetyNotes = req.body.safetyNotes;
  if (req.body.workforce !== undefined) {
    const workforce = parseJsonField(req.body.workforce, {}) || {};
    report.workforce = {
      planned: Math.max(0, Number(workforce.planned) || 0),
      present: Math.max(0, Number(workforce.present) || 0),
    };
  }
  if (req.body.materialsUsed !== undefined) {
    report.materialsUsed = await validateMaterials(
      parseJsonField(req.body.materialsUsed, [])
    );
  }
  if (parseJsonField(req.body.removePhotos, false) === true && report.status === "Draft") {
    report.photos = [];
  }
  if (req.files?.length) {
    const added = req.files.map((file) => file.filename);
    report.photos = [...new Set([...(report.photos || []), ...added])].slice(0, 6);
  }

  await report.save();
  await recordAudit({
    actor: req.user,
    entityType: "DailyReport",
    entityId: report._id,
    action: "daily_report.updated",
    toState: report.status,
  });

  const populated = await populateReport(DailyReport.findById(report._id));
  return res.status(200).json({ success: true, report: populated });
};

export const submitReport = async (req, res) => {
  const report = await DailyReport.findById(req.params.id);
  if (!report) throw ApiError.notFound("Daily report not found");

  const admin = isAdmin(req.user);
  if (!admin && String(report.submittedBy) !== String(req.user._id)) {
    throw ApiError.forbidden("You can only submit your own report", { code: "FORBIDDEN_OWNERSHIP" });
  }
  if (report.status !== "Draft") {
    throw ApiError.conflict(`A ${report.status.toLowerCase()} report cannot be submitted again`, {
      code: "INVALID_TRANSITION",
    });
  }

  report.status = "Submitted";
  report.submittedAt = new Date();
  await report.save();

  await recordAudit({
    actor: req.user,
    entityType: "DailyReport",
    entityId: report._id,
    action: "daily_report.submitted",
    fromState: "Draft",
    toState: "Submitted",
  });

  await notifyRoles(["admin"], {
    type: "Approval",
    title: "Daily report awaiting approval",
    message: `${req.user.name || "Site team"} submitted a report for ${report.date}.`,
    link: `/admin-dashboard/daily-reports`,
    excludeUserId: req.user._id,
  });

  return res.status(200).json({ success: true, report });
};

export const approveReport = async (req, res) => {
  const reportId = req.params.id;

  const result = await withTransaction(async (session) => {
    const report = await DailyReport.findById(reportId).session(session);
    if (!report) throw ApiError.notFound("Daily report not found");
    if (!["Submitted", "Approved"].includes(report.status)) {
      throw ApiError.conflict("Only a submitted report can be approved", {
        code: "INVALID_TRANSITION",
      });
    }

    // Material usage posts to the stock ledger exactly once.
    if (!report.stockApplied && report.materialsUsed?.length) {
      for (const item of report.materialsUsed) {
        await recordMovement(
          {
            material: item.material,
            site: report.site,
            type: "Out",
            quantity: item.quantity,
            unitCost: 0,
            reference: `DPR ${report.date}`,
            note: "Material consumed on site (daily report)",
            date: new Date(report.date),
            source: "DailyReport",
            sourceId: report._id,
            createdBy: req.user._id,
          },
          { session }
        );
      }
      report.stockApplied = true;
      report.stockAppliedAt = new Date();
    }

    report.status = "Approved";
    report.approvedBy = req.user._id;
    report.approvedAt = new Date();
    report.rejectionReason = undefined;
    await report.save({ session });
    return report;
  });

  await recordAudit({
    actor: req.user,
    entityType: "DailyReport",
    entityId: result._id,
    action: "daily_report.approved",
    fromState: "Submitted",
    toState: "Approved",
  });

  await notifyUser({
    userId: result.submittedBy,
    type: "Approval",
    title: "Daily report approved",
    message: `Your report for ${result.date} was approved.`,
    link: `/employee-dashboard/daily-reports`,
    excludeUserId: req.user._id,
  });

  return res.status(200).json({ success: true, report: result });
};

export const rejectReport = async (req, res) => {
  const report = await DailyReport.findById(req.params.id);
  if (!report) throw ApiError.notFound("Daily report not found");
  if (report.status !== "Submitted") {
    throw ApiError.conflict("Only a submitted report can be returned", {
      code: "INVALID_TRANSITION",
    });
  }
  const reason = String(req.body.reason || "").trim();
  if (!reason) {
    throw ApiError.badRequest("A reason is required when returning a report", {
      code: "REASON_REQUIRED",
    });
  }

  report.status = "Draft";
  report.rejectionReason = reason.slice(0, 1000);
  await report.save();

  await recordAudit({
    actor: req.user,
    entityType: "DailyReport",
    entityId: report._id,
    action: "daily_report.returned",
    fromState: "Submitted",
    toState: "Draft",
    reason,
  });

  await notifyUser({
    userId: report.submittedBy,
    type: "Approval",
    title: "Daily report returned for correction",
    message: reason,
    link: "/employee-dashboard/daily-reports",
    excludeUserId: req.user._id,
  });

  return res.status(200).json({ success: true, report });
};

export const deleteReport = async (req, res) => {
  const report = await DailyReport.findById(req.params.id);
  if (!report) throw ApiError.notFound("Daily report not found");

  const admin = isAdmin(req.user);
  if (!admin && String(report.submittedBy) !== String(req.user._id)) {
    throw ApiError.forbidden("You can only delete your own report", { code: "FORBIDDEN_OWNERSHIP" });
  }
  if (report.status === "Approved") {
    throw ApiError.conflict("An approved report is part of the site record and cannot be deleted", {
      code: "REPORT_APPROVED",
    });
  }

  await DailyReport.deleteOne({ _id: report._id });
  await recordAudit({
    actor: req.user,
    entityType: "DailyReport",
    entityId: report._id,
    action: "daily_report.deleted",
    fromState: report.status,
  });

  return res.status(200).json({ success: true, message: "Daily report deleted" });
};
