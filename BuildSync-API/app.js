import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRouter from "./routes/auth.js";
import departmentRouter from "./routes/department.js";
import employeeRouter from "./routes/employee.js";
import salaryRouter from "./routes/salary.js";
import leaveRouter from "./routes/leave.js";
import clientRouter from "./routes/client.js";
import settingRouter from "./routes/setting.js";
import attendanceRouter from "./routes/attendance.js";
import dashboardRouter from "./routes/dashboard.js";
import workRequestRouter from "./routes/workRequest.js";
import ApiError from "./utils/ApiError.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { requireCsrf } from "./middleware/csrf.js";

/**
 * CORS with credentials.
 *
 * The session token lives in a cookie, and the browser only sends a cookie
 * to a cross-origin API when the response allows credentials. That means the
 * allowed origin can no longer be `*` - the spec forbids it and browsers
 * reject it. The origin must be named explicitly.
 *
 * `CLIENT_ORIGIN` is a comma-separated list of allowed frontend origins.
 * In development any localhost port is allowed, because Vite moves to
 * another port whenever 5173 is taken. In production ONLY the configured
 * origins are allowed, and an unset `CLIENT_ORIGIN` means NO cross-origin
 * request is accepted at all.
 */
const allowedOrigins = () => {
  const configured = (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (configured.length) return configured;

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[cors] CLIENT_ORIGIN is not set. Cross-origin requests will be refused. " +
        "Set it to the comma-separated list of frontend origins."
    );
    return [];
  }

  // Development: any localhost / 127.0.0.1 port.
  return [/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/];
};

const corsOptions = {
  origin: (origin, callback) => {
    // A request with no Origin header is not a browser cross-origin request
    // (a server-side call, curl, or the test suite). It is allowed through -
    // CORS protects browsers, not servers, and the bearer-token API is
    // deliberately usable by scripts.
    if (!origin) return callback(null, true);

    const allowed = allowedOrigins();
    const ok = allowed.some((entry) =>
      entry instanceof RegExp ? entry.test(origin) : entry === origin
    );

    if (ok) return callback(null, true);

    return callback(
      new ApiError(403, "This origin is not allowed to call the API", {
        code: "CORS_ORIGIN_DENIED",
      })
    );
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  exposedHeaders: ["Set-Cookie"],
  maxAge: 600,
};

/**
 * The Express application, separated from the server bootstrap so tests can
 * mount it without binding a port.
 */
export const createApp = () => {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.static("public/uploads"));

  /**
   * Readiness probe.
   *
   * This reports the DATABASE state, not just "the process is alive".
   * A plain `{"status":"ok"}` was returned even when MongoDB was
   * unreachable, which told an operator the deployment was healthy while
   * every database-backed request was timing out.
   *
   * 200 = ready, 503 = not ready (a load balancer should not route here).
   */
  app.get("/api/health", (_req, res) => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    const ready = mongoose.connection.readyState === 1;

    return res.status(ready ? 200 : 503).json({
      success: ready,
      status: ready ? "ok" : "degraded",
      database: states[mongoose.connection.readyState] ?? "unknown",
      uptime: process.uptime(),
    });
  });

  /**
   * CSRF check.
   *
   * Mounted BEFORE the routes so that it actually guards them, and applied
   * to the whole `/api` surface so a newly added state-changing route is
   * protected by default rather than by memory.
   *
   * The middleware only acts on cookie-authenticated writes. A request that
   * has not been through `authenticate` yet - a sign-in, a password setup -
   * has no `authVia` and passes straight through, and so does any
   * bearer-authenticated request (the test suite, scripts, Postman).
   */
  app.use("/api", requireCsrf);

  app.use("/api/auth", authRouter);
  app.use("/api/department", departmentRouter);
  app.use("/api/employee", employeeRouter);
  app.use("/api/client", clientRouter);
  app.use("/api/salary", salaryRouter);
  app.use("/api/leave", leaveRouter);
  app.use("/api/setting", settingRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/work-request", workRequestRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
