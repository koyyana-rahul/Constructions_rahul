import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import Expense from "../models/Expense.js";
import Project from "../models/Project.js";
import Vendor from "../models/Vendor.js";
import Department from "../models/Department.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import { escapeRegex } from "../services/accessService.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { csvResponse } from "../services/exportService.js";
import { notifyRoles } from "../services/notificationService.js";
import { PRIVATE_RECEIPT_DIR } from "../middleware/multerConfig.js";

export const EXPENSE_CATEGORIES = [
  "Labour",
  "Materials",
  "Equipment",
  "Subcontractor",
  "Transport",
  "Utilities",
  "Permits",
  "Professional Fees",
  "Other",
];
export const EXPENSE_STATUSES = ["Pending", "Approved", "Paid", "Rejected"];
export const PAYMENT_METHODS = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card", "Other"];

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

const optionalRef = async (Model, id, label) => {
  if (!id) return null;
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest(`Invalid ${label}`, { code: "INVALID_ID" });
  }
  if (!(await Model.exists({ _id: id }))) {
    throw ApiError.badRequest(`The selected ${label} does not exist`, { code: "INVALID_REFERENCE" });
  }
  return id;
};

const populateExpense = (query) =>
  query
    .populate("project", "code name status")
    .populate("site", "dep_name")
    .populate("vendor", "name category")
    .populate("createdBy", "name")
    .populate("approvedBy", "name");

export const listExpenses = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50 });
  const filter = {};

  if (req.query.project) {
    if (!mongoose.isValidObjectId(req.query.project)) {
      throw ApiError.badRequest("Invalid project", { code: "INVALID_ID" });
    }
    filter.project = req.query.project;
  }
  if (req.query.site) filter.site = req.query.site;
  if (req.query.vendor) filter.vendor = req.query.vendor;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
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
    filter.$or = [{ description: rx }, { reference: rx }, { notes: rx }];
  }

  const [expenses, total] = await Promise.all([
    populateExpense(Expense.find(filter)).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Expense.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    expenses,
    pagination: paginationMeta({ page, limit }, total),
  });
};

export const getExpense = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid expense identifier", { code: "INVALID_ID" });
  }
  const expense = await populateExpense(Expense.findById(req.params.id)).lean();
  if (!expense) throw ApiError.notFound("Expense not found");
  return res.status(200).json({ success: true, expense });
};

export const createExpense = async (req, res) => {
  const {
    project: projectId,
    site: siteId,
    vendor: vendorId,
    category,
    description,
    amount,
    taxAmount = 0,
    date,
    paymentMethod = "Bank Transfer",
    reference,
    notes,
  } = req.body;

  if (!EXPENSE_CATEGORIES.includes(category)) {
    throw ApiError.badRequest("Invalid expense category", { code: "INVALID_CATEGORY" });
  }
  if (!description?.trim()) {
    throw ApiError.badRequest("An expense description is required", { code: "MISSING_FIELD" });
  }
  const baseAmount = Number(amount);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    throw ApiError.badRequest("Amount must be greater than zero", { code: "INVALID_AMOUNT" });
  }
  if (!date || Number.isNaN(new Date(date).getTime())) {
    throw ApiError.badRequest("A valid expense date is required", { code: "INVALID_DATE" });
  }
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw ApiError.badRequest("Invalid payment method", { code: "INVALID_PAYMENT_METHOD" });
  }

  let project = null;
  if (projectId) {
    if (!mongoose.isValidObjectId(projectId)) {
      throw ApiError.badRequest("Invalid project", { code: "INVALID_ID" });
    }
    project = await Project.findById(projectId).select("_id site");
    if (!project) throw ApiError.badRequest("The selected project does not exist", { code: "INVALID_REFERENCE" });
  }

  const site = await optionalRef(Department, siteId || project?.site, "site");
  const vendor = await optionalRef(Vendor, vendorId, "vendor");
  const tax = Math.max(0, Number(taxAmount) || 0);

  const expense = await Expense.create({
    project: project?._id,
    site: site || undefined,
    vendor: vendor || undefined,
    category,
    description: description.trim(),
    amount: round(baseAmount),
    taxAmount: round(tax),
    totalAmount: round(baseAmount + tax),
    date: new Date(date),
    paymentMethod,
    reference,
    notes,
    receipt: req.file ? req.file.filename : undefined,
    status: "Pending",
    createdBy: req.user._id,
  });

  await recordAudit({
    actor: req.user,
    entityType: "Expense",
    entityId: expense._id,
    action: "expense.created",
    toState: "Pending",
    reason: `${expense.description} ${expense.totalAmount}`,
  });

  await notifyRoles(["admin"], {
    type: "Finance",
    title: "Expense recorded",
    message: `${req.user.name || "An administrator"} recorded ${category} spend of ${expense.totalAmount}.`,
    link: "/admin-dashboard/expenses",
    excludeUserId: req.user._id,
  });

  const populated = await populateExpense(Expense.findById(expense._id));
  return res.status(201).json({ success: true, expense: populated });
};

