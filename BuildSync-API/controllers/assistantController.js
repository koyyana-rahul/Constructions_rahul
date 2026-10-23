import mongoose from "mongoose";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Invoice from "../models/Invoice.js";
import Expense from "../models/Expense.js";
import Material from "../models/Material.js";
import SafetyIncident from "../models/SafetyIncident.js";
import Equipment from "../models/Equipment.js";
import DailyReport from "../models/DailyReport.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import WorkRequest from "../models/Work.js";
import Notification from "../models/Notification.js";
import ApiError from "../utils/ApiError.js";
import { businessDate } from "../middleware/defaultAttendance.js";
import {
  projectVisibilityFilter,
  clientForUser,
  employeeForUser,
  isAdmin,
  escapeRegex,
} from "../services/accessService.js";
import { lowStockList } from "../services/reportService.js";
import { refreshOverdueInvoices } from "../services/invoiceService.js";
import { getOrganization } from "../services/numberingService.js";

const inr = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const num = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);

const dateText = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const WORD_BOUNDARY_GREETINGS = new Set(["hi", "hello", "hey", "help"]);

const has = (text, ...terms) =>
  terms.some((term) => {
    // Short greetings must match whole words. Substring matching made
    // "Which materials are low?" match "hi" inside "which", so the assistant
    // returned the greeting instead of the requested answer.
    if (WORD_BOUNDARY_GREETINGS.has(term)) {
      return new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`, "i").test(text);
    }
    return text.includes(term);
  });

const bullet = (lines) => lines.filter(Boolean).map((line) => `• ${line}`).join("\n");

const SUGGESTIONS = {
  admin: [
    "How are my projects performing?",
    "What is outstanding from clients?",
    "Which materials are low on stock?",
    "What needs my approval today?",
    "Show me open safety incidents",
  ],
  employee: [
    "What are my tasks for today?",
    "Which of my tasks are overdue?",
    "Is any material low on my site?",
    "What is my attendance status today?",
    "Show my projects",
  ],
  client: [
    "How is my project progressing?",
    "What do I owe on my invoices?",
    "What work is coming up?",
    "Show recent site reports",
    "What work requests are open?",
  ],
};

const scopeProjects = (user) => projectVisibilityFilter(user);

/* -------------------------------------------------------------- summaries */

const adminSnapshot = async () => {
  await refreshOverdueInvoices();
  const now = new Date();
  const soon = new Date(now.getTime() + 14 * 86400000);

  const [
    activeProjects,
    delayedProjects,
    openTasks,
    overdueTasks,
    invoiceAgg,
    lowStock,
    safetyOpen,
    equipmentInUse,
    pendingLeave,
    pendingWork,
    unread,
  ] = await Promise.all([
    Project.countDocuments({ isArchived: { $ne: true }, status: { $in: ["Planning", "Mobilisation", "In Progress", "On Hold"] } }),
    Project.countDocuments({
      isArchived: { $ne: true },
      status: { $in: ["Planning", "Mobilisation", "In Progress", "On Hold"] },
      $or: [{ health: "Delayed" }, { endDate: { $lt: now } }],
    }),
    Task.countDocuments({ status: { $ne: "Done" } }),
    Task.countDocuments({ status: { $ne: "Done" }, dueDate: { $lt: now } }),
    Invoice.aggregate([
      { $match: { status: { $in: ["Sent", "Partially Paid", "Overdue"] } } },
      {
        $group: {
          _id: null,
          outstanding: { $sum: { $max: [0, { $subtract: ["$total", "$amountPaid"] }] } },
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $lt: ["$dueDate", now] }, { $lt: ["$amountPaid", "$total"] }] },
                { $subtract: ["$total", "$amountPaid"] },
                0,
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    lowStockList(),
    SafetyIncident.countDocuments({ status: { $in: ["Open", "Investigating"] } }),
    Equipment.countDocuments({ status: "In Use" }),
    Leave.countDocuments({ status: "Pending" }),
    WorkRequest.countDocuments({ status: { $in: ["Pending", "Under Review"] } }),
    Notification.countDocuments({ user: null, readAt: null }),
  ]);

  const finance = invoiceAgg[0] || { outstanding: 0, overdue: 0, count: 0 };
  const deadlines = await Project.find({
    isArchived: { $ne: true },
    status: { $in: ["Planning", "Mobilisation", "In Progress", "On Hold"] },
    endDate: { $gte: now, $lte: soon },
  })
    .select("code name endDate progress")
    .sort({ endDate: 1 })
    .limit(3)
    .lean();

  return {
    activeProjects,
    delayedProjects,
    openTasks,
    overdueTasks,
    outstanding: finance.outstanding,
    overdueAmount: finance.overdue,
    openInvoices: finance.count,
    lowStock,
    safetyOpen,
    equipmentInUse,
    pendingApprovals: pendingLeave + pendingWork,
    unread,
    deadlines,
  };
};

const employeeSnapshot = async (user) => {
  const employee = await employeeForUser(user._id);
  if (!employee) return null;
  const today = businessDate();
  const now = new Date();

  const [taskAgg, nextTasks, attendance, pendingLeave, projects, lowStock] = await Promise.all([
    Task.aggregate([
      { $match: { assignee: employee._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ["$status", "Done"] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$status", "Done"] }, { $lt: ["$dueDate", now] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Task.find({ assignee: employee._id, status: { $ne: "Done" } })
      .populate("project", "code name")
      .select("title dueDate priority status project")
      .sort({ dueDate: 1 })
      .limit(4)
      .lean(),
    Attendance.findOne({ employeeId: employee._id, date: today }).select("status").lean(),
    Leave.countDocuments({ employeeId: employee._id, status: "Pending" }),
    Project.find({
      isArchived: { $ne: true },
      $or: [{ team: employee._id }, { manager: employee._id }, { site: employee.department }],
    })
      .select("code name status progress endDate")
      .sort({ endDate: 1 })
      .limit(4)
      .lean(),
    lowStockList(employee.department),
  ]);

  const tasks = taskAgg[0] || { total: 0, done: 0, overdue: 0 };

  return {
    employee,
    tasks,
    nextTasks,
    attendance: attendance?.status || "Not marked",
    pendingLeave,
    projects,
    lowStock,
  };
};

const clientSnapshot = async (user) => {
  await refreshOverdueInvoices();
  const client = await clientForUser(user._id);
  if (!client) return null;
  const now = new Date();

  const [projects, invoiceAgg, requests, reports] = await Promise.all([
    Project.find({ client: client._id, isArchived: { $ne: true } })
      .populate("site", "dep_name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Invoice.aggregate([
      { $match: { client: client._id, status: { $nin: ["Draft", "Cancelled"] } } },
      {
        $group: {
          _id: null,
          billed: { $sum: "$total" },
          paid: { $sum: "$amountPaid" },
          outstanding: {
            $sum: {
              $cond: [
                { $in: ["$status", ["Sent", "Partially Paid", "Overdue"]] },
                { $max: [0, { $subtract: ["$total", "$amountPaid"] }] },
                0,
              ],
            },
          },
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $lt: ["$dueDate", now] }, { $lt: ["$amountPaid", "$total"] }, { $in: ["$status", ["Sent", "Partially Paid", "Overdue"]] }] },
                { $subtract: ["$total", "$amountPaid"] },
                0,
              ],
            },
          },
        },
      },
    ]),
    WorkRequest.find({ clientId: client._id, status: { $nin: ["Closed", "Cancelled", "Rejected"] } })
      .select("name status startDate endDate")
      .sort({ appliedAt: -1 })
      .limit(4)
      .lean(),
    DailyReport.find({ project: { $in: projects.map((p) => p._id) }, status: "Approved" })
      .populate("project", "code name")
      .select("date workCompleted project weather")
      .sort({ date: -1 })
      .limit(3)
      .lean(),
  ]);

  const finance = invoiceAgg[0] || { billed: 0, paid: 0, outstanding: 0, overdue: 0 };
  return { client, projects, finance, requests, reports };
};

const financeSummary = async (user) => {
  await refreshOverdueInvoices();
  const now = new Date();

  if (user.role === "client") {
    const client = await clientForUser(user._id);
    if (!client) return "No client profile is linked to this account yet.";
    const agg = await Invoice.aggregate([
      { $match: { client: client._id, status: { $nin: ["Draft", "Cancelled"] } } },
      {
        $group: {
          _id: null,
          billed: { $sum: "$total" },
          paid: { $sum: "$amountPaid" },
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
    ]);
    const row = agg[0] || { billed: 0, paid: 0, outstanding: 0 };
    return [
      "Your account at a glance:",
      bullet([
        `Billed: ${inr(row.billed)}`,
        `Paid: ${inr(row.paid)}`,
        `Outstanding: ${inr(row.outstanding)}`,
        "Open the Invoices page for the full ledger and due dates.",
      ]),
    ].join("\n");
  }

  if (!isAdmin(user)) {
    return "Commercial figures are only available to administrators and the client who owns the invoice.";
  }

  const [invoiceAgg, expenseAgg, lowCount] = await Promise.all([
    Invoice.aggregate([
      { $match: { status: { $nin: ["Draft", "Cancelled"] } } },
      {
        $group: {
          _id: null,
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
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $lt: ["$dueDate", now] }, { $lt: ["$amountPaid", "$total"] }] },
                { $subtract: ["$total", "$amountPaid"] },
                0,
              ],
            },
          },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { status: { $in: ["Approved", "Paid"] } } },
      { $group: { _id: null, cost: { $sum: "$totalAmount" }, paid: { $sum: { $cond: [{ $eq: ["$status", "Paid"] }, "$totalAmount", 0] } } } },
    ]),
    lowStockList(),
  ]);

  const invoice = invoiceAgg[0] || { billed: 0, collected: 0, outstanding: 0, overdue: 0 };
  const expense = expenseAgg[0] || { cost: 0, paid: 0 };
  const margin = invoice.collected - expense.paid;

  return [
    "Company financial position:",
    bullet([
      `Billed: ${inr(invoice.billed)}`,
      `Collected: ${inr(invoice.collected)}`,
      `Outstanding: ${inr(invoice.outstanding)}${invoice.overdue ? ` (${inr(invoice.overdue)} overdue)` : ""}`,
      `Approved cost to date: ${inr(expense.cost)} (${inr(expense.paid)} paid)`,
      `Cash margin collected: ${inr(margin)}`,
      `${num(lowCount.length)} material(s) at or below reorder level`,
    ]),
  ].join("\n");
};

const safetySummary = async (user) => {
  const filter = {};
  if (user.role === "employee") {
    const employee = await employeeForUser(user._id);
    filter.site = employee?.department || null;
  } else if (!isAdmin(user)) {
    return "Safety records are only visible to the contractor's team.";
  }

  const [open, critical, recent] = await Promise.all([
    SafetyIncident.countDocuments({ ...filter, status: { $in: ["Open", "Investigating"] } }),
    SafetyIncident.countDocuments({ ...filter, status: { $in: ["Open", "Investigating"] }, severity: { $in: ["High", "Critical"] } }),
    SafetyIncident.find(filter).select("title severity status date type").sort({ date: -1 }).limit(3).lean(),
  ]);

  return [
    `Safety: ${num(open)} open incident(s), ${num(critical)} high or critical.`,
    recent.length
      ? bullet(
          recent.map(
            (incident) =>
              `${incident.title} — ${incident.severity} ${incident.type}, ${incident.status}, ${dateText(incident.date)}`
          )
        )
      : "No incidents have been reported yet.",
  ].join("\n");
};

const inventorySummary = async (user) => {
  if (user.role === "client") return "Inventory is internal to the contractor's site operations.";
  const site = user.role === "employee" ? (await employeeForUser(user._id))?.department : null;
  const low = await lowStockList(site || null);

  if (!low.length) {
    return site
      ? "Every material on your site is above its reorder level."
      : "No material is currently at or below its reorder level.";
  }

  return [
    `${num(low.length)} material/site line(s) need attention:`,
    bullet(
      low.slice(0, 6).map(
        (row) => `${row.name} at ${row.site}: ${row.balance} ${row.unit} on hand (reorder at ${row.reorderLevel})`
      )
    ),
  ].join("\n");
};

const attendanceSummary = async (user) => {
  if (user.role === "client") return "Attendance is internal to the contractor's workforce.";
  const today = businessDate();

  if (user.role === "employee") {
    const employee = await employeeForUser(user._id);
    if (!employee) return "No employee profile is linked to this account.";
    const attendance = await Attendance.findOne({ employeeId: employee._id, date: today }).select("status").lean();
    return attendance?.status
      ? `Your attendance today (${today}) is marked as ${attendance.status}.`
      : `Your attendance for ${today} has not been marked yet.`;
  }

  const rows = await Attendance.aggregate([
    { $match: { date: today } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const present = rows.find((r) => r._id === "Present")?.count || 0;
  const absent = rows.find((r) => r._id === "Absent")?.count || 0;
  const unmarked = await Attendance.countDocuments({ date: today, status: null });

  return [
    `Attendance for ${today}:`,
    bullet([
      `Present: ${num(present)}`,
      `Absent: ${num(absent)}`,
      `Not marked: ${num(unmarked)}`,
    ]),
  ].join("\n");
};

const approvalsSummary = async (user) => {
  if (!isAdmin(user)) return "Approvals are handled by your administrator.";
  const [leave, work, expenses] = await Promise.all([
    Leave.find({ status: "Pending" })
      .populate({ path: "employeeId", select: "employeeId userId", populate: { path: "userId", select: "name" } })
      .select("leaveType startDate endDate employeeId")
      .sort({ appliedAt: -1 })
      .limit(4)
      .lean(),
    WorkRequest.find({ status: { $in: ["Pending", "Under Review"] } })
      .populate({ path: "clientId", select: "companyName userId", populate: { path: "userId", select: "name" } })
      .select("name status startDate clientId")
      .sort({ appliedAt: -1 })
      .limit(4)
      .lean(),
    Expense.countDocuments({ status: "Pending" }),
  ]);

  return [
    `You have ${num(leave.length ? await Leave.countDocuments({ status: "Pending" }) : 0)} leave request(s), ${num(
      await WorkRequest.countDocuments({ status: { $in: ["Pending", "Under Review"] } })
    )} work request(s) and ${num(expenses)} expense(s) waiting for a decision.`,
    leave.length
      ? bullet(
          leave.map(
            (item) =>
              `${item.employeeId?.userId?.name || "Employee"} — ${item.leaveType}, ${dateText(item.startDate)} to ${dateText(item.endDate)}`
          )
        )
      : "No leave requests are pending.",
    work.length
      ? bullet(
          work.map(
            (request) =>
              `${request.name} — ${request.clientId?.companyName || request.clientId?.userId?.name || "Client"}, ${request.status}`
          )
        )
      : "No work requests are pending.",
  ].join("\n");
};

const tasksSummary = async (user) => {
  if (user.role === "client") return "Tasks are internal to the contractor's team.";
  const now = new Date();
  const filter = {};
  if (user.role === "employee") {
    const employee = await employeeForUser(user._id);
    filter.assignee = employee?._id || null;
  }

  const [total, open, overdue, dueSoon, next] = await Promise.all([
    Task.countDocuments(filter),
    Task.countDocuments({ ...filter, status: { $ne: "Done" } }),
    Task.countDocuments({ ...filter, status: { $ne: "Done" }, dueDate: { $lt: now } }),
    Task.countDocuments({
      ...filter,
      status: { $ne: "Done" },
      dueDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 86400000) },
    }),
    Task.find({ ...filter, status: { $ne: "Done" } })
      .populate("project", "code name")
      .select("title dueDate priority status project")
      .sort({ dueDate: 1 })
      .limit(4)
      .lean(),
  ]);

  return [
    user.role === "employee" ? "Your task board:" : "Task board:",
    bullet([
      `${num(total)} total, ${num(open)} open, ${num(overdue)} overdue, ${num(dueSoon)} due in the next 7 days`,
    ]),
    next.length
      ? bullet(
          next.map(
            (task) =>
              `${task.title} — ${task.project?.code || "Project"}, ${task.status}, ${task.priority}${task.dueDate ? `, due ${dateText(task.dueDate)}` : ""}`
          )
        )
      : "Nothing is assigned right now.",
  ].join("\n");
};

const projectsSummary = async (user) => {
  const visibility = await scopeProjects(user);
  const now = new Date();
  const projects = await Project.find({ ...visibility, isArchived: { $ne: true } })
    .select("code name status health progress endDate")
    .sort({ endDate: 1 })
    .limit(6)
    .lean();

  if (!projects.length) {
    return user.role === "client"
      ? "You do not have a project with the contractor yet. A project is created once your work request is accepted."
      : "No projects are visible to your account yet.";
  }

  return [
    user.role === "client" ? "Your projects:" : "Projects in flight:",
    bullet(
      projects.map((project) => {
        const late = project.endDate && new Date(project.endDate) < now && !["Completed", "Handover", "Closed", "Cancelled"].includes(project.status);
        return `${project.code} ${project.name} — ${project.status}, ${project.progress || 0}% complete${
          project.health ? `, ${project.health}` : ""
        }${late ? ", past due" : ""}`;
      })
    ),
  ].join("\n");
};

const dailyReportsSummary = async (user) => {
  const visibility = await scopeProjects(user);
  const projectIds = (await Project.find({ ...visibility }).select("_id").lean()).map((p) => p._id);
  const filter =
    user.role === "client"
      ? { project: { $in: projectIds }, status: "Approved" }
      : { project: { $in: projectIds } };

  const reports = await DailyReport.find(filter)
    .populate("project", "code name")
    .select("date workCompleted weather status project")
    .sort({ date: -1 })
    .limit(3)
    .lean();

  if (!reports.length) {
    return user.role === "client"
      ? "No approved site reports have been shared with you yet."
      : "No daily reports have been filed yet.";
  }

  return [
    user.role === "client" ? "Recent approved site reports:" : "Latest daily reports:",
    bullet(
      reports.map(
        (report) =>
          `${report.project?.code || "Project"} · ${dateText(report.date)} — ${report.workCompleted.slice(0, 140)}${
            report.workCompleted.length > 140 ? "…" : ""
          }`
      )
    ),
  ].join("\n");
};

const equipmentSummary = async (user) => {
  if (user.role === "client") return "Equipment is internal to the contractor's operations.";
  const filter = {};
  if (user.role === "employee") {
    const employee = await employeeForUser(user._id);
    filter.site = employee?.department || null;
  }
  const [total, inUse, maintenance, breakdown] = await Promise.all([
    Equipment.countDocuments({ ...filter, status: { $ne: "Retired" } }),
    Equipment.countDocuments({ ...filter, status: "In Use" }),
    Equipment.countDocuments({ ...filter, status: "Maintenance" }),
    Equipment.countDocuments({ ...filter, status: "Breakdown" }),
  ]);

  return [
    "Equipment status:",
    bullet([
      `${num(total)} unit(s) on the register`,
      `${num(inUse)} in use`,
      `${num(maintenance)} in maintenance`,
      `${num(breakdown)} out of service`,
    ]),
  ].join("\n");
};

const findProjectAnswer = async (user, message) => {
  const visibility = await scopeProjects(user);
  const rx = new RegExp(escapeRegex(message.replace(/[^a-z0-9\s-]/gi, " ").trim()), "i");
  if (!message.trim()) return null;

  const candidates = await Project.find({ ...visibility, $or: [{ name: rx }, { code: rx }] })
    .populate("site", "dep_name")
    .select("code name status health progress startDate endDate contractValue estimatedCost site milestones description")
    .limit(3)
    .lean();

  const project = candidates.length === 1 ? candidates[0] : null;
  if (!project) return null;

  if (user.role === "employee") {
    return [
      `${project.code} ${project.name}`,
      bullet([
        `Status: ${project.status}${project.health ? ` (${project.health})` : ""}`,
        `Progress: ${project.progress || 0}%`,
        `Site: ${project.site?.dep_name || "—"}`,
        `Schedule: ${dateText(project.startDate)} → ${dateText(project.endDate)}`,
      ]),
    ].join("\n");
  }

  return [
    `${project.code} ${project.name}`,
    bullet([
      `Status: ${project.status}${project.health ? ` (${project.health})` : ""}`,
      `Progress: ${project.progress || 0}%`,
      `Site: ${project.site?.dep_name || "—"}`,
      `Schedule: ${dateText(project.startDate)} → ${dateText(project.endDate)}`,
      user.role === "client" ? null : `Contract value: ${inr(project.contractValue)}`,
      user.role === "client" ? null : `Estimated cost: ${inr(project.estimatedCost)}`,
    ]),
  ].join("\n");
};

const overviewAnswer = async (user) => {
  if (isAdmin(user)) {
    const snapshot = await adminSnapshot();
    return [
      "Here is the live operational picture:",
      bullet([
        `${num(snapshot.activeProjects)} active project(s), ${num(snapshot.delayedProjects)} behind schedule`,
        `${num(snapshot.openTasks)} open task(s), ${num(snapshot.overdueTasks)} overdue`,
        `${inr(snapshot.outstanding)} outstanding from clients${snapshot.overdueAmount ? `, ${inr(snapshot.overdueAmount)} overdue` : ""}`,
        `${num(snapshot.pendingApprovals)} approval(s) waiting`,
        `${num(snapshot.safetyOpen)} open safety incident(s)`,
        `${num(snapshot.lowStock.length)} low-stock line(s)`,
      ]),
      snapshot.deadlines.length
        ? `Next project deadlines: ${snapshot.deadlines
            .map((project) => `${project.code} on ${dateText(project.endDate)}`)
            .join(", ")}.`
        : "No project deadlines in the next two weeks.",
    ].join("\n");
  }

  if (user.role === "employee") {
    const snapshot = await employeeSnapshot(user);
    if (!snapshot) return "No employee profile is linked to this account yet.";
    return [
      "Here is your day:",
      bullet([
        `Attendance: ${snapshot.attendance}`,
        `${num(snapshot.tasks.total - snapshot.tasks.done)} open task(s), ${num(snapshot.tasks.overdue)} overdue`,
        `${num(snapshot.lowStock.length)} low-stock line(s) on your site`,
        `${num(snapshot.pendingLeave)} leave request(s) pending`,
        snapshot.projects.length
          ? `Projects: ${snapshot.projects.map((project) => `${project.code} (${project.status})`).join(", ")}`
          : "No project is assigned to you yet",
      ]),
      snapshot.nextTasks.length
        ? `Next up: ${snapshot.nextTasks
            .map((task) => `${task.title}${task.dueDate ? ` (due ${dateText(task.dueDate)})` : ""}`)
            .join("; ")}.`
        : "You have no open tasks.",
    ].join("\n");
  }

  const snapshot = await clientSnapshot(user);
  if (!snapshot) return "No client profile is linked to this account yet.";
  return [
    "Here is where your project stands:",
    bullet([
      snapshot.projects.length
        ? `Projects: ${snapshot.projects.map((project) => `${project.name} (${project.status}, ${project.progress || 0}%)`).join("; ")}`
        : "No project has been created yet",
      `Billed: ${inr(snapshot.finance.billed)}, paid: ${inr(snapshot.finance.paid)}, outstanding: ${inr(snapshot.finance.outstanding)}`,
      `${num(snapshot.requests.length)} open work request(s)`,
      `${num(snapshot.reports.length)} recent approved site report(s)`,
    ]),
  ].join("\n");
};

/* ------------------------------------------------------------------ handler */

export const chat = async (req, res) => {
  const message = String(req.body.message || "").trim();
  if (!message) throw ApiError.badRequest("Type a question for the assistant", { code: "MISSING_FIELD" });
  if (message.length > 1000) {
    throw ApiError.badRequest("Please keep the question under 1000 characters", { code: "MESSAGE_TOO_LONG" });
  }

  const text = message.toLowerCase();
  const user = req.user;
  const suggestions = SUGGESTIONS[user.role] || SUGGESTIONS.employee;
  let reply;

  if (has(text, "hi", "hello", "hey", "help", "what can you do", "who are you")) {
    const organization = await getOrganization();
    reply = [
      `Hi ${user.name?.split(" ")[0] || "there"} — I'm Benny, ${organization.name}'s operations assistant.`,
      "I answer from your live Builtra data, scoped to your role. I can help with:",
      bullet([
        "Projects, progress and overdue work",
        "Tasks and what is due",
        "Invoices, payments and outstanding balances",
        "Materials, stock and low-stock alerts",
        "Safety incidents and equipment",
        "Attendance, leave and pending approvals",
        "Daily site reports",
      ]),
      "Ask me a question in plain language.",
    ].join("\n");
  } else if (has(text, "approval", "approve", "pending decision", "waiting for me", "needs my")) {
    reply = await approvalsSummary(user);
  } else if (has(text, "invoice", "payment", "outstanding", "receivable", "billed", "collection", "cash", "revenue", "margin", "budget", "expense", "cost")) {
    reply = await financeSummary(user);
  } else if (has(text, "stock", "inventory", "material", "reorder", "low on")) {
    reply = await inventorySummary(user);
  } else if (has(text, "safety", "incident", "accident", "near miss", "hazard")) {
    reply = await safetySummary(user);
  } else if (has(text, "attendance", "present today", "absent", "marked")) {
    reply = await attendanceSummary(user);
  } else if (has(text, "equipment", "machine", "plant", "crane", "excavator")) {
    reply = await equipmentSummary(user);
  } else if (has(text, "daily report", "site report", "progress report", "dpr", "what happened on site")) {
    reply = await dailyReportsSummary(user);
  } else if (has(text, "task", "to do", "todo", "due today", "overdue task", "assigned to me", "my work")) {
    reply = await tasksSummary(user);
  } else if (has(text, "project", "job", "site progress", "behind schedule", "deadline")) {
    const specific = await findProjectAnswer(user, message);
    reply = specific || (has(text, "deadline", "behind", "late", "overdue") ? await projectsSummary(user) : await projectsSummary(user));
  } else {
    const specific = await findProjectAnswer(user, message);
    reply = specific || (await overviewAnswer(user));
  }

  return res.status(200).json({
    success: true,
    reply,
    suggestions,
    role: user.role,
    grounded: true,
    generatedAt: new Date().toISOString(),
  });
};

export default { chat };
