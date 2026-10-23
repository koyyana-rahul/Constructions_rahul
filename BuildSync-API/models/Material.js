import mongoose from "mongoose";

/** Materials catalogue. Stock itself is derived from StockMovement rows. */
const materialSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      enum: [
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
      ],
      default: "Other",
      index: true,
    },
    unit: { type: String, required: true, trim: true, default: "Piece" },
    unitCost: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 },
    preferredVendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    description: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

materialSchema.index({ name: "text", sku: "text" });

const Material = mongoose.model("Material", materialSchema);
export default Material;
