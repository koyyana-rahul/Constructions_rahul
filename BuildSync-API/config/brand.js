/**
 * Builtra brand constants - SERVER side.
 *
 * The frontend has its own copy in `BuildSync-CLIENT/src/lib/brand.js` (it
 * cannot import from the API, and the API has no bundler). The two files
 * hold the same values; keep them in step.
 *
 * The backend needs these for email templates, generated documents and any
 * user-facing message it produces.
 */

export const APP_NAME = "Builtra";

export const APP_TAGLINE = "From plans to progress.";

export const APP_ALT_TAGLINE = "Build better. Manage smarter.";

export const APP_CATEGORY = "Construction Management";

export const APP_DESCRIPTOR = "Construction Operations";

export const APP_TITLE = `${APP_NAME} — Construction Management Platform`;

export const APP_DESCRIPTION =
  `${APP_NAME} is a construction management platform for workforce, attendance, leave, ` +
  `payroll, client requests and site operations - connected workflows for ` +
  `construction companies of every size.`;

export const APP_SUPPORT_EMAIL = process.env.APP_SUPPORT_EMAIL || "support@builtra.com";

/**
 * The public frontend origin used to build links in emails.
 *
 * SECURITY: a setup link is a credential. It must be built from a TRUSTED,
 * CONFIGURED value - never from the `Host` header or any other part of the
 * incoming request, because an attacker can forge that header and make the
 * application email a victim a link pointing at a server the attacker
 * controls.
 */
export const frontendBaseUrl = () =>
  (
    process.env.FRONTEND_BASE_URL || "http://localhost:5173"
  ).replace(/\/+$/, "");

/** Builds a setup-password link for an invitation token. */
export const buildSetupLink = (token) =>
  `${frontendBaseUrl()}/setup-password?token=${encodeURIComponent(token)}`;
