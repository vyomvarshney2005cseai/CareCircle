const request = require('supertest');
const { app, clearDatabase, createTestElder } = require('../testHelper');

describe('Appointments CRUD', () => {
  let elder;
  let profileId;

  beforeEach(async () => {
    await clearDatabase();
    elder = await createTestElder();
    profileId = elder.profile.id;
  });

  it('creates, lists, updates, and deletes an appointment', async () => {
    // Create
    const createRes = await request(app)
      .post(`/api/profiles/${profileId}/appointments`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        doctorName: 'Dr. Sarah Patel',
        specialty: 'Cardiologist',
        location: 'City Heart Clinic, Room 304',
        dateTime: '2026-12-01T10:30:00.000Z',
        notes: 'Routine ECG and blood pressure checkup',
        status: 'scheduled'
      });

    expect(createRes.status).toBe(201);
    const apptId = createRes.body.data.id;
    expect(apptId).toBeDefined();

    // List
    const listRes = await request(app)
      .get(`/api/profiles/${profileId}/appointments`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].doctorName).toBe('Dr. Sarah Patel');

    // Update
    const updateRes = await request(app)
      .put(`/api/profiles/${profileId}/appointments/${apptId}`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        status: 'completed',
        notes: 'ECG normal. Continue current medication.'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('completed');

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/profiles/${profileId}/appointments/${apptId}`)
      .set('Authorization', `Bearer ${elder.token}`);

    expect(deleteRes.status).toBe(200);

    const checkRes = await request(app)
      .get(`/api/profiles/${profileId}/appointments/${apptId}`)
      .set('Authorization', `Bearer ${elder.token}`);
    expect(checkRes.status).toBe(404);
  });
});
