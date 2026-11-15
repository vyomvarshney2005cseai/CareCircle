const config = require('../config');
const GeminiAIService = require('./ai/geminiAIService');
const MockAIService = require('./ai/mockAIService');
const scheduleService = require('./scheduleService');
const appointmentService = require('./appointmentService');
const { getRepository } = require('../repositories');
const AppError = require('../errors/appError');
const { ROLES } = require('../constants/roles');

/**
 * Find the pending dose that best matches a spoken medicine name,
 * falling back to the next pending dose of the day.
 * @param {object} todaySchedule Schedule with a `doses` array.
 * @param {string} [requestedName] Medicine name from the parsed intent.
 * @returns {object|null} Matching dose or null.
 */
function findPendingDose(todaySchedule, requestedName) {
  const pending = (todaySchedule.doses || []).filter((d) => d.status !== 'taken');
  const wanted = (requestedName || '').toLowerCase();
  const byName = wanted
    ? pending.find((d) => d.medicationName.toLowerCase().includes(wanted))
    : null;
  return byName || pending[0] || null;
}

/**
 * Extract the YYYY-MM-DD day a dose log belongs to.
 * @param {object} log Dose log entry.
 * @returns {string|null} ISO date string, or null when unknown.
 */
function getLogDate(log) {
  if (log.date) return log.date;
  const timestamp = log.scheduledTime || log.takenAt;
  return timestamp ? timestamp.slice(0, 10) : null;
}

/**
 * High-level AI Service coordinating multimodal Gemini vision,
 * conversational intent routing, interaction safety, and adherence insights.
 * All mutations are strictly gated by caller permissions and explicit confirmation.
 */
class AIService {
  constructor() {
    this._provider = null;
    this.initProvider();
  }

  /**
   * Selects provider based on environment and API key availability.
   */
  initProvider() {
    if (config.env === 'test' || !config.geminiApiKey) {
      this._provider = new MockAIService();
    } else {
      this._provider = new GeminiAIService();
    }
  }

  /**
   * Swap provider (used for test mocking or runtime changes).
   * @param {object} provider
   */
  setProvider(provider) {
    this._provider = provider;
  }

  /**
   * Get active provider instance.
   */
  getProvider() {
    return this._provider;
  }

  /**
   * 1. Multimodal Prescription Scanning
   * Returns a draft list of extracted medicines for user review.
   * Nothing is written to the database until user confirmation.
   * @param {{ buffer: Buffer, mimeType: string }} fileData
   */
  async scanPrescription(fileData) {
    return this._provider.scanPrescription(fileData);
  }

  /**
   * 2. Medication Interaction and Safety Analysis
   * Gathers active medications and evaluates drug-drug, timing, and duplicate conflicts.
   * @param {string} profileId
   */
  async checkInteractions(profileId) {
    const repo = getRepository();
    const activeMeds = await repo.listMedications(profileId, true);
    return this._provider.checkInteractions(activeMeds);
  }

  /**
   * 3. Adherence Insights
   * Analyzes recent dose history to provide compassionate behavioral insights.
   * @param {string} profileId
   */
  async getAdherenceInsight(profileId) {
    const repo = getRepository();
    const profile = await repo.getProfile(profileId);
    if (!profile) {
      throw AppError.notFound('Profile not found');
    }

    const medications = await repo.listMedications(profileId, true);
    const doseLogs = await repo.listDoseLogs(profileId, {});

    const distinctDays = new Set((doseLogs || []).map(getLogDate).filter(Boolean));

    if (!medications || medications.length === 0 || distinctDays.size < 3) {
      return {
        insight: 'Add medicines and track for a few days to see insights.',
        positiveNote:
          'Your personalized routine insights and schedule patterns will appear here once you have recorded a few days of doses.',
        recommendation: 'Keep logging your doses daily to unlock routine trends.'
      };
    }

    return this._provider.generateAdherenceInsight(doseLogs, medications);
  }

