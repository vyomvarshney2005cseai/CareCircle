const MailerInterface = require('./mailerInterface');
const logger = require('../../utils/logger');

/**
 * Mock mailer implementation for tests and dev environments without SMTP credentials.
 */
class MockMailer extends MailerInterface {
  constructor() {
    super();
    this.sentEmails = [];
    this.shouldFailTimes = 0; // Helper for testing retry logic
  }

  async sendMail({ to, subject, html, text, from = 'CareCircle <no-reply@carecircle.org>' }) {
    if (this.shouldFailTimes > 0) {
      this.shouldFailTimes -= 1;
      logger.warn(
        { to, subject },
        '[MockMailer] Simulated email transmission failure for retry testing'
      );
      throw new Error('Simulated SMTP connection failure');
    }

    const messageId = `<mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@carecircle.org>`;
    const record = {
      messageId,
      to,
      from,
      subject,
      html,
      text,
      sentAt: new Date().toISOString()
    };

    this.sentEmails.push(record);
    logger.info({ to, subject, messageId }, '[MockMailer] Email captured in mock inbox');

    return {
      messageId,
      accepted: [to]
    };
  }

  getSentEmails() {
    return [...this.sentEmails];
  }

  getLastEmail() {
    return this.sentEmails[this.sentEmails.length - 1] || null;
  }

  clear() {
    this.sentEmails = [];
    this.shouldFailTimes = 0;
  }
}

module.exports = MockMailer;
