import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import DocumentFile from "../models/DocumentFile.js";
import Project from "../models/Project.js";
import Department from "../models/Department.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import {
  clientForUser,
  employeeForUser,
  canAccessProject,
  escapeRegex,
  isAdmin,
} from "../services/accessService.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { PRIVATE_DOCUMENT_DIR } from "../middleware/multerConfig.js";

export const DOCUMENT_CATEGORIES = [
  "Drawing",
  "Contract",
  "Permit",
  "Report",
  "Specification",
  "Certificate",
  "Photo",
  "Other",
];

const populateDocument = (query) =>
  query
    .populate("project", "code name status client")
    .populate("site", "dep_name")
    .populate("uploadedBy", "name role");

/** Whether a caller may read the document metadata/file itself. */
const canReadDocument = async (user, doc) => {
  if (!user || !doc) return false;
  if (isAdmin(user)) return true;

  if (user.role === "client") {
    if (!doc.isClientVisible) return false;
    const project = doc.project?._id || doc.project;
    if (!project) return false;
    const client = await clientForUser(user._id);
    if (!client) return false;
    const projectDoc = doc.project?.client
      ? doc.project
      : await Project.findById(project).select("client");
    return String(projectDoc?.client?._id || projectDoc?.client) === String(client._id);
  }

  if (user.role === "employee") {
    const employee = await employeeForUser(user._id);
    if (!employee) return false;
    const project = doc.project?._id || doc.project;
    if (project && (await canAccessProject(user, doc.project?.client ? doc.project : await Project.findById(project)))) {
      return true;
    }
    const site = doc.site?._id || doc.site;
    if (site && String(site) === String(employee.department)) return true;
    // The uploader can always open what they uploaded.
    return String(doc.uploadedBy?._id || doc.uploadedBy) === String(user._id);
  }

  return false;
};

export const listDocuments = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50 });
  const filter = {};

  if (req.user.role === "client") {
    const client = await clientForUser(req.user._id);
    if (!client) {
      return res.status(200).json({ success: true, documents: [], pagination: paginationMeta({ page, limit }, 0) });
    }
    const projectIds = await Project.find({ client: client._id }).select("_id").lean();
    filter.project = { $in: projectIds.map((p) => p._id) };
    filter.isClientVisible = true;
  } else if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee) {
      return res.status(200).json({ success: true, documents: [], pagination: paginationMeta({ page, limit }, 0) });
    }
    const projectIds = await Project.find({
      $or: [{ team: employee._id }, { manager: employee._id }, { site: employee.department }],
    })
      .select("_id")
      .lean();
    filter.$or = [
      { site: employee.department },
      { project: { $in: projectIds.map((p) => p._id) } },
      { uploadedBy: req.user._id },
    ];
  } else if (!isAdmin(req.user)) {
    throw ApiError.forbidden("Documents are not available to this role", { code: "FORBIDDEN_ROLE" });
  }

  if (req.query.project) {
    if (!mongoose.isValidObjectId(req.query.project)) {
      throw ApiError.badRequest("Invalid project", { code: "INVALID_ID" });
    }
    if (req.user.role === "client" || req.user.role === "employee") {
      filter.$and = [...(filter.$and || []), { project: req.query.project }];
    } else {
      filter.project = req.query.project;
    }
  }
  if (req.query.site && isAdmin(req.user)) filter.site = req.query.site;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$and = [...(filter.$and || []), { $or: [{ name: rx }, { originalName: rx }, { notes: rx }] }];
  }

  const [documents, total] = await Promise.all([
    populateDocument(DocumentFile.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    DocumentFile.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    documents,
    pagination: paginationMeta({ page, limit }, total),
  });
};

export const getDocument = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid document identifier", { code: "INVALID_ID" });
  }
  const document = await populateDocument(DocumentFile.findById(req.params.id)).lean();
  if (!document) throw ApiError.notFound("Document not found");
  if (!(await canReadDocument(req.user, document))) {
    throw ApiError.forbidden("You do not have access to this document", { code: "FORBIDDEN_DOCUMENT" });
  }
  return res.status(200).json({ success: true, document });
};