  /**
   * 4. Natural-Language Conversational Assistant
   * Translates spoken or typed user queries into structured actions.
   * For data-changing intents, requires an explicit confirmation step.
   * Respects caller permissions and never writes directly to the DB.
   *
   * @param {string} profileId
   * @param {object} actorUser - { memberId, role, permissions, name }
   * @param {{ message?: string, confirmed?: boolean, confirmationData?: object }} payload
   */
  async handleAssistantMessage(profileId, actorUser, { message, confirmed, confirmationData }) {
    const repo = getRepository();
    const profile = await repo.getProfile(profileId);
    if (!profile) {
      throw AppError.notFound('Profile not found');
    }

    // Branch A: User has confirmed a pending action
    if (confirmed === true && confirmationData) {
      return this._executeConfirmedAction(profileId, actorUser, confirmationData);
    }

    // Branch B: Parse message intent and return answer or confirmation request
    if (!message || typeof message !== 'string' || message.trim() === '') {
      throw AppError.badRequest('Message is required');
    }

    // Gather schedule context to assist intent resolution
    const todaySchedule = await scheduleService.getScheduleForDate(profileId);
    const context = {
      elderName: profile.elderName || profile.displayName,
      dosesToday: (todaySchedule.doses || []).map((d) => ({
        id: d.id,
        medicationName: d.medicationName,
        time: d.scheduledTime,
        status: d.status
      }))
    };

    const intent = await this._provider.parseAssistantIntent(message, context);

    const handler = this._intentHandlers()[intent.action];
    if (handler) {
      return handler.call(this, { profileId, actorUser, intent, todaySchedule });
    }
    return {
      action: 'unknown',
      reply:
        intent.reply ||
        "I'm your CareCircle assistant. You can ask what's due today, to mark a dose as taken, or to schedule a doctor appointment.",
      requiresConfirmation: false
    };
  }

  /**
   * Map of supported assistant intents to their handlers.
   * @private
   * @returns {Record<string, Function>}
   */
  _intentHandlers() {
    return {
      mark_taken: this._intentMarkTaken,
      add_appointment: this._intentAddAppointment,
      query_today: this._intentQueryToday,
      query_adherence: this._intentQueryAdherence
    };
  }

  /**
   * Prepare a confirmation to mark a pending dose as taken.
   * @private
   * @param {{profileId: string, actorUser: object, intent: object, todaySchedule: object}} ctx
   * @returns {object} Assistant response.
   */
  _intentMarkTaken({ actorUser, intent, todaySchedule }) {
    // Check permission
    if (
      actorUser.role !== ROLES.ELDER &&
      !actorUser.permissions?.canEditMeds &&
      !actorUser.permissions?.canViewMeds
    ) {
      return {
        action: 'permission_denied',
        reply: 'You do not have permission to log medication doses for this circle.',
        requiresConfirmation: false
      };
    }

    const matchedDose = findPendingDose(todaySchedule, intent.params?.medicationName);
    const medName = matchedDose?.medicationName || intent.params?.medicationName || 'Medication';
    const doseId = matchedDose?.id || null;
    const time = matchedDose?.scheduledTime || intent.params?.time || 'Scheduled dose';

    return {
      action: 'mark_taken',
      reply: `I can mark your ${time} dose of ${medName} as taken. Please confirm to record this dose.`,
      requiresConfirmation: true,
      confirmationData: {
        action: 'mark_taken',
        doseId,
        medicationName: medName,
        time
      }
    };
  }

  /**
   * Prepare a confirmation to add an appointment.
   * @private
   * @param {{profileId: string, actorUser: object, intent: object, todaySchedule: object}} ctx
   * @returns {object} Assistant response.
   */
  _intentAddAppointment({ actorUser, intent }) {
    // Check permission
    if (actorUser.role !== ROLES.ELDER && !actorUser.permissions?.canEditAppointments) {
      return {
        action: 'permission_denied',
        reply: 'You do not have permission to schedule appointments for this circle.',
        requiresConfirmation: false
      };
    }

    const doctorName = intent.params?.doctorName || 'Doctor';
    const specialty = intent.params?.specialty || 'General Consultation';
    const location = intent.params?.location || 'Clinic';
    const dateTime = intent.params?.dateTime || new Date(Date.now() + 86400000 * 2).toISOString();
    const notes = intent.params?.notes || 'Scheduled via CareCircle AI Assistant';

    return {
      action: 'add_appointment',
      reply: `I can schedule an appointment with Dr. ${doctorName} (${specialty}) on ${dateTime}. Please confirm to save.`,
      requiresConfirmation: true,
      confirmationData: {
        action: 'add_appointment',
        doctorName,
        specialty,
        location,
        dateTime,
        notes
      }
    };
  }

