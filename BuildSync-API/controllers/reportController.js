import mongoose from "mongoose";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Invoice from "../models/Invoice.js";
import Expense from "../models/Expense.js";
import StockMovement from "../models/StockMovement.js";
import SafetyIncident from "../models/SafetyIncident.js";
import DailyReport from "../models/DailyReport.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import ApiError from "../utils/ApiError.js";
import { adminOverview, clientOverview, employeeOverview, projectFinance } from "../services/reportService.js";
import { csvResponse } from "../services/exportService.js";
import { isAdmin, escapeRegex } from "../services/accessService.js";
import { refreshOverdueInvoices } from "../services/invoiceService.js";

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

const dateRange = (query, defaultDays = 180) => {
  const to = query.to ? new Date(query.to) : new Date();
  to.setHours(23, 59, 59, 999);
  if (Number.isNaN(to.getTime())) throw ApiError.badRequest("Invalid end date", { code: "INVALID_DATE" });

  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - defaultDays * 86400000);
  from.setHours(0, 0, 0, 0);
  if (Number.isNaN(from.getTime())) throw ApiError.badRequest("Invalid start date", { code: "INVALID_DATE" });
  if (from > to) throw ApiError.badRequest("Start date must be before the end date", { code: "INVALID_RANGE" });

  return { from, to };
};

const requireAdmin = (req) => {
  if (!isAdmin(req.user)) {
    throw ApiError.forbidden("This report is available to administrators only", { code: "FORBIDDEN_ROLE" });
  }
};

export const getOverview = async (req, res) => {
  if (isAdmin(req.user)) {
    return res.status(200).json({ success: true, role: "admin", overview: await adminOverview() });
  }
  if (req.user.role === "client") {
    return res.status(200).json({ success: true, role: "client", overview: await clientOverview(req.user) });
  }
  if (req.user.role === "employee") {
    return res.status(200).json({ success: true, role: "employee", overview: await employeeOverview(req.user) });
  }
  throw ApiError.forbidden("Your role has no dashboard", { code: "FORBIDDEN_ROLE" });
};

