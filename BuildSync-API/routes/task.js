import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin, requireRole } from "../middleware/authorize.js";
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
} from "../controllers/taskController.js";

const router = express.Router();

/** Tasks are an internal delivery tool: clients never see them. */
router.get("/", authenticate, requireRole("admin", "employee"), asyncHandler(listTasks));
router.post("/", authenticate, requireAdmin, asyncHandler(createTask));

router.get("/:id", authenticate, requireRole("admin", "employee"), asyncHandler(getTask));

// Employees may move their own task forward; the controller restricts which
// fields they can touch. Administrators can edit every field.
router.put("/:id", authenticate, requireRole("admin", "employee"), asyncHandler(updateTask));
router.delete("/:id", authenticate, requireAdmin, asyncHandler(deleteTask));

export default router;
