const { getRepository } = require('../repositories');
const logger = require('../utils/logger');

/**
 * Notification Service extension point for CareCircle.
 * Handles proactive email/SMS reminders, missed doses, and upcoming appointments.
 * Built with deterministic idempotency keys to ensure a reminder is never sent twice.
 */
class NotificationService {
  /**
   * Deterministic idempotency key for notification events.
   * @param {string} type - e.g., 'DOSE_REMINDER', 'MISSED_DOSE', 'UPCOMING_APPOINTMENT'
   * @param {string} entityId - e.g. medicationId or appointmentId
   * @param {string} scheduledIso - ISO date string of target event
   * @param {string} targetMemberId - recipient member ID
   * @returns {string} deterministic key
   */
  static generateIdempotencyKey(type, entityId, scheduledIso, targetMemberId) {
    const dateSlice = scheduledIso.replace(/[^a-zA-Z0-9]/g, '');
    return `${type}_${entityId}_${dateSlice}_${targetMemberId}`;
  }

  /**
   * Send a dose reminder if not already sent.
   * @param {string} profileId
   * @param {{
   *   type: string,
   *   targetMemberId: string,
   *   targetEmail: string,
   *   entityId: string,
   *   scheduledIso: string,
   *   payload: Record<string, unknown>
   * }} params
   */
  async sendIdempotentNotification(profileId, { type, targetMemberId, targetEmail, entityId, scheduledIso, payload }) {
    const key = NotificationService.generateIdempotencyKey(type, entityId, scheduledIso, targetMemberId);
    const repo = getRepository();

    const existing = await repo.getNotification(profileId, key);
    if (existing) {
      logger.debug({ key, profileId }, 'Notification already delivered; skipping due to idempotency');
      return { sent: false, duplicate: true, key };
    }

    // Clean extension point for real email/SMS transport (e.g. SendGrid, Mailgun, GCP Cloud Tasks)
    logger.info({ profileId, targetEmail, type, key, payload }, '[Extension Point] Proactive notification dispatched');

    await repo.saveNotification(profileId, key, {
      type,
      targetMemberId,
      targetEmail,
      entityId,
      scheduledIso,
      payload,
      sentAt: new Date().toISOString()
    });

    return { sent: true, duplicate: false, key };
  }
}

module.exports = new NotificationService();
