const memberService = require('../services/memberService');
const { updateMemberSchema } = require('../utils/validators');

/**
 * List all members of a profile.
 */
async function listMembers(req, res, next) {
  try {
    const members = await memberService.listMembers(req.params.profileId);
    return res.status(200).json({ data: members });
  } catch (err) {
    return next(err);
  }
}

/**
 * Update member permissions or active status (Elder only).
 */
async function updateMember(req, res, next) {
  try {
    const validated = updateMemberSchema.parse(req.body);
    const updated = await memberService.updateMember(
      req.params.profileId,
      req.user,
      req.params.memberId,
      validated
    );
    return res.status(200).json({ data: updated });
  } catch (err) {
    return next(err);
  }
}

/**
 * Revoke member access (Elder only).
 */
async function revokeMember(req, res, next) {
  try {
    const updated = await memberService.revokeMember(
      req.params.profileId,
      req.user,
      req.params.memberId
    );
    return res.status(200).json({ data: updated });
  } catch (err) {
    return next(err);
  }
}

/**
 * List active invites for a profile.
 */
async function listInvites(req, res, next) {
  try {
    const invites = await memberService.listInvites(req.params.profileId);
    return res.status(200).json({ data: invites });
  } catch (err) {
    return next(err);
  }
}

/**
 * Revoke an active invite (Elder only).
 */
async function revokeInvite(req, res, next) {
  try {
    const result = await memberService.revokeInvite(
      req.params.profileId,
      req.user,
      req.params.inviteId
    );
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listMembers,
  updateMember,
  revokeMember,
  listInvites,
  revokeInvite
};
