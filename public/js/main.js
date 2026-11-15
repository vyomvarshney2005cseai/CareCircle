// Wire UI events on document load
document.addEventListener('DOMContentLoaded', async () => {
  ui.init();

  // 1. Text Size Controls (A / A+ / A++)
  const textSizeMd = document.getElementById('btn-text-size-md');
  if (textSizeMd) textSizeMd.addEventListener('click', () => ui.setTextSize('md'));

  const textSizeLg = document.getElementById('btn-text-size-lg');
  if (textSizeLg) textSizeLg.addEventListener('click', () => ui.setTextSize('lg'));

  const textSizeXl = document.getElementById('btn-text-size-xl');
  if (textSizeXl) textSizeXl.addEventListener('click', () => ui.setTextSize('xl'));

  // 2. High Contrast Theme Toggle
  const contrastToggle = document.getElementById('toggle-high-contrast');
  if (contrastToggle) {
    contrastToggle.addEventListener('click', () => ui.toggleHighContrast());
  }

  // 3. Elder Mode Toggle (Simplified View)
  const elderModeToggle = document.getElementById('toggle-elder-mode');
  if (elderModeToggle) {
    elderModeToggle.addEventListener('click', () => ui.toggleElderMode());
  }

  const exitElderModeBtn = document.getElementById('btn-exit-elder-mode');
  if (exitElderModeBtn) {
    exitElderModeBtn.addEventListener('click', () => ui.toggleElderMode(false));
  }

  // 4. Read Aloud Button (Speech Synthesis)
  const readAloudBtn = document.getElementById('btn-read-aloud');
  if (readAloudBtn) {
    if (!speech.isSynthesisSupported()) {
      readAloudBtn.title = 'Audio readout not supported by browser';
      readAloudBtn.setAttribute('aria-disabled', 'true');
    }
    readAloudBtn.addEventListener('click', () => app.readScheduleAloud());
  }

  // 5. Header Send Test Reminder Button
  const headerTestBtn = document.getElementById('header-btn-test-reminder');
  if (headerTestBtn) {
    headerTestBtn.addEventListener('click', () => app.handleSendTestReminder());
  }

  // 6. Logout Button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => auth.handleLogout());
  }

  const logoutSidebarBtn = document.getElementById('btn-logout-sidebar');
  if (logoutSidebarBtn) {
    logoutSidebarBtn.addEventListener('click', () => auth.handleLogout());
  }

  // Mobile Bottom Sheet "More" Button
  const moreMobileBtn = document.getElementById('tab-btn-more-m');
  if (moreMobileBtn) {
    moreMobileBtn.addEventListener('click', () => ui.openModal('sheet-more'));
  }

  // Quick Action Assistant Shortcut
  const quickAssistantBtn = document.getElementById('quick-action-assistant');
  if (quickAssistantBtn) {
    quickAssistantBtn.addEventListener('click', () => app.toggleChat(true));
  }

  // 7. Accessible Nav Tab switching & WAI-ARIA arrow navigation
  const tabs = Array.from(document.querySelectorAll('.nav-tab'));
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => ui.switchTab(tab.dataset.tab));
    tab.addEventListener('keydown', (e) => {
      let targetIndex = null;
      if (e.key === 'ArrowRight') {
        targetIndex = (index + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        targetIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        targetIndex = 0;
      } else if (e.key === 'End') {
        targetIndex = tabs.length - 1;
      }

      if (targetIndex !== null) {
        e.preventDefault();
        tabs[targetIndex].focus();
        ui.switchTab(tabs[targetIndex].dataset.tab);
      }
    });
  });

  // Auth view WAI-ARIA tab buttons & keyboard navigation
  const loginBtn = document.getElementById('tab-btn-login');
  const joinBtn = document.getElementById('tab-btn-join');
  const regBtn = document.getElementById('tab-btn-register');
  const formLogin = document.getElementById('form-login');
  const formJoin = document.getElementById('form-join');
  const formReg = document.getElementById('form-register');
  const authTabs = [loginBtn, joinBtn, regBtn].filter(Boolean);

  function activateAuthTab(targetTab) {
    authTabs.forEach((tab) => {
      const match = tab === targetTab;
      tab.setAttribute('aria-selected', match ? 'true' : 'false');
      tab.setAttribute('tabindex', match ? '0' : '-1');
      tab.className = match ? 'btn btn-primary flex-1' : 'btn btn-secondary flex-1';
    });

    if (formLogin) formLogin.classList.toggle('hidden', targetTab !== loginBtn);
    if (formJoin) formJoin.classList.toggle('hidden', targetTab !== joinBtn);
    if (formReg) formReg.classList.toggle('hidden', targetTab !== regBtn);

    targetTab.focus();
  }

  if (loginBtn) loginBtn.addEventListener('click', (e) => { e.preventDefault(); activateAuthTab(loginBtn); });
  if (joinBtn) joinBtn.addEventListener('click', (e) => { e.preventDefault(); activateAuthTab(joinBtn); });
  if (regBtn) regBtn.addEventListener('click', (e) => { e.preventDefault(); activateAuthTab(regBtn); });

  // Arrow navigation for auth tabs per WAI-ARIA tabs pattern
  const authTabsRow = document.querySelector('.auth-tabs-row');
  if (authTabsRow) {
    authTabsRow.addEventListener('keydown', (e) => {
      const activeIndex = authTabs.indexOf(document.activeElement);
      if (activeIndex === -1) return;

      let targetIndex = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        targetIndex = (activeIndex + 1) % authTabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        targetIndex = (activeIndex - 1 + authTabs.length) % authTabs.length;
      } else if (e.key === 'Home') {
        targetIndex = 0;
      } else if (e.key === 'End') {
        targetIndex = authTabs.length - 1;
      }

      if (targetIndex !== null) {
        e.preventDefault();
        activateAuthTab(authTabs[targetIndex]);
      }
    });
  }

  // Password visibility show/hide toggle buttons
  document.querySelectorAll('.btn-toggle-pw').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      btn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
      btn.innerHTML = `<svg class="icon icon-sm" aria-hidden="true"><use href="#icon-${isPassword ? 'eye-off' : 'eye'}"/></svg>`;
    });
  });

  // Auth Form Submits
  if (formLogin) {
    formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      auth.handleLogin({
        profileId: document.getElementById('login-profile-id').value.trim(),
        email: document.getElementById('login-email').value.trim(),
        passcode: document.getElementById('login-passcode').value
      });
    });
  }

  if (formJoin) {
    formJoin.addEventListener('submit', (e) => {
      e.preventDefault();
      auth.handleJoin({
        profileId: document.getElementById('join-profile-id').value.trim(),
        inviteCode: document.getElementById('join-invite-code').value.trim().toUpperCase(),
        name: document.getElementById('join-name').value.trim(),
        email: document.getElementById('join-email').value.trim(),
        passcode: document.getElementById('join-passcode').value
      });
    });
  }

  if (formReg) {
    formReg.addEventListener('submit', (e) => {
      e.preventDefault();
      auth.handleRegisterElder({
        elderName: document.getElementById('reg-elder-name').value.trim(),
        elderEmail: document.getElementById('reg-elder-email').value.trim(),
        passcode: document.getElementById('reg-passcode').value
      });
    });
  }

  // Modals setup
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => ui.closeModal(btn.dataset.close));
  });

  const openAddMedBtn = document.getElementById('btn-open-add-med');
  if (openAddMedBtn) {
    openAddMedBtn.addEventListener('click', () => {
      ui.openModal('modal-add-med');
      refreshTimeChips();
    });
  }

  const openAddApptBtn = document.getElementById('btn-open-add-appt');
  if (openAddApptBtn) {
    openAddApptBtn.addEventListener('click', () => ui.openModal('modal-add-appt'));
  }

  const openInviteBtn = document.getElementById('btn-open-invite');
  if (openInviteBtn) {
    openInviteBtn.addEventListener('click', () => ui.openModal('modal-create-invite'));
  }

  const sendTestBtn = document.getElementById('btn-send-test-reminder');
  if (sendTestBtn) {
    sendTestBtn.addEventListener('click', () => app.handleSendTestReminder());
  }

  // Add Med time picker and chip management
  const timePicker = document.getElementById('med-time-picker');
  const addTimeBtn = document.getElementById('btn-add-time-chip');
  const timesChips = document.getElementById('med-times-chips');
  const medTimesInput = document.getElementById('med-times');
  const medTimesError = document.getElementById('med-times-error');

  function refreshTimeChips() {
    if (!timesChips || !medTimesInput) return;
    timesChips.innerHTML = '';
    const currentTimes = medTimesInput.value.split(',').map((t) => t.trim()).filter(Boolean);
    currentTimes.forEach((t) => {
      const chip = document.createElement('span');
      chip.className = 'time-chip';
      chip.innerHTML = `
        <span>${ui.escapeHtml(t)}</span>
        <button type="button" class="time-chip-remove" aria-label="Remove time ${ui.escapeHtml(t)}" data-time="${ui.escapeHtml(t)}">&times;</button>
      `;
      chip.querySelector('.time-chip-remove').addEventListener('click', () => {
        const filtered = currentTimes.filter((x) => x !== t);
        medTimesInput.value = filtered.join(', ');
        refreshTimeChips();
      });
      timesChips.appendChild(chip);
    });
  }

  if (addTimeBtn && timePicker && medTimesInput) {
    addTimeBtn.addEventListener('click', () => {
      const val = timePicker.value;
      if (!val) {
        ui.showAlert('Please pick a time from the clock first.', 'info');
        return;
      }
      const currentTimes = medTimesInput.value.split(',').map((t) => t.trim()).filter(Boolean);
      if (!currentTimes.includes(val)) {
        currentTimes.push(val);
        currentTimes.sort();
        medTimesInput.value = currentTimes.join(', ');
        refreshTimeChips();
        if (medTimesError) medTimesError.classList.add('hidden');
      }
    });
  }

  if (medTimesInput) {
    medTimesInput.addEventListener('input', () => {
      refreshTimeChips();
      if (medTimesError) medTimesError.classList.add('hidden');
    });
  }

  // Add Med form submit
  const formAddMed = document.getElementById('form-add-med');
  if (formAddMed) {
    formAddMed.addEventListener('submit', (e) => {
      e.preventDefault();
      const dowNodes = document.querySelectorAll('input[name="dow"]:checked');
      const daysOfWeek = Array.from(dowNodes).map((n) => parseInt(n.value, 10));
      if (daysOfWeek.length === 0) {
        ui.showAlert('Please select at least one day of the week.', 'error');
        return;
      }
      const rawTimes = document.getElementById('med-times').value.split(',').map((t) => t.trim()).filter(Boolean);
      if (rawTimes.length === 0) {
        if (medTimesError) {
          medTimesError.textContent = 'Please enter at least one scheduled time (e.g. 08:00 or 14:00).';
          medTimesError.classList.remove('hidden');
        }
        ui.showAlert('Please enter at least one scheduled time (e.g. 08:00 or 14:00).', 'error');
        return;
      }

      // Auto-pad single digit hours (e.g. 2:11 -> 02:11)
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      const normalizedTimes = [];
      for (const t of rawTimes) {
        const parts = t.split(':');
        let normalized = t;
        if (parts.length === 2) {
          normalized = parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
        }
        if (!timeRegex.test(normalized)) {
          if (medTimesError) {
            medTimesError.textContent = 'Use 24-hour time like 08:00 or 20:30 (e.g., 08:00, 14:00)';
            medTimesError.classList.remove('hidden');
          }
          document.getElementById('med-times').focus();
          ui.showAlert('Use 24-hour time like 08:00 or 20:30.', 'error');
          return;
        }
        normalizedTimes.push(normalized);
      }

      if (medTimesError) medTimesError.classList.add('hidden');

      app.handleAddMedication({
        name: document.getElementById('med-name').value.trim(),
        dosage: document.getElementById('med-dosage').value.trim(),
        form: document.getElementById('med-form').value,
        instructions: document.getElementById('med-instructions').value.trim(),
        times: normalizedTimes,
        daysOfWeek,
        startDate: new Date().toISOString().slice(0, 10),
        stockCount: parseInt(document.getElementById('med-stock').value, 10) || 0,
        refillThreshold: parseInt(document.getElementById('med-threshold').value, 10) || 0
      });
    });
  }

  // Add Appointment submit
  const formAddAppt = document.getElementById('form-add-appt');
  if (formAddAppt) {
    formAddAppt.addEventListener('submit', (e) => {
      e.preventDefault();
      const dt = document.getElementById('appt-datetime').value;
      if (!dt) {
        ui.showAlert('Please select appointment date and time.', 'error');
        return;
      }
      const parsed = new Date(dt);
      if (isNaN(parsed.getTime())) {
        ui.showAlert('Invalid date and time selected.', 'error');
        return;
      }
      app.handleAddAppointment({
        doctorName: document.getElementById('appt-doctor').value.trim(),
        specialty: document.getElementById('appt-specialty').value.trim(),
        location: document.getElementById('appt-location').value.trim(),
        dateTime: parsed.toISOString(),
        notes: document.getElementById('appt-notes').value.trim(),
        status: 'scheduled'
      });
    });
  }

  // Create Invite submit
  const formCreateInvite = document.getElementById('form-create-invite');
  if (formCreateInvite) {
    formCreateInvite.addEventListener('submit', (e) => {
      e.preventDefault();
      const role = document.getElementById('invite-role').value;
      app.handleCreateInvite({
        role,
        permissions: {
          canViewMeds: true,
          canEditMeds: document.getElementById('perm-edit-meds').checked,
          canViewAppointments: document.getElementById('perm-view-appts').checked,
          canEditAppointments: document.getElementById('perm-edit-appts').checked,
          canViewAdherence: true,
          receiveAlerts: true
        }
      });
    });
  }

  // Copy Invite button
  const copyInviteBtn = document.getElementById('btn-copy-invite');
  if (copyInviteBtn) {
    copyInviteBtn.addEventListener('click', () => {
      const pId = document.getElementById('invite-result-profile-id').textContent;
      const code = document.getElementById('invite-result-code').textContent;
      const text = `Join my CareCircle!\nProfile ID: ${pId}\nInvite Code: ${code}`;
      navigator.clipboard.writeText(text).then(() => {
        ui.showAlert('Invite details copied to clipboard!', 'success');
      });
    });
  }

  // Approval setting toggle
  const settingToggle = document.getElementById('setting-approval-toggle');
  if (settingToggle) {
    settingToggle.addEventListener('change', (e) => {
      app.handleToggleApproval(e.target.checked);
    });
  }

  // ==========================================================================
  // Google Gemini AI UI Handlers
  // ==========================================================================

  // 1. Prescription Scanner
  const openScanBtn = document.getElementById('btn-open-scan-prescription');
  if (openScanBtn) {
    openScanBtn.addEventListener('click', () => app.openPrescriptionModal());
  }

  const dropzone = document.getElementById('scan-dropzone');
  const fileInput = document.getElementById('prescription-file-input');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        app.handleScanPrescription(e.target.files[0]);
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        app.handleScanPrescription(e.dataTransfer.files[0]);
      }
    });
  }

  const saveScannedMedsBtn = document.getElementById('btn-save-scanned-meds');
  if (saveScannedMedsBtn) {
    saveScannedMedsBtn.addEventListener('click', () => app.handleSaveScannedMeds());
  }

  // 2. Safety & Drug Interaction Check
  const openSafetyBtn = document.getElementById('btn-open-safety-check');
  if (openSafetyBtn) {
    openSafetyBtn.addEventListener('click', () => app.handleRunSafetyCheck());
  }

  // 3. Conversational AI Assistant
  const toggleChatBtn = document.getElementById('btn-toggle-ai-chat');
  if (toggleChatBtn) {
    toggleChatBtn.addEventListener('click', () => app.toggleChat());
  }

  const closeChatBtn = document.getElementById('btn-close-ai-chat');
  if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => app.toggleChat(false));
  }

  const chatForm = document.getElementById('ai-chat-form');
  const chatInput = document.getElementById('ai-chat-input');
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      app.sendChatMessage(text);
    });
  }

  const micBtn = document.getElementById('ai-mic-btn');
  if (micBtn) {
    if (!speech.isRecognitionSupported()) {
      micBtn.title = 'Voice input not supported in this browser. Please type below.';
      micBtn.setAttribute('aria-disabled', 'true');
      micBtn.classList.add('disabled');
    }
    micBtn.addEventListener('click', () => {
      if (!speech.isRecognitionSupported()) {
        ui.showAlert('Voice input is not supported in this browser. Please type your message.', 'info');
        return;
      }
      app.handleMicInput();
    });
  }

  // 4. Health Adherence Timeframe Segmented Control
  const segmentedBtns = document.querySelectorAll('.segmented-control .segmented-btn');
  segmentedBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      segmentedBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const range = btn.dataset.range || '7';
      const summaryLabel = document.getElementById('chart-summary-label');
      const areaPath = document.getElementById('chart-area-path');
      const linePath = document.getElementById('chart-line-path');

      if (range === '7') {
        if (summaryLabel) summaryLabel.textContent = 'Adherence trending strong over 7 days';
        if (areaPath) areaPath.setAttribute('d', 'M 60 180 L 60 70 Q 140 50 220 80 T 380 60 T 540 50 L 540 180 Z');
        if (linePath) linePath.setAttribute('d', 'M 60 70 Q 140 50 220 80 T 380 60 T 540 50');
      } else if (range === '30') {
        if (summaryLabel) summaryLabel.textContent = 'Adherence average 94% across 30 days';
        if (areaPath) areaPath.setAttribute('d', 'M 60 180 L 60 85 Q 140 65 220 70 T 380 55 T 540 45 L 540 180 Z');
        if (linePath) linePath.setAttribute('d', 'M 60 85 Q 140 65 220 70 T 380 55 T 540 45');
      } else {
        if (summaryLabel) summaryLabel.textContent = 'Long-term consistency high across 90 days';
        if (areaPath) areaPath.setAttribute('d', 'M 60 180 L 60 90 Q 140 80 220 60 T 380 50 T 540 40 L 540 180 Z');
        if (linePath) linePath.setAttribute('d', 'M 60 90 Q 140 80 220 60 T 380 50 T 540 40');
      }
    });
  });

  // Check existing session
  await auth.checkSession();
});
