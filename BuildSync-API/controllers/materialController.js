import mongoose from "mongoose";
import Material from "../models/Material.js";
import StockMovement from "../models/StockMovement.js";
import Department from "../models/Department.js";
import Vendor from "../models/Vendor.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import { employeeForUser, escapeRegex, isAdmin } from "../services/accessService.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { nextMaterialSku } from "../services/numberingService.js";
import { recordMovement, stockMapForSite, stockFor } from "../services/inventoryService.js";
import { lowStockList } from "../services/reportService.js";

export const MATERIAL_CATEGORIES = [
  "Concrete",
  "Steel",
  "Masonry",
  "Plumbing",
  "Electrical",
  "Finishes",
  "Timber",
  "Hardware",
  "Safety",
  "Other",
];

export const MOVEMENT_TYPES = ["In", "Out", "Adjustment"];

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

/** Resolves the site a caller is allowed to work with. */
const resolveSite = async (user, siteId, { required = false } = {}) => {
  if (!siteId) {
    if (user.role === "employee") {
      const employee = await employeeForUser(user._id);
      if (employee?.department) return employee.department;
    }
    if (required) {
      throw ApiError.badRequest("A construction site is required", { code: "MISSING_FIELD" });
    }
    return null;
  }

  if (!mongoose.isValidObjectId(siteId)) {
    throw ApiError.badRequest("Invalid site", { code: "INVALID_ID" });
  }
  const site = await Department.findById(siteId).select("_id dep_name isArchived");
  if (!site) throw ApiError.badRequest("The selected site does not exist", { code: "INVALID_REFERENCE" });
  if (site.isArchived) {
    throw ApiError.conflict("That site is archived", { code: "SITE_ARCHIVED" });
  }

  if (user.role === "employee") {
    const employee = await employeeForUser(user._id);
    if (!employee || String(employee.department) !== String(site._id)) {
      throw ApiError.forbidden("You can only access stock on your own site", {
        code: "FORBIDDEN_SITE",
      });
    }
  }

  return site._id;
};

const requireInventoryRole = (user) => {
  if (!["admin", "employee"].includes(user.role)) {
    throw ApiError.forbidden("Inventory is not available to client accounts", {
      code: "FORBIDDEN_ROLE",
    });
  }
};

export const listMaterials = async (req, res) => {
  requireInventoryRole(req.user);
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50 });

  const filter = {};
  if (req.query.includeInactive !== "true") filter.isActive = { $ne: false };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = [{ name: rx }, { sku: rx }, { description: rx }];
  }
  if (req.query.lowStock === "true") {
    // Handled after balances are attached, because low stock is derived.
    filter.isActive = { $ne: false };
  }

  const [materials, total] = await Promise.all([
    Material.find(filter)
      .populate("preferredVendor", "name category")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Material.countDocuments(filter),
  ]);

  let site = null;
  if (req.query.site || req.user.role === "employee") {
    site = await resolveSite(req.user, req.query.site || null);
  }

  if (site && materials.length) {
    const balances = await stockMapForSite(
      site,
      materials.map((m) => m._id)
    );
    for (const material of materials) {
      const row = balances[String(material._id)];
      material.stock = {
        onHand: round(row?.balance || 0),
        value: round(Math.abs(row?.balance || 0) * (material.unitCost || 0)),
        lastMovementAt: row?.lastMovementAt || null,
        low: round(row?.balance || 0) <= (material.reorderLevel || 0),
      };
    }
  }

  const filtered =
    req.query.lowStock === "true"
      ? materials.filter((m) => m.stock && m.stock.low)
      : materials;

  // Cost data is commercial. Employees may work with quantities, never value.
  if (req.user.role === "employee") {
    for (const material of filtered) {
      delete material.unitCost;
      if (material.stock) delete material.stock.value;
    }
  }

  return res.status(200).json({
    success: true,
    site,
    materials: filtered,
    pagination: paginationMeta({ page, limit }, req.query.lowStock === "true" ? filtered.length : total),
  });
};

