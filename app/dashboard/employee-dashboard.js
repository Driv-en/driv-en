/**
 * DRIV-EN — Employee Dashboard Page Logic
 * File: /app/dashboard/employee-dashboard.js
 */

/* ===== MODULE DEFINITIONS ===== */
var MODULES = [
  {
    key: 'fuel',
    label: 'Fuel Management',
    desc: 'Tank levels, fuel transactions, inventory tracking, and ownership badges.',
    link: '/app/dashboard/fuel.html',
    perms: ['fuel.view', 'fuel.add', 'fuel.edit', 'fuel.delete']
  },
  {
    key: 'fuel_alerts',
    label: 'Fuel Alerts',
    desc: 'Capacity flags, consumption anomalies, and notification settings.',
    link: '/app/dashboard/fuel-alerts.html',
    perms: ['fuel_flags.view', 'fuel_flags.resolve']
  },
  {
    key: 'transfers',
    label: 'Transfers',
    desc: 'Equipment transfer tickets, status tracking, and delivery event trails.',
    link: '/app/dashboard/transfers.html',
    perms: ['transfer.view', 'transfer.add', 'transfer.edit', 'transfer.delete']
  },
  {
    key: 'work_orders',
    label: 'Work Orders',
    desc: 'Maintenance tickets, checklists, parts tracking, and completion status.',
    link: '/app/dashboard/work-orders.html',
    perms: ['wo.view', 'wo.add', 'wo.edit', 'wo.delete', 'wo.assign', 'wo.clock', 'wo.template_view', 'wo.template_add', 'workorders.view', 'workorders.add', 'workorders.edit', 'workorders.delete']
  },
  {
    key: 'equipment',
    label: 'Equipment',
    desc: 'Manage fleet, assignments, meter readings, and service history.',
    link: null,
    perms: ['equipment.view', 'equipment.add', 'equipment.edit', 'equipment.delete', 'equipment.meter']
  },
  {
    key: 'inspections',
    label: 'Inspections',
    desc: 'View, create, and manage equipment inspections.',
    link: null,
    perms: ['inspections.view', 'inspections.add', 'inspections.edit', 'inspections.delete']
  },
  {
    key: 'pm',
    label: 'Preventive Maintenance',
    desc: 'PM schedules, intervals, and upcoming service reminders.',
    link: null,
    perms: ['pm.view', 'pm.add', 'pm.edit', 'pm.delete']
  },
  {
    key: 'safety',
    label: 'Safety',
    desc: 'Safety forms, compliance documentation, and hazard reports.',
    link: null,
    perms: ['safety.view', 'safety.add', 'safety.edit', 'safety.approve']
  },
  {
    key: 'projects',
    label: 'Projects',
    desc: 'View, create, and manage projects and jobsites.',
    link: null,
    perms: ['project.view', 'project.add', 'project.edit', 'project.view_all', 'projects.view', 'projects.add', 'projects.edit', 'projects.delete']
  },
  {
    key: 'employees',
    label: 'Employees',
    desc: 'View and manage employee records.',
    link: null,
    perms: ['employees.view', 'employees.add', 'employees.edit', 'employees.delete']
  },
  {
    key: 'users',
    label: 'Employee Management',
    desc: 'Manage users, roles, and permissions.',
    link: '/app/dashboard/user-management.html',
    perms: ['users.view', 'users.add', 'users.edit', 'users.delete', 'user.manage']
  },
  {
    key: 'reports',
    label: 'Reports',
    desc: 'View and export operational reports.',
    link: null,
    perms: ['reports.view', 'reports.export']
  },
  {
    key: 'extraction',
    label: 'AI Extraction',
    desc: 'Submit files for AI extraction and review results.',
    link: null,
    perms: ['extraction.view', 'extraction.add', 'extraction.review']
  },
  {
    key: 'settings',
    label: 'Company Settings',
    desc: 'View and edit company settings and configuration.',
    link: null,
    perms: ['settings.view', 'settings.edit', 'org_settings.edit']
  }
];

/* ===== FORM DEFINITIONS ===== */
var FORMS = [
  { key: 'fuel_log', label: 'Log Fuel Purchase', desc: 'Record a fuel purchase', link: '/app/forms/fuel-purchase.html', perm: 'fuel.add' },
  { key: 'fuel_transfer', label: 'Log Fuel Transfer', desc: 'Transfer fuel between tanks or to equipment', link: '/app/forms/fuel-transfer.html', perm: 'fuel.add' },
  { key: 'transfer_create', label: 'Create Transfer', desc: 'Start an equipment transfer ticket', link: '/app/forms/transfer-create.html', perm: 'transfer.add' },
  { key: 'wo_create', label: 'Create Work Order', desc: 'Submit a maintenance request', link: '/app/forms/work-order-create.html', perm: 'wo.add' },
  { key: 'inspection_add', label: 'Add Inspection', desc: 'Record an equipment inspection', link: '/app/forms/inspection.html', perm: 'inspections.add' },
  { key: 'safety_add', label: 'Safety Form', desc: 'Submit a safety form or hazard report', link: '/app/forms/safety.html', perm: 'safety.add' },
  { key: 'pm_add', label: 'Add PM', desc: 'Create a preventive maintenance task', link: '/app/forms/pm.html', perm: 'pm.add' }
];

