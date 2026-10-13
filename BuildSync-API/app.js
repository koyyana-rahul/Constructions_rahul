import express from "express";
import cors from "cors";
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

/**
 * The Express application, separated from the server bootstrap so tests can
 * mount it without binding a port.
 */
export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static("public/uploads"));

  app.get("/api/health", (_req, res) =>
    res.status(200).json({ success: true, status: "ok", uptime: process.uptime() })
  );

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