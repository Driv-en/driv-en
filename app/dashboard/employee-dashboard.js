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

function initEmployeeDashboard() {
  // Bind Tab Controls
  const tabButtons = document.querySelectorAll('.emp-tab[data-tab]');
  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const tabName = this.getAttribute('data-tab');
      if (tabName) switchTab(tabName);
    });
  });

  // Bind Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', dashLogout);
  }

  // Bind Standardized Modals (Purpose & Instructions)
  initStandardModals();

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

  userPermissions = user.permissions || [];

  var firstName = user.first_name || user.full_name || '';
  var orgName = user.org_name || '';
  var welcomeEl = document.getElementById('welcome-name');
  if (welcomeEl) {
    if (firstName && orgName) {
      welcomeEl.innerHTML = esc(firstName) + ' <span style="font-weight:400;color:var(--text-muted);font-size:18px;">&mdash; ' + esc(orgName) + '</span>';
    } else {
      welcomeEl.textContent = firstName || user.email;
    }
  }

  var roleEl = document.getElementById('welcome-role');
  if (roleEl) {
    roleEl.textContent = 'Role: ' + (user.role || 'Employee') + ' \u2014 Your dashboard shows the modules and tools you have access to.';
  }

  insertHeaderTitle();

  var loadingEl = document.getElementById('loading');
  var dashboardEl = document.getElementById('dashboard');
  if (loadingEl) loadingEl.style.display = 'none';
  if (dashboardEl) dashboardEl.style.display = 'block';

  renderModules();
  renderFormLinks();
  renderFormsTab();
  loadStats();
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
      return '<div class="emp-module-card" data-href="' + m.link + '">' +
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
async function loadStats() {
  var showStats = false;
  var user = window.dashUser || {};
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
  document.querySelectorAll('.emp-tab').forEach(function (t) {
    t.classList.remove('active');
  });
  document.querySelectorAll('.emp-tab-content').forEach(function (c) {
    c.classList.remove('active');
  });

  var tabBtn = document.querySelector('.emp-tab[data-tab="' + tabName + '"]');
  if (tabBtn) tabBtn.classList.add('active');

  var tabContent = document.getElementById('tab-' + tabName);
  if (tabContent) tabContent.classList.add('active');

  if (tabName === 'forms') renderFormsTab();
}

/* ===== HEADER TITLE ===== */
function insertHeaderTitle() {
  var row1 = document.querySelector('.dash-header-row1');
  if (row1 && !document.querySelector('.emp-header-title')) {
    var title = document.createElement('div');
    title.className = 'emp-header-title';
    title.textContent = 'Dashboard';
    var logoArea = document.getElementById('dashCustomerLogoArea');
    var drivenLogo = row1.querySelector('.dash-driven-logo');
    if (logoArea && drivenLogo) row1.insertBefore(title, drivenLogo);
  }
}

/* ===== LOGOUT ===== */
function dashLogout() {
  try {
    fetch('/auth/logout', { method: 'POST' });
  } catch (e) {}
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
