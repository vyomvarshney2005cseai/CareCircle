const {
  registerElderSchema,
  loginSchema,
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
  });

  describe('medicationSchema', () => {
    it('accepts valid medication payload', () => {
      const input = {
        name: 'Metformin',
        dosage: '500mg',
        form: 'tablet',
        instructions: 'Take with food',
        times: ['08:00', '20:00'],
        daysOfWeek: [1, 2, 3, 4, 5],
        startDate: '2026-11-01',
        stockCount: 60,
        refillThreshold: 10
      };
      const res = medicationSchema.safeParse(input);
      expect(res.success).toBe(true);
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
