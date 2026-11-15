const AppError = require('../errors/appError');
const { getRepository } = require('../repositories');
const { recordAudit } = require('./auditService');
const { ROLES } = require('../constants/roles');

/**
 * Service managing proposed edits awaiting elder approval.
 */
class PendingChangeService {
  /**
   * Submit a proposed change for elder approval.
   * @param {string} profileId
   * @param {object} actorUser
   * @param {{
   *   entity: 'medication' | 'appointment',
   *   changeType: 'CREATE' | 'UPDATE' | 'DELETE',
   *   entityId?: string,
   *   proposedData?: object,
   *   summary: string
   * }} changeData
   */
  async proposeChange(profileId, actorUser, changeData) {
    const repo = getRepository();
    const pendingChange = await repo.createPendingChange(profileId, {
      ...changeData,
      proposedBy: actorUser.memberId,
      proposedByName: actorUser.name
    });

    await recordAudit(profileId, {
      actorMemberId: actorUser.memberId,
      actorName: actorUser.name,
      action: 'PROPOSE_CHANGE',
      entity: changeData.entity,
      entityId: pendingChange.id,
      summary: `Submitted ${changeData.changeType.toLowerCase()} on ${changeData.entity} for elder approval: ${changeData.summary}`
    });

    return {
      pending: true,
      pendingChangeId: pendingChange.id,
      message: 'Proposed change submitted for elder review and approval'
    };
  }

  /**
   * List pending changes for a profile.
   * @param {string} profileId
   * @param {string} [status='pending']
   */
  async listPendingChanges(profileId, status = 'pending') {
    const repo = getRepository();
    return repo.listPendingChanges(profileId, status);
  }

  /**
   * Review (approve or reject) a proposed change. Only the elder can perform this.
   * @param {string} profileId
   * @param {object} actorElder
   * @param {string} changeId
   * @param {{ action: 'approve' | 'reject', rejectionReason?: string }} reviewData
   */
  async reviewPendingChange(profileId, actorElder, changeId, { action, rejectionReason }) {
    if (actorElder.role !== ROLES.ELDER) {
      throw AppError.forbidden('Only the elder can approve or reject proposed changes');
    }

    const repo = getRepository();
    const change = await repo.getPendingChangeById(profileId, changeId);
    if (!change) {
      throw AppError.notFound('Pending change not found');
    }

    if (change.status !== 'pending') {
      throw AppError.badRequest(`Pending change is already ${change.status}`);
    }

    const now = new Date().toISOString();

    if (action === 'reject') {
      const updated = await repo.updatePendingChange(profileId, changeId, {
        status: 'rejected',
        rejectionReason: rejectionReason || 'Rejected by elder',
        reviewedAt: now,
        reviewedBy: actorElder.memberId
      });

      await recordAudit(profileId, {
        actorMemberId: actorElder.memberId,
        actorName: actorElder.name,
        action: 'REJECT_CHANGE',
        entity: change.entity,
        entityId: changeId,
        summary: `Elder rejected proposed ${change.changeType} on ${change.entity} (${change.summary})`
      });

      return updated;
    }

    // Action === 'approve': apply the proposed modification to the live collection
    let appliedResult = null;
    if (change.entity === 'medication') {
      if (change.changeType === 'CREATE') {
        appliedResult = await repo.createMedication(profileId, change.proposedData);
      } else if (change.changeType === 'UPDATE') {
        appliedResult = await repo.updateMedication(
          profileId,
          change.entityId,
          change.proposedData
        );
      } else if (change.changeType === 'DELETE') {
        appliedResult = await repo.deleteMedication(profileId, change.entityId);
      }
    } else if (change.entity === 'appointment') {
      if (change.changeType === 'CREATE') {
        appliedResult = await repo.createAppointment(profileId, change.proposedData);
      } else if (change.changeType === 'UPDATE') {
        appliedResult = await repo.updateAppointment(
          profileId,
          change.entityId,
          change.proposedData
        );
      } else if (change.changeType === 'DELETE') {
        appliedResult = await repo.deleteAppointment(profileId, change.entityId);
      }
    }

    const updated = await repo.updatePendingChange(profileId, changeId, {
      status: 'approved',
      reviewedAt: now,
      reviewedBy: actorElder.memberId,
      appliedResult: appliedResult ? appliedResult.id || true : true
    });

    await recordAudit(profileId, {
      actorMemberId: actorElder.memberId,
      actorName: actorElder.name,
      action: 'APPROVE_CHANGE',
      entity: change.entity,
      entityId: changeId,
      summary: `Elder approved proposed ${change.changeType} on ${change.entity} (${change.summary})`
    });

    return updated;
  }
}

module.exports = new PendingChangeService();
