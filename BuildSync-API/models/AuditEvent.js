import mongoose from "mongoose";

/**
 * Append-only history of consequential business actions.
 *
 * Never stores passwords, tokens, or full document bodies - only identity,
 * what changed, and why.
 */
const auditSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  actorRole: { type: String, required: true },
  actorName: { type: String },

  entityType: { type: String, required: true, index: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  action: { type: String, required: true },

  fromState: { type: String },
  toState: { type: String },
  reason: { type: String },

  correlationId: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Read-oriented compound index for the audit viewer.
auditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

const AuditEvent = mongoose.model("AuditEvent", auditSchema);

// Audit entries are immutable.
auditSchema.pre(["updateOne", "updateMany", "deleteOne", "deleteMany", "findOneAndUpdate"], function (next) {
  next(new Error("Audit events are immutable"));
});

export default AuditEvent;