import mongoose from "mongoose";
import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import Leave from "../models/Leave.js";
import Salary from "../models/Salary.js";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import Project from "../models/Project.js";
import DailyReport from "../models/DailyReport.js";
import Equipment from "../models/Equipment.js";
import DocumentFile from "../models/DocumentFile.js";
import StockMovement from "../models/StockMovement.js";
import SafetyIncident from "../models/SafetyIncident.js";
import Expense from "../models/Expense.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";

/**
 * MongoDB is a replica set on Atlas, so multi-document changes can run in a
 * transaction (verified via `db.admin().command({hello:1})`).
 */
const withTransaction = async (fn) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const getDepartments = async (req, res) => {
  const { includeArchived } = req.query;
  const filter = includeArchived === "true" ? {} : { isArchived: { $ne: true } };

  const departments = await Department.find(filter).sort({ dep_name: 1 });
  return res.status(200).json({ success: true, departments });
};

const addDepartment = async (req, res) => {
  const { dep_name, description } = req.body;
  if (!dep_name || !dep_name.trim()) {
    throw ApiError.badRequest("Site name is required", { code: "MISSING_FIELD" });
  }

  const exists = await Department.findOne({ dep_name: dep_name.trim() });
  if (exists) {
    throw ApiError.conflict("A site with that name already exists", {
      code: "DUPLICATE_SITE",
    });
  }

  const department = await Department.create({
    dep_name: dep_name.trim(),
    description: description?.trim() || undefined,
  });

  await recordAudit({
    actor: req.user,
    entityType: "Department",
    entityId: department._id,
    action: "site.created",
    toState: "active",
  });

  return res.status(201).json({ success: true, department });
};

const getDepartment = async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw ApiError.notFound("Construction site not found");
  return res.status(200).json({ success: true, department });
};

const updateDepartment = async (req, res) => {
  const { dep_name, description } = req.body;

  const department = await Department.findById(req.params.id);
  if (!department) throw ApiError.notFound("Construction site not found");

  if (department.isArchived) {
    throw ApiError.conflict("An archived site cannot be edited", {
      code: "SITE_ARCHIVED",
    });
  }
  if (dep_name !== undefined) {
    if (!dep_name.trim()) {
      throw ApiError.badRequest("Site name is required", { code: "MISSING_FIELD" });
    }
    department.dep_name = dep_name.trim();
  }
  if (description !== undefined) department.description = description;

  await department.save();
  return res.status(200).json({ success: true, department });
};

/**
 * Archive a site.
 *
 * Preserves all history. Deactivates the site's employees and their logins
 * so a closed site cannot be worked, but keeps every attendance, leave and
 * payroll record intact and queryable.
 */
const archiveDepartment = async (req, res) => {
  const { id } = req.params;

  const department = await Department.findById(id);
  if (!department) throw ApiError.notFound("Construction site not found");

  if (department.isArchived) {
    throw ApiError.conflict("This site is already archived", { code: "SITE_ARCHIVED" });
  }

  const result = await withTransaction(async (session) => {
    department.isArchived = true;
    department.archivedAt = new Date();
    department.archivedBy = req.user._id;
    await department.save({ session });

    const employees = await Employee.find({ department: id }, "_id userId isActive").session(session);
    // Only accounts that are still enabled and belong to the employee role.
    // An administrator who also has an employee record must never be locked
    // out of the platform by closing a site.
    const activeEmployees = employees.filter((employee) => employee.isActive !== false);
    const activeEmployeeIds = activeEmployees.map((employee) => employee._id);
    const userIds = activeEmployees.map((employee) => employee.userId).filter(Boolean);

    if (activeEmployeeIds.length) {
      await Employee.updateMany(
        { _id: { $in: activeEmployeeIds } },
        { $set: { isActive: false, deactivatedBySite: id } },
        { session }
      );
    }
    if (userIds.length) {
      await User.updateMany(
        {
          _id: { $in: userIds },
          role: "employee",
          isDisabled: { $ne: true },
        },
        { $set: { isDisabled: true, disabledBySite: id } },
        { session }
      );
    }

    return { employeesDeactivated: activeEmployeeIds.length };
  });

  await recordAudit({
    actor: req.user,
    entityType: "Department",
    entityId: department._id,
    action: "site.archived",
    fromState: "active",
    toState: "archived",
    reason: req.body?.reason,
  });

  return res.status(200).json({
    success: true,
    message: "Site archived. History preserved.",
    department,
    ...result,
  });
};

