const crypto = require('crypto');
const RepositoryInterface = require('../repositoryInterface');
const { getFirestoreClient } = require('./firestoreClient');

/**
 * Google Cloud Firestore repository implementation matching the schema.
 */
class FirestoreRepository extends RepositoryInterface {
  constructor(firestore = null) {
    super();
    this.db = firestore || getFirestoreClient();
  }

  _profileDoc(profileId) {
    return this.db.collection('profiles').doc(profileId);
  }

  // --- Profiles ---
  async getProfile(profileId) {
    const snap = await this._profileDoc(profileId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  }

  async listProfiles() {
    const snap = await this.db.collection('profiles').get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createProfile(profileData) {
    const id = profileData.id || crypto.randomUUID();
    const docRef = this._profileDoc(id);
    const now = new Date().toISOString();
    const data = {
      ...profileData,
      id,
      createdAt: profileData.createdAt || now,
      settings: {
        requireElderApprovalForEdits: false,
        escalationMinutes: { remindElder: 0, missedAfter: 30, alertCaretakerAfter: 60 },
        ...(profileData.settings || {})
      }
    };
    await docRef.set(data);
    return data;
  }

  async updateProfile(profileId, profileData) {
    const docRef = this._profileDoc(profileId);
    const existing = await this.getProfile(profileId);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...profileData,
      settings: {
        ...existing.settings,
        ...(profileData.settings || {})
      }
    };
    await docRef.set(updated, { merge: true });
    return updated;
  }

  // --- Members ---
  async getMemberById(profileId, memberId) {
    const snap = await this._profileDoc(profileId).collection('members').doc(memberId).get();
    if (!snap.exists) return null;
    return { id: snap.id, profileId, ...snap.data() };
  }

  async getMemberByEmail(profileId, email) {
    const snap = await this._profileDoc(profileId)
      .collection('members')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, profileId, ...doc.data() };
  }

  async listMembers(profileId) {
    const snap = await this._profileDoc(profileId).collection('members').get();
    return snap.docs.map((doc) => ({ id: doc.id, profileId, ...doc.data() }));
  }

  async createMember(profileId, memberData) {
    const id = memberData.id || crypto.randomUUID();
    const docRef = this._profileDoc(profileId).collection('members').doc(id);
    const now = new Date().toISOString();
    const data = {
      ...memberData,
      id,
      profileId,
      active: memberData.active !== undefined ? memberData.active : true,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      createdAt: memberData.createdAt || now
    };
    await docRef.set(data);
    return data;
  }

