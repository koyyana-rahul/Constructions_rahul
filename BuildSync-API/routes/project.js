import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin } from "../middleware/authorize.js";
import {
  listProjects,
  getProject,
  prefillFromWorkRequest,
  createProject,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProject,
  addMilestone,
  updateMilestone,
  deleteMilestone,
} from "../controllers/projectController.js";

const router = express.Router();

/**
 * Projects are the execution core: every role reads the projects it is allowed
 * to see, but only an administrator creates, edits or archives one. The
 * controller applies the client/site/team scoping on every read.
 */
router.get("/", authenticate, asyncHandler(listProjects));

// Static prefixes must be registered before `/:id`.
router.get(
  "/prefill/work-request/:workRequestId",
  authenticate,
  requireAdmin,
  asyncHandler(prefillFromWorkRequest)
);

router.post("/", authenticate, requireAdmin, asyncHandler(createProject));

router.get("/:id", authenticate, asyncHandler(getProject));
router.put("/:id", authenticate, requireAdmin, asyncHandler(updateProject));
router.delete("/:id", authenticate, requireAdmin, asyncHandler(deleteProject));

router.post("/:id/archive", authenticate, requireAdmin, asyncHandler(archiveProject));
router.post("/:id/restore", authenticate, requireAdmin, asyncHandler(restoreProject));

router.post("/:id/milestones", authenticate, requireAdmin, asyncHandler(addMilestone));
router.put(
  "/:id/milestones/:milestoneId",
  authenticate,
  requireAdmin,
  asyncHandler(updateMilestone)
);
router.delete(
  "/:id/milestones/:milestoneId",
  authenticate,
  requireAdmin,
  asyncHandler(deleteMilestone)
);

export default router;
