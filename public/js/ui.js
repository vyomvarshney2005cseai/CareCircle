/**
 * Accessible UI State, High Contrast, Text Size, and Modal Controller
 * Built strictly according to WCAG 2.1 AA specifications.
 */
const ui = {
  activeTab: 'today',
  lastFocusedElement: null,

  init() {
    // 1. Text Size Initialization (Base 20px / 24px / 28px)
    const savedTextSize = localStorage.getItem('carecircle_text_size') || 'md';
    this.setTextSize(savedTextSize, false);

    // 2. High Contrast Theme Initialization
    const savedContrast = localStorage.getItem('carecircle_high_contrast') === 'true';
    if (savedContrast) {
      this.toggleHighContrast(true, false);
    }

    // 3. Elder Mode (Simplified View) Initialization
    const savedElderMode = localStorage.getItem('carecircle_elder_mode') === 'true';
    if (savedElderMode) {
      this.toggleElderMode(true, false);
    }

    // 4. Modal Escape Key Handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const visibleModal = document.querySelector('.modal-overlay:not(.hidden)');
        if (visibleModal) {
          this.closeModal(visibleModal.id);
        }
      }
    });
  },

  /**
   * Set accessible text size scale:
   * 'md' -> 20px (base)
   * 'lg' -> 24px (A+)
   * 'xl' -> 28px (A++)
   */
  setTextSize(size, persist = true) {
    const validSizes = ['md', 'lg', 'xl'];
    const activeSize = validSizes.includes(size) ? size : 'md';
    document.body.setAttribute('data-text-size', activeSize);

    // Update button pressed/active states
    document.querySelectorAll('.btn-text-size').forEach((btn) => {
      const match = btn.dataset.size === activeSize;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-pressed', match ? 'true' : 'false');
    });

    if (persist) {
      localStorage.setItem('carecircle_text_size', activeSize);
      const labels = { md: '20px', lg: '24px', xl: '28px' };
      this.announce(`Text size set to ${labels[activeSize]}`);
    }
  },

  /**
   * Return inline SVG sprite line icon markup.
   * @param {string} name - icon name matching #icon-{name}
   * @param {string} [extraClass='']
   * @returns {string}
   */
  icon(name, extraClass = '') {
    return `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
  },

  /**
   * Toggle High Contrast Theme (persisted in localStorage).
   */
  toggleHighContrast(force = null, persist = true) {
    const isHigh = force !== null ? force : !document.body.classList.contains('high-contrast');
    document.body.classList.toggle('high-contrast', isHigh);

    const toggleBtn = document.getElementById('toggle-high-contrast');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', isHigh ? 'true' : 'false');
      toggleBtn.classList.toggle('active', isHigh);
      toggleBtn.innerHTML = `${this.icon('contrast')} <span>${isHigh ? 'Standard Contrast' : 'High Contrast'}</span>`;
    }

    if (persist) {
      localStorage.setItem('carecircle_high_contrast', isHigh ? 'true' : 'false');
      this.announce(isHigh ? 'High contrast theme enabled' : 'Standard contrast theme restored');
    }
  },

  /**
   * Toggle Simplified Elder Mode Dashboard (shows only today's schedule with giant actions).
   */
  toggleElderMode(force = null, persist = true) {
    const isElder = force !== null ? force : !document.body.classList.contains('elder-mode');
    document.body.classList.toggle('elder-mode', isElder);

    const toggleBtn = document.getElementById('toggle-elder-mode');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', isElder ? 'true' : 'false');
      toggleBtn.classList.toggle('active', isElder);
      toggleBtn.innerHTML = `${this.icon('user')} <span>${isElder ? 'Full Caretaker View' : 'Elder Mode: Simplified'}</span>`;
    }

    const banner = document.getElementById('elder-mode-banner');
    if (banner) {
      banner.classList.toggle('hidden', !isElder);
    }

    // Force tab to today when in elder mode
    if (isElder) {
      this.switchTab('today');
    }

    if (persist) {
      localStorage.setItem('carecircle_elder_mode', isElder ? 'true' : 'false');
      this.announce(isElder ? 'Simplified elder mode activated' : 'Full caretaker mode activated');
    }
  },

  /**
   * Switch navigation tabs and update ARIA attributes.
   */
  switchTab(tabName) {
    this.activeTab = tabName;

    document.querySelectorAll('.nav-tab').forEach((tab) => {
      const match = tab.dataset.tab === tabName;
      tab.classList.toggle('active', match);
      tab.setAttribute('aria-selected', match ? 'true' : 'false');
      tab.setAttribute('aria-current', match ? 'page' : 'false');
      tab.setAttribute('tabindex', match ? '0' : '-1');
    });

    document.querySelectorAll('.tab-content').forEach((sec) => {
      const match = sec.id === `tab-${tabName}`;
      sec.classList.toggle('hidden', !match);
      if (match) {
        sec.removeAttribute('hidden');
      } else {
        sec.setAttribute('hidden', 'true');
      }
    });

    const activeEl = document.getElementById(`tab-${tabName}`);
    if (activeEl) {
      this.announce(`Switched to ${activeEl.getAttribute('aria-label') || tabName} tab`);
    }

    // Close mobile "More" sheet if open
    const sheetMore = document.getElementById('sheet-more');
    if (sheetMore && !sheetMore.classList.contains('hidden')) {
      this.closeModal('sheet-more');
    }
  },

  /**
   * Accessible Modal Open with Focus Trap & Focus Retention
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    this.lastFocusedElement = document.activeElement;
    modal.classList.remove('hidden');
    modal.removeAttribute('hidden');

    // Focus the first actionable or input element inside the modal
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length > 0) {
      setTimeout(() => focusable[0].focus(), 50);
    }
  },

  /**
   * Accessible Modal Close restoring previous focus
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('hidden');
    modal.setAttribute('hidden', 'true');

    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
      this.lastFocusedElement.focus();
    }
  },

  /**
   * Escape untrusted user input to prevent XSS attacks when rendering HTML.
   * @param {*} str
   * @returns {string}
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * Screen reader dynamic announcement via aria-live region.
   */
  announce(message) {
    const region = document.getElementById('sr-announcements');
    if (!region) return;
    region.textContent = '';
    // Quick microtask to trigger screen reader mutation observer
    setTimeout(() => {
      region.textContent = message;
    }, 50);
  },

  /**
   * Accessible Toast Alert
   */
  showAlert(message, type = 'info') {
    const banner = document.getElementById('toast-notification');
    if (!banner) return;

    banner.textContent = message;
    banner.className = `alert-banner alert-${type === 'error' ? 'warning' : 'info'}`;
    banner.classList.remove('hidden');

    this.announce(`${type === 'error' ? 'Error' : 'Notification'}: ${message}`);

    setTimeout(() => {
      banner.classList.add('hidden');
    }, 5000);
  }
};
