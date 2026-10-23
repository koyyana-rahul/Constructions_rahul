import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { AUTH_COOKIE, parseCookies } from "../utils/cookies.js";

/**
 * Authenticates the request and attaches the live user document to `req.user`.
 *
 * The token is read from the httpOnly session cookie FIRST, then from an
 * `Authorization: Bearer` header.
 *
 * Why the cookie comes first: the browser attaches it automatically, which
 * is what lets the frontend stop holding the token in `localStorage` where
 * any injected script could read it. The Bearer header is kept as a
 * supported alternative for scripts, the test suite and any server-to-server
 * caller - a bearer token is never sent automatically, so it cannot be used
 * for CSRF.
 *
 * `req.authVia` records which one was used, because the CSRF check only
 * applies to cookie-authenticated requests.
 *
 * Every authentication failure uses 401; 403 is reserved for authorization.
 */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const cookies = parseCookies(req.headers.cookie);

  let token = cookies[AUTH_COOKIE] || null;
  let authVia = "cookie";

  if (!token) {
    const [scheme, bearer] = header.split(" ");
    if (scheme === "Bearer" && bearer) {
      token = bearer;
      authVia = "bearer";
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
      code: "NO_TOKEN",
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

    // Password changes increment sessionVersion. A token issued before the
    // change is no longer accepted, so resetting a password terminates every
    // other signed-in device. Tokens without the claim predate this check and
    // remain compatible.
    if (
      decoded.sessionVersion !== undefined &&
      Number(decoded.sessionVersion) !== (Number(user.sessionVersion) || 0)
    ) {
      return res.status(401).json({
        success: false,
        error: "Your password was changed. Please sign in again.",
        code: "SESSION_REVOKED",
      });
    }

    // The token's role claim is never trusted; the live document is the source
    // of truth so a role change takes effect immediately.
    req.user = user;
    req.token = token;
    req.authVia = authVia;
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