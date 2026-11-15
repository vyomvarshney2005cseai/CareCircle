const {
  registerElderSchema,
  loginSchema,
  joinSchema,
  medicationSchema,
  appointmentSchema,
  doseActionSchema
} = require('../../src/utils/validators');

describe('Validators (Zod Schemas)', () => {
  describe('registerElderSchema', () => {
    it('accepts valid elder registration', () => {
      const input = {
        elderName: 'Grandma Martha',
        elderEmail: 'martha@care.org',
        passcode: 'secure123',
        timezone: 'Asia/Kolkata'
      };
      const res = registerElderSchema.safeParse(input);
      expect(res.success).toBe(true);
    });

    it('rejects short passcodes (<6 chars)', () => {
      const input = {
        elderName: 'Grandma Martha',
        elderEmail: 'martha@care.org',
        passcode: '123'
      };
      const res = registerElderSchema.safeParse(input);
      expect(res.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const input = {
        elderName: 'Grandma Martha',
        elderEmail: 'notanemail',
        passcode: '123456'
      };
      const res = registerElderSchema.safeParse(input);
      expect(res.success).toBe(false);
    });

    it('rejects HTML tags in elder name to prevent stored XSS', () => {
      const input = {
        elderName: '<script>alert(1)</script> Martha',
        elderEmail: 'martha@care.org',
        passcode: 'secure123'
      };
      const res = registerElderSchema.safeParse(input);
      expect(res.success).toBe(false);
    });

    it('rejects names exceeding 100 characters', () => {
      const input = {
        elderName: 'A'.repeat(101),
        elderEmail: 'martha@care.org',
        passcode: 'secure123'
      };
      const res = registerElderSchema.safeParse(input);
      expect(res.success).toBe(false);
    });
  });

  describe('loginSchema & joinSchema UUID Validation', () => {
    it('accepts valid UUID profileId on login', () => {
      const res = loginSchema.safeParse({
        profileId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        passcode: 'pass123'
      });
      expect(res.success).toBe(true);
    });

    it('rejects non-UUID profileId on login', () => {
      const res = loginSchema.safeParse({
        profileId: 'non-uuid-string',
        email: 'user@example.com',
        passcode: 'pass123'
      });
      expect(res.success).toBe(false);
    });

    it('rejects HTML tags in join name', () => {
      const res = joinSchema.safeParse({
        profileId: '550e8400-e29b-41d4-a716-446655440000',
        inviteCode: '8K4N9X2M',
        name: '<img src=x onerror=alert(1)>',
        email: 'nurse@care.org',
        passcode: 'secure123'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('medicationSchema', () => {
    it('accepts valid medication payload and auto-pads single digit hour', () => {
      const input = {
        name: 'Metformin',
        dosage: '500mg',
        form: 'tablet',
        instructions: 'Take with food',
        times: ['2:11', '8:00', '20:30'],
        daysOfWeek: [1, 2, 3, 4, 5],
        startDate: '2026-11-01',
        stockCount: 60,
        refillThreshold: 10
      };
      const res = medicationSchema.safeParse(input);
      expect(res.success).toBe(true);
      expect(res.data.times).toEqual(['02:11', '08:00', '20:30']);
    });

    it('rejects HTML tags in medication instructions', () => {
      const input = {
        name: 'Metformin',
        dosage: '500mg',
        form: 'tablet',
        instructions: '<b onclick="evil()">Take</b> with water',
        times: ['08:00'],
        daysOfWeek: [1],
        startDate: '2026-11-01'
      };
      const res = medicationSchema.safeParse(input);
      expect(res.success).toBe(false);
    });

    it('rejects invalid time format', () => {
      const input = {
        name: 'Metformin',
        dosage: '500mg',
        form: 'tablet',
        times: ['25:99'],
        daysOfWeek: [1],
        startDate: '2026-11-01'
      };
      const res = medicationSchema.safeParse(input);
      expect(res.success).toBe(false);
    });
  });

  describe('appointmentSchema', () => {
    it('rejects HTML tags in doctor name or notes', () => {
      const input = {
        doctorName: 'Dr. <iframe src=javascript:alert(1)>',
        specialty: 'Cardiology',
        location: 'Clinic 1',
        dateTime: '2026-11-20T10:00:00Z',
        notes: 'Checkup'
      };
      const res = appointmentSchema.safeParse(input);
      expect(res.success).toBe(false);
    });
  });

  describe('doseActionSchema', () => {
    it('accepts valid actions', () => {
      expect(doseActionSchema.safeParse({ status: 'taken' }).success).toBe(true);
      expect(doseActionSchema.safeParse({ status: 'skipped' }).success).toBe(true);
      expect(doseActionSchema.safeParse({ status: 'snoozed' }).success).toBe(true);
    });

    it('rejects unrecognized actions', () => {
      expect(doseActionSchema.safeParse({ status: 'forgot' }).success).toBe(false);
    });
  });
});
