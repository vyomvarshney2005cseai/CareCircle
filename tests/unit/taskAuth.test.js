const request = require('supertest');
const express = require('express');
const taskAuth = require('../../src/middlewares/taskAuth');
const config = require('../../src/config');
const errorHandler = require('../../src/middlewares/errorHandler');

describe('Task Authentication Middleware (X-Task-Token)', () => {
  let testApp;

  beforeAll(() => {
    testApp = express();
    testApp.use(express.json());
    testApp.post('/test-task', taskAuth, (req, res) => res.status(200).json({ ok: true }));
    testApp.use(errorHandler);
  });

  it('rejects request with 401 when X-Task-Token header is missing', async () => {
    const res = await request(testApp).post('/test-task');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects request with 403 when X-Task-Token is incorrect', async () => {
    const res = await request(testApp)
      .post('/test-task')
      .set('X-Task-Token', 'wrong-token-value');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows request through when valid token is provided', async () => {
    const res = await request(testApp)
      .post('/test-task')
      .set('X-Task-Token', config.taskToken);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