export const getMaterial = async (req, res) => {
  requireInventoryRole(req.user);
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid material identifier", { code: "INVALID_ID" });
  }

  const material = await Material.findById(req.params.id)
    .populate("preferredVendor", "name category email phone")
    .lean();
  if (!material) throw ApiError.notFound("Material not found");

  const siteFilter = {};
  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee) throw ApiError.forbidden("No employee profile is linked to this account", { code: "NO_EMPLOYEE_PROFILE" });
    siteFilter.site = employee.department;
  } else if (req.query.site && mongoose.isValidObjectId(req.query.site)) {
    siteFilter.site = req.query.site;
  }

  const balances = await StockMovement.aggregate([
    { $match: { material: material._id, ...siteFilter } },
    {
      $group: {
        _id: "$site",
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
        lastMovementAt: { $max: "$date" },
      },
    },
    { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "site" } },
    { $unwind: "$site" },
    {
      $project: {
        _id: 0,
        site: { _id: "$site._id", name: "$site.dep_name" },
        balance: { $round: ["$balance", 2] },
        lastMovementAt: 1,
      },
    },
  ]);

  if (req.user.role === "employee") {
    delete material.unitCost;
  }

  return res.status(200).json({ success: true, material, balances });
};

export const createMaterial = async (req, res) => {
  const { name, category = "Other", unit, unitCost = 0, reorderLevel = 0, preferredVendor, description } = req.body;

  if (!name?.trim()) throw ApiError.badRequest("Material name is required", { code: "MISSING_FIELD" });
  if (!unit?.trim()) throw ApiError.badRequest("Unit of measure is required", { code: "MISSING_FIELD" });
  if (!MATERIAL_CATEGORIES.includes(category)) {
    throw ApiError.badRequest("Invalid material category", { code: "INVALID_CATEGORY" });
  }
  if (preferredVendor && !(await Vendor.exists({ _id: preferredVendor }))) {
    throw ApiError.badRequest("The selected vendor does not exist", { code: "INVALID_REFERENCE" });
  }

  const sku = String(req.body.sku || "").trim().toUpperCase() || (await nextMaterialSku());
  if (await Material.exists({ sku })) {
    throw ApiError.conflict("That material code is already in use", { code: "DUPLICATE_SKU" });
  }

  const material = await Material.create({
    sku,
    name: name.trim(),
    category,
    unit: unit.trim(),
    unitCost: Math.max(0, Number(unitCost) || 0),
    reorderLevel: Math.max(0, Number(reorderLevel) || 0),
    preferredVendor: preferredVendor || undefined,
    description,
    createdBy: req.user._id,
  });

  await recordAudit({
    actor: req.user,
    entityType: "Material",
    entityId: material._id,
    action: "material.created",
    reason: `${material.sku} ${material.name}`,
  });

  return res.status(201).json({ success: true, material });
};

export const updateMaterial = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw ApiError.notFound("Material not found");

  const before = material.toObject();
  if (req.body.name !== undefined) {
    if (!req.body.name.trim()) throw ApiError.badRequest("Material name cannot be empty", { code: "MISSING_FIELD" });
    material.name = req.body.name.trim();
  }
  if (req.body.category !== undefined) {
    if (!MATERIAL_CATEGORIES.includes(req.body.category)) {
      throw ApiError.badRequest("Invalid material category", { code: "INVALID_CATEGORY" });
    }
    material.category = req.body.category;
  }
  if (req.body.unit !== undefined) {
    if (!req.body.unit.trim()) throw ApiError.badRequest("Unit cannot be empty", { code: "MISSING_FIELD" });
    material.unit = req.body.unit.trim();
  }
  if (req.body.unitCost !== undefined) material.unitCost = Math.max(0, Number(req.body.unitCost) || 0);
  if (req.body.reorderLevel !== undefined) {
    material.reorderLevel = Math.max(0, Number(req.body.reorderLevel) || 0);
  }
  if (req.body.preferredVendor !== undefined) {
    if (req.body.preferredVendor && !(await Vendor.exists({ _id: req.body.preferredVendor }))) {
      throw ApiError.badRequest("The selected vendor does not exist", { code: "INVALID_REFERENCE" });
    }
    material.preferredVendor = req.body.preferredVendor || undefined;
  }
  if (req.body.description !== undefined) material.description = req.body.description;
  if (req.body.isActive !== undefined) material.isActive = Boolean(req.body.isActive);

  await material.save();
  await recordAudit({
    actor: req.user,
    entityType: "Material",
    entityId: material._id,
    action: "material.updated",
    reason: before.name !== material.name ? `${before.name} -> ${material.name}` : "details updated",
  });

  return res.status(200).json({ success: true, material });
};

