const express = require('express');
const taskAuth = require('../middlewares/taskAuth');
const notificationService = require('../services/notificationService');

const router = express.Router();

router.use(taskAuth);

/**
 * Cloud Scheduler trigger: Proactive schedule & appointment reminders (every 5 min).
 */
router.post('/run-reminders', async (req, res, next) => {
  try {
    const result = await notificationService.runReminders();
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
});

/**
 * Cloud Scheduler trigger: Weekly adherence care digest.
 */
router.post('/weekly-digest', async (req, res, next) => {
  try {
    const result = await notificationService.runWeeklyDigest();
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
