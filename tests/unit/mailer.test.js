const { sendWithRetry, MockMailer, setMailer } = require('../../src/services/mailer');

describe('Mailer Service & Retry Engine', () => {
  let mockMailer;

  beforeEach(() => {
    mockMailer = new MockMailer();
    setMailer(mockMailer);
  });

  it('successfully sends email and logs in mock sink', async () => {
    const result = await sendWithRetry({
      to: 'elder@carecircle.org',
      subject: 'Test Subject',
      html: '<p>Accessible HTML</p>',
      text: 'Accessible text'
    });

    expect(result.messageId).toBeDefined();
    expect(mockMailer.getSentEmails().length).toBe(1);
    expect(mockMailer.getSentEmails()[0].to).toBe('elder@carecircle.org');
  });

  it('retries failed sends up to 3 times with backoff before succeeding', async () => {
    // Configure mock mailer to fail twice, then succeed on 3rd attempt
    mockMailer.shouldFailTimes = 2;

    const result = await sendWithRetry(
      {
        to: 'caretaker@carecircle.org',
        subject: 'Retry Subject',
        html: '<p>Retry HTML</p>',
        text: 'Retry text'
      },
      3,
      50 // Fast backoff for tests
    );

    expect(result.messageId).toBeDefined();
    expect(mockMailer.getSentEmails().length).toBe(1);
  });

  it('throws after all 3 attempts fail', async () => {
    // Configure mock mailer to fail 3 times
    mockMailer.shouldFailTimes = 3;

    await expect(
      sendWithRetry(
        {
          to: 'fail@carecircle.org',
          subject: 'Fail Subject',
          html: '<p>Fail HTML</p>',
          text: 'Fail text'
        },
        3,
        20
      )
    ).rejects.toThrow('Simulated SMTP connection failure');
  });
});
