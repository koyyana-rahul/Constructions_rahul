import express from "express";
import {
  activate,
  login,
  logout,
  verify,
  forgotPassword,
  resetPassword,
  verifyActivationToken,
  resendInvitation,
  handleValidationErrors,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from "../controllers/authController.js";
import authenticate from "../middleware/authMiddlware.js";
import { requireAdmin } from "../middleware/authorize.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createRateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

const MINUTE = 60 * 1000;

const loginIpLimit = createRateLimit({
  scope: "login-ip",
  windowMs: 15 * MINUTE,
  max: 60,
  message: "Too many sign-in attempts from this network. Please wait and try again.",
});

const loginAccountLimit = createRateLimit({
  scope: "login-account",
  windowMs: 15 * MINUTE,
  max: 10,
  byEmail: true,
  message: "Too many sign-in attempts for this account. Please wait and try again.",
});

const forgotIpLimit = createRateLimit({
  scope: "forgot-ip",
  windowMs: 15 * MINUTE,
  max: 20,
  message: "Too many password-reset requests. Please wait and try again.",
});

const forgotEmailLimit = createRateLimit({
  scope: "forgot-email",
  windowMs: 60 * MINUTE,
  max: 5,
  byEmail: true,
  message: "Too many password-reset requests for this address. Please wait and try again.",
});

const resetLimit = createRateLimit({
  scope: "reset-password",
  windowMs: 15 * MINUTE,
  max: 20,
  message: "Too many password-reset attempts. Please wait and try again.",
});

const activationLimit = createRateLimit({
  scope: "activation",
  windowMs: 15 * MINUTE,
  max: 40,
  message: "Too many activation attempts. Please wait and try again.",
});

const invitationLimit = createRateLimit({
  scope: "invitation-resend",
  windowMs: 15 * MINUTE,
  max: 30,
  message: "Too many invitation requests. Please wait and try again.",
});

/**
 * Public self-registration has been REMOVED.
 *
 * Client accounts are created by an administrator (POST /api/client/add).
 * The invitee then activates their own account and sets their own password
 * via POST /api/auth/activate - no administrator ever chooses a password.
 */

router.post(
  "/login",
  loginIpLimit,
  loginAccountLimit,
  loginValidation,
  handleValidationErrors,
  asyncHandler(login)
);
router.post(
  "/forgot-password",
  forgotIpLimit,
  forgotEmailLimit,
  forgotPasswordValidation,
  handleValidationErrors,
  asyncHandler(forgotPassword)
);
router.post(
  "/reset-password",
  resetLimit,
  resetPasswordValidation,
  handleValidationErrors,
  asyncHandler(resetPassword)
);

// Invitation activation - the invitee sets their own password.
router.post("/activate", activationLimit, asyncHandler(activate));
router.get("/activate", activationLimit, asyncHandler(verifyActivationToken));

router.get("/verify", authenticate, asyncHandler(verify));

// Sign-out: clears the httpOnly session cookie.
router.post("/logout", asyncHandler(logout));

// Re-issue an invitation link (administrators only).
router.post(
  "/invitations/:userId/resend",
  authenticate,
  requireAdmin,
  invitationLimit,
  asyncHandler(resendInvitation)
);

export default router;