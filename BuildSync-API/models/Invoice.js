import mongoose from "mongoose";

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true, default: "Item" },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ["Cash", "Bank Transfer", "UPI", "Cheque", "Card", "Other"],
      default: "Bank Transfer",
    },
    reference: { type: String, trim: true, maxlength: 200 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true }
);

/**
 * A client invoice, with its own line items and payment ledger.
 *
 * `amountPaid` is derived from the payments array on every write, never
 * accepted from the client. Status is recalculated from the money, so a paid
 * invoice cannot be left marked "Sent".
 */
const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, trim: true, uppercase: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },

    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },

    lineItems: {
      type: [lineItemSchema],
      validate: [(items) => items.length > 0, "An invoice needs at least one line item"],
    },

    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 18, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"],
      default: "Draft",
      index: true,
    },
    payments: [paymentSchema],

    notes: { type: String, trim: true, maxlength: 2000 },
    terms: { type: String, trim: true, maxlength: 2000 },
    sentAt: { type: Date },
    cancelledAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

invoiceSchema.index({ client: 1, status: 1, dueDate: 1 });
invoiceSchema.index({ project: 1, status: 1 });

/** Recompute line totals and the invoice totals before validation. */
invoiceSchema.pre("validate", function (next) {
  if (Array.isArray(this.lineItems)) {
    for (const item of this.lineItems) {
      if (Number.isFinite(Number(item.quantity)) && Number.isFinite(Number(item.rate))) {
        item.amount = Number((Number(item.quantity) * Number(item.rate)).toFixed(2));
      }
    }
    this.subtotal = Number(
      this.lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toFixed(2)
    );
  }
  const discount = Number(this.discountAmount) || 0;
  const taxRate = Number(this.taxRate) || 0;
  this.taxAmount = Number(
    (Math.max(0, (Number(this.subtotal) || 0) - discount) * (taxRate / 100)).toFixed(2)
  );
  this.total = Number(
    (Math.max(0, (Number(this.subtotal) || 0) - discount) + this.taxAmount).toFixed(2)
  );
  this.amountPaid = Number(
    (this.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toFixed(2)
  );
  next();
});

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
