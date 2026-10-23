import mongoose from "mongoose";

/**
 * Runs `fn(session)` inside a MongoDB transaction.
 *
 * Requires a replica set (Atlas, or the in-memory replset used by
 * `npm run dev:local` and the test suite). Callers that do not strictly need
 * atomicity should not use this.
 */
export const withTransaction = async (fn) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

export default withTransaction;