export const archiveMaterial = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw ApiError.notFound("Material not found");
  if (!material.isActive) {
    throw ApiError.conflict("Material is already inactive", { code: "MATERIAL_INACTIVE" });
  }

  const movements = await StockMovement.countDocuments({ material: material._id });
  const balance = await StockMovement.aggregate([
    { $match: { material: material._id } },
    {
      $group: {
        _id: null,
        total: {
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
  ]).then((rows) => round(rows[0]?.total || 0));

  if (balance > 0) {
    throw ApiError.conflict(
      `This material still has ${balance} ${material.unit} on hand. Issue or adjust the stock before deactivating it.`,
      { code: "STOCK_ON_HAND", details: { balance, movements } }
    );
  }

  material.isActive = false;
  await material.save();

  await recordAudit({
    actor: req.user,
    entityType: "Material",
    entityId: material._id,
    action: "material.deactivated",
    reason: `${material.sku} ${material.name}`,
  });

  return res.status(200).json({ success: true, message: "Material deactivated. Its history is preserved." });
};

/** Stock on hand at one site, with value and reorder status. */
export const listStock = async (req, res) => {
  requireInventoryRole(req.user);
  const site = await resolveSite(req.user, req.query.site || null, { required: true });

  const materials = await Material.find({ isActive: { $ne: false } })
    .select("sku name category unit unitCost reorderLevel")
    .sort({ name: 1 })
    .lean();

  const balances = await stockMapForSite(site, materials.map((m) => m._id));
  const commercial = isAdmin(req.user);
  const rows = materials.map((material) => {
    const row = balances[String(material._id)];
    const onHand = round(row?.balance || 0);
    const { unitCost, ...operational } = material;
    return {
      ...operational,
      ...(commercial
        ? { unitCost, stockValue: round(Math.abs(onHand) * (unitCost || 0)) }
        : {}),
      onHand,
      low: onHand <= (material.reorderLevel || 0),
      outOfStock: onHand <= 0,
      lastMovementAt: row?.lastMovementAt || null,
    };
  });

  const siteDoc = await Department.findById(site).select("dep_name");

  return res.status(200).json({
    success: true,
    site: siteDoc,
    stock: rows,
    summary: {
      materials: rows.length,
      lowStock: rows.filter((r) => r.low).length,
      outOfStock: rows.filter((r) => r.outOfStock).length,
      ...(commercial
        ? { stockValue: round(rows.reduce((sum, row) => sum + row.stockValue, 0)) }
        : {}),
    },
  });
};

/** Append-only movement history. */
export const listMovements = async (req, res) => {
  requireInventoryRole(req.user);
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50 });
  const filter = {};

  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee) {
      return res.status(200).json({ success: true, movements: [], pagination: paginationMeta({ page, limit }, 0) });
    }
    filter.site = employee.department;
  } else if (req.query.site) {
    filter.site = req.query.site;
  }

  if (req.query.material) {
    if (!mongoose.isValidObjectId(req.query.material)) {
      throw ApiError.badRequest("Invalid material", { code: "INVALID_ID" });
    }
    filter.material = req.query.material;
  }
  if (req.query.type) filter.type = req.query.type;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) {
      const to = new Date(req.query.to);
      to.setHours(23, 59, 59, 999);
      filter.date.$lte = to;
    }
  }
  if (req.query.search) {
    filter.reference = new RegExp(escapeRegex(req.query.search), "i");
  }

  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .populate("material", "sku name unit")
      .populate("site", "dep_name")
      .populate("createdBy", "name role")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  // Purchase valuation is commercial data. The inventory ledger itself is
  // still visible to site staff, but unitCost is administrator-only.
  if (!isAdmin(req.user)) {
    for (const movement of movements) delete movement.unitCost;
  }

  return res.status(200).json({
    success: true,
    movements,
    pagination: paginationMeta({ page, limit }, total),
  });
};

