/**
 * user-management.js -- DRIV-EN Employee Management Dashboard (v1)
 *
 * Extracted from user-management.html inline script.
 * Handles: employees, system users, roles & permissions, activity log.
 *
 * Includes rebuildHeader() to handle stale 3-row SW header template.
 *
 * Load order: auth-check.js -> dashboard-common.js -> units-global.js -> apply-units.js -> voice.js -> this file
 */

// ============================================================
// STATE
// ============================================================
var allUsers = [], allEmployees = [], allOrgRoles = [], allActivityLogs = [];
var currentUserOrgId = null;
var activeModalType = 'emp';

var paginationState = {
  emp: { currentPage: 1, pageSize: 10 },
  user: { currentPage: 1, pageSize: 10 },
  activity: { currentPage: 1, pageSize: 10 }
};

var sortState = {
  emp: { key: 'fullName', dir: 'asc' },
  user: { key: 'fullName', dir: 'asc' },
  roles: { key: 'name', dir: 'asc' },
  activity: { key: 'created_at', dir: 'desc' }
};

var USER_COL_DEFS = [
  { key: 'id', label: 'User ID', defaultWidth: '120px', frozen: true },
  { key: 'fullName', label: 'Full Name', defaultWidth: '160px', frozen: true },
  { key: 'email', label: 'Email', defaultWidth: '200px' },
  { key: 'role', label: 'Role', defaultWidth: '140px' },
  { key: 'is_active', label: 'Status', defaultWidth: '110px' },
  { key: 'must_change_password', label: 'Must Reset Pwd', defaultWidth: '130px' },
  { key: 'twofa_enabled', label: '2FA Enabled', defaultWidth: '110px' },
  { key: 'last_login', label: 'Last Login', defaultWidth: '160px' }
];

var EMP_COL_DEFS = [
  { key: 'fullName', label: 'Full Name', defaultWidth: '180px', frozen: true },
  { key: 'employeeNumber', label: 'Emp #', defaultWidth: '100px' },
  { key: 'email', label: 'Email', defaultWidth: '190px' },
  { key: 'role', label: 'Role', defaultWidth: '130px' },
  { key: 'phone', label: 'Phone', defaultWidth: '130px' },
  { key: 'status', label: 'Status', defaultWidth: '100px' },
  { key: 'dob', label: 'DOB', defaultWidth: '110px' },
  { key: 'address', label: 'Address', defaultWidth: '160px' },
  { key: 'city', label: 'City', defaultWidth: '120px' },
  { key: 'state', label: 'State', defaultWidth: '80px' },
  { key: 'zip', label: 'Zip', defaultWidth: '90px' },
  { key: 'driversLicense', label: 'DL Number', defaultWidth: '130px' },
  { key: 'dlState', label: 'DL State', defaultWidth: '80px' }
];

var ROLE_COL_DEFS = [
  { key: 'name', label: 'Role Name', defaultWidth: '220px' },
  { key: 'description', label: 'Description', defaultWidth: '400px' },
  { key: 'is_system', label: 'System Role', defaultWidth: '150px' }
];

var ACT_COL_DEFS = [
  { key: 'created_at', label: 'Timestamp', defaultWidth: '180px' },
  { key: 'user_name', label: 'Full Name', defaultWidth: '180px' },
  { key: 'module', label: 'Module / Page', defaultWidth: '140px' },
  { key: 'action', label: 'Action Details', defaultWidth: '260px' },
  { key: 'ip_address', label: 'IP Address', defaultWidth: '130px' }
];

var visibleUserCols = {}, userColWidths = {};
var visibleEmpCols = {}, empColWidths = {};

// ============================================================
// HEADER REBUILD -- handles stale 3-row SW header template
// (dashboard-common.js async-injects stale template; CSS alone fails)
// ============================================================
function rebuildHeader() {
  var container = document.getElementById('dashHeader');
  if (!container) return;

  // Build single-row header: logo | title | logo
  var html = '<div class="dash-header">' +
    '<div class="dash-header-row1" style="display:flex;align-items:center;justify-content:space-between;padding:8px 20px;">';

  // Left logo
  html += '<div class="dash-header-left" style="flex:0 0 auto;">';
  var logo = localStorage.getItem('driven_logo_url');
  if (logo) {
    html += '<img src="' + logo + '" alt="Logo" style="max-height:40px;max-width:120px;object-fit:contain;">';
  } else {
    html += '<div style="font-size:18px;font-weight:700;color:var(--primary-blue,#2563eb);">DRIV-EN</div>';
  }
  html += '</div>';

  // Center title
  html += '<div class="admin-header-title" style="flex:1;text-align:center;font-size:20px;font-weight:600;color:var(--text);">Employee Management</div>';

  // Right logo (mirror)
  html += '<div class="dash-header-right" style="flex:0 0 auto;">';
  if (logo) {
    html += '<img src="' + logo + '" alt="Logo" style="max-height:40px;max-width:120px;object-fit:contain;">';
  } else {
    html += '<div style="font-size:18px;font-weight:700;color:var(--primary-blue,#2563eb);">DRIV-EN</div>';
  }
  html += '</div>';

  html += '</div></div>';

  container.innerHTML = html;
}

function startHeaderObserver() {
  var container = document.getElementById('dashHeader');
  if (!container) return;

  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType === 1) {
          // Check for stale multi-row header injection
          var h1s = container.querySelectorAll('h1');
          var rows = container.querySelectorAll('.dash-header-row2, .dash-header-row3');
          if (h1s.length > 1 || rows.length > 0) {
            rebuildHeader();
            return;
          }
        }
      }
    }
  });

  observer.observe(container, { childList: true, subtree: true });
}

function scheduleHeaderRebuilds() {
  rebuildHeader();
  setTimeout(rebuildHeader, 50);
  setTimeout(rebuildHeader, 200);
  setTimeout(rebuildHeader, 500);
  setTimeout(rebuildHeader, 1000);
  setTimeout(rebuildHeader, 2000);
  setTimeout(rebuildHeader, 3000);
}

// ============================================================
// STICKY HEADER HELPERS
// ============================================================
function sanitizeStickyAncestors() {
  var node = document.getElementById("dashHeader");
  while (node && node !== document.documentElement) {
    if (node !== document.getElementById("dashHeader")) {
      var style = window.getComputedStyle(node);
      if (style.overflow !== 'visible' || style.overflowX !== 'visible' || style.overflowY !== 'visible') {
        node.style.setProperty('overflow', 'visible', 'important');
        node.style.setProperty('overflow-x', 'visible', 'important');
        node.style.setProperty('overflow-y', 'visible', 'important');
      }
    }
    node = node.parentElement;
  }
}

function makeTabsSticky() {
  sanitizeStickyAncestors();
  var h = document.getElementById("dashHeader");
  var tb = document.getElementById("umTabBar");
  if (h && tb) {
    var rect = h.getBoundingClientRect();
    var hHeight = rect.height || (window.innerWidth <= 768 ? 50 : 58);
    document.documentElement.style.setProperty('--header-height', hHeight + 'px');

    if (h.nextElementSibling !== tb) {
      h.parentNode.insertBefore(tb, h.nextSibling);
    }
  }
}

