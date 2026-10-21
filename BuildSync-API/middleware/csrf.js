import {
  AUTH_COOKIE,
  CSRF_COOKIE,
  csrfMatches,
  parseCookies,
} from "../utils/cookies.js";

/**
 * CSRF protection for cookie-authenticated requests.
 *
 * ── How it works ────────────────────────────────────────────────────────────
 *
 * The session cookie is attached by the browser automatically, including on
 * requests triggered by another site. A double-submit token stops that:
 *
 *   1. On sign-in the server sets `builtra_csrf` - a random value that IS
 *      readable by JavaScript, alongside the httpOnly session cookie.
 *   2. The frontend reads it and sends it back in the `X-CSRF-Token` header
 *      on every state-changing request.
 *   3. An attacker's page can cause the COOKIE to be sent, but it cannot
 *      READ the cookie, so it cannot produce a matching header. The request
 *      is rejected.
 *
 * `SameSite=Lax` on the session cookie is an independent second layer.
 *
 * ── Why the decision does not depend on middleware order ────────────────────
 *
 * The check is based on the CREDENTIAL THE REQUEST CARRIES, not on whether
 * `authenticate` has already run:
 *
 *   - no session cookie  -> nothing an attacker could ride on, allow.
 *   - an explicit bearer header -> a bearer token is never sent automatically
 *     by the browser, so it cannot be leveraged for CSRF. Scripts, Postman
 *     and the test suite keep working with no CSRF token.
 *   - a session cookie and no bearer header -> require the double-submit
 *     token.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const BEARER_RE = /^Bearer\s+\S+/;

export const requireCsrf = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookies = parseCookies(req.headers.cookie);
  const sessionCookie = cookies[AUTH_COOKIE];

  // No cookie-authenticated session on this request.
  if (!sessionCookie) return next();

  // The caller explicitly presented a bearer token instead.
  if (BEARER_RE.test(req.headers.authorization || "")) return next();

  const expected = cookies[CSRF_COOKIE];
  const provided = req.get("x-csrf-token");

  if (!csrfMatches(provided, expected)) {
    return res.status(403).json({
      success: false,
      error:
        "Your session could not be verified. Please refresh the page and try again.",
      code: "CSRF_TOKEN_INVALID",
    });
  }

  return next();
};

export default requireCsrf;
