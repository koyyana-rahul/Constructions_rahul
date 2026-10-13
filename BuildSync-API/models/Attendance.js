import mongoose from "mongoose";

/**
 * One row per employee per business date.
 *
 * R8 fix: the enum is normalised to TitleCase (`Present|Absent|Sick|Leave`)
 * and `runValidators` is now enabled on updates, so the lowercase values the
 * UI previously wrote are rejected rather than silently stored.
 */
const AttendanceSchema = new mongoose.Schema(
  {
    date: {
      type: String, // "YYYY-MM-DD", business date in the site's local timezone
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Sick", "Leave"],
      default: null, // null = not yet marked. NEVER "Present" by default.
    },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    correctedAt: { type: Date },
    correctionReason: { type: String },
  },
  { timestamps: true }
);

// R10 fix: one attendance record per employee per day, enforced in the database.
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", AttendanceSchema);

export default Attendance;