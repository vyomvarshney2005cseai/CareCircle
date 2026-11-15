/**
 * CareCircle Main Application Controller
 */
window.app = {
  currentSchedule: null,
  currentMedications: [],
  currentAppointments: [],
  currentMembers: [],
  currentPendingChanges: [],

  async loadAllData() {
    if (!auth.profile) return;
    const profileId = auth.profile.id;

    await Promise.all([
      this.loadTodaySchedule(profileId),
      this.loadAdherence(profileId),
      this.loadMedications(profileId),
      this.loadAppointments(profileId),
      this.loadMembers(profileId),
      this.loadPendingChanges(profileId),
      this.loadAuditLogs(profileId),
      this.loadNotifications(profileId),
      this.loadAdherenceInsight(profileId)
    ]);
  },

  // --- Today's Schedule & Dose Actions ---
  async loadTodaySchedule(profileId) {
    try {
      const schedule = await api.getTodaySchedule(profileId);
      this.currentSchedule = schedule;
      this.renderTodaySchedule(schedule);
    } catch (err) {
      console.error('Failed to load schedule', err);
    }
  },

  renderTodaySchedule(schedule) {
    const listEl = document.getElementById('today-doses-list');
    const emptyEl = document.getElementById('today-empty-state');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!schedule.doses || schedule.doses.length === 0) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    schedule.doses.forEach((dose) => {
      const card = document.createElement('article');
      card.className = `dose-card status-${dose.status}`;
      const safeMedName = ui.escapeHtml(dose.medicationName);
      const safeTime = ui.escapeHtml(dose.scheduledTime);
      const safeDosage = ui.escapeHtml(dose.dosage);
      const safeForm = ui.escapeHtml(dose.form);
      const safeInstructions = ui.escapeHtml(dose.instructions);

      card.setAttribute('aria-label', `Dose ${safeMedName} scheduled for ${safeTime}`);

      const isTaken = dose.status === 'taken';

      let statusBadge = '';
      if (dose.status === 'taken') {
        statusBadge = '<span class="badge badge-taken" aria-label="Status: Taken">✓ TAKEN</span>';
      } else if (dose.status === 'missed') {
        statusBadge = '<span class="badge badge-missed" aria-label="Status: Missed">⚠️ MISSED</span>';
      } else if (dose.status === 'snoozed') {
        statusBadge = '<span class="badge badge-snoozed" aria-label="Status: Snoozed">🕒 SNOOZED</span>';
      } else {
        statusBadge = '<span class="badge badge-pending" aria-label="Status: Due">⏳ DUE / SCHEDULED</span>';
      }

      card.innerHTML = `
        <div class="dose-header">
          <div class="dose-time"><span aria-hidden="true">⏰</span> ${safeTime}</div>
          <div>
            ${statusBadge}
            ${dose.isLowStock ? '<span class="badge badge-low-stock" aria-label="Low stock warning">📦 LOW STOCK (' + Number(dose.stockCount) + ' left)</span>' : ''}
          </div>
        </div>
        <div class="dose-med-name">${safeMedName}</div>
        <div class="dose-dosage-form">${safeDosage} • ${safeForm} (Stock remaining: ${Number(dose.stockCount)})</div>
        <div class="dose-instructions">💡 Instructions: ${safeInstructions}</div>

        <button type="button" class="btn btn-huge-take ${isTaken ? 'taken' : ''}" data-dose-id="${dose.id}" ${isTaken ? 'disabled aria-disabled="true"' : ''} aria-label="${isTaken ? 'Dose already recorded as taken' : 'Confirm taking ' + safeMedName}">
          ${isTaken ? '✓ Taken at ' + new Date(dose.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '✓ I TOOK THIS MEDICINE'}
        </button>

        ${!isTaken ? `
          <div class="dose-actions-row">
            <button type="button" class="btn btn-secondary action-skip" data-dose-id="${dose.id}" aria-label="Skip dose for ${safeMedName}">Skip Dose</button>
            <button type="button" class="btn btn-secondary action-snooze" data-dose-id="${dose.id}" aria-label="Snooze reminder for 30 minutes">Snooze 30m</button>
          </div>
        ` : ''}
      `;

      // Event handlers
      const takeBtn = card.querySelector('.btn-huge-take');
      if (takeBtn && !isTaken) {
        takeBtn.addEventListener('click', () => this.handleDoseAction(dose.id, 'taken', dose.medicationName));
      }

      const skipBtn = card.querySelector('.action-skip');
      if (skipBtn) {
        skipBtn.addEventListener('click', () => this.handleDoseAction(dose.id, 'skipped', dose.medicationName));
      }

      const snoozeBtn = card.querySelector('.action-snooze');
      if (snoozeBtn) {
        snoozeBtn.addEventListener('click', () => this.handleDoseAction(dose.id, 'snoozed', dose.medicationName));
      }

      listEl.appendChild(card);
    });
  },

  async handleDoseAction(doseId, status, medName = 'Medication') {
    try {
      await api.recordDoseAction(auth.profile.id, doseId, status);
      const actionLabels = {
        taken: 'marked as taken',
        skipped: 'skipped',
        snoozed: 'snoozed for 30 minutes'
      };
      const text = `${medName} dose has been ${actionLabels[status] || status}.`;
      ui.announce(text);
      ui.showAlert(`Dose ${actionLabels[status] || status}!`, 'success');

      // Refresh schedule and adherence stats
      await Promise.all([
        this.loadTodaySchedule(auth.profile.id),
        this.loadAdherence(auth.profile.id),
        this.loadMedications(auth.profile.id),
        this.loadAuditLogs(auth.profile.id)
      ]);
    } catch (err) {
      ui.showAlert(err.message, 'error');
    }
  },

  readScheduleAloud() {
    if (this.currentSchedule) {
      speech.readSchedule(auth.profile.elderName, this.currentSchedule.doses);
    }
  },

  // --- Adherence Statistics ---
  async loadAdherence(profileId) {
    try {
      const stats = await api.getAdherence(profileId);
      const val7 = document.getElementById('adherence-7d-val');
      const val30 = document.getElementById('adherence-30d-val');
      if (val7) val7.textContent = `${stats.sevenDays.rate}%`;
      if (val30) val30.textContent = `${stats.thirtyDays.rate}%`;
    } catch (err) {
      console.error('Failed to load adherence', err);
    }
  },

  // --- Pending Approvals (Elder Review) ---
  async loadPendingChanges(profileId) {
    const banner = document.getElementById('pending-approvals-banner');
    const listEl = document.getElementById('pending-approvals-list');
    if (!banner || !listEl) return;

    if (auth.user.role !== 'elder') {
      banner.classList.add('hidden');
      return;
    }

    try {
      const pending = await api.getPendingChanges(profileId);
      this.currentPendingChanges = pending;

      if (!pending || pending.length === 0) {
        banner.classList.add('hidden');
        return;
      }

      banner.classList.remove('hidden');
      listEl.innerHTML = '';

      pending.forEach((change) => {
        const item = document.createElement('div');
        item.className = 'card';
        item.style.marginBottom = '12px';
        const safeProposedBy = ui.escapeHtml(change.proposedByName);
        const safeSummary = ui.escapeHtml(change.summary);
        item.innerHTML = `
          <div class="flex-between">
            <div>
              <strong>Proposed by ${safeProposedBy}:</strong> ${safeSummary}
              <div style="font-size:0.85em; color:var(--text-muted);">${new Date(change.createdAt).toLocaleString()}</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-success action-approve" data-id="${change.id}">Approve</button>
              <button class="btn btn-danger action-reject" data-id="${change.id}">Reject</button>
            </div>
          </div>
        `;

        item.querySelector('.action-approve').addEventListener('click', () => this.reviewChange(change.id, 'approve'));
        item.querySelector('.action-reject').addEventListener('click', () => this.reviewChange(change.id, 'reject'));
        listEl.appendChild(item);
      });
    } catch (err) {
      console.error('Failed to load pending changes', err);
    }
  },

  async reviewChange(changeId, action) {
    try {
      await api.reviewPendingChange(auth.profile.id, changeId, action);
      ui.showAlert(`Proposed change has been ${action}d!`, 'success');
      await this.loadAllData();
    } catch (err) {
      ui.showAlert(err.message, 'error');
    }
  },

  // --- Medications ---
  async loadMedications(profileId) {
    try {
      const meds = await api.getMedications(profileId);
      this.currentMedications = meds;
      this.renderMedications(meds);
    } catch (err) {
      console.error('Failed to load meds', err);
    }
  },

  renderMedications(meds) {
    const listEl = document.getElementById('medications-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!meds || meds.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text-muted);">No medications added yet.</p>';
      return;
    }

    meds.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'card';
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayNames = m.daysOfWeek.map((d) => days[d]).join(', ');
      const safeName = ui.escapeHtml(m.name);
      const safeDosage = ui.escapeHtml(m.dosage);
      const safeTimes = ui.escapeHtml(m.times.join(', '));
      const safeInstructions = ui.escapeHtml(m.instructions);

      card.innerHTML = `
        <div class="flex-between">
          <div>
            <h3 style="font-size:1.25em;">${safeName} (${safeDosage})</h3>
            <p style="color:var(--text-muted);">Times: ${safeTimes} • Days: ${dayNames}</p>
            <p>Stock: <strong>${Number(m.stockCount)}</strong> ${m.stockCount <= m.refillThreshold ? '<span class="badge badge-low-stock">REFILL NEEDED</span>' : ''}</p>
            <p style="font-size:0.9em; margin-top:4px;"><em>${safeInstructions}</em></p>
          </div>
          <div>
            <button class="btn btn-secondary action-delete-med" data-id="${m.id}">Delete</button>
          </div>
        </div>
      `;

      card.querySelector('.action-delete-med').addEventListener('click', () => this.deleteMed(m.id));
      listEl.appendChild(card);
    });
  },

  async handleAddMedication(formData) {
    try {
      const res = await api.createMedication(auth.profile.id, formData);
      if (res.pending) {
        ui.showAlert('Medication change submitted for Elder Approval.', 'info');
      } else {
        ui.showAlert('Medication added successfully!', 'success');
      }
      ui.closeModal('modal-add-med');
      await this.loadAllData();
    } catch (err) {
      ui.showAlert(err.message, 'error');
    }
  },

  async deleteMed(medId) {
    if (!confirm('Are you sure you want to remove this medication?')) return;
    try {
      const res = await api.deleteMedication(auth.profile.id, medId);
      if (res.pending) {
        ui.showAlert('Deletion submitted for Elder Approval.', 'info');
      } else {
        ui.showAlert('Medication removed.', 'success');
      }
      await this.loadAllData();
    } catch (err) {
      ui.showAlert(err.message, 'error');
    }
  },

  // --- Appointments ---
  async loadAppointments(profileId) {
    try {
      const appts = await api.getAppointments(profileId);
      this.currentAppointments = appts;
      this.renderAppointments(appts);
    } catch (err) {
      console.error('Failed to load appointments', err);
    }
  },

  renderAppointments(appts) {
    const listEl = document.getElementById('appointments-list');
    const bannerEl = document.getElementById('next-appointment-banner');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!appts || appts.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text-muted);">No upcoming appointments scheduled.</p>';
      if (bannerEl) bannerEl.classList.add('hidden');
      return;
    }

    // Next upcoming appointment banner
    const nextAppt = appts.find((a) => a.status === 'scheduled');
    if (nextAppt && bannerEl) {
      bannerEl.classList.remove('hidden');
      document.getElementById('next-appt-text').textContent =
        `Next: Dr. ${nextAppt.doctorName} (${nextAppt.specialty}) on ${new Date(nextAppt.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} at ${nextAppt.location}`;
    } else if (bannerEl) {
      bannerEl.classList.add('hidden');
    }

    appts.forEach((a) => {
      const card = document.createElement('div');
      card.className = 'card';
      const safeDoctor = ui.escapeHtml(a.doctorName);
      const safeStatus = ui.escapeHtml(a.status);
      const safeSpecialty = ui.escapeHtml(a.specialty);
      const safeLocation = ui.escapeHtml(a.location);
      const safeNotes = a.notes ? ui.escapeHtml(a.notes) : '';

      card.innerHTML = `
        <div class="flex-between">
          <div>
            <h3 style="font-size:1.25em;">Dr. ${safeDoctor} <span class="badge badge-pending">${safeStatus}</span></h3>
            <p style="color:var(--primary); font-weight:700;">${new Date(a.dateTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</p>
            <p>${safeSpecialty} • 📍 ${safeLocation}</p>
            ${safeNotes ? `<p style="font-size:0.9em; color:var(--text-muted); margin-top:4px;">Notes: ${safeNotes}</p>` : ''}
          </div>
          <div>
            <button class="btn btn-secondary action-delete-appt" data-id="${a.id}">Cancel</button>
          </div>
        </div>
      `;
      card.querySelector('.action-delete-appt').addEventListener('click', () => this.deleteAppt(a.id));
      listEl.appendChild(card);
    });
  },

  async handleAddAppointment(formData) {
    try {
      const res = await api.createAppointment(auth.profile.id, formData);
      if (res.pending) {
        ui.showAlert('Appointment change submitted for Elder Approval.', 'info');
      } else {
        ui.showAlert('Doctor appointment booked!', 'success');
      }
      ui.closeModal('modal-add-appt');
      await this.loadAllData();
    } catch (err) {
      ui.showAlert(err.message, 'error');
    }
  },

  async deleteAppt(apptId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const res = await api.deleteAppointment(auth.profile.id, apptId);
      if (res.pending) {
        ui.showAlert('Cancellation submitted for Elder Approval.', 'info');
      } else {
        ui.showAlert('Appointment cancelled.', 'success');
      }
      await this.loadAllData();
    } catch (err) {
      ui.showAlert(err.message, 'error');
    }
  },

  // --- Family & CareCircle Access ---
  async loadMembers(profileId) {
    try {
      const members = await api.getMembers(profileId);
      this.currentMembers = members;
      this.renderMembers(members);

      // Render settings toggle if elder
      const settingsSection = document.getElementById('elder-settings-panel');
      const approvalToggle = document.getElementById('setting-approval-toggle');
      if (settingsSection && approvalToggle) {
        if (auth.user.role === 'elder') {
          settingsSection.classList.remove('hidden');
          approvalToggle.checked = auth.profile.settings?.requireElderApprovalForEdits || false;
        } else {
          settingsSection.classList.add('hidden');
        }
      }
    } catch (err) {
      console.error('Failed to load members', err);
    }
  },

  renderMembers(members) {
    const listEl = document.getElementById('members-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    members.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'card';
      const isSelf = m.id === auth.user.id;
      const isElder = auth.user.role === 'elder';
      const safeName = ui.escapeHtml(m.name);
      const safeRole = ui.escapeHtml(m.role);
      const safeEmail = ui.escapeHtml(m.email);

      card.innerHTML = `
        <div class="flex-between">
          <div>
            <h3>${safeName} <span class="badge ${m.role === 'elder' ? 'badge-taken' : 'badge-pending'}">${safeRole.toUpperCase()}</span> ${!m.active ? '<span class="badge badge-low-stock">REVOKED</span>' : ''}</h3>
            <p style="color:var(--text-muted);">${safeEmail}</p>
            <div style="font-size:0.85em; margin-top:6px;">
              Permissions: Meds: ${m.permissions.canEditMeds ? 'Edit' : 'View'} • Appts: ${m.permissions.canEditAppointments ? 'Edit' : 'View'}
            </div>
          </div>
          ${isElder && !isSelf && m.active ? `
            <div>
              <button class="btn btn-secondary action-revoke-member" data-id="${m.id}">Revoke Access</button>
            </div>
          ` : ''}
        </div>
      `;

      const revokeBtn = card.querySelector('.action-revoke-member');
      if (revokeBtn) {
        revokeBtn.addEventListener('click', () => this.revokeMember(m.id));
      }

      listEl.appendChild(card);
    });
  },

  async revokeMember(memberId) {
    if (!confirm('Are you sure you want to revoke access for this member?')) return;
    try {
      await api.revokeMember(auth.profile.id, memberId);
      ui.showAlert('Member access revoked.', 'info');
      await this.loadAllData();
    } catch (err) {
      ui.showAlert(err.message, 'error');
    }
  },

  async handleToggleApproval(enabled) {
    try {
      const updated = await api.updateSettings(auth.profile.id, {
        requireElderApprovalForEdits: enabled
      });
      auth.profile = updated;
      ui.showAlert(`Elder approval requirement ${enabled ? 'ENABLED' : 'DISABLED'}.`, 'success');
      await this.loadAllData();
    } catch (err) {
      ui.showAlert(err.message, 'error');
    }
  },

  async handleCreateInvite(formData) {
    try {
      const invite = await api.createInvite(auth.profile.id, formData);
      ui.closeModal('modal-create-invite');

      // Display the generated 8-character invite code prominently
      document.getElementById('invite-result-code').textContent = invite.inviteCode;
      document.getElementById('invite-result-profile-id').textContent = auth.profile.id;
      ui.openModal('modal-invite-result');
      ui.showAlert('Invite passcode generated successfully!', 'success');
    } catch (err) {
      ui.showAlert(err.message, 'error');
    }
  },

  // --- Activity Audit Log ---
  async loadAuditLogs(profileId) {
    try {
      const logs = await api.getAuditLogs(profileId);
      const listEl = document.getElementById('audit-logs-list');
      if (!listEl) return;
      listEl.innerHTML = '';

      if (!logs || logs.length === 0) {
        listEl.innerHTML = '<li class="audit-item" style="color:var(--text-muted);">No activity recorded yet.</li>';
        return;
      }

      logs.forEach((log) => {
        const item = document.createElement('li');
        item.className = 'audit-item';
        const safeActor = ui.escapeHtml(log.actorName);
        const safeSummary = ui.escapeHtml(log.summary);
        const safeAction = ui.escapeHtml(log.action);
        item.innerHTML = `
          <div>
            <div class="audit-summary"><strong>${safeActor}:</strong> ${safeSummary}</div>
            <div class="audit-time">${new Date(log.timestamp).toLocaleString()} • ${safeAction}</div>
          </div>
        `;
        listEl.appendChild(item);
      });
    } catch (err) {
      console.error('Failed to load audit logs', err);
    }
  },

  // --- Proactive Reminders & History ---
  async loadNotifications(profileId) {
    try {
      const history = await api.getNotifications(profileId);
      const listEl = document.getElementById('notifications-list');
      if (!listEl) return;
      listEl.innerHTML = '';

      if (!history || history.length === 0) {
        listEl.innerHTML = '<li class="audit-item" style="color:var(--text-muted);">No reminders sent yet. Reminders are dispatched automatically based on schedules and alerts.</li>';
        return;
      }

      history.forEach((n) => {
        const item = document.createElement('li');
        item.className = 'audit-item';
        const safeSubject = ui.escapeHtml(n.subject);
        const safeEmail = ui.escapeHtml(n.targetEmail);
        item.innerHTML = `
          <div>
            <div class="audit-summary"><strong>${safeSubject}</strong></div>
            <div class="audit-time">Sent to ${safeEmail} at ${new Date(n.sentAt).toLocaleString()} • <span class="badge badge-taken">DELIVERED</span></div>
          </div>
        `;
        listEl.appendChild(item);
      });
    } catch (err) {
      console.error('Failed to load notification history', err);
    }
  },

  async handleSendTestReminder() {
    try {
      await api.sendTestReminder(auth.profile.id);
      ui.showAlert('Test reminder dispatched to your email!', 'success');
      await this.loadNotifications(auth.profile.id);
    } catch (err) {
      ui.showAlert(err.message, 'error');
    }
  },

  // ==========================================================================
  // Google Gemini AI Features
  // ==========================================================================

  // --- 1. Adherence Insights ---
  async loadAdherenceInsight(profileId) {
    const box = document.getElementById('ai-insight-box');
    const textEl = document.getElementById('ai-insight-text');
    const tipEl = document.getElementById('ai-insight-tip');
    if (!box || !textEl) return;

    try {
      const insight = await api.getAdherenceInsight();
      if (insight && insight.insight) {
        textEl.textContent = `"${insight.insight}"`;
        tipEl.textContent = insight.recommendation ? `💡 Tip: ${insight.recommendation}` : '';
        box.classList.remove('hidden');
      }
    } catch (err) {
      console.warn('Could not load AI insight', err);
    }
  },

  // --- 2. Prescription Scanner ---
  openPrescriptionModal() {
    const dropzone = document.getElementById('scan-dropzone');
    const loading = document.getElementById('scan-loading');
    const review = document.getElementById('scan-review-container');
    const fileInput = document.getElementById('prescription-file-input');

    if (dropzone) dropzone.classList.remove('hidden');
    if (loading) loading.classList.add('hidden');
    if (review) review.classList.add('hidden');
    if (fileInput) fileInput.value = '';

    ui.openModal('modal-scan-prescription');
  },

  async handleScanPrescription(file) {
    if (!file) return;

    const dropzone = document.getElementById('scan-dropzone');
    const loading = document.getElementById('scan-loading');
    const review = document.getElementById('scan-review-container');
    const tbody = document.getElementById('scan-draft-tbody');
    const notesEl = document.getElementById('scan-notes');

    if (dropzone) dropzone.classList.add('hidden');
    if (loading) loading.classList.remove('hidden');
    if (review) review.classList.add('hidden');

    try {
      const formData = new FormData();
      formData.append('image', file);

      const result = await api.scanPrescription(formData);

      if (tbody) tbody.innerHTML = '';
      const medicines = result.medicines || [];

      if (medicines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No medications could be recognized. Please check the image quality.</td></tr>';
      } else {
        medicines.forEach((med, index) => {
          const row = document.createElement('tr');
          row.dataset.index = index;
          const safeName = ui.escapeHtml(med.name || '');
          const safeDosage = ui.escapeHtml(med.dosage || '');
          const safeInstructions = ui.escapeHtml(med.instructions || 'Take as prescribed');
          const safeTimes = ui.escapeHtml((med.suggestedTimes || ['08:00']).join(', '));

          row.innerHTML = `
            <td><input type="text" class="scan-med-name" value="${safeName}" required></td>
            <td><input type="text" class="scan-med-dosage" value="${safeDosage}" required></td>
            <td>
              <select class="scan-med-form">
                <option value="tablet" ${med.form === 'tablet' ? 'selected' : ''}>Tablet</option>
                <option value="capsule" ${med.form === 'capsule' ? 'selected' : ''}>Capsule</option>
                <option value="syrup" ${med.form === 'syrup' ? 'selected' : ''}>Syrup</option>
                <option value="injection" ${med.form === 'injection' ? 'selected' : ''}>Injection</option>
                <option value="drops" ${med.form === 'drops' ? 'selected' : ''}>Drops</option>
                <option value="inhaler" ${med.form === 'inhaler' ? 'selected' : ''}>Inhaler</option>
              </select>
            </td>
            <td><input type="text" class="scan-med-times" value="${safeTimes}" required></td>
            <td><input type="text" class="scan-med-instructions" value="${safeInstructions}"></td>
            <td style="text-align:center;">
              <button type="button" class="btn btn-secondary btn-sm scan-row-delete" title="Remove medication" style="color:var(--danger); font-weight:bold;">&times;</button>
            </td>
          `;

          row.querySelector('.scan-row-delete').addEventListener('click', () => {
            row.remove();
          });

          tbody.appendChild(row);
        });
      }

      if (notesEl) {
        notesEl.textContent = result.notes ? `Physician / AI Notes: ${result.notes}` : '';
      }

      if (loading) loading.classList.add('hidden');
      if (review) review.classList.remove('hidden');
    } catch (err) {
      if (loading) loading.classList.add('hidden');
      if (dropzone) dropzone.classList.remove('hidden');
      ui.showAlert(err.message || 'Prescription scanning failed', 'error');
    }
  },

  async handleSaveScannedMeds() {
    const tbody = document.getElementById('scan-draft-tbody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    if (rows.length === 0) {
      ui.showAlert('No medications to save.', 'error');
      return;
    }

    let addedCount = 0;
    for (const row of rows) {
      const nameInput = row.querySelector('.scan-med-name');
      const dosageInput = row.querySelector('.scan-med-dosage');
      const formInput = row.querySelector('.scan-med-form');
      const timesInput = row.querySelector('.scan-med-times');
      const instInput = row.querySelector('.scan-med-instructions');

      if (!nameInput || !nameInput.value.trim()) continue;

      const timesArr = (timesInput ? timesInput.value : '08:00')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        name: nameInput.value.trim(),
        dosage: dosageInput ? dosageInput.value.trim() : '1 dose',
        form: formInput ? formInput.value : 'tablet',
        times: timesArr.length > 0 ? timesArr : ['08:00'],
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDate: new Date().toISOString().slice(0, 10),
        instructions: instInput ? instInput.value.trim() : 'Take as directed',
        stockCount: 30,
        refillThreshold: 5
      };

      try {
        await api.createMedication(auth.profile.id, payload);
        addedCount += 1;
      } catch (err) {
        console.error('Failed to create scanned med', err);
      }
    }

    ui.closeModal('modal-scan-prescription');
    ui.showAlert(`Successfully added ${addedCount} medication(s) to CareCircle!`, 'success');
    await Promise.all([
      this.loadMedications(auth.profile.id),
      this.loadTodaySchedule(auth.profile.id)
    ]);
  },

  // --- 3. Safety & Drug Interaction Check ---
  async handleRunSafetyCheck() {
    ui.openModal('modal-safety-check');
    const loading = document.getElementById('safety-loading');
    const resultDiv = document.getElementById('safety-result');
    const badge = document.getElementById('safety-badge');
    const summary = document.getElementById('safety-summary');
    const findingsList = document.getElementById('safety-findings-list');

    if (loading) loading.classList.remove('hidden');
    if (resultDiv) resultDiv.classList.add('hidden');

    try {
      const data = await api.checkInteractions();

      const sev = (data.severity || 'none').toLowerCase();
      if (badge) {
        badge.className = `safety-badge ${sev}`;
        badge.textContent = data.severity ? data.severity.toUpperCase() : 'NONE';
      }

      if (summary) {
        summary.textContent = data.summary || 'No safety conflicts detected.';
      }

      if (findingsList) {
        findingsList.innerHTML = '';
        const findings = data.findings || [];
        if (findings.length === 0) {
          findingsList.innerHTML = '<p style="color:var(--text-muted); font-size:0.95em;">No drug-drug interactions, duplicate therapies, or timing conflicts identified.</p>';
        } else {
          findings.forEach((f) => {
            const item = document.createElement('div');
            item.className = 'safety-finding-item';
            const safeMeds = ui.escapeHtml((f.medications || []).join(' + '));
            const safeSeverity = ui.escapeHtml((f.severity || 'info').toUpperCase());
            const safeDesc = ui.escapeHtml(f.description);
            const safeRec = ui.escapeHtml(f.recommendation || 'Consult your doctor.');

            item.innerHTML = `
              <div style="font-weight:700; margin-bottom:4px; display:flex; justify-content:space-between;">
                <span>💊 ${safeMeds}</span>
                <span class="safety-badge ${(f.severity || 'low').toLowerCase()}">${safeSeverity}</span>
              </div>
              <p style="margin-bottom:6px; font-size:0.95em;">${safeDesc}</p>
              <div style="font-size:0.88em; color:var(--text-muted);"><strong>Recommendation:</strong> ${safeRec}</div>
            `;
            findingsList.appendChild(item);
          });
        }
      }

      if (loading) loading.classList.add('hidden');
      if (resultDiv) resultDiv.classList.remove('hidden');
    } catch (err) {
      if (loading) loading.classList.add('hidden');
      ui.showAlert(err.message || 'Safety check failed', 'error');
    }
  },

  // --- 4. Conversational Voice & AI Assistant ---
  toggleChat(forceOpen = null) {
    const panel = document.getElementById('ai-chat-panel');
    if (!panel) return;
    if (forceOpen === true) {
      panel.classList.remove('hidden');
    } else if (forceOpen === false) {
      panel.classList.add('hidden');
    } else {
      panel.classList.toggle('hidden');
    }
  },

  appendChatBubble(sender, text) {
    const messages = document.getElementById('ai-chat-messages');
    if (!messages) return;

    const bubble = document.createElement('div');
    bubble.className = `ai-bubble ${sender}`;
    if (sender === 'user') {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = ui.escapeHtml(text)
        .replace(/&lt;strong&gt;/g, '<strong>').replace(/&lt;\/strong&gt;/g, '</strong>')
        .replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>')
        .replace(/\n/g, '<br>');
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  },

  appendConfirmationCard(confirmationData, replyText) {
    const messages = document.getElementById('ai-chat-messages');
    if (!messages) return;

    const card = document.createElement('div');
    card.className = 'ai-action-card';

    let actionTitle = 'Pending Action Confirmation';
    let actionDesc = ui.escapeHtml(replyText);

    if (confirmationData.action === 'mark_taken') {
      actionTitle = 'Confirm Medication Dose';
      actionDesc = `Mark <strong>${ui.escapeHtml(confirmationData.medicationName)}</strong> (${ui.escapeHtml(confirmationData.time)}) as taken?`;
    } else if (confirmationData.action === 'add_appointment') {
      actionTitle = 'Confirm Doctor Appointment';
      actionDesc = `Schedule appointment with <strong>Dr. ${ui.escapeHtml(confirmationData.doctorName)}</strong> on <strong>${ui.escapeHtml(confirmationData.dateTime)}</strong>?`;
    }

    card.innerHTML = `
      <div class="ai-action-card-title">⚠️ ${actionTitle}</div>
      <div class="ai-action-card-body">${actionDesc}</div>
      <div class="ai-action-buttons">
        <button type="button" class="ai-btn-confirm">✅ Confirm</button>
        <button type="button" class="ai-btn-cancel">❌ Cancel</button>
      </div>
    `;

    card.querySelector('.ai-btn-confirm').addEventListener('click', async () => {
      card.remove();
      await this.sendChatMessage(null, true, confirmationData);
    });

    card.querySelector('.ai-btn-cancel').addEventListener('click', () => {
      card.remove();
      this.appendChatBubble('assistant', 'Action cancelled.');
    });

    messages.appendChild(card);
    messages.scrollTop = messages.scrollHeight;
  },

  async sendChatMessage(message = null, confirmed = false, confirmationData = null) {
    if (message) {
      this.appendChatBubble('user', message);
    }

    const thinkingBubble = this.appendChatBubble('assistant', '<em>Thinking...</em>');

    try {
      const response = await api.sendAssistantMessage({
        message: message || '',
        confirmed,
        confirmationData
      });

      thinkingBubble.remove();

      if (response.reply) {
        this.appendChatBubble('assistant', response.reply);
      }

      if (response.requiresConfirmation && response.confirmationData) {
        this.appendConfirmationCard(response.confirmationData, response.reply);
      }

      // If an action was confirmed and executed, refresh app data seamlessly
      if (confirmed && response.success) {
        await this.loadAllData();
      }
    } catch (err) {
      thinkingBubble.remove();
      this.appendChatBubble('assistant', `⚠️ ${err.message || 'Could not process query'}`);
    }
  },

  handleMicInput() {
    const micBtn = document.getElementById('ai-mic-btn');
    const input = document.getElementById('ai-chat-input');
    if (!micBtn) return;

    micBtn.classList.add('listening');

    speech.startListening(
      (transcript) => {
        micBtn.classList.remove('listening');
        if (input) {
          input.value = transcript;
          this.sendChatMessage(transcript);
          input.value = '';
        }
      },
      (err) => {
        micBtn.classList.remove('listening');
        console.warn('Speech recognition ended/error:', err);
      }
    );
  }
};
