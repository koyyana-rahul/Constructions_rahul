import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Client from "../models/Client.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "../middleware/multerConfig.js";
import ApiError from "../utils/ApiError.js";
import {
  createActivationToken,
  hashActivationToken,
  isExpired,
} from "../services/activationService.js";
import {
  describeResult,
  resetTtlMinutes,
  sendClientInvitation,
  sendEmployeeInvitation,
  sendPasswordReset,
} from "../services/email/emailService.js";
import { body, validationResult } from "express-validator";
import { issueSessionCookies, clearSessionCookies } from "../utils/cookies.js";
import { bcryptSaltRounds } from "../config/security.js";

const PASSWORD_STRENGTH_MESSAGE =
  "Password must be at least 8 characters long and contain one uppercase letter, one lowercase letter, one number and one special character";

const PASSWORD_STRENGTH_REGEX =
  /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/;

// Validation middleware
export const loginValidation = [
  // Email comparison is already case-insensitive in the controller. Do NOT
  // use express-validator's normalizeEmail(): its defaults remove dots from
  // Gmail addresses and strip sub-addressing, so a valid stored address such
  // as first.last@gmail.com could never be matched again.
  body("email").trim().isEmail().withMessage("Please enter a valid email address"),
  // Passwords are opaque byte strings. Trimming them would silently change
  // the credential and could let a user set a password at activation that
  // login can never reproduce.
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];

export const forgotPasswordValidation = [
  body("email").trim().isEmail().withMessage("Please enter a valid email address"),
];

export const resetPasswordValidation = [
  body("resetToken").trim().notEmpty().withMessage("Reset token is required"),
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"
    ),
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

  const tokenHash = hashActivationToken(String(token).trim());
  const pendingUser = await User.findOne({ activationTokenHash: tokenHash });

  if (!pendingUser) {
    return res.status(400).json({
      success: false,
      error: "This activation link is not valid. Ask your administrator to send a new invitation.",
      code: "INVALID_TOKEN",
    });
  }
  if (isExpired(pendingUser.activationTokenExpiry)) {
    return res.status(400).json({
      success: false,
      error: "This activation link has expired. Ask your administrator to send a new invitation.",
      code: "EXPIRED_TOKEN",
    });
  }
  if (pendingUser.isDisabled) {
    return res.status(403).json({
      success: false,
      error: "This account has been disabled. Contact your administrator.",
      code: "ACCOUNT_DISABLED",
    });
  }

  /**
   * Consume the token atomically.
   *
   * A find-then-save would let two simultaneous submits both read the same
   * unused token and both succeed. The conditional update is the single point
   * where the token is claimed: only one request can match an unused, unexpired
   * token, and that same write clears it.
   */
  const passwordHash = await bcrypt.hash(password, bcryptSaltRounds());
  const user = await User.findOneAndUpdate(
    {
      _id: pendingUser._id,
      activationTokenHash: tokenHash,
      activationTokenExpiry: { $gt: new Date() },
      isDisabled: { $ne: true },
      isActivated: { $ne: true },
    },
    {
      $set: {
        password: passwordHash,
        isActivated: true,
        activatedAt: new Date(),
      },
      $unset: {
        activationTokenHash: 1,
        activationTokenExpiry: 1,
      },
    },
    { new: true }
  );

  if (!user) {
    return res.status(400).json({
      success: false,
      error: "This activation link has already been used or is no longer valid.",
      code: "INVALID_TOKEN",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Your account is ready. You can now sign in.",
    user: { _id: user._id, name: user.name, role: user.role },
  });
};

/**
 * Re-issue an activation link for an invited but not-yet-activated account.
 * Administrators only; the raw token is returned exactly once so the link can
 * still be delivered manually when email is not configured.
 */
const resendInvitation = async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound("User not found");
  if (!["client", "employee"].includes(user.role)) {
    throw ApiError.badRequest("Only invited client or employee accounts can be re-invited");
  }
  if (user.isActivated !== false) {
    throw ApiError.conflict("This account has already been activated");
  }
  if (user.isDisabled) {
    throw ApiError.conflict("This account is disabled. Re-enable it before sending an invitation.");
  }

  const token = createActivationToken();
  user.activationTokenHash = token.hash;
  user.activationTokenExpiry = token.expiresAt;
  user.invitedBy = req.user._id;
  await user.save();

  // Re-send the same kind of invitation the account originally received.
  let delivery;
  if (user.role === "client") {
    const client = await Client.findOne({ userId: user._id }).select("companyName");
    delivery = await sendClientInvitation({
      to: user.email,
      name: user.name,
      companyName: client?.companyName,
      token: token.raw,
    });
  } else {
    delivery = await sendEmployeeInvitation({
      to: user.email,
      name: user.name,
      token: token.raw,
    });
  }

  return res.status(200).json({
    success: true,
    message: delivery.delivered
      ? `A new activation link was emailed to ${user.email}.`
      : "A new activation link was generated, but the email was not delivered. Share the link manually.",
    activationToken: token.raw,
    expiresAt: token.expiresAt,
    emailDelivery: {
      delivered: Boolean(delivery.delivered),
      status: delivery.status,
      error: delivery.error,
      message: describeResult(delivery),
    },
  });
};

