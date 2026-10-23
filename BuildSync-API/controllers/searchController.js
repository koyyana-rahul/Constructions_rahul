import mongoose from "mongoose";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Client from "../models/Client.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Invoice from "../models/Invoice.js";
import WorkRequest from "../models/Work.js";
import Material from "../models/Material.js";
import Vendor from "../models/Vendor.js";
import Equipment from "../models/Equipment.js";
import DocumentFile from "../models/DocumentFile.js";
import SafetyIncident from "../models/SafetyIncident.js";
import ApiError from "../utils/ApiError.js";
import {
  projectVisibilityFilter,
  clientForUser,
  employeeForUser,
  escapeRegex,
  isAdmin,
} from "../services/accessService.js";

const LIMIT = 5;

const linkFor = (role, resource, id) => {
  if (role === "client") {
    const map = { project: "projects", invoice: "invoices", workRequest: "work", document: "documents" };
    return map[resource] ? `/client-dashboard/${map[resource]}/${id}` : null;
  }
  if (role === "employee") {
    const map = { project: "projects", task: "tasks", document: "documents", equipment: "equipment", material: "inventory" };
    return map[resource] ? `/employee-dashboard/${map[resource]}/${id}` : null;
  }
  const map = {
    project: "projects",
    task: "tasks",
    invoice: "invoices",
    workRequest: "work",
    employee: "employees",
    client: "clients",
    material: "inventory",
    vendor: "vendors",
    equipment: "equipment",
    document: "documents",
    safety: "safety",
  };
  return map[resource] ? `/admin-dashboard/${map[resource]}/${id}` : null;
};

