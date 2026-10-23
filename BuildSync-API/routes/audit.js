import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin } from "../middleware/authorize.js";
import {
  listAuditEvents,
  entityHistory,
  auditFacets,
} from "../controllers/auditController.js";

const router = express.Router();

/** The audit trail is immutable and administrator-only. */
router.use(authenticate, requireAdmin);

router.get("/", asyncHandler(listAuditEvents));
router.get("/facets", asyncHandler(auditFacets));
router.get("/entity/:entityType/:entityId", asyncHandler(entityHistory));

export default router;