/** Restore an archived site (and re-enable its employees' logins). */
const restoreDepartment = async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw ApiError.notFound("Construction site not found");
  if (!department.isArchived) {
    throw ApiError.conflict("This site is not archived", { code: "SITE_NOT_ARCHIVED" });
  }

  await withTransaction(async (session) => {
    department.isArchived = false;
    department.archivedAt = undefined;
    department.archivedBy = undefined;
    await department.save({ session });

    const employees = await Employee.find({ department: department._id }, "_id userId").session(
      session
    );
    const employeeIds = employees.map((e) => e._id);

    // Restore ONLY what this archive changed. An employee who was already
    // inactive (for example, left the company) stays inactive, and an account
    // disabled for another reason stays disabled.
    if (employeeIds.length) {
      await Employee.updateMany(
        { department: department._id, deactivatedBySite: department._id },
        { $set: { isActive: true }, $unset: { deactivatedBySite: 1 } },
        { session }
      );
    }
    await User.updateMany(
      { disabledBySite: department._id },
      { $set: { isDisabled: false }, $unset: { disabledBySite: 1 } },
      { session }
    );
  });

  await recordAudit({
    actor: req.user,
    entityType: "Department",
    entityId: department._id,
    action: "site.restored",
    fromState: "archived",
    toState: "active",
  });

  return res.status(200).json({ success: true, department });
};

/**
 * Hard delete.
 *
 * Refuses while any historical record still references the site, which is the
 * point: deleting a live site must be an explicit data-retention decision, not
 * a side effect of a UI button.
 */
const deleteDepartment = async (req, res) => {
  const { id } = req.params;

  const department = await Department.findById(id);
  if (!department) throw ApiError.notFound("Construction site not found");

  const employees = await Employee.find({ department: id }, "_id");
  const employeeIds = employees.map((e) => e._id);

  const [
    attendanceCount,
    leaveCount,
    salaryCount,
    projectCount,
    reportCount,
    equipmentCount,
    documentCount,
    stockMovementCount,
    safetyCount,
    expenseCount,
  ] = await Promise.all([
    Attendance.countDocuments({ employeeId: { $in: employeeIds } }),
    Leave.countDocuments({ employeeId: { $in: employeeIds } }),
    Salary.countDocuments({ employeeId: { $in: employeeIds } }),
    Project.countDocuments({ site: id }),
    DailyReport.countDocuments({ site: id }),
    Equipment.countDocuments({ site: id }),
    DocumentFile.countDocuments({ site: id }),
    StockMovement.countDocuments({ site: id }),
    SafetyIncident.countDocuments({ site: id }),
    Expense.countDocuments({ site: id }),
  ]);

  const dependencies = {
    employees: employees.length,
    attendance: attendanceCount,
    leave: leaveCount,
    payroll: salaryCount,
    projects: projectCount,
    dailyReports: reportCount,
    equipment: equipmentCount,
    documents: documentCount,
    stockMovements: stockMovementCount,
    safetyIncidents: safetyCount,
    expenses: expenseCount,
  };
  const historical = Object.values(dependencies).reduce((sum, count) => sum + count, 0);

  if (historical > 0) {
    const summary = Object.entries(dependencies)
      .filter(([, count]) => count > 0)
      .map(([label, count]) => `${count} ${label}`)
      .join(", ");
    throw ApiError.conflict(
      `Cannot permanently delete this site: ${summary} depend on it. Archive the site instead to preserve history.`,
      {
        code: "HISTORICAL_DEPENDENCIES",
        details: dependencies,
      }
    );
  }

  await Department.deleteOne({ _id: id });

  await recordAudit({
    actor: req.user,
    entityType: "Department",
    entityId: id,
    action: "site.deleted",
    fromState: department.isArchived ? "archived" : "active",
    toState: "deleted",
  });

  return res.status(200).json({ success: true, message: "Site permanently deleted" });
};

export {
  getDepartments,
  addDepartment,
  getDepartment,
  updateDepartment,
  deleteDepartment,
  archiveDepartment,
  restoreDepartment,
};