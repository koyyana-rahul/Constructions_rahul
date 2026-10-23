import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import ApiError from "../utils/ApiError.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";

/** Every notification is scoped to the verified caller. There is no `userId` input. */
export const listNotifications = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  const filter = { user: req.user._id };
  // `{ readAt: null }` matches both an explicit null and a missing field, so
  // notifications written before the field existed still count as unread.
  if (req.query.unread === "true") filter.readAt = null;
  if (req.query.type) filter.type = req.query.type;

  const [notifications, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments({ user: req.user._id }),
    Notification.countDocuments({ user: req.user._id, readAt: { $eq: null } }),
  ]);

  return res.status(200).json({
    success: true,
    notifications,
    unread,
    pagination: paginationMeta({ page, limit }, total),
  });
};

export const unreadCount = async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user._id, readAt: { $eq: null } });
  return res.status(200).json({ success: true, unread: count });
};

export const markNotificationRead = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid notification identifier", { code: "INVALID_ID" });
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw ApiError.notFound("Notification not found");
  return res.status(200).json({ success: true, notification });
};

export const markAllRead = async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, readAt: { $eq: null } },
    { $set: { readAt: new Date() } }
  );
  return res.status(200).json({ success: true, updated: result.modifiedCount || 0 });
};

export const deleteNotification = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("Invalid notification identifier", { code: "INVALID_ID" });
  }
  const result = await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!result.deletedCount) throw ApiError.notFound("Notification not found");
  return res.status(200).json({ success: true, message: "Notification dismissed" });
};

export default {
  listNotifications,
  unreadCount,
  markNotificationRead,
  markAllRead,
  deleteNotification,
};
