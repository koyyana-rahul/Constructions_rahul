/**
 * Local development stack - no external MongoDB required.
 *
 *   npm run dev:local
 *
 * Starts a temporary in-memory MongoDB (as a REPLICA SET, so the code paths
 * that use transactions behave exactly as they do in production), seeds a
 * realistic demo dataset, and serves the API on the normal port.
 *
 * EVERYTHING IS TEMPORARY. Stopping the process (Ctrl+C) discards the
 * database. This is a development convenience, not a production database.
 *
 * To use your real MongoDB instead, just run `npm start` as usual.
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";

const PORT = process.env.PORT || 5050;

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});

process.env.MONGODB_URL = replSet.getUri("buildsync");
process.env.JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET !== "your_secure_jwt_secret"
    ? process.env.JWT_SECRET
    : "buildsync-local-dev-secret-not-for-production";

console.log("\n────────────────────────────────────────────────────────────");
console.log("  BuildSync - local development stack");
console.log("────────────────────────────────────────────────────────────");
console.log(`  MongoDB : in-memory (temporary) at ${process.env.MONGODB_URL}`);
console.log(`  API     : http://localhost:${PORT}/api`);

// Seed the demo dataset. This script connects, seeds and disconnects using
// the MONGODB_URL we just set.
console.log("\n  Seeding demo data…");
await import("../seed-uitest.mjs");

console.log("\n  Sign in with:");
console.log("    Admin    admin@uitest.test   / Qa!Pass123");
console.log("    Employee emp@uitest.test    / Qa!Pass123");
console.log("    Client   cli@uitest.test     / Qa!Pass123");
console.log("\n  Data is discarded when you stop this process.");
console.log("────────────────────────────────────────────────────────────\n");

const { default: createApp } = await import("../app.js");
const { default: connectToDatabase } = await import("../db/db.js");

await connectToDatabase();

const app = createApp();
const server = app.listen(PORT, () => {
  console.log(`  Server running on port ${PORT}\n`);
});

const shutdown = async () => {
  console.log("\n  Shutting down…");
  server.close();
  await replSet.stop().catch(() => {});
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
