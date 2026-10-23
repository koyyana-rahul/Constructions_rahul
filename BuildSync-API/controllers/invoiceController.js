import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Project from "../models/Project.js";
import ApiError from "../utils/ApiError.js";
import { recordAudit } from "../services/auditService.js";
import { clientForUser, escapeRegex, isAdmin } from "../services/accessService.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { nextInvoiceNumber, getOrganization } from "../services/numberingService.js";
import { csvResponse } from "../services/exportService.js";
import { notifyUser } from "../services/notificationService.js";
import { deriveInvoiceStatus, refreshOverdueInvoices } from "../services/invoiceService.js";

export const INVOICE_STATUSES = ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"];
export const PAYMENT_METHODS = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card", "Other"];

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

const populateInvoice = (query) =>
  query
    .populate("project", "code name site status")
    .populate({ path: "client", select: "companyName entityType phone userId", populate: { path: "userId", select: "name email" } })
    .populate("createdBy", "name");

const normaliseLineItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest("An invoice needs at least one line item", { code: "MISSING_LINE_ITEMS" });
  }
  return items.map((item, index) => {
    const description = String(item?.description || "").trim();
    const quantity = Number(item?.quantity);
    const rate = Number(item?.rate);
    if (!description) {
      throw ApiError.badRequest(`Line ${index + 1} needs a description`, { code: "MISSING_FIELD" });
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw ApiError.badRequest(`Line ${index + 1} quantity must be greater than zero`, { code: "INVALID_QUANTITY" });
    }
    if (!Number.isFinite(rate) || rate < 0) {
      throw ApiError.badRequest(`Line ${index + 1} rate must be zero or positive`, { code: "INVALID_RATE" });
    }
    return {
      description: description.slice(0, 500),
      quantity,
      unit: String(item?.unit || "Item").slice(0, 40),
      rate,
      amount: round(quantity * rate),
    };
  });
};

const assertAdmin = (req) => {
  if (!isAdmin(req.user)) {
    throw ApiError.forbidden("Only an administrator can manage invoices", { code: "FORBIDDEN_ROLE" });
  }
};

const resolveIssuedTo = async (user) => {
  const client = await clientForUser(user._id);
  return client?._id || null;
};

export const listInvoices = async (req, res) => {
  await refreshOverdueInvoices();
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50 });
  const filter = {};

  if (isAdmin(req.user)) {
    if (req.query.project) {
      if (!mongoose.isValidObjectId(req.query.project)) {
        throw ApiError.badRequest("Invalid project", { code: "INVALID_ID" });
      }
      filter.project = req.query.project;
    }
    if (req.query.client) filter.client = req.query.client;
  } else if (req.user.role === "client") {
    const clientId = await resolveIssuedTo(req.user);
    if (!clientId) {
      return res.status(200).json({ success: true, invoices: [], pagination: paginationMeta({ page, limit }, 0) });
    }
    filter.client = clientId;
    filter.status = { $ne: "Draft" };
  } else {
    throw ApiError.forbidden("Invoices are not available to employee accounts", { code: "FORBIDDEN_ROLE" });
  }

  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.issueDate = {};
    if (req.query.from) filter.issueDate.$gte = new Date(req.query.from);
    if (req.query.to) {
      const to = new Date(req.query.to);
      to.setHours(23, 59, 59, 999);
      filter.issueDate.$lte = to;
    }
  }
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = [{ number: rx }, { notes: rx }];
  }

  const [invoices, total] = await Promise.all([
    populateInvoice(Invoice.find(filter)).sort({ issueDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Invoice.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    invoices,
    pagination: paginationMeta({ page, limit }, total),
  });
};

export const getInvoice = async (req, res) => {
  await refreshOverdueInvoices();
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid invoice identifier", { code: "INVALID_ID" });
  }

  const invoice = await populateInvoice(Invoice.findById(req.params.id)).lean();
  if (!invoice) throw ApiError.notFound("Invoice not found");

  if (!isAdmin(req.user)) {
    if (req.user.role !== "client") {
      throw ApiError.forbidden("Invoices are not available to this role", { code: "FORBIDDEN_ROLE" });
    }
    const clientId = await resolveIssuedTo(req.user);
    if (!clientId || String(invoice.client?._id) !== String(clientId)) {
      throw ApiError.forbidden("You can only view your own invoices", { code: "FORBIDDEN_OWNERSHIP" });
    }
    if (invoice.status === "Draft") {
      throw ApiError.notFound("Invoice not found");
    }
  }

  const organization = await getOrganization();
  const org = {
    name: organization.name,
    legalName: organization.legalName,
    email: organization.email,
    phone: organization.phone,
    address: organization.address,
    gstin: organization.gstin,
    website: organization.website,
    currency: organization.currency,
  };

  return res.status(200).json({ success: true, invoice, organization: org });
};