/** Resolves an activation token to the invitee so the UI can greet them. */
const verifyActivationToken = async (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) throw ApiError.badRequest("Activation token is required");

  const user = await User.findOne({
    activationTokenHash: hashActivationToken(token),
  }).select("name email role isActivated isDisabled activationTokenExpiry");

  if (!user || user.isActivated !== false || user.isDisabled) {
    throw ApiError.notFound("This activation link is not valid");
  }
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

/**
 * A valid bcrypt hash used only to equalise the time taken for an unknown
 * email and a wrong password. It cannot match any real password because the
 * plaintext was discarded.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8IazDqgWnAlnE7pJ6Jz7QmQ5wGJ2uK";

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Escaped so a crafted address cannot inject regex syntax.
    const escaped = String(email || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({
      email: { $regex: new RegExp("^" + escaped + "$", "i") }
    });

    // Identical response for unknown user and wrong password so this endpoint
    // cannot be used to enumerate registered accounts. An unknown email still
    // performs a bcrypt comparison against a dummy hash, so response timing
    // does not reveal whether the account exists either.
    const invalid = () =>
      res.status(401).json({
        success: false,
        error:
          "Invalid email or password. If you were recently invited, use the activation link to set your password first.",
      });

    if (!user) {
      await bcrypt.compare(String(password || ""), DUMMY_PASSWORD_HASH);
      return invalid();
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return invalid();

    // Status checks happen only after the password is verified: otherwise the
    // different responses would let an attacker discover disabled or pending
    // accounts without knowing their password.
    if (user.isDisabled) {
      return res.status(403).json({
        success: false,
        error: "This account has been disabled",
        code: "ACCOUNT_DISABLED",
      });
    }

    // Invited users cannot sign in until they set their own password.
    if (user.isActivated === false) {
      return res.status(403).json({
        success: false,
        error:
          "Your account has not been activated yet. Use the activation link your administrator sent you to set your password.",
        code: "ACCOUNT_NOT_ACTIVATED",
      });
    }

    const token = jwt.sign(
      {
        _id: user._id,
        role: user.role,
        sessionVersion: Number(user.sessionVersion) || 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "1d" }
    );

    /**
     * The token is handed to the browser as an httpOnly cookie, not in the
     * JSON body. JavaScript cannot read it, so an XSS flaw cannot exfiltrate
     * the session. The response body still carries the token so that
     * non-browser API clients (scripts, the test suite) can keep using the
     * `Authorization: Bearer` header.
     */
    issueSessionCookies(req, res, token);

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

/**
 * Ends the session.
 *
 * Clearing the cookie is what actually signs the user out - the JWT itself
 * is stateless, so the cookie is the only thing that has to be destroyed.
 */
const logout = async (req, res) => {
  clearSessionCookies(req, res);
  return res.status(200).json({ success: true, message: "Signed out" });
};

const verify = (req, res) => {
  return res.status(200).json({ success: true, user: req.user });
};

/** Only a digest of a reset token is stored, exactly like activation tokens. */
const hashResetToken = (token) =>
  crypto.createHash("sha256").update(String(token).trim()).digest("hex");

/**
 * Starts the self-service password reset flow.
 *
 * The response is deliberately identical for every well-formed address: an
 * attacker must not be able to use this endpoint to discover which accounts
 * exist. The raw reset token is never returned in the response - it only
 * travels in the emailed link.
 */
const forgotPassword = async (req, res) => {
  const genericResponse = () =>
    res.status(200).json({
      success: true,
      message:
        "If an account exists for that email address, a password reset link has been sent. Check your inbox and spam folder.",
    });

  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${escaped}$`, "i") },
    });

    // Unactivated and disabled accounts must not receive a working reset
    // link. The caller still gets the same generic response.
    if (!user || user.isDisabled || user.isActivated === false) {
      return genericResponse();
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = hashResetToken(rawToken);
    user.resetTokenExpiry = new Date(Date.now() + resetTtlMinutes() * 60 * 1000);
    await user.save();

    // Delivery failures are logged by the email service; the response stays
    // generic so it reveals nothing about the account or the mail provider.
    await sendPasswordReset({ to: user.email, name: user.name, token: rawToken });
    return genericResponse();
  } catch (error) {
    console.error("[forgot-password]", error.message);
    // Still hide account existence and internal details.
    return genericResponse();
  }
};

const resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;

  try {
    const passwordHash = await bcrypt.hash(newPassword, bcryptSaltRounds());
    const user = await User.findOneAndUpdate(
      {
        resetToken: hashResetToken(resetToken),
        resetTokenExpiry: { $gt: new Date() },
        isDisabled: { $ne: true },
        isActivated: { $ne: false },
      },
      {
        $set: { password: passwordHash, updatedAt: new Date() },
        $unset: { resetToken: 1, resetTokenExpiry: 1 },
        $inc: { sessionVersion: 1 },
      },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "This password reset link is invalid or has expired. Request a new one.",
        code: "INVALID_RESET_TOKEN",
      });
    }

    // A password reset never signs the caller in. Clearing any cookie that
    // happens to be present also prevents a stale session on a shared device.
    clearSessionCookies(req, res);

    return res.status(200).json({
      success: true,
      message: "Password reset successful. You can now sign in.",
    });
  } catch (error) {
    console.error("[reset-password]", error.message);
    return res.status(500).json({
      success: false,
      error: "Unable to reset the password right now. Please try again.",
    });
  }
};

export {
  activate,
  resendInvitation,
  verifyActivationToken,
  login,
  logout,
  verify,
  forgotPassword,
  resetPassword,
  handleValidationErrors,
};