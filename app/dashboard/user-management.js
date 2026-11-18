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

// ============================================================
// PURPOSE & INSTRUCTIONS MODAL CONTENT (per tab)
// ============================================================
var MODAL_CONTENT_MAP = {
  overview: {
    purpose: 'The <strong>Overview Tab</strong> is your landing page. It displays key metrics (Active Employees, Roles) and provides two card grids for navigation. The <strong>Module Sections</strong> card contains the core management tools (Employees, Roles &amp; Permissions). The <strong>Information Links</strong> card provides quick access to System Users and the Activity Log. The welcome bar above shows your account details and includes three personalization controls.',
    instructions: '<ol><li><strong>Personalization Controls (welcome bar, top of page):</strong><ul><li><strong>Light / Dark Toggle:</strong> Click the switch in the welcome bar to instantly switch between light and dark visual themes. Your preference is saved automatically.</li><li><strong>Units of Measure:</strong> Use the dropdown to select <em>Use Org Default</em>, <em>Imperial (US)</em>, or <em>Metric (CA)</em>. A hint below shows what units are active (e.g., "US Gallons, Miles, °F"). Your preference is saved automatically.</li><li><strong>Language:</strong> Use the dropdown to switch the interface between <em>English</em> and <em>Español</em>. Your preference is saved automatically.</li></ul></li><li><strong>Module Sections (card grid):</strong> Contains the core management tools for this module. Click <strong>📋 Employees</strong> to manage your employee directory, or <strong>🔑 Roles &amp; Permissions</strong> to view organization roles and system roles.</li><li><strong>Information Links (card grid):</strong> Provides quick access to supplementary system tools. Click <strong>👥 System Users</strong> to manage user accounts with login access, or <strong>📊 Activity Log</strong> to review the audit trail of all actions in the system.</li><li><strong>KPI Cards:</strong> Click the <strong>Active Employees</strong> or <strong>Roles</strong> KPI card to jump to the relevant section.</li><li><strong>Account:</strong> Review your credentials in the welcome card and use <strong>Change Password</strong> to update your login.</li><li><strong>Return:</strong> When viewing any sub-section, a <strong>&#8592; Back to Overview</strong> button appears in the pill bar (top-right, next to Purpose and Instructions) to return here.</li></ol>'
  },
  employees: {
    purpose: 'The <strong>Employees Tab</strong> is the central directory for managing all employee records. Administrators can add, edit, view, search, filter, sort, export, and print employee information. Search and form fields support voice dictation via the microphone icon.',
    instructions: '<ol><li><strong>Search with Voice:</strong> Use the search bar to find employees by name, email, employee number, role, phone, or state. Click the <strong>microphone icon</strong> (&#127908;) next to the search field to speak your search query instead of typing — the browser\'s Web Speech API transcribes your voice into the search box. Click the mic again to stop dictation.</li><li><strong>Filter:</strong> Use the Statuses and Roles dropdowns to filter by employment status or role.</li><li><strong>Add Employee with Voice:</strong> Click <strong>+ Add Employee</strong> to open the form modal. Fill in all required fields (First Name, Last Name) and optional fields. Each text field has a <strong>microphone icon</strong> (&#127908;) — click it to dictate that field\'s value by voice instead of typing. Click <strong>Save Employee</strong> when done.</li><li><strong>Edit Employee:</strong> Click the <strong>Edit</strong> button on any row to modify an existing employee record. Voice dictation is available on all form fields.</li><li><strong>View Details:</strong> Click <strong>View</strong> to see a read-only detail modal for any employee.</li><li><strong>Columns:</strong> Click <strong>Columns (Show / Hide)</strong> to toggle visibility of individual columns. Drag column headers to reorder. Drag column edges to resize.</li><li><strong>Export:</strong> Click <strong>Export CSV</strong> or <strong>Export Excel</strong> to export the current filtered view.</li><li><strong>Print:</strong> Click <strong>Print</strong> to select specific records or print all visible rows.</li><li><strong>Personalization:</strong> The Light/Dark toggle, Units of Measure, and Language selectors remain available in the welcome bar above.</li><li><strong>Back:</strong> Click <strong>&#8592; Back to Overview</strong> in the pill bar (top-right, next to Purpose and Instructions) to return to the Overview landing page.</li></ol>'
  },
  roles: {
    purpose: 'The <strong>Roles &amp; Permissions Tab</strong> displays all roles defined for your organization. This includes system roles (locked, cannot be edited or deleted) and custom roles that you can create, edit, and delete. Use this tab to manage the roles that control what employees and users can do across the platform.',
    instructions: '<ol><li><strong>Add a New Role:</strong> Click <strong>+ Add Role</strong> to open the form. Enter a role name (required) and an optional description, then click <strong>Save Role</strong>. The new role appears in the table immediately.</li><li><strong>Edit a Role:</strong> Click <strong>Edit</strong> on any non-system role row to open the form with the current values. Change the name or description and click <strong>Save Role</strong>.</li><li><strong>Delete a Role:</strong> Click <strong>Delete</strong> on a non-system role and confirm the prompt. System roles show "System role" instead of action buttons and cannot be modified.</li><li><strong>Sort:</strong> Click any column header to sort the table by that column. Click again to reverse the sort direction.</li><li><strong>Print:</strong> Click <strong>Print Roles &amp; Permissions</strong> to print the full roles table.</li><li><strong>Column Resize:</strong> Drag the edge of any column header to adjust its width.</li><li><strong>Personalization:</strong> The Light/Dark toggle, Units of Measure, and Language selectors remain available in the welcome bar above.</li><li><strong>Back:</strong> Click <strong>&#8592; Back to Overview</strong> in the pill bar (top-right, next to Purpose and Instructions) to return to the Overview landing page.</li></ol>'
  },
  users: {
    purpose: 'The <strong>System Users Tab</strong> manages all user accounts that have login access to the DRIV-EN platform. This includes their authentication status, role assignments, and security settings. The search bar supports voice dictation via the microphone icon.',
    instructions: '<ol><li><strong>Search with Voice:</strong> Use the search bar to find users by name, email, or role. Click the <strong>microphone icon</strong> (&#127908;) next to the search field to speak your search query instead of typing — the browser\'s Web Speech API transcribes your voice into the search box. Click the mic again to stop dictation.</li><li><strong>Filter:</strong> Use the Statuses and Roles dropdowns to filter by account status or assigned role.</li><li><strong>View Details:</strong> Click <strong>View</strong> on any row to see the user account details modal.</li><li><strong>Columns:</strong> Click <strong>Columns (Show / Hide)</strong> to toggle visibility of individual columns. Drag column headers to reorder. Drag column edges to resize.</li><li><strong>Export:</strong> Click <strong>Export CSV</strong> or <strong>Export Excel</strong> to export the current filtered view.</li><li><strong>Print:</strong> Click <strong>Print</strong> to select specific records or print all visible rows.</li><li><strong>Personalization:</strong> The Light/Dark toggle, Units of Measure, and Language selectors remain available in the welcome bar above.</li><li><strong>Back:</strong> Click <strong>&#8592; Back to Overview</strong> in the pill bar (top-right, next to Purpose and Instructions) to return to the Overview landing page.</li></ol>'
  },
  activity: {
    purpose: 'The <strong>Activity Log Tab</strong> provides a complete audit trail of all actions performed within the system. It records who did what, when, and from which IP address, supporting compliance and security investigations. The search bar supports voice dictation via the microphone icon.',
    instructions: '<ol><li><strong>Search with Voice:</strong> Use the search bar to filter activity logs by user full name, email, module, or action details. Click the <strong>microphone icon</strong> (&#127908;) next to the search field to speak your search query instead of typing — the browser\'s Web Speech API transcribes your voice into the search box. Click the mic again to stop dictation.</li><li><strong>Sort:</strong> Click any column header to sort by that column. Click again to reverse direction. The default sort is by Timestamp (newest first).</li><li><strong>Review Entries:</strong> Each row shows the timestamp, full name, module/page, action details, and IP address.</li><li><strong>Export:</strong> Click <strong>Export CSV</strong> or <strong>Export Excel</strong> to export the current filtered view.</li><li><strong>Print:</strong> Click <strong>Print Activity Log</strong> to select specific records or print all visible rows.</li><li><strong>Column Resize:</strong> Drag the edge of any column header to adjust its width.</li><li><strong>Personalization:</strong> The Light/Dark toggle, Units of Measure, and Language selectors remain available in the welcome bar above.</li><li><strong>Back:</strong> Click <strong>&#8592; Back to Overview</strong> in the pill bar (top-right, next to Purpose and Instructions) to return to the Overview landing page.</li></ol>'
  },
  import: {
    purpose: 'The <strong>Import Employees Tab</strong> lets you bring your entire employee roster into DRIV-EN from your payroll or HR program instead of adding each person manually. It supports ADP, QuickBooks (Online &amp; Desktop Enterprise), Gusto, Paychex, Paycom, Paycor, Sage, BambooHR, Rippling, and any generic CSV file. The system auto-detects column headers, maps them to DRIV-EN fields, shows a preview before committing, and tracks every import so you can undo it later.',
    instructions: '<ol><li><strong>Export from your payroll/HR program:</strong> In ADP, QuickBooks, Gusto, Paychex, or whichever program you use, export your employee list as a CSV file and save it to your computer.</li><li><strong>Download a blank template (optional):</strong> If you prefer to start fresh, click <strong>⬇ Download Blank Template</strong> to get a CSV with the correct headers and one sample row. Fill it in and save.</li><li><strong>Select your program:</strong> Choose your payroll/HR program from the dropdown, or leave it on <strong>🔍 Auto-Detect</strong> (recommended) and the system will identify the column format automatically.</li><li><strong>Choose duplicate handling:</strong> Select <strong>Skip existing employees</strong> to leave matching emails alone, or <strong>Update existing employees</strong> to overwrite their fields with the CSV values.</li><li><strong>Choose the CSV file:</strong> Click the file input and select your exported CSV.</li><li><strong>Preview Import:</strong> Click the <strong>Preview Import</strong> button. The system parses the file and shows a column mapping grid and a row-by-row preview.</li><li><strong>Review the column mapping:</strong> The grid auto-fills each CSV column to the matching DRIV-EN field. If a column was mapped wrong, click the dropdown and pick the correct field. Required fields are <strong>Full Name</strong> and <strong>Email</strong>.</li><li><strong>Review the preview rows:</strong> Green rows are ready to import. Red rows will be skipped — the reason (missing email, duplicate, etc.) is shown. Fix the CSV and re-preview if needed.</li><li><strong>Import:</strong> Click the <strong>Import</strong> button to commit the rows to the database. A confirmation summary shows how many were added, updated, or skipped.</li><li><strong>Undo (if needed):</strong> Scroll down to <strong>Import History</strong>, find the batch, and click <strong>Undo</strong> to roll back every row from that import.</li><li><strong>Back:</strong> Click <strong>&#8592; Back to Overview</strong> in the pill bar (top-right, next to Purpose and Instructions) to return to the Overview landing page.</li></ol>'
  }
};

