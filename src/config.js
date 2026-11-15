const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(8080),
  env: z.enum(['development', 'production', 'test']).default('development'),
  jwtSecret: z.string().min(16).default('carecircle-super-secure-secret-key-change-in-production-min32chars'),
  cookieSecret: z.string().min(16).default('carecircle-cookie-secret-key-min32chars'),
  dataStore: z.enum(['memory', 'firestore']).default('memory'),
  gcpProjectId: z.string().default('carecircle-hackathon'),
  rateLimitWindowMs: z.coerce.number().default(15 * 60 * 1000),
  rateLimitMax: z.coerce.number().default(500),
  authRateLimitMax: z.coerce.number().default(30),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info')
});

const parsed = configSchema.safeParse({
  port: process.env.PORT,
  env: process.env.NODE_ENV,
  jwtSecret: process.env.JWT_SECRET,
  cookieSecret: process.env.COOKIE_SECRET,
  dataStore: process.env.DATA_STORE,
  gcpProjectId: process.env.GCP_PROJECT_ID,
  rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: process.env.RATE_LIMIT_MAX,
  authRateLimitMax: process.env.AUTH_RATE_LIMIT_MAX,
  logLevel: process.env.LOG_LEVEL
});

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid configuration options:', parsed.error.format());
  throw new Error('Invalid application configuration');
}

/**
 * Application configuration loaded exclusively from environment variables.
 */
const config = Object.freeze(parsed.data);

module.exports = config;
