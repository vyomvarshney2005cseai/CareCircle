/**
 * CareCircle Authentication Manager
 */
const auth = {
  user: null,
  profile: null,

  async checkSession() {
    try {
      const data = await api.getMe();
      this.user = data.user;
      this.profile = data.profile;
      this.renderAppView();
      return true;
    } catch (err) {
      this.renderAuthView();
      return false;
    }
  },

  validateProfileId(id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  },

  async handleRegisterElder(formData) {
    const btn = document.querySelector('#form-register button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }
    try {
      const res = await api.registerElder(formData);
      this.user = res.member;
      this.profile = res.profile;
      ui.showAlert(`Welcome ${res.member.name}! Your CareCircle profile is ready.`, 'success');
      this.renderAppView();
    } catch (err) {
      ui.showAlert(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    }
  },

  async handleJoin(formData) {
    if (!this.validateProfileId(formData.profileId)) {
      ui.showAlert('Please enter a valid CareCircle Profile ID (UUID format).', 'error');
      return;
    }
    const btn = document.querySelector('#form-join button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }
    try {
      const res = await api.join(formData);
      this.user = res.member;
      this.profile = res.profile;
      ui.showAlert(`Joined successfully as ${res.member.role}!`, 'success');
      this.renderAppView();
    } catch (err) {
      ui.showAlert(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    }
  },

  async handleLogin(formData) {
    if (!this.validateProfileId(formData.profileId)) {
      ui.showAlert('Please enter a valid CareCircle Profile ID (UUID format).', 'error');
      return;
    }
    const btn = document.querySelector('#form-login button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }
    try {
      const res = await api.login(formData);
      this.user = res.member;
      this.profile = res.profile;
      ui.showAlert(`Welcome back, ${res.member.name}!`, 'success');
      this.renderAppView();
    } catch (err) {
      ui.showAlert(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    }
  },

  async handleLogout() {
    try {
      await api.logout();
      this.user = null;
      this.profile = null;
      this.renderAuthView();
      ui.showAlert('Logged out safely.', 'info');
    } catch (err) {
      ui.showAlert('Logout failed', 'error');
    }
  },

  renderAuthView() {
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('app-view').classList.add('hidden');
  },

  renderAppView() {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app-view').classList.remove('hidden');

    // Update Header Badges
    const elderNameSpan = document.getElementById('header-elder-name');
    if (elderNameSpan) elderNameSpan.textContent = this.profile.elderName;

    const headerAvatar = document.getElementById('header-avatar');
    if (headerAvatar && this.profile.elderName) {
      headerAvatar.textContent =
        this.profile.elderName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'CC';
    }

    const profileIdSpan = document.getElementById('header-profile-id');
    if (profileIdSpan) profileIdSpan.textContent = `Circle ID: ${this.profile.id.slice(0, 8)}...`;

    const copyBtn = document.getElementById('btn-copy-circle-id');
    if (copyBtn && this.profile?.id) {
      copyBtn.onclick = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(this.profile.id)
            .then(() => {
              ui.showAlert('CareCircle ID copied to clipboard!', 'success');
            })
            .catch(() => {
              ui.showAlert(`CareCircle ID: ${this.profile.id}`, 'info');
            });
        } else {
          ui.showAlert(`CareCircle ID: ${this.profile.id}`, 'info');
        }
      };
    }

    const userBadge = document.getElementById('header-user-badge');
    if (userBadge) {
      userBadge.textContent = `${this.user.name} (${this.user.role.toUpperCase()})`;
      userBadge.className = `user-badge role-${this.user.role}`;
    }

    // Trigger initial data load in app.js
    if (window.app && typeof window.app.loadAllData === 'function') {
      window.app.loadAllData();
    }
  }
};