// ============================================================
// PAGINATION
// ============================================================
function changePageSize(type, size) {
  paginationState[type].pageSize = parseInt(size, 10);
  paginationState[type].currentPage = 1;
  if (type === 'emp') renderEmpTable();
  else if (type === 'user') renderUserTable();
  else if (type === 'activity') renderActivityLogTable();
}

function changePage(type, delta) {
  paginationState[type].currentPage += delta;
  if (type === 'emp') renderEmpTable();
  else if (type === 'user') renderUserTable();
  else if (type === 'activity') renderActivityLogTable();
}

function updatePaginationUI(type, totalRecords) {
  var state = paginationState[type];
  var totalPages = Math.ceil(totalRecords / state.pageSize) || 1;
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;
  var start = totalRecords === 0 ? 0 : ((state.currentPage - 1) * state.pageSize) + 1;
  var end = Math.min(state.currentPage * state.pageSize, totalRecords);

  var infoEl = document.getElementById(type + 'PageInfo');
  var numEl = document.getElementById(type + 'PageNum');
  var prevBtn = document.getElementById(type + 'PrevBtn');
  var nextBtn = document.getElementById(type + 'NextBtn');

  if (infoEl) infoEl.textContent = 'Showing ' + start + ' - ' + end + ' of ' + totalRecords;
  if (numEl) numEl.textContent = 'Page ' + state.currentPage + ' of ' + totalPages;
  if (prevBtn) prevBtn.disabled = (state.currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (state.currentPage >= totalPages);
}

// ============================================================
// UTILITIES
// ============================================================
function formatUserLocalTime(dateStr) {
  if (!dateStr || dateStr === '\u2014') return '\u2014';
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short'
    });
  } catch (e) { return dateStr; }
}

function resolveFullNameFromEmail(email) {
  if (!email || email === '\u2014') return 'System / Guest';
  var targetEmail = email.toLowerCase().trim();
  var matchEmp = allEmployees.find(function(e) { return (e.email || '').toLowerCase() === targetEmail; });
  if (matchEmp && matchEmp.name) return matchEmp.name;
  var matchUser = allUsers.find(function(u) { return (u.email || '').toLowerCase() === targetEmail; });
  if (matchUser && matchUser.fullName) return matchUser.fullName;
  return email;
}

function showToast(msg, type) {
  var t = document.getElementById('umToast');
  t.textContent = msg;
  t.className = 'um-toast show ' + (type || 'success');
  setTimeout(function() { t.classList.remove('show'); }, 3500);
}

function parseVal(val) {
  if (val === undefined || val === null) return '\u2014';
  var str = String(val).trim();
  return (str === '' || str === 'null' || str === 'undefined') ? '\u2014' : str;
}

function normalizeRoleName(r) {
  var name = parseVal(r);
  if (name === 'Administrator') return 'Admin';
  return name;
}

function escapeHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function normalizeUser(r) {
  return {
    id: parseVal(r.id),
    fullName: parseVal(r.full_name || r.name || ([r.first_name, r.last_name].filter(Boolean).join(' '))) || parseVal(r.email),
    email: parseVal(r.email),
    role: normalizeRoleName(r.role || r.role_id || r.role_name),
    is_active: (r.is_active === 1 || r.is_active === true || r.status === 'Active' || r.status === 'active') ? 'Active' : 'Inactive',
    must_change_password: (r.must_change_password === 1 || r.must_change_password === true) ? 'Yes' : 'No',
    twofa_enabled: (r.twofa_enabled === 1 || r.twofa_enabled === true) ? 'Yes' : 'No',
    last_login: formatUserLocalTime(r.last_login || r.last_login_at)
  };
}

function normalizeEmployee(r) {
  var fn = parseVal(r.first_name || r.firstName);
  var mn = parseVal(r.middle_name || r.middleName);
  var ln = parseVal(r.last_name || r.lastName);
  var suf = parseVal(r.suffix);
  var computedFull = [fn, mn, ln].filter(function(x) { return x && x !== '\u2014'; }).join(' ') + (suf && suf !== '\u2014' ? ' ' + suf : '');
  var fullName = parseVal(r.full_name || r.fullName || r.name || computedFull);

  return {
    id: parseVal(r.id),
    employeeNumber: parseVal(r.employeeNumber || r.employee_number || ('EMP-' + Math.floor(100 + Math.random() * 900))),
    firstName: fn, middleName: mn, lastName: ln, suffix: suf,
    fullName: fullName !== '\u2014' ? fullName : '\u2014',
    name: fullName,
    email: parseVal(r.email),
    role: normalizeRoleName(r.role),
    status: parseVal(r.status || 'Active'),
    phone: parseVal(r.phone),
    dob: parseVal(r.dob),
    address: parseVal(r.address),
    city: parseVal(r.city),
    state: parseVal(r.state),
    zip: parseVal(r.zip),
    driversLicense: parseVal(r.drivers_license || r.driversLicense),
    dlState: parseVal(r.dl_state || r.dlState)
  };
}

