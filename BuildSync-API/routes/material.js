import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin, requireRole } from "../middleware/authorize.js";
import {
  listMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  archiveMaterial,
  listStock,
  listMovements,
  createMovement,
  getLowStock,
  getMaterialStock,
} from "../controllers/materialController.js";

const router = express.Router();

/** Stock is an internal, site-scoped tool: administrators and field staff. */
const inventoryRead = requireRole("admin", "employee");

router.get("/", authenticate, inventoryRead, asyncHandler(listMaterials));

// Literal paths must precede `/:id`.
router.get("/stock", authenticate, inventoryRead, asyncHandler(listStock));
router.get("/low-stock", authenticate, inventoryRead, asyncHandler(getLowStock));
router.get("/movements", authenticate, inventoryRead, asyncHandler(listMovements));

// A site engineer can record a goods receipt or issue. Corrections
// (`Adjustment`) are administrator-only because they rewrite the on-hand
// balance; the controller enforces that distinction.
router.post(
  "/movements",
  authenticate,
  requireRole("admin", "employee"),
  asyncHandler(createMovement)
);

router.post("/", authenticate, requireAdmin, asyncHandler(createMaterial));

router.get("/:id", authenticate, inventoryRead, asyncHandler(getMaterial));
router.get("/:id/stock", authenticate, inventoryRead, asyncHandler(getMaterialStock));
router.put("/:id", authenticate, requireAdmin, asyncHandler(updateMaterial));
router.post("/:id/archive", authenticate, requireAdmin, asyncHandler(archiveMaterial));

export default router;
