import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import authenticate from "../middleware/authMiddlware.js";
import {
  listNotifications,
  unreadCount,
  markNotificationRead,
  markAllRead,
  deleteNotification,
} from "../controllers/notificationController.js";

const router = express.Router();

/**
 * Every query is scoped to `req.user` inside the controller. A caller can
 * never read, mark or dismiss another person's notification.
 */
router.get("/", authenticate, asyncHandler(listNotifications));
router.get("/unread-count", authenticate, asyncHandler(unreadCount));
router.post("/read-all", authenticate, asyncHandler(markAllRead));
router.post("/:id/read", authenticate, asyncHandler(markNotificationRead));
router.delete("/:id", authenticate, asyncHandler(deleteNotification));

export default router;
