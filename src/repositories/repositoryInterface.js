/**
 * Abstract interface for CareCircle storage repositories.
 */
class RepositoryInterface {
  // Profiles
  async getProfile(profileId) {
    throw new Error('Not implemented');
  }
  async createProfile(profileData) {
    throw new Error('Not implemented');
  }
  async updateProfile(profileId, profileData) {
    throw new Error('Not implemented');
  }
  async listProfiles() {
    throw new Error('Not implemented');
  }

  // Members
  async getMemberById(profileId, memberId) {
    throw new Error('Not implemented');
  }
  async getMemberByEmail(profileId, email) {
    throw new Error('Not implemented');
  }
  async listMembers(profileId) {
    throw new Error('Not implemented');
  }
  async createMember(profileId, memberData) {
    throw new Error('Not implemented');
  }
  async updateMember(profileId, memberId, memberData) {
    throw new Error('Not implemented');
  }

  // Invites
  async createInvite(profileId, inviteData) {
    throw new Error('Not implemented');
  }
  async getInviteById(profileId, inviteId) {
    throw new Error('Not implemented');
  }
  async listInvites(profileId) {
    throw new Error('Not implemented');
  }
  async updateInvite(profileId, inviteId, inviteData) {
    throw new Error('Not implemented');
  }

  // Medications
  async listMedications(profileId, filterActive = false) {
    throw new Error('Not implemented');
  }
  async getMedicationById(profileId, medId) {
    throw new Error('Not implemented');
  }
  async createMedication(profileId, medData) {
    throw new Error('Not implemented');
  }
  async updateMedication(profileId, medId, medData) {
    throw new Error('Not implemented');
  }
  async deleteMedication(profileId, medId) {
    throw new Error('Not implemented');
  }

  // Dose Logs
  async listDoseLogs(profileId, query = {}) {
    throw new Error('Not implemented');
  }
  async getDoseLog(profileId, logId) {
    throw new Error('Not implemented');
  }
  async saveDoseLog(profileId, logId, doseData) {
    throw new Error('Not implemented');
  }

  // Appointments
  async listAppointments(profileId) {
    throw new Error('Not implemented');
  }
  async getAppointmentById(profileId, apptId) {
    throw new Error('Not implemented');
  }
  async createAppointment(profileId, apptData) {
    throw new Error('Not implemented');
  }
  async updateAppointment(profileId, apptId, apptData) {
    throw new Error('Not implemented');
  }
  async deleteAppointment(profileId, apptId) {
    throw new Error('Not implemented');
  }

  // Notifications (Idempotent keys)
  async getNotification(profileId, key) {
    throw new Error('Not implemented');
  }
  async saveNotification(profileId, key, notificationData) {
    throw new Error('Not implemented');
  }
  async deleteNotification(profileId, key) {
    throw new Error('Not implemented');
  }
  async listNotifications(profileId, limit = 50) {
    throw new Error('Not implemented');
  }

  // Audit Logs
  async createAuditLog(profileId, auditData) {
    throw new Error('Not implemented');
  }
  async listAuditLogs(profileId, limit = 50) {
    throw new Error('Not implemented');
  }

  // Pending Changes (Elder Approval)
  async createPendingChange(profileId, changeData) {
    throw new Error('Not implemented');
  }
  async getPendingChangeById(profileId, changeId) {
    throw new Error('Not implemented');
  }
  async listPendingChanges(profileId, status = 'pending') {
    throw new Error('Not implemented');
  }
  async updatePendingChange(profileId, changeId, changeData) {
    throw new Error('Not implemented');
  }

  // Maintenance & Testing
  async clearAll() {
    throw new Error('Not implemented');
  }
}

module.exports = RepositoryInterface;
