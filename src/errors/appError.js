/**
 * Structured Application Error for CareCircle.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {number} [statusCode=500] - HTTP status code.
   * @param {string} [code='INTERNAL_ERROR'] - Machine-readable error code.
   * @param {Record<string, unknown>} [details=null] - Optional structured error details.
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST', details = null) {
    return new AppError(message, 400, code, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Access forbidden', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }

  static conflict(message = 'Resource conflict', code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }

  static locked(
    message = 'Account locked due to multiple failed attempts',
    code = 'ACCOUNT_LOCKED'
  ) {
    return new AppError(message, 423, code);
  }

  static unprocessable(message = 'Validation failed', details = null) {
    return new AppError(message, 422, 'VALIDATION_ERROR', details);
  }
}

module.exports = AppError;
