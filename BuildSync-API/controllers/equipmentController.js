import mongoose from "mongoose";
import Equipment from "../models/Equipment.js";
import Project from "../models/Project.js";
import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import Vendor from "../models/Vendor.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import { employeeForUser, escapeRegex, isAdmin } from "../services/accessService.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";

export const EQUIPMENT_CATEGORIES = [
  "Earthmoving",
  "Lifting",
  "Concrete",
  "Compaction",
  "Power",
  "Transport",
  "Survey",
  "Safety",
  "Other",
];
export const EQUIPMENT_STATUSES = ["Available", "In Use", "Maintenance", "Breakdown", "Retired"];

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

const optionalRef = async (Model, id, label) => {
  if (!id) return null;
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest(`Invalid ${label}`, { code: "INVALID_ID" });
  if (!(await Model.exists({ _id: id }))) {
    throw ApiError.badRequest(`The selected ${label} does not exist`, { code: "INVALID_REFERENCE" });
  }
  return id;
};

const populateEquipment = (query) =>
  query
    .populate("site", "dep_name")
    .populate("project", "code name status")
    .populate("vendor", "name category")
    .populate({ path: "operator", select: "employeeId designation userId", populate: { path: "userId", select: "name" } });

export const listEquipment = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50 });
  const filter = {};

  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee) {
      return res.status(200).json({ success: true, equipment: [], pagination: paginationMeta({ page, limit }, 0) });
    }
    filter.$or = [{ site: employee.department }, { operator: employee._id }];
  } else if (!isAdmin(req.user)) {
    throw ApiError.forbidden("Equipment is not available to client accounts", { code: "FORBIDDEN_ROLE" });
  }

  if (req.query.site && isAdmin(req.user)) filter.site = req.query.site;
  if (req.query.project) filter.project = req.query.project;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.ownership) filter.ownership = req.query.ownership;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$and = [...(filter.$and || []), { $or: [{ name: rx }, { code: rx }, { notes: rx }] }];
  }

  let query = populateEquipment(Equipment.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit);
  if (req.user.role === "employee") {
    query = query.select("-dailyRate -hourlyRate -purchaseCost");
  }

  const [equipment, total] = await Promise.all([query.lean(), Equipment.countDocuments(filter)]);

  return res.status(200).json({
    success: true,
    equipment,
    pagination: paginationMeta({ page, limit }, total),
  });
};

export const getEquipment = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid equipment identifier", { code: "INVALID_ID" });
  }
  const equipment = await populateEquipment(Equipment.findById(req.params.id)).lean();
  if (!equipment) throw ApiError.notFound("Equipment not found");

  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    const own =
      String(equipment.site?._id) === String(employee?.department) ||
      String(equipment.operator?._id) === String(employee?._id);
    if (!own) throw ApiError.forbidden("You can only view equipment on your own site", { code: "FORBIDDEN_SITE" });
    delete equipment.dailyRate;
    delete equipment.hourlyRate;
    delete equipment.purchaseCost;
  } else if (!isAdmin(req.user)) {
    throw ApiError.forbidden("Equipment is not available to client accounts", { code: "FORBIDDEN_ROLE" });
  }

  return res.status(200).json({ success: true, equipment });
};

