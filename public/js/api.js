/**
 * CareCircle API Client
 */
const api = {
  /**
   * Universal fetch helper handling JSON & credentials.
   * @param {string} endpoint
   * @param {RequestInit} [options={}]
   */
  async request(endpoint, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      credentials: 'include',
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(endpoint, config);
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      const err = new Error(data?.error?.message || `Request failed with status ${response.status}`);
      err.status = response.status;
      err.code = data?.error?.code || 'UNKNOWN_ERROR';
      err.details = data?.error?.details;
      throw err;
    }

    return data?.data !== undefined ? data.data : data;
  },

  // Auth Endpoints
  registerElder(payload) {
    return this.request('/api/auth/register-elder', { method: 'POST', body: payload });
  },
  join(payload) {
    return this.request('/api/auth/join', { method: 'POST', body: payload });
  },
  login(payload) {
    return this.request('/api/auth/login', { method: 'POST', body: payload });
  },
  logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  },
  getMe() {
    return this.request('/api/auth/me', { method: 'GET' });
  },

  // Profile & Settings
  getProfile(profileId) {
    return this.request(`/api/profiles/${profileId}`, { method: 'GET' });
  },
  updateSettings(profileId, payload) {
    return this.request(`/api/profiles/${profileId}/settings`, { method: 'PUT', body: payload });
  },
  getAuditLogs(profileId) {
    return this.request(`/api/profiles/${profileId}/audit`, { method: 'GET' });
  },

  // Schedule & Doses
  getTodaySchedule(profileId, date = null) {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`/api/profiles/${profileId}/schedule/today${q}`, { method: 'GET' });
  },
  recordDoseAction(profileId, doseId, status) {
    return this.request(`/api/profiles/${profileId}/schedule/doses/${doseId}/action`, {
      method: 'POST',
      body: { status }
    });
  },
  getAdherence(profileId) {
    return this.request(`/api/profiles/${profileId}/schedule/adherence`, { method: 'GET' });
  },

  // Medications
  getMedications(profileId) {
    return this.request(`/api/profiles/${profileId}/medications`, { method: 'GET' });
  },
  createMedication(profileId, payload) {
    return this.request(`/api/profiles/${profileId}/medications`, { method: 'POST', body: payload });
  },
  updateMedication(profileId, medId, payload) {
    return this.request(`/api/profiles/${profileId}/medications/${medId}`, { method: 'PUT', body: payload });
  },
  deleteMedication(profileId, medId) {
    return this.request(`/api/profiles/${profileId}/medications/${medId}`, { method: 'DELETE' });
  },

  // Appointments
  getAppointments(profileId) {
    return this.request(`/api/profiles/${profileId}/appointments`, { method: 'GET' });
  },
  createAppointment(profileId, payload) {
    return this.request(`/api/profiles/${profileId}/appointments`, { method: 'POST', body: payload });
  },
  updateAppointment(profileId, apptId, payload) {
    return this.request(`/api/profiles/${profileId}/appointments/${apptId}`, { method: 'PUT', body: payload });
  },
  deleteAppointment(profileId, apptId) {
    return this.request(`/api/profiles/${profileId}/appointments/${apptId}`, { method: 'DELETE' });
  },

  // Family & Members
  getMembers(profileId) {
    return this.request(`/api/profiles/${profileId}/members`, { method: 'GET' });
  },
  updateMember(profileId, memberId, payload) {
    return this.request(`/api/profiles/${profileId}/members/${memberId}`, { method: 'PUT', body: payload });
  },
  revokeMember(profileId, memberId) {
    return this.request(`/api/profiles/${profileId}/members/${memberId}`, { method: 'DELETE' });
  },
  getInvites(profileId) {
    return this.request(`/api/profiles/${profileId}/members/invites/list`, { method: 'GET' });
  },
  createInvite(profileId, payload) {
    return this.request(`/api/profiles/${profileId}/members/invites`, { method: 'POST', body: payload });
  },
  revokeInvite(profileId, inviteId) {
    return this.request(`/api/profiles/${profileId}/members/invites/${inviteId}`, { method: 'DELETE' });
  },

  // Pending Changes (Elder Approval)
  getPendingChanges(profileId) {
    return this.request(`/api/profiles/${profileId}/pending-changes`, { method: 'GET' });
  },
  reviewPendingChange(profileId, changeId, action, rejectionReason = '') {
    return this.request(`/api/profiles/${profileId}/pending-changes/${changeId}/review`, {
      method: 'POST',
      body: { action, rejectionReason }
    });
  },

  // Proactive Notifications & Reminders
  sendTestReminder(profileId) {
    return this.request(`/api/profiles/${profileId}/notifications/test`, { method: 'POST' });
  },
  getNotifications(profileId) {
    return this.request(`/api/profiles/${profileId}/notifications`, { method: 'GET' });
  },

  // Google Gemini AI Endpoints
  scanPrescription(formData) {
    return this.request('/api/ai/scan-prescription', {
      method: 'POST',
      body: formData
    });
  },
  sendAssistantMessage(payload) {
    return this.request('/api/ai/assistant', {
      method: 'POST',
      body: payload
    });
  },
  checkInteractions() {
    return this.request('/api/ai/interaction-check', {
      method: 'POST'
    });
  },
  getAdherenceInsight() {
    return this.request('/api/ai/adherence-insight', {
      method: 'GET'
    });
  }
};
