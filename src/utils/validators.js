const { z } = require('zod');
const { ROLES } = require('../constants/roles');

const timeRegex = /^([0-1]?\d|2[0-3]):[0-5]\d$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const noHtml = (val) => !/<[^>]*>/.test(val);
const noHtmlMsg = 'HTML tags are not permitted';

const registerElderSchema = z.object({
  elderName: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .refine(noHtml, noHtmlMsg),
  elderEmail: z.string().trim().email('Invalid email address').toLowerCase(),
  passcode: z.string().min(6, 'Passcode must be at least 6 characters'),
  timezone: z.string().default('Asia/Kolkata')
});

const loginSchema = z.object({
  profileId: z.string().trim().uuid('Profile ID must be a valid UUID'),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  passcode: z.string().min(1, 'Passcode is required')
});

const createInviteSchema = z.object({
  role: z.enum([ROLES.CARETAKER, ROLES.FAMILY]),
  permissions: z
    .object({
      canViewMeds: z.boolean().default(true),
      canEditMeds: z.boolean().default(false),
      canViewAppointments: z.boolean().default(true),
      canEditAppointments: z.boolean().default(false),
      canViewAdherence: z.boolean().default(true),
      receiveAlerts: z.boolean().default(true)
    })
    .optional(),
  expiresInDays: z.number().int().positive().max(90).default(7)
});

const joinSchema = z.object({
  profileId: z.string().trim().uuid('Profile ID must be a valid UUID'),
  inviteCode: z.string().trim().min(6, 'Invite code is required'),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .refine(noHtml, noHtmlMsg),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  passcode: z.string().min(6, 'Passcode must be at least 6 characters')
});

const medicationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Medication name is required')
    .max(100, 'Name cannot exceed 100 characters')
    .refine(noHtml, noHtmlMsg),
  dosage: z
    .string()
    .trim()
    .min(1, 'Dosage is required (e.g. 500mg, 1 tablet)')
    .max(100, 'Dosage cannot exceed 100 characters')
    .refine(noHtml, noHtmlMsg),
  form: z
    .string()
    .trim()
    .min(1, 'Form is required (e.g. pill, syrup, injection)')
    .max(50)
    .refine(noHtml, noHtmlMsg),
  instructions: z
    .string()
    .trim()
    .max(500, 'Instructions cannot exceed 500 characters')
    .refine(noHtml, noHtmlMsg)
    .default('Take with water'),
  times: z
    .array(
      z
        .string()
        .trim()
        .regex(timeRegex, 'Time must be in HH:mm format (e.g. 08:00 or 14:30)')
        .transform((t) => {
          const parts = t.split(':');
          return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        })
    )
    .min(1, 'At least one scheduled time is required'),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'At least one day of week is required'),
  startDate: z.string().regex(dateRegex, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(dateRegex, 'End date must be YYYY-MM-DD').nullable().optional(),
  stockCount: z.coerce.number().int().min(0, 'Stock count must be 0 or more').default(0),
  refillThreshold: z.coerce.number().int().min(0, 'Refill threshold must be 0 or more').default(5),
  active: z.boolean().default(true)
});

const medicationUpdateSchema = medicationSchema.partial();

const doseActionSchema = z.object({
  status: z.enum(['taken', 'skipped', 'snoozed']),
  takenAt: z.string().datetime().optional()
});

const appointmentSchema = z.object({
  doctorName: z
    .string()
    .trim()
    .min(2, 'Doctor name is required')
    .max(100, 'Doctor name cannot exceed 100 characters')
    .refine(noHtml, noHtmlMsg),
  specialty: z
    .string()
    .trim()
    .min(2, 'Medical specialty is required')
    .max(100, 'Specialty cannot exceed 100 characters')
    .refine(noHtml, noHtmlMsg),
  location: z
    .string()
    .trim()
    .min(2, 'Clinic or hospital location is required')
    .max(200, 'Location cannot exceed 200 characters')
    .refine(noHtml, noHtmlMsg),
  dateTime: z.string().min(1, 'Date and time is required'),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .refine(noHtml, noHtmlMsg)
    .default(''),
  status: z.enum(['scheduled', 'completed', 'cancelled']).default('scheduled')
});

const appointmentUpdateSchema = appointmentSchema.partial();

const updateSettingsSchema = z.object({
  requireElderApprovalForEdits: z.boolean().optional(),
  timezone: z.string().optional(),
  escalationMinutes: z
    .object({
      remindElder: z.number().int().min(0).default(0),
      missedAfter: z.number().int().min(1).default(30),
      alertCaretakerAfter: z.number().int().min(1).default(60)
    })
    .optional()
});

const updateMemberSchema = z.object({
  permissions: z
    .object({
      canViewMeds: z.boolean().optional(),
      canEditMeds: z.boolean().optional(),
      canViewAppointments: z.boolean().optional(),
      canEditAppointments: z.boolean().optional(),
      canViewAdherence: z.boolean().optional(),
      receiveAlerts: z.boolean().optional()
    })
    .optional(),
  active: z.boolean().optional()
});

const reviewPendingChangeSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().trim().optional()
});

module.exports = {
  registerElderSchema,
  loginSchema,
  createInviteSchema,
  joinSchema,
  medicationSchema,
  medicationUpdateSchema,
  doseActionSchema,
  appointmentSchema,
  appointmentUpdateSchema,
  updateSettingsSchema,
  updateMemberSchema,
  reviewPendingChangeSchema
};
