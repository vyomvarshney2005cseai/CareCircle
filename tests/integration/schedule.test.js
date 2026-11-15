const request = require('supertest');
const { app, clearDatabase, createTestElder } = require('../testHelper');

describe('Schedule & Adherence Engine', () => {
  let elder;
  let profileId;

  beforeEach(async () => {
    await clearDatabase();
    elder = await createTestElder();
    profileId = elder.profile.id;

    // Create daily medication covering every day of the week
    await request(app)
      .post(`/api/profiles/${profileId}/medications`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        name: 'Metformin',
        dosage: '500mg',
        form: 'tablet',
        instructions: 'After breakfast and dinner',
        times: ['08:00', '20:00'],
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDate: '2026-11-01',
        stockCount: 10,
        refillThreshold: 3
      });
  });

  it('generates today schedule and decrements stock when dose is taken', async () => {
    // 1. Get today's schedule
    const schedRes = await request(app)
      .get(`/api/profiles/${profileId}/schedule/today`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(schedRes.status).toBe(200);
    expect(schedRes.body.data.doses.length).toBe(2);
    expect(schedRes.body.data.doses[0].status).toBe('pending');
    expect(schedRes.body.data.doses[0].stockCount).toBe(10);

    const doseToTake = schedRes.body.data.doses[0];

    // 2. Mark dose taken
    const actionRes = await request(app)
      .post(`/api/profiles/${profileId}/schedule/doses/${doseToTake.id}/action`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ status: 'taken' });

    expect(actionRes.status).toBe(200);
    expect(actionRes.body.data.dose.status).toBe('taken');
    expect(actionRes.body.data.dose.takenAt).toBeDefined();
    // Stock should have decremented from 10 to 9
    expect(actionRes.body.data.medication.stockCount).toBe(9);

    // 3. Re-fetch schedule: dose should now be 'taken'
    const updatedSchedRes = await request(app)
      .get(`/api/profiles/${profileId}/schedule/today`)
      .set('Authorization', `Bearer ${elder.token}`);

    const takenDose = updatedSchedRes.body.data.doses.find((d) => d.scheduledTime === doseToTake.scheduledTime);
    expect(takenDose.status).toBe('taken');
  });

  it('calculates 7-day and 30-day adherence statistics', async () => {
    // Mark one dose taken
    const schedRes = await request(app)
      .get(`/api/profiles/${profileId}/schedule/today`)
      .set('Authorization', `Bearer ${elder.token}`);

    const firstDose = schedRes.body.data.doses[0];
    await request(app)
      .post(`/api/profiles/${profileId}/schedule/doses/${firstDose.id}/action`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({ status: 'taken' });

    // Fetch adherence stats
    const adhRes = await request(app)
      .get(`/api/profiles/${profileId}/schedule/adherence`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(adhRes.status).toBe(200);
    expect(adhRes.body.data.sevenDays).toBeDefined();
    expect(adhRes.body.data.sevenDays.taken).toBeGreaterThanOrEqual(1);
    expect(typeof adhRes.body.data.sevenDays.rate).toBe('number');
  });
});
