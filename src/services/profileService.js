const AppError = require('../errors/appError');
const { getRepository } = require('../repositories');
const { recordAudit } = require('./auditService');

/**
 * Get profile details by ID.
 * @param {string} profileId
 */
async function getProfile(profileId) {
  const repo = getRepository();
  const profile = await repo.getProfile(profileId);
  if (!profile) {
    throw AppError.notFound('Profile not found');
  }
  return profile;
}

/**
 * Update profile settings (elder approval requirement, escalation times, timezone).
 * Only elder can execute this.
 * @param {string} profileId
 * @param {object} actorElder
 * @param {object} updates
 */
async function updateSettings(profileId, actorElder, updates) {
  const repo = getRepository();
  const existing = await repo.getProfile(profileId);
  if (!existing) {
    throw AppError.notFound('Profile not found');
  }

  const updated = await repo.updateProfile(profileId, {
    ...(updates.timezone ? { timezone: updates.timezone } : {}),
    settings: {
      ...existing.settings,
      ...(updates.requireElderApprovalForEdits !== undefined
        ? { requireElderApprovalForEdits: updates.requireElderApprovalForEdits }
        : {}),
      ...(updates.escalationMinutes
        ? { escalationMinutes: { ...existing.settings.escalationMinutes, ...updates.escalationMinutes } }
        : {})
    }
  });

  await recordAudit(profileId, {
    actorMemberId: actorElder.memberId,
    actorName: actorElder.name,
    action: 'UPDATE_SETTINGS',
    entity: 'settings',
    entityId: profileId,
    summary: `Updated profile settings (Approval required: ${updated.settings.requireElderApprovalForEdits})`
  });

  return updated;
}

module.exports = {
  getProfile,
  updateSettings
};