function getActiveContext() {
  var activeContent = document.querySelector('.um-tab-content.active');
  if (activeContent) {
    var id = activeContent.getAttribute('id') || '';
    var tabKey = id.replace('tab-', '');
    if (MODAL_CONTENT_MAP[tabKey]) return tabKey;
  }
  return 'overview';
}

function getContextTitle(key) {
  var labels = {
    overview: 'Overview',
    employees: 'Employees',
    roles: 'Roles & Permissions',
    users: 'System Users',
    activity: 'Activity Log',
    import: 'Import Employees'
  };
  return labels[key] || 'Dashboard';
}

function openInfoModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
}

function closeInfoModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
}

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
// Matches admin.js pattern: preserve #dashCustomerLogoArea + DRIV-EN logo
// ============================================================
function rebuildHeader() {
  var header = document.getElementById('dashHeader');
  if (!header) return;

  var title = document.body.getAttribute('data-page-title') || 'Employee Management';

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
  var tb = document.querySelector('.um-utility-bar');
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
    role: normalizeRoleName(r.role || r.role_name || r.role_id),
    roleId: parseVal(r.role_id || r.roleId),
    status: parseVal(r.status || 'Active'),
    phone: parseVal(r.phone),
    dob: parseVal(r.dob),
    address: parseVal(r.address),
    city: parseVal(r.city),
    state: parseVal(r.state),
    zip: parseVal(r.zip),
    driversLicense: parseVal(r.drivers_license || r.driversLicense),
    dlState: parseVal(r.dl_state || r.dlState),
    is_commercial_driver: parseVal(r.is_commercial_driver),
    dl_expiration: parseVal(r.dl_expiration || r.dlExpiration),
    drives_company_vehicle: parseVal(r.drives_company_vehicle || r.drivesCompanyVehicle),
    uses_employee_assets: parseVal(r.uses_employee_assets || r.usesEmpAssets),
    step2_status: parseVal(r.step2_status),
    driving_record_status: parseVal(r.driving_record_status),
    medical_card_status: parseVal(r.medical_card_status),
    drug_test_status: parseVal(r.drug_test_status),
    background_check_status: parseVal(r.background_check_status),
    auto_policy_status: parseVal(r.auto_policy_status)
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
    else { USER_COL_DEFS.forEach(function(c) { visibleUserCols[c.key] = c.key !== 'id'; }); }
  } catch (e) {
    EMP_COL_DEFS.forEach(function(c) { visibleEmpCols[c.key] = true; });
    USER_COL_DEFS.forEach(function(c) { visibleUserCols[c.key] = c.key !== 'id'; });
  }

  await Promise.all([loadUsers(), loadEmployees(), loadOrgRoles(), loadActivityLog()]);
  var loadingEl = document.getElementById('adminLoading');
  if (loadingEl) loadingEl.style.display = 'none';
  document.getElementById('tab-overview').style.display = 'block';
  updateKpi();
  checkStep2Reminders();

  // ===== Populate welcome card =====
  var firstName = u.first_name || u.email || '';
  var orgName = u.org_name || localStorage.getItem('driven_org_name') || '';
  var welcomeNameEl = document.getElementById('um-welcome-name');
  if (welcomeNameEl) {
    welcomeNameEl.textContent = firstName ? ('Welcome back, ' + firstName + (orgName ? ' - ' + orgName : '')) : 'Welcome back';
  }
  var welcomeRoleEl = document.getElementById('um-welcome-role');
  if (welcomeRoleEl) welcomeRoleEl.textContent = u.role || u.role_id || '';
  var welcomeEmailEl = document.getElementById('um-welcome-email');
  if (welcomeEmailEl) welcomeEmailEl.textContent = u.email || '';

  // ===== Wire theme toggle =====
  var themeCheckbox = document.getElementById('dashThemeCheckbox');
  var themeLabelLight = document.getElementById('dashThemeLabelLight');
  var themeLabelDark = document.getElementById('dashThemeLabelDark');
  if (themeCheckbox) {
    var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    themeCheckbox.checked = (currentTheme === 'dark');
    if (themeLabelLight) themeLabelLight.classList.toggle('active', currentTheme === 'light');
    if (themeLabelDark) themeLabelDark.classList.toggle('active', currentTheme === 'dark');
    themeCheckbox.addEventListener('change', function() {
      var newTheme = themeCheckbox.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('driven-theme', newTheme);
      if (themeLabelLight) themeLabelLight.classList.toggle('active', newTheme === 'light');
      if (themeLabelDark) themeLabelDark.classList.toggle('active', newTheme === 'dark');
    });
  }

  // ===== Wire UOM select (matches admin dashboard pattern) =====
  var uomSelect = document.getElementById('umUomSelect');
  var uomHint = document.getElementById('umUomHint');
  if (uomSelect) {
    if (window.DRIVEN_UNITS && DRIVEN_UNITS.getUserUnitPreference) {
      DRIVEN_UNITS.getUserUnitPreference().then(function(info) {
        if (!info) return;
        uomSelect.value = info.user_preference || 'org_default';
        if (info.org_default && info.user_preference === 'org_default') {
          if (uomHint) uomHint.textContent = 'Org default: ' + (info.org_default === 'metric' ? 'Metric' : 'Imperial');
        } else if (uomHint) { uomHint.textContent = ''; }
      });
    } else {
      var savedUom = localStorage.getItem('driven_uom') || 'org_default';
      uomSelect.value = savedUom;
      var storedSys = localStorage.getItem('driv-en-unit-system') || 'imperial';
      if (uomHint && savedUom === 'org_default') uomHint.textContent = 'Org default: ' + (storedSys === 'metric' ? 'Metric' : 'Imperial');
    }
    uomSelect.addEventListener('change', function() {
      var val = uomSelect.value;
      if (window.DRIVEN_UNITS && DRIVEN_UNITS.setUserUnitPreference) {
        DRIVEN_UNITS.setUserUnitPreference(val).then(function(result) {
          if (!result) { alert('Failed to update unit preference. Please try again.'); return; }
          if (uomHint) { if (val === 'org_default' && result.unit_system) { uomHint.textContent = 'Org default: ' + (result.unit_system === 'metric' ? 'Metric' : 'Imperial'); } else { uomHint.textContent = ''; } }
          if (window.DRIVEN_APPLY_UNITS) { try { DRIVEN_APPLY_UNITS.refresh(); } catch(e){} }
          try { localStorage.setItem('driv-en-unit-system-changed', Date.now().toString()); localStorage.setItem('driv-en-unit-system', result.unit_system); } catch (e) {}
          showToast('Units of measure updated.', 'success');
        });
      } else {
        localStorage.setItem('driven_uom', val);
        var sys = localStorage.getItem('driv-en-unit-system') || 'imperial';
        if (uomHint) { if (val === 'org_default') { uomHint.textContent = 'Org default: ' + (sys === 'metric' ? 'Metric' : 'Imperial'); } else { uomHint.textContent = ''; } }
        showToast('Units of measure updated.', 'success');
      }
    });
  }

  // ===== Wire Language select =====
  var langSelect = document.getElementById('umLangSelect');
  if (langSelect) {
    var savedLang = localStorage.getItem('driven_lang') || 'en';
    langSelect.value = savedLang;
    langSelect.addEventListener('change', function() {
      var val = langSelect.value;
      localStorage.setItem('driven_lang', val);
      if (window.DRIVEN_TRANSLATE) { try { DRIVEN_TRANSLATE.setLanguage(val); } catch(e){} }
      showToast('Language preference updated.', 'success');
    });
  }

  // ===== Wire Purpose / Instructions modals =====
  var btnPurpose = document.getElementById('btnTabPurpose');
  if (btnPurpose) {
    btnPurpose.addEventListener('click', function(e) {
      if (e) e.preventDefault();
      var contextKey = getActiveContext();
      var title = getContextTitle(contextKey);
      var content = MODAL_CONTENT_MAP[contextKey] || MODAL_CONTENT_MAP.overview;
      var mpt = document.getElementById('modalPurposeTitle');
      var mpb = document.getElementById('modalPurposeBody');
      if (mpt) mpt.textContent = title + ' - Purpose';
      if (mpb) mpb.innerHTML = content.purpose;
      openInfoModal('modalPurpose');
    });
  }
  var btnInstructions = document.getElementById('btnTabInstructions');
  if (btnInstructions) {
    btnInstructions.addEventListener('click', function(e) {
      if (e) e.preventDefault();
      var contextKey = getActiveContext();
      var title = getContextTitle(contextKey);
      var content = MODAL_CONTENT_MAP[contextKey] || MODAL_CONTENT_MAP.overview;
      var mit = document.getElementById('modalInstructionsTitle');
      var mib = document.getElementById('modalInstructionsBody');
      if (mit) mit.textContent = title + ' - Instructions';
      if (mib) mib.innerHTML = content.instructions;
      openInfoModal('modalInstructions');
    });
  }
  var btnClosePurpose = document.getElementById('btnClosePurposeModal');
  if (btnClosePurpose) btnClosePurpose.addEventListener('click', function() { closeInfoModal('modalPurpose'); });
  var btnCloseInstructions = document.getElementById('btnCloseInstructionsModal');
  if (btnCloseInstructions) btnCloseInstructions.addEventListener('click', function() { closeInfoModal('modalInstructions'); });
  window.addEventListener('click', function(e) {
    if (e.target === document.getElementById('modalPurpose')) closeInfoModal('modalPurpose');
    if (e.target === document.getElementById('modalInstructions')) closeInfoModal('modalInstructions');
  });

  // ===== Re-trigger customer logo load after header rebuild =====
  setTimeout(function() {
    var logoArea = document.getElementById('dashCustomerLogoArea');
    if (logoArea && (!logoArea.querySelector('img') || logoArea.querySelector('.dash-customer-logo-placeholder'))) {
      fetch('/auth/get-logo').then(function(r) { return r.json(); }).then(function(d) {
        if (d.success && d.logo) {
          localStorage.setItem('driven_customer_logo', d.logo);
          logoArea.innerHTML = '<img src="' + d.logo + '" class="dash-customer-logo" alt="Company Logo">';
        } else {
          var cached = localStorage.getItem('driven_customer_logo');
          if (cached) logoArea.innerHTML = '<img src="' + cached + '" class="dash-customer-logo" alt="Company Logo">';
        }
      }).catch(function() {
        var cached = localStorage.getItem('driven_customer_logo');
        if (cached) logoArea.innerHTML = '<img src="' + cached + '" class="dash-customer-logo" alt="Company Logo">';
      });
    }
  }, 300);

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