/* ===== STATE ===== */
var userPermissions = [];

document.addEventListener('DOMContentLoaded', function () {
  initEmployeeDashboard();
});

/* ===== HEADER NORMALIZATION ===== */
function rebuildHeader() {
  var header = document.getElementById('dashHeader');
  if (!header) return;

  var rows = header.querySelectorAll('.dash-header-row1, .dash-header-row2, .dash-header-row3, .dash-utility-bar');
  if (
    rows.length === 1 &&
    header.querySelector('.dash-header-row1') &&
    header.querySelectorAll('h1').length === 1 &&
    header.querySelector('#dashPageTitle')
  ) return;

  var title = document.body.getAttribute('data-page-title') || 'Dashboard';

  // Grab the customer logo area if it exists (preserve loaded logo)
  var logoArea = header.querySelector('#dashCustomerLogoArea');
  var drivenLogo = header.querySelector('.dash-driven-logo') || header.querySelector('img.dash-driven-logo');

  // Nuke everything
  header.innerHTML = '';

  // Rebuild single-row header
  var dashHeader = document.createElement('div');
  dashHeader.className = 'dash-header';

  var row1 = document.createElement('div');
  row1.className = 'dash-header-row1';

  // Left: customer logo
  var left = document.createElement('div');
  left.className = 'dash-header-logo-left';
  if (logoArea) {
    left.appendChild(logoArea);
  } else {
    var ph = document.createElement('div');
    ph.id = 'dashCustomerLogoArea';
    ph.innerHTML = '<div class="dash-customer-logo-placeholder">No logo uploaded</div>';
    left.appendChild(ph);
  }
  row1.appendChild(left);

  // Center: ONE page title only
  var h1 = document.createElement('h1');
  h1.id = 'dashPageTitle';
  h1.className = 'dash-header-title';
  h1.textContent = title;
  row1.appendChild(h1);

  // Right: DRIV-EN logo
  var right = document.createElement('div');
  right.className = 'dash-header-logo-right';
  if (drivenLogo) {
    right.appendChild(drivenLogo);
  } else {
    var img = document.createElement('img');
    img.src = '/assets/logo.png?v=2026';
    img.className = 'dash-driven-logo';
    img.alt = 'DRIV-EN Logo';
    right.appendChild(img);
  }
  row1.appendChild(right);

  dashHeader.appendChild(row1);
  header.appendChild(dashHeader);
}

// MutationObserver: rebuild whenever old-layout content is injected into #dashHeader
function startHeaderObserver() {
  var header = document.getElementById('dashHeader');
  if (!header) return;

  var observer = new MutationObserver(function () {
    var h1s = header.querySelectorAll('h1');
    var rows = header.querySelectorAll('.dash-header-row1, .dash-header-row2, .dash-header-row3, .dash-utility-bar');
    if (h1s.length > 1 || rows.length > 1) {
      observer.disconnect();
      rebuildHeader();
      setTimeout(function () { startHeaderObserver(); }, 100);
    }
  });
  observer.observe(header, { childList: true, subtree: true });
}

/* ===== STICKY OFFSET ADJUSTMENT ===== */
function adjustStickyOffsets() {
  var header = document.getElementById('dashHeader');
  var stickyContainer = document.getElementById('empNavStickyContainer');
  if (header && stickyContainer) {
    var headerHeight = header.getBoundingClientRect().height || header.offsetHeight || 50;
    stickyContainer.style.top = headerHeight + 'px';
  }
}

function initEmployeeDashboard() {
  // Aggressive header rebuild
  rebuildHeader();
  startHeaderObserver();

  // Bind Tab Controls
  var tabButtons = document.querySelectorAll('.emp-tab[data-tab]');
  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tabName = this.getAttribute('data-tab');
      if (tabName) switchTab(tabName);
    });
    // Buttons handle Enter/Space natively; Arrow keys provide tab navigation.
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var tabs = Array.from(document.querySelectorAll('.emp-tab[data-tab]'));
        var idx = tabs.indexOf(this);
        var next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
        tabs[next].focus();
      }
    });
  });

  // Initialize roving tabindex: active tab gets 0, inactive get -1
  document.querySelectorAll('.emp-tab[data-tab]').forEach(function (btn) {
    btn.setAttribute('tabindex', btn.classList.contains('active') ? '0' : '-1');
  });

  // Bind Logout
  var btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', dashLogout);
  }

  // Bind Standardized Modals (Purpose & Instructions)
  initStandardModals();

  // Sticky offset adjustments
  window.addEventListener('resize', adjustStickyOffsets);
  window.addEventListener('orientationchange', adjustStickyOffsets);
  window.addEventListener('scroll', adjustStickyOffsets, { passive: true });
  window.addEventListener('load', adjustStickyOffsets);

  // Listen for Dashboard Session Ready Signal
  document.addEventListener('dashSessionLoaded', handleSessionLoaded);
}

