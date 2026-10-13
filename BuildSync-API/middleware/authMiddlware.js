import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Authenticates the request from the bearer token and attaches the live user
 * document to `req.user`.
 *
 * Changes from the previous version:
 *  - a missing/malformed Authorization header returns 401 instead of throwing
 *    (which previously surfaced as a 500 HTML page);
 *  - every authentication failure uses 401, reserving 403 for authorization;
 *  - an explicitly disabled account is rejected.
 */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization || "";

  if (!header) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
      code: "NO_TOKEN",
    });
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      error: "Malformed authorization header. Expected 'Bearer <token>'",
      code: "BAD_TOKEN",
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    const expired = error.name === "TokenExpiredError";
    return res.status(401).json({
      success: false,
      error: expired ? "Session expired, please sign in again" : "Invalid token",
      code: expired ? "TOKEN_EXPIRED" : "BAD_TOKEN",
    });
  }

  try {
    const user = await User.findById(decoded._id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Account no longer exists",
        code: "NO_USER",
      });
    }

    if (user.isDisabled) {
      return res.status(403).json({
        success: false,
        error: "This account has been disabled",
        code: "ACCOUNT_DISABLED",
      });
    }

    // The token's role claim is never trusted; the live document is the source
    // of truth so a role change takes effect immediately.
    req.user = user;
    req.token = token;
    return next();
  } catch (error) {
    console.error("authenticate:", error.message);
    return res.status(500).json({
      success: false,
      error: "Authentication service error",
      code: "AUTH_ERROR",
    });
  }
};

export default authenticate;