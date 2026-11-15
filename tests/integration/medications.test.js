const request = require('supertest');
const { app, clearDatabase, createTestElder } = require('../testHelper');

describe('Medications CRUD', () => {
  let elder;
  let profileId;

  beforeEach(async () => {
    await clearDatabase();
    elder = await createTestElder();
    profileId = elder.profile.id;
  });

  it('creates, retrieves, updates, and deletes medication', async () => {
    // 1. Create
    const createRes = await request(app)
      .post(`/api/profiles/${profileId}/medications`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        name: 'Lisinopril',
        dosage: '10mg',
        form: 'tablet',
        instructions: 'Take once daily in the morning',
        times: ['08:00'],
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDate: '2026-11-01',
        stockCount: 15,
        refillThreshold: 5
      });

    expect(createRes.status).toBe(201);
    const medId = createRes.body.data.id;
    expect(medId).toBeDefined();

    // 2. Get list
    const listRes = await request(app)
      .get(`/api/profiles/${profileId}/medications`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].name).toBe('Lisinopril');

    // 3. Update
    const updateRes = await request(app)
      .put(`/api/profiles/${profileId}/medications/${medId}`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        dosage: '20mg',
        stockCount: 14
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.dosage).toBe('20mg');
    expect(updateRes.body.data.stockCount).toBe(14);

    // 4. Delete
    const deleteRes = await request(app)
      .delete(`/api/profiles/${profileId}/medications/${medId}`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(deleteRes.status).toBe(200);

    // Verify deleted
    const getRes = await request(app)
      .get(`/api/profiles/${profileId}/medications/${medId}`)
      .set('Authorization', `Bearer ${elder.token}`);
    expect(getRes.status).toBe(404);
  });
});
