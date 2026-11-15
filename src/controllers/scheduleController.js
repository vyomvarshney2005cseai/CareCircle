const scheduleService = require('../services/scheduleService');
const { doseActionSchema } = require('../utils/validators');

/**
 * Get daily medication schedule.
 */
async function getTodaySchedule(req, res, next) {
  try {
    const targetDate = req.query.date || null;
    const schedule = await scheduleService.getScheduleForDate(req.params.profileId, targetDate);
    return res.status(200).json({ data: schedule });
  } catch (err) {
    return next(err);
  }
}

/**
 * Record action on a scheduled dose (taken, skipped, snoozed).
 */
async function recordDoseAction(req, res, next) {
  try {
    const validated = doseActionSchema.parse(req.body);
    const result = await scheduleService.recordDoseAction(
      req.params.profileId,
      req.user,
      req.params.doseId,
      validated
    );
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get adherence statistics (7-day and 30-day percentage).
 */
async function getAdherence(req, res, next) {
  try {
    const stats = await scheduleService.getAdherenceStats(req.params.profileId);
    return res.status(200).json({ data: stats });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getTodaySchedule,
  recordDoseAction,
  getAdherence
};
