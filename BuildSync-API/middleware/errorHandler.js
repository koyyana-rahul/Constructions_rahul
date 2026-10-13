import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";

/** Unmatched route. */
export const notFoundHandler = (req, res, next) => {
  if (res.headersSent) return next();
  return res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: "ROUTE_NOT_FOUND",
  });
};

/**
 * Centralised error handler.
 *
 * Converts thrown `ApiError`s, Mongoose validation/cast errors, duplicate-key
 * errors and multer errors into a single JSON shape:
 *   { success: false, error, code, details? }
 *
 * Never leaks stack traces or internal messages to the client outside dev.
 */
// eslint-disable-next-line no-unused-vars -- Express requires the 4-arg signature
export const errorHandler = (err, req, res, next) => {
  let status = 500;
  let message = "Internal server error";
  let code = "INTERNAL_ERROR";
  let details;

  if (err instanceof ApiError) {
    ({ status, message, code, details } = err);
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = "INVALID_ID";
    message = `Invalid value for '${err.path}'`;
  } else if (err && err.code === 11000) {
    // Duplicate key - most often the Attendance {employeeId, date} index.
    status = 409;
    code = "DUPLICATE_KEY";
    const field = Object.keys(err.keyPattern || { value: 1 }).join(", ");
    message = `A record with this ${field} already exists`;
    details = { keyValue: err.keyValue };
  } else if (err && err.name === "MulterError") {
    status = 400;
    code = "UPLOAD_ERROR";
    message =
      err.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : err.message;
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const body = { success: false, error: message, code };
  if (details) body.details = details;
  if (process.env.NODE_ENV === "development" && status >= 500) {
    body.debug = err?.message;
  }

  res.status(status).json(body);
};