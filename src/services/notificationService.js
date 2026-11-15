const { DateTime } = require('luxon');
const { getRepository } = require('../repositories');
const { sendWithRetry } = require('./mailer');
const templates = require('./mailer/templates');
const aiService = require('./aiService');
const { isDateWithinRange } = require('../utils/dateUtils');
const logger = require('../utils/logger');
const { ROLES } = require('../constants/roles');

/**
 * Notification Service managing proactive schedule reminders, escalations,
 * appointment alerts, refill warnings, and weekly digests.
 */
class NotificationService {
  /**
   * Deterministic idempotency key for notification events.
   * @param {string} type
   * @param {string} entityId
   * @param {string} scheduledIsoOrDate
   * @param {string} targetMemberId
   * @returns {string}
   */
  static generateIdempotencyKey(type, entityId, scheduledIsoOrDate, targetMemberId) {
    const cleanDate = (scheduledIsoOrDate || '').replace(/[^a-zA-Z0-9]/g, '');
    return `${type}_${entityId}_${cleanDate}_${targetMemberId}`;
  }

  /**
   * Send an email if not already sent (enforcing idempotency).
   * @param {string} profileId
   * @param {string} idempotencyKey
   * @param {{ to: string, subject: string, html: string, text: string }} mailOptions
   * @param {object} meta
   */
  async sendIdempotent(profileId, idempotencyKey, mailOptions, meta = {}) {
    const repo = getRepository();
    const existing = await repo.getNotification(profileId, idempotencyKey);
    if (existing) {
      logger.debug({ profileId, idempotencyKey }, 'Notification skipped due to deterministic idempotency key');
      return { sent: false, duplicate: true, key: idempotencyKey };
    }

    // Dispatch via mailer with 3-attempt exponential backoff
    const sendResult = await sendWithRetry(mailOptions);

    // Save notification record
    await repo.saveNotification(profileId, idempotencyKey, {
      key: idempotencyKey,
      profileId,
      targetEmail: mailOptions.to,
      subject: mailOptions.subject,
      type: meta.type || 'REMINDER',
      entityId: meta.entityId || null,
      messageId: sendResult?.messageId,
      sentAt: new Date().toISOString()
    });

    logger.info({ profileId, key: idempotencyKey, to: mailOptions.to }, 'Proactive notification delivered successfully');
    return { sent: true, duplicate: false, key: idempotencyKey };
  }