export const updateExpense = async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw ApiError.notFound("Expense not found");
  if (["Approved", "Paid"].includes(expense.status)) {
    throw ApiError.conflict("An approved or paid expense is locked for audit. Reject it first to make changes.", {
      code: "EXPENSE_LOCKED",
    });
  }

  const before = expense.toObject();

  if (req.body.description !== undefined) {
    if (!req.body.description.trim()) {
      throw ApiError.badRequest("Description cannot be empty", { code: "MISSING_FIELD" });
    }
    expense.description = req.body.description.trim();
  }
  if (req.body.category !== undefined) {
    if (!EXPENSE_CATEGORIES.includes(req.body.category)) {
      throw ApiError.badRequest("Invalid expense category", { code: "INVALID_CATEGORY" });
    }
    expense.category = req.body.category;
  }
  if (req.body.project !== undefined) {
    const project = await optionalRef(Project, req.body.project, "project");
    expense.project = project || undefined;
    if (project) {
      const projectDoc = await Project.findById(project).select("site");
      if (req.body.site === undefined && projectDoc?.site) expense.site = projectDoc.site;
    }
  }
  if (req.body.site !== undefined) {
    expense.site = (await optionalRef(Department, req.body.site, "site")) || undefined;
  }
  if (req.body.vendor !== undefined) {
    expense.vendor = (await optionalRef(Vendor, req.body.vendor, "vendor")) || undefined;
  }
  if (req.body.amount !== undefined) {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw ApiError.badRequest("Amount must be greater than zero", { code: "INVALID_AMOUNT" });
    }
    expense.amount = round(amount);
  }
  if (req.body.taxAmount !== undefined) {
    expense.taxAmount = Math.max(0, Number(req.body.taxAmount) || 0);
  }
  if (req.body.amount !== undefined || req.body.taxAmount !== undefined) {
    expense.totalAmount = round(expense.amount + expense.taxAmount);
  }
  if (req.body.date !== undefined) {
    if (Number.isNaN(new Date(req.body.date).getTime())) {
      throw ApiError.badRequest("Invalid expense date", { code: "INVALID_DATE" });
    }
    expense.date = new Date(req.body.date);
  }
  if (req.body.paymentMethod !== undefined) {
    if (!PAYMENT_METHODS.includes(req.body.paymentMethod)) {
      throw ApiError.badRequest("Invalid payment method", { code: "INVALID_PAYMENT_METHOD" });
    }
    expense.paymentMethod = req.body.paymentMethod;
  }
  if (req.body.reference !== undefined) expense.reference = req.body.reference;
  if (req.body.notes !== undefined) expense.notes = req.body.notes;
  if (req.file) {
    expense.receipt = req.file.filename;
  }
  if (req.body.removeReceipt === true || req.body.removeReceipt === "true") {
    expense.receipt = undefined;
  }

  await expense.save();
  await recordAudit({
    actor: req.user,
    entityType: "Expense",
    entityId: expense._id,
    action: "expense.updated",
    fromState: before.status,
    toState: expense.status,
    reason: expense.description,
  });

  const populated = await populateExpense(Expense.findById(expense._id));
  return res.status(200).json({ success: true, expense: populated });
};

const decide = async (req, res, nextStatus, action) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw ApiError.notFound("Expense not found");
  const previousStatus = expense.status;

  if (nextStatus === "Approved") {
    if (expense.status !== "Pending") {
      throw ApiError.conflict("Only a pending expense can be approved", { code: "INVALID_TRANSITION" });
    }
    expense.status = "Approved";
    expense.approvedBy = req.user._id;
    expense.approvedAt = new Date();
    expense.rejectionReason = undefined;
  }

  if (nextStatus === "Rejected") {
    if (!["Pending", "Approved"].includes(expense.status)) {
      throw ApiError.conflict("Only a pending or approved expense can be rejected", { code: "INVALID_TRANSITION" });
    }
    const reason = String(req.body.reason || "").trim();
    if (!reason) throw ApiError.badRequest("A reason is required to reject an expense", { code: "REASON_REQUIRED" });
    expense.status = "Rejected";
    expense.rejectionReason = reason.slice(0, 1000);
    expense.approvedBy = undefined;
    expense.approvedAt = undefined;
  }

  if (nextStatus === "Paid") {
    if (!["Approved", "Paid"].includes(expense.status)) {
      throw ApiError.conflict("Only an approved expense can be marked paid", { code: "INVALID_TRANSITION" });
    }
    expense.status = "Paid";
    expense.paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();
    if (!expense.approvedBy) {
      expense.approvedBy = req.user._id;
      expense.approvedAt = new Date();
    }
  }

  await expense.save();
  await recordAudit({
    actor: req.user,
    entityType: "Expense",
    entityId: expense._id,
    action,
    fromState: previousStatus,
    toState: nextStatus,
    reason: req.body.reason,
  });

  const populated = await populateExpense(Expense.findById(expense._id));
  return res.status(200).json({ success: true, expense: populated });
};

