import crypto from "crypto";

/**
 * Small dependency-free, in-process rate limiter.
 *
 * Used for credential endpoints where unlimited attempts enable brute-force
 * attacks. Keys are scoped per route and (optionally) per email so one busy
 * office IP cannot lock every account, while an attacker still cannot spray
 * unlimited passwords at a single account.
 *
 * This is intentionally simple. A multi-instance deployment should replace
 * the store with a shared one (Redis); the middleware contract stays the same.
 */

const buckets = new Map();
const MAX_BUCKETS = 20_000;

const prune = () => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

// Do not keep the Node process alive just for cleanup.
const timer = setInterval(prune, 60_000);
if (typeof timer.unref === "function") timer.unref();

const clientAddress = (req) =>
  String(req.ip || req.socket?.remoteAddress || "unknown");

const hashEmail = (value) =>
  crypto.createHash("sha256").update(String(value || "").trim().toLowerCase()).digest("hex");

/**
 * @param {object} options
 * @param {string} options.scope unique namespace for this limiter
 * @param {number} options.windowMs rolling window length
 * @param {number} options.max allowed requests per key in the window
 * @param {boolean} [options.byEmail] include the submitted email in the key
 * @param {string} [options.message] user-facing 429 message
 */
export const createRateLimit = ({
  scope,
  windowMs,
  max,
  byEmail = false,
  message = "Too many attempts. Please wait and try again.",
}) => {
  return (req, res, next) => {
    // The test suite runs hundreds of deliberate requests from one process.
    // Rate limiting is exercised separately, so keep it out of the way here.
    if (process.env.NODE_ENV === "test" || process.env.RATE_LIMIT_DISABLED === "true") {
      return next();
    }

    const now = Date.now();
    const emailPart = byEmail ? hashEmail(req.body?.email) : "";
    const key = `${scope}:${clientAddress(req)}:${emailPart}`;

    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      if (buckets.size >= MAX_BUCKETS) prune();
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(retryAfter));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        error: message,
        code: "RATE_LIMITED",
        retryAfter,
      });
    }

    return next();
  };
};

/** Clears all buckets. Exposed for tests and administrative tooling. */
export const resetRateLimits = () => buckets.clear();
