import mongoose from "mongoose";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import Employee from "../models/Employee.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import {
  isAdmin,
  employeeForUser,
  canAccessProject,
  escapeRegex,
} from "../services/accessService.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { notifyUser } from "../services/notificationService.js";

export const TASK_STATUSES = ["To Do", "In Progress", "Blocked", "Done"];
const PRIORITIES = ["Low", "Normal", "High", "Critical"];

const populateTask = (query) =>
  query
    .populate("project", "code name status site")
    .populate({
      path: "assignee",
      select: "employeeId designation userId",
      populate: { path: "userId", select: "name email profileImage" },
    });

const parseOptionalDate = (value, field) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`${field} is not a valid date`, { code: "INVALID_DATE" });
  }
  return date;
};

/** Employees may only ever list their own tasks. */
export const listTasks = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50 });
  const filter = {};

  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee) {
      return res.status(200).json({
        success: true,
        tasks: [],
        pagination: paginationMeta({ page, limit }, 0),
      });
    }
    filter.assignee = employee._id;
  } else if (!isAdmin(req.user)) {
    throw ApiError.forbidden("Tasks are not available to client accounts", {
      code: "FORBIDDEN_ROLE",
    });
  }

  if (req.query.project) {
    if (!mongoose.isValidObjectId(req.query.project)) {
      throw ApiError.badRequest("Invalid project", { code: "INVALID_ID" });
    }
    filter.project = req.query.project;
  }
  if (req.query.assignee && isAdmin(req.user)) {
    if (!mongoose.isValidObjectId(req.query.assignee)) {
      throw ApiError.badRequest("Invalid assignee", { code: "INVALID_ID" });
    }
    filter.assignee = req.query.assignee;
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.overdue === "true") {
    filter.status = { $ne: "Done" };
    filter.dueDate = { $lt: new Date() };
  }
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = [{ title: rx }, { description: rx }];
  }

  const [tasks, total] = await Promise.all([
    populateTask(Task.find(filter)).sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Task.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    tasks,
    pagination: paginationMeta({ page, limit }, total),
  });
};

export const getTask = async (req, res) => {
  const task = await populateTask(Task.findById(req.params.id));
  if (!task) throw ApiError.notFound("Task not found");

  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee || String(task.assignee?._id || task.assignee) !== String(employee._id)) {
      throw ApiError.forbidden("You can only view tasks assigned to you", {
        code: "FORBIDDEN_OWNERSHIP",
      });
    }
  } else if (!isAdmin(req.user)) {
    throw ApiError.forbidden("Tasks are not available to client accounts", {
      code: "FORBIDDEN_ROLE",
    });
  }

  return res.status(200).json({ success: true, task });
};

export const createTask = async (req, res) => {
  const { project, title, description, assignee, status = "To Do", priority = "Normal" } = req.body;

  if (!project || !mongoose.isValidObjectId(project)) {
    throw ApiError.badRequest("A project is required", { code: "MISSING_FIELD" });
  }
  if (!title?.trim()) throw ApiError.badRequest("Task title is required", { code: "MISSING_FIELD" });
  if (!TASK_STATUSES.includes(status)) {
    throw ApiError.badRequest("Invalid task status", { code: "INVALID_STATUS" });
  }
  if (!PRIORITIES.includes(priority)) {
    throw ApiError.badRequest("Invalid priority", { code: "INVALID_PRIORITY" });
  }

  const projectDoc = await Project.findById(project);
  if (!projectDoc) throw ApiError.badRequest("The selected project does not exist", { code: "INVALID_REFERENCE" });
  if (projectDoc.isArchived) {
    throw ApiError.conflict("Tasks cannot be added to an archived project", { code: "PROJECT_ARCHIVED" });
  }

  let assigneeId;
  if (assignee) {
    if (!mongoose.isValidObjectId(assignee)) {
      throw ApiError.badRequest("Invalid assignee", { code: "INVALID_ID" });
    }
    const employee = await Employee.findById(assignee).populate("userId", "name");
    if (!employee) throw ApiError.badRequest("The selected assignee does not exist", { code: "INVALID_REFERENCE" });
    if (employee.isActive === false) {
      throw ApiError.conflict("This employee is inactive and cannot receive new tasks", {
        code: "EMPLOYEE_INACTIVE",
      });
    }
    assigneeId = employee._id;
  }

  const startDate = parseOptionalDate(req.body.startDate, "Start date");
  const dueDate = parseOptionalDate(req.body.dueDate, "Due date");
  if (startDate && dueDate && dueDate < startDate) {
    throw ApiError.badRequest("Due date must be on or after the start date", { code: "INVALID_RANGE" });
  }

  const task = await Task.create({
    project: projectDoc._id,
    title: title.trim(),
    description,
    assignee: assigneeId,
    status,
    priority,
    startDate,
    dueDate,
    estimatedHours: Math.max(0, Number(req.body.estimatedHours) || 0),
    actualHours: Math.max(0, Number(req.body.actualHours) || 0),
    blockedReason: req.body.blockedReason,
    notes: req.body.notes,
    completedAt: status === "Done" ? new Date() : undefined,
    createdBy: req.user._id,
  });

  await recordAudit({
    actor: req.user,
    entityType: "Task",
    entityId: task._id,
    action: "task.created",
    toState: task.status,
    reason: task.title,
  });

  if (assigneeId) {
    const employee = await Employee.findById(assigneeId).populate("userId", "name");
    await notifyUser({
      userId: employee?.userId?._id,
      type: "Assignment",
      title: "New task assigned",
      message: `${task.title} on ${projectDoc.name}${dueDate ? ` is due ${dueDate.toLocaleDateString()}` : ""}.`,
      link: `/employee-dashboard/tasks`,
    });
  }

  const populated = await populateTask(Task.findById(task._id));
  return res.status(201).json({ success: true, task: populated });
};