export const createInvoice = async (req, res) => {
  assertAdmin(req);
  const {
    project: projectId,
    issueDate,
    dueDate,
    lineItems,
    discountAmount = 0,
    taxRate,
    notes,
    terms,
  } = req.body;

  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    throw ApiError.badRequest("A project is required", { code: "MISSING_FIELD" });
  }
  const project = await Project.findById(projectId).select("_id client code site");
  if (!project) throw ApiError.badRequest("The selected project does not exist", { code: "INVALID_REFERENCE" });
  if (!project.client) {
    throw ApiError.conflict("This project has no client linked, so it cannot be invoiced", {
      code: "PROJECT_WITHOUT_CLIENT",
    });
  }

  const items = normaliseLineItems(lineItems);
  const issue = issueDate ? new Date(issueDate) : new Date();
  if (Number.isNaN(issue.getTime())) {
    throw ApiError.badRequest("Invalid issue date", { code: "INVALID_DATE" });
  }
  const due = dueDate ? new Date(dueDate) : new Date(issue.getTime() + 30 * 86400000);
  if (Number.isNaN(due.getTime())) throw ApiError.badRequest("Invalid due date", { code: "INVALID_DATE" });
  if (due < issue) {
    throw ApiError.badRequest("Due date must be on or after the issue date", { code: "INVALID_RANGE" });
  }

  const organization = await getOrganization();
  const rate = taxRate === undefined ? organization.taxRate : Number(taxRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw ApiError.badRequest("Tax rate must be between 0 and 100", { code: "INVALID_TAX_RATE" });
  }

  const invoice = await Invoice.create({
    number: await nextInvoiceNumber(),
    project: project._id,
    client: project.client,
    issueDate: issue,
    dueDate: due,
    lineItems: items,
    discountAmount: Math.max(0, Number(discountAmount) || 0),
    taxRate: rate,
    notes,
    terms: terms || organization.invoiceTerms,
    status: "Draft",
    createdBy: req.user._id,
  });

  await recordAudit({
    actor: req.user,
    entityType: "Invoice",
    entityId: invoice._id,
    action: "invoice.created",
    toState: "Draft",
    reason: `${invoice.number} ${invoice.total}`,
  });

  const populated = await populateInvoice(Invoice.findById(invoice._id));
  return res.status(201).json({ success: true, invoice: populated });
};

