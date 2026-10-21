import mongoose from "mongoose";
import { Schema } from "mongoose";

const leaveSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  leaveType: {
    type: String,
    enum: ["Sick Leave", "Casual Leave", "Annual Leave"],
    required: true,
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: {
    type: String,
    /**
     * `Cancelled` MUST be in this enum.
     *
     * `leaveController.cancelLeave` (employee withdrawal) and the admin
     * decision path both set this state. While it was missing here, Mongoose
     * rejected the write with a ValidationError and the request surfaced as
     * a 500 - "cancelling my leave" was silently broken. The controller's
     * `LEAVE_STATES` and this enum are one list; they must not drift.
     */
    enum: ["Pending", "Approved", "Rejected", "Cancelled"],
    default: "Pending",
  },
  appliedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Leave = mongoose.model("Leave", leaveSchema);
export default Leave;
