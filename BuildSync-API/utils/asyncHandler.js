/**
 * Express 4 does not forward rejected promises from async route handlers to
 * the error middleware - they become unhandled rejections and the request
 * hangs. Every async controller in this app therefore throws `ApiError`
 * instead of calling `res.status(...).json(...)`, and is wrapped here.
 *
 * Usage:  router.get('/', authenticate, asyncHandler(getClients))
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;