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
      this.loadAuditLogs(profileId)
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
      card.setAttribute('aria-label', `Dose ${dose.medicationName} scheduled for ${dose.scheduledTime}`);

      const isTaken = dose.status === 'taken';

      card.innerHTML = `
        <div class="dose-header">
          <div class="dose-time">⏰ ${dose.scheduledTime}</div>
          <div>
            <span class="badge badge-${dose.status}">${dose.status.toUpperCase()}</span>
            ${dose.isLowStock ? '<span class="badge badge-low-stock">⚠️ LOW STOCK (' + dose.stockCount + ' left)</span>' : ''}
          </div>
        </div>
        <div class="dose-med-name">${dose.medicationName}</div>
        <div class="dose-dosage-form">${dose.dosage} • ${dose.form} (Stock: ${dose.stockCount})</div>
        <div class="dose-instructions">💡 Instructions: ${dose.instructions}</div>

        <button type="button" class="btn btn-huge-take ${isTaken ? 'taken' : ''}" data-dose-id="${dose.id}" ${isTaken ? 'disabled' : ''}>
          ${isTaken ? '✓ Taken at ' + new Date(dose.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '✓ I TOOK IT'}
        </button>

        ${!isTaken ? `
          <div class="dose-actions-row">
            <button type="button" class="btn btn-secondary action-skip" data-dose-id="${dose.id}">Skip Dose</button>
            <button type="button" class="btn btn-secondary action-snooze" data-dose-id="${dose.id}">Snooze 30m</button>
          </div>
        ` : ''}
      `;

      // Event handlers
      const takeBtn = card.querySelector('.btn-huge-take');
      if (takeBtn && !isTaken) {
        takeBtn.addEventListener('click', () => this.handleDoseAction(dose.id, 'taken'));
      }

      const skipBtn = card.querySelector('.action-skip');
      if (skipBtn) {
        skipBtn.addEventListener('click', () => this.handleDoseAction(dose.id, 'skipped'));
      }

      const snoozeBtn = card.querySelector('.action-snooze');
      if (snoozeBtn) {
        snoozeBtn.addEventListener('click', () => this.handleDoseAction(dose.id, 'snoozed'));
      }

      listEl.appendChild(card);
    });
  },

  async handleDoseAction(doseId, status) {
    try {
      await api.recordDoseAction(auth.profile.id, doseId, status);
      ui.showAlert(`Dose marked as ${status}`, 'success');
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
        item.innerHTML = `
          <div class="flex-between">
            <div>
              <strong>Proposed by ${change.proposedByName}:</strong> ${change.summary}
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

      card.innerHTML = `
        <div class="flex-between">
          <div>
            <h3 style="font-size:1.25em;">${m.name} (${m.dosage})</h3>
            <p style="color:var(--text-muted);">Times: ${m.times.join(', ')} • Days: ${dayNames}</p>
            <p>Stock: <strong>${m.stockCount}</strong> ${m.stockCount <= m.refillThreshold ? '<span class="badge badge-low-stock">REFILL NEEDED</span>' : ''}</p>
            <p style="font-size:0.9em; margin-top:4px;"><em>${m.instructions}</em></p>
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
      card.innerHTML = `
        <div class="flex-between">
          <div>
            <h3 style="font-size:1.25em;">Dr. ${a.doctorName} <span class="badge badge-pending">${a.status}</span></h3>
            <p style="color:var(--primary); font-weight:700;">${new Date(a.dateTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</p>
            <p>${a.specialty} • 📍 ${a.location}</p>
            ${a.notes ? `<p style="font-size:0.9em; color:var(--text-muted); margin-top:4px;">Notes: ${a.notes}</p>` : ''}
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

      card.innerHTML = `
        <div class="flex-between">
          <div>
            <h3>${m.name} <span class="badge ${m.role === 'elder' ? 'badge-taken' : 'badge-pending'}">${m.role.toUpperCase()}</span> ${!m.active ? '<span class="badge badge-low-stock">REVOKED</span>' : ''}</h3>
            <p style="color:var(--text-muted);">${m.email}</p>
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
        item.innerHTML = `
          <div>
            <div class="audit-summary"><strong>${log.actorName}:</strong> ${log.summary}</div>
            <div class="audit-time">${new Date(log.timestamp).toLocaleString()} • ${log.action}</div>
          </div>
        `;
        listEl.appendChild(item);
      });
    } catch (err) {
      console.error('Failed to load audit logs', err);
    }
  }
};