export const updateInvoice = async (req, res) => {
  assertAdmin(req);
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (!["Draft", "Sent"].includes(invoice.status)) {
    throw ApiError.conflict("Only a draft or unpaid sent invoice can be edited", { code: "INVOICE_LOCKED" });
  }

  const before = invoice.toObject();
  const allowed = ["issueDate", "dueDate", "lineItems", "discountAmount", "taxRate", "notes", "terms"];
  const attempted = Object.keys(req.body).filter((key) => !allowed.includes(key));
  if (attempted.length) {
    throw ApiError.forbidden(
      `Invoice number, client, status and payments cannot be changed here. Use the dedicated actions.`,
      { code: "FORBIDDEN_FIELD", details: { attempted } }
    );
  }

  const lineItems =
    req.body.lineItems !== undefined
      ? normaliseLineItems(req.body.lineItems)
      : invoice.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          amount: item.amount,
        }));

  const issueDate =
    req.body.issueDate !== undefined ? new Date(req.body.issueDate) : invoice.issueDate;
  if (Number.isNaN(issueDate.getTime())) {
    throw ApiError.badRequest("Invalid issue date", { code: "INVALID_DATE" });
  }
  const dueDate = req.body.dueDate !== undefined ? new Date(req.body.dueDate) : invoice.dueDate;
  if (Number.isNaN(dueDate.getTime())) {
    throw ApiError.badRequest("Invalid due date", { code: "INVALID_DATE" });
  }
  if (dueDate < issueDate) {
    throw ApiError.badRequest("Due date must be on or after the issue date", { code: "INVALID_RANGE" });
  }

  const discountAmount =
    req.body.discountAmount !== undefined
      ? Math.max(0, Number(req.body.discountAmount) || 0)
      : invoice.discountAmount;
  const taxRate = req.body.taxRate !== undefined ? Number(req.body.taxRate) : invoice.taxRate;
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    throw ApiError.badRequest("Tax rate must be between 0 and 100", { code: "INVALID_TAX_RATE" });
  }

  const subtotal = round(lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const taxAmount = round(Math.max(0, subtotal - discountAmount) * (taxRate / 100));
  const total = round(Math.max(0, subtotal - discountAmount) + taxAmount);

  /**
   * Conditional write: only apply this edit while the invoice is still in the
   * state that was read AND no payment has landed in between. Without this,
   * an administrator editing a sent invoice at the same moment a payment is
   * recorded could save stale totals and zero out amountPaid.
   */
  const updated = await Invoice.findOneAndUpdate(
    {
      _id: invoice._id,
      status: invoice.status,
      $expr: { $eq: ["$amountPaid", invoice.amountPaid] },
    },
    {
      $set: {
        lineItems,
        issueDate,
        dueDate,
        discountAmount,
        taxRate,
        subtotal,
        taxAmount,
        total,
        ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
        ...(req.body.terms !== undefined ? { terms: req.body.terms } : {}),
      },
    },
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw ApiError.conflict("This invoice changed while you were editing it. Reload and try again.", {
      code: "CONCURRENT_UPDATE",
    });
  }

  await recordAudit({
    actor: req.user,
    entityType: "Invoice",
    entityId: updated._id,
    action: "invoice.updated",
    fromState: before.status,
    toState: updated.status,
    reason: updated.number,
  });

  const populated = await populateInvoice(Invoice.findById(updated._id));
  return res.status(200).json({ success: true, invoice: populated });
};

export const sendInvoice = async (req, res) => {
  assertAdmin(req);
  const invoice = await Invoice.findById(req.params.id).populate({
    path: "client",
    select: "userId companyName",
  });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.status !== "Draft") {
    throw ApiError.conflict("Only a draft invoice can be sent", { code: "INVALID_TRANSITION" });
  }
  if (!invoice.lineItems?.length) {
    throw ApiError.conflict("An invoice with no line items cannot be sent", { code: "EMPTY_INVOICE" });
  }

  const nextStatus = deriveInvoiceStatus({
    amountPaid: 0,
    total: invoice.total,
    dueDate: invoice.dueDate,
    current: "Sent",
  });

  // Conditional transition: two administrators cannot both "send" the same
  // invoice, and a concurrently cancelled invoice is not resurrected.
  const updated = await Invoice.findOneAndUpdate(
    { _id: invoice._id, status: "Draft" },
    { $set: { status: nextStatus, sentAt: new Date() } },
    { new: true }
  );
  if (!updated) {
    throw ApiError.conflict("This invoice was already sent or changed by someone else", {
      code: "CONCURRENT_UPDATE",
    });
  }

  await recordAudit({
    actor: req.user,
    entityType: "Invoice",
    entityId: updated._id,
    action: "invoice.sent",
    fromState: "Draft",
    toState: updated.status,
    reason: updated.number,
  });

  await notifyUser({
    userId: invoice.client?.userId,
    type: "Finance",
    title: `Invoice ${updated.number} is ready`,
    message: `A new invoice for your project is available. Amount due: ${updated.total}.`,
    link: `/client-dashboard/invoices/${updated._id}`,
  });

  const populated = await populateInvoice(Invoice.findById(updated._id));
  return res.status(200).json({ success: true, invoice: populated });
};

