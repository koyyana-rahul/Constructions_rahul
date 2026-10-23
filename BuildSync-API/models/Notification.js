import mongoose from "mongoose";

/**
 * In-app notification.
 *
 * Notifications are a convenience, never the system of record: a failure to
 * write one must not roll back the leave approval or invoice payment that
 * triggered it. See `services/notificationService.js`.
 */
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["Info", "Approval", "Assignment", "Finance", "Safety", "Inventory", "System"],
      default: "Info",
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    link: { type: String, trim: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
