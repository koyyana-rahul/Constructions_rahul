/**
 * Startup configuration checks.
 *
 * These run before the database connection and before the HTTP listener. A
 * misconfigured deployment should fail immediately with an actionable message
 * rather than start and fail later on the first login or password reset.
 *
 * Secrets are never printed, only their variable names.
 */

const PLACEHOLDER_SECRET =
  /(change[_-]?me|your[_-]?(secret|jwt)|replace[_-]?me|example|placeholder)/i;

const isProduction = () => process.env.NODE_ENV === "production";

export const validateStartupEnvironment = () => {
  const problems = [];
  const warnings = [];

  if (!String(process.env.MONGODB_URL || "").trim()) {
    problems.push("MONGODB_URL is missing. Copy .env.example to .env and set it.");
  }

  const jwtSecret = String(process.env.JWT_SECRET || "");
  if (!jwtSecret.trim()) {
    problems.push(
      "JWT_SECRET is missing. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  } else if (jwtSecret.length < 32) {
    problems.push("JWT_SECRET must be at least 32 characters long.");
  } else if (PLACEHOLDER_SECRET.test(jwtSecret)) {
    problems.push("JWT_SECRET is still a placeholder. Generate a unique random secret.");
  }

  const jwtExpires = String(process.env.JWT_EXPIRES || "").trim();
  if (jwtExpires && !/^\d+(ms|s|m|h|d|w|y)?$/i.test(jwtExpires)) {
    problems.push("JWT_EXPIRES must be a duration such as 2h, 1d or 3600s.");
  }

  const bcryptRounds = String(process.env.BCRYPT_SALT_ROUNDS || "").trim();
  if (bcryptRounds) {
    const rounds = Number(bcryptRounds);
    if (!Number.isInteger(rounds) || rounds < 10 || rounds > 15) {
      problems.push("BCRYPT_SALT_ROUNDS must be an integer between 10 and 15.");
    }
  }

  if (isProduction()) {
    if (!String(process.env.CLIENT_ORIGIN || "").trim()) {
      problems.push(
        "CLIENT_ORIGIN must list the public frontend origin(s) in production, separated by commas."
      );
    }

    const frontend = String(process.env.FRONTEND_BASE_URL || "").trim();
    if (!frontend) {
      problems.push(
        "FRONTEND_BASE_URL must be the public frontend URL in production so invitation and reset links are valid."
      );
    } else if (/localhost|127\.0\.0\.1|\[::1\]/i.test(frontend)) {
      problems.push(
        "FRONTEND_BASE_URL points at localhost. Set the public HTTPS URL in production."
      );
    }

    if (process.env.EMAIL_PROVIDER === "capture") {
      warnings.push(
        "EMAIL_PROVIDER=capture writes emails to .email-outbox instead of sending them. Invitations will only work through the manual link fallback."
      );
    }
  }

  if (warnings.length) {
    for (const warning of warnings) console.warn(`[config] warning: ${warning}`);
  }

  if (problems.length) {
    throw new Error(
      "Invalid environment configuration:\n" +
        problems.map((problem) => `  - ${problem}`).join("\n")
    );
  }
};

export default validateStartupEnvironment;
