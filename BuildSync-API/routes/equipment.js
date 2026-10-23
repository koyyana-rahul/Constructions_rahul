import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin, requireRole } from "../middleware/authorize.js";
import {
  listEquipment,
  getEquipment,
  createEquipment,
  updateEquipment,
  retireEquipment,
  equipmentSummary,
} from "../controllers/equipmentController.js";

const router = express.Router();

router.get(
  "/summary",
  authenticate,
  requireRole("admin", "employee"),
  asyncHandler(equipmentSummary)
);
router.get("/", authenticate, requireRole("admin", "employee"), asyncHandler(listEquipment));
router.post("/", authenticate, requireAdmin, asyncHandler(createEquipment));

router.get("/:id", authenticate, requireRole("admin", "employee"), asyncHandler(getEquipment));
// Fleet records (rates, ownership, purchase cost) are commercially sensitive;
// administrators maintain them. Field staff still see availability via reads.
router.put("/:id", authenticate, requireAdmin, asyncHandler(updateEquipment));
router.post("/:id/retire", authenticate, requireAdmin, asyncHandler(retireEquipment));

export default router;