export const createEquipment = async (req, res) => {
  const {
    code,
    name,
    category = "Other",
    ownership = "Owned",
    site: siteId,
    project: projectId,
    status = "Available",
    dailyRate = 0,
    hourlyRate = 0,
    purchaseDate,
    purchaseCost = 0,
    lastMaintenance,
    nextMaintenance,
    operator: operatorId,
    vendor: vendorId,
    notes,
  } = req.body;

  if (!code?.trim()) throw ApiError.badRequest("Equipment code is required", { code: "MISSING_FIELD" });
  if (!name?.trim()) throw ApiError.badRequest("Equipment name is required", { code: "MISSING_FIELD" });
  if (!EQUIPMENT_CATEGORIES.includes(category)) {
    throw ApiError.badRequest("Invalid equipment category", { code: "INVALID_CATEGORY" });
  }
  if (!["Owned", "Rented"].includes(ownership)) {
    throw ApiError.badRequest("Ownership must be Owned or Rented", { code: "INVALID_OWNERSHIP" });
  }
  if (!EQUIPMENT_STATUSES.includes(status)) {
    throw ApiError.badRequest("Invalid equipment status", { code: "INVALID_STATUS" });
  }
  if (await Equipment.exists({ code: code.trim().toUpperCase() })) {
    throw ApiError.conflict("That equipment code is already in use", { code: "DUPLICATE_CODE" });
  }

  const equipment = await Equipment.create({
    code: code.trim().toUpperCase(),
    name: name.trim(),
    category,
    ownership,
    site: (await optionalRef(Department, siteId, "site")) || undefined,
    project: (await optionalRef(Project, projectId, "project")) || undefined,
    status,
    dailyRate: Math.max(0, Number(dailyRate) || 0),
    hourlyRate: Math.max(0, Number(hourlyRate) || 0),
    purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
    purchaseCost: Math.max(0, Number(purchaseCost) || 0),
    lastMaintenance: lastMaintenance ? new Date(lastMaintenance) : undefined,
    nextMaintenance: nextMaintenance ? new Date(nextMaintenance) : undefined,
    operator: (await optionalRef(Employee, operatorId, "operator")) || undefined,
    vendor: (await optionalRef(Vendor, vendorId, "vendor")) || undefined,
    notes,
    createdBy: req.user._id,
  });

  await recordAudit({
    actor: req.user,
    entityType: "Equipment",
    entityId: equipment._id,
    action: "equipment.created",
    reason: `${equipment.code} ${equipment.name}`,
  });

  const populated = await populateEquipment(Equipment.findById(equipment._id));
  return res.status(201).json({ success: true, equipment: populated });
};

export const updateEquipment = async (req, res) => {
  const equipment = await Equipment.findById(req.params.id);
  if (!equipment) throw ApiError.notFound("Equipment not found");
  const before = equipment.toObject();

  if (req.body.name !== undefined) {
    if (!req.body.name.trim()) throw ApiError.badRequest("Name cannot be empty", { code: "MISSING_FIELD" });
    equipment.name = req.body.name.trim();
  }
  if (req.body.category !== undefined) {
    if (!EQUIPMENT_CATEGORIES.includes(req.body.category)) {
      throw ApiError.badRequest("Invalid equipment category", { code: "INVALID_CATEGORY" });
    }
    equipment.category = req.body.category;
  }
  if (req.body.ownership !== undefined) {
    if (!["Owned", "Rented"].includes(req.body.ownership)) {
      throw ApiError.badRequest("Ownership must be Owned or Rented", { code: "INVALID_OWNERSHIP" });
    }
    equipment.ownership = req.body.ownership;
  }
  if (req.body.status !== undefined) {
    if (!EQUIPMENT_STATUSES.includes(req.body.status)) {
      throw ApiError.badRequest("Invalid equipment status", { code: "INVALID_STATUS" });
    }
    equipment.status = req.body.status;
  }
  if (req.body.site !== undefined) {
    equipment.site = (await optionalRef(Department, req.body.site, "site")) || undefined;
  }
  if (req.body.project !== undefined) {
    equipment.project = (await optionalRef(Project, req.body.project, "project")) || undefined;
  }
  if (req.body.operator !== undefined) {
    equipment.operator = (await optionalRef(Employee, req.body.operator, "operator")) || undefined;
  }
  if (req.body.vendor !== undefined) {
    equipment.vendor = (await optionalRef(Vendor, req.body.vendor, "vendor")) || undefined;
  }
  if (req.body.dailyRate !== undefined) equipment.dailyRate = Math.max(0, Number(req.body.dailyRate) || 0);
  if (req.body.hourlyRate !== undefined) equipment.hourlyRate = Math.max(0, Number(req.body.hourlyRate) || 0);
  if (req.body.purchaseCost !== undefined) equipment.purchaseCost = Math.max(0, Number(req.body.purchaseCost) || 0);
  if (req.body.purchaseDate !== undefined) {
    equipment.purchaseDate = req.body.purchaseDate ? new Date(req.body.purchaseDate) : undefined;
  }
  if (req.body.lastMaintenance !== undefined) {
    equipment.lastMaintenance = req.body.lastMaintenance ? new Date(req.body.lastMaintenance) : undefined;
  }
  if (req.body.nextMaintenance !== undefined) {
    equipment.nextMaintenance = req.body.nextMaintenance ? new Date(req.body.nextMaintenance) : undefined;
  }
  if (req.body.notes !== undefined) equipment.notes = req.body.notes;

  await equipment.save();
  await recordAudit({
    actor: req.user,
    entityType: "Equipment",
    entityId: equipment._id,
    action: "equipment.updated",
    fromState: before.status,
    toState: equipment.status,
    reason: `${equipment.code} ${equipment.name}`,
  });

  const populated = await populateEquipment(Equipment.findById(equipment._id));
  return res.status(200).json({ success: true, equipment: populated });
};

