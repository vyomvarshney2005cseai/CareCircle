const { DateTime } = require('luxon');
const request = require('supertest');
const { app, clearDatabase, createTestElder } = require('../testHelper');
const { setMailer, MockMailer } = require('../../src/services/mailer');
const notificationService = require('../../src/services/notificationService');
const { getRepository } = require('../../src/repositories');
const config = require('../../src/config');

describe('Proactive Reminder Engine & Task Endpoints', () => {
  let mockMailer;
  let elder;
  let profileId;

  beforeEach(async () => {
    await clearDatabase();
    mockMailer = new MockMailer();
    setMailer(mockMailer);

    // 1. Create Elder Profile in Asia/Kolkata
    elder = await createTestElder({
      elderName: 'Grandma Martha',
      elderEmail: 'martha@carecircle.org',
      timezone: 'Asia/Kolkata'
    });
    profileId = elder.profile.id;

    // 2. Add Caretaker with receiveAlerts = true
    const repo = getRepository();
    await repo.createMember(profileId, {
      name: 'Nurse Bob',
      email: 'bob@carecircle.org',
      role: 'caretaker',
      passcodeHash: 'hash',
      permissions: { canViewMeds: true, canEditMeds: true, receiveAlerts: true },
      active: true
    });
  });

  it('triggers UPCOMING DOSE reminder 15 minutes before schedule', async () => {
    const repo = getRepository();
    // Schedule medication for 09:00 daily
    await repo.createMedication(profileId, {
      name: 'Lisinopril',
      dosage: '10mg',
      form: 'tablet',
      instructions: 'Take with water',
      times: ['09:00'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-11-01',
      stockCount: 30,
      refillThreshold: 5,
      active: true
    });

    // Evaluate at 08:48 AM (12 minutes before 09:00 AM)
    const refTime = DateTime.fromISO('2026-11-15T08:48:00', { zone: 'Asia/Kolkata' });
    const result = await notificationService.runReminders(refTime);

    expect(result.dispatchedCount).toBe(1);
    const sent = mockMailer.getSentEmails();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('martha@carecircle.org');
    expect(sent[0].subject).toContain('Upcoming Medicine: Lisinopril');
  });

  it('triggers MISSED DOSE reminder and updates status to missed after 30 minutes', async () => {
    const repo = getRepository();
    const med = await repo.createMedication(profileId, {
      name: 'Metformin',
      dosage: '500mg',
      form: 'tablet',
      instructions: 'After breakfast',
      times: ['09:00'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-11-01',
      stockCount: 30,
      refillThreshold: 5,
      active: true
    });

    // Evaluate at 09:35 AM (35 minutes after 09:00 AM)
    const refTime = DateTime.fromISO('2026-11-15T09:35:00', { zone: 'Asia/Kolkata' });
    const result = await notificationService.runReminders(refTime);

    expect(result.markedMissedCount).toBe(1);
    const sent = mockMailer.getSentEmails();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('martha@carecircle.org');
    expect(sent[0].subject).toContain('Missed Medicine: Metformin');

    // Verify dose log status was updated to 'missed' in repository
    const logs = await repo.listDoseLogs(profileId);
    expect(logs.some((l) => l.medicationId === med.id && l.status === 'missed')).toBe(true);
  });

  it('triggers ESCALATION alert to caretakers when dose is unrecorded after 60 minutes', async () => {
    const repo = getRepository();
    await repo.createMedication(profileId, {
      name: 'Atorvastatin',
      dosage: '20mg',
      form: 'tablet',
      instructions: 'Take once daily',
      times: ['08:00'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-11-01',
      stockCount: 30,
      refillThreshold: 5,
      active: true
    });

    // Evaluate at 09:10 AM (70 minutes after 08:00 AM)
    const refTime = DateTime.fromISO('2026-11-15T09:10:00', { zone: 'Asia/Kolkata' });
    await notificationService.runReminders(refTime);

    const sent = mockMailer.getSentEmails();
    // Escalation email dispatched to Nurse Bob
    const escalationMail = sent.find((m) => m.to === 'bob@carecircle.org');
    expect(escalationMail).toBeDefined();
    expect(escalationMail.subject).toContain(
      'Alert: Grandma Martha missed their 08:00 Atorvastatin'
    );
  });

  it('handles midnight boundary across days correctly', async () => {
    const repo = getRepository();
    // Schedule medicine at 00:05 AM (5 minutes past midnight)
    await repo.createMedication(profileId, {
      name: 'Insulin Night',
      dosage: '10 units',
      form: 'injection',
      instructions: 'Before midnight sleep',
      times: ['00:05'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-11-01',
      stockCount: 30,
      refillThreshold: 5,
      active: true
    });

    // Evaluate at 23:55 on previous night (10 minutes before 00:05 AM)
    const refTime = DateTime.fromISO('2026-11-14T23:55:00', { zone: 'Asia/Kolkata' });
    await notificationService.runReminders(refTime);

    const sent = mockMailer.getSentEmails();
    expect(sent.length).toBe(1);
    expect(sent[0].subject).toContain('Upcoming Medicine: Insulin Night');
  });

  it('enforces deterministic idempotency: running task repeatedly does not duplicate emails', async () => {
    const repo = getRepository();
    await repo.createMedication(profileId, {
      name: 'Aspirin',
      dosage: '81mg',
      form: 'pill',
      times: ['09:00'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-11-01',
      stockCount: 30,
      refillThreshold: 5,
      active: true
    });

    const refTime = DateTime.fromISO('2026-11-15T08:50:00', { zone: 'Asia/Kolkata' });

    // Run 1st time
    await notificationService.runReminders(refTime);
    expect(mockMailer.getSentEmails().length).toBe(1);

    // Run 2nd time immediately
    await notificationService.runReminders(refTime);
    expect(mockMailer.getSentEmails().length).toBe(1); // No duplicates!

    // Run 3rd time
    await notificationService.runReminders(refTime);
    expect(mockMailer.getSentEmails().length).toBe(1); // Still strictly 1!
  });

  it('triggers 24-hour and 2-hour appointment reminders', async () => {
    const repo = getRepository();
    // Create appointment for 2026-11-16 at 10:00 AM
    await repo.createAppointment(profileId, {
      doctorName: 'Dr. Sarah Patel',
      specialty: 'Cardiologist',
      location: 'Room 304',
      dateTime: '2026-11-16T10:00:00.000Z',
      status: 'scheduled'
    });

    // Evaluate at 24 hours prior: 2026-11-15 10:00 AM
    const ref24h = DateTime.fromISO('2026-11-15T10:00:00.000Z');
    await notificationService.runReminders(ref24h);

    const sent24h = mockMailer.getSentEmails();
    expect(
      sent24h.some((m) => m.subject.includes('Tomorrow') && m.to === 'martha@carecircle.org')
    ).toBe(true);
    expect(
      sent24h.some((m) => m.subject.includes('Tomorrow') && m.to === 'bob@carecircle.org')
    ).toBe(true);

    mockMailer.clear();

    // Evaluate at 2 hours prior: 2026-11-16 08:00 AM
    const ref2h = DateTime.fromISO('2026-11-16T08:00:00.000Z');
    await notificationService.runReminders(ref2h);

    const sent2h = mockMailer.getSentEmails();
    expect(
      sent2h.some((m) => m.subject.includes('2 Hours') && m.to === 'martha@carecircle.org')
    ).toBe(true);
  });

  it('executes POST /tasks/run-reminders protected with X-Task-Token', async () => {
    const res = await request(app)
      .post('/tasks/run-reminders')
      .set('X-Task-Token', config.taskToken);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });
});
