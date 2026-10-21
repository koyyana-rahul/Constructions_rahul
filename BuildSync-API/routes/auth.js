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

const router = express.Router();

/**
 * Public self-registration has been REMOVED.
 *
 * Client accounts are created by an administrator (POST /api/client/add).
 * The invitee then activates their own account and sets their own password
 * via POST /api/auth/activate - no administrator ever chooses a password.
 */

router.post("/login", loginValidation, handleValidationErrors, asyncHandler(login));
router.post(
  "/forgot-password",
  forgotPasswordValidation,
  handleValidationErrors,
  asyncHandler(forgotPassword)
);
router.post(
  "/reset-password",
  resetPasswordValidation,
  handleValidationErrors,
  asyncHandler(resetPassword)
);

// Invitation activation - the invitee sets their own password.
router.post("/activate", asyncHandler(activate));
router.get("/activate", asyncHandler(verifyActivationToken));

router.get("/verify", authenticate, asyncHandler(verify));

// Sign-out: clears the httpOnly session cookie.
router.post("/logout", asyncHandler(logout));

// Re-issue an invitation link (administrators only).
router.post(
  "/invitations/:userId/resend",
  authenticate,
  requireAdmin,
  asyncHandler(resendInvitation)
);

export default router;