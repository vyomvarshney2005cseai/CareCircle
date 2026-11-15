const { getRepository } = require('../repositories');
const logger = require('../utils/logger');

/**
 * Record an audit log entry for changes within a profile.
 * @param {string} profileId
 * @param {{
 *   actorMemberId: string,
 *   actorName: string,
 *   action: string,
 *   entity: string,
 *   entityId?: string,
 *   summary: string
 * }} entry
 */
async function recordAudit(profileId, entry) {
  try {
    const repo = getRepository();
    return await repo.createAuditLog(profileId, {
      ...entry,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error({ err, profileId, entry }, 'Failed to record audit log');
    return null;
  }
}

/**
 * List recent audit logs for a profile.
 * @param {string} profileId
 * @param {number} [limit=50]
 */
async function getAuditLogs(profileId, limit = 50) {
  const repo = getRepository();
  return repo.listAuditLogs(profileId, limit);
}

module.exports = {
  recordAudit,
  getAuditLogs
};