export const approveExpense = (req, res) => decide(req, res, "Approved", "expense.approved");
export const rejectExpense = (req, res) => decide(req, res, "Rejected", "expense.rejected");
export const markExpensePaid = (req, res) => decide(req, res, "Paid", "expense.paid");

export const deleteExpense = async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw ApiError.notFound("Expense not found");
  if (["Approved", "Paid"].includes(expense.status)) {
    throw ApiError.conflict("Approved and paid expenses are part of the financial record and cannot be deleted.", {
      code: "EXPENSE_LOCKED",
    });
  }

  if (expense.receipt) {
    const file = path.join(PRIVATE_RECEIPT_DIR, path.basename(expense.receipt));
    fs.promises.unlink(file).catch(() => {});
  }

  await Expense.deleteOne({ _id: expense._id });
  await recordAudit({
    actor: req.user,
    entityType: "Expense",
    entityId: expense._id,
    action: "expense.deleted",
    fromState: expense.status,
    reason: expense.description,
  });
  return res.status(200).json({ success: true, message: "Expense deleted" });
};

/** Authenticated receipt download. Never exposed via the public uploads dir. */
export const downloadReceipt = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid expense identifier", { code: "INVALID_ID" });
  }
  const expense = await Expense.findById(req.params.id).select("receipt description");
  if (!expense) throw ApiError.notFound("Expense not found");
  if (!expense.receipt) throw ApiError.notFound("This expense has no receipt attached");

  const filename = path.basename(expense.receipt);
  const file = path.join(PRIVATE_RECEIPT_DIR, filename);
  if (!fs.existsSync(file)) throw ApiError.notFound("The receipt file is no longer available");

  return res.download(file, `${expense.description.slice(0, 60)}${path.extname(filename)}`);
};

export const exportExpenses = async (req, res) => {
  const filter = {};
  if (req.query.project && mongoose.isValidObjectId(req.query.project)) filter.project = req.query.project;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(req.query.to);
  }

  const expenses = await Expense.find(filter)
    .populate("project", "code name")
    .populate("site", "dep_name")
    .populate("vendor", "name")
    .sort({ date: -1 })
    .lean();

  return csvResponse(res, `expenses-${new Date().toISOString().slice(0, 10)}.csv`, [
    { label: "Date", value: (r) => (r.date ? new Date(r.date).toISOString().slice(0, 10) : "") },
    { label: "Project", value: (r) => r.project?.code || "" },
    { label: "Site", value: (r) => r.site?.dep_name || "" },
    { label: "Category", key: "category" },
    { label: "Description", key: "description" },
    { label: "Vendor", value: (r) => r.vendor?.name || "" },
    { label: "Amount", key: "amount" },
    { label: "Tax", key: "taxAmount" },
    { label: "Total", key: "totalAmount" },
    { label: "Status", key: "status" },
    { label: "Reference", key: "reference" },
  ], expenses);
};

export const expenseSummary = async (req, res) => {
  const match = {};
  if (req.query.project && mongoose.isValidObjectId(req.query.project)) {
    match.project = new mongoose.Types.ObjectId(req.query.project);
  }
  if (req.query.from || req.query.to) {
    match.date = {};
    if (req.query.from) match.date.$gte = new Date(req.query.from);
    if (req.query.to) match.date.$lte = new Date(req.query.to);
  }

  const [byStatus, byCategory] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      { $group: { _id: "$status", total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { ...match, status: { $in: ["Approved", "Paid"] } } },
      { $group: { _id: "$category", total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const statuses = byStatus.reduce((acc, row) => {
    acc[row._id] = { total: round(row.total), count: row.count };
    return acc;
  }, {});

  return res.status(200).json({
    success: true,
    summary: {
      pending: statuses.Pending || { total: 0, count: 0 },
      approved: statuses.Approved || { total: 0, count: 0 },
      paid: statuses.Paid || { total: 0, count: 0 },
      rejected: statuses.Rejected || { total: 0, count: 0 },
      costToDate: round((statuses.Approved?.total || 0) + (statuses.Paid?.total || 0)),
      byCategory: byCategory.map((row) => ({
        category: row._id,
        total: round(row.total),
        count: row.count,
      })),
    },
  });
};

export default {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  approveExpense,
  rejectExpense,
  markExpensePaid,
  deleteExpense,
  downloadReceipt,
  exportExpenses,
  expenseSummary,
};
