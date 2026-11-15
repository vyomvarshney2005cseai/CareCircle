const request = require('supertest');
const { app, clearDatabase, createTestElder } = require('../testHelper');

describe('CareCircle Member Management & Invite Revocation', () => {
  let elder;
  let profileId;
  let caretakerToken;
  let caretakerMemberId;

  beforeEach(async () => {
    await clearDatabase();
    elder = await createTestElder({
      elderName: 'Grandpa Walter',
      elderEmail: 'walter@carecircle.org',
      passcode: 'walterPass123'
    });
    profileId = elder.profile.id;

    // Create an invite for caretaker
    const inviteRes = await request(app)
      .post(`/api/profiles/${profileId}/members/invites`)
      .set('Authorization', `Bearer ${elder.token}`)
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

    const inviteCode = inviteRes.body.data.inviteCode;

    // Join as caretaker
    const joinRes = await request(app).post('/api/auth/join').send({
      profileId,
      inviteCode,
      name: 'Nurse Nancy',
      email: 'nancy@carecircle.org',
      passcode: 'nancyPass123'
    });

    caretakerToken = joinRes.body.data.token;
    caretakerMemberId = joinRes.body.data.member.id;
  });

  it('lists all active circle members', async () => {
    const res = await request(app)
      .get(`/api/profiles/${profileId}/members`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2); // Walter (Elder) + Nancy (Caretaker)
  });

  it('allows elder to update member permissions', async () => {
    const res = await request(app)
      .put(`/api/profiles/${profileId}/members/${caretakerMemberId}`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        permissions: {
          canViewMeds: true,
          canEditMeds: false, // Revoke edit meds
          canViewAppointments: true,
          canEditAppointments: false
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.data.permissions.canEditMeds).toBe(false);
  });

  it('blocks non-elder member from updating permissions', async () => {
    const res = await request(app)
      .put(`/api/profiles/${profileId}/members/${caretakerMemberId}`)
      .set('Authorization', `Bearer ${caretakerToken}`)
      .send({
        permissions: { canEditMeds: true }
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lists active invites and allows elder to revoke an invite', async () => {
    // Generate a fresh invite
    const inviteRes = await request(app)
      .post(`/api/profiles/${profileId}/members/invites`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ role: 'family' });

    const inviteId = inviteRes.body.data.inviteId;

    // List invites
    const listRes = await request(app)
      .get(`/api/profiles/${profileId}/members/invites/list`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((inv) => inv.id === inviteId)).toBe(true);

    // Revoke invite
    const revokeRes = await request(app)
      .delete(`/api/profiles/${profileId}/members/invites/${inviteId}`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.success).toBe(true);
  });

  it('allows elder to revoke a member from the circle', async () => {
    const revokeRes = await request(app)
      .delete(`/api/profiles/${profileId}/members/${caretakerMemberId}`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.active).toBe(false);

    // Revoked member can no longer access the circle
    const checkRes = await request(app)
      .get(`/api/profiles/${profileId}/medications`)
      .set('Authorization', `Bearer ${caretakerToken}`);

    expect(checkRes.status).toBe(401);
  });
});
