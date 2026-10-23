import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin } from "../middleware/authorize.js";
import { uploadReceipt } from "../middleware/multerConfig.js";
import {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  approveExpense,
  rejectExpense,
  markExpensePaid,
  deleteExpense,
  downloadReceipt,
  exportExpenses,
  expenseSummary,
} from "../controllers/expenseController.js";

const router = express.Router();

/**
 * Project spend is commercially sensitive: employees must not see cost data,
 * and receipts are private. Every route here is administrator-only.
 */
router.use(authenticate, requireAdmin);

router.get("/summary", asyncHandler(expenseSummary));
router.get("/export", asyncHandler(exportExpenses));

router.get("/", asyncHandler(listExpenses));
router.post("/", uploadReceipt.single("receipt"), asyncHandler(createExpense));

router.get("/:id", asyncHandler(getExpense));
router.put("/:id", uploadReceipt.single("receipt"), asyncHandler(updateExpense));
router.delete("/:id", asyncHandler(deleteExpense));

router.get("/:id/receipt", asyncHandler(downloadReceipt));

router.post("/:id/approve", asyncHandler(approveExpense));
router.post("/:id/reject", asyncHandler(rejectExpense));
router.post("/:id/paid", asyncHandler(markExpensePaid));

export default router;
