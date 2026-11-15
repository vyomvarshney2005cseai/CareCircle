const AppError = require('../errors/appError');
const { getRepository } = require('../repositories');
const {
  getLocalDateString,
  getLocalDayOfWeek,
  toScheduleIso,
  isDateWithinRange,
  getPastNDates
} = require('../utils/dateUtils');
const { recordAudit } = require('./auditService');
const logger = require('../utils/logger');

/**
 * Service generating daily medication schedules, recording doses, and computing adherence.
 */
class ScheduleService {
  /**
   * Get the schedule for a given date (defaults to today in profile timezone).
   * @param {string} profileId
   * @param {string} [targetDateStr=null] - "YYYY-MM-DD"
   */
  async getScheduleForDate(profileId, targetDateStr = null) {
    const repo = getRepository();
    const profile = await repo.getProfile(profileId);
    if (!profile) {
      throw AppError.notFound('Profile not found');
    }

    const tz = profile.timezone || 'Asia/Kolkata';
    const dateStr = targetDateStr || getLocalDateString(tz);
    const dayOfWeek = getLocalDayOfWeek(tz, new Date(`${dateStr}T12:00:00Z`));

    // 1. Fetch active medications for profile
    const allMeds = await repo.listMedications(profileId, false);
    const scheduledMeds = allMeds.filter((med) => {
      if (!med.active) return false;
      if (!isDateWithinRange(dateStr, med.startDate, med.endDate)) return false;
      if (!Array.isArray(med.daysOfWeek) || !med.daysOfWeek.includes(dayOfWeek)) return false;
      return true;
    });

    // 2. Fetch existing dose logs for today
    const existingLogs = await repo.listDoseLogs(profileId, {
      fromDate: `${dateStr}T00:00:00.000Z`,
      toDate: `${dateStr}T23:59:59.999Z`
    });

    // Map logs by deterministic key: `${medicationId}_${scheduledFor}`
    const logMap = new Map();
    for (const log of existingLogs) {
      const key = `${log.medicationId}_${log.scheduledFor}`;
      logMap.set(key, log);
      logMap.set(log.id, log);
    }

    // 3. Assemble unified doses list
    const doses = [];
    for (const med of scheduledMeds) {
      const times = Array.isArray(med.times) ? med.times : ['09:00'];
      for (const time of times) {
        const scheduledFor = toScheduleIso(dateStr, time);
        const deterministicKey = `${med.id}_${scheduledFor}`;
        const syntheticId = `dose_${med.id}_${dateStr}_${time.replace(':', '')}`;

        const existingLog = logMap.get(deterministicKey) || logMap.get(syntheticId);

        doses.push({
          id: existingLog ? existingLog.id : syntheticId,
          medicationId: med.id,
          medicationName: med.name,
          dosage: med.dosage,
          form: med.form,
          instructions: med.instructions,
          scheduledFor,
          scheduledTime: time,
          status: existingLog ? existingLog.status : 'pending',
          takenAt: existingLog ? existingLog.takenAt : null,
          recordedBy: existingLog ? existingLog.recordedBy : null,
          stockCount: med.stockCount,
          refillThreshold: med.refillThreshold,
          isLowStock: med.stockCount <= med.refillThreshold
        });
      }
    }

    // Sort doses chronologically by scheduled time
    doses.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    return {
      date: dateStr,
      timezone: tz,
      totalDoses: doses.length,
      completedDoses: doses.filter((d) => d.status === 'taken').length,
      doses
    };
  }

