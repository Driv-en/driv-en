/**
 * DRIV-EN — Company Management Page Logic
 * File: /app/dashboard/company-management.js
 */

document.addEventListener('DOMContentLoaded', function () {
  initCompanyManagement();
});

function initCompanyManagement() {
  // Bind Tab Bar Navigation
  const tabElements = document.querySelectorAll('.cm-tab[data-tab]');
  tabElements.forEach(function (tabEl) {
    tabEl.addEventListener('click', function () {
      const tabName = this.getAttribute('data-tab');
      if (tabName) {
        switchTab(tabName);
      }
    });
  });

  // Bind Overview Cards to Tab Navigation
  const moduleCards = document.querySelectorAll('.cm-module-card[data-navigate-tab]');
  moduleCards.forEach(function (card) {
    card.addEventListener('click', function () {
      const targetTab = this.getAttribute('data-navigate-tab');
      if (targetTab) {
        switchTab(targetTab);
      }
    });
  });

  // Bind Navigation & Session Controls
  const btnGoDashboard = document.getElementById('btnGoDashboard');
  if (btnGoDashboard) {
    btnGoDashboard.addEventListener('click', goToMainDashboard);
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function () {
      if (typeof window.dashLogout === 'function') {
        window.dashLogout();
      }
    });
  }

  // Bind Standardized Modals (Purpose & Instructions)
  initStandardModals();

  // Listen for Dashboard Session Ready Signal
  document.addEventListener('dashSessionLoaded', handleSessionLoaded);
}

/**
 * Validates session context and initializes UI state
 */
async function handleSessionLoaded() {
  let user = window.dashUser || window.drivenUser;
  if (!user) {
    try {
      user = JSON.parse(localStorage.getItem('driven_user') || sessionStorage.getItem('driven_user'));
    } catch (e) {
      // Ignore parse errors
    }
  }

  if (!user) {
    window.location.href = '/public/login.html';
    return;
  }
  window.dashUser = user;

  const loadingEl = document.getElementById('cmLoading');
  const overviewTab = document.getElementById('tab-overview');
  if (loadingEl) loadingEl.style.display = 'none';
  if (overviewTab) overviewTab.style.display = 'block';

  let headerAttempts = 0;
  const headerInterval = setInterval(function () {
    headerAttempts++;
    if (fixHeaderLayout() || headerAttempts > 50) {
      clearInterval(headerInterval);
    }
  }, 100);

  setTimeout(makeTabsSticky, 300);
}

/**
 * Switch active view tab
 */
function switchTab(tabName) {
  document.querySelectorAll('.cm-tab').forEach(function (t) {
    t.classList.remove('active');
  });
  document.querySelectorAll('.cm-tab-content').forEach(function (c) {
    c.style.display = 'none';
    c.classList.remove('active');
  });

  const activeTab = document.querySelector('.cm-tab[data-tab="' + tabName + '"]');
  const activeContent = document.getElementById('tab-' + tabName);

  if (activeTab) activeTab.classList.add('active');
  if (activeContent) {
    activeContent.style.display = 'block';
    activeContent.classList.add('active');
  }
}

/**
 * Route back to role-appropriate main dashboard
 */
function goToMainDashboard() {
  const savedOrigin = sessionStorage.getItem('driven_dashboard_origin');
  if (savedOrigin) {
    window.location.href = savedOrigin;
    return;
  }
  if (document.referrer && document.referrer.indexOf('driv-en.com') !== -1) {
    window.location.href = document.referrer;
    return;
  }

  let user = window.dashUser || window.drivenUser;
  if (!user) {
    try {
      user = JSON.parse(localStorage.getItem('driven_user') || sessionStorage.getItem('driven_user'));
    } catch (e) {
      // Ignore parse errors
    }
  }

  if (user) {
    const role = (user.role || '').toLowerCase();
    if (role.indexOf('founder') !== -1 || role.indexOf('owner') !== -1) {
      window.location.href = '/app/dashboard/owner-dashboard.html';
      return;
    } else if (role.indexOf('admin') !== -1) {
      window.location.href = '/app/dashboard/admin.html';
      return;
    } else {
      window.location.href = '/app/dashboard/employee-dashboard.html';
      return;
    }
  }

  window.location.href = '/app/dashboard/admin.html';
}

/**
 * Restructure header elements dynamically if needed
 */
function fixHeaderLayout() {
  const header = document.querySelector('.dash-header');
  if (!header) return false;

  const row1 = header.querySelector('.dash-header-row1');
  const row2 = header.querySelector('.dash-header-row2');
  const row3 = header.querySelector('.dash-header-row3');
  const h1 = row2 ? row2.querySelector('h1') : null;

  if (!row1 || !h1) return false;
  if (h1.parentNode === row1) return true;

  const drivenLogo = row1.querySelector('.dash-driven-logo');
  row1.insertBefore(h1, drivenLogo);
  row1.style.cssText =
    'display:flex !important; justify-content:space-between !important; align-items:center !important; padding:8px 20px !important; gap:16px !important;';
  h1.style.cssText = 'margin:0; font-size:20px; font-weight:600; text-align:center; flex:1;';

  if (row2) row2.style.display = 'none';
  if (row3) row3.style.display = 'none';
  return true;
}

/**
 * Ensures tab bar remains positioned under header
 */
function makeTabsSticky() {
  const h = document.getElementById('dashHeader');
  const tb = document.querySelector('.cm-tab-bar');
  if (h && tb && h.nextElementSibling !== tb) {
    h.parentNode.insertBefore(tb, h.nextSibling);
  }
}

/**
 * Accessible Modal Initialization: Purpose & Instructions
 */
function initStandardModals() {
  const btnPurpose = document.getElementById('btnPurposeHelp');
  const btnInstructions = document.getElementById('btnInstructionsHelp');
  const purposeModal = document.getElementById('purposeModal');
  const instructionsModal = document.getElementById('instructionsModal');

  if (btnPurpose && purposeModal) {
    btnPurpose.addEventListener('click', function () {
      openModal(purposeModal);
    });
  }

  if (btnInstructions && instructionsModal) {
    btnInstructions.addEventListener('click', function () {
      openModal(instructionsModal);
    });
  }

  // Setup backdrop and close button listeners for all modals
  document.querySelectorAll('.modal-backdrop').forEach(function (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeModal(modal);
      }
    });

    const closeBtns = modal.querySelectorAll('[data-dismiss="modal"]');
    closeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeModal(modal);
      });
    });
  });

  // Global Keydown Handler: Escape key dismissal & Focus Trapping
  document.addEventListener('keydown', function (e) {
    const activeModal = document.querySelector('.modal-backdrop.active');
    if (!activeModal) return;

    if (e.key === 'Escape') {
      closeModal(activeModal);
      return;
    }

    if (e.key === 'Tab') {
      trapFocus(activeModal, e);
    }
  });
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');

  const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length > 0) {
    focusable[0].focus();
  }
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function trapFocus(modal, event) {
  const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (event.shiftKey) {
    if (document.activeElement === first) {
      last.focus();
      event.preventDefault();
    }
  } else {
    if (document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }
}
