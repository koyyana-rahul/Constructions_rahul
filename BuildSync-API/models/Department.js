import mongoose from "mongoose";

/**
 * A Department is a construction site.
 *
 * R4 fix: the previous `pre("deleteOne")` hook destroyed employees, their User
 * accounts, their leave and their salary records, while leaving Attendance
 * rows orphaned - irreversible loss of payroll and attendance history.
 *
 * New retention policy:
 *   - `isArchived` marks a site closed to new work. Historical records stay.
 *   - Archiving also deactivates its employees (deactivating their users) so
 *     nobody can sign in to a closed site.
 *   - Hard deletion is a separate, explicitly authorised admin action that
 *     refuses to run while historical records still reference the site.
 */
const departmentSchema = new mongoose.Schema(
  {
    dep_name: { type: String, required: true },
    description: { type: String },

    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

departmentSchema.pre("deleteOne", { document: true, query: false }, function (next) {
  next(
    new Error(
      "Sites cannot be hard-deleted while historical records exist. Use the archive endpoint instead."
    )
  );
});

const Department = mongoose.model("Department", departmentSchema);
export default Department;