const { DateTime } = require('luxon');
const request = require('supertest');
const { app, clearDatabase, createTestElder } = require('../testHelper');
const { setMailer, MockMailer } = require('../../src/services/mailer');
const notificationService = require('../../src/services/notificationService');
const { getRepository } = require('../../src/repositories');
const config = require('../../src/config');

describe('Weekly Digest Task', () => {
  let mockMailer;
  let elder;
  let profileId;

  beforeEach(async () => {
    await clearDatabase();
    mockMailer = new MockMailer();
    setMailer(mockMailer);

    elder = await createTestElder();
    profileId = elder.profile.id;

    // Add Caretaker
    const repo = getRepository();
    await repo.createMember(profileId, {
      name: 'Nurse Joy',
      email: 'joy@carecircle.org',
      role: 'caretaker',
      passcodeHash: 'hash',
      permissions: { canViewMeds: true, receiveAlerts: true },
      active: true
    });
  });

  it('runs weekly digest and emails adherence summary to caretakers', async () => {
    const refTime = DateTime.fromISO('2026-11-15T09:00:00', { zone: 'Asia/Kolkata' });
    const result = await notificationService.runWeeklyDigest(refTime);

    expect(result.status).toBe('completed');
    const sent = mockMailer.getSentEmails();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('joy@carecircle.org');
    expect(sent[0].subject).toContain('Weekly Care Digest');
  });

  it('executes POST /tasks/weekly-digest with X-Task-Token', async () => {
    const res = await request(app)
      .post('/tasks/weekly-digest')
      .set('X-Task-Token', config.taskToken);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });
});
