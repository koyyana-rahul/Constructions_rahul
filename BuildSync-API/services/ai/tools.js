import mongoose from "mongoose";
import Employee from "../../models/Employee.js";
import Department from "../../models/Department.js";
import Leave from "../../models/Leave.js";
import Salary from "../../models/Salary.js";
import WorkRequest from "../../models/Work.js";
import { businessDate } from "../../middleware/defaultAttendance.js";

/**
 * READ-ONLY TOOLS for the Builtra assistant.
 *
 * ── The single most important design rule in this file ──────────────────────
 *
 * A tool's SCOPE IS THE CALLER, FULL STOP. No tool accepts a `userId`, a
 * `clientId`, an `employeeId` or a `siteId` argument. There is deliberately
 * no way for a model - which is untrusted input - to ask for somebody else's
 * records, because it has nothing to name them with.
 *
 * The model's only arguments are bounded numbers (`days`). Everything else is
 * derived from `req.user` on the server.
 *
 * A second rule: a tool NEVER invents data. If the data does not exist in
 * Builtra yet (material stock, client invoices, milestones), the tool says
 * so plainly instead of returning an empty array that the model might
 * interpret as "nothing to report".
 */

/** YYYY-MM-DD, N days from today. */
const dayOffset = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return businessDate(d);
};

/** Open work-request states - anything a client would consider "live". */
const OPEN_STATES = [
  "Pending",
  "Under Review",
  "Approved",
  "Assigned",
  "In Progress",
  "On Hold",
  "Blocked",
  "Returned for Correction",
];

/** States that mean "something is wrong and needs a decision". */
const BLOCKED_STATES = ["Blocked", "On Hold", "Returned for Correction"];

const WORK_FIELDS = "name description status startDate endDate rejectionReason";

/**
 * Work requests the caller is allowed to see.
 *
 * admin  -> every request (the whole company is the contractor)
 * client -> only their own
 * employee -> none; work requests are client-raised and are not assigned to
 *             individuals in the current model.
 */
const visibleWorkFilter = async (user) => {
  if (user.role === "admin") return {};
  if (user.role === "client") {
    const Client = (await import("../../models/Client.js")).default;
    const client = await Client.findOne({ userId: user._id }).select("_id");
    return client ? { clientId: client._id } : { _id: null };
  }
  return { _id: null };
};

/** Sites the caller may see. */
const visibleSiteFilter = async (user) => {
  if (user.role === "admin") return {};
  if (user.role === "employee") {
    const employee = await Employee.findOne({ userId: user._id }).select("department");
    return employee ? { _id: employee.department } : { _id: null };
  }
  return { _id: null };
};

/* ------------------------------------------------------------------ */
/* TOOLS                                                               */
/* ------------------------------------------------------------------ */

const listOverdueWork = async (user, { days = 0 } = {}) => {
  const today = dayOffset(-days);
  const filter = await visibleWorkFilter(user);
  if (filter._id === null) return { ok: true, data: { work: [], note: "No work requests are visible to your role." } };

  const work = await WorkRequest.find({
    ...filter,
    status: { $in: OPEN_STATES },
    endDate: { $lt: new Date(today) },
  })
    .select(WORK_FIELDS)
    .sort({ endDate: 1 })
    .limit(50)
    .lean();

  return {
    ok: true,
    data: {
      asOf: today,
      work: work.map((w) => ({
        name: w.name,
        status: w.status,
        startDate: w.startDate,
        endDate: w.endDate,
        daysOverdue: Math.floor((Date.now() - new Date(w.endDate)) / 86400000),
        reason: w.rejectionReason || undefined,
      })),
    },
  };
};

const listUpcomingWork = async (user, { days = 14 } = {}) => {
  const from = dayOffset(0);
  const to = dayOffset(days);
  const filter = await visibleWorkFilter(user);
  if (filter._id === null) return { ok: true, data: { work: [], note: "No work requests are visible to your role." } };

  const work = await WorkRequest.find({
    ...filter,
    status: { $in: OPEN_STATES },
    startDate: { $gte: new Date(from), $lte: new Date(to) },
  })
    .select(WORK_FIELDS)
    .sort({ startDate: 1 })
    .limit(50)
    .lean();

  return {
    ok: true,
    data: {
      from,
      to,
      work: work.map((w) => ({
        name: w.name,
        status: w.status,
        startDate: w.startDate,
        endDate: w.endDate,
      })),
    },
  };
};