function populateRoleSelect() {
  var sel = document.getElementById('addEmpRole');
  if (!sel) return;
  var currentVal = sel.value;
  sel.innerHTML = '';
  if (allOrgRoles && allOrgRoles.length > 0) {
    allOrgRoles.forEach(function(r) {
      var opt = document.createElement('option');
      opt.value = r.id || r.name;
      opt.textContent = r.name || r.id;
      sel.appendChild(opt);
    });
  } else {
    sel.innerHTML = '<option value="Employee">Employee</option><option value="Fleet Manager">Fleet Manager</option><option value="Admin">Admin</option>';
  }
  if (currentVal) {
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === currentVal) { sel.value = currentVal; break; }
    }
  }
}

async function loadOrgRoles() {
  try {
    var resp = await fetch('/api/roles?org_id=' + encodeURIComponent(currentUserOrgId));
    if (resp.ok) {
      var data = await resp.json();
      allOrgRoles = data.roles || data.records || data.data || (Array.isArray(data) ? data : []);
    } else throw new Error();
  } catch (e) {
    allOrgRoles = [
      { id: '1', name: 'Admin', description: 'Full administrative access', is_system: 1 },
      { id: '2', name: 'Fleet Manager', description: 'Fleet and asset management', is_system: 0 },
      { id: '3', name: 'Employee', description: 'Standard driver / employee portal view', is_system: 0 }
    ];
  }
  renderRolesTable();
  populateRoleSelect();
  buildMultiSelectPanels();
}