/** Global, role-scoped search. Nothing outside the caller's scope is queried. */
export const globalSearch = async (req, res) => {
  const term = String(req.query.q || "").trim();
  if (term.length < 2) {
    throw ApiError.badRequest("Enter at least two characters to search", { code: "QUERY_TOO_SHORT" });
  }
  const rx = new RegExp(escapeRegex(term), "i");
  const role = req.user.role;
  const groups = [];

  const add = (type, label, items) => {
    if (items.length) groups.push({ type, label, items });
  };

  if (role === "admin" || role === "employee" || role === "client") {
    const visibility = await projectVisibilityFilter(req.user);
    const projects = await Project.find({
      ...visibility,
      isArchived: { $ne: true },
      $or: [{ name: rx }, { code: rx }, { description: rx }, { tags: rx }],
    })
      .select("code name status progress health")
      .sort({ createdAt: -1 })
      .limit(LIMIT)
      .lean();
    add(
      "project",
      "Projects",
      projects.map((p) => ({
        id: p._id,
        title: p.name,
        subtitle: `${p.code} · ${p.status}${p.health ? ` · ${p.health}` : ""}`,
        status: p.status,
        link: linkFor(role, "project", p._id),
      }))
    );
  }

  if (role === "admin" || role === "employee") {
    const taskFilter = { $or: [{ title: rx }, { description: rx }] };
    if (role === "employee") {
      const employee = await employeeForUser(req.user._id);
      taskFilter.assignee = employee?._id || null;
    }
    const tasks = await Task.find(taskFilter)
      .populate("project", "code name")
      .select("title status priority dueDate project")
      .sort({ dueDate: 1 })
      .limit(LIMIT)
      .lean();
    add(
      "task",
      "Tasks",
      tasks.map((t) => ({
        id: t._id,
        title: t.title,
        subtitle: `${t.project?.code || "Project"} · ${t.status} · ${t.priority}`,
        status: t.status,
        link: linkFor(role, "task", t._id),
      }))
    );
  }

  if (role === "admin") {
    const users = await User.find({
      role: "employee",
      $or: [{ name: rx }, { email: rx }],
    })
      .select("name email")
      .limit(LIMIT)
      .lean();
    const employees = users.length
      ? await Employee.find({ userId: { $in: users.map((u) => u._id) } })
          .populate("department", "dep_name")
          .select("employeeId designation department userId")
          .lean()
      : [];
    const byUserId = new Map(employees.map((e) => [String(e.userId), e]));
    add(
      "employee",
      "Employees",
      users
        .filter((u) => byUserId.has(String(u._id)))
        .map((u) => {
          const employee = byUserId.get(String(u._id));
          return {
            id: employee._id,
            title: u.name,
            subtitle: `${employee.employeeId} · ${employee.designation || "Employee"} · ${employee.department?.dep_name || "No site"}`,
            status: "Active",
            link: linkFor(role, "employee", employee._id),
          };
        })
    );

    const clients = await Client.find({ companyName: rx })
      .populate("userId", "name email")
      .select("companyName entityType phone userId")
      .limit(LIMIT)
      .lean();
    add(
      "client",
      "Clients",
      clients.map((c) => ({
        id: c._id,
        title: c.companyName || c.userId?.name || "Client",
        subtitle: `${c.entityType === "legal" ? "Company" : "Individual"} · ${c.userId?.email || ""}`,
        status: c.entityType,
        link: linkFor(role, "client", c._id),
      }))
    );
  }

  if (role === "admin" || role === "client") {
    const invoiceFilter = { $or: [{ number: rx }, { notes: rx }] };
    if (role === "client") {
      const client = await clientForUser(req.user._id);
      invoiceFilter.client = client?._id || null;
      invoiceFilter.status = { $nin: ["Draft", "Cancelled"] };
    } else if (req.query.client) {
      invoiceFilter.client = req.query.client;
    }
    const invoices = await Invoice.find(invoiceFilter)
      .populate("project", "code name")
      .select("number status total amountPaid dueDate project")
      .sort({ issueDate: -1 })
      .limit(LIMIT)
      .lean();
    add(
      "invoice",
      "Invoices",
      invoices.map((i) => ({
        id: i._id,
        title: i.number,
        subtitle: `${i.project?.code || "Project"} · ${i.status} · due ${new Date(i.dueDate).toLocaleDateString()}`,
        status: i.status,
        link: linkFor(role, "invoice", i._id),
      }))
    );

    const workFilter = { $or: [{ name: rx }, { description: rx }] };
    if (role === "client") {
      const client = await clientForUser(req.user._id);
      workFilter.clientId = client?._id || null;
    }
    const requests = await WorkRequest.find(workFilter)
      .select("name status startDate endDate")
      .sort({ appliedAt: -1 })
      .limit(LIMIT)
      .lean();
    add(
      "workRequest",
      "Work requests",
      requests.map((w) => ({
        id: w._id,
        title: w.name,
        subtitle: `${w.status} · ${new Date(w.startDate).toLocaleDateString()} → ${new Date(w.endDate).toLocaleDateString()}`,
        status: w.status,
        link: role === "client" ? `/client-dashboard/work/${req.user._id}` : linkFor(role, "workRequest", w._id),
      }))
    );
  }

  if (role === "admin" || role === "employee") {
    const materialFilter = { isActive: { $ne: false }, $or: [{ name: rx }, { sku: rx }] };
    const materials = await Material.find(materialFilter)
      .select(role === "employee" ? "sku name unit" : "sku name unit unitCost")
      .limit(LIMIT)
      .lean();
    add(
      "material",
      "Materials",
      materials.map((m) => ({
        id: m._id,
        title: m.name,
        // Commercial cost is administrator-only. Showing it here leaked it
        // through the global search even though the inventory endpoints hide it.
        subtitle: `${m.sku} · ${m.unit}${m.unitCost !== undefined ? ` · ${m.unitCost}` : ""}`,
        status: "Active",
        link: linkFor(role, "material", m._id),
      }))
    );

    const equipmentFilter = { $or: [{ name: rx }, { code: rx }] };
    if (role === "employee") {
      const employee = await employeeForUser(req.user._id);
      equipmentFilter.site = employee?.department || null;
    }
    const equipment = await Equipment.find(equipmentFilter)
      .select("code name status category")
      .limit(LIMIT)
      .lean();
    add(
      "equipment",
      "Equipment",
      equipment.map((e) => ({
        id: e._id,
        title: e.name,
        subtitle: `${e.code} · ${e.category} · ${e.status}`,
        status: e.status,
        link: linkFor(role, "equipment", e._id),
      }))
    );
  }

  if (role === "admin") {
    const vendors = await Vendor.find({ name: rx }).select("name category isActive").limit(LIMIT).lean();
    add(
      "vendor",
      "Vendors",
      vendors.map((v) => ({
        id: v._id,
        title: v.name,
        subtitle: v.category,
        status: v.isActive === false ? "Inactive" : "Active",
        link: linkFor(role, "vendor", v._id),
      }))
    );
  }

  if (role === "admin" || role === "employee" || role === "client") {
    const searchOr = { $or: [{ name: rx }, { originalName: rx }, { notes: rx }] };
    let docFilter = searchOr;

    if (role === "client") {
      const client = await clientForUser(req.user._id);
      const projectIds = client
        ? (await Project.find({ client: client._id }).select("_id").lean()).map((p) => p._id)
        : [];
      docFilter = {
        ...searchOr,
        project: { $in: projectIds },
        isClientVisible: true,
      };
    } else if (role === "employee") {
      const employee = await employeeForUser(req.user._id);
      const projectIds = employee
        ? (
            await Project.find({
              $or: [{ team: employee._id }, { manager: employee._id }, { site: employee.department }],
            })
              .select("_id")
              .lean()
          ).map((p) => p._id)
        : [];
      // Keep the text filter and the access scope as separate $or clauses.
      // Merging them made every document on the employee's site match, even
      // when it had nothing to do with the search term.
      docFilter = {
        $and: [
          searchOr,
          {
            $or: [
              { site: employee?.department || null },
              { project: { $in: projectIds } },
              { uploadedBy: req.user._id },
            ],
          },
        ],
      };
    }
    const documents = await DocumentFile.find(docFilter)
      .select("name category project originalName createdAt")
      .sort({ createdAt: -1 })
      .limit(LIMIT)
      .lean();
    add(
      "document",
      "Documents",
      documents.map((d) => ({
        id: d._id,
        title: d.name,
        subtitle: `${d.category} · ${d.originalName || "file"}`,
        status: d.category,
        link: linkFor(role, "document", d._id),
      }))
    );
  }

  if (role === "admin" || role === "employee") {
    const safetyFilter = { $or: [{ title: rx }, { description: rx }] };
    if (role === "employee") {
      const employee = await employeeForUser(req.user._id);
      safetyFilter.site = employee?.department || null;
    }
    const incidents = await SafetyIncident.find(safetyFilter)
      .select("title status severity type date")
      .sort({ date: -1 })
      .limit(LIMIT)
      .lean();
    add(
      "safety",
      "Safety",
      incidents.map((i) => ({
        id: i._id,
        title: i.title,
        subtitle: `${i.type} · ${i.severity} · ${new Date(i.date).toLocaleDateString()}`,
        status: i.status,
        link: linkFor(role, "safety", i._id),
      }))
    );
  }

  return res.status(200).json({
    success: true,
    query: term,
    groups,
    total: groups.reduce((sum, group) => sum + group.items.length, 0),
  });
};