function sortArray(list, key, dir) {
  return list.slice().sort(function(a, b) {
    var valA = (a[key] !== undefined && a[key] !== null) ? a[key].toString().toLowerCase() : '';
    var valB = (b[key] !== undefined && b[key] !== null) ? b[key].toString().toLowerCase() : '';
    if (valA < valB) return dir === 'asc' ? -1 : 1;
    if (valA > valB) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

// ============================================================
// SORT
// ============================================================
function toggleSort(type, key) {
  if (sortState[type].key === key) {
    sortState[type].dir = sortState[type].dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState[type].key = key;
    sortState[type].dir = 'asc';
  }
  if (type === 'emp') { renderEmpTableHead(); renderEmpTable(); }
  else if (type === 'user') { renderUserTableHead(); renderUserTable(); }
  else if (type === 'roles') { updateSortIcons('roles'); renderRolesTable(); }
  else if (type === 'activity') { updateSortIcons('activity'); renderActivityLogTable(); }
}

function updateSortIcons(type) {
  document.querySelectorAll('#tab-' + type + ' .um-sort-icon').forEach(function(el) { el.textContent = ''; });
  var activeEl = document.getElementById('sort-' + type + '-' + sortState[type].key);
  if (activeEl) { activeEl.textContent = sortState[type].dir === 'asc' ? '\u25B2' : '\u25BC'; }
}

// ============================================================
// INITIALIZE
// ============================================================
async function initializeUserManagementPage() {
  // Rebuild header first
  scheduleHeaderRebuilds();
  startHeaderObserver();
  makeTabsSticky();
  setTimeout(makeTabsSticky, 100);
  setTimeout(makeTabsSticky, 500);

  var u = window.dashUser || window.drivenUser;
  if (!u) {
    try { u = JSON.parse(localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user")); } catch(e) {}
  }
  if (!u) { window.location.href = '/public/login.html'; return; }
  window.dashUser = u;
  currentUserOrgId = u.org_id || localStorage.getItem('driven_org_id') || u.customerId;

  USER_COL_DEFS.forEach(function(c) { userColWidths[c.key] = c.defaultWidth; });
  EMP_COL_DEFS.forEach(function(c) { empColWidths[c.key] = c.defaultWidth; });

  try {
    var savedEmpWidths = localStorage.getItem('um_emp_col_widths');
    if (savedEmpWidths) Object.assign(empColWidths, JSON.parse(savedEmpWidths));
    var savedUserWidths = localStorage.getItem('um_user_col_widths');
    if (savedUserWidths) Object.assign(userColWidths, JSON.parse(savedUserWidths));

    var savedEmpOrder = localStorage.getItem('um_emp_col_order');
    if (savedEmpOrder) {
      var keys = JSON.parse(savedEmpOrder);
      if (!keys.includes('fullName') || keys.includes('firstName')) {
        localStorage.removeItem('um_emp_col_order');
        localStorage.removeItem('um_visible_emp_cols');
      } else {
        EMP_COL_DEFS.sort(function(a, b) { return keys.indexOf(a.key) - keys.indexOf(b.key); });
      }
    }

    var savedUserOrder = localStorage.getItem('um_user_col_order');
    if (savedUserOrder) {
      var ukeys = JSON.parse(savedUserOrder);
      USER_COL_DEFS.sort(function(a, b) { return ukeys.indexOf(a.key) - ukeys.indexOf(b.key); });
    }

    var savedEmpCols = localStorage.getItem('um_visible_emp_cols');
    if (savedEmpCols) { visibleEmpCols = JSON.parse(savedEmpCols); }
    else { EMP_COL_DEFS.forEach(function(c) { visibleEmpCols[c.key] = true; }); }

    var savedUserCols = localStorage.getItem('um_visible_user_cols');
    if (savedUserCols) { visibleUserCols = JSON.parse(savedUserCols); }
    else { USER_COL_DEFS.forEach(function(c) { visibleUserCols[c.key] = true; }); }
  } catch (e) {
    EMP_COL_DEFS.forEach(function(c) { visibleEmpCols[c.key] = true; });
    USER_COL_DEFS.forEach(function(c) { visibleUserCols[c.key] = true; });
  }

  await Promise.all([loadUsers(), loadEmployees(), loadOrgRoles(), loadActivityLog()]);
  var loadingEl = document.getElementById('adminLoading');
  if (loadingEl) loadingEl.style.display = 'none';
  document.getElementById('tab-overview').style.display = 'block';
  updateKpi();

  attachDragAndDropHeaders('roles', ROLE_COL_DEFS, renderRolesTable, renderRolesTable);
  attachDragAndDropHeaders('activity', ACT_COL_DEFS, renderActivityLogTable, renderActivityLogTable);

  // Wire up voice on any search fields
  if (window.DRIVEN_VOICE) {
    try { DRIVEN_VOICE.init(); } catch (e) {}
  }

  // Footer year
  var yEl = document.getElementById('dashFooterYear');
  if (yEl) yEl.textContent = new Date().getFullYear();
}

document.addEventListener('dashSessionLoaded', initializeUserManagementPage);
if (document.readyState !== 'loading') { initializeUserManagementPage(); }

window.addEventListener('load', function() {
  rebuildHeader();
  setTimeout(rebuildHeader, 200);
});

// ============================================================
// DATA LOADING
// ============================================================
async function loadUsers() {
  try {
    var resp = await fetch('/api/users');
    if (resp.ok) {
      var data = await resp.json();
      var raw = data.users || data.records || (Array.isArray(data) ? data : []);
      allUsers = raw.map(normalizeUser);
    } else throw new Error('API error');
  } catch (e) { allUsers = []; }
  renderUserTableHead();
  renderUserTable();
}

async function loadEmployees() {
  try {
    var resp = await fetch('/api/onboarding/employees/list');
    if (resp.ok) {
      var data = await resp.json();
      var raw = data.employees || (Array.isArray(data) ? data : []);
      allEmployees = raw.map(normalizeEmployee);
    } else throw new Error('API error');
  } catch (e) {
    var saved = localStorage.getItem('driven_saved_employees');
    allEmployees = saved ? JSON.parse(saved).map(normalizeEmployee) : [];
  }
  renderEmpTableHead();
  renderEmpTable();
}

async function loadOrgRoles() {
  try {
    var resp = await fetch('/api/roles?org_id=' + encodeURIComponent(currentUserOrgId));
    if (resp.ok) {
      var data = await resp.json();
      allOrgRoles = data.roles || (Array.isArray(data) ? data : []);
    } else throw new Error();
  } catch (e) {
    allOrgRoles = [
      { id: '1', name: 'Admin', description: 'Full administrative access', is_system: 1 },
      { id: '2', name: 'Fleet Manager', description: 'Fleet and asset assignment management', is_system: 0 },
      { id: '3', name: 'Employee', description: 'Standard driver / employee portal view', is_system: 0 }
    ];
  }
  renderRolesTable();
  buildMultiSelectPanels();
}

async function loadActivityLog() {
  try {
    var resp = await fetch('/api/audit-log');
    if (resp.ok) {
      var data = await resp.json();
      allActivityLogs = data.logs || data.audit_entries || (Array.isArray(data) ? data : []);
    }
  } catch (e) {}
  renderActivityLogTable();
}

// ============================================================
// TABLE RENDERING
// ============================================================
function renderUserTable() {
  var tb = document.getElementById('userTableBody');
  tb.textContent = '';
  var search = (document.getElementById('userSearch').value || '').toLowerCase().trim();
  var selStatuses = getSelectedCheckboxes('panelUserStatuses');
  var selRoles = getSelectedCheckboxes('panelUserRoles');
  var frozenCalc = calculateFrozenOffsets(USER_COL_DEFS, visibleUserCols, userColWidths);

  var filtered = allUsers.filter(function(u) {
    var matchSearch = !search || u.fullName.toLowerCase().indexOf(search) !== -1 || u.email.toLowerCase().indexOf(search) !== -1 || u.role.toLowerCase().indexOf(search) !== -1;
    var matchStatus = selStatuses.length === 0 || selStatuses.indexOf(u.is_active.toLowerCase()) !== -1;
    var matchRole = selRoles.length === 0 || selRoles.indexOf(u.role.toLowerCase()) !== -1;
    return matchSearch && matchStatus && matchRole;
  });

  updatePaginationUI('user', filtered.length);
  if (filtered.length === 0) {
    tb.innerHTML = '<tr><td colspan="9" class="um-empty">No matching system users found.</td></tr>';
    return;
  }

  var sorted = sortArray(filtered, sortState.user.key, sortState.user.dir);
  var pState = paginationState.user;
  var paged = sorted.slice((pState.currentPage - 1) * pState.pageSize, pState.currentPage * pState.pageSize);

  paged.forEach(function(u) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-record-id', u.id);

    USER_COL_DEFS.forEach(function(col) {
      if (!visibleUserCols[col.key]) return;
      var td = document.createElement('td');
      var isFrozen = !!col.frozen;
      if (isFrozen) {
        td.className = 'um-col-frozen' + (col.key === frozenCalc.lastFrozenKey ? ' um-col-frozen-last' : '');
        td.style.left = frozenCalc.offsets[col.key];
      }
      td.style.width = userColWidths[col.key];
      td.style.minWidth = userColWidths[col.key];

      var v = u[col.key];
      if (col.key === 'is_active') {
        td.innerHTML = '<span class="um-badge ' + (v === 'Active' ? 'um-badge-active' : 'um-badge-inactive') + '">' + escapeHtml(v) + '</span>';
      } else {
        td.textContent = v;
      }
      tr.appendChild(td);
    });

    var atd = document.createElement('td');
    atd.className = 'am-actions';
    atd.style.width = '100px';
    atd.style.minWidth = '100px';
    atd.innerHTML = '<div class="um-actions-wrap"><button class="um-table-btn" onclick="viewUserDetail(\'' + escapeHtml(u.fullName) + '\', \'' + escapeHtml(u.email) + '\')">View</button></div>';
    tr.appendChild(atd);
    tb.appendChild(tr);
  });
}

function renderUserTableHead() {
  var th = document.getElementById('userTableHead');
  th.textContent = '';
  var tr = document.createElement('tr');
  var frozenCalc = calculateFrozenOffsets(USER_COL_DEFS, visibleUserCols, userColWidths);

  USER_COL_DEFS.forEach(function(col) {
    if (!visibleUserCols[col.key]) return;
    var h = document.createElement('th');
    var isFrozen = !!col.frozen;
    h.className = 'draggable-th' + (isFrozen ? ' um-col-frozen' : '') + (col.key === frozenCalc.lastFrozenKey ? ' um-col-frozen-last' : '');
    if (isFrozen) { h.style.left = frozenCalc.offsets[col.key]; }
    h.setAttribute('draggable', 'true');
    h.setAttribute('data-col-key', col.key);
    h.style.width = userColWidths[col.key];
    h.style.minWidth = userColWidths[col.key];

    var arrow = sortState.user.key === col.key ? (sortState.user.dir === 'asc' ? '\u25B2' : '\u25BC') : '';
    h.innerHTML = escapeHtml(col.label) + ' <span class="um-sort-icon">' + arrow + '</span>';
    h.addEventListener('click', function(e) {
      if (e.target.classList.contains('um-resizer')) return;
      toggleSort('user', col.key);
    });

    var resizer = document.createElement('div');
    resizer.className = 'um-resizer';
    resizer.addEventListener('mousedown', function(e) { initColumnResize(e, h, col.key, 'user'); });
    h.appendChild(resizer);
    tr.appendChild(h);
  });

  var ha = document.createElement('th');
  ha.textContent = 'Actions';
  ha.style.width = '100px';
  ha.style.minWidth = '100px';
  tr.appendChild(ha);
  th.appendChild(tr);

  attachDragAndDropHeaders('user', USER_COL_DEFS, renderUserTableHead, renderUserTable);
}

function renderEmpTable() {
  var tb = document.getElementById('empTableBody');
  tb.textContent = '';
  var search = (document.getElementById('empSearch').value || '').toLowerCase().trim();
  var selStatuses = getSelectedCheckboxes('panelEmpStatuses');
  var selRoles = getSelectedCheckboxes('panelEmpRoles');
  var frozenCalc = calculateFrozenOffsets(EMP_COL_DEFS, visibleEmpCols, empColWidths);

  var filtered = allEmployees.filter(function(e) {
    var matchSearch = !search || e.fullName.toLowerCase().indexOf(search) !== -1 || e.email.toLowerCase().indexOf(search) !== -1 || e.employeeNumber.toLowerCase().indexOf(search) !== -1 || e.role.toLowerCase().indexOf(search) !== -1 || e.phone.toLowerCase().indexOf(search) !== -1 || e.state.toLowerCase().indexOf(search) !== -1;
    var matchStatus = selStatuses.length === 0 || selStatuses.indexOf(e.status.toLowerCase()) !== -1;
    var matchRole = selRoles.length === 0 || selRoles.indexOf(e.role.toLowerCase()) !== -1;
    return matchSearch && matchStatus && matchRole;
  });

  updatePaginationUI('emp', filtered.length);
  if (filtered.length === 0) {
    tb.innerHTML = '<tr><td colspan="14" class="um-empty">No matching employees found.</td></tr>';
    return;
  }

  var sorted = sortArray(filtered, sortState.emp.key, sortState.emp.dir);
  var pState = paginationState.emp;
  var paged = sorted.slice((pState.currentPage - 1) * pState.pageSize, pState.currentPage * pState.pageSize);

  paged.forEach(function(e) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-record-id', e.id);

    EMP_COL_DEFS.forEach(function(col) {
      if (!visibleEmpCols[col.key]) return;
      var td = document.createElement('td');
      var isFrozen = !!col.frozen;
      if (isFrozen) {
        td.className = 'um-col-frozen' + (col.key === frozenCalc.lastFrozenKey ? ' um-col-frozen-last' : '');
        td.style.left = frozenCalc.offsets[col.key];
      }
      td.style.width = empColWidths[col.key];
      td.style.minWidth = empColWidths[col.key];

      var v = e[col.key];
      if (col.key === 'status') {
        td.innerHTML = '<span class="um-badge ' + (v === 'Active' ? 'um-badge-active' : 'um-badge-inactive') + '">' + escapeHtml(v) + '</span>';
      } else {
        td.textContent = v;
      }
      tr.appendChild(td);
    });

    var atd = document.createElement('td');
    atd.className = 'am-actions';
    atd.style.width = '140px';
    atd.style.minWidth = '140px';
    atd.innerHTML = '<div class="um-actions-wrap"><button class="um-table-btn" onclick="openEmpViewModal(\'' + e.id + '\')">View</button><button class="um-table-btn" onclick="openEmpEditModal(\'' + e.id + '\')">Edit</button></div>';
    tr.appendChild(atd);
    tb.appendChild(tr);
  });
}

function renderEmpTableHead() {
  var th = document.getElementById('empTableHead');
  th.textContent = '';
  var tr = document.createElement('tr');
  var frozenCalc = calculateFrozenOffsets(EMP_COL_DEFS, visibleEmpCols, empColWidths);

  EMP_COL_DEFS.forEach(function(col) {
    if (!visibleEmpCols[col.key]) return;
    var h = document.createElement('th');
    var isFrozen = !!col.frozen;
    h.className = 'draggable-th' + (isFrozen ? ' um-col-frozen' : '') + (col.key === frozenCalc.lastFrozenKey ? ' um-col-frozen-last' : '');
    if (isFrozen) { h.style.left = frozenCalc.offsets[col.key]; }
    h.setAttribute('draggable', 'true');
    h.setAttribute('data-col-key', col.key);
    h.style.width = empColWidths[col.key];
    h.style.minWidth = empColWidths[col.key];

    var arrow = sortState.emp.key === col.key ? (sortState.emp.dir === 'asc' ? '\u25B2' : '\u25BC') : '';
    h.innerHTML = escapeHtml(col.label) + ' <span class="um-sort-icon">' + arrow + '</span>';
    h.addEventListener('click', function(e) {
      if (e.target.classList.contains('um-resizer')) return;
      toggleSort('emp', col.key);
    });

    var resizer = document.createElement('div');
    resizer.className = 'um-resizer';
    resizer.addEventListener('mousedown', function(e) { initColumnResize(e, h, col.key, 'emp'); });
    h.appendChild(resizer);
    tr.appendChild(h);
  });

  var ha = document.createElement('th');
  ha.textContent = 'Actions';
  ha.style.width = '140px';
  ha.style.minWidth = '140px';
  tr.appendChild(ha);
  th.appendChild(tr);

  attachDragAndDropHeaders('emp', EMP_COL_DEFS, renderEmpTableHead, renderEmpTable);
}

function renderRolesTable() {
  var container = document.getElementById('rolesTableBody');
  if (!container) return;
  container.innerHTML = '';
  var sorted = sortArray(allOrgRoles, sortState.roles.key, sortState.roles.dir);
  sorted.forEach(function(r) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><strong>' + escapeHtml(r.name) + '</strong></td>' +
                   '<td>' + escapeHtml(r.description || '\u2014') + '</td>' +
                   '<td>' + (r.is_system ? 'Yes' : 'No') + '</td>';
    container.appendChild(tr);
  });
  updateSortIcons('roles');
}

function renderActivityLogTable() {
  var tb = document.getElementById('activityLogBody');
  if (!tb) return;
  tb.innerHTML = '';
  if (!allActivityLogs || allActivityLogs.length === 0) {
    tb.innerHTML = '<tr><td colspan="5" class="um-empty">No activity log records found.</td></tr>';
    updatePaginationUI('activity', 0);
    return;
  }

  var search = (document.getElementById('activitySearch') ? document.getElementById('activitySearch').value : '').toLowerCase().trim();
  var logsMapped = allActivityLogs.map(function(l) {
    var email = l.user_email || l.email || '\u2014';
    return {
      id: l.id || Math.random().toString(),
      created_at: l.created_at || l.timestamp,
      user_email: email,
      user_name: resolveFullNameFromEmail(email),
      module: l.module || l.page || 'Employee Management',
      action: l.action || '\u2014',
      ip_address: l.ip_address || l.ip || '\u2014'
    };
  });

  var filtered = logsMapped.filter(function(l) {
    return !search || l.user_name.toLowerCase().indexOf(search) !== -1 || l.user_email.toLowerCase().indexOf(search) !== -1 || l.module.toLowerCase().indexOf(search) !== -1 || l.action.toLowerCase().indexOf(search) !== -1;
  });

  updatePaginationUI('activity', filtered.length);
  if (filtered.length === 0) {
    tb.innerHTML = '<tr><td colspan="5" class="um-empty">No matching activity records found.</td></tr>';
    return;
  }

  var sorted = sortArray(filtered, sortState.activity.key, sortState.activity.dir);
  var pState = paginationState.activity;
  var paged = sorted.slice((pState.currentPage - 1) * pState.pageSize, pState.currentPage * pState.pageSize);

  paged.forEach(function(l) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-record-id', l.id);
    var timeVal = formatUserLocalTime(l.created_at);
    tr.innerHTML = '<td>' + escapeHtml(timeVal) + '</td>' +
                   '<td><strong>' + escapeHtml(l.user_name) + '</strong></td>' +
                   '<td><strong style="text-transform:capitalize;">' + escapeHtml(l.module) + '</strong></td>' +
                   '<td>' + escapeHtml(l.action) + '</td>' +
                   '<td>' + escapeHtml(l.ip_address) + '</td>';
    tb.appendChild(tr);
  });
  updateSortIcons('activity');
}

function updateKpi() {
  document.getElementById('kpiActiveEmployees').textContent = allEmployees.filter(function(e){ return e.status === 'Active'; }).length;
  document.getElementById('kpiOnLeave').textContent = allEmployees.filter(function(e){ return e.status === 'On Leave'; }).length;
}

// ============================================================
// COLUMN RESIZE
// ============================================================
function initColumnResize(e, th, colKey, type) {
  e.stopPropagation();
  e.preventDefault();
  var startX = e.pageX;
  var startWidth = th.offsetWidth;
  var colIndex = Array.from(th.parentNode.children).indexOf(th);
  var tableId = type === 'user' ? 'userTable' : 'empTable';
  var table = document.getElementById(tableId);

  if (table) {
    table.style.tableLayout = 'fixed';
    table.style.width = 'max-content';
  }

  function onMove(me) {
    var newWidth = Math.max(60, startWidth + (me.pageX - startX)) + 'px';
    th.style.width = newWidth;
    th.style.minWidth = newWidth;
    th.style.maxWidth = newWidth;
    if (table) {
      table.querySelectorAll('tbody tr').forEach(function(row) {
        if (row.children[colIndex]) {
          row.children[colIndex].style.width = newWidth;
          row.children[colIndex].style.minWidth = newWidth;
          row.children[colIndex].style.maxWidth = newWidth;
        }
      });
    }
    if (type === 'user') { userColWidths[colKey] = newWidth; }
    else { empColWidths[colKey] = newWidth; }
  }

  function onEnd() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    if (type === 'user') { localStorage.setItem('um_user_col_widths', JSON.stringify(userColWidths)); }
    else { localStorage.setItem('um_emp_col_widths', JSON.stringify(empColWidths)); }
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
}

function initSimpleColResize(e, resizer) {
  e.stopPropagation();
  e.preventDefault();
  var th = resizer.parentNode;
  var table = th.closest('table');
  var startX = e.pageX;
  var startWidth = th.offsetWidth;
  var colIndex = Array.from(th.parentNode.children).indexOf(th);

  if (table) {
    table.style.tableLayout = 'fixed';
    table.style.width = 'max-content';
  }

  function onMove(me) {
    var newWidth = Math.max(70, startWidth + (me.pageX - startX)) + 'px';
    th.style.width = newWidth;
    th.style.minWidth = newWidth;
    th.style.maxWidth = newWidth;
    if (table) {
      table.querySelectorAll('tbody tr').forEach(function(row) {
        if (row.children[colIndex]) {
          row.children[colIndex].style.width = newWidth;
          row.children[colIndex].style.minWidth = newWidth;
          row.children[colIndex].style.maxWidth = newWidth;
        }
      });
    }
  }

  function onEnd() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
}

// ============================================================
// DRAG & DROP COLUMN REORDERING
// ============================================================
function attachDragAndDropHeaders(tableType, defsArray, renderHeadFn, renderTableFn) {
  var draggedKey = null;
  var selector = '#' + tableType + 'TableHead th.draggable-th';
  if (tableType === 'roles') selector = '#rolesTableHead th.draggable-th';
  else if (tableType === 'activity') selector = '#activityTableHead th.draggable-th';

  var headers = document.querySelectorAll(selector);
  headers.forEach(function(th) {
    th.addEventListener('dragstart', function(e) {
      draggedKey = th.getAttribute('data-col-key');
      e.dataTransfer.effectAllowed = 'move';
    });

    th.addEventListener('dragenter', function(e) {
      if (!draggedKey || draggedKey === th.getAttribute('data-col-key')) return;
      th.classList.add('drag-over-left');
    });

    th.addEventListener('dragover', function(e) { e.preventDefault(); });

    th.addEventListener('dragleave', function(e) {
      th.classList.remove('drag-over-left', 'drag-over-right');
    });

    th.addEventListener('drop', function(e) {
      e.preventDefault();
      th.classList.remove('drag-over-left', 'drag-over-right');
      var targetKey = th.getAttribute('data-col-key');
      if (!draggedKey || draggedKey === targetKey) return;

      var fromIdx = defsArray.findIndex(function(c) { return c.key === draggedKey; });
      var toIdx = defsArray.findIndex(function(c) { return c.key === targetKey; });

      if (fromIdx !== -1 && toIdx !== -1) {
        var movedCol = defsArray.splice(fromIdx, 1)[0];
        defsArray.splice(toIdx, 0, movedCol);
        var orderKeys = defsArray.map(function(c) { return c.key; });
        localStorage.setItem('um_' + tableType + '_col_order', JSON.stringify(orderKeys));
        renderHeadFn();
        renderTableFn();
      }
    });
  });
}

function calculateFrozenOffsets(colDefs, visibleColsMap, colWidthsMap) {
  var leftOffset = 0;
  var offsets = {};
  var lastFrozenKey = null;
  colDefs.forEach(function(col) {
    if (!visibleColsMap[col.key]) return;
    if (col.frozen) {
      offsets[col.key] = leftOffset + 'px';
      var w = parseInt(colWidthsMap[col.key] || col.defaultWidth, 10) || 120;
      leftOffset += w;
      lastFrozenKey = col.key;
    }
  });
  return { offsets: offsets, lastFrozenKey: lastFrozenKey };
}

// ============================================================
// MULTISELECT / FILTERS
// ============================================================
function buildMultiSelectPanels() {
  var pur = document.getElementById('panelUserRoles');
  var per = document.getElementById('panelEmpRoles');
  if (pur) pur.innerHTML = '';
  if (per) per.innerHTML = '';

  var roleNames = allOrgRoles.map(function(r) { return r.name; });
  if (roleNames.length === 0) roleNames = ['Admin', 'Fleet Manager', 'Employee'];

  roleNames.forEach(function(rName) {
    if (pur) {
      var l1 = document.createElement('label');
      l1.className = 'um-multiselect-option';
      l1.innerHTML = '<input type="checkbox" value="' + escapeHtml(rName) + '" onchange="onUserFilterChange()"> ' + escapeHtml(rName);
      pur.appendChild(l1);
    }
    if (per) {
      var l2 = document.createElement('label');
      l2.className = 'um-multiselect-option';
      l2.innerHTML = '<input type="checkbox" value="' + escapeHtml(rName) + '" onchange="onEmpFilterChange()"> ' + escapeHtml(rName);
      per.appendChild(l2);
    }
  });
}

function getSelectedCheckboxes(panelId) {
  var cbs = document.querySelectorAll('#' + panelId + ' input[type="checkbox"]:checked');
  return Array.from(cbs).map(function(cb) { return cb.value.toLowerCase(); });
}

// ============================================================
// MODALS -- EMPLOYEE
// ============================================================
function openEmpViewModal(id) {
  var emp = allEmployees.find(function(x) { return x.id === id; });
  if (!emp) return;
  document.getElementById('viewEmpName').textContent = emp.fullName;
  document.getElementById('viewEmpFullName').textContent = emp.fullName;
  document.getElementById('viewEmpNum').textContent = emp.employeeNumber;
  document.getElementById('viewEmpEmail').textContent = emp.email;
  document.getElementById('viewEmpRole').textContent = emp.role;
  document.getElementById('viewEmpStatus').textContent = emp.status;
  document.getElementById('viewEmpPhone').textContent = emp.phone;
  document.getElementById('viewEmpDob').textContent = emp.dob;
  document.getElementById('viewEmpDl').textContent = emp.driversLicense;
  document.getElementById('viewEmpDlState').textContent = emp.dlState;
  document.getElementById('viewEmpAddr').textContent = emp.address + ', ' + emp.city + ', ' + emp.state + ' ' + emp.zip;
  document.getElementById('umEmpViewModal').classList.add('active');

  // Wire up voice Read Aloud on the modal content
  if (window.DRIVEN_VOICE) {
    try { DRIVEN_VOICE.init(); } catch (e) {}
  }
}

function openAddEmpModal() {
  document.getElementById('empModalTitle').textContent = 'Add New Employee';
  document.getElementById('editEmpId').value = '';
  document.getElementById('addEmpFn').value = '';
  document.getElementById('addEmpMn').value = '';
  document.getElementById('addEmpLn').value = '';
  document.getElementById('addEmpSuffix').value = '';
  document.getElementById('addEmpEmail').value = '';
  document.getElementById('addEmpNum').value = '';
  document.getElementById('addEmpRole').value = 'Employee';
  document.getElementById('addEmpPhone').value = '';
  document.getElementById('addEmpDob').value = '';
  document.getElementById('addEmpAddress').value = '';
  document.getElementById('addEmpCity').value = '';
  document.getElementById('addEmpState').value = '';
  document.getElementById('addEmpZip').value = '';
  document.getElementById('addEmpStatus').value = 'Active';
  document.getElementById('addEmpDl').value = '';
  document.getElementById('addEmpDlState').value = '';
  document.getElementById('umAddEmpModal').classList.add('active');
}

function openEmpEditModal(id) {
  var emp = allEmployees.find(function(x) { return x.id === id; });
  if (!emp) return;
  document.getElementById('empModalTitle').textContent = 'Edit Employee';
  document.getElementById('editEmpId').value = emp.id;
  document.getElementById('addEmpFn').value = emp.firstName !== '\u2014' ? emp.firstName : '';
  document.getElementById('addEmpMn').value = emp.middleName !== '\u2014' ? emp.middleName : '';
  document.getElementById('addEmpLn').value = emp.lastName !== '\u2014' ? emp.lastName : '';
  document.getElementById('addEmpSuffix').value = emp.suffix !== '\u2014' ? emp.suffix : '';
  document.getElementById('addEmpEmail').value = emp.email !== '\u2014' ? emp.email : '';
  document.getElementById('addEmpNum').value = emp.employeeNumber !== '\u2014' ? emp.employeeNumber : '';
  document.getElementById('addEmpRole').value = emp.role;
  document.getElementById('addEmpPhone').value = emp.phone !== '\u2014' ? emp.phone : '';
  document.getElementById('addEmpDob').value = emp.dob !== '\u2014' ? emp.dob : '';
  document.getElementById('addEmpAddress').value = emp.address !== '\u2014' ? emp.address : '';
  document.getElementById('addEmpCity').value = emp.city !== '\u2014' ? emp.city : '';
  document.getElementById('addEmpState').value = emp.state !== '\u2014' ? emp.state : '';
  document.getElementById('addEmpZip').value = emp.zip !== '\u2014' ? emp.zip : '';
  document.getElementById('addEmpStatus').value = emp.status;
  document.getElementById('addEmpDl').value = emp.driversLicense !== '\u2014' ? emp.driversLicense : '';
  document.getElementById('addEmpDlState').value = emp.dlState !== '\u2014' ? emp.dlState : '';
  document.getElementById('umAddEmpModal').classList.add('active');
}

async function submitSaveEmployee() {
  var id = document.getElementById('editEmpId').value;
  var fn = document.getElementById('addEmpFn').value.trim();
  var mn = document.getElementById('addEmpMn').value.trim();
  var ln = document.getElementById('addEmpLn').value.trim();
  var suffix = document.getElementById('addEmpSuffix').value.trim();
  var em = document.getElementById('addEmpEmail').value.trim();
  var empNum = document.getElementById('addEmpNum').value.trim();
  var role = document.getElementById('addEmpRole').value;
  var phone = document.getElementById('addEmpPhone').value.trim();
  var dob = document.getElementById('addEmpDob').value;
  var addr = document.getElementById('addEmpAddress').value.trim();
  var city = document.getElementById('addEmpCity').value.trim();
  var state = document.getElementById('addEmpState').value.trim();
  var zip = document.getElementById('addEmpZip').value.trim();
  var status = document.getElementById('addEmpStatus').value;
  var dl = document.getElementById('addEmpDl').value.trim();
  var dlState = document.getElementById('addEmpDlState').value.trim();

  if (!fn || !ln) {
    showToast('First and Last name are required.', 'error');
    return;
  }

  var fullStr = [fn, mn, ln].filter(Boolean).join(' ') + (suffix ? ' ' + suffix : '');
  var payload = {
    id: id || undefined, org_id: currentUserOrgId,
    first_name: fn, middle_name: mn, last_name: ln, suffix: suffix, full_name: fullStr, name: fullStr,
    email: em, employee_number: empNum, role: role, phone: phone, dob: dob, address: addr,
    city: city, state: state, zip: zip, status: status, drivers_license: dl, dl_state: dlState
  };

  try {
    var endpoint = id ? '/api/onboarding/employees/' + encodeURIComponent(id) : '/api/onboarding/employees/create';
    var method = id ? 'PUT' : 'POST';
    var resp = await fetch(endpoint, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('HTTP status ' + resp.status);
    showToast('Employee updated successfully.', 'success');

    try {
      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: (id ? 'Updated employee ' : 'Created employee ') + fullStr + ' (' + role + ')',
          module: 'Employees', table_name: 'employees', record_id: id || empNum
        })
      });
    } catch (auditErr) { console.warn('Audit log write error:', auditErr); }
  } catch (e) {
    console.warn('Backend sync failed, saved locally:', e.message);
    showToast('Saved locally (Offline mode active)', 'error');
  }

  var normalized = normalizeEmployee(payload);
  if (id) {
    var emp = allEmployees.find(function(x) { return x.id === id; });
    if (emp) Object.assign(emp, normalized);
  } else {
    allEmployees.unshift(normalized);
  }

  localStorage.setItem('driven_saved_employees', JSON.stringify(allEmployees));
  renderEmpTable();
  updateKpi();
  await loadActivityLog();
  closeModal('umAddEmpModal');
}

