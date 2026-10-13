import mongoose from "mongoose";

/**
 * Test harness.
 *
 * Uses an isolated `_test` database derived from MONGODB_URL so a test run can
 * never touch development or production data. The Express app is mounted on an
 * ephemeral port in-process, so no external server is required.
 */
const deriveTestUrl = (url) => {
  const u = new URL(url);
  const name = u.pathname.replace(/^\//, "").replace(/_test$/, "");
  u.pathname = `/${name || "buildsync"}_test`;
  return u.toString();
};

export const TEST_MONGO_URL =
  process.env.TEST_MONGODB_URL || deriveTestUrl(process.env.MONGODB_URL);

export const connectTestDb = async () => {
  await mongoose.connect(TEST_MONGO_URL);
};

export const disconnectTestDb = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
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

export const loginAs = async (email, password = "Test!Pass123") => {
  const { body } = await api("POST", "/auth/login", { body: { email, password } });
  return body?.token ?? null;
};

export const base = () => baseUrl;