/** Project-level performance: schedule, tasks, field activity and money. */
export const projectReport = async (req, res) => {
  requireAdmin(req);
  const filter = { isArchived: { $ne: true } };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.site) filter.site = req.query.site;

  const projects = await Project.find(filter)
    .populate("client", "companyName entityType")
    .populate("site", "dep_name")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const ids = projects.map((p) => p._id);
  const [taskRows, reportRows] = await Promise.all([
    Task.aggregate([
      { $match: { project: { $in: ids } } },
      {
        $group: {
          _id: "$project",
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ["$status", "Done"] }, 1, 0] } },
          blocked: { $sum: { $cond: [{ $eq: ["$status", "Blocked"] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$status", "Done"] },
                    { $lt: ["$dueDate", new Date()] },
                    { $ne: [{ $type: "$dueDate" }, "missing"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    DailyReport.aggregate([
      { $match: { project: { $in: ids } } },
      { $group: { _id: "$project", reports: { $sum: 1 }, last: { $max: "$date" } } },
    ]),
  ]);

  const taskMap = taskRows.reduce((acc, row) => {
    acc[String(row._id)] = row;
    return acc;
  }, {});
  const reportMap = reportRows.reduce((acc, row) => {
    acc[String(row._id)] = row;
    return acc;
  }, {});

  const rows = [];
  for (const project of projects) {
    const finance = await projectFinance(project._id);
    const tasks = taskMap[String(project._id)] || { total: 0, done: 0, blocked: 0, overdue: 0 };
    const reports = reportMap[String(project._id)] || { reports: 0, last: null };
    const budget = Number(project.estimatedCost) || 0;
    rows.push({
      _id: project._id,
      code: project.code,
      name: project.name,
      status: project.status,
      health: project.health,
      priority: project.priority,
      progress: project.progress || 0,
      client: project.client?.companyName || project.client?.entityType || "—",
      site: project.site?.dep_name || "—",
      startDate: project.startDate,
      endDate: project.endDate,
      actualEndDate: project.actualEndDate,
      scheduleVarianceDays: project.endDate
        ? Math.ceil((new Date(project.endDate) - new Date()) / 86400000)
        : null,
      tasks: {
        total: tasks.total,
        done: tasks.done,
        open: tasks.total - tasks.done,
        blocked: tasks.blocked,
        overdue: tasks.overdue,
        completion: tasks.total ? Math.round((tasks.done / tasks.total) * 100) : 0,
      },
      field: {
        dailyReports: reports.reports,
        lastReportDate: reports.last,
      },
      finance: {
        contractValue: round(project.contractValue),
        estimatedCost: round(budget),
        costToDate: finance.costToDate,
        billed: finance.billed,
        collected: finance.collected,
        outstanding: finance.outstanding,
        margin: round((project.contractValue || 0) - finance.costToDate),
        budgetUsedPercent: budget ? Math.round((finance.costToDate / budget) * 100) : 0,
      },
    });
  }

  return res.status(200).json({ success: true, projects: rows });
};

/** Cash, receivables and margin over a date range. */
export const financeReport = async (req, res) => {
  requireAdmin(req);
  await refreshOverdueInvoices();
  const { from, to } = dateRange(req.query);
  const now = new Date();

  const [invoiceRows, expenseRows, agingRows, clientRows, projectRows] = await Promise.all([
    Invoice.aggregate([
      { $match: { issueDate: { $gte: from, $lte: to }, status: { $ne: "Cancelled" } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$issueDate" } },
          billed: { $sum: { $cond: [{ $in: ["$status", ["Sent", "Partially Paid", "Paid", "Overdue"]] }, "$total", 0] } },
          collected: { $sum: "$amountPaid" },
          invoices: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: from, $lte: to }, status: { $in: ["Approved", "Paid"] } } },
      {
        $group: {
          _id: { month: { $dateToString: { format: "%Y-%m", date: "$date" } }, category: "$category" },
          total: { $sum: "$totalAmount" },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]),
    Invoice.aggregate([
      {
        $match: {
          status: { $in: ["Sent", "Partially Paid", "Overdue"] },
          $expr: { $lt: ["$amountPaid", "$total"] },
        },
      },
      {
        $project: {
          outstanding: { $subtract: ["$total", "$amountPaid"] },
          ageDays: {
            $divide: [{ $subtract: [now, "$dueDate"] }, 86400000],
          },
        },
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lte: ["$ageDays", 0] }, then: "Current" },
                { case: { $lte: ["$ageDays", 30] }, then: "1-30 days" },
                { case: { $lte: ["$ageDays", 60] }, then: "31-60 days" },
                { case: { $lte: ["$ageDays", 90] }, then: "61-90 days" },
              ],
              default: "90+ days",
            },
          },
          amount: { $sum: "$outstanding" },
          count: { $sum: 1 },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: { status: { $in: ["Sent", "Partially Paid", "Paid", "Overdue"] } } },
      {
        $group: {
          _id: "$client",
          billed: { $sum: "$total" },
          collected: { $sum: "$amountPaid" },
          outstanding: {
            $sum: {
              $cond: [
                { $in: ["$status", ["Sent", "Partially Paid", "Overdue"]] },
                { $max: [0, { $subtract: ["$total", "$amountPaid"] }] },
                0,
              ],
            },
          },
        },
      },
      { $sort: { billed: -1 } },
      { $limit: 10 },
      { $lookup: { from: "clients", localField: "_id", foreignField: "_id", as: "client" } },
      { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "users", localField: "client.userId", foreignField: "_id", as: "user" } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ]),
    Project.aggregate([
      { $match: { isArchived: { $ne: true }, status: { $ne: "Cancelled" } } },
      {
        $group: {
          _id: null,
          contractValue: { $sum: "$contractValue" },
          estimatedCost: { $sum: "$estimatedCost" },
          projects: { $sum: 1 },
        },
      },
    ]),
  ]);

  const months = new Map();
  for (const row of invoiceRows) {
    months.set(row._id, {
      month: row._id,
      billed: round(row.billed),
      collected: round(row.collected),
      invoices: row.invoices,
      cost: 0,
    });
  }
  for (const row of expenseRows) {
    const key = row._id.month;
    if (!months.has(key)) {
      months.set(key, { month: key, billed: 0, collected: 0, invoices: 0, cost: 0 });
    }
    months.get(key).cost = round(months.get(key).cost + row.total);
  }

  const costByCategory = expenseRows.reduce((acc, row) => {
    acc[row._id.category] = round((acc[row._id.category] || 0) + row.total);
    return acc;
  }, {});

  const totalBilled = round(invoiceRows.reduce((sum, row) => sum + row.billed, 0));
  const totalCollected = round(invoiceRows.reduce((sum, row) => sum + row.collected, 0));
  const totalCost = round(expenseRows.reduce((sum, row) => sum + row.total, 0));

  return res.status(200).json({
    success: true,
    range: { from, to },
    summary: {
      billed: totalBilled,
      collected: totalCollected,
      cost: totalCost,
      grossMargin: round(totalCollected - totalCost),
      marginPercent: totalCollected ? Math.round(((totalCollected - totalCost) / totalCollected) * 100) : 0,
      contractValue: round(projectRows[0]?.contractValue || 0),
      estimatedCost: round(projectRows[0]?.estimatedCost || 0),
      projects: projectRows[0]?.projects || 0,
    },
    trends: [...months.values()],
    costByCategory: Object.entries(costByCategory)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
    receivablesAging: ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"].map((bucket) => {
      const row = agingRows.find((entry) => entry._id === bucket);
      return { bucket, amount: round(row?.amount || 0), count: row?.count || 0 };
    }),
    topClients: clientRows.map((row) => ({
      client: row.client?.companyName || row.user?.name || "Client",
      billed: round(row.billed),
      collected: round(row.collected),
      outstanding: round(row.outstanding),
    })),
  });
};

