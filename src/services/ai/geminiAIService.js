const { GoogleGenAI } = require('@google/genai');
const AIServiceInterface = require('./aiServiceInterface');
const config = require('../../config');
const logger = require('../../utils/logger');
const AppError = require('../../errors/appError');
const {
  prescriptionScanResultSchema,
  assistantIntentSchema,
  safetyCheckResultSchema,
  adherenceInsightSchema
} = require('../../utils/aiSchemas');

const TIMEOUT_MS = 25000;

/**
 * Helper to race a promise against a timeout.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Gemini API call timed out')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Production implementation of Gemini AI services using @google/genai SDK.
 */
class GeminiAIService extends AIServiceInterface {
  constructor() {
    super();
    this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    this.modelName = config.geminiModel || 'gemini-2.5-flash';
  }

  /**
   * 1. Multimodal Prescription Scanner
   */
  async scanPrescription({ buffer, mimeType }) {
    logger.info({ model: this.modelName }, 'Scanning prescription via Gemini Vision API');

    const base64Data = buffer.toString('base64');
    const prompt = `You are a medical assistant parsing an elderly patient's prescription image.
Extract all medications into a structured JSON array.
For each medication provide:
- name: brand or generic medication name
- dosage: strength or dose amount (e.g. "500mg", "1 tablet")
- form: "tablet" | "capsule" | "syrup" | "injection" | "drops" | "inhaler"
- frequency: how often to take (e.g. "Twice daily", "Every 8 hours")
- suggestedTimes: array of strings in 24-hour "HH:mm" format (e.g. ["08:00", "20:00"])
- instructions: specific instructions (e.g. "Take after food with water")

Return strictly JSON matching:
{
  "medicines": [...],
  "notes": "summary or physician instructions"
}`;

    try {
      const response = await withTimeout(
        this.ai.models.generateContent({
          model: this.modelName,
          contents: [
            prompt,
            {
              inlineData: {
                data: base64Data,
                mimeType
              }
            }
          ],
          config: {
            responseMimeType: 'application/json'
          }
        })
      );

      const parsed = JSON.parse(response.text);
      return prescriptionScanResultSchema.parse(parsed);
    } catch (err) {
      logger.error({ err: err.message }, 'Gemini prescription scanning failed');
      throw AppError.unprocessable(
        'Failed to scan prescription with AI. Please review the image or enter manually.'
      );
    }
  }

  /**
   * 2. Natural Language Intent Parsing
   */
  async parseAssistantIntent(message, context = {}) {
    logger.info({ model: this.modelName }, 'Parsing natural language user query');

    const prompt = `You are CareCircle's eldercare assistant. Convert the user's spoken or typed message into a structured intent.
Active Context: ${JSON.stringify(context || {})}
User Message: "${message}"

Determine the user's intent from these actions:
1. "mark_taken": User took or drinks a medicine (e.g. "I took my morning blood pressure pill", "had my Metformin").
   params: { medicationName: string, time: string }
2. "query_today": User asks what is due today, what medicines to take, or their daily schedule.
   params: {}
3. "add_appointment": User asks to book/schedule a doctor appointment.
   params: { doctorName: string, specialty?: string, location?: string, dateTime: ISO string, notes?: string }
4. "query_adherence": User asks how their week was, adherence stats, or progress.
   params: {}
5. "unknown": Anything unrelated or unclear.
   params: {}

Provide a friendly, conversational "reply" directed to an elderly individual.
Return strictly JSON matching:
{
  "action": "mark_taken" | "query_today" | "add_appointment" | "query_adherence" | "unknown",
  "reply": "Conversational message for the elder",
  "params": { ... }
}`;

    try {
      const response = await withTimeout(
        this.ai.models.generateContent({
          model: this.modelName,
          contents: [prompt],
          config: {
            responseMimeType: 'application/json'
          }
        })
      );

      const parsed = JSON.parse(response.text);
      return assistantIntentSchema.parse(parsed);
    } catch (err) {
      logger.error({ err: err.message }, 'Gemini intent parsing failed');
      // Fallback intent
      return {
        action: 'unknown',
        reply:
          'I am having trouble connecting to AI services right now. You can view your schedule directly on the dashboard.',
        params: {}
      };
    }
  }

