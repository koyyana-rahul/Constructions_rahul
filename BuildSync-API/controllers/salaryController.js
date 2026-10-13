import Salary from "../models/Salary.js";
import Employee from "../models/Employee.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";

/**
 * R3 fix: the salary view endpoint no longer trusts the caller's `:role`
 * parameter. An employee can only ever read their own payroll; an admin must
 * be explicitly authorised and passes an `Employee._id`.
 */
const getSalary = async (req, res) => {
  const { id } = req.params;
  const isAdminRequest = req.user.role === "admin";
  const wantsAdminScope = req.query.scope === "admin";

  let employee;

  if (isAdminRequest && wantsAdminScope) {
    // Admin reading a specific employee's payroll (Employee._id).
    employee = await Employee.findById(id);
    if (!employee) throw ApiError.notFound("Employee not found");
  } else {
    // Everyone else: resolve strictly from the verified token.
    employee = await Employee.findOne({ userId: req.user._id });
    if (!employee) {
      throw ApiError.notFound("No employee profile is linked to this account", {
        code: "NO_EMPLOYEE_PROFILE",
      });
    }
  }

  const salary = await Salary.find({ employeeId: employee._id }).sort({ payDate: -1 });

  return res.status(200).json({ success: true, salary });
};

const addSalary = async (req, res) => {
  const { employeeId, basicSalary, allowances, deductions, payDate } = req.body;

  const basic = Number(basicSalary);
  const allow = Number(allowances || 0);
  const deduct = Number(deductions || 0);

  if (!employeeId) {
    throw ApiError.badRequest("Employee is required", { code: "MISSING_FIELD" });
  }
  if (!Number.isFinite(basic) || basic <= 0) {
    throw ApiError.badRequest("Basic salary must be a number greater than 0", {
      code: "INVALID_AMOUNT",
    });
  }
  if (!Number.isFinite(allow) || allow < 0 || !Number.isFinite(deduct) || deduct < 0) {
    throw ApiError.badRequest("Allowances and deductions must be zero or positive", {
      code: "INVALID_AMOUNT",
    });
  }
  if (basic + allow - deduct < 0) {
    throw ApiError.badRequest("Deductions exceed gross pay", { code: "INVALID_AMOUNT" });
  }
  if (!payDate || Number.isNaN(new Date(payDate).getTime())) {
    throw ApiError.badRequest("A valid pay date is required", { code: "INVALID_DATE" });
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) throw ApiError.notFound("Employee not found");

  const newSalary = await Salary.create({
    employeeId,
    basicSalary: basic,
    allowances: allow,
    deductions: deduct,
    netSalary: basic + allow - deduct,
    payDate: new Date(payDate),
  });

  await recordAudit({
    actor: req.user,
    entityType: "Salary",
    entityId: newSalary._id,
    action: "salary.recorded",
    toState: "recorded",
  });

  return res.status(201).json({ success: true, salary: newSalary });
};

export { addSalary, getSalary };