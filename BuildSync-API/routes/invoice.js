import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin, requireRole } from "../middleware/authorize.js";
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  sendInvoice,
  recordPayment,
  cancelInvoice,
  deleteInvoice,
  invoiceSummary,
  exportInvoices,
} from "../controllers/invoiceController.js";

const router = express.Router();

/**
 * Clients read only their own issued invoices. The controller derives the
 * client from the verified session; no client id is accepted from the body.
 * Every mutation asserts administrator rights in the controller as well, so
 * a new route cannot accidentally widen access.
 */
router.get(
  "/summary",
  authenticate,
  requireRole("admin", "client"),
  asyncHandler(invoiceSummary)
);
router.get("/export", authenticate, requireAdmin, asyncHandler(exportInvoices));
router.get("/", authenticate, requireRole("admin", "client"), asyncHandler(listInvoices));
router.post("/", authenticate, requireAdmin, asyncHandler(createInvoice));

router.get("/:id", authenticate, requireRole("admin", "client"), asyncHandler(getInvoice));
router.put("/:id", authenticate, requireAdmin, asyncHandler(updateInvoice));
router.delete("/:id", authenticate, requireAdmin, asyncHandler(deleteInvoice));

router.post("/:id/send", authenticate, requireAdmin, asyncHandler(sendInvoice));
router.post("/:id/payments", authenticate, requireAdmin, asyncHandler(recordPayment));
router.post("/:id/cancel", authenticate, requireAdmin, asyncHandler(cancelInvoice));

export default router;
