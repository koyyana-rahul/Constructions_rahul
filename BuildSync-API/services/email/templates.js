import { APP_NAME, APP_TAGLINE } from "../../config/brand.js";

/**
 * Email templates.
 *
 * Plain, dependency-free HTML. No template engine, no MJML, no build step -
 * the templates are short, and a template engine would be more machinery
 * than the job needs.
 *
 * Every template takes a `setupLink` that the caller has already built from
 * the TRUSTED `FRONTEND_BASE_URL` environment variable. A template never
 * constructs a URL from anything a request told it.
 */

const BRAND_NAVY = "#172554";
const BRAND_ORANGE = "#F97316";
const BRAND_TEXT = "#0F172A";
const BRAND_MUTED = "#64748B";
const BRAND_BORDER = "#E2E8F0";
const BRAND_BG = "#F8FAFC";

/** The wordmark used at the top of every email. */
const brandHeader = () => `
  <tr>
    <td style="padding:28px 32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding-right:12px;vertical-align:middle;">
            <span style="display:inline-block;width:36px;height:36px;border-radius:8px;background:${BRAND_NAVY};text-align:center;line-height:36px;font:700 20px/36px Arial,Helvetica,sans-serif;color:#ffffff;">B</span>
          </td>
          <td style="vertical-align:middle;">
            <span style="font:700 20px/1 Arial,Helvetica,sans-serif;letter-spacing:.06em;color:${BRAND_NAVY};">${APP_NAME.toUpperCase()}</span>
            <span style="display:block;margin-top:5px;font:400 11px/1 Arial,Helvetica,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${BRAND_MUTED};">${APP_TAGLINE}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

const brandFooter = () => `
  <tr>
    <td style="padding:8px 32px 28px;border-top:1px solid ${BRAND_BORDER};">
      <p style="margin:16px 0 0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${BRAND_MUTED};">
        Regards,<br />
        <strong style="color:${BRAND_TEXT};">${APP_NAME} Team</strong><br />
        ${APP_TAGLINE}
      </p>
    </td>
  </tr>`;

/** Wraps the body rows in the shared shell. */
const layout = (bodyRows) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${APP_NAME}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND_BG};">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND_BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND_BORDER};border-radius:12px;overflow:hidden;">
            ${brandHeader()}
            ${bodyRows}
            ${brandFooter()}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const button = (href, label = "Set up my password") => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 8px;">
    <tr>
      <td style="border-radius:8px;background:${BRAND_ORANGE};">
        <a href="${href}"
           style="display:inline-block;padding:13px 26px;font:700 14px/1 Arial,Helvetica,sans-serif;letter-spacing:.04em;color:#ffffff;text-decoration:none;border-radius:8px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;

const paragraph = (text) =>
  `<p style="margin:0 0 14px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:${BRAND_TEXT};">${text}</p>`;

const muted = (text) =>
  `<p style="margin:0 0 14px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:${BRAND_MUTED};">${text}</p>`;

/**
 * Escapes text that will be placed into an HTML body.
 *
 * The only dynamic values are a display name and a URL, both of which come
 * from the database or from a configured environment variable - but escaping
 * is still correct, because a display name is attacker-controllable (a
 * client can put anything in their name field).
 */
export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Employee invitation. */
export const employeeInvitationEmail = ({ name, setupLink, expiresInHours }) => {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(setupLink);

  const html = layout(`
    <tr>
      <td style="padding:8px 32px 8px;">
        ${paragraph(`Hello ${safeName},`)}
        ${paragraph(
          `Your employee account has been created on ${APP_NAME}, the construction management platform.`
        )}
        ${paragraph("To activate your account, use the secure link below to create your password:")}
        ${button(safeLink)}
        ${muted(
          `This link expires after ${expiresInHours} hours and can only be used once.`
        )}
        ${muted(
          "If the button does not work, copy this address into your browser:"
        )}
        ${muted(
          `<span style="word-break:break-all;font-family:Menlo,Consolas,monospace;font-size:12px;">${safeLink}</span>`
        )}
        ${muted(
          "If you were not expecting this invitation, please contact your administrator."
        )}
      </td>
    </tr>`);

  const text = [
    `Hello ${name},`,
    "",
    `Your employee account has been created on ${APP_NAME}, the construction management platform.`,
    "",
    "To activate your account, use the secure link below to create your password:",
    setupLink,
    "",
    `This link expires after ${expiresInHours} hours and can only be used once.`,
    "",
    "If you were not expecting this invitation, please contact your administrator.",
    "",
    "Regards,",
    `${APP_NAME} Team`,
    APP_TAGLINE,
  ].join("\n");

  return {
    subject: `Set up your ${APP_NAME} employee account`,
    html,
    text,
  };
};

/** Client invitation. */
export const clientInvitationEmail = ({ name, companyName, setupLink, expiresInHours }) => {
  const safeName = escapeHtml(name);
  const safeCompany = escapeHtml(companyName || "your organisation");
  const safeLink = escapeHtml(setupLink);

  const html = layout(`
    <tr>
      <td style="padding:8px 32px 8px;">
        ${paragraph(`Hello ${safeName},`)}
        ${paragraph(
          `Your client account for ${safeCompany} has been created on ${APP_NAME}, the construction management platform.`
        )}
        ${paragraph(
          "With it you can raise and track work requests, see the progress of your projects and stay in touch with your contractor."
        )}
        ${paragraph("To activate your account, use the secure link below to create your password:")}
        ${button(safeLink)}
        ${muted(
          `This link expires after ${expiresInHours} hours and can only be used once.`
        )}
        ${muted(
          "If the button does not work, copy this address into your browser:"
        )}
        ${muted(
          `<span style="word-break:break-all;font-family:Menlo,Consolas,monospace;font-size:12px;">${safeLink}</span>`
        )}
        ${muted(
          "If you were not expecting this invitation, please contact your contractor."
        )}
      </td>
    </tr>`);

  const text = [
    `Hello ${name},`,
    "",
    `Your client account for ${companyName || "your organisation"} has been created on ${APP_NAME}, the construction management platform.`,
    "",
    "With it you can raise and track work requests, see the progress of your projects and stay in touch with your contractor.",
    "",
    "To activate your account, use the secure link below to create your password:",
    setupLink,
    "",
    `This link expires after ${expiresInHours} hours and can only be used once.`,
    "",
    "If you were not expecting this invitation, please contact your contractor.",
    "",
    "Regards,",
    `${APP_NAME} Team`,
    APP_TAGLINE,
  ].join("\n");

  return {
    subject: `Set up your ${APP_NAME} client account`,
    html,
    text,
  };
};

/** Password reset. */
export const passwordResetEmail = ({ name, resetLink, expiresInMinutes }) => {
  const safeName = escapeHtml(name || "there");
  const safeLink = escapeHtml(resetLink);

  const html = layout(`
    <tr>
      <td style="padding:8px 32px 8px;">
        ${paragraph(`Hello ${safeName},`)}
        ${paragraph(
          `We received a request to reset the password for your ${APP_NAME} account.`
        )}
        ${paragraph("Choose a new password using the secure link below:")}
        ${button(safeLink, "Reset my password")}
        ${muted(
          `This link expires after ${expiresInMinutes} minutes and can only be used once.`
        )}
        ${muted(
          "If the button does not work, copy this address into your browser:"
        )}
        ${muted(
          `<span style="word-break:break-all;font-family:Menlo,Consolas,monospace;font-size:12px;">${safeLink}</span>`
        )}
        ${muted(
          "If you did not request a password reset, you can ignore this email. Your password will not change."
        )}
      </td>
    </tr>`);

  const text = [
    `Hello ${name || "there"},`,
    "",
    `We received a request to reset the password for your ${APP_NAME} account.`,
    "",
    "Choose a new password using the secure link below:",
    resetLink,
    "",
    `This link expires after ${expiresInMinutes} minutes and can only be used once.`,
    "",
    "If you did not request a password reset, you can ignore this email. Your password will not change.",
    "",
    "Regards,",
    `${APP_NAME} Team`,
    APP_TAGLINE,
  ].join("\n");

  return {
    subject: `Reset your ${APP_NAME} password`,
    html,
    text,
  };
};
