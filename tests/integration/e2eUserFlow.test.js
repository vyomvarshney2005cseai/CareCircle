const request = require('supertest');
const { app, clearDatabase } = require('../testHelper');

describe('Full End-to-End CareCircle Scenario', () => {
  beforeEach(async () => {
    await clearDatabase();
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

    // 7. Elder clicks "I Took It" on the morning dose
    const doseRes = await request(app)
      .post(`/api/profiles/${profileId}/schedule/doses/${morningDose.id}/action`)
      .set('Cookie', elderCookie)
      .send({ status: 'taken' });

    expect(doseRes.status).toBe(200);
    expect(doseRes.body.data.dose.status).toBe('taken');
    // Stock automatically decremented from 30 to 29!
    expect(doseRes.body.data.medication.stockCount).toBe(29);

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

    // 12. Adherence stats calculation
    const adhRes = await request(app)
      .get(`/api/profiles/${profileId}/schedule/adherence`)
      .set('Cookie', elderCookie);

    expect(adhRes.status).toBe(200);
    expect(adhRes.body.data.sevenDays.taken).toBeGreaterThanOrEqual(1);

    // 13. Audit log trail
    const auditRes = await request(app)
      .get(`/api/profiles/${profileId}/audit`)
      .set('Cookie', elderCookie);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThanOrEqual(6);
  });
});
