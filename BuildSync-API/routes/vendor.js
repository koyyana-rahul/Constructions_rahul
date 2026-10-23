import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin } from "../middleware/authorize.js";
import {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  archiveVendor,
  deleteVendor,
} from "../controllers/vendorController.js";

const router = express.Router();

/** Vendor rates and commercial terms are administrator-only. */
router.use(authenticate, requireAdmin);

router.get("/", asyncHandler(listVendors));
router.post("/", asyncHandler(createVendor));
router.get("/:id", asyncHandler(getVendor));
router.put("/:id", asyncHandler(updateVendor));
router.delete("/:id", asyncHandler(deleteVendor));
router.post("/:id/archive", asyncHandler(archiveVendor));

export default router;
