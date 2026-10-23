import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const API_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Email providers.
 *
 * A provider is a function that takes a message and returns a result:
 *
 *   { delivered: boolean, status: string, id?: string, error?: string }
 *
 * `delivered` means "the provider accepted the message for delivery". It is
 * NOT the same as "the recipient received it" - no provider can promise
 * that - but it IS the difference between "we handed it over" and "it
 * failed", and the application must never claim the first when it happened
 * the second.
 *
 * Three providers, no new npm dependency required for any of them:
 *
 *   http    - any provider with a JSON REST send API (Resend is the
 *             reference implementation). Uses the built-in `fetch`.
 *   smtp    - classic SMTP, via `nodemailer` IF it is installed. Loaded
 *             dynamically so the project does not have to depend on it.
 *   capture - development only. Writes the rendered message to disk so the
 *             whole pipeline can be inspected without sending anything. It
 *             ALWAYS reports `delivered: false`, because nothing was sent.
 */

const DEFAULT_TIMEOUT_MS = 15000;

/** Redacts anything that looks like a key before it reaches a log. */
const redact = (value) =>
  String(value ?? "").replace(/([A-Za-z0-9_-]{6})[A-Za-z0-9_-]{10,}/g, "$1***");

/**
 * HTTP provider.
 *
 * `EMAIL_API_URL` defaults to the Resend send endpoint, but the shape is
 * generic enough for any provider that accepts `{from, to, subject, html,
 * text}` and returns `{id}`.
 */
const httpProvider = async (message, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
  const url = process.env.EMAIL_API_URL || "https://api.resend.com/emails";
  const key = process.env.EMAIL_API_KEY;

  if (!key) {
    return {
      delivered: false,
      status: "not_configured",
      error: "EMAIL_API_KEY is not set.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Builtra <onboarding@localhost>",
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });

    const raw = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* a non-JSON error body is handled below */
    }

    if (!response.ok) {
      const detail =
        parsed?.message ||
        parsed?.error?.message ||
        parsed?.name ||
        `HTTP ${response.status}`;
      return {
        delivered: false,
        status: "failed",
        error: redact(detail),
      };
    }

    return {
      delivered: true,
      status: "sent",
      id: parsed?.id || parsed?.message_id || undefined,
    };
  } catch (error) {
    return {
      delivered: false,
      status: error.name === "AbortError" ? "timeout" : "failed",
      error: redact(error.message),
    };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * SMTP provider.
 *
 * `nodemailer` is loaded dynamically. If it is not installed the provider
 * reports that clearly instead of failing with a module-not-found error.
 */
const smtpProvider = async (message, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
  let nodemailer;
  try {
    ({ default: nodemailer } = await import("nodemailer"));
  } catch {
    return {
      delivered: false,
      status: "not_configured",
      error:
        "EMAIL_PROVIDER=smtp requires the 'nodemailer' package. Install it with `npm install nodemailer`.",
    };
  }

  if (!process.env.SMTP_HOST) {
    return {
      delivered: false,
      status: "not_configured",
      error: "SMTP_HOST is not set.",
    };
  }

  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
    });

    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || "Builtra <onboarding@localhost>",
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
    });

    return { delivered: true, status: "sent", id: info?.messageId };
  } catch (error) {
    return {
      delivered: false,
      status: "failed",
      error: redact(error.message),
    };
  }
};

/**
 * Capture provider - development only.
 *
 * Writes the rendered message to `.email-outbox/` so a developer can open
 * the HTML and click the link, without needing a mail provider at all.
 *
 * It reports `delivered: false` on purpose: nothing was delivered, and the
 * application must not tell an administrator that an email was sent.
 */
const captureProvider = async (message) => {
  try {
    const dir = path.join(API_ROOT, ".email-outbox");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = String(message.to || "unknown").replace(/[^a-z0-9]+/gi, "-");
    const base = path.join(dir, `${stamp}-${slug}`);

    fs.writeFileSync(`${base}.html`, message.html || "", "utf8");
    fs.writeFileSync(
      `${base}.txt`,
      `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text || ""}\n`,
      "utf8"
    );

    return {
      delivered: false,
      status: "captured",
      id: path.basename(base),
      error: `No mail provider is configured, so the message was written to ${base}.html instead of being sent.`,
    };
  } catch (error) {
    return {
      delivered: false,
      status: "failed",
      error: redact(error.message),
    };
  }
};

const PROVIDERS = {
  http: httpProvider,
  smtp: smtpProvider,
  capture: captureProvider,
};

/** The provider name from the environment, defaulting to `capture`. */
export const providerName = () => {
  const name = (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  return name || "capture";
};

/**
 * True when a REAL provider is configured.
 *
 * The application uses this to decide whether to describe an invitation as
 * "sent" or as "not delivered - send the link manually".
 */
export const isProviderConfigured = () => {
  const name = providerName();
  if (name === "http") return Boolean(process.env.EMAIL_API_KEY);
  if (name === "smtp") return Boolean(process.env.SMTP_HOST);
  return false;
};

/** Sends a message through the configured provider. */
export const send = async (message) => {
  const name = providerName();
  const provider = PROVIDERS[name];

  if (!provider) {
    return {
      delivered: false,
      status: "not_configured",
      error: `Unknown EMAIL_PROVIDER "${name}". Use one of: ${Object.keys(PROVIDERS).join(", ")}.`,
    };
  }

  try {
    const result = await provider(message);
    return { ...result, provider: name };
  } catch (error) {
    return {
      delivered: false,
      status: "failed",
      provider: name,
      error: redact(error.message),
    };
  }
};

export const providerNames = Object.keys(PROVIDERS);