  /**
   * Execute proactive reminders across all profiles.
   * Called by Cloud Scheduler every 5 minutes.
   * @param {DateTime} [refTime=null] - Optional reference time for testing
   */
  async runReminders(refTime = null) {
    const repo = getRepository();
    const profiles = await repo.listProfiles();
    let sentCount = 0;
    let missedCount = 0;

    for (const profile of profiles) {
      const tz = profile.timezone || 'Asia/Kolkata';
      const localNow = refTime ? refTime.setZone(tz) : DateTime.now().setZone(tz);
      const todayStr = localNow.toFormat('yyyy-MM-dd');

      // Fetch profile members
      const members = await repo.listMembers(profile.id);
      const elder = members.find((m) => m.role === ROLES.ELDER && m.active);
      if (!elder) continue;

      const alertMembers = members.filter((m) => m.active && m.permissions && m.permissions.receiveAlerts);

      // Escalation thresholds
      const missedAfterMin = profile.settings?.escalationMinutes?.missedAfter || 30;
      const alertAfterMin = profile.settings?.escalationMinutes?.alertCaretakerAfter || 60;

      // 1. Process Medications & Doses for both yesterday (for midnight carryover) and today
      const medications = await repo.listMedications(profile.id, true);

      // Check dates surrounding localNow to cover midnight boundaries: [yesterday, today, tomorrow]
      const checkDates = [
        localNow.minus({ days: 1 }).toFormat('yyyy-MM-dd'),
        localNow.toFormat('yyyy-MM-dd'),
        localNow.plus({ days: 1 }).toFormat('yyyy-MM-dd')
      ];

      // Efficiency Optimization: Batch fetch dose logs for the entire active 3-day window once per profile
      // Avoids N+1 database round-trips inside nested med/time loops
      const minDateStr = checkDates[0];
      const maxDateStr = checkDates[checkDates.length - 1];
      const windowDoseLogs = await repo.listDoseLogs(profile.id, {
        fromDate: `${minDateStr}T00:00:00.000Z`,
        toDate: `${maxDateStr}T23:59:59.999Z`
      });

      const doseLogMap = new Map();
      windowDoseLogs.forEach((l) => {
        if (l.id) doseLogMap.set(l.id, l);
        if (l.medicationId && l.scheduledFor) {
          doseLogMap.set(`${l.medicationId}_${l.scheduledFor}`, l);
        }
      });

      for (const dateStr of checkDates) {
        const dateObj = DateTime.fromISO(dateStr, { zone: tz });
        const dayOfWeek = dateObj.weekday % 7; // Luxon: 1=Mon..7=Sun -> 0=Sun..6=Sat

        for (const med of medications) {
          if (!isDateWithinRange(dateStr, med.startDate, med.endDate)) continue;
          if (!Array.isArray(med.daysOfWeek) || !med.daysOfWeek.includes(dayOfWeek)) continue;

          const times = Array.isArray(med.times) ? med.times : ['09:00'];
          for (const time of times) {
            // Construct scheduled datetime precisely in the profile timezone
            const scheduledDateTime = DateTime.fromFormat(`${dateStr} ${time}`, 'yyyy-MM-dd HH:mm', { zone: tz });
            const scheduledIso = scheduledDateTime.toISO();

            // Time difference in minutes from scheduled time to localNow (positive = minutes past schedule)
            const diffMinutes = localNow.diff(scheduledDateTime, 'minutes').minutes;

            // Only evaluate doses within an active 4-hour window around localNow
            if (diffMinutes < -30 || diffMinutes > 240) {
              continue;
            }

            // Fetch or synthesize dose log status from in-memory batch map (O(1) lookup)
            const syntheticId = `dose_${med.id}_${dateStr}_${time.replace(':', '')}`;
            const deterministicLogKey = `${med.id}_${scheduledIso}`;

            const existingLog = doseLogMap.get(syntheticId) || doseLogMap.get(deterministicLogKey);
            const status = existingLog ? existingLog.status : 'pending';

            // --- A. UPCOMING DOSE REMINDER (15 minutes before schedule) ---
            if (diffMinutes >= -15 && diffMinutes < 0 && status === 'pending') {
              const key = NotificationService.generateIdempotencyKey('DOSE_UPCOMING', med.id, scheduledIso, elder.id);
              const tpl = templates.upcomingDoseTemplate({
                elderName: elder.name,
                medName: med.name,
                dosage: med.dosage,
                scheduledTime: time,
                instructions: med.instructions
              });

              const res = await this.sendIdempotent(profile.id, key, { to: elder.email, ...tpl }, { type: 'DOSE_UPCOMING', entityId: med.id });
              if (res.sent) sentCount += 1;
            }

            // --- B. MISSED DOSE REMINDER (30 min after schedule, mark missed) ---
            if (diffMinutes >= missedAfterMin && diffMinutes < alertAfterMin && status === 'pending') {
              // Update status to 'missed' in repository and cache
              const savedRecord = await repo.saveDoseLog(profile.id, existingLog?.id || syntheticId, {
                medicationId: med.id,
                scheduledFor: scheduledIso,
                status: 'missed',
                recordedBy: 'system-reminder'
              });
              doseLogMap.set(syntheticId, savedRecord);
              doseLogMap.set(deterministicLogKey, savedRecord);
              missedCount += 1;

              const key = NotificationService.generateIdempotencyKey('DOSE_MISSED', med.id, scheduledIso, elder.id);
              const tpl = templates.missedDoseTemplate({
                elderName: elder.name,
                medName: med.name,
                dosage: med.dosage,
                scheduledTime: time
              });

              const res = await this.sendIdempotent(profile.id, key, { to: elder.email, ...tpl }, { type: 'DOSE_MISSED', entityId: med.id });
              if (res.sent) sentCount += 1;
            }

            // --- C. ESCALATION ALERT (60 min after schedule, alert caretakers & family) ---
            if (diffMinutes >= alertAfterMin && status !== 'taken') {
              for (const member of alertMembers) {
                // If member is the elder, skip since they already received the missed dose email
                if (member.id === elder.id) continue;

                const key = NotificationService.generateIdempotencyKey('DOSE_ESCALATION', med.id, scheduledIso, member.id);
                const tpl = templates.escalationAlertTemplate({
                  memberName: member.name,
                  elderName: elder.name,
                  medName: med.name,
                  dosage: med.dosage,
                  scheduledTime: time
                });

                const res = await this.sendIdempotent(profile.id, key, { to: member.email, ...tpl }, { type: 'DOSE_ESCALATION', entityId: med.id });
                if (res.sent) sentCount += 1;
              }
            }
          }

          // --- D. REFILL ALERT (once per day max if stock <= threshold) ---
          if (med.stockCount <= med.refillThreshold) {
            const refillKey = `REFILL_${med.id}_${todayStr}_${elder.id}`;
            const tpl = templates.refillAlertTemplate({
              memberName: elder.name,
              elderName: elder.name,
              medName: med.name,
              stockCount: med.stockCount,
              refillThreshold: med.refillThreshold
            });
            const res = await this.sendIdempotent(profile.id, refillKey, { to: elder.email, ...tpl }, { type: 'REFILL_ALERT', entityId: med.id });
            if (res.sent) sentCount += 1;
          }
        }
      }

      // --- E. DOCTOR APPOINTMENTS (24 hours and 2 hours before) ---
      const appointments = await repo.listAppointments(profile.id);
      for (const appt of appointments) {
        if (appt.status !== 'scheduled') continue;
        const apptTime = DateTime.fromISO(appt.dateTime, { zone: tz });
        const hoursUntil = apptTime.diff(localNow, 'hours').hours;
        const minutesUntil = apptTime.diff(localNow, 'minutes').minutes;

        const recipients = [elder, ...alertMembers.filter((m) => m.id !== elder.id)];

        // 24-hour reminder window: between 23h and 25h ahead
        if (hoursUntil >= 23 && hoursUntil <= 25) {
          for (const member of recipients) {
            const key = NotificationService.generateIdempotencyKey('APPT_24H', appt.id, appt.dateTime, member.id);
            const tpl = templates.appointmentReminderTemplate({
              memberName: member.name,
              elderName: elder.name,
              doctorName: appt.doctorName,
              specialty: appt.specialty,
              location: appt.location,
              formattedDateTime: apptTime.toFormat('ffff'),
              hoursBefore: 24
            });
            const res = await this.sendIdempotent(profile.id, key, { to: member.email, ...tpl }, { type: 'APPT_24H', entityId: appt.id });
            if (res.sent) sentCount += 1;
          }
        }

        // 2-hour reminder window: between 110m and 130m ahead
        if (minutesUntil >= 110 && minutesUntil <= 130) {
          for (const member of recipients) {
            const key = NotificationService.generateIdempotencyKey('APPT_2H', appt.id, appt.dateTime, member.id);
            const tpl = templates.appointmentReminderTemplate({
              memberName: member.name,
              elderName: elder.name,
              doctorName: appt.doctorName,
              specialty: appt.specialty,
              location: appt.location,
              formattedDateTime: apptTime.toFormat('ffff'),
              hoursBefore: 2
            });
            const res = await this.sendIdempotent(profile.id, key, { to: member.email, ...tpl }, { type: 'APPT_2H', entityId: appt.id });
            if (res.sent) sentCount += 1;
          }
        }
      }
    }

    return {
      status: 'completed',
      processedProfiles: profiles.length,
      dispatchedCount: sentCount,
      markedMissedCount: missedCount
    };
  }