// ============================================================
// MODALS -- USER DETAIL
// ============================================================
function viewUserDetail(name, email) {
  document.getElementById('userDetailName').textContent = name || 'System User Detail';
  document.getElementById('userDetailEmail').textContent = email || '';
  document.getElementById('umUserDetailModal').classList.add('active');
}

// ============================================================
// EXPORT
// ============================================================
function openExportModal(type, fmt) {
  activeModalType = type;
  document.getElementById('umExportTitle').textContent = 'Export ' + (type === 'user' ? 'Users' : 'Employees') + ' to ' + fmt.toUpperCase();
  var c = document.getElementById('umExportCols');
  c.innerHTML = '';
  var defs = type === 'user' ? USER_COL_DEFS : EMP_COL_DEFS;
  var vis = type === 'user' ? visibleUserCols : visibleEmpCols;

  defs.forEach(function(col) {
    var i = document.createElement('label');
    i.className = 'um-check-item';
    i.innerHTML = '<input type="checkbox" data-key="' + col.key + '" ' + (vis[col.key] ? 'checked' : '') + '> ' + escapeHtml(col.label);
    c.appendChild(i);
  });
  document.getElementById('umExportModal').classList.add('active');
}

function doExport() {
  closeModal('umExportModal');
  showToast('Export queued successfully.', 'success');
}