/* ===== SESSION INITIALIZATION ===== */
async function handleSessionLoaded() {
  var user = window.dashUser;
  if (!user) {
    try {
      user = JSON.parse(localStorage.getItem('driven_user') || sessionStorage.getItem('driven_user'));
    } catch (e) {}
  }

  if (!user) {
    window.location.href = '/public/login.html';
    return;
  }

  var role = (user.role || '').toLowerCase();
  if (role === 'admin') {
    window.location.href = '/app/dashboard/admin.html';
    return;
  }
  if (role === 'driv-en founder' || role === 'owner') {
    window.location.href = '/app/dashboard/owner-dashboard.html';
    return;
  }

  userPermissions = Array.isArray(user.permissions) ? user.permissions : [];

  var firstName = user.first_name || user.full_name || '';
  var orgName = user.org_name || '';

  // Welcome greeting — matches admin/onboarding pattern
  var welcomeEl = document.getElementById('welcome-name');
  if (welcomeEl) {
    welcomeEl.textContent = firstName ? ('Welcome back, ' + firstName + (orgName ? ' - ' + orgName : '')) : 'Welcome back';
  }

  // Role + Email in welcome details
  var elRole = document.getElementById('welcome-role');
  if (elRole) elRole.textContent = user.role || user.role_id || 'Employee';

  var elEmail = document.getElementById('welcome-email');
  if (elEmail) elEmail.textContent = user.email || '';

  // Rebuild header as single row + adjust sticky offsets
  rebuildHeader();
  adjustStickyOffsets();

  var loadingEl = document.getElementById('loading');
  var dashboardEl = document.getElementById('dashboard');
  if (loadingEl) loadingEl.style.display = 'none';
  if (dashboardEl) dashboardEl.style.display = 'block';

  renderModules();
  renderFormLinks();
  renderFormsTab();
  loadStats(user);

  // Final header rebuild safety net
  setTimeout(function () { rebuildHeader(); adjustStickyOffsets(); }, 500);
}

/* ===== HELPERS ===== */
function hasPermission(perm) {
  return userPermissions.indexOf(perm) !== -1;
}

