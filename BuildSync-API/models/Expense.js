import mongoose from "mongoose";

/**
 * Project cost. An expense may be project-specific or general overhead, so
 * both references are optional - but at least one description and an amount
 * are always required.
 *
 * Only Approved and Paid expenses count towards "cost to date"; Pending and
 * Rejected entries are visible but excluded from budget reporting.
 */
const expenseSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", index: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Department", index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },

    category: {
      type: String,
      enum: [
        "Labour",
        "Materials",
        "Equipment",
        "Subcontractor",
        "Transport",
        "Utilities",
        "Permits",
        "Professional Fees",
        "Other",
      ],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    amount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    date: { type: Date, required: true, index: true },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "UPI", "Cheque", "Card", "Other"],
      default: "Bank Transfer",
    },
    reference: { type: String, trim: true, maxlength: 200 },
    receipt: { type: String }, // private filename, served by an authorised route
    notes: { type: String, trim: true, maxlength: 2000 },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Paid", "Rejected"],
      default: "Pending",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    paidAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

expenseSchema.index({ project: 1, status: 1, date: -1 });

const Expense = mongoose.model("Expense", expenseSchema);
export default Expense;
