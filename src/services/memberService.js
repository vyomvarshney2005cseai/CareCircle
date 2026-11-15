const AppError = require('../errors/appError');
const { getRepository } = require('../repositories');
const { recordAudit } = require('./auditService');
const { ROLES } = require('../constants/roles');

/**
 * Service managing profile members, invites, and permissions.
 */
class MemberService {
  /**
   * Strip sensitive fields (such as passcode hashes) before returning member objects.
   * @param {object} member
   */
  _sanitizeMember(member) {
    if (!member) return null;
    const { passcodeHash, ...safe } = member;
    return safe;
  }

  /**
   * List all members in a CareCircle profile.
   * @param {string} profileId
   */
  async listMembers(profileId) {
    const repo = getRepository();
    const members = await repo.listMembers(profileId);
    return members.map(this._sanitizeMember);
  }

  /**
   * Update member permissions or active status.
   * Only the elder can modify permissions.
   * @param {string} profileId
   * @param {object} actorElder
   * @param {string} targetMemberId
   * @param {{ permissions?: object, active?: boolean }} updates
   */
  async updateMember(profileId, actorElder, targetMemberId, updates) {
    if (actorElder.role !== ROLES.ELDER) {
      throw AppError.forbidden('Only the elder can modify member permissions');
    }

    const repo = getRepository();
    const targetMember = await repo.getMemberById(profileId, targetMemberId);
    if (!targetMember) {
      throw AppError.notFound('Member not found');
    }

    if (targetMember.role === ROLES.ELDER && updates.active === false) {
      throw AppError.badRequest('Cannot deactivate the primary elder account');
    }

    const updated = await repo.updateMember(profileId, targetMemberId, updates);

    await recordAudit(profileId, {
      actorMemberId: actorElder.memberId,
      actorName: actorElder.name,
      action: 'UPDATE_MEMBER',
      entity: 'member',
      entityId: targetMemberId,
      summary: `Updated permissions or status for ${targetMember.name}`
    });

    return this._sanitizeMember(updated);
  }

  /**
   * Revoke (deactivate) a member's access.
   * @param {string} profileId
   * @param {object} actorElder
   * @param {string} targetMemberId
   */
  async revokeMember(profileId, actorElder, targetMemberId) {
    return this.updateMember(profileId, actorElder, targetMemberId, { active: false });
  }

  /**
   * List pending / active invites for a profile.
   * @param {string} profileId
   */
  async listInvites(profileId) {
    const repo = getRepository();
    const invites = await repo.listInvites(profileId);
    // Strip codeHash
    return invites.map(({ codeHash, ...safe }) => safe);
  }

  /**
   * Revoke an active invite code.
   * @param {string} profileId
   * @param {object} actorElder
   * @param {string} inviteId
   */
  async revokeInvite(profileId, actorElder, inviteId) {
    if (actorElder.role !== ROLES.ELDER) {
      throw AppError.forbidden('Only the elder can revoke invites');
    }

    const repo = getRepository();
    const invite = await repo.getInviteById(profileId, inviteId);
    if (!invite) {
      throw AppError.notFound('Invite not found');
    }

    const updated = await repo.updateInvite(profileId, inviteId, { active: false });

    await recordAudit(profileId, {
      actorMemberId: actorElder.memberId,
      actorName: actorElder.name,
      action: 'REVOKE_INVITE',
      entity: 'invite',
      entityId: inviteId,
      summary: `Revoked invite for role ${invite.role}`
    });

    return { success: true, inviteId };
  }
}

module.exports = new MemberService();