function hasAnyPermission(perms) {
  for (var i = 0; i < perms.length; i++) {
    if (hasPermission(perms[i])) return true;
  }
  return false;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ===== RENDER MODULES ===== */
function renderModules() {
  var container = document.getElementById('empModules');
  if (!container) return;
  
  var visibleModules = MODULES.filter(function (m) {
    return hasAnyPermission(m.perms);
  });

  var emptyEl = document.getElementById('empEmpty');

  if (visibleModules.length === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  container.innerHTML = visibleModules.map(function (m) {
    var cardContent =
      '<div class="emp-module-title">' + esc(m.label) + '</div>' +
      '<div class="emp-module-body">' + esc(m.desc) + '</div>';

    if (m.link) {
      return '<div class="emp-module-card" data-href="' + m.link + '" role="button" tabindex="0">' +
        cardContent + '<div class="emp-module-link">Open &rarr;</div></div>';
    } else {
      return '<div class="emp-module-card" style="opacity:0.7;cursor:default;" title="Dashboard coming soon">' +
        cardContent + '<div class="emp-module-link" style="color:var(--text-muted);">Coming soon</div></div>';
    }
  }).join('');

  // Dynamic Event Binding for module cards
  container.querySelectorAll('.emp-module-card[data-href]').forEach(function (card) {
    card.addEventListener('click', function () {
      var href = this.getAttribute('data-href');
      if (href) window.location.href = href;
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var href = this.getAttribute('data-href');
        if (href) window.location.href = href;
      }
    });
  });
}

/* ===== RENDER FORM LINKS ===== */
function renderFormLinks() {
  var container = document.getElementById('empFormLinks');
  var section = document.getElementById('empFormLinksSection');
  if (!container || !section) return;

  var visibleForms = FORMS.filter(function (f) {
    return hasPermission(f.perm);
  });

  if (visibleForms.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = visibleForms.map(function (f) {
    return '<a class="emp-form-link" href="' + f.link + '">' +
      '<div class="emp-form-link-title">' + esc(f.label) + '</div>' +
      '<div class="emp-form-link-desc">' + esc(f.desc) + '</div></a>';
  }).join('');
}

/* ===== RENDER FORMS TAB ===== */
function renderFormsTab() {
  var container = document.getElementById('empFormsTabLinks');
  var empty = document.getElementById('empFormsEmpty');
  if (!container || !empty) return;

  var visibleForms = FORMS.filter(function (f) {
    return hasPermission(f.perm);
  });

  if (visibleForms.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = visibleForms.map(function (f) {
    return '<a class="emp-form-link" href="' + f.link + '">' +
      '<div class="emp-form-link-title">' + esc(f.label) + '</div>' +
      '<div class="emp-form-link-desc">' + esc(f.desc) + '</div></a>';
  }).join('');
}

/* ===== LOAD STATS ===== */
async function loadStats(sessionUser) {
  var showStats = false;
  var user = sessionUser || window.dashUser || {};
  var headers = {
    'x-org-id': user.org_id || '',
    'x-user-id': user.id || ''
  };

  if (hasAnyPermission(['project.view', 'project.view_all', 'projects.view'])) {
    showStats = true;
    try {
      var resp = await fetch('/api/projects?mine=1', { headers: headers });
      var data = await resp.json();
      if (data.success) {
        var el = document.getElementById('stat-projects');
        if (el) el.textContent = (data.projects || []).length;
      }
    } catch (e) {}
  }

  if (hasAnyPermission(['equipment.view', 'equipment.add', 'equipment.edit'])) {
    showStats = true;
    try {
      var resp = await fetch('/api/equipment', { headers: headers });
      var data = await resp.json();
      if (data.success) {
        var el = document.getElementById('stat-equipment');
        if (el) el.textContent = (data.equipment || []).length;
      }
    } catch (e) {}
  }

  if (hasAnyPermission(['wo.view', 'workorders.view'])) {
    showStats = true;
    try {
      var resp = await fetch('/api/work-orders?status=open', { headers: headers });
      var data = await resp.json();
      if (data.success) {
        var el = document.getElementById('stat-workorders');
        if (el) el.textContent = (data.work_orders || []).length;
      }
    } catch (e) {}
  }

  if (hasAnyPermission(['transfer.view'])) {
    showStats = true;
    try {
      var resp = await fetch('/api/transfers?status=open', { headers: headers });
      var data = await resp.json();
      if (data.success) {
        var el = document.getElementById('stat-transfers');
        if (el) el.textContent = (data.transfers || []).length;
      }
    } catch (e) {}
  }

  if (showStats) {
    var statsGrid = document.getElementById('empStats');
    if (statsGrid) statsGrid.style.display = 'grid';
  }
}

/* ===== TAB SWITCHING ===== */
function switchTab(tabName) {
  document.querySelectorAll('.emp-tab[data-tab]').forEach(function (t) {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
    t.setAttribute('tabindex', '-1');
  });
  document.querySelectorAll('.emp-tab-content').forEach(function (c) {
    c.classList.remove('active');
  });

  var tabBtn = document.querySelector('.emp-tab[data-tab="' + tabName + '"]');
  if (tabBtn) {
    tabBtn.classList.add('active');
    tabBtn.setAttribute('aria-selected', 'true');
    tabBtn.setAttribute('tabindex', '0');
  }

  var tabContent = document.getElementById('tab-' + tabName);
  if (tabContent) tabContent.classList.add('active');

  if (tabName === 'forms') renderFormsTab();
  adjustStickyOffsets();
}

/* ===== LOGOUT ===== */
async function dashLogout() {
  try {
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 3000);
    await fetch('/auth/logout', { method: 'POST', signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (e) {
    // Network error, timeout, or abort — proceed to login page regardless
  }
  window.location.href = '/public/login.html';
}
window.dashLogout = dashLogout;

/* ===== STANDARDIZED MODALS ===== */
function initStandardModals() {
  var btnPurpose = document.getElementById('btnPurposeHelp');
  var btnInstructions = document.getElementById('btnInstructionsHelp');
  var purposeModal = document.getElementById('purposeModal');
  var instructionsModal = document.getElementById('instructionsModal');

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

  document.querySelectorAll('.modal-backdrop').forEach(function (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal(modal);
    });

    var closeBtns = modal.querySelectorAll('[data-dismiss="modal"]');
    closeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeModal(modal);
      });
    });
  });

  document.addEventListener('keydown', function (e) {
    var activeModal = document.querySelector('.modal-backdrop.active');
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

  var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length > 0) focusable[0].focus();
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function trapFocus(modal, event) {
  var focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusables.length === 0) return;

  var first = focusables[0];
  var last = focusables[focusables.length - 1];

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
