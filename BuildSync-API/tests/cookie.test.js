import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";

import {
  connectTestDb,
  disconnectTestDb,
  startApp,
  stopApp,
  api,
  browser,
} from "./helpers.js";

import User from "../models/User.js";
import Department from "../models/Department.js";
import { parseCookies, csrfMatches } from "../utils/cookies.js";

/**
 * Cookie session + CSRF tests.
 *
 * The session token moved out of browser storage and into an httpOnly
 * cookie. These tests pin down the properties that make that safe:
 *
 *   - the token cookie is httpOnly, so JavaScript cannot read it;
 *   - the cookie alone authenticates a request (no Authorization header);
 *   - a cookie-authenticated WRITE requires the double-submit CSRF token;
 *   - a bearer-authenticated write does not, so scripts and the test suite
 *     are unaffected;
 *   - signing out actually removes the cookie.
 */

const PASSWORD = "Test!Pass123";
const ids = {};

let adminT;
let web;

before(async () => {
  await connectTestDb();
  await startApp();

  const hash = await bcrypt.hash(PASSWORD, 10);
  const dept = await Department.create({ dep_name: "Cookie Site" });
  const admin = await User.create({
    name: "Cookie Admin",
    email: "cookie-admin@test.local",
    password: hash,
    role: "admin",
  });

  ids.admin = admin._id;
  ids.dept = dept._id;
  adminT = (await api("POST", "/auth/login", { body: { email: "cookie-admin@test.local", password: PASSWORD } }))
    .body.token;

  web = browser();
});

after(async () => {
  await stopApp();
  await disconnectTestDb();
});

/* ------------------------------------------------------------------ */
describe("cookie parsing", () => {
  it("parses a normal cookie header", () => {
    const c = parseCookies("builtra_token=abc; builtra_csrf=def");
    assert.equal(c.builtra_token, "abc");
    assert.equal(c.builtra_csrf, "def");
  });

  it("returns an empty object for a missing or malformed header", () => {
    assert.deepEqual(parseCookies(undefined), {});
    assert.deepEqual(parseCookies(""), {});
    assert.deepEqual(parseCookies("novalue;=x;  ;"), {});
  });

  it("decodes percent-encoded values and survives a bad escape", () => {
    const c = parseCookies("a=hello%20world; b=%E0%A4%A; c=plain");
    assert.equal(c.a, "hello world");
    assert.equal(c.b, "%E0%A4%A", "a malformed escape must not throw");
    assert.equal(c.c, "plain");
  });

  it("strips surrounding quotes", () => {
    assert.equal(parseCookies('a="quoted"').a, "quoted");
  });
});

/* ------------------------------------------------------------------ */
describe("csrf token comparison", () => {
  it("matches identical tokens and rejects different ones", () => {
    assert.equal(csrfMatches("abc123", "abc123"), true);
    assert.equal(csrfMatches("abc123", "abc124"), false);
    assert.equal(csrfMatches("abc", "abcdef"), false, "length mismatch must not throw");
    assert.equal(csrfMatches("", "abc"), false);
    assert.equal(csrfMatches(undefined, undefined), false);
  });
});

/* ------------------------------------------------------------------ */
describe("session cookie", () => {
  it("sets an httpOnly session cookie and a readable CSRF cookie on login", async () => {
    const b = browser();
    const res = await b.request("POST", "/auth/login", {
      body: { email: "cookie-admin@test.local", password: PASSWORD },
    });

    assert.equal(res.status, 200);

    const tokenLine = res.setCookie.find((l) => l.startsWith("builtra_token="));
    const csrfLine = res.setCookie.find((l) => l.startsWith("builtra_csrf="));

    assert.ok(tokenLine, "a session cookie must be set");
    assert.ok(csrfLine, "a CSRF cookie must be set");

    assert.match(tokenLine, /HttpOnly/i, "the session cookie must be httpOnly");
    assert.match(tokenLine, /SameSite=Lax/i);
    assert.match(tokenLine, /Path=\//i);
    assert.doesNotMatch(
      csrfLine,
      /HttpOnly/i,
      "the CSRF cookie must be readable by JavaScript"
    );
  });

  it("authenticates a request with the cookie alone", async () => {
    const b = browser();
    await b.request("POST", "/auth/login", {
      body: { email: "cookie-admin@test.local", password: PASSWORD },
    });

    // No Authorization header - only the cookie.
    const res = await b.request("GET", "/auth/verify");
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, "admin");
  });

  it("rejects a request with no cookie and no bearer token", async () => {
    const b = browser();
    const res = await b.request("GET", "/auth/verify");
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "NO_TOKEN");
  });

  it("removes the cookie on sign-out", async () => {
    const b = browser();
    await b.request("POST", "/auth/login", {
      body: { email: "cookie-admin@test.local", password: PASSWORD },
    });
    assert.ok(b.jar.get("builtra_token"));

    const out = await b.request("POST", "/auth/logout");
    assert.equal(out.status, 200);
    assert.equal(b.jar.get("builtra_token"), undefined, "the session cookie must be cleared");
  });
});

/* ------------------------------------------------------------------ */
describe("CSRF protection", () => {
  it("refuses a cookie-authenticated write with no CSRF token", async () => {
    const b = browser();
    await b.request("POST", "/auth/login", {
      body: { email: "cookie-admin@test.local", password: PASSWORD },
    });

    const res = await b.request(
      "POST",
      "/department/add",
      { body: { dep_name: "No CSRF Site" }, csrf: false },
      // csrf:false means "do not add the header"
    );

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "CSRF_TOKEN_INVALID");
  });

  it("refuses a cookie-authenticated write with the wrong CSRF token", async () => {
    const b = browser();
    await b.request("POST", "/auth/login", {
      body: { email: "cookie-admin@test.local", password: PASSWORD },
    });

    const res = await b.request("POST", "/department/add", {
      body: { dep_name: "Wrong CSRF Site" },
      headers: { "X-CSRF-Token": "not-the-right-token" },
      csrf: false,
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "CSRF_TOKEN_INVALID");
  });

  it("allows a cookie-authenticated write with the correct CSRF token", async () => {
    const b = browser();
    await b.request("POST", "/auth/login", {
      body: { email: "cookie-admin@test.local", password: PASSWORD },
    });

    const res = await b.request("POST", "/department/add", {
      body: { dep_name: "Correct CSRF Site" },
    });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.department.dep_name, "Correct CSRF Site");
  });

  it("does not require CSRF for a bearer-authenticated write", async () => {
    // Scripts, Postman and the test suite present a bearer token, which the
    // browser never sends automatically, so CSRF cannot apply to them.
    const res = await api("POST", "/department/add", {
      token: adminT,
      body: { dep_name: "Bearer Site" },
    });
    assert.equal(res.status, 201);
  });

  it("does not require CSRF for safe (read) methods", async () => {
    const b = browser();
    await b.request("POST", "/auth/login", {
      body: { email: "cookie-admin@test.local", password: PASSWORD },
    });

    const res = await b.request("GET", "/department", { csrf: false });
    assert.equal(res.status, 200);
  });

  it("does not block the sign-in request itself", async () => {
    const b = browser();
    const res = await b.request("POST", "/auth/login", {
      body: { email: "cookie-admin@test.local", password: PASSWORD },
    });
    assert.equal(res.status, 200);
  });
});
