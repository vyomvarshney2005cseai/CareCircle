const crypto = require('crypto');
const config = require('../config');
const AppError = require('../errors/appError');

/**
 * Constant-time comparison middleware protecting Cloud Scheduler task endpoints.
 */
function taskAuth(req, res, next) {
  const token = req.headers['x-task-token'];
  if (!token) {
    return next(AppError.unauthorized('Missing X-Task-Token header'));
  }

  const expected = config.taskToken;
  const tokenBuf = Buffer.from(String(token));
  const expectedBuf = Buffer.from(String(expected));

  if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    return next(AppError.forbidden('Invalid X-Task-Token'));
  }

  return next();
}

module.exports = taskAuth;
