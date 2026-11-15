const request = require('supertest');
const { DateTime } = require('luxon');
const { app, clearDatabase } = require('../testHelper');
const notificationService = require('../../src/services/notificationService');
const { setMailer } = require('../../src/services/mailer');
const MockMailer = require('../../src/services/mailer/mockMailer');

describe('Full End-to-End CareCircle Scenario', () => {
  let mockMailer;

  beforeEach(async () => {
    await clearDatabase();
    mockMailer = new MockMailer();
    setMailer(mockMailer);
  });

  it('executes the full collaborative elderly care workflow seamlessly', async () => {
    // 1. Elder registers
    const regRes = await request(app)
      .post('/api/auth/register-elder')
      .send({
        elderName: 'Grandma Martha',
        elderEmail: 'martha@carecircle.org',
        passcode: 'martha123',
        timezone: 'Asia/Kolkata'
      });

    expect(regRes.status).toBe(201);
    const profileId = regRes.body.data.profile.id;
    const elderCookie = regRes.headers['set-cookie'];

    // 2. Elder adds initial medication
    const medRes = await request(app)
      .post(`/api/profiles/${profileId}/medications`)
      .set('Cookie', elderCookie)
      .send({
        name: 'Metformin',
        dosage: '500mg',
        form: 'tablet',
        instructions: 'Take with water after meals',
        times: ['08:00', '20:00'],
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDate: '2026-11-01',
        stockCount: 30,
        refillThreshold: 5
      });

    expect(medRes.status).toBe(201);
    expect(medRes.body.data.stockCount).toBe(30);

    // 3. Elder books doctor appointment
    const apptRes = await request(app)
      .post(`/api/profiles/${profileId}/appointments`)
      .set('Cookie', elderCookie)
      .send({
        doctorName: 'Dr. Sarah Patel',
        specialty: 'Cardiologist',
        location: 'City Heart Clinic, Room 304',
        dateTime: '2026-12-05T10:00:00.000Z',
        notes: 'Review blood pressure log and Metformin tolerance'
      });

    expect(apptRes.status).toBe(201);

    // 4. Elder generates an 8-character invite code for Caretaker
    const inviteRes = await request(app)
      .post(`/api/profiles/${profileId}/members/invites`)
      .set('Cookie', elderCookie)
      .send({
        role: 'caretaker',
        permissions: {
          canViewMeds: true,
          canEditMeds: true,
          canViewAppointments: true,
          canEditAppointments: true,
          canViewAdherence: true,
          receiveAlerts: true
        }
      });

    expect(inviteRes.status).toBe(201);
    const inviteCode = inviteRes.body.data.inviteCode;
    expect(inviteCode.length).toBe(8);

    // 5. Caretaker joins CareCircle
    const joinRes = await request(app)
      .post('/api/auth/join')
      .send({
        profileId,
        inviteCode,
        name: 'Nurse Bob',
        email: 'bob@carecircle.org',
        passcode: 'nurseBob123'
      });

    expect(joinRes.status).toBe(201);
    const caretakerCookie = joinRes.headers['set-cookie'];

    // 6. Check today's schedule for elder
    const schedRes = await request(app)
      .get(`/api/profiles/${profileId}/schedule/today`)
      .set('Cookie', elderCookie);

    expect(schedRes.status).toBe(200);
    expect(schedRes.body.data.doses.length).toBe(2);

    const morningDose = schedRes.body.data.doses[0];
    expect(morningDose.status).toBe('pending');

    // 7. Elder clicks "I Took It" on the morning dose, and snoozes the evening dose
    const doseRes = await request(app)
      .post(`/api/profiles/${profileId}/schedule/doses/${morningDose.id}/action`)
      .set('Cookie', elderCookie)
      .send({ status: 'taken' });

    expect(doseRes.status).toBe(200);
    expect(doseRes.body.data.dose.status).toBe('taken');
    // Stock automatically decremented from 30 to 29!
    expect(doseRes.body.data.medication.stockCount).toBe(29);

    const eveningDose = schedRes.body.data.doses[1];
    const snoozeRes = await request(app)
      .post(`/api/profiles/${profileId}/schedule/doses/${eveningDose.id}/action`)
      .set('Cookie', elderCookie)
      .send({ status: 'snoozed' });

    expect(snoozeRes.status).toBe(200);
    expect(snoozeRes.body.data.dose.status).toBe('snoozed');

    // 8. Elder enables "requireElderApprovalForEdits" in profile settings
    const toggleRes = await request(app)
      .put(`/api/profiles/${profileId}/settings`)
      .set('Cookie', elderCookie)
      .send({ requireElderApprovalForEdits: true });

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.settings.requireElderApprovalForEdits).toBe(true);

    // 9. Caretaker proposes adding Aspirin
    const proposeRes = await request(app)
      .post(`/api/profiles/${profileId}/medications`)
      .set('Cookie', caretakerCookie)
      .send({
        name: 'Aspirin',
        dosage: '81mg',
        form: 'pill',
        instructions: 'Once daily with water',
        times: ['12:00'],
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDate: '2026-11-01',
        stockCount: 60,
        refillThreshold: 10
      });

    expect(proposeRes.status).toBe(202);
    expect(proposeRes.body.data.pending).toBe(true);
    const pendingChangeId = proposeRes.body.data.pendingChangeId;

    // 10. Elder reviews pending changes list
    const pendingListRes = await request(app)
      .get(`/api/profiles/${profileId}/pending-changes`)
      .set('Cookie', elderCookie);

    expect(pendingListRes.status).toBe(200);
    expect(pendingListRes.body.data.length).toBe(1);
    expect(pendingListRes.body.data[0].id).toBe(pendingChangeId);
    expect(pendingListRes.body.data[0].proposedByName).toBe('Nurse Bob');

    // 11. Elder approves Nurse Bob's proposed change
    const approveRes = await request(app)
      .post(`/api/profiles/${profileId}/pending-changes/${pendingChangeId}/review`)
      .set('Cookie', elderCookie)
      .send({ action: 'approve' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');

    // Verify Aspirin is now active in medications
    const medsListRes = await request(app)
      .get(`/api/profiles/${profileId}/medications`)
      .set('Cookie', elderCookie);

    expect(medsListRes.status).toBe(200);
    expect(medsListRes.body.data.length).toBe(2);
    expect(medsListRes.body.data.some((m) => m.name === 'Aspirin')).toBe(true);

    // 12. Proactive Reminders Engine: upcoming, missed, escalation, appointment, and idempotency
    // Add a medication scheduled for 09:00 AM
    await request(app)
      .post(`/api/profiles/${profileId}/medications`)
      .set('Cookie', elderCookie)
      .send({
        name: 'Lisinopril',
        dosage: '10mg',
        form: 'tablet',
        instructions: 'Take in morning',
        times: ['09:00'],
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDate: '2026-11-01',
        stockCount: 30,
        refillThreshold: 5
      });

    // A. 12 minutes before 09:00 (08:48 AM): Upcoming dose reminder
    mockMailer.clear();
    const tUpcoming = DateTime.fromISO('2026-11-15T08:48:00', { zone: 'Asia/Kolkata' });
    await notificationService.runReminders(tUpcoming);
    const upcomingMails = mockMailer.getSentEmails();
    expect(upcomingMails.some((m) => m.to === 'martha@carecircle.org' && m.subject.includes('Upcoming Medicine'))).toBe(true);

    // B. 35 minutes after 09:00 (09:35 AM): Dose becomes missed and email sent
    mockMailer.clear();
    const tMissed = DateTime.fromISO('2026-11-15T09:35:00', { zone: 'Asia/Kolkata' });
    await notificationService.runReminders(tMissed);
    const missedMails = mockMailer.getSentEmails();
    expect(missedMails.some((m) => m.to === 'martha@carecircle.org' && m.subject.includes('Missed Medicine'))).toBe(true);

    // C. 70 minutes after 09:00 (10:10 AM): Escalation alert to caretaker Nurse Bob
    mockMailer.clear();
    const tEscalate = DateTime.fromISO('2026-11-15T10:10:00', { zone: 'Asia/Kolkata' });
    await notificationService.runReminders(tEscalate);
    const escalateMails = mockMailer.getSentEmails();
    expect(escalateMails.some((m) => m.to === 'bob@carecircle.org' && m.subject.includes('Alert: Grandma Martha missed'))).toBe(true);

    // D. Idempotency test: running again at 10:10 AM sends 0 new duplicate emails!
    mockMailer.clear();
    await notificationService.runReminders(tEscalate);
    expect(mockMailer.getSentEmails().length).toBe(0);

    // E. Doctor Appointment 24-hour reminder
    const tAppt24h = DateTime.fromISO('2026-12-04T10:00:00.000Z');
    mockMailer.clear();
    await notificationService.runReminders(tAppt24h);
    const apptMails = mockMailer.getSentEmails();
    expect(apptMails.some((m) => m.to === 'martha@carecircle.org' && m.subject.includes('Tomorrow'))).toBe(true);
    expect(apptMails.some((m) => m.to === 'bob@carecircle.org' && m.subject.includes('Tomorrow'))).toBe(true);

    // Re-run appointment reminder: 0 duplicates!
    mockMailer.clear();
    await notificationService.runReminders(tAppt24h);
    expect(mockMailer.getSentEmails().length).toBe(0);

    // 13. Family Member Role Permissions & Invite Workflow
    const familyInviteRes = await request(app)
      .post(`/api/profiles/${profileId}/members/invites`)
      .set('Cookie', elderCookie)
      .send({
        role: 'family',
        permissions: {
          canViewMeds: true,
          canEditMeds: false,
          canViewAppointments: true,
          canEditAppointments: false,
          canViewAdherence: true,
          receiveAlerts: false
        }
      });

    expect(familyInviteRes.status).toBe(201);
    const familyInviteCode = familyInviteRes.body.data.inviteCode;

    const familyJoinRes = await request(app)
      .post('/api/auth/join')
      .send({
        profileId,
        inviteCode: familyInviteCode,
        name: 'Grandson Tim',
        email: 'tim@carecircle.org',
        passcode: 'timmyPass123'
      });

    expect(familyJoinRes.status).toBe(201);
    const familyCookie = familyJoinRes.headers['set-cookie'];
    const familyMemberId = familyJoinRes.body.data.member.id;

    // View-only family member CAN view medications
    const familyViewRes = await request(app)
      .get(`/api/profiles/${profileId}/medications`)
      .set('Cookie', familyCookie);
    expect(familyViewRes.status).toBe(200);

    // View-only family member is BLOCKED from editing medications (403 Forbidden)
    const familyEditRes = await request(app)
      .post(`/api/profiles/${profileId}/medications`)
      .set('Cookie', familyCookie)
      .send({
        name: 'Unauthorized Drug',
        dosage: '10mg',
        form: 'pill',
        instructions: 'Test',
        times: ['08:00'],
        daysOfWeek: [0, 1, 2],
        startDate: '2026-11-01'
      });
    expect(familyEditRes.status).toBe(403);

    // 14. Revoke Member Access blocks member completely
    const revokeRes = await request(app)
      .delete(`/api/profiles/${profileId}/members/${familyMemberId}`)
      .set('Cookie', elderCookie);
    expect(revokeRes.status).toBe(200);

    // Revoked family member's session is now blocked (401 Unauthorized)
    const blockedRes = await request(app)
      .get(`/api/profiles/${profileId}/medications`)
      .set('Cookie', familyCookie);
    expect(blockedRes.status).toBe(401);

    // 15. Adherence stats calculation
    const adhRes = await request(app)
      .get(`/api/profiles/${profileId}/schedule/adherence`)
      .set('Cookie', elderCookie);

    expect(adhRes.status).toBe(200);
    expect(adhRes.body.data.sevenDays.taken).toBeGreaterThanOrEqual(1);

    // 16. Audit log trail
    const auditRes = await request(app)
      .get(`/api/profiles/${profileId}/audit`)
      .set('Cookie', elderCookie);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThanOrEqual(8);
  });
});
