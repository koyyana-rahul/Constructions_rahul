import mongoose from "mongoose";
import connectToDatabase from "./db/db.js";
import createApp from "./app.js";
import { validateStartupEnvironment } from "./config/validateEnv.js";

const start = async () => {
  // Fail fast on an unsafe or incomplete deployment instead of discovering a
  // bad JWT secret when the first user tries to sign in.
  validateStartupEnvironment();

  // Await the connection so the server does not begin accepting requests
  // against a database that is not ready yet.
  await connectToDatabase();

  const app = createApp();
  const port = Number(process.env.PORT) || 5000;

  const server = app.listen(port, () => {
    console.log(`Server is Running on port ${port}`);
    console.log(`Health check:  http://localhost:${port}/api/health`);
  });

  /**
   * A bind failure is an operational problem, not a crash. Without this the
   * 'error' event is unhandled and Node dumps a raw stack trace that looks
   * like an application fault.
   */
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      // Suggest an actual free port. The previous message hardcoded 5050, so
      // anyone already running on 5050 was told to "set PORT=5050".
      const suggestion = port === 5000 ? 5050 : port + 1;
      console.error(
        `\nPort ${port} is already in use.\n` +
          `Another copy of the API is already running. Stop it first, or run on a\n` +
          `different port:  set PORT=${suggestion} and restart.\n`,
      );
      process.exit(1);
    }

    console.error("Server failed to start:", error.message);
    process.exit(1);
  });

  // Release both the HTTP listener and the database connection cleanly.
  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.connection.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  console.error(error);
  process.exit(1);
});
