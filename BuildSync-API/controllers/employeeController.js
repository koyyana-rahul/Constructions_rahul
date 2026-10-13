import multer from "multer";
import Employee from "../models/Employee.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import bcrypt from "bcrypt";
import path from "path";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const addEmployee = async (req, res) => {
  const {
    name,
    email,
    employeeId,
    dob,
    gender,
    maritalStatus,
    designation,
    department,
    salary,
    password,
  } = req.body;

  if (!name?.trim() || !email?.trim() || !employeeId?.trim()) {
    throw ApiError.badRequest("Name, email and employee ID are required", {
      code: "MISSING_FIELD",
    });
  }
  if (!EMAIL_RE.test(email.trim())) {
    throw ApiError.badRequest("Enter a valid email address", { code: "INVALID_EMAIL" });
  }
  if (!password || password.length < 6) {
    throw ApiError.badRequest("Password must be at least 6 characters", {
      code: "WEAK_PASSWORD",
    });
  }
  if (!department) {
    throw ApiError.badRequest("A construction site is required", { code: "MISSING_FIELD" });
  }

  const site = await Department.findById(department);
  if (!site) {
    throw ApiError.badRequest("The selected construction site does not exist", {
      code: "INVALID_REFERENCE",
    });
  }
  if (site.isArchived) {
    throw ApiError.conflict("Employees cannot be added to an archived site", {
      code: "SITE_ARCHIVED",
    });
  }

  // Case-insensitive duplicate check on both email and employeeId.
  const emailClash = await User.findOne({
    email: { $regex: `^${email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (emailClash) {
    throw ApiError.conflict("That email address is already registered", {
      code: "DUPLICATE_EMAIL",
    });
  }
  const idClash = await Employee.findOne({ employeeId: employeeId.trim() });
  if (idClash) {
    throw ApiError.conflict("That employee ID is already in use", {
      code: "DUPLICATE_EMPLOYEE_ID",
    });
  }

  /**
   * R6 fix: the role is taken from an explicit allow-list rather than being
   * copied straight off the request body, so an unexpected value can never
   * mint an administrator.
   */
  const requestedRole = req.body.role;
  const role = requestedRole === "admin" ? "admin" : "employee";

  const savedUser = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: await bcrypt.hash(password, 10),
    role,
    phone: req.body.phone,
    profileImage: req.file ? req.file.filename : "",
  });

  const newEmployee = await Employee.create({
    userId: savedUser._id,
    employeeId: employeeId.trim(),
    dob: dob || undefined,
    gender,
    maritalStatus,
    designation,
    department,
    salary: Number(salary) || 0,
    isActive: true,
  });

  await recordAudit({
    actor: req.user,
    entityType: "Employee",
    entityId: newEmployee._id,
    action: "employee.created",
    toState: "active",
  });

  return res.status(201).json({ success: true, message: "Employee created" });
};

const getEmployees = async (req, res) => {
  const { page = 1, limit = 25, siteId, includeInactive } = req.query;
  const take = Math.min(parseInt(limit, 10) || 25, 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const filter = {};
  if (siteId) filter.department = siteId;
  if (includeInactive !== "true") filter.isActive = { $ne: false };

  const [employees, total] = await Promise.all([
    Employee.find(filter)
      .populate("userId", { password: 0 })
      .populate("department")
      .sort({ employeeId: 1 })
      .skip(skip)
      .limit(take),
    Employee.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    employees,
    pagination: { page: Math.floor(skip / take) + 1, limit: take, total },
  });
};

const getEmployee = async (req, res) => {
  const { id } = req.params;

  let employee = await Employee.findById(id)
    .populate("userId", { password: 0 })
    .populate("department");

  if (!employee) {
    employee = await Employee.findOne({ userId: id })
      .populate("userId", { password: 0 })
      .populate("department");
  }

  if (!employee) throw ApiError.notFound("Employee not found");

  return res.status(200).json({ success: true, employee });
};

const updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { name, maritalStatus, designation, department, salary } = req.body;

  const employee = await Employee.findById(id);
  if (!employee) throw ApiError.notFound("Employee not found");

  const user = await User.findById(employee.userId);
  if (!user) throw ApiError.notFound("Linked user account not found");

  if (department) {
    const site = await Department.findById(department);
    if (!site) {
      throw ApiError.badRequest("The selected construction site does not exist", {
        code: "INVALID_REFERENCE",
      });
    }
    if (site.isArchived) {
      throw ApiError.conflict("Employees cannot be moved to an archived site", {
        code: "SITE_ARCHIVED",
      });
    }
  }

  if (name !== undefined) {
    if (!name.trim()) {
      throw ApiError.badRequest("Name cannot be empty", { code: "MISSING_FIELD" });
    }
    user.name = name.trim();
    await user.save();
  }

  const changes = {};
  if (maritalStatus !== undefined) { employee.maritalStatus = maritalStatus; changes.maritalStatus = maritalStatus; }
  if (designation !== undefined) { employee.designation = designation; changes.designation = designation; }
  if (salary !== undefined) { employee.salary = Number(salary) || 0; changes.salary = employee.salary; }
  if (department !== undefined) { employee.department = department; changes.department = department; }

  await employee.save();

  await recordAudit({
    actor: req.user,
    entityType: "Employee",
    entityId: employee._id,
    action: "employee.updated",
    reason: Object.keys(changes).join(", ") || "no field changes",
  });

  return res.status(200).json({ success: true, message: "Employee updated" });
};

const fetchEmployeesByDepId = async (req, res) => {
  const employees = await Employee.find({ department: req.params.id, isActive: { $ne: false } })
    .populate("userId", { password: 0 })
    .sort({ employeeId: 1 });
  return res.status(200).json({ success: true, employees });
};

export {
  addEmployee,
  upload,
  getEmployees,
  getEmployee,
  updateEmployee,
  fetchEmployeesByDepId,
};