async function loadActivityLog() {
  try {
    var resp = await fetch('/api/audit-log');
    if (resp.ok) {
      var data = await resp.json();
      allActivityLogs = data.logs || data.audit_entries || data.records || data.data || (Array.isArray(data) ? data : []);
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
    tr.setAttribute('data-role-id', r.id || '');
    var isSystem = r.is_system && r.is_system !== 0 && r.is_system !== '0' && r.is_system !== false;
    var actionsHtml;
    if (isSystem) {
      actionsHtml = '<span style="font-size:12px; color:var(--text-muted);">System role</span>';
    } else {
      actionsHtml = '<div class="um-actions-wrap">' +
        '<button class="um-table-btn" onclick="editRole(\'' + escapeHtml(String(r.id || '')) + '\')">Edit</button>' +
        '<button class="um-table-btn" style="border-color:#dc2626; color:#dc2626;" onclick="deleteRole(\'' + escapeHtml(String(r.id || '')) + '\')">Delete</button>' +
        '</div>';
    }
    var activeCount = allEmployees.filter(function(e) {
      if (e.status !== 'Active') return false;
      var empRole = String(e.role || '').toLowerCase();
      var empRoleId = String(e.roleId || e.role_id || '').toLowerCase();
      return empRole === String(r.name || '').toLowerCase() ||
             empRole === String(r.id || '').toLowerCase() ||
             empRoleId === String(r.id || '').toLowerCase() ||
             empRoleId === String(r.name || '').toLowerCase();
    }).length;
    var countBadge = '<span style="font-size:11px; padding:2px 8px; border-radius:10px; margin-left:8px; ' +
      (activeCount > 0 ? 'background:rgba(34,197,94,0.15); color:#16a34a;' : 'background:rgba(220,38,38,0.15); color:#dc2626;') +
      '">' + activeCount + ' active</span>';
    tr.innerHTML = '<td><strong>' + escapeHtml(r.name) + '</strong>' + countBadge + '</td>' +
                   '<td>' + escapeHtml(r.description || '\u2014') + '</td>' +
                   '<td>' + (isSystem ? 'Yes' : 'No') + '</td>' +
                   '<td class="am-actions">' + actionsHtml + '</td>';
    container.appendChild(tr);
  });
  updateSortIcons('roles');
}

function openAddRoleModal() {
  document.getElementById('roleModalTitle').textContent = 'Add New Role';
  document.getElementById('editRoleId').value = '';
  document.getElementById('addRoleName').value = '';
  document.getElementById('addRoleDesc').value = '';
  document.getElementById('umAddRoleModal').classList.add('active');
}

function editRole(roleId) {
  var role = allOrgRoles.find(function(r) { return String(r.id) === String(roleId); });
  if (!role) { showToast('Role not found', 'error'); return; }
  document.getElementById('roleModalTitle').textContent = 'Edit Role';
  document.getElementById('editRoleId').value = roleId;
  document.getElementById('addRoleName').value = role.name || '';
  document.getElementById('addRoleDesc').value = role.description || '';
  document.getElementById('umAddRoleModal').classList.add('active');
}

async function submitSaveRole() {
  var roleId = document.getElementById('editRoleId').value;
  var name = document.getElementById('addRoleName').value.trim();
  var desc = document.getElementById('addRoleDesc').value.trim();
  if (!name) { showToast('Role name is required', 'error'); return; }
  try {
    var url, method, body;
    if (roleId) {
      url = '/api/roles/' + encodeURIComponent(roleId);
      method = 'PUT';
      body = { name: name, description: desc };
    } else {
      url = '/api/roles';
      method = 'POST';
      body = { name: name, description: desc, is_system: 0 };
    }
    var resp = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error('Save failed (' + resp.status + ')');
    closeModal('umAddRoleModal');
    showToast(roleId ? 'Role updated successfully' : 'Role added successfully', 'success');
    await loadOrgRoles();
    updateKpi();
  } catch (e) {
    showToast('Failed to save role: ' + e.message, 'error');
  }
}

