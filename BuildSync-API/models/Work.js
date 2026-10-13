import mongoose from "mongoose";
import { Schema } from "mongoose";

const workRequestSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  // Free-text scope of work entered on the request form.
  description: { type: String, trim: true },
  // Stored filename of the optional uploaded supporting document.
  details: { type: String },
  status: {
    type: String,
    // Full lifecycle. `Pending`/`Approved`/`Rejected` are the legacy states and
    // remain valid so existing records and clients keep working.
    enum: [
      "Pending",
      "Under Review",
      "Approved",
      "Assigned",
      "In Progress",
      "Completed",
      "Verified",
      "Closed",
      "Rejected",
      "Returned for Correction",
      "On Hold",
      "Blocked",
      "Cancelled",
    ],
    default: "Pending",
  },
  rejectionReason: { type: String },
  appliedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const WorkRequest = mongoose.model("WorkRequest", workRequestSchema);
export default WorkRequest;