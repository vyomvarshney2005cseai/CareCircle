const request = require('supertest');
const { app, clearDatabase, createTestElder } = require('../testHelper');

describe('Elder-Centred Approval Workflow (Pending Changes)', () => {
  let elder;
  let profileId;
  let caretakerToken;

  beforeEach(async () => {
    await clearDatabase();
    elder = await createTestElder();
    profileId = elder.profile.id;

    // 1. Elder issues invite for caretaker with canEditMeds = true
    const inviteRes = await request(app)
      .post(`/api/profiles/${profileId}/members/invites`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        role: 'caretaker',
        permissions: {
          canViewMeds: true,
          canEditMeds: true,
          canViewAppointments: true,
          canEditAppointments: true
        }
      });

    const inviteCode = inviteRes.body.data.inviteCode;

    // 2. Caretaker joins
    const joinRes = await request(app).post('/api/auth/join').send({
      profileId,
      inviteCode,
      name: 'Nurse Joy',
      email: 'joy@carecircle.org',
      passcode: 'joyPass123'
    });

    caretakerToken = joinRes.body.data.token;
  });

  it('allows caretaker direct edit when approval is NOT required', async () => {
    const res = await request(app)
      .post(`/api/profiles/${profileId}/medications`)
      .set('Authorization', `Bearer ${caretakerToken}`)
      .send({
        name: 'Vitamin D3',
        dosage: '1000 IU',
        form: 'capsule',
        times: ['09:00'],
        daysOfWeek: [0],
        startDate: '2026-11-01',
        stockCount: 30
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.pending).toBeUndefined();
  });

  it('intercepts caretaker edit when requireElderApprovalForEdits is enabled, and applies on elder approval', async () => {
    // 1. Elder enables requireElderApprovalForEdits
    const setRes = await request(app)
      .put(`/api/profiles/${profileId}/settings`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        requireElderApprovalForEdits: true
      });

    expect(setRes.status).toBe(200);
    expect(setRes.body.data.settings.requireElderApprovalForEdits).toBe(true);

    // 2. Caretaker attempts to add a medication
    const propRes = await request(app)
      .post(`/api/profiles/${profileId}/medications`)
      .set('Authorization', `Bearer ${caretakerToken}`)
      .send({
        name: 'Atorvastatin',
        dosage: '20mg',
        form: 'tablet',
        times: ['21:00'],
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDate: '2026-11-01',
        stockCount: 30,
        refillThreshold: 5
      });

    // Should return 202 Accepted with pending change ID
    expect(propRes.status).toBe(202);
    expect(propRes.body.data.pending).toBe(true);
    const pendingChangeId = propRes.body.data.pendingChangeId;
    expect(pendingChangeId).toBeDefined();

    // Medication should NOT exist in active collection yet
    const medsCheck = await request(app)
      .get(`/api/profiles/${profileId}/medications`)
      .set('Authorization', `Bearer ${elder.token}`);
    expect(medsCheck.body.data.find((m) => m.name === 'Atorvastatin')).toBeUndefined();

    // 3. Elder views pending changes
    const listPendingRes = await request(app)
      .get(`/api/profiles/${profileId}/pending-changes`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(listPendingRes.status).toBe(200);
    expect(listPendingRes.body.data.length).toBe(1);
    expect(listPendingRes.body.data[0].id).toBe(pendingChangeId);

    // 4. Elder approves the proposed change
    const approveRes = await request(app)
      .post(`/api/profiles/${profileId}/pending-changes/${pendingChangeId}/review`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ action: 'approve' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');

    // 5. Medication is now live in active collection!
    const liveMedsRes = await request(app)
      .get(`/api/profiles/${profileId}/medications`)
      .set('Authorization', `Bearer ${elder.token}`);

    const added = liveMedsRes.body.data.find((m) => m.name === 'Atorvastatin');
    expect(added).toBeDefined();
    expect(added.dosage).toBe('20mg');

    // 6. Audit log contains the approval event
    const auditRes = await request(app)
      .get(`/api/profiles/${profileId}/audit`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(auditRes.status).toBe(200);
    const approvalAudit = auditRes.body.data.find((a) => a.action === 'APPROVE_CHANGE');
    expect(approvalAudit).toBeDefined();
  });

  it('allows elder to reject a proposed change with reason', async () => {
    // 1. Enable approval requirement
    await request(app)
      .put(`/api/profiles/${profileId}/settings`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ requireElderApprovalForEdits: true });

    // 2. Caretaker proposes appointment
    const propRes = await request(app)
      .post(`/api/profiles/${profileId}/appointments`)
      .set('Authorization', `Bearer ${caretakerToken}`)
      .send({
        doctorName: 'Dr. Unwanted',
        specialty: 'Surgery',
        location: 'Downtown Hospital',
        dateTime: '2026-11-25T14:00:00.000Z',
        status: 'scheduled'
      });

    expect(propRes.status).toBe(202);
    const pendingId = propRes.body.data.pendingChangeId;

    // 3. Elder rejects the change
    const rejectRes = await request(app)
      .post(`/api/profiles/${profileId}/pending-changes/${pendingId}/review`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        action: 'reject',
        rejectionReason: 'Doctor is out of network'
      });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('rejected');
    expect(rejectRes.body.data.rejectionReason).toBe('Doctor is out of network');
  });
});
