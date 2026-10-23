import mongoose from "mongoose";

/** Plant, machinery and tools - owned or hired - allocated to sites. */
const equipmentSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      enum: [
        "Earthmoving",
        "Lifting",
        "Concrete",
        "Compaction",
        "Power",
        "Transport",
        "Survey",
        "Safety",
        "Other",
      ],
      default: "Other",
      index: true,
    },
    ownership: { type: String, enum: ["Owned", "Rented"], default: "Owned" },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Department", index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", index: true },
    status: {
      type: String,
      enum: ["Available", "In Use", "Maintenance", "Breakdown", "Retired"],
      default: "Available",
      index: true,
    },
    dailyRate: { type: Number, default: 0, min: 0 },
    hourlyRate: { type: Number, default: 0, min: 0 },
    purchaseDate: { type: Date },
    purchaseCost: { type: Number, default: 0, min: 0 },
    lastMaintenance: { type: Date },
    nextMaintenance: { type: Date, index: true },
    operator: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const Equipment = mongoose.model("Equipment", equipmentSchema);
export default Equipment;