// ============================================================
// COLUMN TOGGLE PANEL
// ============================================================
function toggleColPanel(type, e) {
  if (e) e.stopPropagation();
  var panelId = type === 'user' ? 'userColPanel' : 'empColPanel';
  var itemsId = type === 'user' ? 'userColToggleItems' : 'empColToggleItems';
  var defs = type === 'user' ? USER_COL_DEFS : EMP_COL_DEFS;
  var vis = type === 'user' ? visibleUserCols : visibleEmpCols;

  var p = document.getElementById(panelId);
  var active = p.classList.contains('active');
  document.querySelectorAll('.um-col-toggle').forEach(function(x) { x.classList.remove('active'); });

  if (!active) {
    p.classList.add('active');
    var c = document.getElementById(itemsId);
    c.innerHTML = '';

    defs.forEach(function(col) {
      var lbl = document.createElement('label');
      lbl.className = 'um-col-toggle-item';
      lbl.addEventListener('click', function(ev) { ev.stopPropagation(); });

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = (vis[col.key] !== false);
      cb.addEventListener('change', function(ev) {
        ev.stopPropagation();
        vis[col.key] = cb.checked;
        if (type === 'user') {
          visibleUserCols[col.key] = cb.checked;
          localStorage.setItem('um_visible_user_cols', JSON.stringify(visibleUserCols));
          renderUserTableHead();
          renderUserTable();
        } else {
          visibleEmpCols[col.key] = cb.checked;
          localStorage.setItem('um_visible_emp_cols', JSON.stringify(visibleEmpCols));
          renderEmpTableHead();
          renderEmpTable();
        }
      });

      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(' ' + col.label));
      c.appendChild(lbl);
    });

    if (e && e.target) {
      var btn = e.target.closest('.um-btn-action');
      if (btn) {
        var r = btn.getBoundingClientRect();
        var viewportHeight = window.innerHeight;
        var spaceBelow = viewportHeight - r.bottom - 20;

        p.style.position = 'fixed';
        p.style.left = Math.max(10, r.left) + 'px';
        if (spaceBelow < 200 && r.top > 200) {
          p.style.top = 'auto';
          p.style.bottom = (viewportHeight - r.top + 4) + 'px';
          p.style.maxHeight = Math.min(280, r.top - 20) + 'px';
        } else {
          p.style.bottom = 'auto';
          p.style.top = (r.bottom + 4) + 'px';
          p.style.maxHeight = Math.min(280, Math.max(150, spaceBelow)) + 'px';
        }
      }
    }
  }
}

