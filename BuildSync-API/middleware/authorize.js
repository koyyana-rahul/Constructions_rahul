/**
 * Role-based and ownership-based authorization.
 *
 * These run *after* `authenticate`, which guarantees `req.user` exists.
 * Authorization is deny-by-default: an endpoint with no `requireRole` is
 * reachable by any authenticated user, so role-gated operations must opt in
 * explicitly.
 */

const ROLES = ["admin", "employee", "client"];

/** Gate an endpoint to one or more roles. */
export const requireRole =
  (...allowed) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "NO_AUTH",
      });
    }

    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to perform this action",
        code: "FORBIDDEN_ROLE",
        requiredRoles: allowed,
      });
    }

    return next();
  };

/**
 * Deny-by-default helper for admin-only operations that a client or employee
 * must never reach (approvals, payroll writes, workforce mutations).
 */
export const requireAdmin = requireRole("admin");

/**
 * Ownership check for "my own record" endpoints.
 *
 * `resolveOwnerId` returns the id of the record the caller is allowed to
 * act on, derived server-side from the token. If the caller is an admin the
 * helper returns the requested `:id` so admins retain their oversight.
 */
export const requireSelfOrAdmin = (resolveOwnerId) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
      code: "NO_AUTH",
    });
  }

  try {
    const ownerId = await resolveOwnerId(req);

    if (req.user.role === "admin") {
      return next();
    }

    if (String(ownerId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: "You can only access your own records",
        code: "FORBIDDEN_OWNERSHIP",
      });
    }

    return next();
  } catch (error) {
    console.error("requireSelfOrAdmin:", error.message);
    return res.status(500).json({
      success: false,
      error: "Authorization check failed",
      code: "AUTHZ_ERROR",
    });
  }
};

/** Narrow helper for readability at call sites. */
export const isAdmin = (req) => req.user?.role === "admin";
export const hasRole = (req, ...roles) => roles.includes(req.user?.role);
export { ROLES };