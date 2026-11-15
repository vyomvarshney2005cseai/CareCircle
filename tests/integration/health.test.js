const request = require('supertest');
const { app } = require('../testHelper');

describe('Health Check Endpoint', () => {
  it('GET /healthz returns 200 with ok status and runtime info', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime).toBeDefined();
    expect(res.body.commit).toBeDefined();
    expect(res.body.dataStore).toBeDefined();

    const apiRes = await request(app).get('/api/healthz');
    expect(apiRes.status).toBe(200);
    expect(apiRes.body.status).toBe('ok');
  });
});