  /**
   * 3. Medication Interaction & Safety Check
   */
  async checkInteractions(medications) {
    logger.info({ count: medications?.length }, 'Checking medication safety via Gemini');

    const medList = (medications || []).map((m) => ({
      name: m.name,
      dosage: m.dosage,
      form: m.form,
      times: m.times,
      instructions: m.instructions
    }));

    const prompt = `Analyze this list of active medications for an elderly individual for potential safety risks:
Medications: ${JSON.stringify(medList)}

Evaluate for:
1. Drug-drug interactions (e.g. blood thinners with NSAIDs).
2. Duplicate therapies (multiple drugs in the same class).
3. Timing conflicts (e.g. drugs that compete for absorption or must be spaced out).

Return strictly JSON matching:
{
  "severity": "high" | "moderate" | "low" | "none",
  "summary": "Clear, plain-language summary for the elder and caregiver",
  "findings": [
    {
      "medications": ["MedA", "MedB"],
      "type": "interaction" | "duplicate_therapy" | "timing_conflict" | "general_caution",
      "severity": "high" | "moderate" | "low" | "none",
      "description": "Plain language explanation of risk",
      "recommendation": "Actionable, non-prescriptive recommendation"
    }
  ],
  "disclaimer": "This safety check is AI-generated for informational awareness and is not a substitute for professional medical advice. Always consult your doctor or certified pharmacist before modifying your medication regimen."
}`;

    try {
      const response = await withTimeout(
        this.ai.models.generateContent({
          model: this.modelName,
          contents: [prompt],
          config: {
            responseMimeType: 'application/json'
          }
        })
      );

      const parsed = JSON.parse(response.text);
      return safetyCheckResultSchema.parse(parsed);
    } catch (err) {
      logger.error({ err: err.message }, 'Gemini interaction check failed');
      return {
        severity: 'none',
        summary:
          'Unable to evaluate interactions at this time due to temporary AI service unavailability.',
        findings: [],
        disclaimer:
          'This safety check is AI-generated for informational awareness and is not a substitute for professional medical advice. Always consult your doctor or certified pharmacist before modifying your medication regimen.'
      };
    }
  }

  /**
   * 4. Adherence Insights
   */
  async generateAdherenceInsight(doseLogs, medications) {
    logger.info('Generating adherence insights via Gemini');

    const prompt = `Analyze recent dose logs and medications for an elderly patient to generate a kind, motivating, and actionable adherence insight.
Dose logs sample: ${JSON.stringify((doseLogs || []).slice(0, 30))}
Active medications: ${JSON.stringify((medications || []).map((m) => ({ name: m.name, times: m.times })))}

Return strictly JSON matching:
{
  "insight": "Short, compassionate plain-language observation (e.g., Evening doses are missed mostly on weekends — consider moving it to 7 PM)",
  "positiveNote": "Praise for consistency",
  "recommendation": "Gentle suggestion to improve routine"
}`;

    try {
      const response = await withTimeout(
        this.ai.models.generateContent({
          model: this.modelName,
          contents: [prompt],
          config: {
            responseMimeType: 'application/json'
          }
        })
      );

      const parsed = JSON.parse(response.text);
      return adherenceInsightSchema.parse(parsed);
    } catch (err) {
      logger.error({ err: err.message }, 'Gemini adherence insight generation failed');
      return {
        insight:
          'Taking medications at consistent daily milestones (like breakfast or dinner) builds long-lasting health habits.',
        positiveNote: 'Every dose taken on time protects your well-being.',
        recommendation: 'Keep medications visible in a safe, routine spot.'
      };
    }
  }
}

module.exports = GeminiAIService;
