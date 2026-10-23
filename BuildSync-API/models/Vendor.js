import mongoose from "mongoose";

/** Suppliers and subcontractors - the organisations the company buys from. */
const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200, unique: true },
    category: {
      type: String,
      enum: ["Materials", "Equipment", "Subcontractor", "Transport", "Consultant", "Other"],
      default: "Materials",
      index: true,
    },
    contactName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    address: { type: String, trim: true, maxlength: 1000 },
    rating: { type: Number, min: 1, max: 5 },
    notes: { type: String, trim: true, maxlength: 2000 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const Vendor = mongoose.model("Vendor", vendorSchema);
export default Vendor;
