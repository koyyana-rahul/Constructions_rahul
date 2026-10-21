import mongoose from "mongoose";
import path from "path";

/**
 * Test harness.
 *
 * Uses an isolated `_test` database derived from MONGODB_URL so a test run can
 * never touch development or production data. The Express app is mounted on an
 * ephemeral port in-process, so no external server is required.
 *
 * TWO database modes:
 *
 *  1. `USE_IN_MEMORY_DB=true` - starts an in-process MongoDB via
 *     `mongodb-memory-server`. Nothing is downloaded at runtime and no
 *     external server is needed, so `npm test` works on a laptop and on CI.
 *
 *  2. otherwise - connects to `TEST_MONGODB_URL`, or to a `_test` database
 *     derived from `MONGODB_URL`. If that server cannot be reached within
 *     `TEST_DB_TIMEOUT_MS`, the harness FALLS BACK to the in-memory server
 *     and says so loudly, so a test run never fails for an infrastructure
 *     reason that has nothing to do with the code under test.
 *
 * The in-memory server is started as a REPLICA SET because several code paths
 * (`departmentController.archiveDepartment`, for example) use MongoDB
 * transactions, and transactions require a replica set. A standalone server
 * would make those paths fail in tests and pass in production - the exact
 * opposite of what a test suite is for.
 */

const deriveTestUrl = (url) => {
  const u = new URL(url);
  const name = u.pathname.replace(/^\//, "").replace(/_test$/, "");
  u.pathname = `/${name || "buildsync"}_test`;
  return u.toString();
};

/**
 * Each test FILE gets its own database.
 *
 * `node --test` runs test files in parallel, each in its own process, but
 * they all share one MONGODB_URL. Without this suffix two files would use the
 * same database, and one file's `dropDatabase()` in `after()` would delete
 * another file's fixtures mid-run - producing failures that have nothing to
 * do with the code being tested.
 */
const testFileSuffix = () => {
  const file = process.argv[1] || "";
  const base = path.basename(file).replace(/\.test\.[cm]?js$/, "");
  const safe = base.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  return safe && safe !== "index" ? safe : null;
};

/** In-memory server handle, kept so it can be stopped after the run. */
let memoryServer = null;

const startInMemory = async () => {
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  memoryServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(memoryServer.getUri());
};

const useInMemory = () => {
  const flag = process.env.USE_IN_MEMORY_DB;
  if (flag !== undefined) return flag === "true";
  return !process.env.MONGODB_URL;
};

export const connectTestDb = async () => {
  if (useInMemory()) {
    await startInMemory();
    return;
  }

  const base =
    process.env.TEST_MONGODB_URL || deriveTestUrl(process.env.MONGODB_URL);

  // Insert a per-file suffix so parallel test files cannot collide.
  const suffix = testFileSuffix();
  let url = base;
  if (suffix) {
    const u = new URL(base);
    const dbName = u.pathname.replace(/^\//, "").replace(/_test$/, "");
    u.pathname = `/${dbName}_${suffix}_test`;
    url = u.toString();
  }

  const timeout = Number(process.env.TEST_DB_TIMEOUT_MS) || 5000;

  try {
    await mongoose.connect(url, { serverSelectionTimeoutMS: timeout });
    return;
  } catch (error) {
    const reason = String(error.message).split("\n")[0];
    console.warn(
      `\n[tests] Could not reach the configured MongoDB at ${url}\n` +
        `        ${reason}\n` +
        `        Falling back to the in-memory MongoDB. The suite still exercises\n` +
        `        real MongoDB semantics, but against a temporary server.\n`
    );
    await mongoose.disconnect().catch(() => {});
    await startInMemory();
  }
};

export const disconnectTestDb = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

let server;
let baseUrl;

export const startApp = async () => {
  const { default: createApp } = await import("../app.js");
  const app = createApp();

  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  return baseUrl;
};

export const stopApp = async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
};

export const api = async (method, path, { token, body } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, body: json };
};

/**
 * Cookie-aware request helper.
 *
 * Mirrors what a browser does: it keeps the cookies it was given and sends
 * them back on the next request. `setCookie` returns the raw `Set-Cookie`
 * headers so a test can assert on `HttpOnly`, `SameSite` and `Path`.
 */
export const browser = () => {
  const jar = new Map();

  const cookieHeader = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const capture = (res) => {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq < 1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      // An empty value with an expiry in the past is a deletion.
      if (value === "" || /Expires=Thu, 01 Jan 1970/i.test(line)) jar.delete(name);
      else jar.set(name, value);
    }
    return raw;
  };

  const request = async (method, path, { body, csrf = true, headers: extra = {} } = {}) => {
    const headers = { "Content-Type": "application/json", ...extra };
    const cookies = cookieHeader();
    if (cookies) headers.Cookie = cookies;

    // The double-submit CSRF token, exactly as the frontend sends it.
    if (csrf && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrfCookie = jar.get("builtra_csrf");
      if (csrfCookie) headers["X-CSRF-Token"] = decodeURIComponent(csrfCookie);
    }

    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const setCookie = capture(res);
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON response */
    }
    return { status: res.status, body: json, setCookie, jar };
  };

  return {
    request,
    jar,
    cookieHeader,
  };
};

export const loginAs = async (email, password = "Test!Pass123") => {
  const { body } = await api("POST", "/auth/login", { body: { email, password } });
  return body?.token ?? null;
};

export const base = () => baseUrl;