export const uploadDocument = async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Select a file to upload", { code: "MISSING_FILE" });

  const { project: projectId, site: siteId, category = "Other", name, notes } = req.body;
  if (!DOCUMENT_CATEGORIES.includes(category)) {
    throw ApiError.badRequest("Invalid document category", { code: "INVALID_CATEGORY" });
  }

  let project = null;
  if (projectId) {
    if (!mongoose.isValidObjectId(projectId)) {
      throw ApiError.badRequest("Invalid project", { code: "INVALID_ID" });
    }
    project = await Project.findById(projectId).select("_id site client");
    if (!project) throw ApiError.badRequest("The selected project does not exist", { code: "INVALID_REFERENCE" });
    if (req.user.role === "employee" && !(await canAccessProject(req.user, project))) {
      throw ApiError.forbidden("You can only upload documents to your own project", { code: "FORBIDDEN_PROJECT" });
    }
    if (req.user.role === "client") {
      const client = await clientForUser(req.user._id);
      if (!client || String(project.client) !== String(client._id)) {
        throw ApiError.forbidden("You can only upload documents to your own project", {
          code: "FORBIDDEN_PROJECT",
        });
      }
    }
  }

  // A client always uploads against a project; a site-only vault is internal.
  if (req.user.role === "client" && !project) {
    throw ApiError.badRequest("Select one of your projects for this document", {
      code: "MISSING_FIELD",
    });
  }

  let site = siteId || project?.site;
  if (req.user.role === "employee") {
    const employee = await employeeForUser(req.user._id);
    if (!employee) throw ApiError.forbidden("No employee profile is linked to this account", { code: "NO_EMPLOYEE_PROFILE" });
    if (site && String(site) !== String(employee.department)) {
      throw ApiError.forbidden("You can only upload documents to your own site", { code: "FORBIDDEN_SITE" });
    }
    site = site || employee.department;
  }
  if (site && !mongoose.isValidObjectId(site)) {
    throw ApiError.badRequest("Invalid site", { code: "INVALID_ID" });
  }
  if (site && !(await Department.exists({ _id: site }))) {
    throw ApiError.badRequest("The selected site does not exist", { code: "INVALID_REFERENCE" });
  }
  if (!project && !site) {
    throw ApiError.badRequest("Attach the document to a project or a site", { code: "MISSING_FIELD" });
  }

  const document = await DocumentFile.create({
    project: project?._id,
    site: site || undefined,
    category,
    name: String(name || "").trim() || path.parse(req.file.originalname).name.slice(0, 200),
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    notes,
    // Only an administrator can publish an internal file to the client
    // portal. A file uploaded by a client belongs to their own project and
    // must remain visible to them; a site-only vault item is always internal.
    isClientVisible: Boolean(project) &&
      (isAdmin(req.user)
        ? req.body.isClientVisible !== "false"
        : req.user.role === "client"),
    uploadedBy: req.user._id,
  });

  await recordAudit({
    actor: req.user,
    entityType: "DocumentFile",
    entityId: document._id,
    action: "document.uploaded",
    reason: document.name,
  });

  const populated = await populateDocument(DocumentFile.findById(document._id));
  return res.status(201).json({ success: true, document: populated });
};

export const updateDocument = async (req, res) => {
  const document = await DocumentFile.findById(req.params.id);
  if (!document) throw ApiError.notFound("Document not found");

  const admin = isAdmin(req.user);
  if (!admin && String(document.uploadedBy) !== String(req.user._id)) {
    throw ApiError.forbidden("You can only edit documents you uploaded", { code: "FORBIDDEN_OWNERSHIP" });
  }

  if (req.body.name !== undefined) {
    if (!req.body.name.trim()) throw ApiError.badRequest("Document name cannot be empty", { code: "MISSING_FIELD" });
    document.name = req.body.name.trim().slice(0, 200);
  }
  if (req.body.category !== undefined) {
    if (!DOCUMENT_CATEGORIES.includes(req.body.category)) {
      throw ApiError.badRequest("Invalid document category", { code: "INVALID_CATEGORY" });
    }
    document.category = req.body.category;
  }
  if (req.body.notes !== undefined) document.notes = req.body.notes;
  if (req.body.isClientVisible !== undefined) {
    if (!admin) {
      throw ApiError.forbidden("Only an administrator can change client visibility", {
        code: "FORBIDDEN_FIELD",
      });
    }
    const visible =
      req.body.isClientVisible === true || req.body.isClientVisible === "true";
    if (visible && !document.project) {
      throw ApiError.badRequest(
        "Attach the document to a project before sharing it with the client",
        { code: "PROJECT_REQUIRED" }
      );
    }
    document.isClientVisible = visible;
  }

  await document.save();
  await recordAudit({
    actor: req.user,
    entityType: "DocumentFile",
    entityId: document._id,
    action: "document.updated",
    reason: document.name,
  });

  const populated = await populateDocument(DocumentFile.findById(document._id));
  return res.status(200).json({ success: true, document: populated });
};

/** Authenticated file stream. The storage directory is never publicly served. */
export const downloadDocument = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid document identifier", { code: "INVALID_ID" });
  }
  const document = await populateDocument(DocumentFile.findById(req.params.id)).lean();
  if (!document) throw ApiError.notFound("Document not found");
  if (!(await canReadDocument(req.user, document))) {
    throw ApiError.forbidden("You do not have access to this document", { code: "FORBIDDEN_DOCUMENT" });
  }

  const filename = path.basename(document.filename);
  const file = path.join(PRIVATE_DOCUMENT_DIR, filename);
  if (!fs.existsSync(file)) throw ApiError.notFound("The document file is no longer available");

  const downloadName = document.originalName || `${document.name}${path.extname(filename)}`;
  return res.download(file, downloadName);
};

export const deleteDocument = async (req, res) => {
  const document = await DocumentFile.findById(req.params.id);
  if (!document) throw ApiError.notFound("Document not found");

  const admin = isAdmin(req.user);
  if (!admin && String(document.uploadedBy) !== String(req.user._id)) {
    throw ApiError.forbidden("You can only delete documents you uploaded", { code: "FORBIDDEN_OWNERSHIP" });
  }

  const file = path.join(PRIVATE_DOCUMENT_DIR, path.basename(document.filename));
  fs.promises.unlink(file).catch(() => {});

  await DocumentFile.deleteOne({ _id: document._id });
  await recordAudit({
    actor: req.user,
    entityType: "DocumentFile",
    entityId: document._id,
    action: "document.deleted",
    reason: document.name,
  });
  return res.status(200).json({ success: true, message: "Document deleted" });
};

export default {
  listDocuments,
  getDocument,
  uploadDocument,
  updateDocument,
  downloadDocument,
  deleteDocument,
};
