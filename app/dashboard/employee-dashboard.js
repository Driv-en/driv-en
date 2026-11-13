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
    key: 'company',
    label: 'Company Management',
    desc: 'View and manage company clients and contacts.',
    link: '/app/dashboard/company-management.html',
    perms: ['clients.view', 'clients.add', 'clients.edit', 'clients.delete', 'company.view', 'projects.view']
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

/* ===== AGGRESSIVE HEADER CLEANUP =====
   The service worker may serve a stale dashboard-header.html with the old
   3-row layout (duplicate page title). We ALWAYS rebuild the header as a
   single row, matching the test-dashboard.js reference implementation.
   A MutationObserver catches stale content as it's injected, and timed
   fallbacks ensure it runs even if the observer misses. */
function rebuildHeader() {
  var header = document.getElementById('dashHeader');
  if (!header) return;

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

// Timed fallbacks: rebuild at multiple intervals to catch SW-injected stale content
function scheduleHeaderRebuilds() {
  setTimeout(rebuildHeader, 50);
  setTimeout(rebuildHeader, 200);
  setTimeout(rebuildHeader, 500);
  setTimeout(rebuildHeader, 1000);
  setTimeout(rebuildHeader, 2000);
  setTimeout(rebuildHeader, 3000);
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
  scheduleHeaderRebuilds();

  // Bind Tab Controls
  var tabButtons = document.querySelectorAll('.emp-tab[data-tab]');
  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tabName = this.getAttribute('data-tab');
      if (tabName) switchTab(tabName);
    });
    // Keyboard accessibility: Enter/Space activates, Arrow keys navigate
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var tabName = this.getAttribute('data-tab');
        if (tabName) switchTab(tabName);
      }
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
    btnLogout.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dashLogout();
      }
    });
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

  userPermissions = user.permissions || [];

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

  // ── Unit of Measure preference dropdown ────────────────────────────
  initUomPreference();

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
  loadStats();

  // Final header rebuild safety net
  setTimeout(function () { rebuildHeader(); adjustStickyOffsets(); }, 500);
}

