const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Standard API rate limiter.
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  skip: () => config.env === 'test'
});

/**
 * Stricter rate limiter for sensitive authentication endpoints.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many login or join attempts. Please try again after 15 minutes.'
    }
  },
  skip: () => config.env === 'test'
});

module.exports = {
  apiLimiter,
  authLimiter
};