/** Inventory valuation per site, with low-stock counts. */
export const inventoryReport = async (req, res) => {
  requireAdmin(req);
  const rows = await StockMovement.aggregate([
    {
      $group: {
        _id: { site: "$site", material: "$material" },
        balance: {
          $sum: {
            $switch: {
              branches: [
                { case: { $eq: ["$type", "In"] }, then: { $abs: "$quantity" } },
                { case: { $eq: ["$type", "Out"] }, then: { $multiply: [{ $abs: "$quantity" }, -1] } },
              ],
              default: "$quantity",
            },
          },
        },
      },
    },
    { $lookup: { from: "materials", localField: "_id.material", foreignField: "_id", as: "material" } },
    { $unwind: { path: "$material", preserveNullAndEmptyArrays: false } },
    { $lookup: { from: "departments", localField: "_id.site", foreignField: "_id", as: "site" } },
    { $unwind: { path: "$site", preserveNullAndEmptyArrays: false } },
    {
      $project: {
        siteId: "$site._id",
        site: "$site.dep_name",
        materialId: "$material._id",
        material: "$material.name",
        sku: "$material.sku",
        unit: "$material.unit",
        balance: { $round: ["$balance", 2] },
        value: { $round: [{ $multiply: ["$balance", "$material.unitCost"] }, 2] },
        reorderLevel: "$material.reorderLevel",
      },
    },
    { $match: { balance: { $gt: 0 } } },
    { $sort: { site: 1, material: 1 } },
  ]);

  const bySite = rows.reduce((acc, row) => {
    acc[row.site] = acc[row.site] || { site: row.site, value: 0, lines: 0, lowStock: 0 };
    acc[row.site].value = round(acc[row.site].value + row.value);
    acc[row.site].lines += 1;
    if (row.balance <= (row.reorderLevel || 0)) acc[row.site].lowStock += 1;
    return acc;
  }, {});

  return res.status(200).json({
    success: true,
    summary: {
      stockValue: round(rows.reduce((sum, row) => sum + row.value, 0)),
      skus: new Set(rows.map((row) => String(row.materialId))).size,
      lines: rows.length,
      bySite: Object.values(bySite).sort((a, b) => b.value - a.value),
    },
    rows,
  });
};

