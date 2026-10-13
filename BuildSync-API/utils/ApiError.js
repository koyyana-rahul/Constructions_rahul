/**
 * Error type carrying an HTTP status, a stable machine-readable code, and
 * optional details. Controllers throw these; `errorHandler` renders them as
 * JSON so clients never receive an HTML error page.
 */
export default class ApiError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code || "ERROR";
    this.details = details;
  }

  static badRequest(message, options) {
    return new ApiError(400, message, { code: "BAD_REQUEST", ...options });
  }
  static unauthorized(message = "Authentication required", options) {
    return new ApiError(401, message, { code: "UNAUTHORIZED", ...options });
  }
  static forbidden(message = "You do not have permission to perform this action", options) {
    return new ApiError(403, message, { code: "FORBIDDEN", ...options });
  }
  static notFound(message = "Resource not found", options) {
    return new ApiError(404, message, { code: "NOT_FOUND", ...options });
  }
  static conflict(message, options) {
    return new ApiError(409, message, { code: "CONFLICT", ...options });
  }
}