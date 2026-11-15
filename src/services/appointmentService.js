const AppError = require('../errors/appError');
const { getRepository } = require('../repositories');
const { recordAudit } = require('./auditService');
const pendingChangeService = require('./pendingChangeService');
const { ROLES } = require('../constants/roles');

/**
 * Service managing doctor appointments and calendar coordination.
 */
class AppointmentService {
  /**
   * List appointments for a profile.
   * @param {string} profileId
   */
  async listAppointments(profileId) {
    const repo = getRepository();
    return repo.listAppointments(profileId);
  }

  /**
   * Get single appointment by ID.
   * @param {string} profileId
   * @param {string} apptId
   */
  async getAppointment(profileId, apptId) {
    const repo = getRepository();
    const appt = await repo.getAppointmentById(profileId, apptId);
    if (!appt) {
      throw AppError.notFound('Appointment not found');
    }
    return appt;
  }

  /**
   * Create an appointment. If elder approval is required and creator is non-elder, creates a pending change.
   * @param {string} profileId
   * @param {object} actorUser
   * @param {object} apptData
   */
  async createAppointment(profileId, actorUser, apptData) {
    const repo = getRepository();
    const profile = await repo.getProfile(profileId);
    if (!profile) {
      throw AppError.notFound('Profile not found');
    }

    const payload = {
      ...apptData,
      createdBy: actorUser.memberId
    };

    if (profile.settings && profile.settings.requireElderApprovalForEdits && actorUser.role !== ROLES.ELDER) {
      return pendingChangeService.proposeChange(profileId, actorUser, {
        entity: 'appointment',
        changeType: 'CREATE',
        proposedData: payload,
        summary: `Schedule appointment with Dr. ${apptData.doctorName} (${apptData.specialty}) on ${apptData.dateTime}`
      });
    }

    const appointment = await repo.createAppointment(profileId, payload);

    await recordAudit(profileId, {
      actorMemberId: actorUser.memberId,
      actorName: actorUser.name,
      action: 'CREATE_APPOINTMENT',
      entity: 'appointment',
      entityId: appointment.id,
      summary: `Booked appointment with Dr. ${appointment.doctorName} (${appointment.specialty})`
    });

    return appointment;
  }

  /**
   * Update an appointment. If elder approval is required and updater is non-elder, creates a pending change.
   * @param {string} profileId
   * @param {object} actorUser
   * @param {string} apptId
   * @param {object} updateData
   */
  async updateAppointment(profileId, actorUser, apptId, updateData) {
    const repo = getRepository();
    const existing = await repo.getAppointmentById(profileId, apptId);
    if (!existing) {
      throw AppError.notFound('Appointment not found');
    }

    const profile = await repo.getProfile(profileId);

    if (profile.settings && profile.settings.requireElderApprovalForEdits && actorUser.role !== ROLES.ELDER) {
      return pendingChangeService.proposeChange(profileId, actorUser, {
        entity: 'appointment',
        changeType: 'UPDATE',
        entityId: apptId,
        proposedData: updateData,
        summary: `Update appointment with Dr. ${existing.doctorName}`
      });
    }

    const updated = await repo.updateAppointment(profileId, apptId, updateData);

    await recordAudit(profileId, {
      actorMemberId: actorUser.memberId,
      actorName: actorUser.name,
      action: 'UPDATE_APPOINTMENT',
      entity: 'appointment',
      entityId: apptId,
      summary: `Updated appointment with Dr. ${existing.doctorName}`
    });

    return updated;
  }

  /**
   * Delete an appointment. If elder approval is required and deleter is non-elder, creates a pending change.
   * @param {string} profileId
   * @param {object} actorUser
   * @param {string} apptId
   */
  async deleteAppointment(profileId, actorUser, apptId) {
    const repo = getRepository();
    const existing = await repo.getAppointmentById(profileId, apptId);
    if (!existing) {
      throw AppError.notFound('Appointment not found');
    }

    const profile = await repo.getProfile(profileId);

    if (profile.settings && profile.settings.requireElderApprovalForEdits && actorUser.role !== ROLES.ELDER) {
      return pendingChangeService.proposeChange(profileId, actorUser, {
        entity: 'appointment',
        changeType: 'DELETE',
        entityId: apptId,
        summary: `Cancel appointment with Dr. ${existing.doctorName}`
      });
    }

    await repo.deleteAppointment(profileId, apptId);

    await recordAudit(profileId, {
      actorMemberId: actorUser.memberId,
      actorName: actorUser.name,
      action: 'DELETE_APPOINTMENT',
      entity: 'appointment',
      entityId: apptId,
      summary: `Cancelled appointment with Dr. ${existing.doctorName}`
    });

    return { success: true, id: apptId };
  }
}

module.exports = new AppointmentService();
