/**
 * Mailer service interface.
 */
class MailerInterface {
  /**
   * @param {{ to: string, subject: string, html: string, text: string, from?: string }} options
   * @returns {Promise<{ messageId: string, accepted: string[] }>}
   */
  async sendMail(options) {
    throw new Error('Not implemented');
  }
}

module.exports = MailerInterface;