/** Safety trends for the reports page. */
export const safetyReport = async (req, res) => {
  requireAdmin(req);
  const { from, to } = dateRange(req.query, 365);
  const rows = await SafetyIncident.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: "%Y-%m", date: "$date" } },
          type: "$type",
          severity: "$severity",
        },
        count: { $sum: 1 },
        lostTimeDays: { $sum: "$lostTimeDays" },
      },
    },
    { $sort: { "_id.month": 1 } },
  ]);

  const months = new Map();
  for (const row of rows) {
    const key = row._id.month;
    if (!months.has(key)) months.set(key, { month: key, incidents: 0, lostTimeDays: 0, bySeverity: {} });
    const entry = months.get(key);
    entry.incidents += row.count;
    entry.lostTimeDays += row.lostTimeDays || 0;
    entry.bySeverity[row._id.severity] = (entry.bySeverity[row._id.severity] || 0) + row.count;
  }

  const [open, critical] = await Promise.all([
    SafetyIncident.countDocuments({ status: { $in: ["Open", "Investigating"] } }),
    SafetyIncident.countDocuments({ status: { $in: ["Open", "Investigating"] }, severity: { $in: ["High", "Critical"] } }),
  ]);

  return res.status(200).json({
    success: true,
    range: { from, to },
    summary: {
      incidents: rows.reduce((sum, row) => sum + row.count, 0),
      lostTimeDays: rows.reduce((sum, row) => sum + (row.lostTimeDays || 0), 0),
      open,
      criticalOpen: critical,
    },
    trends: [...months.values()],
  });
};

/** Daily report coverage - useful for spotting sites that stopped reporting. */
export const fieldReport = async (req, res) => {
  requireAdmin(req);
  const { from, to } = dateRange(req.query, 30);

  const rows = await DailyReport.aggregate([
    { $match: { date: { $gte: from.toISOString().slice(0, 10), $lte: to.toISOString().slice(0, 10) } } },
    {
      $group: {
        _id: { project: "$project", status: "$status" },
        count: { $sum: 1 },
        workforcePresent: { $sum: "$workforce.present" },
      },
    },
  ]);

  const projects = await Project.find({ isArchived: { $ne: true } })
    .select("code name site status")
    .populate("site", "dep_name")
    .limit(200)
    .lean();

  const map = rows.reduce((acc, row) => {
    const key = String(row._id.project);
    acc[key] = acc[key] || { approved: 0, submitted: 0, draft: 0, workforce: 0 };
    acc[key][row._id.status.toLowerCase()] = row.count;
    acc[key].workforce += row.workforcePresent || 0;
    return acc;
  }, {});

  return res.status(200).json({
    success: true,
    range: { from, to },
    projects: projects.map((project) => ({
      _id: project._id,
      code: project.code,
      name: project.name,
      status: project.status,
      site: project.site?.dep_name || "—",
      reports: map[String(project._id)] || { approved: 0, submitted: 0, draft: 0, workforce: 0 },
    })),
  });
};

/* ------------------------------------------------------------------ Exports */

