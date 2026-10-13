import connectToDatabase from "./db/db.js";
import createApp from "./app.js";

const start = async () => {
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
      console.error(
        `\nPort ${port} is already in use.\n` +
          `Another copy of the API is already running. Stop it first, or run on a\n` +
          `different port:  set PORT=5050 and restart.\n`
      );
      process.exit(1);
    }

    console.error("Server failed to start:", error.message);
    process.exit(1);
  });

  // nodemon restarts the process; release the port cleanly on shutdown.
  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down`);
    server.close(() => process.exit(0));
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