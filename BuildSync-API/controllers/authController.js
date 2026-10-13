import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Client from "../models/Client.js";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "../middleware/multerConfig.js";
import ApiError from "../utils/ApiError.js";
import {
  createActivationToken,
  hashActivationToken,
  isExpired,
} from "../services/activationService.js";
import { body, validationResult } from "express-validator";

const PASSWORD_STRENGTH_MESSAGE =
  "Password must be at least 8 characters long and contain one uppercase letter, one lowercase letter, one number and one special character";

const PASSWORD_STRENGTH_REGEX =
  /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/;

// Validation middleware
export const loginValidation = [
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please enter a valid email address"),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
];

export const forgotPasswordValidation = [
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please enter a valid email address")
];

export const resetPasswordValidation = [
  body("resetToken")
    .trim()
    .notEmpty()
    .withMessage("Reset token is required"),
  body("newPassword")
    .trim()
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long")
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number and one special character")
];

const removeUploadedFile = (file) => {
  if (!file) return;
  try {
    const filePath = path.join(UPLOAD_DIR, file.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (cleanupError) {
    console.log("Failed to clean up uploaded file:", cleanupError.message);
  }
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Rejected before the controller runs, so drop any file we already stored.
    removeUploadedFile(req.file);
    return res.status(400).json({ 
      success: false, 
      errors: errors.array().map(err => ({
        field: err.path ?? err.param,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Completes an administrator-issued invitation.
 *
 * The invitee sets their OWN password here. No administrator ever chooses or
 * transmits a client password, and no default password is ever generated.
 *
 * The token is single-use: it is cleared on success and rejected once expired.
 */
const activate = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !String(token).trim()) {
    return res.status(400).json({
      success: false,
      error: "Activation token is required",
      code: "MISSING_TOKEN",
    });
  }
  if (!password) {
    return res.status(400).json({
      success: false,
      error: "Please choose a password",
      code: "MISSING_PASSWORD",
    });
  }
  if (!PASSWORD_STRENGTH_REGEX.test(password)) {
    return res.status(400).json({
      success: false,
      error: PASSWORD_STRENGTH_MESSAGE,
      code: "WEAK_PASSWORD",
    });
  }

  const user = await User.findOne({ activationTokenHash: hashActivationToken(String(token).trim()) });

  if (!user) {
    return res.status(400).json({
      success: false,
      error: "This activation link is not valid. Ask your administrator to send a new invitation.",
      code: "INVALID_TOKEN",
    });
  }
  if (isExpired(user.activationTokenExpiry)) {
    return res.status(400).json({
      success: false,
      error: "This activation link has expired. Ask your administrator to send a new invitation.",
      code: "EXPIRED_TOKEN",
    });
  }
  if (user.isDisabled) {
    return res.status(403).json({
      success: false,
      error: "This account has been disabled. Contact your administrator.",
      code: "ACCOUNT_DISABLED",
    });
  }

  user.password = await bcrypt.hash(password, 10);
  user.isActivated = true;
  user.activatedAt = new Date();
  user.activationTokenHash = undefined;
  user.activationTokenExpiry = undefined;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Your account is ready. You can now sign in.",
    user: { _id: user._id, name: user.name, role: user.role },
  });
};

/**
 * Re-issue an activation link for an invited but not-yet-activated account.
 * Administrators only; the raw token is returned exactly once.
 */
const resendInvitation = async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound("User not found");
  if (user.role !== "client") {
    throw ApiError.badRequest("Invitations are only issued to client accounts");
  }
  if (user.isActivated) {
    throw ApiError.conflict("This account has already been activated");
  }

  const token = createActivationToken();
  user.activationTokenHash = token.hash;
  user.activationTokenExpiry = token.expiresAt;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "A new activation link has been generated.",
    activationToken: token.raw,
    expiresAt: token.expiresAt,
  });
};

/** Resolves an activation token to the invitee so the UI can greet them. */
const verifyActivationToken = async (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) throw ApiError.badRequest("Activation token is required");

  const user = await User.findOne({
    activationTokenHash: hashActivationToken(token),
  }).select("name email role isActivated activationTokenExpiry");

  if (!user) throw ApiError.notFound("This activation link is not valid");
  if (isExpired(user.activationTokenExpiry)) {
    throw ApiError.badRequest("This activation link has expired");
  }

  return res.status(200).json({
    success: true,
    name: user.name,
    email: user.email,
    expiresAt: user.activationTokenExpiry,
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Escaped so a crafted address cannot inject regex syntax.
    const escaped = String(email || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({
      email: { $regex: new RegExp("^" + escaped + "$", "i") }
    });

    // Identical response for unknown user and wrong password so this endpoint
    // cannot be used to enumerate registered accounts.
    const invalid = () =>
      res.status(401).json({ success: false, error: "Invalid email or password" });

    if (!user) return invalid();

    if (user.isDisabled) {
      return res.status(403).json({
        success: false,
        error: "This account has been disabled",
        code: "ACCOUNT_DISABLED",
      });
    }

    // Invited clients cannot sign in until they set their own password.
    if (user.isActivated === false) {
      return res.status(403).json({
        success: false,
        error:
          "Your account has not been activated yet. Use the activation link your administrator sent you to set your password.",
        code: "ACCOUNT_NOT_ACTIVATED",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return invalid();

    const token = jwt.sign(
      { _id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res
      .status(200)
      .json({
        success: true,
        token,
        user: { _id: user._id, name: user.name, role: user.role, email: user.email },
      });
  } catch (error) {
    console.error("[login]", error.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const verify = (req, res) => {
  return res.status(200).json({ success: true, user: req.user });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ 
      email: { $regex: new RegExp("^" + email + "$", "i") }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User Not Found" });
    }

    const resetToken = jwt.sign(
      { _id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset link generated",
      resetToken
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    const user = await User.findOne({
      resetToken,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired reset token"
      });
    }

    const hashPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful"
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export {
  activate,
  resendInvitation,
  verifyActivationToken,
  login,
  verify,
  forgotPassword,
  resetPassword,
  handleValidationErrors,
};