export const recordPayment = async (req, res) => {
  assertAdmin(req);
  const invoice = await Invoice.findById(req.params.id).populate({
    path: "client",
    select: "userId companyName",
  });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (["Draft", "Cancelled"].includes(invoice.status)) {
    throw ApiError.conflict("A draft or cancelled invoice cannot receive a payment", {
      code: "INVALID_TRANSITION",
    });
  }
  const previousStatus = invoice.status;

  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest("Payment amount must be greater than zero", { code: "INVALID_AMOUNT" });
  }
  const roundedAmount = round(amount);
  const method = req.body.method || "Bank Transfer";
  if (!PAYMENT_METHODS.includes(method)) {
    throw ApiError.badRequest("Invalid payment method", { code: "INVALID_PAYMENT_METHOD" });
  }
  const date = req.body.date ? new Date(req.body.date) : new Date();
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest("Invalid payment date", { code: "INVALID_DATE" });

  const payment = {
    _id: new mongoose.Types.ObjectId(),
    amount: roundedAmount,
    date,
    method,
    reference: req.body.reference ? String(req.body.reference).slice(0, 200) : undefined,
    recordedBy: req.user._id,
  };

  /**
   * Append the payment and enforce the outstanding balance in ONE atomic
   * write.
   *
   * The old read-modify-write sequence let two simultaneous payments both see
   * the same balance. One overwrote the other's payment array (lost money) or
   * both passed the overpayment check (a client could be credited twice).
   * The $expr guard makes the balance check part of the same database
   * operation that appends the payment.
   */
  const paidExpression = { $sum: "$payments.amount" };
  const updated = await Invoice.findOneAndUpdate(
    {
      _id: invoice._id,
      status: { $nin: ["Draft", "Cancelled"] },
      $expr: {
        $lte: [
          { $round: [{ $add: [paidExpression, roundedAmount] }, 2] },
          { $round: ["$total", 2] },
        ],
      },
    },
    [
      {
        $set: {
          payments: {
            $concatArrays: [{ $ifNull: ["$payments", []] }, [payment]],
          },
        },
      },
      {
        $set: {
          amountPaid: { $round: [{ $sum: "$payments.amount" }, 2] },
          status: {
            $cond: [
              {
                $and: [
                  { $gt: ["$total", 0] },
                  { $gte: [{ $sum: "$payments.amount" }, "$total"] },
                ],
              },
              "Paid",
              {
                $cond: [
                  { $lt: ["$dueDate", new Date()] },
                  "Overdue",
                  {
                    $cond: [
                      { $gt: [{ $sum: "$payments.amount" }, 0] },
                      "Partially Paid",
                      "Sent",
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
    ],
    { new: true }
  );

  if (!updated) {
    // The conditional update failed. Re-read to explain why without ever
    // applying a partial payment.
    const current = await Invoice.findById(invoice._id).select("status total payments").lean();
    if (!current) throw ApiError.notFound("Invoice not found");
    if (["Draft", "Cancelled"].includes(current.status)) {
      throw ApiError.conflict("This invoice can no longer receive a payment", {
        code: "INVALID_TRANSITION",
      });
    }
    const alreadyPaid = round(
      (current.payments || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    );
    const outstanding = round(current.total - alreadyPaid);
    throw ApiError.badRequest(
      `Payment exceeds the outstanding balance of ${outstanding}. Record ${outstanding} or less.`,
      { code: "OVERPAYMENT", details: { outstanding, amount: roundedAmount } }
    );
  }

  await recordAudit({
    actor: req.user,
    entityType: "Invoice",
    entityId: updated._id,
    action: "invoice.payment_recorded",
    fromState: previousStatus,
    toState: updated.status,
    reason: `${updated.number} +${roundedAmount}`,
  });

  await notifyUser({
    userId: invoice.client?.userId,
    type: "Finance",
    title: "Payment recorded",
    message: `We recorded a payment of ${roundedAmount} against invoice ${updated.number}. Outstanding: ${round(
      updated.total - updated.amountPaid
    )}.`,
    link: `/client-dashboard/invoices/${updated._id}`,
  });

  const populated = await populateInvoice(Invoice.findById(updated._id));
  return res.status(200).json({ success: true, invoice: populated });
};

export const cancelInvoice = async (req, res) => {
  assertAdmin(req);
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.status === "Cancelled") {
    throw ApiError.conflict("Invoice is already cancelled", { code: "INVOICE_CANCELLED" });
  }
  if (invoice.payments?.length) {
    throw ApiError.conflict("An invoice with recorded payments cannot be cancelled", {
      code: "INVOICE_HAS_PAYMENTS",
    });
  }
  if (invoice.status === "Paid") {
    throw ApiError.conflict("A paid invoice cannot be cancelled", { code: "INVOICE_PAID" });
  }

  const previous = invoice.status;
  // Re-check status and payment state in the same write. A payment or another
  // cancellation arriving after the read must win, never be overwritten.
  const updated = await Invoice.findOneAndUpdate(
    {
      _id: invoice._id,
      status: { $nin: ["Cancelled", "Paid"] },
      "payments.0": { $exists: false },
    },
    { $set: { status: "Cancelled", cancelledAt: new Date() } },
    { new: true }
  );
  if (!updated) {
    throw ApiError.conflict("This invoice changed while you were cancelling it", {
      code: "CONCURRENT_UPDATE",
    });
  }

  await recordAudit({
    actor: req.user,
    entityType: "Invoice",
    entityId: updated._id,
    action: "invoice.cancelled",
    fromState: previous,
    toState: "Cancelled",
    reason: req.body.reason,
  });

  const populated = await populateInvoice(Invoice.findById(updated._id));
  return res.status(200).json({ success: true, invoice: populated });
};

export const deleteInvoice = async (req, res) => {
  assertAdmin(req);
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.status !== "Draft") {
    throw ApiError.conflict("Only a draft invoice can be deleted. Cancel an issued invoice instead.", {
      code: "INVOICE_ISSUED",
    });
  }

  const deleted = await Invoice.findOneAndDelete({ _id: invoice._id, status: "Draft" });
  if (!deleted) {
    throw ApiError.conflict("This invoice changed while you were deleting it", {
      code: "CONCURRENT_UPDATE",
    });
  }
  await recordAudit({
    actor: req.user,
    entityType: "Invoice",
    entityId: invoice._id,
    action: "invoice.deleted",
    fromState: "Draft",
    reason: invoice.number,
  });
  return res.status(200).json({ success: true, message: "Draft invoice deleted" });
};

export const invoiceSummary = async (req, res) => {
  await refreshOverdueInvoices();
  const match = { status: { $ne: "Cancelled" } };

  if (req.user.role === "client") {
    const clientId = await resolveIssuedTo(req.user);
    if (!clientId) return res.status(200).json({ success: true, summary: { billed: 0, collected: 0, outstanding: 0, overdue: 0, counts: {} } });
    match.client = clientId;
    match.status = { $nin: ["Draft", "Cancelled"] };
  } else if (req.user.role !== "admin") {
    throw ApiError.forbidden("Invoices are not available to this role", { code: "FORBIDDEN_ROLE" });
  }

  const [agg, counts] = await Promise.all([
    Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          billed: { $sum: { $cond: [{ $in: ["$status", ["Sent", "Partially Paid", "Paid", "Overdue"]] }, "$total", 0] } },
          collected: { $sum: "$amountPaid" },
          outstanding: {
            $sum: {
              $cond: [
                { $in: ["$status", ["Sent", "Partially Paid", "Overdue"]] },
                { $max: [0, { $subtract: ["$total", "$amountPaid"] }] },
                0,
              ],
            },
          },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$status", ["Sent", "Partially Paid", "Overdue"]] },
                    { $lt: ["$dueDate", new Date()] },
                  ],
                },
                { $max: [0, { $subtract: ["$total", "$amountPaid"] }] },
                0,
              ],
            },
          },
        },
      },
    ]),
    Invoice.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  return res.status(200).json({
    success: true,
    summary: {
      billed: round(agg[0]?.billed || 0),
      collected: round(agg[0]?.collected || 0),
      outstanding: round(agg[0]?.outstanding || 0),
      overdue: round(agg[0]?.overdue || 0),
      counts: counts.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {}),
    },
  });
};

