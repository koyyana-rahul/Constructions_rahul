import AuditEvent from "../models/AuditEvent.js";
import ApiError from "../utils/ApiError.js";
import { escapeRegex } from "../services/accessService.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { getEntityAudit } from "../services/auditService.js";

/** Immutable audit trail. Administrators only. */
export const listAuditEvents = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const filter = {};

  if (req.query.entityType) filter.entityType = String(req.query.entityType).slice(0, 80);
  if (req.query.entityId) filter.entityId = req.query.entityId;
  if (req.query.action) filter.action = String(req.query.action).slice(0, 120);
  if (req.query.actor) filter.actor = req.query.actor;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) {
      const to = new Date(req.query.to);
      to.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = to;
    }
  }
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = [{ actorName: rx }, { action: rx }, { reason: rx }, { entityType: rx }];
  }

  const [events, total] = await Promise.all([
    AuditEvent.find(filter)
      .populate("actor", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditEvent.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    events,
    pagination: paginationMeta({ page, limit }, total),
  });
};

export const entityHistory = async (req, res) => {
  const { entityType, entityId } = req.params;
  if (!entityType || !entityId) {
    throw ApiError.badRequest("Entity type and id are required", { code: "MISSING_FIELD" });
  }
  const events = await getEntityAudit(entityType, entityId, Number(req.query.limit) || 50);
  return res.status(200).json({ success: true, events });
};

export const auditFacets = async (_req, res) => {
  const [entityTypes, actions, actors] = await Promise.all([
    AuditEvent.distinct("entityType"),
    AuditEvent.distinct("action"),
    AuditEvent.distinct("actorName"),
  ]);
  return res.status(200).json({
    success: true,
    facets: {
      entityTypes: entityTypes.sort(),
      actions: actions.sort(),
      actors: actors.filter(Boolean).sort(),
    },
  });
};

export default { listAuditEvents, entityHistory, auditFacets };
