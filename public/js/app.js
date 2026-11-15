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
    const heroContainer = document.getElementById('hero-next-dose-container');
    const greetingNameEl = document.getElementById('today-greeting-name');
    const dateEl = document.getElementById('today-current-date');
    const ringProgressEl = document.getElementById('today-ring-progress');
    const ringRatioEl = document.getElementById('today-ring-ratio');
    const healthStatTodayEl = document.getElementById('health-stat-today');

    if (!listEl) return;

    // 1. Update greeting and current formatted date
    const elderName = auth.profile ? (auth.profile.elderName || 'Elder') : 'Friend';
    if (greetingNameEl) {
      if (auth.user && auth.user.role === 'elder') {
        greetingNameEl.textContent = elderName;
      } else if (auth.user) {
        greetingNameEl.textContent = `${auth.user.name} (caring for ${elderName})`;
      } else {
        greetingNameEl.textContent = elderName;
      }
    }

    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    }

    const doses = schedule.doses || [];
    const totalCount = doses.length;
    const takenCount = doses.filter((d) => d.status === 'taken').length;

    // 2. Update Adherence Ring & Today Stat
    if (ringRatioEl) {
      ringRatioEl.textContent = `${takenCount}/${totalCount}`;
    }
    if (ringProgressEl) {
      const circumference = 238.76;
      const fraction = totalCount > 0 ? (takenCount / totalCount) : 0;
      const offset = circumference * (1 - fraction);
      ringProgressEl.setAttribute('stroke-dashoffset', offset.toFixed(1));
    }
    if (healthStatTodayEl) {
      const todayPct = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 100;
      healthStatTodayEl.textContent = `${todayPct}%`;
    }

    // 3. Reset list and hero
    listEl.innerHTML = '';
    if (heroContainer) heroContainer.innerHTML = '';

    if (totalCount === 0) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    // 4. Hero Next Dose Card
    const nextDose = doses.find((d) => d.status === 'pending' || d.status === 'snoozed' || d.status === 'missed');

    if (nextDose && heroContainer) {
      const heroCard = document.createElement('article');
      heroCard.className = 'hero-card mb-lg';
      heroCard.setAttribute('aria-label', `Next action: ${nextDose.medicationName} due at ${nextDose.scheduledTime}`);

      const safeMedName = ui.escapeHtml(nextDose.medicationName);
      const safeTime = ui.escapeHtml(nextDose.scheduledTime);
      const safeDosage = ui.escapeHtml(nextDose.dosage);
      const safeForm = ui.escapeHtml(nextDose.form);
      const safeInstructions = ui.escapeHtml(nextDose.instructions || 'Take as directed');
      const isMissed = nextDose.status === 'missed';

      heroCard.innerHTML = `
        <div class="flex-between mb-sm flex-wrap gap-xs">
          <span class="chip ${isMissed ? 'chip-missed' : 'chip-pending'}">
            <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-${isMissed ? 'alert' : 'clock'}"/></svg>
            <span>${isMissed ? 'MISSED DOSE' : 'NEXT DOSE DUE'} • ${safeTime}</span>
          </span>
          ${nextDose.isLowStock ? `
            <span class="chip chip-missed">
              <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-alert"/></svg>
              <span>Low Stock (${Number(nextDose.stockCount)} left)</span>
            </span>
          ` : ''}
        </div>
        <h3 class="hero-dose-name mb-xs">${safeMedName}</h3>
        <div class="hero-dose-meta mb-sm">${safeDosage} • ${safeForm}</div>
        <div class="dose-instructions mb-md">
          <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-document"/></svg>
          <span>${safeInstructions}</span>
        </div>
        <button type="button" class="btn btn-hero-take btn-huge-take action-take mb-sm" data-dose-id="${nextDose.id}" aria-label="Confirm taking ${safeMedName}">
          <svg class="icon" aria-hidden="true"><use href="#icon-check"/></svg>
          <span>I took it</span>
        </button>
        <div class="dose-actions-row">
          <button type="button" class="btn btn-hero-snooze action-snooze" data-dose-id="${nextDose.id}" aria-label="Remind me later for ${safeMedName}">
            <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-snooze"/></svg>
            <span>Remind me later</span>
          </button>
          <button type="button" class="btn btn-hero-skip action-skip" data-dose-id="${nextDose.id}" aria-label="Skip dose for ${safeMedName}">
            <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-skip"/></svg>
            <span>Skip</span>
          </button>
        </div>
      `;

      heroCard.querySelector('.action-take').addEventListener('click', () => this.handleDoseAction(nextDose.id, 'taken', nextDose.medicationName));
      heroCard.querySelector('.action-snooze').addEventListener('click', () => this.handleDoseAction(nextDose.id, 'snoozed', nextDose.medicationName));
      heroCard.querySelector('.action-skip').addEventListener('click', () => this.handleDoseAction(nextDose.id, 'skipped', nextDose.medicationName));

      heroContainer.appendChild(heroCard);
    } else if (totalCount > 0 && heroContainer) {
      const celebrateCard = document.createElement('div');
      celebrateCard.className = 'hero-card text-center mb-lg';
      celebrateCard.innerHTML = `
        <svg class="icon icon-hero mx-auto mb-xs text-primary" aria-hidden="true"><use href="#icon-check"/></svg>
        <h3 class="mb-xs">All Doses Complete for Today</h3>
        <p class="text-muted text-sm">Every scheduled dose has been taken. Well done maintaining routine!</p>
      `;
      heroContainer.appendChild(celebrateCard);
    }

    // 5. Group doses into Timeline sections
    const morningDoses = [];
    const afternoonDoses = [];
    const eveningDoses = [];

    doses.forEach((d) => {
      const time = d.scheduledTime || '00:00';
      if (time < '12:00') {
        morningDoses.push(d);
      } else if (time < '18:00') {
        afternoonDoses.push(d);
      } else {
        eveningDoses.push(d);
      }
    });

    const sections = [
      { name: 'Morning (Before 12:00 PM)', icon: 'sun', doses: morningDoses },
      { name: 'Afternoon (12:00 PM – 6:00 PM)', icon: 'sun', doses: afternoonDoses },
      { name: 'Evening (After 6:00 PM)', icon: 'moon', doses: eveningDoses }
    ];

    sections.forEach((sec) => {
      if (sec.doses.length === 0) return;

      const titleEl = document.createElement('div');
      titleEl.className = 'timeline-section-title';
      titleEl.innerHTML = `
        <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-${sec.icon}"/></svg>
        <span>${sec.name}</span>
      `;
      listEl.appendChild(titleEl);

      sec.doses.forEach((dose) => {
        const card = document.createElement('article');
        card.className = `dose-card status-${dose.status}`;
        const safeMedName = ui.escapeHtml(dose.medicationName);
        const safeTime = ui.escapeHtml(dose.scheduledTime);
        const safeDosage = ui.escapeHtml(dose.dosage);
        const safeForm = ui.escapeHtml(dose.form);
        const safeInstructions = ui.escapeHtml(dose.instructions || 'Take as directed');

        card.setAttribute('aria-label', `Dose ${safeMedName} scheduled for ${safeTime}`);

        const isTaken = dose.status === 'taken';

        let statusChip = '';
        if (dose.status === 'taken') {
          statusChip = '<span class="chip chip-taken"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-check"/></svg> TAKEN</span>';
        } else if (dose.status === 'missed') {
          statusChip = '<span class="chip chip-missed"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-alert"/></svg> MISSED</span>';
        } else if (dose.status === 'snoozed') {
          statusChip = '<span class="chip chip-info"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-snooze"/></svg> SNOOZED</span>';
        } else {
          statusChip = '<span class="chip chip-pending"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-clock"/></svg> DUE</span>';
        }

        card.innerHTML = `
          <div class="dose-header">
            <div class="dose-time"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-clock"/></svg> <span>${safeTime}</span></div>
            <div class="flex gap-xs flex-wrap">
              ${statusChip}
              ${dose.isLowStock ? '<span class="chip chip-missed"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-alert"/></svg> Low Stock (' + Number(dose.stockCount) + ' left)</span>' : ''}
            </div>
          </div>
          <div class="dose-med-name">${safeMedName}</div>
          <div class="dose-dosage-form">${safeDosage} • ${safeForm} (Stock remaining: ${Number(dose.stockCount)})</div>
          <div class="dose-instructions">
            <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-document"/></svg>
            <span>${safeInstructions}</span>
          </div>

          <button type="button" class="btn btn-primary btn-huge-take ${isTaken ? 'taken' : ''}" data-dose-id="${dose.id}" ${isTaken ? 'disabled aria-disabled="true"' : ''} aria-label="${isTaken ? 'Dose already recorded as taken' : 'Confirm taking ' + safeMedName}">
            <svg class="icon" aria-hidden="true"><use href="#icon-check"/></svg>
            <span>${isTaken ? 'Taken at ' + new Date(dose.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'I took it'}</span>
          </button>

          ${!isTaken ? `
            <div class="dose-actions-row">
              <button type="button" class="btn btn-secondary action-snooze" data-dose-id="${dose.id}" aria-label="Snooze reminder for 30 minutes">
                <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-snooze"/></svg>
                <span>Remind me later</span>
              </button>
              <button type="button" class="btn btn-secondary action-skip" data-dose-id="${dose.id}" aria-label="Skip dose for ${safeMedName}">
                <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-skip"/></svg>
                <span>Skip</span>
              </button>
            </div>
          ` : ''}
        `;

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
      const healthStat7 = document.getElementById('health-stat-7d');
      const healthStat30 = document.getElementById('health-stat-30d');

      if (val7) val7.textContent = `${stats.sevenDays.rate}%`;
      if (val30) val30.textContent = `${stats.thirtyDays.rate}%`;
      if (healthStat7) healthStat7.textContent = `${stats.sevenDays.rate}%`;
      if (healthStat30) healthStat30.textContent = `${stats.thirtyDays.rate}%`;
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
        item.className = 'card mb-sm';
        const safeProposedBy = ui.escapeHtml(change.proposedByName);
        const safeSummary = ui.escapeHtml(change.summary);
        item.innerHTML = `
          <div class="flex-between flex-wrap gap-xs">
            <div>
              <strong>Proposed by ${safeProposedBy}:</strong> ${safeSummary}
              <div class="text-xs text-muted mt-xs">${new Date(change.createdAt).toLocaleString()}</div>
            </div>
            <div class="flex gap-xs">
              <button class="btn btn-primary btn-sm action-approve" data-id="${change.id}">
                <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-check"/></svg>
                <span>Approve</span>
              </button>
              <button class="btn btn-secondary btn-sm action-reject" data-id="${change.id}">
                <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-x"/></svg>
                <span>Reject</span>
              </button>
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
      listEl.innerHTML = `
        <div class="card empty-state">
          <svg class="empty-state-illustration" viewBox="0 0 120 120" fill="none" aria-hidden="true">
            <circle cx="60" cy="60" r="54" fill="#E3F4EC" />
            <path d="M44 76L76 44M52 36L84 68" stroke="#1F7A5C" stroke-width="6" stroke-linecap="round"/>
          </svg>
          <h3 class="empty-state-title">No Medications Added Yet</h3>
          <p class="empty-state-desc">Keep your routine organized by adding daily prescriptions and refill reminders.</p>
        </div>
      `;
      return;
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    meds.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'card mb-md';
      const dayNames = m.daysOfWeek.map((d) => days[d]).join(', ');
      const safeName = ui.escapeHtml(m.name);
      const safeDosage = ui.escapeHtml(m.dosage);
      const safeTimes = ui.escapeHtml(m.times.join(', '));
      const safeInstructions = ui.escapeHtml(m.instructions || 'Take as prescribed');
      const isLowStock = m.stockCount <= m.refillThreshold;
      const stockPct = Math.min(100, Math.round((m.stockCount / Math.max(m.stockCount, 30)) * 100));

      card.innerHTML = `
        <div class="flex-between flex-wrap gap-sm mb-sm">
          <div>
            <h3 class="mb-xs">${safeName} <span class="text-muted text-md font-sans">(${safeDosage})</span></h3>
            <div class="flex gap-xs flex-wrap mb-xs">
              <span class="chip"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-clock"/></svg> ${safeTimes}</span>
              <span class="chip"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-calendar"/></svg> ${dayNames}</span>
            </div>
          </div>
          <div>
            <button class="btn btn-secondary btn-sm action-delete-med" data-id="${m.id}" aria-label="Remove ${safeName}">
              <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-x"/></svg>
              <span>Delete</span>
            </button>
          </div>
        </div>

        <div class="stock-bar-wrap mb-sm">
          <div class="flex-between text-sm mb-xs">
            <span>Inventory Stock: <strong>${Number(m.stockCount)} units remaining</strong></span>
            ${isLowStock ? `
              <span class="chip chip-missed">
                <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-alert"/></svg>
                <span>Refill Needed (Alert at &le; ${m.refillThreshold})</span>
              </span>
            ` : `<span class="text-muted text-xs">Refill alert at &le; ${m.refillThreshold}</span>`}
          </div>
          <svg width="100%" height="8" aria-hidden="true">
            <rect width="100%" height="8" rx="4" fill="#F3F4F6"/>
            <rect width="${stockPct}%" height="8" rx="4" fill="${isLowStock ? '#B3261E' : '#1F7A5C'}"/>
          </svg>
        </div>

        <div class="dose-instructions text-sm">
          <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-document"/></svg>
          <span>${safeInstructions}</span>
        </div>
      `;

      card.querySelector('.action-delete-med').addEventListener('click', () => this.deleteMed(m.id));
      listEl.appendChild(card);
    });
  },

  async handleAddMedication(formData) {
    const errEl = document.getElementById('modal-add-med-error');
    if (errEl) errEl.classList.add('hidden');
    try {
      const res = await api.createMedication(auth.profile.id, formData);
      if (res.pending) {
        ui.showAlert('Medication change submitted for Elder Approval.', 'info');
      } else {
        ui.showAlert('Medication added successfully!', 'success');
      }
      const form = document.getElementById('form-add-med');
      if (form) form.reset();
      ui.closeModal('modal-add-med');
      await this.loadAllData();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
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
    const stripEl = document.getElementById('calendar-date-strip');
    if (!listEl) return;
    listEl.innerHTML = '';

    // Populate 7-day strip
    if (stripEl) {
      stripEl.innerHTML = '';
      const today = new Date();
      for (let i = -1; i <= 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const isToday = i === 0;
        const dow = d.toLocaleDateString(undefined, { weekday: 'short' });
        const dayNum = d.getDate();
        const dateStr = d.toISOString().slice(0, 10);
        const hasAppt = appts && appts.some((a) => a.dateTime && a.dateTime.startsWith(dateStr));

        const pill = document.createElement('div');
        pill.className = `date-pill ${isToday ? 'active' : ''}`;
        pill.innerHTML = `
          <span class="date-pill-dow">${dow}</span>
          <span class="date-pill-day">${dayNum}</span>
          ${hasAppt ? '<span class="has-appt-dot" aria-hidden="true"></span>' : ''}
        `;
        stripEl.appendChild(pill);
      }
    }

    if (!appts || appts.length === 0) {
      listEl.innerHTML = `
        <div class="card empty-state">
          <svg class="empty-state-illustration" viewBox="0 0 120 120" fill="none" aria-hidden="true">
            <circle cx="60" cy="60" r="54" fill="#E3F4EC" />
            <path d="M40 50H80M40 65H65M48 35V45M72 35V45" stroke="#1F7A5C" stroke-width="6" stroke-linecap="round"/>
          </svg>
          <h3 class="empty-state-title">No Appointments Scheduled</h3>
          <p class="empty-state-desc">Upcoming clinical visits and doctor consultations will appear here.</p>
        </div>
      `;
      if (bannerEl) bannerEl.classList.add('hidden');
      return;
    }

    // Next upcoming appointment banner
    const nextAppt = appts.find((a) => a.status === 'scheduled');
    if (nextAppt && bannerEl) {
      bannerEl.classList.remove('hidden');
      document.getElementById('next-appt-text').textContent =
        `Dr. ${nextAppt.doctorName} (${nextAppt.specialty}) on ${new Date(nextAppt.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} at ${nextAppt.location}`;
    } else if (bannerEl) {
      bannerEl.classList.add('hidden');
    }

    appts.forEach((a) => {
      const card = document.createElement('div');
      const apptTime = new Date(a.dateTime).getTime();
      const now = Date.now();
      const isUrgent = apptTime > now && (apptTime - now < 24 * 3600 * 1000);
      card.className = `card appointment-card mb-md ${isUrgent ? 'urgent-24h' : ''}`;

      const safeDoctor = ui.escapeHtml(a.doctorName);
      const safeStatus = ui.escapeHtml(a.status);
      const safeSpecialty = ui.escapeHtml(a.specialty);
      const safeLocation = ui.escapeHtml(a.location);
      const safeNotes = a.notes ? ui.escapeHtml(a.notes) : '';

      card.innerHTML = `
        <div class="flex-between flex-wrap gap-sm mb-sm">
          <div>
            <div class="flex items-center gap-xs mb-xs">
              <h3 class="mb-none">Dr. ${safeDoctor}</h3>
              <span class="chip chip-pending">${safeStatus.toUpperCase()}</span>
              ${isUrgent ? '<span class="chip chip-missed"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-alert"/></svg> NEXT 24 HOURS</span>' : ''}
            </div>
            <div class="text-primary text-bold mb-xs">
              <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-clock"/></svg>
              <span>${new Date(a.dateTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</span>
            </div>
            <div class="flex gap-xs flex-wrap mb-xs">
              <span class="chip"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-stethoscope"/></svg> ${safeSpecialty}</span>
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.location)}" target="_blank" rel="noopener noreferrer" class="chip" aria-label="Open directions to ${safeLocation} in Google Maps">
                <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-map-pin"/></svg>
                <span>${safeLocation}</span>
              </a>
            </div>
            ${safeNotes ? `
              <div class="dose-instructions text-sm mt-xs">
                <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-document"/></svg>
                <span>${safeNotes}</span>
              </div>
            ` : ''}
          </div>
          <div class="flex flex-col gap-xs">
            <button class="btn btn-secondary btn-sm action-ics-download" data-id="${a.id}" aria-label="Download calendar invite for Dr. ${safeDoctor}">
              <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-calendar"/></svg>
              <span>Add to Calendar</span>
            </button>
            <button class="btn btn-secondary btn-sm action-delete-appt" data-id="${a.id}" aria-label="Cancel appointment with Dr. ${safeDoctor}">
              <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-x"/></svg>
              <span>Cancel</span>
            </button>
          </div>
        </div>
      `;

      card.querySelector('.action-delete-appt').addEventListener('click', () => this.deleteAppt(a.id));

      const icsBtn = card.querySelector('.action-ics-download');
      if (icsBtn) {
        icsBtn.addEventListener('click', () => this.downloadIcs(a));
      }

      listEl.appendChild(card);
    });
  },

  downloadIcs(appt) {
    const startDate = new Date(appt.dateTime);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const formatIcsDate = (d) => d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CareCircle//Elder Care Platform//EN',
      'BEGIN:VEVENT',
      `UID:${appt.id}@carecircle.app`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:Doctor Appointment: Dr. ${appt.doctorName} (${appt.specialty})`,
      `LOCATION:${appt.location}`,
      `DESCRIPTION:${appt.notes || 'CareCircle medical appointment'}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appointment-${appt.doctorName.toLowerCase().replace(/\s+/g, '-')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    ui.showAlert('Calendar event downloaded!', 'success');
  },

  async handleAddAppointment(formData) {
    const errEl = document.getElementById('modal-add-appt-error');
    if (errEl) errEl.classList.add('hidden');
    try {
      const res = await api.createAppointment(auth.profile.id, formData);
      if (res.pending) {
        ui.showAlert('Appointment change submitted for Elder Approval.', 'info');
      } else {
        ui.showAlert('Doctor appointment booked!', 'success');
      }
      const form = document.getElementById('form-add-appt');
      if (form) form.reset();
      ui.closeModal('modal-add-appt');
      await this.loadAllData();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
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
      card.className = 'card mb-md';
      const isSelf = m.id === auth.user.id;
      const isElder = auth.user.role === 'elder';
      const safeName = ui.escapeHtml(m.name);
      const safeRole = ui.escapeHtml(m.role);
      const safeEmail = ui.escapeHtml(m.email);
      const initials = safeName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'M';

      const roleChip = m.role === 'elder'
        ? '<span class="chip chip-taken"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-user"/></svg> ELDER</span>'
        : (m.role === 'caretaker'
          ? '<span class="chip chip-pending"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-user"/></svg> CARETAKER</span>'
          : '<span class="chip chip-info"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-user"/></svg> FAMILY</span>');

      card.innerHTML = `
        <div class="flex-between flex-wrap gap-sm">
          <div class="flex items-center gap-sm">
            <div class="avatar" aria-hidden="true">${initials}</div>
            <div>
              <div class="flex items-center gap-xs flex-wrap mb-xs">
                <h3 class="mb-none">${safeName}</h3>
                ${roleChip}
                ${!m.active ? '<span class="chip chip-missed">REVOKED</span>' : ''}
              </div>
              <div class="text-muted text-sm mb-xs">${safeEmail}</div>
              <div class="flex gap-xs flex-wrap text-xs">
                <span class="chip">Meds: ${m.permissions.canEditMeds ? 'Full Edit' : 'View Only'}</span>
                <span class="chip">Appts: ${m.permissions.canEditAppointments ? 'Full Edit' : 'View Only'}</span>
              </div>
            </div>
          </div>
          ${isElder && !isSelf && m.active ? `
            <div>
              <button class="btn btn-secondary btn-sm action-revoke-member" data-id="${m.id}" aria-label="Revoke circle access for ${safeName}">
                <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-x"/></svg>
                <span>Revoke Access</span>
              </button>
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
        listEl.innerHTML = '<li class="audit-item text-muted">No activity recorded yet.</li>';
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
            <div class="audit-time text-xs text-muted mt-xs">${new Date(log.timestamp).toLocaleString()} • ${safeAction}</div>
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
        listEl.innerHTML = '<li class="audit-item text-muted">No reminders sent yet. Reminders are dispatched automatically based on schedules and alerts.</li>';
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
            <div class="audit-time text-xs text-muted mt-xs flex items-center gap-xs flex-wrap">
              <span>Sent to ${safeEmail} at ${new Date(n.sentAt).toLocaleString()}</span>
              <span class="chip chip-taken"><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-check"/></svg> DELIVERED</span>
            </div>
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
        tipEl.textContent = insight.recommendation ? `Tip: ${insight.recommendation}` : '';
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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-md text-muted">No medications could be recognized. Please check the image quality.</td></tr>';
      } else {
        medicines.forEach((med, index) => {
          const row = document.createElement('tr');
          row.dataset.index = index;
          const safeName = ui.escapeHtml(med.name || '');
          const safeDosage = ui.escapeHtml(med.dosage || '');
          const safeInstructions = ui.escapeHtml(med.instructions || 'Take as prescribed');
          const safeTimes = ui.escapeHtml((med.suggestedTimes || ['08:00']).join(', '));

          row.innerHTML = `
            <td><input type="text" class="form-control scan-med-name" value="${safeName}" required></td>
            <td><input type="text" class="form-control scan-med-dosage" value="${safeDosage}" required></td>
            <td>
              <select class="form-control scan-med-form">
                <option value="tablet" ${med.form === 'tablet' ? 'selected' : ''}>Tablet</option>
                <option value="capsule" ${med.form === 'capsule' ? 'selected' : ''}>Capsule</option>
                <option value="syrup" ${med.form === 'syrup' ? 'selected' : ''}>Syrup</option>
                <option value="injection" ${med.form === 'injection' ? 'selected' : ''}>Injection</option>
                <option value="drops" ${med.form === 'drops' ? 'selected' : ''}>Drops</option>
                <option value="inhaler" ${med.form === 'inhaler' ? 'selected' : ''}>Inhaler</option>
              </select>
            </td>
            <td><input type="text" class="form-control scan-med-times" value="${safeTimes}" required></td>
            <td><input type="text" class="form-control scan-med-instructions" value="${safeInstructions}"></td>
            <td class="text-center">
              <button type="button" class="btn btn-secondary btn-icon scan-row-delete" title="Remove medication" aria-label="Remove medication">
                <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-x"/></svg>
              </button>
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
        badge.className = `chip ${sev === 'high' ? 'chip-missed' : (sev === 'moderate' ? 'chip-pending' : 'chip-taken')}`;
        badge.textContent = data.severity ? data.severity.toUpperCase() : 'NONE';
      }

      if (summary) {
        summary.textContent = data.summary || 'No safety conflicts detected.';
      }

      if (findingsList) {
        findingsList.innerHTML = '';
        const findings = data.findings || [];
        if (findings.length === 0) {
          findingsList.innerHTML = '<p class="text-muted text-sm">No drug-drug interactions, duplicate therapies, or timing conflicts identified.</p>';
        } else {
          findings.forEach((f) => {
            const item = document.createElement('div');
            item.className = 'safety-finding-item mb-sm';
            const safeMeds = ui.escapeHtml((f.medications || []).join(' + '));
            const safeSeverity = ui.escapeHtml((f.severity || 'info').toUpperCase());
            const safeDesc = ui.escapeHtml(f.description);
            const safeRec = ui.escapeHtml(f.recommendation || 'Consult your doctor.');
            const sevClass = (f.severity || 'low').toLowerCase() === 'high' ? 'chip-missed' : 'chip-pending';

            item.innerHTML = `
              <div class="flex-between mb-xs">
                <span class="text-bold flex items-center gap-xs">
                  <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-pill"/></svg>
                  <span>${safeMeds}</span>
                </span>
                <span class="chip ${sevClass}">${safeSeverity}</span>
              </div>
              <p class="text-sm mb-xs">${safeDesc}</p>
              <div class="text-xs text-muted"><strong>Recommendation:</strong> ${safeRec}</div>
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
      <div class="ai-action-card-title flex items-center gap-xs">
        <svg class="icon icon-sm text-accent" aria-hidden="true"><use href="#icon-alert"/></svg>
        <span>${actionTitle}</span>
      </div>
      <div class="ai-action-card-body mb-sm">${actionDesc}</div>
      <div class="ai-action-buttons">
        <button type="button" class="btn btn-primary btn-sm ai-btn-confirm">
          <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-check"/></svg>
          <span>Confirm</span>
        </button>
        <button type="button" class="btn btn-secondary btn-sm ai-btn-cancel">
          <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-x"/></svg>
          <span>Cancel</span>
        </button>
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
      this.appendChatBubble('assistant', `Error: ${err.message || 'Could not process query'}`);
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