async function deleteRole(roleId) {
  var role = allOrgRoles.find(function(r) { return String(r.id) === String(roleId); });
  if (!role) return;
  if (role.is_system && role.is_system !== 0 && role.is_system !== '0' && role.is_system !== false) {
    showToast('System roles cannot be deleted', 'error'); return;
  }
  if (!confirm('Delete role "' + (role.name || '') + '"? This cannot be undone.')) return;
  try {
    var resp = await fetch('/api/roles/' + encodeURIComponent(roleId), { method: 'DELETE' });
    if (!resp.ok) throw new Error('Delete failed (' + resp.status + ')');
    showToast('Role deleted', 'success');
    await loadOrgRoles();
    updateKpi();
  } catch (e) {
    showToast('Failed to delete role: ' + e.message, 'error');
  }
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
  document.getElementById('kpiRoles').textContent = allOrgRoles.length;
  checkAdminFlag();
}

function checkAdminFlag() {
  var banner = document.getElementById('adminFlagBanner');
  if (!banner) return;
  // Gate: only show to users who can assign roles (any admin-level role or Fleet Manager)
  var u = window.dashUser || window.drivenUser || {};
  var userRole = String(u.role || u.role_name || u.roleName || '').toLowerCase();
  var canAssignRoles = (userRole.indexOf('admin') >= 0 || userRole === 'fleet manager' || userRole === 'fleet_manager' || u.can_assign_roles === true || u.is_admin === true);
  if (!canAssignRoles) { banner.style.display = 'none'; return; }
  var activeAdmins = allEmployees.filter(function(e) {
    return e.status === 'Active' && (e.role || '').toLowerCase().indexOf('admin') >= 0;
  }).length;
  banner.style.display = activeAdmins > 0 ? 'none' : 'flex';
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

  // Re-scan for voice dictation buttons on newly rendered content
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
  var cdEl = document.getElementById('addEmpCommercialDriver'); if (cdEl) cdEl.value = 'no';
  var dlExpEl = document.getElementById('addEmpDlExp'); if (dlExpEl) dlExpEl.value = '';
  var dcvEl = document.getElementById('addEmpDrivesCoVehicle'); if (dcvEl) dcvEl.value = 'no';
  var ueaEl = document.getElementById('addEmpUsesEmpAssets'); if (ueaEl) ueaEl.value = 'no';
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
  var roleSel = document.getElementById('addEmpRole');
  if (roleSel) {
    var matched = false;
    for (var i = 0; i < roleSel.options.length; i++) {
      if (roleSel.options[i].value === (emp.roleId || '') || roleSel.options[i].value === (emp.role || '') || roleSel.options[i].text === (emp.role || '')) {
        roleSel.selectedIndex = i; matched = true; break;
      }
    }
    if (!matched) roleSel.value = emp.role || '';
  }
  document.getElementById('addEmpPhone').value = emp.phone !== '\u2014' ? emp.phone : '';
  document.getElementById('addEmpDob').value = emp.dob !== '\u2014' ? emp.dob : '';
  document.getElementById('addEmpAddress').value = emp.address !== '\u2014' ? emp.address : '';
  document.getElementById('addEmpCity').value = emp.city !== '\u2014' ? emp.city : '';
  document.getElementById('addEmpState').value = emp.state !== '\u2014' ? emp.state : '';
  document.getElementById('addEmpZip').value = emp.zip !== '\u2014' ? emp.zip : '';
  document.getElementById('addEmpStatus').value = emp.status;
  document.getElementById('addEmpDl').value = emp.driversLicense !== '\u2014' ? emp.driversLicense : '';
  document.getElementById('addEmpDlState').value = emp.dlState !== '\u2014' ? emp.dlState : '';
  var cdEl2 = document.getElementById('addEmpCommercialDriver'); if (cdEl2) cdEl2.value = emp.is_commercial_driver === 'yes' ? 'yes' : 'no';
  var dlExpEl2 = document.getElementById('addEmpDlExp'); if (dlExpEl2) dlExpEl2.value = (emp.dl_expiration && emp.dl_expiration !== '\u2014') ? emp.dl_expiration : '';
  var dcvEl2 = document.getElementById('addEmpDrivesCoVehicle'); if (dcvEl2) dcvEl2.value = emp.drives_company_vehicle === 'yes' ? 'yes' : 'no';
  var ueaEl2 = document.getElementById('addEmpUsesEmpAssets'); if (ueaEl2) ueaEl2.value = emp.uses_employee_assets === 'yes' ? 'yes' : 'no';
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
  var isCD = document.getElementById('addEmpCommercialDriver') ? document.getElementById('addEmpCommercialDriver').value : 'no';
  var dlExp = document.getElementById('addEmpDlExp') ? document.getElementById('addEmpDlExp').value : '';
  var drivesCoVeh = document.getElementById('addEmpDrivesCoVehicle') ? document.getElementById('addEmpDrivesCoVehicle').value : 'no';
  var usesEmpAssets = document.getElementById('addEmpUsesEmpAssets') ? document.getElementById('addEmpUsesEmpAssets').value : 'no';

  // Upload DL photos if selected (uploads to R2 via API)
  var dlFrontKey = '', dlBackKey = '';
  var dlFrontFile = document.getElementById('addEmpDlFrontPhoto');
  var dlBackFile = document.getElementById('addEmpDlBackPhoto');
  if (dlFrontFile && dlFrontFile.files && dlFrontFile.files[0]) {
    try { dlFrontKey = await uploadEmployeeDoc(dlFrontFile.files[0], 'dl_front', id || 'new'); } catch(e) { console.warn('DL front upload failed:', e); }
  }
  if (dlBackFile && dlBackFile.files && dlBackFile.files[0]) {
    try { dlBackKey = await uploadEmployeeDoc(dlBackFile.files[0], 'dl_back', id || 'new'); } catch(e) { console.warn('DL back upload failed:', e); }
  }

  if (!fn || !ln) {
    showToast('First and Last name are required.', 'error');
    return;
  }

  // Warn if deactivating the last active admin
  if (status === 'Inactive' && (role || '').toLowerCase().indexOf('admin') >= 0) {
    var otherActiveAdmins = allEmployees.filter(function(e) {
      return String(e.id) !== String(id) && e.status === 'Active' &&
             (e.role || '').toLowerCase().indexOf('admin') >= 0;
    }).length;
    if (otherActiveAdmins === 0) {
      if (!confirm('This is the last active Admin for your organization. You will lose administrative access until another employee is assigned the Admin role. Continue?')) {
        return;
      }
    }
  }

  var fullStr = [fn, mn, ln].filter(Boolean).join(' ') + (suffix ? ' ' + suffix : '');
  var payload = {
    id: id || undefined, org_id: currentUserOrgId,
    first_name: fn, middle_name: mn, last_name: ln, suffix: suffix, full_name: fullStr, name: fullStr,
    email: em, employee_number: empNum, role: role, phone: phone, dob: dob, address: addr,
    city: city, state: state, zip: zip, status: status, drivers_license: dl, dl_state: dlState,
    is_commercial_driver: isCD,
    dl_expiration: dlExp || undefined,
    drives_company_vehicle: drivesCoVeh,
    uses_employee_assets: usesEmpAssets,
    dl_photo_front: dlFrontKey || undefined,
    dl_photo_back: dlBackKey || undefined
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

  // Handle commercial driver compliance flow
  var savedId = id;
  if (!savedId && resp) {
    try { var rj = await resp.clone().json(); savedId = rj.id || rj.result?.id || rj.result?.[0]?.id; } catch(e) {}
  }
  if (isCD === 'yes' && savedId) {
    updateStep2Status(savedId, 'pending');
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: currentUserOrgId,
          type: 'new_driver',
          title: 'New Driver Hired — Action Required',
          message: fullStr + ' has been hired as a commercial driver. Complete their Driver Qualification File.',
          target_user_id: null,
          link: '/app/dashboard/driver-qualification-files.html',
          created_at: new Date().toISOString()
        })
      });
    } catch(e) { console.warn('Notification failed:', e); }
    showToast('Driver flagged as commercial. Safety/Compliance team notified to complete DQF.', 'success');
    checkStep2Reminders();
  }

  // Notify if employee uses personal vehicle/asset for work
  if (usesEmpAssets === 'yes' && savedId) {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: currentUserOrgId,
          type: 'emp_owned_asset',
          title: 'Employee Uses Personal Asset — Insurance Required',
          message: fullStr + ' uses a personal vehicle/asset for work. Collect proof of insurance, carrier, type/limits, and expiration.',
          target_user_id: null,
          link: '/app/dashboard/driver-qualification-files.html',
          created_at: new Date().toISOString()
        })
      });
    } catch(e) { console.warn('Notification failed:', e); }
    showToast('Employee flagged as using personal asset. Safety/Compliance team notified to collect insurance docs.', 'success');
  }
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
function filterByKpi(type) {
  if (type === 'ActiveEmployees') switchTab('employees');
  else if (type === 'Roles') switchTab('roles');
  else switchTab('employees');
}

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
  // Close any open modals when switching tabs
  document.querySelectorAll('.um-modal.active, .um-modal-overlay.active').forEach(function(m) {
    m.classList.remove('active');
    m.style.display = 'none';
  });

  document.querySelectorAll('.um-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.um-tab-content').forEach(function(c) { c.style.display = 'none'; c.classList.remove('active'); });

  var targetTab = document.querySelector('.um-tab[data-tab="' + tab + '"]');
  if (targetTab) targetTab.classList.add('active');

  var targetContent = document.getElementById('tab-' + tab);
  if (targetContent) {
    targetContent.style.display = 'block';
    targetContent.classList.add('active');
  }

  // Show/hide Back to Overview button in pill bar (hidden on Overview tab)
  var pillBack = document.getElementById('umPillBackBtn');
  if (pillBack) {
    pillBack.style.display = (tab === 'overview') ? 'none' : 'inline-flex';
  }

  // Scroll to top of content area
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