  /**
   * Weekly adherence digest sent to caretakers and family members.
   * Called by Cloud Scheduler weekly.
   * @param {DateTime} [refTime=null]
   */
  async runWeeklyDigest(refTime = null) {
    const repo = getRepository();
    const profiles = await repo.listProfiles();
    let sentCount = 0;

    for (const profile of profiles) {
      const tz = profile.timezone || 'Asia/Kolkata';
      const localNow = refTime ? refTime.setZone(tz) : DateTime.now().setZone(tz);
      const weekStartStr = localNow.minus({ days: 7 }).toFormat('yyyy-MM-dd');
      const weekEndStr = localNow.toFormat('yyyy-MM-dd');
      const periodStr = `${weekStartStr} to ${weekEndStr}`;

      const members = await repo.listMembers(profile.id);
      const elder = members.find((m) => m.role === ROLES.ELDER);
      if (!elder) continue;

      const caretakersAndFamily = members.filter((m) => m.active && m.role !== ROLES.ELDER && m.permissions?.receiveAlerts);
      if (caretakersAndFamily.length === 0) continue;

      // Calculate 7-day adherence stats
      const doseLogs = await repo.listDoseLogs(profile.id, {
        fromDate: `${weekStartStr}T00:00:00.000Z`,
        toDate: `${weekEndStr}T23:59:59.999Z`
      });

      const takenDoses = doseLogs.filter((l) => l.status === 'taken').length;
      const missedDoses = doseLogs.filter((l) => l.status === 'missed').length;
      const totalRecorded = takenDoses + missedDoses;
      const adherenceRate = totalRecorded > 0 ? Math.round((takenDoses / totalRecorded) * 100) : 100;

      // Compute streak (consecutive days with 0 missed doses)
      let streak = 0;
      for (let i = 0; i < 7; i += 1) {
        const checkDay = localNow.minus({ days: i }).toFormat('yyyy-MM-dd');
        const dayLogs = doseLogs.filter((l) => (l.scheduledFor || '').startsWith(checkDay));
        const hasMissed = dayLogs.some((l) => l.status === 'missed');
        if (!hasMissed && dayLogs.length > 0) {
          streak += 1;
        } else if (hasMissed) {
          break;
        }
      }

      // Upcoming appointments in the next 7 days
      const allAppts = await repo.listAppointments(profile.id);
      const upcomingAppts = allAppts.filter((a) => {
        if (a.status !== 'scheduled') return false;
        const apptDate = a.dateTime.slice(0, 10);
        return apptDate >= weekEndStr && apptDate <= localNow.plus({ days: 7 }).toFormat('yyyy-MM-dd');
      });

      // AI Adherence Insight
      let aiInsight = null;
      try {
        const insightResult = await aiService.getAdherenceInsight(profile.id);
        aiInsight = insightResult?.insight || null;
      } catch (err) {
        logger.warn({ err: err.message, profileId: profile.id }, 'Could not generate AI insight for weekly digest');
      }

      for (const member of caretakersAndFamily) {
        const digestKey = `DIGEST_${profile.id}_${weekStartStr}_${member.id}`;
        const tpl = templates.weeklyDigestTemplate({
          memberName: member.name,
          elderName: elder.name,
          periodStr,
          totalDoses: totalRecorded,
          takenDoses,
          missedDoses,
          adherenceRate,
          streakDays: streak,
          upcomingAppts,
          aiInsight
        });

        const res = await this.sendIdempotent(profile.id, digestKey, { to: member.email, ...tpl }, { type: 'WEEKLY_DIGEST' });
        if (res.sent) sentCount += 1;
      }
    }

    return {
      status: 'completed',
      processedProfiles: profiles.length,
      dispatchedCount: sentCount
    };
  }

  /**
   * Dispatch a test reminder for an elder to verify email connectivity.
   * @param {string} profileId
   * @param {string} [targetEmail=null]
   */
  async sendTestReminder(profileId, targetEmail = null) {
    const repo = getRepository();
    const profile = await repo.getProfile(profileId);
    const members = await repo.listMembers(profileId);
    const elder = members.find((m) => m.role === ROLES.ELDER);

    const email = targetEmail || elder?.email || profile?.elderEmail;
    const name = elder?.name || profile?.elderName || 'Elder';

    const tpl = templates.testReminderTemplate({ elderName: name });
    const key = `TEST_REMINDER_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    return this.sendIdempotent(profileId, key, { to: email, ...tpl }, { type: 'TEST_REMINDER' });
  }

  /**
   * List notification history for a profile.
   * @param {string} profileId
   * @param {number} [limit=50]
   */
  async getNotificationHistory(profileId, limit = 50) {
    const repo = getRepository();
    return repo.listNotifications(profileId, limit);
  }
}

module.exports = new NotificationService();
