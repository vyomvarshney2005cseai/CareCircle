/**
 * UI State and Modal Controller
 */
const ui = {
  activeTab: 'today',

  init() {
    // Check saved Senior Mode preference
    const seniorMode = localStorage.getItem('carecircle_senior_mode') === 'true';
    if (seniorMode) {
      document.body.classList.add('senior-mode');
      const toggle = document.getElementById('toggle-senior-mode');
      if (toggle) toggle.textContent = '👓 Standard Text Mode';
    }
  },

  toggleSeniorMode() {
    const isSenior = document.body.classList.toggle('senior-mode');
    localStorage.setItem('carecircle_senior_mode', isSenior);
    const toggle = document.getElementById('toggle-senior-mode');
    if (toggle) {
      toggle.textContent = isSenior ? '👓 Standard Text Mode' : '👓 Senior / High Contrast Mode';
    }
  },

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach((sec) => {
      sec.classList.toggle('hidden', sec.id !== `tab-${tabName}`);
    });
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
    }
  },

  showAlert(message, type = 'info') {
    // Simple top toast notification
    const banner = document.getElementById('toast-notification');
    if (!banner) return;

    banner.textContent = message;
    banner.className = `alert-banner alert-${type === 'error' ? 'warning' : 'info'}`;
    banner.classList.remove('hidden');

    setTimeout(() => {
      banner.classList.add('hidden');
    }, 4500);
  }
};