  /**
   * Answer "what's due today" from the schedule.
   * @private
   * @param {{profileId: string, actorUser: object, intent: object, todaySchedule: object}} ctx
   * @returns {object} Assistant response.
   */
  _intentQueryToday({ actorUser, todaySchedule }) {
    if (actorUser.role !== ROLES.ELDER && !actorUser.permissions?.canViewMeds) {
      return {
        action: 'permission_denied',
        reply: 'You do not have permission to view medications for this circle.',
        requiresConfirmation: false
      };
    }

    const total = (todaySchedule.doses || []).length;
    const taken = (todaySchedule.doses || []).filter((d) => d.status === 'taken').length;
    const pending = (todaySchedule.doses || []).filter((d) => d.status !== 'taken');

    let replyText = `Today you have ${total} scheduled dose(s) (${taken} taken so far).`;
    if (pending.length > 0) {
      const list = pending.map((d) => `${d.medicationName} (${d.scheduledTime})`).join(', ');
      replyText += ` Upcoming: ${list}.`;
    } else if (total > 0) {
      replyText += ' Wonderful! All scheduled medications for today have been completed.';
    } else {
      replyText = 'There are no medications scheduled for today.';
    }

    return {
      action: 'query_today',
      reply: replyText,
      requiresConfirmation: false,
      data: todaySchedule
    };
  }

  /**
   * Answer adherence questions from 7-day stats.
   * @private
   * @param {{profileId: string, actorUser: object, intent: object, todaySchedule: object}} ctx
   * @returns {Promise<object>} Assistant response.
   */
  async _intentQueryAdherence({ profileId, actorUser }) {
    if (actorUser.role !== ROLES.ELDER && !actorUser.permissions?.canViewAdherence) {
      return {
        action: 'permission_denied',
        reply: 'You do not have permission to view adherence statistics.',
        requiresConfirmation: false
      };
    }

    const stats = await scheduleService.getAdherenceStats(profileId);
    const rate = stats.sevenDay?.adherenceRate ?? 100;
    const taken = stats.sevenDay?.taken ?? 0;
    const total = stats.sevenDay?.total ?? 0;
    const streak = stats.streakDays ?? 0;

    const replyText = `Your 7-day medication adherence is ${rate}%. You have completed ${taken} of ${total} doses, with a ${streak}-day active streak!`;

    return {
      action: 'query_adherence',
      reply: replyText,
      requiresConfirmation: false,
      data: stats
    };
  }

  /**
   * Helper to execute user-confirmed actions safely through existing service layer.
   * @private
   */
  async _executeConfirmedAction(profileId, actorUser, confirmationData) {
    const { action } = confirmationData;

    if (action === 'mark_taken') {
      if (
        actorUser.role !== ROLES.ELDER &&
        !actorUser.permissions?.canEditMeds &&
        !actorUser.permissions?.canViewMeds
      ) {
        throw AppError.forbidden('Missing permission to record medication dose');
      }

      let doseId = confirmationData.doseId;
      if (!doseId) {
        // Resolve today's dose
        const todaySchedule = await scheduleService.getScheduleForDate(profileId);
        const requestedMedName = (confirmationData.medicationName || '').toLowerCase();
        const pendingDose = (todaySchedule.doses || []).find(
          (d) => d.status !== 'taken' && d.medicationName.toLowerCase().includes(requestedMedName)
        );
        if (pendingDose) {
          doseId = pendingDose.id;
        }
      }

      if (!doseId) {
        return {
          success: false,
          reply: `Could not locate a pending dose for ${confirmationData.medicationName || 'medication'} today. It may have already been recorded.`
        };
      }

      await scheduleService.recordDoseAction(profileId, actorUser, doseId, {
        status: 'taken',
        takenAt: new Date().toISOString()
      });

      return {
        success: true,
        action: 'mark_taken',
        reply: `✅ Successfully marked ${confirmationData.medicationName} as taken!`
      };
    }

    if (action === 'add_appointment') {
      if (actorUser.role !== ROLES.ELDER && !actorUser.permissions?.canEditAppointments) {
        throw AppError.forbidden('Missing permission to create appointment');
      }

      const created = await appointmentService.createAppointment(profileId, actorUser, {
        doctorName: confirmationData.doctorName,
        specialty: confirmationData.specialty,
        location: confirmationData.location,
        dateTime: confirmationData.dateTime,
        notes: confirmationData.notes || 'Created via AI Assistant'
      });

      return {
        success: true,
        action: 'add_appointment',
        reply: `✅ Appointment with Dr. ${confirmationData.doctorName} on ${confirmationData.dateTime} has been scheduled!`,
        data: created
      };
    }

    throw AppError.badRequest(`Unknown confirmation action: ${action}`);
  }
}

module.exports = new AIService();
