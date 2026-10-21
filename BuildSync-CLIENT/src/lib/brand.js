/**
 * Brand constants - the single source of truth for the Builtra identity.
 *
 * Before this file the product name was written literally into a dozen
 * components, the HTML title and the README, so a rename meant hunting for
 * string literals. Anything that needs the product name, the tagline or a
 * document header imports it from here instead.
 *
 * Note what is deliberately NOT here: anything that would break an existing
 * installation. The MongoDB database name, the API route prefixes, the
 * environment variable names and the localStorage keys are compatibility
 * surfaces, not branding - see `docs/BRANDING.md`.
 */

export const APP_NAME = "Builtra";

export const APP_TAGLINE = "From plans to progress.";

export const APP_ALT_TAGLINE = "Build better. Manage smarter.";

export const APP_CATEGORY = "Construction Management";

export const APP_DESCRIPTOR = "Construction Operations";

/** Short line used under the wordmark in the sidebar and the auth panel. */
export const APP_SUBTITLE = "Construction Ops";

/** <title> and the social preview title. */
export const APP_TITLE = `${APP_NAME} — Construction Management Platform`;

/** Meta description for search engines and link previews. */
export const APP_DESCRIPTION =
  `${APP_NAME} is a construction management platform for workforce, attendance, leave, ` +
  `payroll, client requests and site operations - connected workflows for ` +
  `construction companies of every size.`;

/** Support address shown in generated documents. */
export const APP_SUPPORT_EMAIL = "support@builtra.com";

/**
 * Wordmark split for the two-tone lockup.
 * "Built" carries the brand, "ra" carries the accent.
 */
export const WORDMARK_LEAD = "Built";
export const WORDMARK_ACCENT = "ra";

/** The API origin serving uploaded files, used in generated document headers. */
export const APP_PRODUCT_LINE = `${APP_NAME} · ${APP_TAGLINE}`;
