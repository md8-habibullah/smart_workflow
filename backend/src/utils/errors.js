/**
 * Operational HTTP error. Anything thrown with a statusCode is rendered by
 * the global error handler as { success: false, message, errors }.
 */
export class AppError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export const badRequest = (message, errors) => new AppError(400, message, errors);
export const unauthorized = (message = 'Authentication required.') => new AppError(401, message);
export const forbidden = (message = 'Forbidden. You do not have permission to access this resource.') =>
  new AppError(403, message);
export const notFound = (message = 'Resource not found.') => new AppError(404, message);
export const conflict = (message) => new AppError(409, message);

/** Parses a positive integer route parameter or throws 400. */
export const parseId = (value, label = 'id') => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest(`Invalid ${label}: must be a positive integer.`);
  }
  return id;
};
