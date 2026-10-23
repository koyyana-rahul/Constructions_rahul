import mongoose from "mongoose";

/**
 * A safety incident or near miss.
 *
 * High and Critical incidents notify every administrator immediately. The
 * corrective action and status are kept on the record so a closed incident
 * still shows what was done about it.
 */
const safetyIncidentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", index: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    date: { type: Date, required: true, default: Date.now, index: true },

    type: {
      type: String,
      enum: [
        "Near Miss",
        "First Aid",
        "Lost Time Injury",
        "Property Damage",
        "Environmental",
        "Unsafe Act",
        "Unsafe Condition",
        "Other",
      ],
      default: "Near Miss",
      index: true,
    },
    severity: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Low",
      index: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    peopleInvolved: { type: String, trim: true, maxlength: 1000 },
    immediateAction: { type: String, trim: true, maxlength: 3000 },
    correctiveAction: { type: String, trim: true, maxlength: 3000 },
    lostTimeDays: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ["Open", "Investigating", "Resolved", "Closed"],
      default: "Open",
      index: true,
    },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closedAt: { type: Date },
    photos: [{ type: String }],
  },
  { timestamps: true }
);

safetyIncidentSchema.index({ site: 1, status: 1, date: -1 });

const SafetyIncident = mongoose.model("SafetyIncident", safetyIncidentSchema);
export default SafetyIncident;
