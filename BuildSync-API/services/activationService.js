import crypto from "crypto";

/**
 * Account-activation tokens.
 *
 * Used for administrator-issued client invitations: the admin creates the
 * account without ever choosing a password, and the client sets their own
 * password via a single-use, time-limited token.
 *
 * The raw token is returned to the caller exactly once. Only a SHA-256 digest
 * is stored, so a database leak cannot be replayed as a login.
 */

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

const hashToken = (raw) =>
  crypto.createHash("sha256").update(String(raw)).digest("hex");

/** Returns `{ raw, hash, expiresAt }` - persist only `hash` and `expiresAt`. */
export const createActivationToken = () => {
  const raw = crypto.randomBytes(32).toString("hex");
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  };
};

export const hashActivationToken = hashToken;

/** Timing-safe digest comparison. */
export const tokensMatch = (a, b) => {
  const bufA = Buffer.from(hashToken(a));
  const bufB = Buffer.from(hashToken(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

export const isExpired = (expiresAt) =>
  !expiresAt || new Date(expiresAt).getTime() <= Date.now();

/**
 * A placeholder hash for accounts that have not activated yet.
 *
 * `User.password` is `required: true`, so the field must hold a value. This is
 * a bcrypt hash of 64 bytes of random data that is never disclosed to anyone,
 * which makes the account impossible to authenticate until activation. It is
 * NOT a default password - nobody can know or derive it.
 */
export const unactivatedPasswordHash = async (bcrypt) =>
  bcrypt.hash(crypto.randomBytes(64).toString("hex"), 10);

export { TOKEN_TTL_MS };