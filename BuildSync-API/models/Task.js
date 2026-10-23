import mongoose from "mongoose";

/**
 * A unit of work on a project.
 *
 * Employees see and update only tasks assigned to them. Administrators can
 * create, assign, reschedule and close any task. `status` deliberately mirrors
 * the everyday vocabulary a site team already uses.
 */
const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 3000 },

    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    status: {
      type: String,
      enum: ["To Do", "In Progress", "Blocked", "Done"],
      default: "To Do",
      index: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Normal", "High", "Critical"],
      default: "Normal",
    },

    startDate: { type: Date },
    dueDate: { type: Date, index: true },
    completedAt: { type: Date },

    estimatedHours: { type: Number, default: 0, min: 0 },
    actualHours: { type: Number, default: 0, min: 0 },

    blockedReason: { type: String, trim: true, maxlength: 1000 },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, status: 1, dueDate: 1 });

const Task = mongoose.model("Task", taskSchema);
export default Task;
