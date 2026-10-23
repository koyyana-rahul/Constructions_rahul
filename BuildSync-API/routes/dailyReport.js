import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin, requireRole } from "../middleware/authorize.js";
import { uploadReportPhotos } from "../middleware/multerConfig.js";
import {
  listReports,
  getReport,
  createReport,
  updateReport,
  submitReport,
  approveReport,
  rejectReport,
  deleteReport,
} from "../controllers/dailyReportController.js";

const router = express.Router();

/**
 * Daily progress reports.
 *
 * Reads are role-scoped inside the controller (clients only see approved
 * reports for their own projects; employees only their site or submissions).
 * Only field staff and administrators write, and only administrators approve.
 */
router.get("/", authenticate, asyncHandler(listReports));

router.post(
  "/",
  authenticate,
  requireRole("admin", "employee"),
  uploadReportPhotos.array("photos", 6),
  asyncHandler(createReport)
);

router.get("/:id", authenticate, asyncHandler(getReport));
router.put(
  "/:id",
  authenticate,
  requireRole("admin", "employee"),
  uploadReportPhotos.array("photos", 6),
  asyncHandler(updateReport)
);
router.delete(
  "/:id",
  authenticate,
  requireRole("admin", "employee"),
  asyncHandler(deleteReport)
);

router.post(
  "/:id/submit",
  authenticate,
  requireRole("admin", "employee"),
  asyncHandler(submitReport)
);
router.post("/:id/approve", authenticate, requireAdmin, asyncHandler(approveReport));
router.post("/:id/reject", authenticate, requireAdmin, asyncHandler(rejectReport));

export default router;
