const crypto = require('crypto');
const RepositoryInterface = require('../repositoryInterface');

/**
 * Deep clone an object to preserve immutability in memory.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function clone(obj) {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * In-Memory repository implementation of RepositoryInterface for testing & lightweight deployment.
 */
class MemoryRepository extends RepositoryInterface {
  constructor() {
    super();
    this.profiles = new Map();
    this.members = new Map(); // profileId -> Map<memberId, data>
    this.invites = new Map(); // profileId -> Map<inviteId, data>
    this.medications = new Map(); // profileId -> Map<medId, data>
    this.doseLogs = new Map(); // profileId -> Map<logId, data>
    this.appointments = new Map(); // profileId -> Map<apptId, data>
    this.notifications = new Map(); // profileId -> Map<key, data>
    this.auditLogs = new Map(); // profileId -> Array<data>
    this.pendingChanges = new Map(); // profileId -> Map<changeId, data>
  }

  _getSubMap(collectionMap, profileId) {
    if (!collectionMap.has(profileId)) {
      collectionMap.set(profileId, new Map());
    }
    return collectionMap.get(profileId);
  }

  // --- Profiles ---
  async getProfile(profileId) {
    const profile = this.profiles.get(profileId);
    return clone(profile) || null;
  }

  async listProfiles() {
    return Array.from(this.profiles.values()).map(clone);
  }

