// Wire UI events on document load
document.addEventListener('DOMContentLoaded', async () => {
  ui.init();

  // Senior Mode Toggle
  const seniorToggle = document.getElementById('toggle-senior-mode');
  if (seniorToggle) {
    seniorToggle.addEventListener('click', () => ui.toggleSeniorMode());
  }

  // Read Aloud Button
  const readAloudBtn = document.getElementById('btn-read-aloud');
  if (readAloudBtn) {
    readAloudBtn.addEventListener('click', () => app.readScheduleAloud());
  }

  // Logout Button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => auth.handleLogout());
  }

  // Nav Tab switching
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => ui.switchTab(tab.dataset.tab));
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

  // Check existing session
  await auth.checkSession();
});
