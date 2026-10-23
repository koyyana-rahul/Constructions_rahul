import Notification from "../models/Notification.js";
import User from "../models/User.js";

/**
 * In-app notifications.
 *
 * Never throws: a notification is a convenience, and a failure to write one
 * must not roll back the business operation that triggered it.
 */
export const notifyUser = async ({
  userId,
  type = "Info",
  title,
  message,
  link,
  excludeUserId,
}) => {
  try {
    if (!userId) return null;
    if (excludeUserId && String(userId) === String(excludeUserId)) return null;
    return await Notification.create({ user: userId, type, title, message, link });
  } catch (error) {
    console.error("[notification] failed:", error.message);
    return null;
  }
};

export const notifyUsers = async (userIds, payload) => {
  try {
    const unique = [...new Set((userIds || []).filter(Boolean).map(String))].filter(
      (id) => !payload.excludeUserId || id !== String(payload.excludeUserId)
    );
    if (!unique.length) return;
    await Notification.insertMany(
      unique.map((user) => ({
        user,
        type: payload.type || "Info",
        title: payload.title,
        message: payload.message,
        link: payload.link,
      }))
    );
  } catch (error) {
    console.error("[notification] bulk failed:", error.message);
  }
};

export const notifyRoles = async (roles, payload) => {
  try {
    const users = await User.find({
      role: { $in: roles },
      isDisabled: { $ne: true },
    })
      .select("_id")
      .lean();

    await notifyUsers(
      users.map((u) => u._id),
      payload
    );
  } catch (error) {
    console.error("[notification] role fan-out failed:", error.message);
  }
};

export default { notifyUser, notifyUsers, notifyRoles };
