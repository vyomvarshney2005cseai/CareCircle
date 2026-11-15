const pendingChangeService = require('../services/pendingChangeService');
const { reviewPendingChangeSchema } = require('../utils/validators');

/**
 * List pending changes awaiting elder approval.
 */
async function listPendingChanges(req, res, next) {
  try {
    const status = req.query.status || 'pending';
    const list = await pendingChangeService.listPendingChanges(req.params.profileId, status);
    return res.status(200).json({ data: list });
  } catch (err) {
    return next(err);
  }
}

/**
 * Review (approve or reject) a pending change (Elder only).
 */
async function reviewPendingChange(req, res, next) {
  try {
    const validated = reviewPendingChangeSchema.parse(req.body);
    const result = await pendingChangeService.reviewPendingChange(
      req.params.profileId,
      req.user,
      req.params.changeId,
      validated
    );
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listPendingChanges,
  reviewPendingChange
};
