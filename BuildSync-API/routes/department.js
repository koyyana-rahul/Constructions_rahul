import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin } from "../middleware/authorize.js";
import {
  getDepartments,
  addDepartment,
  getDepartment,
  updateDepartment,
  deleteDepartment,
  archiveDepartment,
  restoreDepartment,
} from "../controllers/departmentController.js";

const router = express.Router();

/** Construction sites are workforce administration: admins only (R3). */
router.get("/", authenticate, requireAdmin, asyncHandler(getDepartments));
router.post("/add", authenticate, requireAdmin, asyncHandler(addDepartment));
router.get("/:id", authenticate, requireAdmin, asyncHandler(getDepartment));
router.put("/:id", authenticate, requireAdmin, asyncHandler(updateDepartment));

// R4 fix: archive/restore replace the old destructive cascade.
router.put(
  "/:id/archive",
  authenticate,
  requireAdmin,
  asyncHandler(archiveDepartment),
);
router.put(
  "/:id/restore",
  authenticate,
  requireAdmin,
  asyncHandler(restoreDepartment),
);

router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  asyncHandler(deleteDepartment),
);

export default router;
