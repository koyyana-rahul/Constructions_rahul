import crypto from "crypto";

/**
 * Cookie handling for the session token.
 *
 * ── Why cookies instead of localStorage ─────────────────────────────────────
 *
 * A token in `localStorage` is readable by any JavaScript running on the
 * page. One XSS flaw - one malicious npm package, one injected script - and
 * the session token is stolen. An `httpOnly` cookie is invisible to
 * JavaScript: the browser attaches it to requests automatically and no
 * injected script can read it.
 *
 * The trade-off is that cookies are sent AUTOMATICALLY, so a cross-site
 * request would carry them. That is the CSRF risk, and it is handled here
 * with a double-submit token:
 *
 *   - `builtra_token`  - httpOnly, the JWT. JavaScript cannot read it.
 *   - `builtra_csrf`   - readable by JavaScript. The frontend copies it into
 *                        the `X-CSRF-Token` header on every state-changing
 *                        request. An attacker's page can cause the cookie to
 *                        be sent, but it cannot READ it, so it cannot produce
 *                        a matching header.
 *
 * `SameSite=Lax` is a second, independent layer: it stops the cookie being
 * attached to cross-site POST/PUT/DELETE entirely.
 *
 * ── No dependency ──────────────────────────────────────────────────────────
 *
 * `cookie-parser` is not installed and is not needed: parsing a cookie
 * header is a split-and-decode, and the rules are stable. Doing it here keeps
 * the dependency list unchanged.
 */

export const AUTH_COOKIE = "builtra_token";
export const CSRF_COOKIE = "builtra_csrf";

/** Session length in milliseconds. Matches the JWT expiry. */
const defaultMaxAgeMs = 24 * 60 * 60 * 1000;

/**
 * Parses a `Cookie:` header into a plain object.
 *
 * Values are URI-decoded; a malformed escape sequence falls back to the raw
 * value rather than throwing, because a bad cookie must never be able to
 * crash a request.
 */
export const parseCookies = (header) => {
  const out = {};
  if (!header || typeof header !== "string") return out;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;

    const key = part.slice(0, eq).trim();
    if (!key) continue;

    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
      value = value.slice(1, -1);
    }

    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }

  return out;
};

/** `true` when the request is being served over HTTPS (directly or via proxy). */
const isSecureRequest = (req) =>
  req.secure ||
  req.get("x-forwarded-proto")?.split(",")[0].trim() === "https";

/**
 * Cookie attributes.
 *
 * `sameSite` and `secure` are configurable because a deployment with the
 * frontend and API on different registrable domains needs
 * `SameSite=None; Secure`, while a same-site deployment (the default) can
 * stay on `Lax` and work over plain HTTP in development.
 */
const cookieOptions = (req, { httpOnly, maxAge }) => ({
  httpOnly,
  // `Secure` is mandatory in production. In development over plain HTTP a
  // Secure cookie would be silently dropped by the browser, so it is only
  // forced when the request itself is HTTPS or NODE_ENV is production.
  secure:
    process.env.COOKIE_SECURE === "true" ||
    (process.env.NODE_ENV === "production" && isSecureRequest(req)),
  sameSite: process.env.COOKIE_SAMESITE || "lax",
  path: "/",
  maxAge,
});

/**
 * Issues the session cookie and its CSRF companion.
 *
 * The CSRF token is a fresh random value on every sign-in, so a token seen
 * in one session cannot be replayed against another.
 */
export const issueSessionCookies = (req, res, token, { maxAgeMs } = {}) => {
  const maxAge = maxAgeMs ?? defaultMaxAgeMs;
  const csrfToken = crypto.randomBytes(32).toString("hex");

  res.cookie(AUTH_COOKIE, token, cookieOptions(req, { httpOnly: true, maxAge }));
  res.cookie(CSRF_COOKIE, csrfToken, cookieOptions(req, { httpOnly: false, maxAge }));

  return csrfToken;
};

/** Removes both cookies. Used on sign-out and after a password change. */
export const clearSessionCookies = (req, res) => {
  const options = cookieOptions(req, { httpOnly: true, maxAge: 0 });
  res.clearCookie(AUTH_COOKIE, { ...options, maxAge: undefined });
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false, maxAge: undefined });
};

/**
 * Constant-time comparison for the CSRF token.
 *
 * `timingSafeEqual` throws if the buffers differ in length, so the lengths
 * are compared first and a mismatch returns false immediately.
 */
export const csrfMatches = (provided, expected) => {
  if (!provided || !expected) return false;

  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
};