export const updateTask = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw ApiError.notFound("Task not found");

  const employee = req.user.role === "employee" ? await employeeForUser(req.user._id) : null;
  const isAssignee = employee && String(task.assignee) === String(employee._id);
  const admin = isAdmin(req.user);

  if (!admin && !isAssignee) {
    throw ApiError.forbidden("You can only update tasks assigned to you", {
      code: "FORBIDDEN_OWNERSHIP",
    });
  }

  const before = task.toObject();

  // An employee's write surface is deliberately narrow: progress and notes,
  // never assignment, project, dates or priority.
  if (!admin) {
    const allowed = ["status", "actualHours", "blockedReason", "notes"];
    const attempted = Object.keys(req.body).filter((key) => !allowed.includes(key));
    if (attempted.length) {
      throw ApiError.forbidden(
        `Employees may only update ${allowed.join(", ")} on their own tasks`,
        { code: "FORBIDDEN_FIELD", details: { attempted } }
      );
    }
  }

  if (admin) {
    if (req.body.project !== undefined) {
      if (!mongoose.isValidObjectId(req.body.project)) {
        throw ApiError.badRequest("Invalid project", { code: "INVALID_ID" });
      }
      if (!(await Project.exists({ _id: req.body.project }))) {
        throw ApiError.badRequest("The selected project does not exist", { code: "INVALID_REFERENCE" });
      }
      task.project = req.body.project;
    }
    if (req.body.title !== undefined) {
      if (!req.body.title.trim()) throw ApiError.badRequest("Task title cannot be empty", { code: "MISSING_FIELD" });
      task.title = req.body.title.trim();
    }
    if (req.body.description !== undefined) task.description = req.body.description;
    if (req.body.assignee !== undefined) {
      if (req.body.assignee) {
        if (!mongoose.isValidObjectId(req.body.assignee)) {
          throw ApiError.badRequest("Invalid assignee", { code: "INVALID_ID" });
        }
        const assigneeDoc = await Employee.findById(req.body.assignee);
        if (!assigneeDoc) throw ApiError.badRequest("The selected assignee does not exist", { code: "INVALID_REFERENCE" });
        task.assignee = assigneeDoc._id;
      } else {
        task.assignee = undefined;
      }
    }
    if (req.body.priority !== undefined) {
      if (!PRIORITIES.includes(req.body.priority)) {
        throw ApiError.badRequest("Invalid priority", { code: "INVALID_PRIORITY" });
      }
      task.priority = req.body.priority;
    }
    if (req.body.startDate !== undefined) task.startDate = parseOptionalDate(req.body.startDate, "Start date");
    if (req.body.dueDate !== undefined) task.dueDate = parseOptionalDate(req.body.dueDate, "Due date");
    if (req.body.estimatedHours !== undefined) {
      task.estimatedHours = Math.max(0, Number(req.body.estimatedHours) || 0);
    }
  }

  if (req.body.status !== undefined) {
    if (!TASK_STATUSES.includes(req.body.status)) {
      throw ApiError.badRequest("Invalid task status", { code: "INVALID_STATUS" });
    }
    task.status = req.body.status;
    task.completedAt = req.body.status === "Done" ? task.completedAt || new Date() : undefined;
    if (req.body.status !== "Blocked") task.blockedReason = undefined;
  }
  if (req.body.actualHours !== undefined) {
    task.actualHours = Math.max(0, Number(req.body.actualHours) || 0);
  }
  if (req.body.blockedReason !== undefined) {
    task.blockedReason = req.body.blockedReason;
    if (req.body.blockedReason && req.body.status === undefined && task.status !== "Done") {
      task.status = "Blocked";
    }
  }
  if (req.body.notes !== undefined) task.notes = req.body.notes;

  if (task.startDate && task.dueDate && task.dueDate < task.startDate) {
    throw ApiError.badRequest("Due date must be on or after the start date", { code: "INVALID_RANGE" });
  }

  await task.save();

  const changed = Object.keys(req.body).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(task.toObject()[key])
  );

  await recordAudit({
    actor: req.user,
    entityType: "Task",
    entityId: task._id,
    action: "task.updated",
    fromState: before.status,
    toState: task.status,
    reason: changed.join(", ") || "no field changes",
  });

  if (admin && req.body.assignee && String(req.body.assignee) !== String(before.assignee)) {
    const assigneeDoc = await Employee.findById(task.assignee).populate("userId", "name");
    await notifyUser({
      userId: assigneeDoc?.userId?._id,
      type: "Assignment",
      title: "Task assigned to you",
      message: `${task.title} is now assigned to you.`,
      link: "/employee-dashboard/tasks",
    });
  }

  const populated = await populateTask(Task.findById(task._id));
  return res.status(200).json({ success: true, task: populated });
};

export const deleteTask = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw ApiError.notFound("Task not found");

  await Task.deleteOne({ _id: task._id });
  await recordAudit({
    actor: req.user,
    entityType: "Task",
    entityId: task._id,
    action: "task.deleted",
    fromState: task.status,
    reason: task.title,
  });

  return res.status(200).json({ success: true, message: "Task deleted" });
};