const listBlockedWork = async (user) => {
  const filter = await visibleWorkFilter(user);
  if (filter._id === null) return { ok: true, data: { work: [], note: "No work requests are visible to your role." } };

  const work = await WorkRequest.find({ ...filter, status: { $in: BLOCKED_STATES } })
    .select(WORK_FIELDS)
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  return {
    ok: true,
    data: {
      work: work.map((w) => ({
        name: w.name,
        status: w.status,
        startDate: w.startDate,
        endDate: w.endDate,
        reason: w.rejectionReason || undefined,
      })),
    },
  };
};

/** Approval queue. Admin only - an employee has no business seeing it. */
const listPendingApprovals = async (user) => {
  if (user.role !== "admin") {
    return { ok: false, reason: "Only an administrator can see the approval queue." };
  }

  const [leaves, work] = await Promise.all([
    Leave.find({ status: "Pending" })
      .populate({ path: "employeeId", populate: { path: "userId", select: "name" } })
      .select("leaveType startDate endDate status appliedAt")
      .sort({ appliedAt: -1 })
      .limit(25)
      .lean(),
    WorkRequest.find({ status: { $in: ["Pending", "Under Review"] } })
      .populate({ path: "clientId", populate: { path: "userId", select: "name" } })
      .select("name status startDate endDate appliedAt")
      .sort({ appliedAt: -1 })
      .limit(25)
      .lean(),
  ]);

  return {
    ok: true,
    data: {
      leaves: leaves.map((l) => ({
        employee: l.employeeId?.userId?.name || "Employee",
        leaveType: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        appliedAt: l.appliedAt,
      })),
      workRequests: work.map((w) => ({
        client: w.clientId?.userId?.name || "Client",
        name: w.name,
        status: w.status,
        startDate: w.startDate,
        endDate: w.endDate,
      })),
    },
  };
};

/**
 * Attendance for today.
 * admin -> the whole company; employee -> their own record only.
 */
const getAttendanceToday = async (user) => {
  const today = businessDate();
  const Attendance = (await import("../../models/Attendance.js")).default;

  if (user.role === "employee") {
    const employee = await Employee.findOne({ userId: user._id }).select("_id");
    if (!employee) return { ok: true, data: { date: today, rows: [], note: "No employee profile is linked to your account." } };

    const rows = await Attendance.find({ date: today, employeeId: employee._id })
      .populate({ path: "employeeId", populate: { path: "userId", select: "name" } })
      .select("status markedBy correctedAt")
      .lean();

    return {
      ok: true,
      data: {
        date: today,
        rows: rows.map((r) => ({
          employee: r.employeeId?.userId?.name || "You",
          status: r.status || "Not marked",
        })),
      },
    };
  }

  if (user.role !== "admin") {
    return { ok: false, reason: "Attendance is only visible to administrators and employees." };
  }

  const rows = await Attendance.find({ date: today })
    .populate({
      path: "employeeId",
      populate: [{ path: "department", select: "dep_name" }, { path: "userId", select: "name" }],
    })
    .select("status")
    .lean();

  const byStatus = { Present: 0, Absent: 0, Sick: 0, Leave: 0, "Not marked": 0 };
  const bySite = {};

  for (const r of rows) {
    const status = r.status || "Not marked";
    byStatus[status] = (byStatus[status] || 0) + 1;
    const site = r.employeeId?.department?.dep_name || "Unassigned site";
    bySite[site] = bySite[site] || { total: 0, "Not marked": 0 };
    bySite[site].total += 1;
    if (status === "Not marked") bySite[site]["Not marked"] += 1;
  }

  return { ok: true, data: { date: today, total: rows.length, byStatus, bySite } };
};

/**
 * Site roster.
 *
 * NEVER includes salary, phone, email or any personal detail - only the
 * facts a site supervisor genuinely needs.
 */
