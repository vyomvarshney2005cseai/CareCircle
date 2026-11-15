const AppError = require('../errors/appError');
const { getRepository } = require('../repositories');
const { recordAudit } = require('./auditService');
const pendingChangeService = require('./pendingChangeService');
const { ROLES } = require('../constants/roles');

/**
 * Service managing medication inventory, schedules, and stock monitoring.
 */
class MedicationService {
  /**
   * List medications for a profile.
   * @param {string} profileId
   * @param {boolean} [filterActive=false]
   */
  async listMedications(profileId, filterActive = false) {
    const repo = getRepository();
    return repo.listMedications(profileId, filterActive);
  }

  /**
   * Get single medication by ID.
   * @param {string} profileId
   * @param {string} medId
   */
  async getMedication(profileId, medId) {
    const repo = getRepository();
    const med = await repo.getMedicationById(profileId, medId);
    if (!med) {
      throw AppError.notFound('Medication not found');
    }
    return med;
  }

  /**
   * Create a medication. If elder approval is required and creator is non-elder, creates a pending change.
   * @param {string} profileId
   * @param {object} actorUser
   * @param {object} medData
   */
  async createMedication(profileId, actorUser, medData) {
    const repo = getRepository();
    const profile = await repo.getProfile(profileId);
    if (!profile) {
      throw AppError.notFound('Profile not found');
    }

    const payload = {
      ...medData,
      createdBy: actorUser.memberId
    };

    // Check if elder approval is required for non-elder modifications
    if (profile.settings && profile.settings.requireElderApprovalForEdits && actorUser.role !== ROLES.ELDER) {
      return pendingChangeService.proposeChange(profileId, actorUser, {
        entity: 'medication',
        changeType: 'CREATE',
        proposedData: payload,
        summary: `Add medication: ${medData.name} (${medData.dosage})`
      });
    }

    const medication = await repo.createMedication(profileId, payload);

    await recordAudit(profileId, {
      actorMemberId: actorUser.memberId,
      actorName: actorUser.name,
      action: 'CREATE_MEDICATION',
      entity: 'medication',
      entityId: medication.id,
      summary: `Added medication ${medication.name} (${medication.dosage})`
    });

    return medication;
  }

  /**
   * Update medication. If elder approval is required and updater is non-elder, creates a pending change.
   * @param {string} profileId
   * @param {object} actorUser
   * @param {string} medId
   * @param {object} updateData
   */
  async updateMedication(profileId, actorUser, medId, updateData) {
    const repo = getRepository();
    const existing = await repo.getMedicationById(profileId, medId);
    if (!existing) {
      throw AppError.notFound('Medication not found');
    }

    const profile = await repo.getProfile(profileId);

    if (profile.settings && profile.settings.requireElderApprovalForEdits && actorUser.role !== ROLES.ELDER) {
      return pendingChangeService.proposeChange(profileId, actorUser, {
        entity: 'medication',
        changeType: 'UPDATE',
        entityId: medId,
        proposedData: updateData,
        summary: `Update medication: ${existing.name}`
      });
    }

    const updated = await repo.updateMedication(profileId, medId, updateData);

    await recordAudit(profileId, {
      actorMemberId: actorUser.memberId,
      actorName: actorUser.name,
      action: 'UPDATE_MEDICATION',
      entity: 'medication',
      entityId: medId,
      summary: `Updated medication ${existing.name}`
    });

    return updated;
  }

  /**
   * Delete medication. If elder approval is required and deleter is non-elder, creates a pending change.
   * @param {string} profileId
   * @param {object} actorUser
   * @param {string} medId
   */
  async deleteMedication(profileId, actorUser, medId) {
    const repo = getRepository();
    const existing = await repo.getMedicationById(profileId, medId);
    if (!existing) {
      throw AppError.notFound('Medication not found');
    }

    const profile = await repo.getProfile(profileId);

    if (profile.settings && profile.settings.requireElderApprovalForEdits && actorUser.role !== ROLES.ELDER) {
      return pendingChangeService.proposeChange(profileId, actorUser, {
        entity: 'medication',
        changeType: 'DELETE',
        entityId: medId,
        summary: `Remove medication: ${existing.name}`
      });
    }

    await repo.deleteMedication(profileId, medId);

    await recordAudit(profileId, {
      actorMemberId: actorUser.memberId,
      actorName: actorUser.name,
      action: 'DELETE_MEDICATION',
      entity: 'medication',
      entityId: medId,
      summary: `Deleted medication ${existing.name}`
    });

    return { success: true, id: medId };
  }
}

module.exports = new MedicationService();
