import User from "../models/User.js";
import bcrypt from "bcrypt";
import ApiError from "../utils/ApiError.js";
import { bcryptSaltRounds } from "../config/security.js";

const PASSWORD_STRENGTH_REGEX =
  /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/;

const assertStrong = (password) => {
  if (!PASSWORD_STRENGTH_REGEX.test(password || "")) {
    throw ApiError.badRequest(
      "Password must be at least 8 characters and contain one uppercase letter, one lowercase letter, one number and one special character",
      { code: "WEAK_PASSWORD" }
    );
  }
};

/**
 * Self-service password change.
 *
 * R0 fix: the target user is taken from `req.user` (populated from the
 * verified token) and is NEVER read from the request body. A client can no
 * longer reset an administrator's password by sending someone else's id.
 */
const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword) {
    throw ApiError.badRequest("Current password is required", { code: "MISSING_FIELD" });
  }
  if (!newPassword) {
    throw ApiError.badRequest("New password is required", { code: "MISSING_FIELD" });
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw ApiError.unauthorized("Account no longer exists");
  }

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    // 400 not 401: the caller is authenticated, the supplied credential is wrong.
    throw ApiError.badRequest("Current password is incorrect", {
      code: "WRONG_PASSWORD",
    });
  }

  if (oldPassword === newPassword) {
    throw ApiError.badRequest("New password must be different from the current password", {
      code: "PASSWORD_UNCHANGED",
    });
  }

  assertStrong(newPassword);

  user.password = await bcrypt.hash(newPassword, bcryptSaltRounds());
  // Invalidate outstanding reset tokens and every existing session. The
  // caller must sign in again with the new password.
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  user.sessionVersion = (Number(user.sessionVersion) || 0) + 1;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Password updated. Please sign in again.",
    reauthenticate: true,
  });
};

/**
 * Administrative password reset.
 *
 * Deliberately a separate, explicitly authorized workflow so an admin can
 * recover an account without ever learning another user's current password.
 * The target is taken from the path, not the body, and only admins may call it.
 */
const adminResetPassword = async (req, res) => {
  const { userId } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    throw ApiError.badRequest("New password is required", { code: "MISSING_FIELD" });
  }
  assertStrong(newPassword);

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  user.password = await bcrypt.hash(newPassword, bcryptSaltRounds());
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  // End any session the target user already had.
  user.sessionVersion = (Number(user.sessionVersion) || 0) + 1;
  await user.save();

  return res.status(200).json({
    success: true,
    message: `Password reset for ${user.email}. Their existing sessions have been signed out.`,
  });
};

export { changePassword, adminResetPassword };