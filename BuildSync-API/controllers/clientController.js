import Client from "../models/Client.js";
import User from "../models/User.js";
import WorkRequest from "../models/Work.js";
import Project from "../models/Project.js";
import Invoice from "../models/Invoice.js";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import {
  createActivationToken,
  unactivatedPasswordHash,
} from "../services/activationService.js";
import {
  describeResult,
  sendClientInvitation,
} from "../services/email/emailService.js";
import { UPLOAD_DIR } from "../middleware/multerConfig.js";

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
  const { entityType } = req.body;
  const nameText = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const emailText = typeof req.body.email === "string" ? req.body.email.trim() : "";
  const phoneText = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
  const companyText =
    typeof req.body.companyName === "string" ? req.body.companyName.trim() : "";

  if (!nameText) throw ApiError.badRequest("Contact name is required", { code: "MISSING_FIELD" });
  if (!companyText)
    throw ApiError.badRequest("Organisation name is required", { code: "MISSING_FIELD" });
  if (!emailText || !EMAIL_RE.test(emailText)) {
    throw ApiError.badRequest("A valid email address is required", { code: "INVALID_EMAIL" });
  }
  if (!phoneText || !/^\+?[0-9][0-9\s-]{6,19}$/.test(phoneText)) {
    throw ApiError.badRequest("A valid phone number is required", { code: "INVALID_PHONE" });
  }
  if (!["natural", "legal"].includes(entityType)) {
    throw ApiError.badRequest("entityType must be 'natural' or 'legal'", {
      code: "INVALID_ENTITY_TYPE",
    });
  }

  const clash = await User.findOne({
    email: { $regex: `^${emailText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
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

  let savedUser = null;
  let client = null;
  try {
    savedUser = await User.create({
      name: nameText,
      email: emailText.toLowerCase(),
      // Unguessable placeholder: the account cannot authenticate until activated.
      password: await unactivatedPasswordHash(bcrypt),
      role: "client",
      phone: phoneText,
      profileImage: req.file ? req.file.filename : "",
      isActivated: false,
      activationTokenHash: activation.hash,
      activationTokenExpiry: activation.expiresAt,
      invitedBy: req.user._id,
    });

    // The Client profile is created in the same request and permanently linked
    // to this User, so the client can only ever reach their own data.
    client = await Client.create({
      userId: savedUser._id,
      entityType,
      phone: phoneText,
      companyName: companyText,
      image: req.file ? req.file.filename : "",
    });
  } catch (error) {
    // The profile and login must exist together. Compensate rather than
    // leaving an orphan login (or an uploaded file) when a later write fails.
    if (savedUser) await User.deleteOne({ _id: savedUser._id }).catch(() => {});
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
    throw error;
  }

  await recordAudit({
    actor: req.user,
    entityType: "Client",
    entityId: client._id,
    action: "client.invited",
    toState: "invited",
  });

  // The invitation is complete even if the mail provider is unavailable. The
  // response reports the real delivery outcome and always includes the
  // one-time link so an administrator can deliver it manually.
  const delivery = await sendClientInvitation({
    to: savedUser.email,
    name: savedUser.name,
    companyName: client.companyName,
    token: activation.raw,
  });

  return res.status(201).json({
    success: true,
    message: delivery.delivered
      ? `Invitation emailed to ${savedUser.email}.`
      : `Invitation created for ${savedUser.email}, but the email was not delivered. Share the activation link manually.`,
    client: { _id: client._id, name: savedUser.name, email: savedUser.email },
    activation: {
      // Returned once. Only a SHA-256 digest is stored.
      token: activation.raw,
      expiresAt: activation.expiresAt,
      url: `/activate?token=${activation.raw}`,
    },
    emailDelivery: {
      delivered: Boolean(delivery.delivered),
      status: delivery.status,
      error: delivery.error,
      message: describeResult(delivery),
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
  const { entityType } = req.body;
  const nameText =
    req.body.name !== undefined
      ? typeof req.body.name === "string"
        ? req.body.name.trim()
        : ""
      : undefined;
  const emailText =
    req.body.email !== undefined
      ? typeof req.body.email === "string"
        ? req.body.email.trim()
        : ""
      : undefined;
  const phoneText =
    req.body.phone !== undefined
      ? typeof req.body.phone === "string"
        ? req.body.phone.trim()
        : ""
      : undefined;
  const companyText =
    req.body.companyName !== undefined
      ? typeof req.body.companyName === "string"
        ? req.body.companyName.trim()
        : ""
      : undefined;

  const client = await Client.findById(id);
  if (!client) throw ApiError.notFound("Client not found");

  const user = await User.findById(client.userId);
  if (!user) throw ApiError.notFound("Linked user account not found");

  if (entityType !== undefined && !["natural", "legal"].includes(entityType)) {
    throw ApiError.badRequest("entityType must be 'natural' or 'legal'", {
      code: "INVALID_ENTITY_TYPE",
    });
  }
  if (nameText !== undefined && !nameText) {
    throw ApiError.badRequest("Name cannot be empty", { code: "MISSING_FIELD" });
  }
  if (emailText !== undefined && !EMAIL_RE.test(emailText)) {
    throw ApiError.badRequest("A valid email address is required", { code: "INVALID_EMAIL" });
  }
  if (
    phoneText !== undefined &&
    (!phoneText || !/^\+?[0-9][0-9\s-]{6,19}$/.test(phoneText))
  ) {
    throw ApiError.badRequest("A valid phone number is required", { code: "INVALID_PHONE" });
  }
  if (companyText !== undefined && !companyText) {
    throw ApiError.badRequest("Organisation name cannot be empty", { code: "MISSING_FIELD" });
  }

  if (nameText !== undefined) user.name = nameText;
  if (emailText !== undefined) {
    const other = await User.findOne({
      email: { $regex: `^${emailText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      _id: { $ne: user._id },
    });
    if (other) throw ApiError.conflict("That email address is already registered", { code: "DUPLICATE_EMAIL" });
    user.email = emailText.toLowerCase();
  }
  if (phoneText !== undefined) user.phone = phoneText;

  await user.save();

  if (entityType !== undefined) client.entityType = entityType;
  if (phoneText !== undefined) client.phone = phoneText;
  if (companyText !== undefined) client.companyName = companyText;
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
 * Hard delete. Refuses while any project, invoice or work request still
 * references the client, so billing and project history are never orphaned.
 */
const deleteClient = async (req, res) => {
  const { id } = req.params;

  const client = await Client.findById(id);
  if (!client) throw ApiError.notFound("Client not found");

  const [workRequests, projects, invoices] = await Promise.all([
    WorkRequest.countDocuments({ clientId: id }),
    Project.countDocuments({ client: id }),
    Invoice.countDocuments({ client: id }),
  ]);

  const details = { workRequests, projects, invoices };
  if (Object.values(details).some((count) => count > 0)) {
    throw ApiError.conflict(
      "This client has projects, invoices or work requests on record. Those records must be retained for project and billing history, so the client cannot be deleted.",
      { code: "HISTORICAL_DEPENDENCIES", details }
    );
  }

  const user = await User.findById(client.userId);

  const images = new Set([client.image, user?.profileImage].filter(Boolean));
  for (const image of images) {
    const imagePath = path.join(UPLOAD_DIR, image);
    await fs.promises.unlink(imagePath).catch(() => {});
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

export { addClient, getClients, getClient, updateClient, deleteClient };