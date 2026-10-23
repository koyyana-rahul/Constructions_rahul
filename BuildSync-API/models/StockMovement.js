import mongoose from "mongoose";

/**
 * Append-only stock ledger.
 *
 * On-hand quantity is never stored as a mutable counter; it is the SUM of the
 * ledger. That makes every movement auditable and prevents the classic
 * "stock says 10 but the shelf says 4" drift from concurrent writes.
 *
 * `In` and `Out` quantities are positive. An `Adjustment` may be signed so a
 * stock count can be corrected in either direction, with a mandatory note.
 */
const stockMovementSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: "Material", required: true, index: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true, index: true },

    type: { type: String, enum: ["In", "Out", "Adjustment"], required: true },
    quantity: { type: Number, required: true },
    unitCost: { type: Number, default: 0, min: 0 },

    reference: { type: String, trim: true, maxlength: 200 },
    note: { type: String, trim: true, maxlength: 1000 },
    date: { type: Date, default: Date.now, index: true },

    source: {
      type: String,
      enum: ["Manual", "DailyReport", "Purchase", "Opening", "Correction"],
      default: "Manual",
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

stockMovementSchema.index({ material: 1, site: 1, date: -1 });

const StockMovement = mongoose.model("StockMovement", stockMovementSchema);
export default StockMovement;
