import mongoose from "mongoose";
import Vendor from "../models/Vendor.js";
import Material from "../models/Material.js";
import Expense from "../models/Expense.js";
import Equipment from "../models/Equipment.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import { escapeRegex } from "../services/accessService.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";

export const VENDOR_CATEGORIES = [
  "Materials",
  "Equipment",
  "Subcontractor",
  "Transport",
  "Consultant",
  "Other",
];

export const listVendors = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50 });
  const filter = {};
  if (req.query.includeInactive !== "true") filter.isActive = { $ne: false };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = [{ name: rx }, { contactName: rx }, { email: rx }, { phone: rx }, { gstin: rx }];
  }

  const [vendors, total] = await Promise.all([
    Vendor.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Vendor.countDocuments(filter),
  ]);

  if (vendors.length) {
    const ids = vendors.map((v) => v._id);
    const [spend, materials] = await Promise.all([
      Expense.aggregate([
        { $match: { vendor: { $in: ids }, status: { $in: ["Approved", "Paid"] } } },
        { $group: { _id: "$vendor", total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      Material.aggregate([
        { $match: { preferredVendor: { $in: ids } } },
        { $group: { _id: "$preferredVendor", count: { $sum: 1 } } },
      ]),
    ]);
    const spendMap = spend.reduce((acc, row) => {
      acc[String(row._id)] = row;
      return acc;
    }, {});
    const materialMap = materials.reduce((acc, row) => {
      acc[String(row._id)] = row.count;
      return acc;
    }, {});
    for (const vendor of vendors) {
      vendor.spend = Math.round((spendMap[String(vendor._id)]?.total || 0) * 100) / 100;
      vendor.expenseCount = spendMap[String(vendor._id)]?.count || 0;
      vendor.materialCount = materialMap[String(vendor._id)] || 0;
    }
  }

  return res.status(200).json({
    success: true,
    vendors,
    pagination: paginationMeta({ page, limit }, total),
  });
};

export const getVendor = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid vendor identifier", { code: "INVALID_ID" });
  }
  const vendor = await Vendor.findById(req.params.id).lean();
  if (!vendor) throw ApiError.notFound("Vendor not found");

  const [expenses, materials, equipment, totals] = await Promise.all([
    Expense.find({ vendor: vendor._id })
      .populate("project", "code name")
      .sort({ date: -1 })
      .limit(25)
      .lean(),
    Material.find({ preferredVendor: vendor._id }).select("sku name unit unitCost").limit(25).lean(),
    Equipment.find({ vendor: vendor._id }).select("code name status").limit(25).lean(),
    Expense.aggregate([
      { $match: { vendor: vendor._id, status: { $in: ["Approved", "Paid"] } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
  ]);

  return res.status(200).json({
    success: true,
    vendor,
    expenses,
    materials,
    equipment,
    spend: Math.round((totals[0]?.total || 0) * 100) / 100,
    expenseCount: totals[0]?.count || 0,
  });
};

export const createVendor = async (req, res) => {
  const { name, category = "Materials", contactName, email, phone, gstin, address, rating, notes } = req.body;

  if (!name?.trim()) throw ApiError.badRequest("Vendor name is required", { code: "MISSING_FIELD" });
  if (!VENDOR_CATEGORIES.includes(category)) {
    throw ApiError.badRequest("Invalid vendor category", { code: "INVALID_CATEGORY" });
  }
  if (rating !== undefined && rating !== null && rating !== "") {
    const value = Number(rating);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      throw ApiError.badRequest("Rating must be between 1 and 5", { code: "INVALID_RATING" });
    }
  }
  if (await Vendor.exists({ name: name.trim() })) {
    throw ApiError.conflict("A vendor with that name already exists", { code: "DUPLICATE_VENDOR" });
  }

  const vendor = await Vendor.create({
    name: name.trim(),
    category,
    contactName,
    email,
    phone,
    gstin,
    address,
    rating: rating ? Number(rating) : undefined,
    notes,
    createdBy: req.user._id,
  });

  await recordAudit({
    actor: req.user,
    entityType: "Vendor",
    entityId: vendor._id,
    action: "vendor.created",
    reason: vendor.name,
  });

  return res.status(201).json({ success: true, vendor });
};

export const updateVendor = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw ApiError.notFound("Vendor not found");

  const fields = ["contactName", "phone", "address", "notes"];
  for (const field of fields) {
    if (req.body[field] !== undefined) vendor[field] = req.body[field];
  }
  if (req.body.name !== undefined) {
    if (!req.body.name.trim()) throw ApiError.badRequest("Vendor name cannot be empty", { code: "MISSING_FIELD" });
    if (req.body.name.trim() !== vendor.name && (await Vendor.exists({ name: req.body.name.trim() }))) {
      throw ApiError.conflict("A vendor with that name already exists", { code: "DUPLICATE_VENDOR" });
    }
    vendor.name = req.body.name.trim();
  }
  if (req.body.category !== undefined) {
    if (!VENDOR_CATEGORIES.includes(req.body.category)) {
      throw ApiError.badRequest("Invalid vendor category", { code: "INVALID_CATEGORY" });
    }
    vendor.category = req.body.category;
  }
  if (req.body.email !== undefined) vendor.email = req.body.email;
  if (req.body.gstin !== undefined) vendor.gstin = req.body.gstin;
  if (req.body.rating !== undefined) {
    if (!req.body.rating) vendor.rating = undefined;
    else {
      const value = Number(req.body.rating);
      if (!Number.isFinite(value) || value < 1 || value > 5) {
        throw ApiError.badRequest("Rating must be between 1 and 5", { code: "INVALID_RATING" });
      }
      vendor.rating = value;
    }
  }
  if (req.body.isActive !== undefined) {
    // JSON forms send booleans, but multipart or legacy clients can send the
    // strings "false"/"true". Boolean("false") is true, which silently
    // reactivated a deactivated vendor.
    const raw = req.body.isActive;
    vendor.isActive = raw === true || raw === "true" || raw === 1 || raw === "1";
  }

  await vendor.save();
  await recordAudit({
    actor: req.user,
    entityType: "Vendor",
    entityId: vendor._id,
    action: "vendor.updated",
    reason: vendor.name,
  });

  return res.status(200).json({ success: true, vendor });
};

export const archiveVendor = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw ApiError.notFound("Vendor not found");
  if (!vendor.isActive) throw ApiError.conflict("Vendor is already inactive", { code: "VENDOR_INACTIVE" });

  vendor.isActive = false;
  await vendor.save();
  await recordAudit({
    actor: req.user,
    entityType: "Vendor",
    entityId: vendor._id,
    action: "vendor.deactivated",
    reason: vendor.name,
  });
  return res.status(200).json({ success: true, message: "Vendor deactivated. History preserved." });
};

export const deleteVendor = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw ApiError.notFound("Vendor not found");

  const [expenses, materials, equipment] = await Promise.all([
    Expense.countDocuments({ vendor: vendor._id }),
    Material.countDocuments({ preferredVendor: vendor._id }),
    Equipment.countDocuments({ vendor: vendor._id }),
  ]);
  if (expenses + materials + equipment > 0) {
    throw ApiError.conflict(
      "This vendor is referenced by materials, equipment or expenses. Deactivate it instead so the history stays intact.",
      { code: "VENDOR_IN_USE", details: { expenses, materials, equipment } }
    );
  }

  await Vendor.deleteOne({ _id: vendor._id });
  await recordAudit({
    actor: req.user,
    entityType: "Vendor",
    entityId: vendor._id,
    action: "vendor.deleted",
    reason: vendor.name,
  });
  return res.status(200).json({ success: true, message: "Vendor deleted" });
};

export default {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  archiveVendor,
  deleteVendor,
};
