const request = require('supertest');
const { app, clearDatabase, createTestElder } = require('../testHelper');

describe('Granular Permissions & requirePermission Middleware', () => {
  let elder;
  let profileId;
  let familyCookie;

  beforeEach(async () => {
    await clearDatabase();
    elder = await createTestElder();
    profileId = elder.profile.id;

    // Create Family invite with view-only permissions
    const inviteRes = await request(app)
      .post(`/api/profiles/${profileId}/members/invites`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        role: 'family',
        permissions: {
          canViewMeds: true,
          canEditMeds: false,
          canViewAppointments: true,
          canEditAppointments: false
        }
      });

    const inviteCode = inviteRes.body.data.inviteCode;

    // Join as family member
    const joinRes = await request(app).post('/api/auth/join').send({
      profileId,
      inviteCode,
      name: 'Granddaughter Lily',
      email: 'lily@carecircle.org',
      passcode: 'lilyPass123'
    });

    familyCookie = joinRes.headers['set-cookie'];
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get(`/api/profiles/${profileId}/medications`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows family member with canViewMeds to view medications', async () => {
    const res = await request(app)
      .get(`/api/profiles/${profileId}/medications`)
      .set('Cookie', familyCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('blocks family member without canEditMeds from creating medications with 403', async () => {
    const res = await request(app)
      .post(`/api/profiles/${profileId}/medications`)
      .set('Cookie', familyCookie)
      .send({
        name: 'Ibuprofen',
        dosage: '200mg',
        form: 'tablet',
        times: ['12:00'],
        daysOfWeek: [1, 2, 3],
        startDate: '2026-11-01'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows elder with full bypass to create medications', async () => {
    const res = await request(app)
      .post(`/api/profiles/${profileId}/medications`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        name: 'Aspirin',
        dosage: '81mg',
        form: 'pill',
        times: ['08:00'],
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDate: '2026-11-01',
        stockCount: 30,
        refillThreshold: 5
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Aspirin');
  });
});
