const notificationService = require('../services/notificationService');

/**
 * Send a test reminder to verify email delivery.
 */
async function sendTestReminder(req, res, next) {
  try {
    const profileId = req.params.profileId || req.user.profileId;
    const result = await notificationService.sendTestReminder(profileId, req.user.email);
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

/**
 * List delivered notification history.
 */
async function listNotifications(req, res, next) {
  try {
    const profileId = req.params.profileId || req.user.profileId;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const history = await notificationService.getNotificationHistory(profileId, limit);
    return res.status(200).json({ data: history });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  sendTestReminder,
  listNotifications
};