  async createProfile(profileData) {
    const id = profileData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      ...profileData,
      id,
      createdAt: profileData.createdAt || now,
      settings: {
        requireElderApprovalForEdits: false,
        escalationMinutes: { remindElder: 0, missedAfter: 30, alertCaretakerAfter: 60 },
        ...(profileData.settings || {})
      }
    };
    this.profiles.set(id, record);
    return clone(record);
  }

  async updateProfile(profileId, profileData) {
    const existing = this.profiles.get(profileId);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...profileData,
      settings: {
        ...existing.settings,
        ...(profileData.settings || {})
      }
    };
    this.profiles.set(profileId, updated);
    return clone(updated);
  }

  // --- Members ---
  async getMemberById(profileId, memberId) {
    const memberMap = this._getSubMap(this.members, profileId);
    return clone(memberMap.get(memberId)) || null;
  }

  async getMemberByEmail(profileId, email) {
    const memberMap = this._getSubMap(this.members, profileId);
    const normalized = email.toLowerCase().trim();
    for (const member of memberMap.values()) {
      if (member.email.toLowerCase().trim() === normalized) {
        return clone(member);
      }
    }
    return null;
  }

  async listMembers(profileId) {
    const memberMap = this._getSubMap(this.members, profileId);
    return Array.from(memberMap.values()).map(clone);
  }

  async createMember(profileId, memberData) {
    const memberMap = this._getSubMap(this.members, profileId);
    const id = memberData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      ...memberData,
      id,
      profileId,
      active: memberData.active !== undefined ? memberData.active : true,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      createdAt: memberData.createdAt || now
    };
    memberMap.set(id, record);
    return clone(record);
  }

  async updateMember(profileId, memberId, memberData) {
    const memberMap = this._getSubMap(this.members, profileId);
    const existing = memberMap.get(memberId);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...memberData,
      permissions: {
        ...existing.permissions,
        ...(memberData.permissions || {})
      }
    };
    memberMap.set(memberId, updated);
    return clone(updated);
  }

  // --- Invites ---
  async createInvite(profileId, inviteData) {
    const inviteMap = this._getSubMap(this.invites, profileId);
    const id = inviteData.id || crypto.randomUUID();
    const record = {
      ...inviteData,
      id,
      profileId,
      active: true,
      createdAt: inviteData.createdAt || new Date().toISOString()
    };
    inviteMap.set(id, record);
    return clone(record);
  }

  async getInviteById(profileId, inviteId) {
    const inviteMap = this._getSubMap(this.invites, profileId);
    return clone(inviteMap.get(inviteId)) || null;
  }

  async listInvites(profileId) {
    const inviteMap = this._getSubMap(this.invites, profileId);
    return Array.from(inviteMap.values()).map(clone);
  }

  async updateInvite(profileId, inviteId, inviteData) {
    const inviteMap = this._getSubMap(this.invites, profileId);
    const existing = inviteMap.get(inviteId);
    if (!existing) return null;
    const updated = { ...existing, ...inviteData };
    inviteMap.set(inviteId, updated);
    return clone(updated);
  }

  // --- Medications ---
  async listMedications(profileId, filterActive = false) {
    const medMap = this._getSubMap(this.medications, profileId);
    let list = Array.from(medMap.values());
    if (filterActive) {
      list = list.filter((m) => m.active);
    }
    return list.map(clone);
  }

  async getMedicationById(profileId, medId) {
    const medMap = this._getSubMap(this.medications, profileId);
    return clone(medMap.get(medId)) || null;
  }

  async createMedication(profileId, medData) {
    const medMap = this._getSubMap(this.medications, profileId);
    const id = medData.id || crypto.randomUUID();
    const record = {
      ...medData,
      id,
      profileId,
      createdAt: medData.createdAt || new Date().toISOString()
    };
    medMap.set(id, record);
    return clone(record);
  }

  async updateMedication(profileId, medId, medData) {
    const medMap = this._getSubMap(this.medications, profileId);
    const existing = medMap.get(medId);
    if (!existing) return null;
    const updated = { ...existing, ...medData };
    medMap.set(medId, updated);
    return clone(updated);
  }

  async deleteMedication(profileId, medId) {
    const medMap = this._getSubMap(this.medications, profileId);
    const existed = medMap.has(medId);
    medMap.delete(medId);
    return existed;
  }

  // --- Dose Logs ---
  async listDoseLogs(profileId, query = {}) {
    const logMap = this._getSubMap(this.doseLogs, profileId);
    let list = Array.from(logMap.values());

    if (query.medicationId) {
      list = list.filter((l) => l.medicationId === query.medicationId);
    }
    if (query.fromDate) {
      list = list.filter((l) => l.scheduledFor >= query.fromDate);
    }
    if (query.toDate) {
      list = list.filter((l) => l.scheduledFor <= query.toDate);
    }

    return list.map(clone);
  }

  async getDoseLog(profileId, logId) {
    const logMap = this._getSubMap(this.doseLogs, profileId);
    return clone(logMap.get(logId)) || null;
  }

  async saveDoseLog(profileId, logId, doseData) {
    const logMap = this._getSubMap(this.doseLogs, profileId);
    const existing = logMap.get(logId);
    const record = {
      ...existing,
      ...doseData,
      id: logId,
      profileId,
      updatedAt: new Date().toISOString()
    };
    logMap.set(logId, record);
    return clone(record);
  }

  // --- Appointments ---
  async listAppointments(profileId) {
    const apptMap = this._getSubMap(this.appointments, profileId);
    const list = Array.from(apptMap.values()).sort((a, b) => a.dateTime.localeCompare(b.dateTime));
    return list.map(clone);
  }

  async getAppointmentById(profileId, apptId) {
    const apptMap = this._getSubMap(this.appointments, profileId);
    return clone(apptMap.get(apptId)) || null;
  }

  async createAppointment(profileId, apptData) {
    const apptMap = this._getSubMap(this.appointments, profileId);
    const id = apptData.id || crypto.randomUUID();
    const record = {
      ...apptData,
      id,
      profileId,
      createdAt: apptData.createdAt || new Date().toISOString()
    };
    apptMap.set(id, record);
    return clone(record);
  }

  async updateAppointment(profileId, apptId, apptData) {
    const apptMap = this._getSubMap(this.appointments, profileId);
    const existing = apptMap.get(apptId);
    if (!existing) return null;
    const updated = { ...existing, ...apptData };
    apptMap.set(apptId, updated);
    return clone(updated);
  }

  async deleteAppointment(profileId, apptId) {
    const apptMap = this._getSubMap(this.appointments, profileId);
    const existed = apptMap.has(apptId);
    apptMap.delete(apptId);
    return existed;
  }

  // --- Notifications ---
  async getNotification(profileId, key) {
    const notifMap = this._getSubMap(this.notifications, profileId);
    return clone(notifMap.get(key)) || null;
  }

  async saveNotification(profileId, key, notificationData) {
    const notifMap = this._getSubMap(this.notifications, profileId);
    const record = {
      ...notificationData,
      key,
      profileId,
      sentAt: notificationData.sentAt || new Date().toISOString()
    };
    notifMap.set(key, record);
    return clone(record);
  }

  async listNotifications(profileId, limit = 50) {
    const notifMap = this._getSubMap(this.notifications, profileId);
    const list = Array.from(notifMap.values()).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return list.slice(0, limit).map(clone);
  }

  // --- Audit Logs ---
  async createAuditLog(profileId, auditData) {
    if (!this.auditLogs.has(profileId)) {
      this.auditLogs.set(profileId, []);
    }
    const id = auditData.id || crypto.randomUUID();
    const record = {
      ...auditData,
      id,
      profileId,
      timestamp: auditData.timestamp || new Date().toISOString()
    };
    this.auditLogs.get(profileId).unshift(record); // newest first
    return clone(record);
  }

  async listAuditLogs(profileId, limit = 50) {
    const logs = this.auditLogs.get(profileId) || [];
    return logs.slice(0, limit).map(clone);
  }

  // --- Pending Changes ---
  async createPendingChange(profileId, changeData) {
    const changeMap = this._getSubMap(this.pendingChanges, profileId);
    const id = changeData.id || crypto.randomUUID();
    const record = {
      ...changeData,
      id,
      profileId,
      status: 'pending',
      createdAt: changeData.createdAt || new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null
    };
    changeMap.set(id, record);
    return clone(record);
  }

  async getPendingChangeById(profileId, changeId) {
    const changeMap = this._getSubMap(this.pendingChanges, profileId);
    return clone(changeMap.get(changeId)) || null;
  }

  async listPendingChanges(profileId, status = 'pending') {
    const changeMap = this._getSubMap(this.pendingChanges, profileId);
    let list = Array.from(changeMap.values());
    if (status) {
      list = list.filter((c) => c.status === status);
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list.map(clone);
  }

  async updatePendingChange(profileId, changeId, changeData) {
    const changeMap = this._getSubMap(this.pendingChanges, profileId);
    const existing = changeMap.get(changeId);
    if (!existing) return null;
    const updated = { ...existing, ...changeData };
    changeMap.set(changeId, updated);
    return clone(updated);
  }

  // --- Clear all for tests ---
  async clearAll() {
    this.profiles.clear();
    this.members.clear();
    this.invites.clear();
    this.medications.clear();
    this.doseLogs.clear();
    this.appointments.clear();
    this.notifications.clear();
    this.auditLogs.clear();
    this.pendingChanges.clear();
  }
}

module.exports = MemoryRepository;