const getSiteRoster = async (user) => {
  const filter = await visibleSiteFilter(user);
  if (filter._id === null) {
    return { ok: true, data: { sites: [], note: "No site is assigned to your account." } };
  }

  const sites = await Department.find(filter)
    .select("dep_name description isArchived")
    .sort({ dep_name: 1 })
    .lean();

  const employees = await Employee.find({
    department: { $in: sites.map((s) => s._id) },
    isActive: { $ne: false },
  })
    .populate({ path: "userId", select: "name" })
    .populate({ path: "department", select: "dep_name" })
    .select("employeeId designation department")
    .lean();

  const result = sites.map((s) => ({
    site: s.dep_name,
    archived: Boolean(s.isArchived),
    headcount: employees.filter((e) => String(e.department?._id) === String(s._id)).length,
  }));

  return {
    ok: true,
    data: {
      sites: result,
      designations: employees.map((e) => ({
        name: e.userId?.name,
        employeeId: e.employeeId,
        designation: e.designation,
        site: e.department?.dep_name,
      })),
    },
  };
};

/**
 * Payroll snapshot.
 *
 * admin -> the whole company's CONFIGURED monthly commitment. This is NOT
 *          cash paid - Builtra has no payment records - and the figure is
 *          labelled as a commitment everywhere it appears.
 * employee -> their own salary records only.
 * client -> refused.
 */
const getPayrollSnapshot = async (user) => {
  if (user.role === "client") {
    return { ok: false, reason: "Payroll information is not available to client accounts." };
  }

  if (user.role === "employee") {
    const employee = await Employee.findOne({ userId: user._id }).select("_id");
    if (!employee) return { ok: true, data: { records: [] } };

    const records = await Salary.find({ employeeId: employee._id })
      .select("basicSalary allowances deductions netSalary payDate")
      .sort({ payDate: -1 })
      .limit(12)
      .lean();

    return {
      ok: true,
      data: {
        basis: "Your own recorded salary entries",
        records: records.map((r) => ({
          payDate: r.payDate,
          basic: r.basicSalary,
          allowances: r.allowances || 0,
          deductions: r.deductions || 0,
          net: r.netSalary,
        })),
      },
    };
  }

  const [agg, headcount, siteCount] = await Promise.all([
    Employee.aggregate([{ $group: { _id: null, total: { $sum: "$salary" } } }]),
    Employee.countDocuments({ isActive: { $ne: false } }),
    Department.countDocuments({ isArchived: { $ne: true } }),
  ]);

  return {
    ok: true,
    data: {
      basis: "Configured monthly salary commitment - NOT a record of payments made",
      totalMonthlyConfiguredSalary: agg[0]?.total || 0,
      activeEmployees: headcount,
      activeSites: siteCount,
      currency: "INR",
    },
  };
};

/** The caller's own leave requests. */
const getMyLeaveRequests = async (user) => {
  if (user.role === "client") {
    return { ok: false, reason: "Leave records are not available to client accounts." };
  }

  const employee = await Employee.findOne({ userId: user._id }).select("_id");
  if (!employee) return { ok: true, data: { leaves: [], note: "No employee profile is linked to your account." } };

  const leaves = await Leave.find({ employeeId: employee._id })
    .select("leaveType startDate endDate status reason appliedAt")
    .sort({ appliedAt: -1 })
    .limit(25)
    .lean();

  return {
    ok: true,
    data: {
      leaves: leaves.map((l) => ({
        leaveType: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        status: l.status,
        appliedAt: l.appliedAt,
      })),
    },
  };
};

/**
 * The tool registry.
 *
 * `declaration` is the JSON-Schema description handed to the model.
 * `run` is the server-side implementation. Arguments are validated by
 * `validate` before `run` is called.
 */