export const exportInvoices = async (req, res) => {
  assertAdmin(req);
  await refreshOverdueInvoices();
  const filter = {};
  if (req.query.project) filter.project = req.query.project;
  if (req.query.status) filter.status = req.query.status;

  const invoices = await Invoice.find(filter)
    .populate("project", "code name")
    .populate({ path: "client", select: "companyName userId", populate: { path: "userId", select: "name" } })
    .sort({ issueDate: -1 })
    .lean();

  return csvResponse(res, `invoices-${new Date().toISOString().slice(0, 10)}.csv`, [
    { label: "Number", key: "number" },
    { label: "Issue Date", value: (r) => (r.issueDate ? new Date(r.issueDate).toISOString().slice(0, 10) : "") },
    { label: "Due Date", value: (r) => (r.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : "") },
    { label: "Project", value: (r) => r.project?.code || "" },
    { label: "Client", value: (r) => r.client?.companyName || r.client?.userId?.name || "" },
    { label: "Subtotal", key: "subtotal" },
    { label: "Tax", key: "taxAmount" },
    { label: "Total", key: "total" },
    { label: "Paid", key: "amountPaid" },
    { label: "Outstanding", value: (r) => round(r.total - r.amountPaid) },
    { label: "Status", key: "status" },
  ], invoices);
};

export default {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  sendInvoice,
  recordPayment,
  cancelInvoice,
  deleteInvoice,
  invoiceSummary,
  exportInvoices,
};