/** Type-ahead suggestions for the search field: only titles and links. */
export const searchSuggestions = async (req, res) => {
  const term = String(req.query.q || "").trim();
  if (term.length < 2) return res.status(200).json({ success: true, suggestions: [] });
  const rx = new RegExp(escapeRegex(term), "i");
  const role = req.user.role;
  const suggestions = [];

  if (role === "admin" || role === "employee" || role === "client") {
    const visibility = await projectVisibilityFilter(req.user);
    const projects = await Project.find({ ...visibility, isArchived: { $ne: true }, $or: [{ name: rx }, { code: rx }] })
      .select("code name")
      .limit(3)
      .lean();
    suggestions.push(
      ...projects.map((p) => ({
        type: "project",
        title: p.name,
        subtitle: p.code,
        link: linkFor(role, "project", p._id),
      }))
    );
  }

  if (role === "admin" || role === "employee") {
    const employee = role === "employee" ? await employeeForUser(req.user._id) : null;
    const tasks = await Task.find({
      ...(employee ? { assignee: employee._id } : {}),
      title: rx,
    })
      .select("title status")
      .limit(3)
      .lean();
    suggestions.push(
      ...tasks.map((t) => ({
        type: "task",
        title: t.title,
        subtitle: t.status,
        link: linkFor(role, "task", t._id),
      }))
    );
  }

  return res.status(200).json({ success: true, suggestions: suggestions.slice(0, 8) });
};

export default { globalSearch, searchSuggestions };