// ============================================================
// PRINT
// ============================================================
var activePrintType = 'emp';
function openPrintModal(type) {
  activePrintType = type;
  var container = document.getElementById('umPrintRecordsList');
  container.innerHTML = '';
  document.getElementById('printSelectAllCheck').checked = true;

  var items = [];
  if (type === 'user') {
    items = allUsers.map(function(u) { return { id: u.id, name: u.fullName + ' (' + u.email + ')' }; });
  } else if (type === 'emp') {
    items = allEmployees.map(function(e) { return { id: e.id, name: e.name + ' [' + e.employeeNumber + ']' }; });
  } else if (type === 'activity') {
    items = allActivityLogs.map(function(l) { return { id: l.id || l.created_at, name: resolveFullNameFromEmail(l.user_email) + ' -- ' + l.action }; });
  }

  items.forEach(function(item) {
    var lbl = document.createElement('label');
    lbl.className = 'um-check-item';
    lbl.innerHTML = '<input type="checkbox" class="print-row-cb" data-id="' + escapeHtml(item.id) + '" checked> ' + escapeHtml(item.name);
    container.appendChild(lbl);
  });

  document.getElementById('umPrintModal').classList.add('active');
}

function togglePrintSelectAll(checked) {
  document.querySelectorAll('.print-row-cb').forEach(function(cb) { cb.checked = checked; });
}

