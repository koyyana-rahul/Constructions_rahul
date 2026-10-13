import multer from "multer";
import Client from "../models/Client.js";
import User from "../models/User.js";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import {
  createActivationToken,
  unactivatedPasswordHash,
} from "../services/activationService.js";

const uploadDir = "public/uploads";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Administrator creates a client account by invitation.
 *
 * There is deliberately NO password field. The account is created
 * un-activated, holding an unguessable placeholder hash that nobody can ever
 * match, and a single-use activation token is issued so the client can set
 * their own password. The raw token is returned exactly once for the
 * administrator to deliver.
 */
const addClient = async (req, res) => {
  const { name, email, entityType, phone, companyName } = req.body;

  if (!name?.trim()) throw ApiError.badRequest("Contact name is required", { code: "MISSING_FIELD" });
  if (!companyName?.trim())
    throw ApiError.badRequest("Organisation name is required", { code: "MISSING_FIELD" });
  if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
    throw ApiError.badRequest("A valid email address is required", { code: "INVALID_EMAIL" });
  }
  if (!phone?.trim() || !/^\+?[0-9][0-9\s-]{6,19}$/.test(phone.trim())) {
    throw ApiError.badRequest("A valid phone number is required", { code: "INVALID_PHONE" });
  }
  if (!["natural", "legal"].includes(entityType)) {
    throw ApiError.badRequest("entityType must be 'natural' or 'legal'", {
      code: "INVALID_ENTITY_TYPE",
    });
  }

  const clash = await User.findOne({
    email: { $regex: `^${email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (clash) {
    throw ApiError.conflict(
      clash.isActivated === false
        ? "An invited account already exists for that email. It has not been activated yet - resend the invitation from the clients list."
        : "That email address is already registered",
      { code: clash.isActivated === false ? "INVITATION_PENDING" : "DUPLICATE_EMAIL" }
    );
  }

  const activation = createActivationToken();

  const savedUser = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    // Unguessable placeholder: the account cannot authenticate until activated.
    password: await unactivatedPasswordHash(bcrypt),
    role: "client",
    phone: phone.trim(),
    profileImage: req.file ? req.file.filename : "",
    isActivated: false,
    activationTokenHash: activation.hash,
    activationTokenExpiry: activation.expiresAt,
    invitedBy: req.user._id,
  });

  // The Client profile is created in the same request and permanently linked
  // to this User, so the client can only ever reach their own data.
  const client = await Client.create({
    userId: savedUser._id,
    entityType,
    phone: phone.trim(),
    companyName: companyName.trim(),
    image: req.file ? req.file.filename : "",
  });

  await recordAudit({
    actor: req.user,
    entityType: "Client",
    entityId: client._id,
    action: "client.invited",
    toState: "invited",
  });

  return res.status(201).json({
    success: true,
    message: `Invitation created for ${savedUser.email}. Send them the activation link below so they can set their own password.`,
    client: { _id: client._id, name: savedUser.name, email: savedUser.email },
    activation: {
      // Returned once. Only a SHA-256 digest is stored.
      token: activation.raw,
      expiresAt: activation.expiresAt,
      url: `/activate?token=${activation.raw}`,
    },
  });
};

/**
 * R1/R5: scoped and paginated.
 * Admins see every client; a client sees only their own record.
 */
const getClients = async (req, res) => {
  const { page = 1, limit = 25 } = req.query;
  const take = Math.min(parseInt(limit, 10) || 25, 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const filter =
    req.user.role === "client"
      ? { userId: req.user._id }
      : {};

  const [clients, total] = await Promise.all([
    Client.find(filter)
      .populate("userId", { password: 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(take),
    Client.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    clients,
    pagination: { page: Math.floor(skip / take) + 1, limit: take, total },
  });
};

const getClient = async (req, res) => {
  const { id } = req.params;

  let client = await Client.findById(id).populate("userId", { password: 0 });
  if (!client) {
    client = await Client.findOne({ userId: id }).populate("userId", { password: 0 });
  }
  if (!client) throw ApiError.notFound("Client not found");

  // Defence in depth: the route already checked ownership.
  if (req.user.role === "client" && String(client.userId?._id) !== String(req.user._id)) {
    throw ApiError.forbidden("You can only view your own client record", {
      code: "FORBIDDEN_OWNERSHIP",
    });
  }

  return res.status(200).json({ success: true, client });
};

const updateClient = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, entityType } = req.body;

  const client = await Client.findById(id);
  if (!client) throw ApiError.notFound("Client not found");

  const user = await User.findById(client.userId);
  if (!user) throw ApiError.notFound("Linked user account not found");

  if (entityType !== undefined && !["natural", "legal"].includes(entityType)) {
    throw ApiError.badRequest("entityType must be 'natural' or 'legal'", {
      code: "INVALID_ENTITY_TYPE",
    });
  }
  if (email !== undefined && !EMAIL_RE.test(email.trim())) {
    throw ApiError.badRequest("A valid email address is required", { code: "INVALID_EMAIL" });
  }

  if (name !== undefined) { if (!name.trim()) throw ApiError.badRequest("Name cannot be empty", { code: "MISSING_FIELD" }); user.name = name.trim(); }
  if (email !== undefined) {
    const other = await User.findOne({
      email: { $regex: `^${email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      _id: { $ne: user._id },
    });
    if (other) throw ApiError.conflict("That email address is already registered", { code: "DUPLICATE_EMAIL" });
    user.email = email.trim().toLowerCase();
  }
  if (phone !== undefined) user.phone = phone;

  await user.save();

  if (entityType !== undefined) client.entityType = entityType;
  if (phone !== undefined) client.phone = phone;
  if (req.body.companyName !== undefined) client.companyName = req.body.companyName;
  await client.save();

  await recordAudit({
    actor: req.user,
    entityType: "Client",
    entityId: client._id,
    action: "client.updated",
  });

  return res.status(200).json({ success: true, message: "Client updated" });
};

/**
 * Hard delete. Refuses while work requests still reference the client so the
 * client's project history is never silently orphaned.
 */
const deleteClient = async (req, res) => {
  const { id } = req.params;

  const client = await Client.findById(id);
  if (!client) throw ApiError.notFound("Client not found");

  const { default: WorkRequest } = await import("../models/Work.js");
  const linked = await WorkRequest.countDocuments({ clientId: id });
  if (linked > 0) {
    throw ApiError.conflict(
      `This client has ${linked} work request(s) on record. Those must be retained for project history.`,
      { code: "HISTORICAL_DEPENDENCIES", details: { workRequests: linked } }
    );
  }

  const user = await User.findById(client.userId);

  if (client.image) {
    const imagePath = path.join(uploadDir, client.image);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }

  await Client.deleteOne({ _id: id });
  if (user) await User.deleteOne({ _id: user._id });

  await recordAudit({
    actor: req.user,
    entityType: "Client",
    entityId: id,
    action: "client.deleted",
    toState: "deleted",
  });

  return res.status(200).json({ success: true, message: "Client deleted" });
};

export { addClient, getClients, getClient, updateClient, deleteClient, upload };