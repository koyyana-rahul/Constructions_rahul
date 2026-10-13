import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import Leave from "../models/Leave.js";
import WorkRequest from "../models/Work.js";

/**
 * Aggregated admin overview.
 *
 * Every metric is derived from the live collections - nothing is fabricated.
 *
 * R12 note: `payrollCommitment` is the sum of employees' *configured monthly
 * salary*, which is a commitment, not cash paid. There are no payment records
 * in this schema, so it must not be labelled "paid".
 */
const getSummary = async (req, res) => {
  try {
    const [
      totalEmployees,
      activeEmployees,
      totalDepartments,
      archivedDepartments,
      payrollAgg,
      leaveStatus,
      workStatus,
      unassignedApproved,
      pendingLeave,
      unblockedAttendance,
      recentLeaves,
      recentWorkRequests,
    ] = await Promise.all([
      Employee.countDocuments({}),
      Employee.countDocuments({ isActive: { $ne: false } }),
      Department.countDocuments({ isArchived: { $ne: true } }),
      Department.countDocuments({ isArchived: true }),
      Employee.aggregate([{ $group: { _id: null, total: { $sum: "$salary" } } }]),
      Leave.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      WorkRequest.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      WorkRequest.countDocuments({ status: "Approved" }),
      Leave.countDocuments({ status: "Pending" }),
      // Operational exception: today's attendance rows still unmarked.
      (async () => {
        const { default: Attendance } = await import("../models/Attendance.js");
        const { businessDate } = await import("../middleware/defaultAttendance.js");
        return Attendance.countDocuments({
          date: businessDate(),
          $or: [{ status: null }, { status: { $exists: false } }],
        });
      })(),
      // Actionable items for the dashboard "Pending approvals" lists. Only
      // undecided records, newest first, with just the fields the list renders.
      Leave.find({ status: "Pending" })
        // These models carry `appliedAt`, not Mongoose `timestamps`, so sorting
        // on `createdAt` would silently be a no-op.
        .sort({ appliedAt: -1 })
        .limit(5)
        .select("employeeId leaveType startDate endDate status appliedAt")
        // One nested populate, not two chained `.populate()` calls - chaining
        // a sub-path like this makes the second call overwrite the first, so
        // `userId` silently stayed an unpopulated id.
        .populate({
          path: "employeeId",
          select: "employeeId",
          populate: { path: "userId", select: "name" },
        })
        .lean(),
      WorkRequest.find({ status: { $in: ["Pending", "Under Review"] } })
        .sort({ appliedAt: -1 })
        .limit(5)
        .select("clientId name requestType status appliedAt")
        .populate({
          path: "clientId",
          select: "entityType",
          populate: { path: "userId", select: "name" },
        })
        .lean(),
    ]);

    const statusCount = (agg, key) => agg.find((i) => i._id === key)?.count || 0;

    const leaveSummary = {
      pending: statusCount(leaveStatus, "Pending"),
      approved: statusCount(leaveStatus, "Approved"),
      rejected: statusCount(leaveStatus, "Rejected"),
      cancelled: statusCount(leaveStatus, "Cancelled"),
      // Unique employees who have ever applied, not the request count.
      appliedFor: await Leave.distinct("employeeId").then((a) => a.length),
    };

    const workRequestSummary = {
      pending: statusCount(workStatus, "Pending"),
      underReview: statusCount(workStatus, "Under Review"),
      approved: statusCount(workStatus, "Approved"),
      inProgress: statusCount(workStatus, "In Progress"),
      completed: statusCount(workStatus, "Completed"),
      rejected: statusCount(workStatus, "Rejected"),
      appliedFor: await WorkRequest.distinct("clientId").then((a) => a.length),
    };

    return res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),

      totalEmployees,
      activeEmployees,
      totalDepartments,
      archivedDepartments,

      // Backward-compatible key retained for the existing frontend.
      totalSalary: payrollAgg[0]?.total || 0,
      payrollCommitment: {
        monthlyConfiguredSalary: payrollAgg[0]?.total || 0,
        basis: "Sum of Employee.salary for all employees",
        note: "Configured payroll commitment, not a record of payments made",
      },

      leaveSummary,
      workRequestSummary,

      pendingApprovals: {
        leave: leaveSummary.pending,
        workRequests: workRequestSummary.pending + workRequestSummary.underReview,
      },

      operationalExceptions: {
        approvedButUnassigned: unassignedApproved,
        unmarkedAttendanceToday: unblockedAttendance,
      },

      // Newest undecided items, for the dashboard approval queues.
      pendingItems: {
        leaves: recentLeaves,
        workRequests: recentWorkRequests,
      },
    });
  } catch (error) {
    console.error("[dashboard] summary error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Could not build the dashboard summary",
      code: "SUMMARY_ERROR",
    });
  }
};

export { getSummary };