/**
 * Email self-check.
 *
 *   npm run email:check -- you@yourdomain.com
 *
 * Sends a real test message through the CONFIGURED provider and reports
 * exactly what happened. It never prints a secret, and it never claims
 * success when the provider refused the message.
 *
 * Exit codes:
 *   0  the provider accepted the message
 *   1  the provider refused it, or is not configured
 */
import { sendEmail, isEmailConfigured, currentProvider } from "../services/email/emailService.js";
import { APP_NAME, APP_TAGLINE } from "../config/brand.js";

const to = process.argv[2];

if (!to) {
  console.error(
    "Usage: npm run email:check -- recipient@example.com\n" +
      "  Set EMAIL_PROVIDER=http (or smtp) plus the matching credentials first."
  );
  process.exit(1);
}

console.log(`\n${APP_NAME} email self-check`);
console.log("─".repeat(58));
console.log(`  Provider    : ${currentProvider()}`);
console.log(`  Configured  : ${isEmailConfigured() ? "yes" : "no"}`);
console.log(`  Recipient   : ${to}`);
console.log("─".repeat(58));

const result = await sendEmail({
  to,
  subject: `${APP_NAME} email test`,
  text: [
    `This is a test message from ${APP_NAME}.`,
    "",
    "If you can read it, the mail provider is configured correctly.",
    "",
    APP_TAGLINE,
  ].join("\n"),
  html: `
    <p style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#0F172A;">
      This is a test message from <strong>${APP_NAME}</strong>.
    </p>
    <p style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#0F172A;">
      If you can read it, the mail provider is configured correctly.
    </p>
    <p style="font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#64748B;">${APP_TAGLINE}</p>
  `,
});

console.log(`  Status      : ${result.status}`);
console.log(`  Delivered   : ${result.delivered ? "yes" : "no"}`);
if (result.id) console.log(`  Message id  : ${result.id}`);
if (result.error) console.log(`  Detail      : ${result.error}`);
console.log("─".repeat(58));

if (result.delivered) {
  console.log(`  PASS - the provider accepted the message.\n`);
  process.exit(0);
}

console.error(
  `  FAIL - the message was not delivered (${result.status}).\n` +
    `         Check the provider configuration and try again.\n`
);
process.exit(1);