/** Record a goods receipt, site issue or signed correction. */
export const createMovement = async (req, res) => {
  const { material: materialId, site: siteId, type, quantity, unitCost, reference, note, date } = req.body;

  if (!mongoose.isValidObjectId(materialId)) {
    throw ApiError.badRequest("A material is required", { code: "MISSING_FIELD" });
  }
  if (!MOVEMENT_TYPES.includes(type)) {
    throw ApiError.badRequest("Movement type must be In, Out or Adjustment", { code: "INVALID_TYPE" });
  }
  // A correction rewrites the on-hand balance, so it is reserved for an
  // administrator. Field staff may record receipts and issues only.
  if (type === "Adjustment" && !isAdmin(req.user)) {
    throw ApiError.forbidden("Only an administrator can post a stock adjustment", {
      code: "FORBIDDEN_ROLE",
    });
  }

  const material = await Material.findById(materialId);
  if (!material) throw ApiError.badRequest("The selected material does not exist", { code: "INVALID_REFERENCE" });
  if (material.isActive === false) {
    throw ApiError.conflict("This material is inactive", { code: "MATERIAL_INACTIVE" });
  }

  const site = await resolveSite(req.user, siteId, { required: true });

  // Employees record physical movements; the valuation always comes from the
  // material master so a request body can never set the accounting cost.
  const movementCost =
    isAdmin(req.user) && unitCost !== undefined ? Number(unitCost) : material.unitCost;

  const { movement, balanceAfter } = await recordMovement({
    material: material._id,
    site,
    type,
    quantity: Number(quantity),
    unitCost: movementCost,
    reference,
    note,
    date: date ? new Date(date) : new Date(),
    source: type === "Adjustment" ? "Correction" : type === "In" ? "Purchase" : "Manual",
    createdBy: req.user._id,
  });

  await recordAudit({
    actor: req.user,
    entityType: "StockMovement",
    entityId: movement._id,
    action: `stock.${type.toLowerCase()}`,
    reason: `${material.sku} ${type} ${Math.abs(Number(quantity))} ${material.unit}`,
  });

  if (!isAdmin(req.user)) {
    const view = movement.toObject();
    delete view.unitCost;
    return res.status(201).json({ success: true, movement: view, balanceAfter });
  }

  return res.status(201).json({ success: true, movement, balanceAfter });
};

/** Low stock across the sites the caller may see. */
export const getLowStock = async (req, res) => {
  requireInventoryRole(req.user);
  let site = req.query.site;
  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    site = employee?.department || null;
  }
  const low = await lowStockList(site || null);
  return res.status(200).json({ success: true, lowStock: low });
};

/** Catalogue plus balance for the material detail drawer. */
export const getMaterialStock = async (req, res) => {
  requireInventoryRole(req.user);
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid material identifier", { code: "INVALID_ID" });
  }
  const material = await Material.findById(req.params.id).lean();
  if (!material) throw ApiError.notFound("Material not found");

  const site = await resolveSite(req.user, req.query.site || null, { required: true });
  const stock = await stockFor(material._id, site);
  const recent = await StockMovement.find({ material: material._id, site })
    .populate("createdBy", "name")
    .sort({ date: -1 })
    .limit(20)
    .lean();

  if (!isAdmin(req.user)) {
    delete material.unitCost;
    for (const movement of recent) delete movement.unitCost;
  }

  return res.status(200).json({
    success: true,
    material,
    stock: { onHand: round(stock.balance), movements: stock.movements },
    recent,
  });
};

export default {
  listMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  archiveMaterial,
  listStock,
  listMovements,
  createMovement,
  getLowStock,
  getMaterialStock,
};
