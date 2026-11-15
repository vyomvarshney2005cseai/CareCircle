const request = require('supertest');
const { app, clearDatabase } = require('../testHelper');

describe('Auth & Profile Creation Flows', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it('registers elder, issues invite, and allows caretaker to join', async () => {
    // 1. Elder registers
    const registerRes = await request(app)
      .post('/api/auth/register-elder')
      .send({
        elderName: 'Grandma Martha',
        elderEmail: 'martha@carecircle.org',
        passcode: 'marthaPass123',
        timezone: 'Asia/Kolkata'
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.data.profile.id).toBeDefined();
    expect(registerRes.body.data.member.role).toBe('elder');
    expect(registerRes.body.data.member.passcodeHash).toBeUndefined();
    expect(registerRes.headers['set-cookie']).toBeDefined();

    const profileId = registerRes.body.data.profile.id;
    const elderCookie = registerRes.headers['set-cookie'];

    // 2. Elder generates invite for Caretaker
    const inviteRes = await request(app)
      .post(`/api/profiles/${profileId}/members/invites`)
      .set('Cookie', elderCookie)
      .send({
        role: 'caretaker',
        permissions: { canViewMeds: true, canEditMeds: true }
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.data.inviteCode).toBeDefined();
    expect(inviteRes.body.data.inviteCode.length).toBe(8);

    const inviteCode = inviteRes.body.data.inviteCode;

    // 3. Caretaker joins using profileId + inviteCode
    const joinRes = await request(app)
      .post('/api/auth/join')
      .send({
        profileId,
        inviteCode,
        name: 'Nurse Bob',
        email: 'bob@carecircle.org',
        passcode: 'nursePass123'
      });

    expect(joinRes.status).toBe(201);
    expect(joinRes.body.data.member.name).toBe('Nurse Bob');
    expect(joinRes.body.data.member.role).toBe('caretaker');
    expect(joinRes.headers['set-cookie']).toBeDefined();

    // 4. Caretaker logs in
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        profileId,
        email: 'bob@carecircle.org',
        passcode: 'nursePass123'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.member.email).toBe('bob@carecircle.org');
  });

  it('enforces lockout after 5 consecutive failed login attempts', async () => {
    // Register elder
    const regRes = await request(app)
      .post('/api/auth/register-elder')
      .send({
        elderName: 'Grandpa Joe',
        elderEmail: 'joe@carecircle.org',
        passcode: 'correctPass123'
      });

    const profileId = regRes.body.data.profile.id;

    // 4 failed attempts
    for (let i = 0; i < 4; i += 1) {
      const failRes = await request(app)
        .post('/api/auth/login')
        .send({
          profileId,
          email: 'joe@carecircle.org',
          passcode: 'wrongPassword'
        });
      expect(failRes.status).toBe(401);
    }

    // 5th failed attempt triggers lockout
    const lockRes = await request(app)
      .post('/api/auth/login')
      .send({
        profileId,
        email: 'joe@carecircle.org',
        passcode: 'wrongPassword'
      });
    expect(lockRes.status).toBe(423); // Locked
    expect(lockRes.body.error.code).toBe('ACCOUNT_LOCKED');

    // Subsequent attempt even with correct password is blocked while locked
    const blockedRes = await request(app)
      .post('/api/auth/login')
      .send({
        profileId,
        email: 'joe@carecircle.org',
        passcode: 'correctPass123'
      });
    expect(blockedRes.status).toBe(423);
  });
});
