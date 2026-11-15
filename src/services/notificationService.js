const { DateTime } = require('luxon');
const { getRepository } = require('../repositories');
const { sendWithRetry } = require('./mailer');
const templates = require('./mailer/templates');
const aiService = require('./aiService');
const { isDateWithinRange } = require('../utils/dateUtils');
const logger = require('../utils/logger');
const { ROLES } = require('../constants/roles');

/**
 * Whether a medication is scheduled on the given date.
 * @param {object} med Medication record.
 * @param {string} dateStr YYYY-MM-DD in the profile timezone.
 * @param {number} dayOfWeek 0=Sun..6=Sat.
 * @returns {boolean}
 */
function isScheduledOn(med, dateStr, dayOfWeek) {
  return (
    isDateWithinRange(dateStr, med.startDate, med.endDate) &&
    Array.isArray(med.daysOfWeek) &&
    med.daysOfWeek.includes(dayOfWeek)
  );
}

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
      logger.debug(
        { profileId, idempotencyKey },
        'Notification skipped due to deterministic idempotency key'
      );
      return { sent: false, duplicate: true, key: idempotencyKey };
    }

    // Atomically pre-record the idempotency key to prevent race conditions during concurrent scheduler ticks
    await repo.saveNotification(profileId, idempotencyKey, {
      key: idempotencyKey,
      profileId,
      targetEmail: mailOptions.to,
      subject: mailOptions.subject,
      type: meta.type || 'REMINDER',
      entityId: meta.entityId || null,
      status: 'sending',
      sentAt: new Date().toISOString()
    });

    try {
      // Dispatch via mailer with 3-attempt exponential backoff
      const sendResult = await sendWithRetry(mailOptions);

      // Finalize notification record with delivery message ID
      await repo.saveNotification(profileId, idempotencyKey, {
        key: idempotencyKey,
        profileId,
        targetEmail: mailOptions.to,
        subject: mailOptions.subject,
        type: meta.type || 'REMINDER',
        entityId: meta.entityId || null,
        messageId: sendResult?.messageId,
        status: 'delivered',
        sentAt: new Date().toISOString()
      });

      logger.info(
        { profileId, key: idempotencyKey, to: mailOptions.to },
        'Proactive notification delivered successfully'
      );
      return { sent: true, duplicate: false, key: idempotencyKey };
    } catch (err) {
      // If delivery failed after all retry attempts, release the key so subsequent runs can retry
      await repo.deleteNotification(profileId, idempotencyKey);
      throw err;
    }
  }

  /**
   * Execute proactive reminders across all profiles.
   * Called by Cloud Scheduler every 5 minutes.
   * @param {DateTime} [refTime=null] - Optional reference time for testing
   */
  async runReminders(refTime = null) {
    const repo = getRepository();
    const profiles = await repo.listProfiles();
    const totals = { sent: 0, missed: 0 };

    for (const profile of profiles) {
      const result = await this._processProfileReminders(repo, profile, refTime);
      totals.sent += result.sent;
      totals.missed += result.missed;
    }

    return {
      status: 'completed',
      processedProfiles: profiles.length,
      dispatchedCount: totals.sent,
      markedMissedCount: totals.missed
    };
  }

  /**
   * Run every reminder rule (doses, refills, appointments) for one profile.
   * @private
   * @param {object} repo Repository instance.
   * @param {object} profile Elder profile.
   * @param {DateTime|null} refTime Optional reference time (tests).
   * @returns {Promise<{sent:number, missed:number}>}
   */
  async _processProfileReminders(repo, profile, refTime) {
    const tz = profile.timezone || 'Asia/Kolkata';
    const localNow = refTime ? refTime.setZone(tz) : DateTime.now().setZone(tz);

    const members = await repo.listMembers(profile.id);
    const elder = members.find((m) => m.role === ROLES.ELDER && m.active);
    if (!elder) return { sent: 0, missed: 0 };

    const ctx = {
      repo,
      profile,
      tz,
      localNow,
      todayStr: localNow.toFormat('yyyy-MM-dd'),
      elder,
      alertMembers: members.filter((m) => m.active && m.permissions && m.permissions.receiveAlerts),
      missedAfterMin: profile.settings?.escalationMinutes?.missedAfter || 30,
      alertAfterMin: profile.settings?.escalationMinutes?.alertCaretakerAfter || 60,
      sent: 0,
      missed: 0
    };

    await this._processMedicationReminders(ctx);
    await this._processAppointmentReminders(ctx);
    return { sent: ctx.sent, missed: ctx.missed };
  }

  /**
   * Evaluate scheduled doses across yesterday/today/tomorrow (midnight carry-over)
   * using one batched dose-log read per profile to avoid N+1 queries.
   * @private
   * @param {object} ctx Per-profile reminder context.
   */
  async _processMedicationReminders(ctx) {
    const { repo, profile, localNow, tz } = ctx;
    const medications = await repo.listMedications(profile.id, true);
    const checkDates = [-1, 0, 1].map((d) => localNow.plus({ days: d }).toFormat('yyyy-MM-dd'));

    const windowDoseLogs = await repo.listDoseLogs(profile.id, {
      fromDate: `${checkDates[0]}T00:00:00.000Z`,
      toDate: `${checkDates[checkDates.length - 1]}T23:59:59.999Z`
    });
    ctx.doseLogMap = new Map();
    windowDoseLogs.forEach((l) => {
      if (l.id) ctx.doseLogMap.set(l.id, l);
      if (l.medicationId && l.scheduledFor) {
        ctx.doseLogMap.set(`${l.medicationId}_${l.scheduledFor}`, l);
      }
    });

    for (const dateStr of checkDates) {
      const dayOfWeek = DateTime.fromISO(dateStr, { zone: tz }).weekday % 7; // 0=Sun..6=Sat
      for (const med of medications) {
        if (!isScheduledOn(med, dateStr, dayOfWeek)) continue;
        const times = Array.isArray(med.times) ? med.times : ['09:00'];
        for (const time of times) {
          await this._processDose(ctx, med, dateStr, time);
        }
        await this._sendRefillAlert(ctx, med);
      }
    }
  }

  /**
   * Apply upcoming / missed / escalation rules to a single scheduled dose.
   * @private
   */
  async _processDose(ctx, med, dateStr, time) {
    const scheduled = DateTime.fromFormat(`${dateStr} ${time}`, 'yyyy-MM-dd HH:mm', {
      zone: ctx.tz
    });
    const diffMinutes = ctx.localNow.diff(scheduled, 'minutes').minutes;
    // Only evaluate doses inside the active window around now
    if (diffMinutes < -30 || diffMinutes > 240) return;

    const dose = {
      med,
      time,
      scheduledIso: scheduled.toISO(),
      syntheticId: `dose_${med.id}_${dateStr}_${time.replace(':', '')}`
    };
    dose.logKey = `${med.id}_${dose.scheduledIso}`;
    dose.existingLog = ctx.doseLogMap.get(dose.syntheticId) || ctx.doseLogMap.get(dose.logKey);
    const status = dose.existingLog ? dose.existingLog.status : 'pending';

    if (diffMinutes >= -15 && diffMinutes < 0 && status === 'pending') {
      await this._sendUpcomingDose(ctx, dose);
    }
    if (
      diffMinutes >= ctx.missedAfterMin &&
      diffMinutes < ctx.alertAfterMin &&
      status === 'pending'
    ) {
      await this._markMissedAndNotify(ctx, dose);
    }
    if (diffMinutes >= ctx.alertAfterMin && status !== 'taken') {
      await this._escalateMissedDose(ctx, dose);
    }
  }

  /** @private Remind the elder 15 minutes before a dose. */
  async _sendUpcomingDose(ctx, { med, time, scheduledIso }) {
    const { elder } = ctx;
    const key = NotificationService.generateIdempotencyKey(
      'DOSE_UPCOMING',
      med.id,
      scheduledIso,
      elder.id
    );
    const tpl = templates.upcomingDoseTemplate({
      elderName: elder.name,
      medName: med.name,
      dosage: med.dosage,
      scheduledTime: time,
      instructions: med.instructions
    });
    await this._dispatch(ctx, {
      key,
      to: elder.email,
      tpl,
      type: 'DOSE_UPCOMING',
      entityId: med.id
    });
  }

  /** @private Mark a pending dose as missed and email the elder. */
  async _markMissedAndNotify(ctx, dose) {
    const { repo, profile, elder } = ctx;
    const { med, time, scheduledIso } = dose;
    const savedRecord = await repo.saveDoseLog(
      profile.id,
      dose.existingLog?.id || dose.syntheticId,
      {
        medicationId: med.id,
        scheduledFor: scheduledIso,
        status: 'missed',
        recordedBy: 'system-reminder'
      }
    );
    ctx.doseLogMap.set(dose.syntheticId, savedRecord);
    ctx.doseLogMap.set(dose.logKey, savedRecord);
    ctx.missed += 1;

    const key = NotificationService.generateIdempotencyKey(
      'DOSE_MISSED',
      med.id,
      scheduledIso,
      elder.id
    );
    const tpl = templates.missedDoseTemplate({
      elderName: elder.name,
      medName: med.name,
      dosage: med.dosage,
      scheduledTime: time
    });
    await this._dispatch(ctx, {
      key,
      to: elder.email,
      tpl,
      type: 'DOSE_MISSED',
      entityId: med.id
    });
  }

  /** @private Alert caretakers/family when a dose is still not taken. */
  async _escalateMissedDose(ctx, { med, time, scheduledIso }) {
    const { elder } = ctx;
    for (const member of ctx.alertMembers) {
      if (member.id === elder.id) continue; // elder already got the missed-dose email
      const key = NotificationService.generateIdempotencyKey(
        'DOSE_ESCALATION',
        med.id,
        scheduledIso,
        member.id
      );
      const tpl = templates.escalationAlertTemplate({
        memberName: member.name,
        elderName: elder.name,
        medName: med.name,
        dosage: med.dosage,
        scheduledTime: time
      });
      await this._dispatch(ctx, {
        key,
        to: member.email,
        tpl,
        type: 'DOSE_ESCALATION',
        entityId: med.id
      });
    }
  }

  /** @private Refill alert, at most once per day, when stock is at/below threshold. */
  async _sendRefillAlert(ctx, med) {
    if (med.stockCount > med.refillThreshold) return;
    const { elder } = ctx;
    const tpl = templates.refillAlertTemplate({
      memberName: elder.name,
      elderName: elder.name,
      medName: med.name,
      stockCount: med.stockCount,
      refillThreshold: med.refillThreshold
    });
    const key = `REFILL_${med.id}_${ctx.todayStr}_${elder.id}`;
    await this._dispatch(ctx, {
      key,
      to: elder.email,
      tpl,
      type: 'REFILL_ALERT',
      entityId: med.id
    });
  }

  /**
   * Appointment reminders 24 hours and 2 hours before the visit.
   * @private
   * @param {object} ctx Per-profile reminder context.
   */
  async _processAppointmentReminders(ctx) {
    const { repo, profile, tz, localNow, elder } = ctx;
    const appointments = await repo.listAppointments(profile.id);
    const recipients = [elder, ...ctx.alertMembers.filter((m) => m.id !== elder.id)];

    for (const appt of appointments) {
      if (appt.status !== 'scheduled') continue;
      const apptTime = DateTime.fromISO(appt.dateTime, { zone: tz });
      const hoursUntil = apptTime.diff(localNow, 'hours').hours;
      const minutesUntil = apptTime.diff(localNow, 'minutes').minutes;

      if (hoursUntil >= 23 && hoursUntil <= 25) {
        await this._sendAppointmentReminder(ctx, appt, apptTime, recipients, 24);
      }
      if (minutesUntil >= 110 && minutesUntil <= 130) {
        await this._sendAppointmentReminder(ctx, appt, apptTime, recipients, 2);
      }
    }
  }

  /** @private Send one appointment reminder window to every recipient. */
  async _sendAppointmentReminder(ctx, appt, apptTime, recipients, hoursBefore) {
    const type = hoursBefore === 24 ? 'APPT_24H' : 'APPT_2H';
    for (const member of recipients) {
      const key = NotificationService.generateIdempotencyKey(
        type,
        appt.id,
        appt.dateTime,
        member.id
      );
      const tpl = templates.appointmentReminderTemplate({
        memberName: member.name,
        elderName: ctx.elder.name,
        doctorName: appt.doctorName,
        specialty: appt.specialty,
        location: appt.location,
        formattedDateTime: apptTime.toFormat('ffff'),
        hoursBefore
      });
      await this._dispatch(ctx, { key, to: member.email, tpl, type, entityId: appt.id });
    }
  }

  /** @private Idempotent send that updates the per-profile sent counter. */
  async _dispatch(ctx, { key, to, tpl, type, entityId }) {
    const res = await this.sendIdempotent(ctx.profile.id, key, { to, ...tpl }, { type, entityId });
    if (res.sent) ctx.sent += 1;
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

      const caretakersAndFamily = members.filter(
        (m) => m.active && m.role !== ROLES.ELDER && m.permissions?.receiveAlerts
      );
      if (caretakersAndFamily.length === 0) continue;

      // Calculate 7-day adherence stats
      const doseLogs = await repo.listDoseLogs(profile.id, {
        fromDate: `${weekStartStr}T00:00:00.000Z`,
        toDate: `${weekEndStr}T23:59:59.999Z`
      });

      const takenDoses = doseLogs.filter((l) => l.status === 'taken').length;
      const missedDoses = doseLogs.filter((l) => l.status === 'missed').length;
      const totalRecorded = takenDoses + missedDoses;
      const adherenceRate =
        totalRecorded > 0 ? Math.round((takenDoses / totalRecorded) * 100) : 100;

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
        return (
          apptDate >= weekEndStr && apptDate <= localNow.plus({ days: 7 }).toFormat('yyyy-MM-dd')
        );
      });

      // AI Adherence Insight
      let aiInsight = null;
      try {
        const insightResult = await aiService.getAdherenceInsight(profile.id);
        aiInsight = insightResult?.insight || null;
      } catch (err) {
        logger.warn(
          { err: err.message, profileId: profile.id },
          'Could not generate AI insight for weekly digest'
        );
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

        const res = await this.sendIdempotent(
          profile.id,
          digestKey,
          { to: member.email, ...tpl },
          { type: 'WEEKLY_DIGEST' }
        );
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
