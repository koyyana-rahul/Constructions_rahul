import mongoose from "mongoose";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Invoice from "../models/Invoice.js";
import Expense from "../models/Expense.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import Attendance from "../models/Attendance.js";
import SafetyIncident from "../models/SafetyIncident.js";
import Equipment from "../models/Equipment.js";
import Material from "../models/Material.js";
import StockMovement from "../models/StockMovement.js";
import DailyReport from "../models/DailyReport.js";
import Leave from "../models/Leave.js";
import Salary from "../models/Salary.js";
import { businessDate } from "../middleware/defaultAttendance.js";
import { clientForUser, employeeForUser, projectVisibilityFilter } from "./accessService.js";

const ACTIVE_PROJECT_STATUSES = ["Planning", "Mobilisation", "In Progress", "On Hold"];
const BILLABLE_INVOICE_STATUSES = ["Sent", "Partially Paid", "Paid", "Overdue"];
const COSTED_EXPENSE_STATUSES = ["Approved", "Paid"];

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

const monthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const lastMonths = (count = 6) => {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: monthKey(d),
      label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    });
  }
  return out;
};

/** Financial headline for one project, shared by the detail page and reports. */
export const projectFinance = async (projectIds) => {
  const ids = (Array.isArray(projectIds) ? projectIds : [projectIds])
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(id));

  if (!ids.length) {
    return {
      costToDate: 0,
      pendingCost: 0,
      billed: 0,
      collected: 0,
      outstanding: 0,
      expenseCount: 0,
      invoiceCount: 0,
    };
  }

  const [expenseRows, invoiceRows] = await Promise.all([
    Expense.aggregate([
      { $match: { project: { $in: ids } } },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: { project: { $in: ids }, status: { $ne: "Cancelled" } } },
      {
        $group: {
          _id: null,
          billed: {
            $sum: {
              $cond: [{ $in: ["$status", BILLABLE_INVOICE_STATUSES] }, "$total", 0],
            },
          },
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
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const byStatus = expenseRows.reduce((acc, row) => {
    acc[row._id] = { total: row.total || 0, count: row.count || 0 };
    return acc;
  }, {});

  const costToDate = (byStatus.Approved?.total || 0) + (byStatus.Paid?.total || 0);
  const pendingCost = byStatus.Pending?.total || 0;

  return {
    costToDate: round(costToDate),
    pendingCost: round(pendingCost),
    paidCost: round(byStatus.Paid?.total || 0),
    billed: round(invoiceRows[0]?.billed || 0),
    collected: round(invoiceRows[0]?.collected || 0),
    outstanding: round(invoiceRows[0]?.outstanding || 0),
    expenseCount: expenseRows.reduce((sum, row) => sum + row.count, 0),
    invoiceCount: invoiceRows[0]?.count || 0,
  };
};

/**
 * Enriched project document used by the detail page.
 *
 * Financial visibility is role-aware: an administrator sees cost and margin,
 * a client sees only what they are billed and have paid, and an employee sees
 * no commercial figures at all.
 */
export const projectDetailPayload = async (project, { role = "admin" } = {}) => {
  const [finance, taskRows, reportCount, team] = await Promise.all([
    projectFinance(project._id),
    Task.aggregate([
      { $match: { project: project._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          estimatedHours: { $sum: "$estimatedHours" },
          actualHours: { $sum: "$actualHours" },
        },
      },
    ]),
    DailyReport.countDocuments({ project: project._id }),
    project.team?.length
      ? Employee.find({ _id: { $in: project.team } })
          .populate("userId", "name email profileImage")
          .select("employeeId designation department userId")
          .lean()
      : [],
  ]);

  const tasks = taskRows.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  const totalTasks = Object.values(tasks).reduce((sum, value) => sum + value, 0);
  const doneTasks = tasks.Done || 0;

  const payload = {
    ...project.toObject(),
    taskSummary: {
      total: totalTasks,
      open: totalTasks - doneTasks,
      done: doneTasks,
      blocked: tasks.Blocked || 0,
      inProgress: tasks["In Progress"] || 0,
      completion: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0,
      estimatedHours: taskRows.reduce((sum, row) => sum + (row.estimatedHours || 0), 0),
      actualHours: taskRows.reduce((sum, row) => sum + (row.actualHours || 0), 0),
    },
    dailyReportCount: reportCount,
    teamMembers: team,
  };

  if (role === "admin") {
    payload.finance = finance;
    payload.budget = {
      contractValue: round(project.contractValue),
      estimatedCost: round(project.estimatedCost),
      costToDate: finance.costToDate,
      remainingBudget: round((project.estimatedCost || 0) - finance.costToDate),
      usedPercent: project.estimatedCost
        ? Math.round((finance.costToDate / project.estimatedCost) * 100)
        : 0,
      margin: round((project.contractValue || 0) - finance.costToDate),
    };
  } else if (role === "client") {
    payload.finance = {
      billed: finance.billed,
      collected: finance.collected,
      outstanding: finance.outstanding,
      invoiceCount: finance.invoiceCount,
    };
    payload.budget = {
      contractValue: round(project.contractValue),
    };
    delete payload.estimatedCost;
  } else {
    delete payload.estimatedCost;
    delete payload.contractValue;
  }

  return payload;
};

/* --------------------------------------------------------------- Admin view */

export const adminOverview = async () => {
  const now = new Date();
  const today = businessDate();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const soon = new Date(now.getTime() + 14 * 86400000);
  const weekAhead = new Date(now.getTime() + 7 * 86400000);

  const [
    projectStatusAgg,
    activeProjects,
    contractAgg,
    taskAgg,
    invoiceAgg,
    overdueInvoiceAgg,
    expenseAgg,
    attendanceAgg,
    activeEmployees,
    totalEmployees,
    sites,
    safetyOpen,
    safetyCritical,
    safetyThisMonth,
    equipmentAgg,
    lowStockRows,
    upcomingProjects,
    dueTasks,
    pendingLeave,
    pendingWork,
    months,
    monthlyInvoices,
    monthlyExpenses,
    expenseByCategory,
  ] = await Promise.all([
    Project.aggregate([
      { $match: { isArchived: { $ne: true } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Project.countDocuments({
      isArchived: { $ne: true },
      status: { $in: ACTIVE_PROJECT_STATUSES },
    }),
    Project.aggregate([
      { $match: { isArchived: { $ne: true }, status: { $ne: "Cancelled" } } },
      {
        $group: {
          _id: null,
          contractValue: { $sum: "$contractValue" },
          estimatedCost: { $sum: "$estimatedCost" },
          count: { $sum: 1 },
        },
      },
    ]),
    Task.aggregate([
      { $match: {} },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ["$status", "Done"] }, 1, 0] } },
          blocked: { $sum: { $cond: [{ $eq: ["$status", "Blocked"] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$status", "Done"] },
                    { $lt: ["$dueDate", now] },
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
    Invoice.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      {
        $group: {
          _id: null,
          billed: {
            $sum: { $cond: [{ $in: ["$status", BILLABLE_INVOICE_STATUSES] }, "$total", 0] },
          },
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
    ]),
    Invoice.aggregate([
      {
        $match: {
          status: { $in: ["Sent", "Partially Paid", "Overdue"] },
          dueDate: { $lt: now },
          $expr: { $lt: ["$amountPaid", "$total"] },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: { $subtract: ["$total", "$amountPaid"] } },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { status: { $in: COSTED_EXPENSE_STATUSES } } },
      {
        $group: {
          _id: null,
          cost: { $sum: "$totalAmount" },
          paid: { $sum: { $cond: [{ $eq: ["$status", "Paid"] }, "$totalAmount", 0] } },
        },
      },
    ]),
    Attendance.aggregate([
      { $match: { date: today, status: { $ne: null } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Employee.countDocuments({ isActive: { $ne: false } }),
    Employee.countDocuments({}),
    Department.countDocuments({ isArchived: { $ne: true } }),
    SafetyIncident.countDocuments({ status: { $in: ["Open", "Investigating"] } }),
    SafetyIncident.countDocuments({
      status: { $in: ["Open", "Investigating"] },
      severity: { $in: ["High", "Critical"] },
    }),
    SafetyIncident.countDocuments({ date: { $gte: monthStart } }),
    Equipment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    lowStockList(),
    Project.find({
      isArchived: { $ne: true },
      status: { $in: ACTIVE_PROJECT_STATUSES },
      endDate: { $gte: now, $lte: soon },
    })
      .select("code name endDate status progress health")
      .sort({ endDate: 1 })
      .limit(7)
      .lean(),
    Task.find({ status: { $ne: "Done" }, dueDate: { $gte: now, $lte: weekAhead } })
      .populate("project", "code name")
      .populate({ path: "assignee", populate: { path: "userId", select: "name" } })
      .select("title dueDate priority status project assignee")
      .sort({ dueDate: 1 })
      .limit(7)
      .lean(),
    Leave.countDocuments({ status: "Pending" }),
    (async () => {
      const WorkRequest = (await import("../models/Work.js")).default;
      return WorkRequest.countDocuments({ status: { $in: ["Pending", "Under Review"] } });
    })(),
    Promise.resolve(lastMonths(6)),
    Invoice.aggregate([
      { $match: { status: { $in: BILLABLE_INVOICE_STATUSES } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$issueDate" } },
          billed: { $sum: "$total" },
          collected: { $sum: "$amountPaid" },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { status: { $in: COSTED_EXPENSE_STATUSES } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          cost: { $sum: "$totalAmount" },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { status: { $in: COSTED_EXPENSE_STATUSES } } },
      { $group: { _id: "$category", total: { $sum: "$totalAmount" } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const statusCount = (agg, status) => agg.find((row) => row._id === status)?.count || 0;
  const attendance = attendanceAgg.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});
  const marked = Object.values(attendance).reduce((sum, value) => sum + value, 0);
  const present = attendance.Present || 0;

  const task = taskAgg[0] || { total: 0, done: 0, blocked: 0, overdue: 0 };
  const invoice = invoiceAgg[0] || { billed: 0, collected: 0, outstanding: 0 };
  const expense = expenseAgg[0] || { cost: 0, paid: 0 };

  const monthlyMap = new Map(
    months.map((month) => [month.key, { ...month, billed: 0, collected: 0, cost: 0 }])
  );
  for (const row of monthlyInvoices) {
    if (monthlyMap.has(row._id)) {
      const entry = monthlyMap.get(row._id);
      entry.billed = round(row.billed);
      entry.collected = round(row.collected);
    }
  }
  for (const row of monthlyExpenses) {
    if (monthlyMap.has(row._id)) monthlyMap.get(row._id).cost = round(row.cost);
  }

  const equipment = equipmentAgg.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});
  const equipmentTotal = Object.values(equipment).reduce((sum, value) => sum + value, 0);

  const delayedProjects = await Project.countDocuments({
    isArchived: { $ne: true },
    status: { $in: ACTIVE_PROJECT_STATUSES },
    $or: [{ health: "Delayed" }, { endDate: { $lt: now } }],
  });

  return {
    generatedAt: now.toISOString(),
    currency: "INR",

    projects: {
      active: activeProjects,
      delayed: delayedProjects,
      total: contractAgg[0]?.count || 0,
      byStatus: projectStatusAgg.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {}),
      contractValue: round(contractAgg[0]?.contractValue || 0),
      estimatedCost: round(contractAgg[0]?.estimatedCost || 0),
    },

    tasks: {
      total: task.total,
      open: task.total - task.done,
      done: task.done,
      blocked: task.blocked,
      overdue: task.overdue,
      completion: task.total ? Math.round((task.done / task.total) * 100) : 0,
    },

    finance: {
      billed: round(invoice.billed),
      collected: round(invoice.collected),
      outstanding: round(invoice.outstanding),
      overdue: {
        count: overdueInvoiceAgg[0]?.count || 0,
        amount: round(overdueInvoiceAgg[0]?.amount || 0),
      },
      costToDate: round(expense.cost),
      costPaid: round(expense.paid),
      grossMarginCollected: round(invoice.collected - expense.paid),
      marginPercent:
        invoice.collected > 0
          ? Math.round(((invoice.collected - expense.paid) / invoice.collected) * 100)
          : 0,
    },

    workforce: {
      totalEmployees,
      activeEmployees,
      sites,
      presentToday: present,
      markedToday: marked,
      unmarkedToday: Math.max(0, activeEmployees - marked),
      attendanceRate: marked ? Math.round((present / marked) * 100) : 0,
    },

    safety: {
      openIncidents: safetyOpen,
      criticalOpen: safetyCritical,
      thisMonth: safetyThisMonth,
    },

    inventory: {
      lowStockCount: lowStockRows.length,
      lowStock: lowStockRows.slice(0, 8),
    },

    equipment: {
      total: equipmentTotal,
      inUse: equipment["In Use"] || 0,
      maintenance: equipment.Maintenance || 0,
      breakdown: equipment.Breakdown || 0,
      utilization: equipmentTotal
        ? Math.round(((equipment["In Use"] || 0) / equipmentTotal) * 100)
        : 0,
      byStatus: equipment,
    },

    approvals: {
      leave: pendingLeave,
      workRequests: pendingWork,
      total: pendingLeave + pendingWork,
    },

    payrollCommitment: await Employee.aggregate([
      { $match: { isActive: { $ne: false } } },
      { $group: { _id: null, total: { $sum: "$salary" } } },
    ]).then((rows) => round(rows[0]?.total || 0)),

    upcoming: {
      projectDeadlines: upcomingProjects,
      taskDeadlines: dueTasks,
    },

    trends: {
      months: [...monthlyMap.values()],
      expenseByCategory: expenseByCategory.map((row) => ({
        category: row._id,
        total: round(row.total),
      })),
    },
  };
};

/** Material/site pairs at or below their reorder level. */
export const lowStockList = async (siteId = null) => {
  const match = siteId ? { site: new mongoose.Types.ObjectId(siteId) } : {};
  const rows = await StockMovement.aggregate([
    { $match: match },
    {
      $group: {
        _id: { material: "$material", site: "$site" },
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
    {
      $lookup: {
        from: "materials",
        localField: "_id.material",
        foreignField: "_id",
        as: "material",
      },
    },
    { $unwind: "$material" },
    {
      $lookup: {
        from: "departments",
        localField: "_id.site",
        foreignField: "_id",
        as: "site",
      },
    },
    { $unwind: "$site" },
    {
      $match: {
        "material.isActive": { $ne: false },
        $expr: { $lte: ["$balance", "$material.reorderLevel"] },
      },
    },
    { $sort: { balance: 1 } },
    { $limit: 50 },
  ]);

  return rows.map((row) => ({
    materialId: row._id.material,
    siteId: row._id.site,
    name: row.material.name,
    sku: row.material.sku,
    unit: row.material.unit,
    balance: round(row.balance),
    reorderLevel: row.material.reorderLevel,
    site: row.site.dep_name,
  }));
};

/* -------------------------------------------------------------- Client view */

export const clientOverview = async (user) => {
  const client = await clientForUser(user._id);
  if (!client) {
    return {
      projects: { total: 0, active: 0, completed: 0, averageProgress: 0 },
      finance: { billed: 0, paid: 0, outstanding: 0, overdueCount: 0 },
      recentReports: [],
      upcomingMilestones: [],
    };
  }

  const projects = await Project.find({ client: client._id, isArchived: { $ne: true } })
    .populate("site", "dep_name")
    .sort({ createdAt: -1 })
    .lean();

  const projectIds = projects.map((p) => p._id);
  const now = new Date();

  const [invoiceAgg, overdueCount, recentReports] = await Promise.all([
    Invoice.aggregate([
      {
        $match: {
          client: new mongoose.Types.ObjectId(client._id),
          status: { $ne: "Cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          billed: {
            $sum: { $cond: [{ $in: ["$status", BILLABLE_INVOICE_STATUSES] }, "$total", 0] },
          },
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
    ]),
    Invoice.countDocuments({
      client: client._id,
      status: { $in: ["Sent", "Partially Paid", "Overdue"] },
      dueDate: { $lt: now },
      $expr: { $lt: ["$amountPaid", "$total"] },
    }),
    DailyReport.find({ project: { $in: projectIds }, status: "Approved" })
      .populate("project", "code name")
      .select("date workCompleted weather project approvedAt")
      .sort({ date: -1 })
      .limit(5)
      .lean(),
  ]);

  const upcomingMilestones = projects
    .flatMap((project) =>
      (project.milestones || [])
        .filter((m) => m.status !== "Completed" && m.dueDate)
        .map((m) => ({
          projectId: project._id,
          projectName: project.name,
          title: m.title,
          dueDate: m.dueDate,
          status: m.status,
        }))
    )
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6);

  const active = projects.filter((p) =>
    ACTIVE_PROJECT_STATUSES.includes(p.status)
  ).length;

  return {
    generatedAt: now.toISOString(),
    projects: {
      total: projects.length,
      active,
      completed: projects.filter((p) => ["Completed", "Handover", "Closed"].includes(p.status))
        .length,
      averageProgress: projects.length
        ? Math.round(
            projects.reduce((sum, project) => sum + (project.progress || 0), 0) / projects.length
          )
        : 0,
      list: projects.slice(0, 6).map((project) => ({
        _id: project._id,
        code: project.code,
        name: project.name,
        status: project.status,
        health: project.health,
        progress: project.progress,
        startDate: project.startDate,
        endDate: project.endDate,
        site: project.site?.dep_name,
      })),
    },
    finance: {
      billed: round(invoiceAgg[0]?.billed || 0),
      paid: round(invoiceAgg[0]?.paid || 0),
      outstanding: round(invoiceAgg[0]?.outstanding || 0),
      overdueCount,
    },
    recentReports,
    upcomingMilestones,
  };
};

/* ------------------------------------------------------------ Employee view */

export const employeeOverview = async (user) => {
  const employee = await employeeForUser(user._id);
  if (!employee) {
    return {
      projects: { total: 0, active: 0 },
      tasks: { total: 0, open: 0, overdue: 0, dueThisWeek: 0 },
      leave: { pending: 0, approved: 0 },
      attendance: null,
      latestSalary: null,
      upcomingTasks: [],
    };
  }

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400000);
  const today = businessDate();

  const [projects, taskAgg, leaveAgg, attendance, latestSalary, upcomingTasks] =
    await Promise.all([
      Project.find({
        isArchived: { $ne: true },
        $or: [{ team: employee._id }, { manager: employee._id }, { site: employee.department }],
      })
        .select("code name status progress endDate health")
        .sort({ endDate: 1 })
        .limit(10)
        .lean(),
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
                  {
                    $and: [
                      { $ne: ["$status", "Done"] },
                      { $lt: ["$dueDate", now] },
                      { $ne: [{ $type: "$dueDate" }, "missing"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            dueThisWeek: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$status", "Done"] },
                      { $gte: ["$dueDate", now] },
                      { $lte: ["$dueDate", weekAhead] },
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
      Leave.aggregate([
        { $match: { employeeId: new mongoose.Types.ObjectId(employee._id) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Attendance.findOne({ employeeId: employee._id, date: today }).select("status").lean(),
      Salary.findOne({ employeeId: employee._id }).sort({ payDate: -1 }).lean(),
      Task.find({
        assignee: employee._id,
        status: { $ne: "Done" },
      })
        .populate("project", "code name")
        .select("title dueDate priority status project blockedReason")
        .sort({ dueDate: 1 })
        .limit(6)
        .lean(),
    ]);

  const leave = leaveAgg.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});
  const task = taskAgg[0] || { total: 0, done: 0, overdue: 0, dueThisWeek: 0 };

  return {
    generatedAt: now.toISOString(),
    projects: {
      total: projects.length,
      active: projects.filter((p) => ACTIVE_PROJECT_STATUSES.includes(p.status)).length,
      list: projects,
    },
    tasks: {
      total: task.total,
      open: task.total - task.done,
      done: task.done,
      overdue: task.overdue,
      dueThisWeek: task.dueThisWeek,
      completion: task.total ? Math.round((task.done / task.total) * 100) : 0,
    },
    leave: {
      pending: leave.Pending || 0,
      approved: leave.Approved || 0,
      rejected: leave.Rejected || 0,
    },
    attendance: attendance?.status || null,
    latestSalary: latestSalary
      ? { netSalary: latestSalary.netSalary, payDate: latestSalary.payDate }
      : null,
    upcomingTasks,
  };
};