export const retireEquipment = async (req, res) => {
  const equipment = await Equipment.findById(req.params.id);
  if (!equipment) throw ApiError.notFound("Equipment not found");
  if (equipment.status === "Retired") {
    throw ApiError.conflict("Equipment is already retired", { code: "EQUIPMENT_RETIRED" });
  }
  if (equipment.status === "In Use") {
    throw ApiError.conflict("Return the equipment from site before retiring it", { code: "EQUIPMENT_IN_USE" });
  }

  const previous = equipment.status;
  equipment.status = "Retired";
  await equipment.save();
  await recordAudit({
    actor: req.user,
    entityType: "Equipment",
    entityId: equipment._id,
    action: "equipment.retired",
    fromState: previous,
    toState: "Retired",
    reason: req.body.reason,
  });
  return res.status(200).json({ success: true, message: "Equipment retired. History preserved." });
};

export const equipmentSummary = async (req, res) => {
  const match = {};
  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee) return res.status(200).json({ success: true, summary: { total: 0, byStatus: {}, utilization: 0, maintenanceDue: 0, rentalValue: 0 } });
    match.$or = [{ site: employee.department }, { operator: employee._id }];
  } else if (!isAdmin(req.user)) {
    throw ApiError.forbidden("Equipment is not available to client accounts", { code: "FORBIDDEN_ROLE" });
  }

  const [byStatus, rentalValue] = await Promise.all([
    Equipment.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Equipment.aggregate([
      { $match: { ...match, ownership: "Rented", status: { $ne: "Retired" } } },
      { $group: { _id: null, total: { $sum: "$dailyRate" } } },
    ]),
  ]);

  const statuses = byStatus.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});
  const total = Object.values(statuses).reduce((sum, value) => sum + value, 0);
  const soon = new Date(Date.now() + 14 * 86400000);
  const maintenanceDue = await Equipment.countDocuments({
    ...match,
    status: { $ne: "Retired" },
    nextMaintenance: { $lte: soon },
  });

  return res.status(200).json({
    success: true,
    summary: {
      total,
      byStatus: statuses,
      utilization: total ? Math.round(((statuses["In Use"] || 0) / total) * 100) : 0,
      maintenanceDue,
      // Rental spend is commercial information; field staff get the
      // operational picture only.
      rentalValue: isAdmin(req.user) ? round(rentalValue[0]?.total || 0) : 0,
    },
  });
};

export default {
  listEquipment,
  getEquipment,
  createEquipment,
  updateEquipment,
  retireEquipment,
  equipmentSummary,
};
