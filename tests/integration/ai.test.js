const request = require('supertest');
const { app, clearDatabase, createTestElder } = require('../testHelper');
const aiService = require('../../src/services/aiService');
const MockAIService = require('../../src/services/ai/mockAIService');

describe('Google Gemini AI Integration Features', () => {
  let elder;
  let profileId;
  let familyMember;

  // Minimal genuine 12-byte JPEG header: FF D8 FF E0 00 10 4A 46 49 46 00 01
  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

  beforeEach(async () => {
    await clearDatabase();
    aiService.setProvider(new MockAIService());

    elder = await createTestElder({
      elderName: 'Grandpa Jack',
      elderEmail: 'jack@carecircle.org',
      passcode: 'jackPass123'
    });
    profileId = elder.profile.id;

    // Add an initial medication for Jack
    await request(app)
      .post(`/api/profiles/${profileId}/medications`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        name: 'Metformin',
        dosage: '500mg',
        form: 'tablet',
        times: ['08:00', '20:00'],
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDate: '2026-11-01',
        stockCount: 50,
        refillThreshold: 10
      });

    // Create a restricted family member
    const inviteRes = await request(app)
      .post(`/api/profiles/${profileId}/members/invites`)
      .set('Authorization', `Bearer ${elder.token}`)
      .send({
        role: 'family',
        permissions: {
          canViewMeds: true,
          canEditMeds: false,
          canViewAppointments: true,
          canEditAppointments: false,
          canViewAdherence: true
        }
      });

    const joinRes = await request(app)
      .post('/api/auth/join')
      .send({
        profileId,
        inviteCode: inviteRes.body.data.inviteCode,
        name: 'Granddaughter Lily',
        email: 'lily@carecircle.org',
        passcode: 'lilyPass123'
      });

    familyMember = {
      token: joinRes.body.data.token,
      member: joinRes.body.data.member
    };
  });

  describe('1. Prescription Scanner (POST /api/ai/scan-prescription)', () => {
    it('successfully extracts draft medicines from a valid prescription image', async () => {
      const res = await request(app)
        .post('/api/ai/scan-prescription')
        .set('Authorization', `Bearer ${elder.token}`)
        .attach('image', validJpegBuffer, 'prescription.jpg');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.medicines)).toBe(true);
      expect(res.body.medicines.length).toBeGreaterThanOrEqual(1);

      const firstMed = res.body.medicines[0];
      expect(firstMed).toHaveProperty('name');
      expect(firstMed).toHaveProperty('dosage');
      expect(firstMed).toHaveProperty('form');
      expect(firstMed).toHaveProperty('suggestedTimes');
      expect(res.body).toHaveProperty('notes');
    });

    it('rejects upload with spoofed magic bytes (e.g. text file named .jpg)', async () => {
      const spoofedBuffer = Buffer.from('NOT A VALID JPEG OR IMAGE BUFFER CONTENT AT ALL');
      const res = await request(app)
        .post('/api/ai/scan-prescription')
        .set('Authorization', `Bearer ${elder.token}`)
        .attach('image', spoofedBuffer, 'fake.jpg');

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/signature|mime/i);
    });

    it('rejects unauthenticated scan requests with 401', async () => {
      const res = await request(app)
        .post('/api/ai/scan-prescription')
        .attach('image', validJpegBuffer, 'prescription.jpg');

      expect(res.status).toBe(401);
    });

    it('rejects scan request missing the image file with 400', async () => {
      const res = await request(app)
        .post('/api/ai/scan-prescription')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('rejects user without canEditMeds permission from scanning prescriptions', async () => {
      const res = await request(app)
        .post('/api/ai/scan-prescription')
        .set('Authorization', `Bearer ${familyMember.token}`)
        .attach('image', validJpegBuffer, 'prescription.jpg');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Natural-Language Assistant (POST /api/ai/assistant)', () => {
    it('answers daily schedule queries ("what is due today?")', async () => {
      const res = await request(app)
        .post('/api/ai/assistant')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ message: "what's due today?" });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('query_today');
      expect(res.body.reply).toBeDefined();
      expect(res.body.requiresConfirmation).toBe(false);
    });

    it('answers weekly adherence queries ("how was my week?")', async () => {
      const res = await request(app)
        .post('/api/ai/assistant')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ message: 'how was my week?' });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('query_adherence');
      expect(res.body.reply).toMatch(/adherence/i);
      expect(res.body.requiresConfirmation).toBe(false);
    });

    it('marks taken intent returns a confirmation step without changing data yet', async () => {
      const res = await request(app)
        .post('/api/ai/assistant')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ message: 'I took my morning Metformin' });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('mark_taken');
      expect(res.body.requiresConfirmation).toBe(true);
      expect(res.body.confirmationData).toBeDefined();
      expect(res.body.confirmationData.action).toBe('mark_taken');
    });

    it('executes mark_taken upon explicit user confirmation and updates dose record', async () => {
      // Step 1: Prompt assistant to prepare confirmation
      const promptRes = await request(app)
        .post('/api/ai/assistant')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ message: 'I took my morning Metformin' });

      const confirmationData = promptRes.body.confirmationData;

      // Step 2: Confirm execution
      const confirmRes = await request(app)
        .post('/api/ai/assistant')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({
          confirmed: true,
          confirmationData
        });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.success).toBe(true);
      expect(confirmRes.body.reply).toMatch(/taken/i);
    });

    it('schedules doctor appointment with confirmation step', async () => {
      // Step 1: Prompt
      const promptRes = await request(app)
        .post('/api/ai/assistant')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ message: 'add appointment with Dr Sharma next Tuesday 5pm' });

      expect(promptRes.status).toBe(200);
      expect(promptRes.body.action).toBe('add_appointment');
      expect(promptRes.body.requiresConfirmation).toBe(true);
      expect(promptRes.body.confirmationData.doctorName).toBe('Dr. Sharma');

      // Step 2: Confirm
      const confirmRes = await request(app)
        .post('/api/ai/assistant')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({
          confirmed: true,
          confirmationData: promptRes.body.confirmationData
        });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.success).toBe(true);
      expect(confirmRes.body.reply).toMatch(/scheduled/i);

      // Verify appointment exists in repo
      const listRes = await request(app)
        .get(`/api/profiles/${profileId}/appointments`)
        .set('Authorization', `Bearer ${elder.token}`);
      expect(listRes.body.data.some((a) => a.doctorName === 'Dr. Sharma')).toBe(true);
    });

    it('blocks member without canEditAppointments from executing appointment confirmation', async () => {
      const confirmRes = await request(app)
        .post('/api/ai/assistant')
        .set('Authorization', `Bearer ${familyMember.token}`)
        .send({
          confirmed: true,
          confirmationData: {
            action: 'add_appointment',
            doctorName: 'Dr. Mehta',
            dateTime: '2026-11-20T10:00:00.000Z'
          }
        });

      expect(confirmRes.status).toBe(403);
      expect(confirmRes.body.error.code).toBe('FORBIDDEN');
    });

    it('returns informative unknown fallback when message is unrecognized', async () => {
      const res = await request(app)
        .post('/api/ai/assistant')
        .set('Authorization', `Bearer ${elder.token}`)
        .send({ message: 'Can you recommend a recipe for soup?' });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('unknown');
      expect(res.body.reply).toBeDefined();
    });
  });

  describe('3. Drug Safety & Interaction Check (POST /api/ai/interaction-check)', () => {
    it('returns severity none when there are no conflicting medications', async () => {
      const res = await request(app)
        .post('/api/ai/interaction-check')
        .set('Authorization', `Bearer ${elder.token}`);

      expect(res.status).toBe(200);
      expect(res.body.severity).toBe('none');
      expect(res.body.disclaimer).toMatch(/not a substitute for professional medical advice/i);
    });

    it('flags potential drug interaction when Aspirin and Ibuprofen are both present', async () => {
      // Add Aspirin and Ibuprofen to trigger mock interaction detector
      await request(app)
        .post(`/api/profiles/${profileId}/medications`)
        .set('Authorization', `Bearer ${elder.token}`)
        .send({
          name: 'Aspirin',
          dosage: '81mg',
          form: 'tablet',
          times: ['09:00'],
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startDate: '2026-11-01'
        });

      await request(app)
        .post(`/api/profiles/${profileId}/medications`)
        .set('Authorization', `Bearer ${elder.token}`)
        .send({
          name: 'Ibuprofen',
          dosage: '400mg',
          form: 'tablet',
          times: ['14:00'],
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startDate: '2026-11-01'
        });

      const res = await request(app)
        .post('/api/ai/interaction-check')
        .set('Authorization', `Bearer ${elder.token}`);

      expect(res.status).toBe(200);
      expect(res.body.severity).toBe('moderate');
      expect(res.body.findings.length).toBeGreaterThan(0);
      expect(res.body.findings[0].description).toMatch(/gastrointestinal bleeding/i);
      expect(res.body.disclaimer).toMatch(/consult your doctor or certified pharmacist/i);
    });
  });

  describe('4. Adherence Insights (GET /api/ai/adherence-insight)', () => {
    it('returns a kind plain-language insight and positive encouragement', async () => {
      const res = await request(app)
        .get('/api/ai/adherence-insight')
        .set('Authorization', `Bearer ${elder.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('insight');
      expect(res.body).toHaveProperty('positiveNote');
      expect(res.body).toHaveProperty('recommendation');
    });
  });
});