// ============================================================
// STEP 2 — COMPLIANCE & EMPLOYEE-OWNED ASSETS
// ============================================================
var step2EmployeeId = null;
var step2EmployeeName = '';
var step2Assets = [];
var step2AssetCounter = 0;

function showStep2Prompt(empId, empName) {
  step2EmployeeId = empId;
  step2EmployeeName = empName;
  var prompt = document.getElementById('umStep2Prompt');
  var text = document.getElementById('umStep2PromptText');
  if (text) text.textContent = 'Will ' + (empName || 'this employee') + ' be providing personal assets (truck, welding machine, equipment, etc.) for business purposes?';
  if (prompt) prompt.classList.add('active');
}

function step2PromptResponse(answer) {
  document.getElementById('umStep2Prompt').classList.remove('active');
  if (answer === true) {
    updateStep2Status(step2EmployeeId, 'incomplete');
    openStep2Modal(step2EmployeeId, step2EmployeeName);
  } else if (answer === false) {
    updateStep2Status(step2EmployeeId, 'not_needed');
    showToast('Employee saved. Step 2 marked as not needed.', 'success');
  } else {
    updateStep2Status(step2EmployeeId, 'incomplete');
    showToast('Employee saved. You can complete Step 2 later.', 'success');
    checkStep2Reminders();
  }
}

function updateStep2Status(empId, status) {
  if (!empId) return;
  try {
    fetch('/api/employees/' + encodeURIComponent(empId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step2_status: status })
    });
  } catch(e) { console.warn('Step2 status update failed:', e); }
  var emp = allEmployees.find(function(x) { return x.id === empId; });
  if (emp) emp.step2_status = status;
}

function openStep2Modal(empId, empName) {
  step2EmployeeId = empId;
  step2EmployeeName = empName || '';
  step2Assets = [];
  step2AssetCounter = 0;
  var titleEl = document.getElementById('umStep2Title');
  if (titleEl) titleEl.textContent = 'Compliance & Assets — ' + (empName || 'Employee');
  document.getElementById('umStep2Modal').classList.add('active');
  loadStep2Data(empId);
}

function closeStep2Modal() {
  document.getElementById('umStep2Modal').classList.remove('active');
}

function loadStep2Data(empId) {
  var emp = allEmployees.find(function(x) { return x.id === empId; });
  if (emp) {
    setVal('step2_auth_company_vehicle', emp.authorized_company_vehicle || '');
    setVal('step2_cdl_class', emp.cdl_class || 'none');
    setVal('step2_dr_verified', emp.driving_record_verified || '');
    setVal('step2_dr_recheck', emp.driving_record_recheck_date || '');
    setVal('step2_med_exp', emp.medical_card_expiration || '');
    setVal('step2_bg_date', emp.background_check_date || '');
    setVal('step2_bg_recheck', emp.background_check_recheck || '');
    setVal('step2_dt_date', emp.drug_test_date || '');
    setVal('step2_dt_recheck', emp.drug_test_recheck || '');
    var endorsements = (emp.cdl_endorsements || '').split(',').filter(Boolean);
    document.querySelectorAll('.um-step2-section input[type=checkbox]').forEach(function(cb) {
      cb.checked = endorsements.includes(cb.value);
    });
    updateStep2StatusBadge('dr'); updateStep2StatusBadge('med'); updateStep2StatusBadge('bg'); updateStep2StatusBadge('dt');
  }
  loadEmployeeAssets(empId);
}