function printRolesTable() {
  var origTitle = document.title;
  var orgName = (window.dashUser && (window.dashUser.org_name || window.dashUser.company_name)) || localStorage.getItem('driven_org_name') || 'Organization';
  document.title = orgName + ' | Roles & Permissions';
  window.print();
  setTimeout(function() { document.title = origTitle; }, 500);
}

function doPrint() {
  var origEmpPageSize = paginationState.emp.pageSize;
  var origUserPageSize = paginationState.user.pageSize;
  var origActPageSize = paginationState.activity.pageSize;

  paginationState.emp.pageSize = 9999;
  paginationState.user.pageSize = 9999;
  paginationState.activity.pageSize = 9999;

  if (activePrintType === 'emp') renderEmpTable();
  else if (activePrintType === 'user') renderUserTable();
  else if (activePrintType === 'activity') renderActivityLogTable();

  var uncheckedIds = [];
  document.querySelectorAll('.print-row-cb:not(:checked)').forEach(function(cb) { uncheckedIds.push(cb.getAttribute('data-id')); });

  var tableId = activePrintType === 'user' ? 'userTable' : (activePrintType === 'emp' ? 'empTable' : 'activityTable');
  var rows = document.querySelectorAll('#' + tableId + ' tbody tr');
  rows.forEach(function(tr) {
    var recId = tr.getAttribute('data-record-id');
    if (recId && uncheckedIds.indexOf(recId) !== -1) {
      tr.classList.add('print-exclude-row');
    } else {
      tr.classList.remove('print-exclude-row');
    }
  });

  var origTitle = document.title;
  var orgName = (window.dashUser && (window.dashUser.org_name || window.dashUser.company_name)) || localStorage.getItem('driven_org_name') || 'Organization';
  var tabLabel = activePrintType === 'user' ? 'System Users' : (activePrintType === 'emp' ? 'Employee Directory' : 'Activity Audit Trail');
  document.title = orgName + ' | ' + tabLabel;

  closeModal('umPrintModal');
  window.print();

  setTimeout(function() {
    document.title = origTitle;
    paginationState.emp.pageSize = origEmpPageSize;
    paginationState.user.pageSize = origUserPageSize;
    paginationState.activity.pageSize = origActPageSize;
    if (activePrintType === 'emp') renderEmpTable();
    else if (activePrintType === 'user') renderUserTable();
    else if (activePrintType === 'activity') renderActivityLogTable();
  }, 500);
}

