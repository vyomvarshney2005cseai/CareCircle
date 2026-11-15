const nodemailer = require('nodemailer');
const MailerInterface = require('./mailerInterface');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Nodemailer transport using Gmail SMTP.
 */
class NodemailerMailer extends MailerInterface {
  constructor() {
    super();
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    });
  }

  async sendMail({ to, subject, html, text, from = config.mailFrom }) {
    logger.info({ to, subject }, 'Dispatching email via Gmail SMTP');
    const info = await this.transporter.sendMail({
      from,
      to,
      subject,
      html,
      text
    });

    return {
      messageId: info.messageId,
      accepted: info.accepted
    };
  }
}

module.exports = NodemailerMailer;
