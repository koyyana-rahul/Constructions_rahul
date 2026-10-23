import mongoose from "mongoose";

/**
 * A Project is the execution side of the business.
 *
 * The existing WorkRequest records what a client *asked for*; a Project is the
 * job the contractor actually runs - with a site, a manager, a budget, a
 * schedule, milestones and a team. An approved work request can be converted
 * into a project without re-typing any of the client's details.
 */
const milestoneSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Delayed"],
      default: "Pending",
    },
    completedAt: { type: Date },
    weight: { type: Number, default: 1, min: 0, max: 100 },
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },

    site: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    // One project per accepted work request. Sparse unique so existing
    // projects and internal jobs without a request are unaffected.
    workRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkRequest",
      unique: true,
      sparse: true,
    },

    manager: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    team: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],

    status: {
      type: String,
      enum: [
        "Planning",
        "Mobilisation",
        "In Progress",
        "On Hold",
        "Completed",
        "Handover",
        "Closed",
        "Cancelled",
      ],
      default: "Planning",
      index: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Normal", "High", "Critical"],
      default: "Normal",
      index: true,
    },
    health: {
      type: String,
      enum: ["On Track", "At Risk", "Delayed", "On Hold"],
      default: "On Track",
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    actualEndDate: { type: Date },

    currency: { type: String, default: "INR", uppercase: true },
    contractValue: { type: Number, default: 0, min: 0 },
    estimatedCost: { type: Number, default: 0, min: 0 },

    // Manually maintained overall progress. Task completion is reported
    // separately by the API so the two figures never overwrite each other.
    progress: { type: Number, default: 0, min: 0, max: 100 },

    milestones: [milestoneSchema],
    tags: [{ type: String, trim: true }],

    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

projectSchema.index({ site: 1, status: 1 });
projectSchema.index({ client: 1, status: 1 });
projectSchema.index({ startDate: 1, endDate: 1 });

const Project = mongoose.model("Project", projectSchema);
export default Project;
