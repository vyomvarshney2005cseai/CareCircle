const request = require('supertest');
const { app, clearDatabase, createTestElder } = require('../testHelper');
const { setMailer, MockMailer } = require('../../src/services/mailer');

describe('Notification API Endpoints', () => {
  let mockMailer;
  let elder;
  let profileId;

  beforeEach(async () => {
    await clearDatabase();
    mockMailer = new MockMailer();
    setMailer(mockMailer);

    elder = await createTestElder();
    profileId = elder.profile.id;
  });

  it('allows elder to send a test reminder email', async () => {
    const res = await request(app)
      .post(`/api/profiles/${profileId}/notifications/test`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);

    const sent = mockMailer.getSentEmails();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe(elder.member.email);
    expect(sent[0].subject).toContain('Test Notification');
  });

  it('lists notification history at /api/profiles/:profileId/notifications and /api/profile/notifications', async () => {
    // Dispatch test reminder
    await request(app)
      .post(`/api/profiles/${profileId}/notifications/test`)
      .set('Authorization', `Bearer ${elder.token}`);

    // Fetch via /api/profiles/:id/notifications
    const res1 = await request(app)
      .get(`/api/profiles/${profileId}/notifications`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(res1.status).toBe(200);
    expect(res1.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res1.body.data[0].type).toBe('TEST_REMINDER');

    // Fetch via alias /api/profile/notifications
    const res2 = await request(app)
      .get('/api/profile/notifications')
      .set('Authorization', `Bearer ${elder.token}`);

    expect(res2.status).toBe(200);
    expect(res2.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
