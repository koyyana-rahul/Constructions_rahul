import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "http";

import { sendEmail, sendEmployeeInvitation, describeResult } from "../services/email/emailService.js";

/**
 * Email service tests.
 *
 * The HTTP provider is tested against a LOCAL mock mail server, so the
 * request that would go to a real provider is verified for real - method,
 * headers, payload shape - without sending anything and without needing
 * credentials.
 *
 * The rule that matters most is also tested: the application must never
 * claim an email was sent when it was not.
 */

let mock;
let mockPort;
let received = [];
let respondWith = { status: 200, body: { id: "mock_123" } };

before(async () => {
  mock = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body ? JSON.parse(body) : null,
      });
      res.writeHead(respondWith.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(respondWith.body));
    });
  });

  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  mockPort = mock.address().port;

  process.env.EMAIL_PROVIDER = "http";
  process.env.EMAIL_API_URL = `http://127.0.0.1:${mockPort}/emails`;
  process.env.EMAIL_API_KEY = "test_key_abcdef123456";
  process.env.EMAIL_FROM = "Builtra <no-reply@builtra.test>";
  process.env.FRONTEND_BASE_URL = "https://app.builtra.test";
});

after(async () => {
  if (mock) await new Promise((resolve) => mock.close(resolve));
  delete process.env.EMAIL_PROVIDER;
  delete process.env.EMAIL_API_URL;
  delete process.env.EMAIL_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.FRONTEND_BASE_URL;
});

/* ------------------------------------------------------------------ */
describe("http email provider", () => {
  it("sends a well-formed request and reports delivery", async () => {
    received = [];
    respondWith = { status: 200, body: { id: "mock_123" } };

    const result = await sendEmail({
      to: "worker@example.com",
      subject: "Set up your Builtra employee account",
      text: "plain body",
      html: "<p>html body</p>",
    });

    assert.equal(result.delivered, true, JSON.stringify(result));
    assert.equal(result.status, "sent");
    assert.equal(result.provider, "http");
    assert.equal(result.id, "mock_123");

    assert.equal(received.length, 1);
    const req = received[0];

    assert.equal(req.method, "POST");
    assert.match(req.url, /\/emails$/);
    assert.equal(req.headers.authorization, "Bearer test_key_abcdef123456");
    assert.match(req.headers["content-type"], /application\/json/);

    assert.deepEqual(req.body.to, ["worker@example.com"]);
    assert.equal(req.body.subject, "Set up your Builtra employee account");
    assert.equal(req.body.html, "<p>html body</p>");
    assert.equal(req.body.text, "plain body");
    assert.equal(req.body.from, "Builtra <no-reply@builtra.test>");
  });

  it("reports a provider refusal as a failure, never as sent", async () => {
    received = [];
    respondWith = { status: 422, body: { message: "Invalid from address" } };

    const result = await sendEmail({
      to: "worker@example.com",
      subject: "x",
      text: "y",
    });

    assert.equal(result.delivered, false, "a refusal must never be reported as delivered");
    assert.equal(result.status, "failed");
    assert.match(result.error, /Invalid from address/);
  });

  it("reports a missing API key as not configured", async () => {
    const saved = process.env.EMAIL_API_KEY;
    delete process.env.EMAIL_API_KEY;

    const result = await sendEmail({ to: "worker@example.com", subject: "x", text: "y" });

    assert.equal(result.delivered, false);
    assert.equal(result.status, "not_configured");

    process.env.EMAIL_API_KEY = saved;
  });

  it("never leaks the API key in an error message", async () => {
    received = [];
    respondWith = { status: 500, body: { message: "key test_key_abcdef123456 rejected" } };

    const result = await sendEmail({ to: "worker@example.com", subject: "x", text: "y" });

    assert.equal(result.delivered, false);
    assert.doesNotMatch(
      result.error,
      /test_key_abcdef123456/,
      "the API key must never appear in an error message"
    );
  });
});

/* ------------------------------------------------------------------ */
describe("invitation emails", () => {
  it("builds the setup link from the configured frontend origin", async () => {
    received = [];
    respondWith = { status: 200, body: { id: "mock_invite" } };

    const result = await sendEmployeeInvitation({
      to: "worker@example.com",
      name: "Rohan Verma",
      token: "raw-token-abc",
    });

    assert.equal(result.delivered, true);

    const html = received[0].body.html;
    const text = received[0].body.text;

    assert.match(
      html,
      /https:\/\/app\.builtra\.test\/activate\?token=raw-token-abc/,
      "the link must use the configured FRONTEND_BASE_URL"
    );
    assert.match(text, /https:\/\/app\.builtra\.test\/activate\?token=raw-token-abc/);
    assert.match(received[0].body.subject, /Set up your Builtra employee account/);
    assert.match(html, /Rohan Verma/);
  });

  it("escapes a name that contains HTML", async () => {
    received = [];
    respondWith = { status: 200, body: { id: "mock_xss" } };

    await sendEmployeeInvitation({
      to: "worker@example.com",
      name: '<script>alert("x")</script>',
      token: "tok",
    });

    const html = received[0].body.html;
    assert.doesNotMatch(html, /<script>/, "a display name must not be able to inject markup");
    assert.match(html, /&lt;script&gt;/);
  });

  it("URL-encodes the token in the link", async () => {
    received = [];
    respondWith = { status: 200, body: { id: "mock_enc" } };

    await sendEmployeeInvitation({
      to: "worker@example.com",
      name: "A B",
      token: "a token/with?chars&=+",
    });

    const link = received[0].body.text.match(/https:\/\/app\.builtra\.test\/activate\?\S+/)[0];
    assert.match(link, /token=a%20token%2Fwith%3Fchars%26%3D%2B/);
  });
});

/* ------------------------------------------------------------------ */
describe("delivery reporting", () => {
  it("never describes an undelivered message as sent", () => {
    assert.match(describeResult({ status: "sent", delivered: true }), /Invitation sent/);

    for (const status of ["captured", "not_configured", "failed", "timeout"]) {
      const message = describeResult({ status, delivered: false, error: "boom" });
      assert.doesNotMatch(
        message,
        /^Invitation sent/i,
        `status "${status}" must not be described as sent`
      );
    }
  });

  it("tells the administrator to share the link manually when nothing was sent", () => {
    assert.match(
      describeResult({ status: "captured", delivered: false }),
      /Share the setup link manually/i
    );
  });
});