// ============================================================
// UI HELPERS
// ============================================================
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function filterByKpi(type) { switchTab(type === 'ActiveUsers' ? 'users' : 'employees'); }

function toggleFilterPanel(panelId, e) {
  e.stopPropagation();
  var p = document.getElementById(panelId);
  var active = p.classList.contains('active');
  document.querySelectorAll('.um-multiselect-panel').forEach(function(x) { x.classList.remove('active'); });
  if (!active) p.classList.add('active');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.um-multiselect-dd')) {
    document.querySelectorAll('.um-multiselect-panel').forEach(function(p) { p.classList.remove('active'); });
  }
  if (!e.target.closest('.um-col-toggle') && !e.target.closest('.um-btn-action')) {
    document.querySelectorAll('.um-col-toggle').forEach(function(p) { p.classList.remove('active'); });
  }
});

function switchTab(tab) {
  document.querySelectorAll('.um-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.um-tab-content').forEach(function(c) { c.style.display = 'none'; c.classList.remove('active'); });

  var targetTab = document.querySelector('.um-tab[data-tab="' + tab + '"]');
  if (targetTab) targetTab.classList.add('active');

  var targetContent = document.getElementById('tab-' + tab);
  if (targetContent) {
    targetContent.style.display = 'block';
    targetContent.classList.add('active');
  }
}

function goToMainDashboard() {
  var user = window.dashUser || window.drivenUser;
  if (!user) {
    try { user = JSON.parse(localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user")); } catch(e) {}
  }
  if (!user) { window.location.href = '/public/login.html'; return; }
  var r = (user.role || '').toLowerCase();
  var rid = (user.role_id || '').toLowerCase();
  if (r === 'driv-en founder' || r === 'owner' || rid === 'ro-founder') window.location.href = '/app/dashboard/owner-dashboard.html';
  else if (r === 'admin' || rid === 'ro-admin') window.location.href = '/app/dashboard/admin.html';
  else window.location.href = '/app/dashboard/employee-dashboard.html';
}

function onUserSearchInput() { renderUserTable(); }
function onUserFilterChange() { renderUserTable(); }
function onEmpSearchInput() { renderEmpTable(); }
function onEmpFilterChange() { renderEmpTable(); }

window.addEventListener('resize', makeTabsSticky);
window.addEventListener('scroll', makeTabsSticky, { passive: true });
