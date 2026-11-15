const { z } = require('zod');

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Schema for drafted medicine items extracted from prescription images.
 */
const draftMedicineSchema = z.object({
  name: z.string().trim().min(1, 'Medicine name is required'),
  dosage: z.string().trim().default('As directed'),
  form: z.string().trim().default('tablet'),
  frequency: z.string().trim().default('Once daily'),
  suggestedTimes: z.array(z.string().regex(timeRegex, 'Time must be in HH:mm format')).default(['09:00']),
  instructions: z.string().trim().default('Take with water after meals')
});

const prescriptionScanResultSchema = z.object({
  medicines: z.array(draftMedicineSchema).default([]),
  notes: z.string().default('Prescription draft extracted by Gemini')
});

/**
 * Schema for natural language conversational assistant intent parsing.
 */
const assistantIntentSchema = z.object({
  action: z.enum(['mark_taken', 'query_today', 'add_appointment', 'query_adherence', 'unknown']),
  reply: z.string(),
  params: z.object({
    medicationName: z.string().optional(),
    time: z.string().optional(),
    doctorName: z.string().optional(),
    specialty: z.string().optional(),
    location: z.string().optional(),
    dateTime: z.string().optional(),
    notes: z.string().optional()
  }).default({})
});

/**
 * Schema for medication safety, interactions, duplicate therapy, and timing conflict checks.
 */
const interactionFindingSchema = z.object({
  medications: z.array(z.string()),
  type: z.enum(['interaction', 'duplicate_therapy', 'timing_conflict', 'general_caution']),
  severity: z.enum(['high', 'moderate', 'low', 'none']),
  description: z.string(),
  recommendation: z.string()
});

const safetyCheckResultSchema = z.object({
  severity: z.enum(['high', 'moderate', 'low', 'none']),
  summary: z.string(),
  findings: z.array(interactionFindingSchema).default([]),
  disclaimer: z.string().default(
    'This safety check is AI-generated for informational awareness and is not a substitute for professional medical advice. Always consult your doctor or certified pharmacist before modifying your medication regimen.'
  )
});

/**
 * Schema for plain-language adherence insights.
 */
const adherenceInsightSchema = z.object({
  insight: z.string(),
  positiveNote: z.string().optional(),
  recommendation: z.string().optional()
});

module.exports = {
  draftMedicineSchema,
  prescriptionScanResultSchema,
  assistantIntentSchema,
  interactionFindingSchema,
  safetyCheckResultSchema,
  adherenceInsightSchema
};
