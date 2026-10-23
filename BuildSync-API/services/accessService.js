import Employee from "../models/Employee.js";
import Client from "../models/Client.js";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import ApiError from "../utils/ApiError.js";

/**
 * Central role-scoping helpers.
 *
 * Every new module asks one of these functions "what may this caller see?"
 * instead of re-implementing the answer. The scope is ALWAYS derived from
 * `req.user`, never from an id in the request body.
 */

export const employeeForUser = async (userId) =>
  Employee.findOne({ userId }).select("_id userId department designation");

export const clientForUser = async (userId) =>
  Client.findOne({ userId }).select("_id userId companyName");

export const isAdmin = (user) => user?.role === "admin";

/**
 * Mongo filter for projects visible to a user.
 *
 * admin    -> every project
 * client   -> projects belonging to that client
 * employee -> projects where they are manager or team member, OR that are on
 *             their assigned site, OR where they have a task
 */
export const projectVisibilityFilter = async (user) => {
  if (!user) return { _id: null };
  if (isAdmin(user)) return {};

  if (user.role === "client") {
    const client = await clientForUser(user._id);
    return client ? { client: client._id } : { _id: null };
  }

  if (user.role === "employee") {
    const employee = await employeeForUser(user._id);
    if (!employee) return { _id: null };

    const assignedProjectIds = await Task.distinct("project", { assignee: employee._id });
    return {
      $or: [
        { manager: employee._id },
        { team: employee._id },
        { site: employee.department },
        { _id: { $in: assignedProjectIds } },
      ],
    };
  }

  return { _id: null };
};

/**
 * Resolves a reference that may be a raw ObjectId or a populated document to
 * its string id. Never rely on `String(document)` for populated fields.
 */
const refId = (value) => {
  const raw = value && typeof value === "object" && "_id" in value ? value._id : value;
  return raw ? String(raw) : "";
};

/** True when the user is allowed to open this project. */
export const canAccessProject = async (user, project) => {
  if (!user || !project) return false;
  if (isAdmin(user)) return true;

  if (user.role === "client") {
    const client = await clientForUser(user._id);
    return Boolean(client && refId(project.client) === String(client._id));
  }

  if (user.role === "employee") {
    const employee = await employeeForUser(user._id);
    if (!employee) return false;

    const inTeam = (project.team || []).some((id) => refId(id) === String(employee._id));
    const isManager = refId(project.manager) === String(employee._id);
    const onSite = refId(project.site) === String(employee.department);
    if (inTeam || isManager || onSite) return true;

    return Boolean(await Task.exists({ project: project._id, assignee: employee._id }));
  }

  return false;
};

export const assertProjectAccess = async (user, project) => {
  if (!(await canAccessProject(user, project))) {
    throw ApiError.forbidden("You do not have access to this project", {
      code: "FORBIDDEN_PROJECT",
    });
  }
  return true;
};

/** Site ids an employee may read. Admins get `null` (no restriction). */
export const siteIdsForUser = async (user) => {
  if (!user || isAdmin(user)) return null;
  if (user.role !== "employee") return [];
  const employee = await employeeForUser(user._id);
  return employee?.department ? [employee.department] : [];
};

export const projectIdsForClient = async (user) => {
  if (user?.role !== "client") return null;
  const client = await clientForUser(user._id);
  if (!client) return [];
  const projects = await Project.find({ client: client._id }).select("_id").lean();
  return projects.map((p) => p._id);
};

/** Escapes user input before it is used inside a Mongo $regex. */
export const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
