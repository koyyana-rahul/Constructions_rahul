import AuditEvent from "../models/AuditEvent.js";

/**
 * Writes an audit entry for a consequential action.
 *
 * Audit failures must never break the business operation that triggered them,
 * so this logs and swallows errors rather than throwing.
 *
 * Callers must never pass passwords, tokens or full request bodies here.
 */
export const recordAudit = async ({
  actor,
  entityType,
  entityId,
  action,
  fromState,
  toState,
  reason,
  correlationId,
}) => {
  try {
    await AuditEvent.create({
      actor: actor?._id,
      actorRole: actor?.role,
      actorName: actor?.name,
      entityType,
      entityId,
      action,
      fromState: fromState ?? undefined,
      toState: toState ?? undefined,
      // Reason is free text from an authorised user; trim and cap length.
      reason: reason ? String(reason).slice(0, 500) : undefined,
      correlationId,
    });
  } catch (error) {
    console.error("[audit] failed to record event:", error.message);
  }
};

/** History for one entity, newest first. */
export const getEntityAudit = async (entityType, entityId, limit = 50) =>
  AuditEvent.find({ entityType, entityId })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 200));

export default { recordAudit, getEntityAudit };