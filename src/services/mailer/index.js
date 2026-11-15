const config = require('../../config');
const logger = require('../../utils/logger');
const MockMailer = require('./mockMailer');
const NodemailerMailer = require('./nodemailerMailer');

let mailerInstance = null;

/**
 * Get or initialize the active mailer instance.
 * @returns {import('./mailerInterface')}
 */
function getMailer() {
  if (!mailerInstance) {
    if (config.env === 'test' || !config.smtpUser || !config.smtpPass) {
      logger.info('Using MockMailer (console / in-memory email sink)');
      mailerInstance = new MockMailer();
    } else {
      logger.info({ user: config.smtpUser }, 'Using NodemailerMailer over Gmail SMTP');
      mailerInstance = new NodemailerMailer();
    }
  }
  return mailerInstance;
}

/**
 * Set custom mailer instance (for testing).
 * @param {import('./mailerInterface')} customMailer
 */
function setMailer(customMailer) {
  mailerInstance = customMailer;
}

/**
 * Sleep helper for backoff delays.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Dispatch an email with 3-attempt exponential backoff retry.
 * @param {{ to: string, subject: string, html: string, text: string, from?: string }} options
 * @param {number} [maxRetries=3]
 * @param {number} [baseDelayMs=200]
 */
async function sendWithRetry(options, maxRetries = 3, baseDelayMs = 200) {
  const mailer = getMailer();
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt += 1;
    try {
      const result = await mailer.sendMail(options);
      return result;
    } catch (err) {
      lastError = err;
      logger.warn(
        { err: err.message, attempt, maxRetries, to: options.to, subject: options.subject },
        `Email dispatch attempt ${attempt} failed`
      );

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 200ms, 400ms, 800ms
        await sleep(delay);
      }
    }
  }

  logger.error(
    { err: lastError, to: options.to, subject: options.subject },
    `All ${maxRetries} email dispatch attempts failed`
  );
  throw lastError;
}

module.exports = {
  getMailer,
  setMailer,
  sendWithRetry,
  MockMailer,
  NodemailerMailer
};
