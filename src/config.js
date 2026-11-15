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
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Proactive Reminders & SMTP Mailer
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  mailFrom: z.string().default('CareCircle <no-reply@carecircle.org>'),
  taskToken: z.string().min(8).default('carecircle-task-secret-token-min16chars'),

  // Google Gemini AI
  geminiApiKey: z.string().optional(),
  geminiModel: z.string().default('gemini-2.5-flash'),
  aiRateLimitMax: z.coerce.number().default(20)
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
  logLevel: process.env.LOG_LEVEL,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  mailFrom: process.env.MAIL_FROM,
  taskToken: process.env.TASK_TOKEN,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL,
  aiRateLimitMax: process.env.AI_RATE_LIMIT_MAX
});

if (!parsed.success) {
  console.error('Invalid configuration options:', parsed.error.format());
  throw new Error('Invalid application configuration');
}

/**
 * Application configuration loaded exclusively from environment variables.
 */
const config = Object.freeze(parsed.data);

module.exports = config;