function setVal(id, val) { var el = document.getElementById(id); if (el) el.value = val; }

function loadEmployeeAssets(empId) {
  fetch('/api/employee-owned-assets?employee_id=' + encodeURIComponent(empId))
    .then(function(r) { return r.ok ? r.json() : { records: [] }; })
    .then(function(data) {
      step2Assets = data.records || data.data || data.assets || [];
      if (!Array.isArray(step2Assets)) step2Assets = [];
      var list = document.getElementById('step2_assets_list');
      if (list) list.innerHTML = '';
      step2Assets.forEach(function(a) { addAssetCard(a); });
      var hasAssets = step2Assets.length > 0;
      document.getElementById('step2_has_assets').checked = hasAssets;
      toggleAssetSection();
    })
    .catch(function(e) {
      step2Assets = [];
      toggleAssetSection();
    });
}

function toggleAssetSection() {
  var cb = document.getElementById('step2_has_assets');
  var container = document.getElementById('step2_assets_container');
  if (cb && container) container.style.display = cb.checked ? 'block' : 'none';
}

function addAssetCard(existing) {
  step2AssetCounter++;
  var cardId = 'asset_card_' + step2AssetCounter;
  var a = existing || {};
  var isVehicle = (a.asset_type === 'vehicle');
  var html = '<div class="um-asset-card" id="' + cardId + '" data-asset-id="' + (a.id || '') + '">' +
    '<div class="um-asset-card-header">' +
      '<div class="um-asset-card-title">Asset #' + step2AssetCounter + (a.asset_type ? ' — ' + a.asset_type : '') + '</div>' +
      '<button class="um-asset-remove" onclick="removeAssetCard(\'' + cardId + '\')">Remove</button>' +
    '</div>' +
    '<div class="um-step2-grid">' +
      '<div class="um-step2-field"><label>Asset Type</label><select onchange="onAssetTypeChange(\'' + cardId + '\')" id="' + cardId + '_type">' +
        '<option value="">-- Select --</option>' +
        '<option value="vehicle"' + (isVehicle ? ' selected' : '') + '>Vehicle</option>' +
        '<option value="welding"' + (a.asset_type === 'welding' ? ' selected' : '') + '>Welding Machine</option>' +
        '<option value="equipment"' + (a.asset_type === 'equipment' ? ' selected' : '') + '>Equipment</option>' +
        '<option value="generator"' + (a.asset_type === 'generator' ? ' selected' : '') + '>Generator</option>' +
        '<option value="other"' + (a.asset_type === 'other' ? ' selected' : '') + '>Other</option>' +
      '</select></div>' +
      '<div class="um-step2-field"><label>Description</label><input type="text" id="' + cardId + '_desc" value="' + esc(a.asset_description || '') + '"></div>' +
      '<div class="um-step2-field"><label>Make</label><input type="text" id="' + cardId + '_make" value="' + esc(a.make || '') + '"></div>' +
      '<div class="um-step2-field"><label>Model</label><input type="text" id="' + cardId + '_model" value="' + esc(a.model || '') + '"></div>' +
      '<div class="um-step2-field"><label>Year</label><input type="text" id="' + cardId + '_year" value="' + esc(a.year || '') + '"></div>' +
      '<div class="um-step2-field"><label>Serial Number</label><input type="text" id="' + cardId + '_serial" value="' + esc(a.serial_number || '') + '"></div>' +
      '<div class="um-step2-field"><label>Start Date</label><input type="date" id="' + cardId + '_start" value="' + esc(a.start_date || '') + '"></div>' +
    '</div>' +
    '<div class="um-asset-vehicle-fields' + (isVehicle ? ' show' : '') + '" id="' + cardId + '_vehicle">' +
      '<div class="um-step2-grid" style="margin-top:8px;">' +
        '<div class="um-step2-field"><label>VIN</label><input type="text" id="' + cardId + '_vin" value="' + esc(a.vin || '') + '"></div>' +
        '<div class="um-step2-field"><label>Insurance Carrier</label><input type="text" id="' + cardId + '_ins_carrier" value="' + esc(a.insurance_carrier || '') + '"></div>' +
        '<div class="um-step2-field"><label>Insurance Policy #</label><input type="text" id="' + cardId + '_ins_policy" value="' + esc(a.insurance_policy_num || '') + '"></div>' +
        '<div class="um-step2-field"><label>Insurance Expiration</label><input type="date" id="' + cardId + '_ins_exp" value="' + esc(a.insurance_expiration || '') + '"></div>' +
      '</div>' +
      '<div class="um-step2-field um-step2-field-full" style="margin-top:8px;"><label>Insurance Document</label><div class="um-step2-file-row"><input type="file" id="' + cardId + '_ins_doc" accept="image/*,application/pdf"><div class="um-step2-file-placeholder">&#128247;</div></div></div>' +
      '<div class="um-step2-field um-step2-field-full" style="margin-top:8px;"><label>Registration Document</label><div class="um-step2-file-row"><input type="file" id="' + cardId + '_reg_doc" accept="image/*,application/pdf"><div class="um-step2-file-placeholder">&#128247;</div></div></div>' +
      '<div class="um-step2-field" style="margin-top:8px;"><label>Registration Expiration</label><input type="date" id="' + cardId + '_reg_exp" value="' + esc(a.registration_exp || '') + '"></div>' +
    '</div>' +
    '<div class="um-step2-field um-step2-field-full" style="margin-top:8px;"><label>Notes</label><textarea id="' + cardId + '_notes" rows="2">' + esc(a.notes || '') + '</textarea></div>' +
  '</div>';
  var list = document.getElementById('step2_assets_list');
  if (list) list.insertAdjacentHTML('beforeend', html);
}

function onAssetTypeChange(cardId) {
  var sel = document.getElementById(cardId + '_type');
  var vehFields = document.getElementById(cardId + '_vehicle');
  if (sel && vehFields) vehFields.classList.toggle('show', sel.value === 'vehicle');
  var title = document.querySelector('#' + cardId + ' .um-asset-card-title');
  if (title) title.textContent = 'Asset — ' + (sel.value || 'New');
}

function removeAssetCard(cardId) {
  var card = document.getElementById(cardId);
  if (card) {
    var assetId = card.getAttribute('data-asset-id');
    if (assetId) {
      try { fetch('/api/employee-owned-assets/' + encodeURIComponent(assetId), { method: 'DELETE' }); } catch(e) {}
    }
    card.remove();
  }
}

function calculateComplianceStatus(expDate) {
  if (!expDate) return 'none';
  var now = new Date(); now.setHours(0,0,0,0);
  var exp = new Date(expDate); exp.setHours(0,0,0,0);
  var diffDays = Math.floor((exp - now) / 86400000);
  if (diffDays < 0) return 'expired';
  if (diffDays <= 7) return '7day';
  if (diffDays <= 30) return '30day';
  return 'current';
}