export const AI_TOOLS = {
  list_overdue_work: {
    declaration: {
      name: "list_overdue_work",
      description:
        "List work requests that are past their end date and still open. Use this when the user asks which jobs are late, overdue or running behind.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "integer",
            description: "How many days back to look. Defaults to 0 (overdue today).",
            minimum: 0,
            maximum: 365,
          },
        },
      },
    },
    validate: (args) => {
      const days = Number(args?.days ?? 0);
      if (!Number.isFinite(days) || days < 0 || days > 365) {
        return { ok: false, error: "days must be between 0 and 365" };
      }
      return { ok: true, value: { days } };
    },
    run: listOverdueWork,
  },

  list_upcoming_work: {
    declaration: {
      name: "list_upcoming_work",
      description:
        "List work requests that are due to start soon. Use this when the user asks what is coming up, what starts this week, or what deadlines are ahead.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "integer",
            description: "How many days ahead to look. Defaults to 14.",
            minimum: 1,
            maximum: 90,
          },
        },
      },
    },
    validate: (args) => {
      const days = Number(args?.days ?? 14);
      if (!Number.isFinite(days) || days < 1 || days > 90) {
        return { ok: false, error: "days must be between 1 and 90" };
      }
      return { ok: true, value: { days } };
    },
    run: listUpcomingWork,
  },

  list_blocked_work: {
    declaration: {
      name: "list_blocked_work",
      description:
        "List work requests that are blocked, on hold, or returned for correction. Use this when the user asks about blockers, unresolved problems or what is stuck.",
      parameters: { type: "object", properties: {} },
    },
    validate: () => ({ ok: true, value: {} }),
    run: listBlockedWork,
  },

  list_pending_approvals: {
    declaration: {
      name: "list_pending_approvals",
      description:
        "List leave applications and work requests waiting for a decision. Administrators only.",
      parameters: { type: "object", properties: {} },
    },
    validate: () => ({ ok: true, value: {} }),
    run: listPendingApprovals,
  },

  get_attendance_today: {
    declaration: {
      name: "get_attendance_today",
      description:
        "Get today's attendance: how many workers are present, absent, sick, on leave, or not yet marked.",
      parameters: { type: "object", properties: {} },
    },
    validate: () => ({ ok: true, value: {} }),
    run: getAttendanceToday,
  },

  get_site_roster: {
    declaration: {
      name: "get_site_roster",
      description:
        "Get the construction sites and the workers assigned to each, with headcount and designation. Contains no salary or personal contact details.",
      parameters: { type: "object", properties: {} },
    },
    validate: () => ({ ok: true, value: {} }),
    run: getSiteRoster,
  },

  get_payroll_snapshot: {
    declaration: {
      name: "get_payroll_snapshot",
      description:
        "Get payroll figures: the configured monthly salary commitment for administrators, or your own salary records for employees.",
      parameters: { type: "object", properties: {} },
    },
    validate: () => ({ ok: true, value: {} }),
    run: getPayrollSnapshot,
  },

  get_my_leave_requests: {
    declaration: {
      name: "get_my_leave_requests",
      description: "Get your own leave requests and their current decision status.",
      parameters: { type: "object", properties: {} },
    },
    validate: () => ({ ok: true, value: {} }),
    run: getMyLeaveRequests,
  },
};

/** The declarations handed to the model. */
export const toolDeclarations = Object.values(AI_TOOLS).map((t) => t.declaration);

/**
 * Executes one tool call for one user.
 *
 * Arguments are validated FIRST, then the tool runs. A tool that refuses
 * (because of the caller's role) returns its reason instead of throwing, so
 * the model can explain it in plain language.
 */
export const runTool = async (name, rawArgs, user) => {
  const tool = AI_TOOLS[name];
  if (!tool) {
    return { ok: false, reason: `Unknown tool "${name}".` };
  }

  const validated = tool.validate(rawArgs || {});
  if (!validated.ok) {
    return { ok: false, reason: `Invalid arguments for ${name}: ${validated.error}` };
  }

  try {
    return await tool.run(user, validated.value);
  } catch (error) {
    console.error(`[ai] tool ${name} failed:`, error.message);
    return { ok: false, reason: `The ${name} data could not be read right now.` };
  }
};

/** Exposed for tests: the set of tool names. */
export const toolNames = Object.keys(AI_TOOLS);

/** Guard against an unused-import warning while keeping mongoose available for future tools. */
export const _mongooseAvailable = Boolean(mongoose);