  async updateMember(profileId, memberId, memberData) {
    const docRef = this._profileDoc(profileId).collection('members').doc(memberId);
    const existing = await this.getMemberById(profileId, memberId);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...memberData,
      permissions: {
        ...existing.permissions,
        ...(memberData.permissions || {})
      }
    };
    await docRef.set(updated, { merge: true });
    return updated;
  }

  // --- Invites ---
  async createInvite(profileId, inviteData) {
    const id = inviteData.id || crypto.randomUUID();
    const docRef = this._profileDoc(profileId).collection('invites').doc(id);
    const data = {
      ...inviteData,
      id,
      profileId,
      active: true,
      createdAt: inviteData.createdAt || new Date().toISOString()
    };
    await docRef.set(data);
    return data;
  }

  async getInviteById(profileId, inviteId) {
    const snap = await this._profileDoc(profileId).collection('invites').doc(inviteId).get();
    if (!snap.exists) return null;
    return { id: snap.id, profileId, ...snap.data() };
  }

  async listInvites(profileId) {
    const snap = await this._profileDoc(profileId).collection('invites').get();
    return snap.docs.map((doc) => ({ id: doc.id, profileId, ...doc.data() }));
  }

  async updateInvite(profileId, inviteId, inviteData) {
    const docRef = this._profileDoc(profileId).collection('invites').doc(inviteId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    const updated = { id: snap.id, profileId, ...snap.data(), ...inviteData };
    await docRef.set(updated, { merge: true });
    return updated;
  }

  // --- Medications ---
  async listMedications(profileId, filterActive = false) {
    let query = this._profileDoc(profileId).collection('medications');
    if (filterActive) {
      query = query.where('active', '==', true);
    }
    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, profileId, ...doc.data() }));
  }

  async getMedicationById(profileId, medId) {
    const snap = await this._profileDoc(profileId).collection('medications').doc(medId).get();
    if (!snap.exists) return null;
    return { id: snap.id, profileId, ...snap.data() };
  }

  async createMedication(profileId, medData) {
    const id = medData.id || crypto.randomUUID();
    const docRef = this._profileDoc(profileId).collection('medications').doc(id);
    const data = {
      ...medData,
      id,
      profileId,
      createdAt: medData.createdAt || new Date().toISOString()
    };
    await docRef.set(data);
    return data;
  }

  async updateMedication(profileId, medId, medData) {
    const docRef = this._profileDoc(profileId).collection('medications').doc(medId);
    const existing = await this.getMedicationById(profileId, medId);
    if (!existing) return null;
    const updated = { ...existing, ...medData };
    await docRef.set(updated, { merge: true });
    return updated;
  }

  async deleteMedication(profileId, medId) {
    const docRef = this._profileDoc(profileId).collection('medications').doc(medId);
    const existing = await this.getMedicationById(profileId, medId);
    if (!existing) return false;
    await docRef.delete();
    return true;
  }

  // --- Dose Logs ---
  async listDoseLogs(profileId, query = {}) {
    let q = this._profileDoc(profileId).collection('doseLogs');
    if (query.medicationId) {
      q = q.where('medicationId', '==', query.medicationId);
    }
    if (query.fromDate) {
      q = q.where('scheduledFor', '>=', query.fromDate);
    }
    if (query.toDate) {
      q = q.where('scheduledFor', '<=', query.toDate);
    }
    const snap = await q.get();
    return snap.docs.map((doc) => ({ id: doc.id, profileId, ...doc.data() }));
  }

  async getDoseLog(profileId, logId) {
    const snap = await this._profileDoc(profileId).collection('doseLogs').doc(logId).get();
    if (!snap.exists) return null;
    return { id: snap.id, profileId, ...snap.data() };
  }

  async saveDoseLog(profileId, logId, doseData) {
    const docRef = this._profileDoc(profileId).collection('doseLogs').doc(logId);
    const existing = await this.getDoseLog(profileId, logId);
    const data = {
      ...existing,
      ...doseData,
      id: logId,
      profileId,
      updatedAt: new Date().toISOString()
    };
    await docRef.set(data, { merge: true });
    return data;
  }

  // --- Appointments ---
  async listAppointments(profileId) {
    const snap = await this._profileDoc(profileId).collection('appointments').get();
    const list = snap.docs.map((doc) => ({ id: doc.id, profileId, ...doc.data() }));
    return list.sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  }

  async getAppointmentById(profileId, apptId) {
    const snap = await this._profileDoc(profileId).collection('appointments').doc(apptId).get();
    if (!snap.exists) return null;
    return { id: snap.id, profileId, ...snap.data() };
  }

  async createAppointment(profileId, apptData) {
    const id = apptData.id || crypto.randomUUID();
    const docRef = this._profileDoc(profileId).collection('appointments').doc(id);
    const data = {
      ...apptData,
      id,
      profileId,
      createdAt: apptData.createdAt || new Date().toISOString()
    };
    await docRef.set(data);
    return data;
  }

  async updateAppointment(profileId, apptId, apptData) {
    const docRef = this._profileDoc(profileId).collection('appointments').doc(apptId);
    const existing = await this.getAppointmentById(profileId, apptId);
    if (!existing) return null;
    const updated = { ...existing, ...apptData };
    await docRef.set(updated, { merge: true });
    return updated;
  }

  async deleteAppointment(profileId, apptId) {
    const docRef = this._profileDoc(profileId).collection('appointments').doc(apptId);
    const existing = await this.getAppointmentById(profileId, apptId);
    if (!existing) return false;
    await docRef.delete();
    return true;
  }

  // --- Notifications ---
  async getNotification(profileId, key) {
    const snap = await this._profileDoc(profileId).collection('notifications').doc(key).get();
    if (!snap.exists) return null;
    return { key: snap.id, profileId, ...snap.data() };
  }

  async saveNotification(profileId, key, notificationData) {
    const docRef = this._profileDoc(profileId).collection('notifications').doc(key);
    const data = {
      ...notificationData,
      key,
      profileId,
      sentAt: notificationData.sentAt || new Date().toISOString()
    };
    await docRef.set(data, { merge: true });
    return data;
  }

  async deleteNotification(profileId, key) {
    const docRef = this._profileDoc(profileId).collection('notifications').doc(key);
    const snap = await docRef.get();
    if (!snap.exists) return false;
    await docRef.delete();
    return true;
  }

  async listNotifications(profileId, limit = 50) {
    const snap = await this._profileDoc(profileId)
      .collection('notifications')
      .orderBy('sentAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((doc) => ({ key: doc.id, profileId, ...doc.data() }));
  }

  // --- Audit Logs ---
  async createAuditLog(profileId, auditData) {
    const id = auditData.id || crypto.randomUUID();
    const docRef = this._profileDoc(profileId).collection('auditLog').doc(id);
    const data = {
      ...auditData,
      id,
      profileId,
      timestamp: auditData.timestamp || new Date().toISOString()
    };
    await docRef.set(data);
    return data;
  }

  async listAuditLogs(profileId, limit = 50) {
    const snap = await this._profileDoc(profileId)
      .collection('auditLog')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((doc) => ({ id: doc.id, profileId, ...doc.data() }));
  }

  // --- Pending Changes ---
  async createPendingChange(profileId, changeData) {
    const id = changeData.id || crypto.randomUUID();
    const docRef = this._profileDoc(profileId).collection('pendingChanges').doc(id);
    const data = {
      ...changeData,
      id,
      profileId,
      status: 'pending',
      createdAt: changeData.createdAt || new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null
    };
    await docRef.set(data);
    return data;
  }

  async getPendingChangeById(profileId, changeId) {
    const snap = await this._profileDoc(profileId).collection('pendingChanges').doc(changeId).get();
    if (!snap.exists) return null;
    return { id: snap.id, profileId, ...snap.data() };
  }

  async listPendingChanges(profileId, status = 'pending') {
    let q = this._profileDoc(profileId).collection('pendingChanges');
    if (status) {
      q = q.where('status', '==', status);
    }
    const snap = await q.get();
    const list = snap.docs.map((doc) => ({ id: doc.id, profileId, ...doc.data() }));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updatePendingChange(profileId, changeId, changeData) {
    const docRef = this._profileDoc(profileId).collection('pendingChanges').doc(changeId);
    const existing = await this.getPendingChangeById(profileId, changeId);
    if (!existing) return null;
    const updated = { ...existing, ...changeData };
    await docRef.set(updated, { merge: true });
    return updated;
  }

  async clearAll() {
    // Used primarily in integration test teardown if pointing to emulator
    return true;
  }
}

module.exports = FirestoreRepository;
