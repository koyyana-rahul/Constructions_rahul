import mongoose from "mongoose";

/**
 * Daily Progress Report (DPR) - the field record of what actually happened on
 * site today: labour presence, work completed, delays, safety notes and
 * materials consumed.
 *
 * One report per project per business date. Approving a report posts its
 * material usage to inventory exactly once (`stockApplied`), so a re-approval
 * can never double-deduct stock.
 */
const materialUseSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: "Material", required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true },
  },
  { _id: false }
);

const dailyReportSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD business date

    weather: {
      type: String,
      enum: ["Clear", "Cloudy", "Rain", "Heavy Rain", "Extreme Heat", "Wind", "Other"],
      default: "Clear",
    },
    workforce: {
      planned: { type: Number, default: 0, min: 0 },
      present: { type: Number, default: 0, min: 0 },
    },

    workCompleted: { type: String, required: true, trim: true, maxlength: 5000 },
    issues: { type: String, trim: true, maxlength: 3000 },
    safetyNotes: { type: String, trim: true, maxlength: 3000 },
    materialsUsed: [materialUseSchema],
    photos: [{ type: String }],

    status: {
      type: String,
      enum: ["Draft", "Submitted", "Approved"],
      default: "Draft",
      index: true,
    },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    submittedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true },

    stockApplied: { type: Boolean, default: false },
    stockAppliedAt: { type: Date },
  },
  { timestamps: true }
);

dailyReportSchema.index({ project: 1, date: 1 }, { unique: true });
dailyReportSchema.index({ site: 1, date: -1 });

const DailyReport = mongoose.model("DailyReport", dailyReportSchema);
export default DailyReport;
