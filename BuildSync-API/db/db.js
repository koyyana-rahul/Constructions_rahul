import mongoose from "mongoose";

/**
 * Opens the MongoDB connection.
 *
 * The error is deliberately re-thrown. Swallowing it let the API bind its port
 * and serve requests while having no database at all - every query then sat in
 * Mongoose's buffer until it timed out, so failures surfaced as random
 * multi-second hangs rather than an honest startup failure. `index.js` awaits
 * this so a bad connection string is reported once, clearly, at boot.
 */
const connectToDatabase = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URL, {
      // Mongoose waits 30s for server selection by default, which is a long
      // silent pause when the cluster is simply unreachable. Failing in ~8s
      // surfaces a bad IP whitelist while you are still watching the terminal.
      serverSelectionTimeoutMS:
        Number(process.env.DB_SERVER_SELECTION_TIMEOUT_MS) || 8_000,
    });
    console.log(`MongoDB connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error(
      `\nCould not connect to MongoDB.\n` +
        `${error.message}\n\n` +
        `If this is an Atlas cluster, add this machine's public IP to the\n` +
        `cluster's IP Access List (Network Access -> Add IP Address).\n` +
        `The API will not start without a working connection.\n`,
    );
    throw error;
  }
};

export default connectToDatabase;
