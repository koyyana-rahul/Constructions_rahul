import mongoose from "mongoose";

/**
 * Connects to MongoDB.
 *
 * A failure here is FATAL and is reported as such. The previous version
 * swallowed the error and let the server start anyway, which produced the
 * worst possible failure mode: the API answered `/api/health` with
 * `{"status":"ok"}` while every database-backed route timed out.
 *
 * @throws when the database cannot be reached.
 */

/** Removes the credentials from a connection string so it is safe to log. */
const redact = (url) =>
  String(url).replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");

const isAtlas = (url) => /mongodb(\+srv)?:\/\/.*\.mongodb\.net/i.test(String(url));

export const connectToDatabase = async () => {
  const url = process.env.MONGODB_URL;

  if (!url) {
    throw new Error(
      "MONGODB_URL is not set.\n" +
        "  Copy .env.example to .env and fill it in, or start the temporary\n" +
        "  local database instead:  npm run dev:local"
    );
  }

  try {
    await mongoose.connect(url, {
      serverSelectionTimeoutMS: Number(process.env.MONGO_TIMEOUT_MS) || 10000,
    });
    console.log(`MongoDB connected: ${redact(url)}`);
    return mongoose.connection;
  } catch (error) {
    const reason = String(error.message).split("\n")[0];

    if (isAtlas(url)) {
      throw new Error(
        `Could not reach the MongoDB Atlas cluster.\n` +
          `  ${reason}\n\n` +
          `  Atlas only accepts connections from IP addresses on the cluster's\n` +
          `  "Network Access" list. Either:\n` +
          `    1. Add this machine's IP to the Atlas IP Access List, or\n` +
          `    2. Run the temporary local database instead:  npm run dev:local`
      );
    }

    throw new Error(
      `Could not reach MongoDB.\n` +
        `  ${reason}\n` +
        `  Server: ${redact(url)}\n` +
        `  Check that the database is running and that the URL is correct.`
    );
  }
};

export default connectToDatabase;
