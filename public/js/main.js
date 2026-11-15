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

  // Auth view tab buttons
  const loginBtn = document.getElementById('tab-btn-login');
  const joinBtn = document.getElementById('tab-btn-join');
  const regBtn = document.getElementById('tab-btn-register');
  const formLogin = document.getElementById('form-login');
  const formJoin = document.getElementById('form-join');
  const formReg = document.getElementById('form-register');

  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginBtn.className = 'btn btn-primary';
      if (joinBtn) joinBtn.className = 'btn btn-secondary';
      if (regBtn) regBtn.className = 'btn btn-secondary';
      if (formLogin) formLogin.classList.remove('hidden');
      if (formJoin) formJoin.classList.add('hidden');
      if (formReg) formReg.classList.add('hidden');
    });
  }

  if (joinBtn) {
    joinBtn.addEventListener('click', (e) => {
      e.preventDefault();
      joinBtn.className = 'btn btn-primary';
      if (loginBtn) loginBtn.className = 'btn btn-secondary';
      if (regBtn) regBtn.className = 'btn btn-secondary';
      if (formJoin) formJoin.classList.remove('hidden');
      if (formLogin) formLogin.classList.add('hidden');
      if (formReg) formReg.classList.add('hidden');
    });
  }

  if (regBtn) {
    regBtn.addEventListener('click', (e) => {
      e.preventDefault();
      regBtn.className = 'btn btn-primary';
      if (loginBtn) loginBtn.className = 'btn btn-secondary';
      if (joinBtn) joinBtn.className = 'btn btn-secondary';
      if (formReg) formReg.classList.remove('hidden');
      if (formLogin) formLogin.classList.add('hidden');
      if (formJoin) formJoin.classList.add('hidden');
    });
  }

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
    openAddMedBtn.addEventListener('click', () => ui.openModal('modal-add-med'));
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

  // Add Med form submit
  const formAddMed = document.getElementById('form-add-med');
  if (formAddMed) {
    formAddMed.addEventListener('submit', (e) => {
      e.preventDefault();
      const dowNodes = document.querySelectorAll('input[name="dow"]:checked');
      const daysOfWeek = Array.from(dowNodes).map((n) => parseInt(n.value, 10));
      const times = document.getElementById('med-times').value.split(',').map((t) => t.trim()).filter(Boolean);

      app.handleAddMedication({
        name: document.getElementById('med-name').value.trim(),
        dosage: document.getElementById('med-dosage').value.trim(),
        form: document.getElementById('med-form').value,
        instructions: document.getElementById('med-instructions').value.trim(),
        times,
        daysOfWeek,
        startDate: new Date().toISOString().slice(0, 10),
        stockCount: parseInt(document.getElementById('med-stock').value, 10),
        refillThreshold: parseInt(document.getElementById('med-threshold').value, 10)
      });
    });
  }

  // Add Appointment submit
  const formAddAppt = document.getElementById('form-add-appt');
  if (formAddAppt) {
    formAddAppt.addEventListener('submit', (e) => {
      e.preventDefault();
      const dt = document.getElementById('appt-datetime').value;
      app.handleAddAppointment({
        doctorName: document.getElementById('appt-doctor').value.trim(),
        specialty: document.getElementById('appt-specialty').value.trim(),
        location: document.getElementById('appt-location').value.trim(),
        dateTime: new Date(dt).toISOString(),
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
      dropzone.style.borderColor = '#0284c7';
      dropzone.style.backgroundColor = '#f0f9ff';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '#94a3b8';
      dropzone.style.backgroundColor = '';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#94a3b8';
      dropzone.style.backgroundColor = '';
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
      micBtn.style.opacity = '0.6';
    }
    micBtn.addEventListener('click', () => {
      if (!speech.isRecognitionSupported()) {
        ui.showAlert('Voice input is not supported in this browser. Please type your message.', 'info');
        return;
      }
      app.handleMicInput();
    });
  }

  // Check existing session
  await auth.checkSession();
});