function statusBadgeClass(status) {
  return { current: 'um-status-current', '30day': 'um-status-30day', '7day': 'um-status-7day', expired: 'um-status-expired', none: 'um-status-none' }[status] || 'um-status-none';
}

function statusBadgeText(status) {
  return { current: 'Current', '30day': '30 Days', '7day': '7 Days', expired: 'Expired', none: 'Not Set' }[status] || 'Not Set';
}

function updateStep2StatusBadge(type) {
  var dateVal = '';
  var badgeId = '';
  if (type === 'dr') { dateVal = document.getElementById('step2_dr_recheck') ? document.getElementById('step2_dr_recheck').value : ''; badgeId = 'step2_dr_status_badge'; }
  else if (type === 'med') { dateVal = document.getElementById('step2_med_exp') ? document.getElementById('step2_med_exp').value : ''; badgeId = 'step2_med_status_badge'; }
  else if (type === 'bg') { dateVal = document.getElementById('step2_bg_recheck') ? document.getElementById('step2_bg_recheck').value : ''; badgeId = 'step2_bg_status_badge'; }
  else if (type === 'dt') { dateVal = document.getElementById('step2_dt_recheck') ? document.getElementById('step2_dt_recheck').value : ''; badgeId = 'step2_dt_status_badge'; }
  if (!badgeId) return;
  var status = calculateComplianceStatus(dateVal);
  var badge = document.getElementById(badgeId);
  if (badge) { badge.className = 'um-status-badge ' + statusBadgeClass(status); badge.textContent = statusBadgeText(status); }
}

async function saveStep2(complete) {
  var endorsements = [];
  document.querySelectorAll('.um-step2-section input[type=checkbox]:checked').forEach(function(cb) { endorsements.push(cb.value); });
  var compliancePayload = {
    authorized_company_vehicle: getVal('step2_auth_company_vehicle'),
    cdl_class: getVal('step2_cdl_class'),
    cdl_endorsements: endorsements.join(','),
    driving_record_verified: getVal('step2_dr_verified'),
    driving_record_recheck_date: getVal('step2_dr_recheck'),
    driving_record_status: calculateComplianceStatus(getVal('step2_dr_recheck')),
    medical_card_expiration: getVal('step2_med_exp'),
    medical_card_status: calculateComplianceStatus(getVal('step2_med_exp')),
    background_check_date: getVal('step2_bg_date'),
    background_check_recheck: getVal('step2_bg_recheck'),
    background_check_status: calculateComplianceStatus(getVal('step2_bg_recheck')),
    drug_test_date: getVal('step2_dt_date'),
    drug_test_recheck: getVal('step2_dt_recheck'),
    drug_test_status: calculateComplianceStatus(getVal('step2_dt_recheck')),
    auto_policy_status: 'none',
    step2_status: complete ? 'complete' : 'incomplete'
  };

  var hasVehicle = false;
  var earliestInsExp = null;
  document.querySelectorAll('.um-asset-card').forEach(function(card) {
    var typeSel = card.querySelector('select[id$="_type"]');
    if (typeSel && typeSel.value === 'vehicle') {
      hasVehicle = true;
      var insExp = card.querySelector('input[id$="_ins_exp"]');
      if (insExp && insExp.value) {
        if (!earliestInsExp || insExp.value < earliestInsExp) earliestInsExp = insExp.value;
      }
    }
  });
  if (hasVehicle) compliancePayload.auto_policy_status = calculateComplianceStatus(earliestInsExp);

  try {
    await fetch('/api/employees/' + encodeURIComponent(step2EmployeeId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(compliancePayload)
    });
  } catch(e) { console.warn('Compliance save failed:', e); }

  var cards = document.querySelectorAll('.um-asset-card');
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var cid = card.id;
    var assetData = {
      employee_id: step2EmployeeId,
      org_id: currentUserOrgId,
      asset_type: getVal(cid + '_type'),
      asset_description: getVal(cid + '_desc'),
      make: getVal(cid + '_make'),
      model: getVal(cid + '_model'),
      year: getVal(cid + '_year'),
      serial_number: getVal(cid + '_serial'),
      vin: getVal(cid + '_vin'),
      insurance_carrier: getVal(cid + '_ins_carrier'),
      insurance_policy_num: getVal(cid + '_ins_policy'),
      insurance_expiration: getVal(cid + '_ins_exp'),
      registration_exp: getVal(cid + '_reg_exp'),
      start_date: getVal(cid + '_start'),
      notes: getVal(cid + '_notes')
    };
    if (assetData.asset_type === 'vehicle') {
      assetData.insurance_status = calculateComplianceStatus(assetData.insurance_expiration);
    }
    var assetId = card.getAttribute('data-asset-id');
    try {
      if (assetId) {
        await fetch('/api/employee-owned-assets/' + encodeURIComponent(assetId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(assetData) });
      } else {
        assetData.id = 'eoa_' + Date.now() + '_' + i;
        await fetch('/api/employee-owned-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(assetData) });
      }
    } catch(e) { console.warn('Asset save failed:', e); }
  }

  var emp = allEmployees.find(function(x) { return x.id === step2EmployeeId; });
  if (emp) Object.assign(emp, compliancePayload);

  showToast(complete ? 'Step 2 completed and saved.' : 'Step 2 saved. You can complete it later.', 'success');
  closeStep2Modal();
  renderEmpTable();
  updateKpi();
  checkStep2Reminders();
}

function getVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function checkStep2Reminders() {
  var incomplete = allEmployees.filter(function(e) { return e.step2_status === 'incomplete' || e.step2_status === 'pending'; });
  var banner = document.getElementById('umStep2Reminder');
  var text = document.getElementById('umStep2ReminderText');
  if (incomplete.length > 0 && banner && text) {
    text.textContent = incomplete.length + ' employee' + (incomplete.length > 1 ? 's' : '') + ' have incomplete compliance & asset information (Step 2). Click to review.';
    banner.style.display = 'flex';
  } else if (banner) {
    banner.style.display = 'none';
  }
}

// Upload employee document to R2 via API
async function uploadEmployeeDoc(file, docType, empId) {
  var formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);
  formData.append('employee_id', empId);
  formData.append('org_id', currentUserOrgId);
  var resp = await fetch('/api/employee-documents/upload', { method: 'POST', body: formData });
  if (!resp.ok) throw new Error('Upload failed');
  var data = await resp.json();
  return data.key || data.r2_key || data.result?.key || '';
}

// View employee document from R2
function viewEmployeeDoc(docKey) {
  if (!docKey) { showToast('No document available.', 'error'); return; }
  window.open('/api/employee-documents/' + encodeURIComponent(docKey), '_blank');
}
