import {
  clientInvitationEmail,
  employeeInvitationEmail,
} from "./templates.js";
import { buildSetupLink } from "../../config/brand.js";
import { isProviderConfigured, providerName, send } from "./providers.js";

/**
 * The email service.
 *
 * ── The one rule that matters ───────────────────────────────────────────────
 *
 * The application must NEVER claim an email was sent when it was not.
 *
 * `sendEmail` therefore returns a RESULT rather than throwing, and the
 * result distinguishes four outcomes:
 *
 *   sent            - a real provider accepted the message.
 *   captured        - no provider is configured; the message was written to
 *                     disk so a developer can open it. Nothing was delivered.
 *   failed          - the provider was tried and refused or errored.
 *   not_configured  - the provider is unusable (no API key, no SMTP host).
 *
 * The invitation code records this outcome on the account, so the
 * administrator sees "Invitation sent" or "Delivery failed - resend" and
 * never a false reassurance.
 */

/** How long an invitation link stays valid, in hours. */
export const invitationTtlHours = () =>
  Math.max(1, Number(process.env.INVITATION_TTL_HOURS) || 48);

/** True when a real mail provider is configured. */
export const isEmailConfigured = () => isProviderConfigured();

/** The provider that will be used. */
export const currentProvider = () => providerName();

/**
 * Sends one message.
 *
 * Never throws: a mail failure is an operational condition, not a crash.
 */
export const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  if (!to) {
    return {
      delivered: false,
      status: "failed",
      error: "No recipient address was supplied.",
    };
  }

  return send({ to, subject, html, text, replyTo });
};

/**
 * Sends the employee password-setup invitation.
 *
 * @param {string} token the RAW invitation token. It is used to build the
 *   link and is never logged or stored by this function.
 */
export const sendEmployeeInvitation = async ({ to, name, token }) => {
  const setupLink = buildSetupLink(token);
  const message = employeeInvitationEmail({
    name,
    setupLink,
    expiresInHours: invitationTtlHours(),
  });

  const result = await sendEmail({
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  return { ...result, setupLink };
};

/**
 * Sends the client password-setup invitation.
 */
export const sendClientInvitation = async ({ to, name, companyName, token }) => {
  const setupLink = buildSetupLink(token);
  const message = clientInvitationEmail({
    name,
    companyName,
    setupLink,
    expiresInHours: invitationTtlHours(),
  });

  const result = await sendEmail({
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  return { ...result, setupLink };
};

/**
 * A short, human-readable summary of the delivery outcome, for the API
 * response and for the administrator's screen.
 */
export const describeResult = (result) => {
  switch (result?.status) {
    case "sent":
      return "Invitation sent.";
    case "captured":
    case "not_configured":
      return "No email provider is configured, so the invitation was not sent. Share the setup link manually.";
    case "timeout":
      return "The email provider did not respond in time. Try resending the invitation.";
    default:
      return result?.error
        ? `The invitation could not be sent: ${result.error}`
        : "The invitation could not be sent. Try resending it.";
  }
};