export const exportReport = async (req, res) => {
  requireAdmin(req);
  const type = String(req.params.type || "").toLowerCase();
  const { from, to } = dateRange(req.query);
  const stamp = new Date().toISOString().slice(0, 10);
  const rx = req.query.search ? new RegExp(escapeRegex(req.query.search), "i") : null;

  if (type === "projects") {
    const projects = await Project.find({ isArchived: { $ne: true } })
      .populate("client", "companyName entityType")
      .populate("site", "dep_name")
      .sort({ createdAt: -1 })
      .lean();
    const rows = [];
    for (const project of projects) {
      const finance = await projectFinance(project._id);
      rows.push({ ...project, finance });
    }
    return csvResponse(res, `projects-${stamp}.csv`, [
      { label: "Code", key: "code" },
      { label: "Name", key: "name" },
      { label: "Status", key: "status" },
      { label: "Health", key: "health" },
      { label: "Client", value: (r) => r.client?.companyName || r.client?.entityType || "" },
      { label: "Site", value: (r) => r.site?.dep_name || "" },
      { label: "Start", value: (r) => (r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : "") },
      { label: "End", value: (r) => (r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : "") },
      { label: "Progress %", key: "progress" },
      { label: "Contract Value", key: "contractValue" },
      { label: "Estimated Cost", key: "estimatedCost" },
      { label: "Cost To Date", value: (r) => r.finance.costToDate },
      { label: "Billed", value: (r) => r.finance.billed },
      { label: "Collected", value: (r) => r.finance.collected },
      { label: "Outstanding", value: (r) => r.finance.outstanding },
    ], rows);
  }

  if (type === "tasks") {
    const filter = {};
    if (rx) filter.title = rx;
    const tasks = await Task.find(filter)
      .populate("project", "code name")
      .populate({ path: "assignee", select: "employeeId userId", populate: { path: "userId", select: "name" } })
      .sort({ dueDate: 1 })
      .lean();
    return csvResponse(res, `tasks-${stamp}.csv`, [
      { label: "Project", value: (r) => r.project?.code || "" },
      { label: "Task", key: "title" },
      { label: "Assignee", value: (r) => r.assignee?.userId?.name || "" },
      { label: "Status", key: "status" },
      { label: "Priority", key: "priority" },
      { label: "Start", value: (r) => (r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : "") },
      { label: "Due", value: (r) => (r.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : "") },
      { label: "Estimated Hours", key: "estimatedHours" },
      { label: "Actual Hours", key: "actualHours" },
      { label: "Blocked Reason", key: "blockedReason" },
    ], tasks);
  }

  if (type === "expenses") {
    const expenses = await Expense.find({ date: { $gte: from, $lte: to } })
      .populate("project", "code name")
      .populate("site", "dep_name")
      .populate("vendor", "name")
      .sort({ date: -1 })
      .lean();
    return csvResponse(res, `expenses-${stamp}.csv`, [
      { label: "Date", value: (r) => new Date(r.date).toISOString().slice(0, 10) },
      { label: "Project", value: (r) => r.project?.code || "" },
      { label: "Site", value: (r) => r.site?.dep_name || "" },
      { label: "Category", key: "category" },
      { label: "Description", key: "description" },
      { label: "Vendor", value: (r) => r.vendor?.name || "" },
      { label: "Amount", key: "amount" },
      { label: "Tax", key: "taxAmount" },
      { label: "Total", key: "totalAmount" },
      { label: "Status", key: "status" },
    ], expenses);
  }

  if (type === "invoices") {
    await refreshOverdueInvoices();
    const invoices = await Invoice.find({ issueDate: { $gte: from, $lte: to } })
      .populate("project", "code name")
      .populate({ path: "client", select: "companyName userId", populate: { path: "userId", select: "name" } })
      .sort({ issueDate: -1 })
      .lean();
    return csvResponse(res, `invoices-${stamp}.csv`, [
      { label: "Number", key: "number" },
      { label: "Issue Date", value: (r) => new Date(r.issueDate).toISOString().slice(0, 10) },
      { label: "Due Date", value: (r) => new Date(r.dueDate).toISOString().slice(0, 10) },
      { label: "Project", value: (r) => r.project?.code || "" },
      { label: "Client", value: (r) => r.client?.companyName || r.client?.userId?.name || "" },
      { label: "Total", key: "total" },
      { label: "Paid", key: "amountPaid" },
      { label: "Outstanding", value: (r) => round(r.total - r.amountPaid) },
      { label: "Status", key: "status" },
    ], invoices);
  }

  if (type === "stock") {
    const rows = await StockMovement.aggregate([
      {
        $group: {
          _id: { site: "$site", material: "$material" },
          balance: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ["$type", "In"] }, then: { $abs: "$quantity" } },
                  { case: { $eq: ["$type", "Out"] }, then: { $multiply: [{ $abs: "$quantity" }, -1] } },
                ],
                default: "$quantity",
              },
            },
          },
        },
      },
      { $lookup: { from: "materials", localField: "_id.material", foreignField: "_id", as: "material" } },
      { $unwind: "$material" },
      { $lookup: { from: "departments", localField: "_id.site", foreignField: "_id", as: "site" } },
      { $unwind: "$site" },
      { $sort: { "site.dep_name": 1, "material.name": 1 } },
    ]);
    return csvResponse(res, `stock-${stamp}.csv`, [
      { label: "Site", value: (r) => r.site.dep_name },
      { label: "SKU", value: (r) => r.material.sku },
      { label: "Material", value: (r) => r.material.name },
      { label: "Unit", value: (r) => r.material.unit },
      { label: "On Hand", value: (r) => round(r.balance) },
      { label: "Reorder Level", value: (r) => r.material.reorderLevel },
      { label: "Unit Cost", value: (r) => r.material.unitCost },
      { label: "Value", value: (r) => round(r.balance * (r.material.unitCost || 0)) },
    ], rows);
  }

  if (type === "safety") {
    const incidents = await SafetyIncident.find({ date: { $gte: from, $lte: to } })
      .populate("project", "code name")
      .populate("site", "dep_name")
      .populate("reportedBy", "name")
      .sort({ date: -1 })
      .lean();
    return csvResponse(res, `safety-${stamp}.csv`, [
      { label: "Date", value: (r) => new Date(r.date).toISOString().slice(0, 10) },
      { label: "Project", value: (r) => r.project?.code || "" },
      { label: "Site", value: (r) => r.site?.dep_name || "" },
      { label: "Title", key: "title" },
      { label: "Type", key: "type" },
      { label: "Severity", key: "severity" },
      { label: "Status", key: "status" },
      { label: "Lost Time Days", key: "lostTimeDays" },
      { label: "Reported By", value: (r) => r.reportedBy?.name || "" },
      { label: "Corrective Action", key: "correctiveAction" },
    ], incidents);
  }

  if (type === "employees") {
    const employees = await Employee.find({})
      .populate("userId", "name email phone")
      .populate("department", "dep_name")
      .lean();
    return csvResponse(res, `employees-${stamp}.csv`, [
      { label: "Employee ID", key: "employeeId" },
      { label: "Name", value: (r) => r.userId?.name || "" },
      { label: "Email", value: (r) => r.userId?.email || "" },
      { label: "Phone", value: (r) => r.userId?.phone || "" },
      { label: "Designation", key: "designation" },
      { label: "Site", value: (r) => r.department?.dep_name || "" },
      { label: "Monthly Salary", key: "salary" },
      { label: "Active", value: (r) => (r.isActive === false ? "No" : "Yes") },
    ], employees);
  }

  throw ApiError.badRequest(
    "Unknown export type. Use projects, tasks, expenses, invoices, stock, safety or employees.",
    { code: "INVALID_EXPORT_TYPE" }
  );
};

/** Admin overview for the reports landing page. */
export const reportIndex = async (req, res) => {
  const [overview, projects, sites, employees] = await Promise.all([
    isAdmin(req.user) ? adminOverview() : Promise.resolve(null),
    isAdmin(req.user) ? Project.countDocuments({ isArchived: { $ne: true } }) : Promise.resolve(0),
    isAdmin(req.user) ? Department.countDocuments({ isArchived: { $ne: true } }) : Promise.resolve(0),
    isAdmin(req.user) ? Employee.countDocuments({ isActive: { $ne: false } }) : Promise.resolve(0),
  ]);
  return res.status(200).json({
    success: true,
    overview,
    counts: { projects, sites, employees },
  });
};

export default {
  getOverview,
  projectReport,
  financeReport,
  inventoryReport,
  safetyReport,
  fieldReport,
  exportReport,
  reportIndex,
};
