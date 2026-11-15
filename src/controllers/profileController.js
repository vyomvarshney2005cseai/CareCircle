const profileService = require('../services/profileService');
const { getAuditLogs } = require('../services/auditService');
const { updateSettingsSchema } = require('../utils/validators');

/**
 * Get profile details.
 */
async function getProfile(req, res, next) {
  try {
    const profile = await profileService.getProfile(req.params.profileId);
    return res.status(200).json({ data: profile });
  } catch (err) {
    return next(err);
  }
}

/**
 * Update profile settings (require approval, escalation, timezone).
 */
async function updateSettings(req, res, next) {
  try {
    const validated = updateSettingsSchema.parse(req.body);
    const updated = await profileService.updateSettings(req.params.profileId, req.user, validated);
    return res.status(200).json({ data: updated });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get profile activity audit logs.
 */
async function getProfileAuditLogs(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const logs = await getAuditLogs(req.params.profileId, limit);
    return res.status(200).json({ data: logs });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getProfile,
  updateSettings,
  getProfileAuditLogs
};