/* ===== UNIT OF MEASURE PREFERENCE ===== */
function initUomPreference() {
  var select = document.getElementById('welcomeUomSelect');
  var hint = document.getElementById('welcomeUomHint');
  if (!select) return;

  // Load current preference from API
  if (window.DRIVEN_UNITS && DRIVEN_UNITS.getUserUnitPreference) {
    DRIVEN_UNITS.getUserUnitPreference().then(function(info) {
      if (!info) return;
      select.value = info.user_preference || 'org_default';

      // Show what the org default is, so the user knows what "org default" means
      if (info.org_default && info.user_preference === 'org_default') {
        if (hint) hint.textContent = 'Org default: ' + (info.org_default === 'metric' ? 'Metric' : 'Imperial');
      } else if (hint) {
        hint.textContent = '';
      }
    });
  }

  // Save on change
  select.addEventListener('change', function() {
    var pref = select.value;
    if (!window.DRIVEN_UNITS || !DRIVEN_UNITS.setUserUnitPreference) return;

    DRIVEN_UNITS.setUserUnitPreference(pref).then(function(result) {
      if (!result) {
        alert('Failed to update unit preference. Please try again.');
        return;
      }

      // Update hint
      if (hint) {
        if (pref === 'org_default' && result.unit_system) {
          hint.textContent = 'Org default: ' + (result.unit_system === 'metric' ? 'Metric' : 'Imperial');
        } else {
          hint.textContent = '';
        }
      }

      // Refresh all units on the page
      if (window.DRIVEN_APPLY_UNITS) {
        DRIVEN_APPLY_UNITS.refresh();
      }

      // Notify other tabs
      try {
        localStorage.setItem('driv-en-unit-system-changed', Date.now().toString());
        localStorage.setItem('driv-en-unit-system', result.unit_system);
      } catch (e) {}
    });
  });
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
    return '<a class="emp-form-card" href="' + f.link + '">' +
      '<div style="font-weight:600;font-size:15px;margin-bottom:6px;">' + esc(f.label) + '</div>' +
      '<div style="font-size:13px;color:var(--text-muted);line-height:1.4;">' + esc(f.desc) + '</div></a>';
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
    return '<a class="emp-form-card" href="' + f.link + '">' +
      '<div style="font-weight:600;font-size:15px;margin-bottom:6px;">' + esc(f.label) + '</div>' +
      '<div style="font-size:13px;color:var(--text-muted);line-height:1.4;">' + esc(f.desc) + '</div></a>';
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

// Tab-specific Purpose & Instructions content (matches admin dashboard pattern)
var MODAL_CONTENT_MAP = {
  overview: {
    purpose: 'The <strong>Overview Tab</strong> provides a snapshot of your active operational metrics, authorized module access, quick-launch gateways to dashboard modules and operational forms, and account management tools. The specific features visible to you are determined by your assigned role and permissions.',
    instructions: '<ol><li><strong>Monitor Your Metrics:</strong> View live counts for your assigned Projects, Equipment, and Work Orders (if permitted). Click any stat card to navigate to the corresponding module.</li><li><strong>Dashboard Links:</strong> Use the card buttons below the pill bar to quickly access dashboards such as Fuel Management, Fuel Alerts, Transfers, Work Orders, and Calendar. Your available dashboards depend on your permissions.</li><li><strong>Launch Modules:</strong> Click any module card in the grid to open the corresponding tool. Only modules you have permission for are shown.</li><li><strong>Operational Forms:</strong> Use the Operational Forms card to launch field forms such as DVIR, Fuel Purchase, Fuel Transfer, Create Work Order, and Add Inspection. Only forms you have permission for are shown.</li><li><strong>Account Management:</strong> Review your logged-in credentials and use <strong>Change Password</strong> to update your account.</li><li><strong>Units of Measure:</strong> Use the <strong>Units of Measure</strong> dropdown in the welcome bar to switch between Imperial and Metric display. Choose <em>Use Org Default</em> to follow the admin\'s setting.</li></ol><p style="margin-top:8px;font-size:12px;color:var(--text-muted);"><em>Note: The features described above may vary based on your role and permissions. If you need access to additional modules or forms, contact your administrator.</em></p>'
  }
};

function getActiveContext() {
  var activeTab = document.querySelector('.emp-tab.active[data-tab]');
  if (activeTab) {
    var tabKey = activeTab.getAttribute('data-tab');
    if (MODAL_CONTENT_MAP[tabKey]) return tabKey;
  }
  return 'overview';
}

function getContextTitle(key) {
  var labels = { overview: 'Overview' };
  return labels[key] || 'Dashboard';
}

function initStandardModals() {
  var btnPurpose = document.getElementById('btnTabPurpose');
  var btnInstructions = document.getElementById('btnTabInstructions');
  var purposeModal = document.getElementById('purposeModal');
  var instructionsModal = document.getElementById('instructionsModal');

  if (btnPurpose && purposeModal) {
    btnPurpose.addEventListener('click', function () {
      var contextKey = getActiveContext();
      var title = getContextTitle(contextKey);
      var content = MODAL_CONTENT_MAP[contextKey] || MODAL_CONTENT_MAP.overview;
      var mpt = document.getElementById('purposeModalTitle');
      var mpb = document.getElementById('purposeModalBody');
      if (mpt) mpt.textContent = title + ' - Purpose';
      if (mpb) mpb.innerHTML = content.purpose;
      openModal(purposeModal);
    });
    btnPurpose.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var contextKey = getActiveContext();
        var title = getContextTitle(contextKey);
        var content = MODAL_CONTENT_MAP[contextKey] || MODAL_CONTENT_MAP.overview;
        var mpt = document.getElementById('purposeModalTitle');
        var mpb = document.getElementById('purposeModalBody');
        if (mpt) mpt.textContent = title + ' - Purpose';
        if (mpb) mpb.innerHTML = content.purpose;
        openModal(purposeModal);
      }
    });
  }

  if (btnInstructions && instructionsModal) {
    btnInstructions.addEventListener('click', function () {
      var contextKey = getActiveContext();
      var title = getContextTitle(contextKey);
      var content = MODAL_CONTENT_MAP[contextKey] || MODAL_CONTENT_MAP.overview;
      var mit = document.getElementById('instructionsModalTitle');
      var mib = document.getElementById('instructionsModalBody');
      if (mit) mit.textContent = title + ' - Instructions';
      if (mib) mib.innerHTML = content.instructions;
      openModal(instructionsModal);
    });
    btnInstructions.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var contextKey = getActiveContext();
        var title = getContextTitle(contextKey);
        var content = MODAL_CONTENT_MAP[contextKey] || MODAL_CONTENT_MAP.overview;
        var mit = document.getElementById('instructionsModalTitle');
        var mib = document.getElementById('instructionsModalBody');
        if (mit) mit.textContent = title + ' - Instructions';
        if (mib) mib.innerHTML = content.instructions;
        openModal(instructionsModal);
      }
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