  /**
   * Record action on a dose (taken, skipped, snoozed).
   * Decrements medication stock if status is 'taken'.
   * @param {string} profileId
   * @param {object} actorUser
   * @param {string} doseIdentifier
   * @param {{ status: 'taken'|'skipped'|'snoozed', takenAt?: string }} actionData
   */
  async recordDoseAction(profileId, actorUser, doseIdentifier, { status, takenAt }) {
    const repo = getRepository();
    const profile = await repo.getProfile(profileId);
    if (!profile) {
      throw AppError.notFound('Profile not found');
    }

    let medicationId = null;
    let scheduledFor = null;

    // Check if an existing log exists with this id
    const existingLog = await repo.getDoseLog(profileId, doseIdentifier);
    if (existingLog) {
      medicationId = existingLog.medicationId;
      scheduledFor = existingLog.scheduledFor;
    } else if (doseIdentifier.startsWith('dose_')) {
      // Synthetic id format: dose_{medId}_{YYYY-MM-DD}_{HHmm}
      const parts = doseIdentifier.split('_');
      if (parts.length >= 4) {
        medicationId = parts[1];
        const dateStr = parts[2];
        const timeRaw = parts[3];
        const timeFormatted = `${timeRaw.slice(0, 2)}:${timeRaw.slice(2, 4)}`;
        scheduledFor = toScheduleIso(dateStr, timeFormatted);
      }
    }

    if (!medicationId) {
      throw AppError.badRequest('Invalid dose identifier');
    }

    const medication = await repo.getMedicationById(profileId, medicationId);
    if (!medication) {
      throw AppError.notFound('Associated medication not found');
    }

    // If previously not 'taken' and now marking 'taken', decrement stock
    const wasAlreadyTaken = existingLog && existingLog.status === 'taken';
    let updatedStock = medication.stockCount;

    if (status === 'taken' && !wasAlreadyTaken) {
      if (medication.stockCount > 0) {
        updatedStock = medication.stockCount - 1;
        await repo.updateMedication(profileId, medicationId, { stockCount: updatedStock });
      }
    } else if (wasAlreadyTaken && status !== 'taken') {
      // Reverting a taken dose restores stock
      updatedStock = medication.stockCount + 1;
      await repo.updateMedication(profileId, medicationId, { stockCount: updatedStock });
    }

    const logRecord = await repo.saveDoseLog(profileId, doseIdentifier, {
      medicationId,
      scheduledFor: scheduledFor || new Date().toISOString(),
      status,
      takenAt: status === 'taken' ? (takenAt || new Date().toISOString()) : null,
      recordedBy: actorUser.memberId
    });

    await recordAudit(profileId, {
      actorMemberId: actorUser.memberId,
      actorName: actorUser.name,
      action: `DOSE_${status.toUpperCase()}`,
      entity: 'dose',
      entityId: doseIdentifier,
      summary: `${actorUser.name} marked ${medication.name} as ${status}`
    });

    return {
      dose: logRecord,
      medication: {
        id: medication.id,
        name: medication.name,
        stockCount: updatedStock,
        refillThreshold: medication.refillThreshold,
        isLowStock: updatedStock <= medication.refillThreshold
      }
    };
  }

  /**
   * Compute adherence statistics for past 7 and 30 days.
   * Formula: (takenDoses / totalExpectedDoses) * 100
   * @param {string} profileId
   */
  async getAdherenceStats(profileId) {
    const repo = getRepository();
    const profile = await repo.getProfile(profileId);
    if (!profile) {
      throw AppError.notFound('Profile not found');
    }

    const tz = profile.timezone || 'Asia/Kolkata';
    const dates7 = getPastNDates(7, tz);
    const dates30 = getPastNDates(30, tz);

    const fromDate30 = `${dates30[0]}T00:00:00.000Z`;
    const toDate = `${dates7[dates7.length - 1]}T23:59:59.999Z`;

    const [allMeds, allLogs] = await Promise.all([
      repo.listMedications(profileId, false),
      repo.listDoseLogs(profileId, { fromDate: fromDate30, toDate })
    ]);

    // Map logs by date
    const logsByDate = new Map();
    for (const log of allLogs) {
      const dateSlice = (log.scheduledFor || '').slice(0, 10);
      if (!logsByDate.has(dateSlice)) logsByDate.set(dateSlice, []);
      logsByDate.get(dateSlice).push(log);
    }

    /**
     * Compute stats for a list of date strings.
     * @param {string[]} dates
     */
    function calculateForDates(dates) {
      let expectedCount = 0;
      let takenCount = 0;

      for (const dStr of dates) {
        const dObj = new Date(`${dStr}T12:00:00Z`);
        const dayOfWeek = getLocalDayOfWeek(tz, dObj);
        const dayLogs = logsByDate.get(dStr) || [];

        for (const med of allMeds) {
          if (!med.active) continue;
          if (!isDateWithinRange(dStr, med.startDate, med.endDate)) continue;
          if (!Array.isArray(med.daysOfWeek) || !med.daysOfWeek.includes(dayOfWeek)) continue;

          const doseTimes = Array.isArray(med.times) ? med.times.length : 1;
          expectedCount += doseTimes;
        }

        // Count doses taken on this date
        const takenOnDate = dayLogs.filter((l) => l.status === 'taken').length;
        takenCount += takenOnDate;
      }

      // Adherence percentage
      const rate = expectedCount > 0 ? Math.min(100, Math.round((takenCount / expectedCount) * 100)) : 100;
      return { expected: expectedCount, taken: takenCount, rate };
    }

    const stats7 = calculateForDates(dates7);
    const stats30 = calculateForDates(dates30);

    return {
      sevenDays: {
        rate: stats7.rate,
        taken: stats7.taken,
        expected: stats7.expected
      },
      thirtyDays: {
        rate: stats30.rate,
        taken: stats30.taken,
        expected: stats30.expected
      }
    };
  }
}

module.exports = new ScheduleService();
