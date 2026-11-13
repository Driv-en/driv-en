/* ==========================================================================
   DRIV-EN Platform -- Admin Dashboard JavaScript
   File: /app/dashboard/admin.js
   Extracted from admin.html for CSP compliance (no inline scripts).
   ========================================================================== */

'use strict';

var orgSettings = {};
var stepVisibility = {};
var keyPersonnel = [];
var pendingKP = [];
var onboardingComplete = false;
var settingsDirty = false;
var togglesDirty = false;
var visibilityDirty = false;
var activeOrgId = null;
var currentUserObj = null;
var taskCompletions = {};
var adminAppStarted = false;
var syncChannel = window.BroadcastChannel ? new BroadcastChannel('driven_onboarding_sync') : null;

window.addEventListener('beforeunload', function(e) {
  if (pendingKP.length > 0) { e.preventDefault(); e.returnValue = 'You have unsaved Key Personnel assignments.'; }
});

var BUSINESS_TYPE_DEFAULTS = {
  'Construction': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':true,'project-types':true,'projects':true,'assets':true,'fuel-types':true,'asset-types':true},
  'Manufacturing': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':true,'project-types':false,'projects':false,'assets':true,'fuel-types':true,'asset-types':true},
  'Chemical': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':true,'project-types':false,'projects':false,'assets':true,'fuel-types':true,'asset-types':true},
  'Oil & Gas': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':true,'project-types':true,'projects':true,'assets':true,'fuel-types':true,'asset-types':true},
  'Transportation': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':false,'project-types':false,'projects':false,'assets':true,'fuel-types':true,'asset-types':true},
  'Warehousing': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':false,'project-types':false,'projects':false,'assets':true,'fuel-types':true,'asset-types':true},
  'Fabrication': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':true,'project-types':false,'projects':false,'assets':true,'fuel-types':true,'asset-types':true},
  'Logistics / Supply Chain': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':false,'project-types':false,'projects':false,'assets':true,'fuel-types':true,'asset-types':true},
  'Utilities & Energy': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':true,'project-types':true,'projects':true,'assets':true,'fuel-types':true,'asset-types':true},
  'Mining & Aggregates': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':true,'project-types':true,'projects':true,'assets':true,'fuel-types':true,'asset-types':true},
  'Agriculture': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':true,'project-types':false,'projects':false,'assets':true,'fuel-types':true,'asset-types':true},
  'Environmental Services': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':false,'project-types':false,'projects':false,'assets':true,'fuel-types':true,'asset-types':true},
  'Food & Beverage Processing': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':true,'project-types':false,'projects':false,'assets':true,'fuel-types':true,'asset-types':true},
  'General Services': {'roles-permissions':true,'employees':true,'locations':true,'clients':true,'divisions':false,'project-types':false,'projects':false,'assets':true,'fuel-types':true,'asset-types':true}
};

var STEP_DEFS = [
  { key: 'roles-permissions', label: 'Roles & Permissions', desc: 'Define roles and access levels', locked: true },
  { key: 'employees', label: 'Employees', desc: 'Add all employees', locked: true },
  { key: 'locations', label: 'Locations', desc: 'Plants, mines, facilities, warehouses, job sites', locked: false },
  { key: 'clients', label: 'Clients', desc: 'Add clients and customer organizations', locked: false },
  { key: 'divisions', label: 'Divisions', desc: 'Internal divisions or business units', locked: false },
  { key: 'project-types', label: 'Project Types', desc: 'Types of work your organization performs', locked: false },
  { key: 'projects', label: 'Projects', desc: 'Active, completed, or upcoming projects', locked: false },
  { key: 'fuel-types', label: 'Fuels, Fluids & Energy', desc: 'Types of fuel and fluids your organization uses', locked: true },
  { key: 'asset-types', label: 'Asset Types', desc: 'Primary equipment and machine categories', locked: true },
  { key: 'assets', label: 'Assets', desc: 'Assets and equipment to maintain', locked: true }
];

var FORMS = [
  { key: 'dvir_form', label: 'Driver Vehicle Inspection (DVIR)', desc: 'Complete pre-trip or post-trip statutory road safety inspection', link: '/app/forms/dvir.html' },
  { key: 'fuel_log', label: 'Log Fuel Purchase', desc: 'Record a fuel purchase with receipt AI extraction', link: '/app/forms/fuel-purchase.html' },
  { key: 'fuel_transfer', label: 'Log Fuel Transfer', desc: 'Transfer fuel between tanks or issue to equipment', link: '/app/forms/fuel-transfer.html' },
  { key: 'transfer_create', label: 'Create Transfer', desc: 'Start an equipment transfer ticket', link: '/app/forms/transfer-create.html' },
  { key: 'wo_create', label: 'Create Work Order', desc: 'Submit a maintenance request', link: '/app/forms/work-order-create.html' },
  { key: 'inspection_add', label: 'Add Inspection', desc: 'Record an equipment inspection', link: '/app/forms/inspection.html' },
  { key: 'pm_add', label: 'Add PM', desc: 'Create a preventive maintenance task', link: '/app/forms/pm.html' }
];

var MODAL_CONTENT_MAP = {
  overview: {
    purpose: 'The <strong>Overview Tab</strong> serves as the central command hub for DRIV-EN administrators. It provides high-level system metrics, quick-launch gateways to dashboard modules and operational forms, user profile data, and display contrast controls.',
    instructions: '<ol><li><strong>Monitor Dashboard Metrics:</strong> View live count summaries for active Employees, Projects, Assets, and Clients. Click any KPI card to navigate directly to its module.</li><li><strong>Dashboard Links:</strong> Use the card buttons to quickly access Fuel Management, Fuel Alerts, Transfers, Work Orders, and Calendar dashboards.</li><li><strong>Form Links:</strong> Use the card buttons to launch operational forms such as DVIR, Fuel Purchase, Fuel Transfer, Create Transfer, Create Work Order, Add Inspection, and Add PM.</li><li><strong>Account Management:</strong> Review your logged-in administrator credentials and manage your account via the <strong>Change Password</strong> option in the welcome bar.</li><li><strong>Workspace Customization:</strong> Use the Light/Dark mode switch in the welcome bar to adjust visual preferences.</li></ol>'
  },
  onboarding: {
    purpose: 'The <strong>Onboarding Hub</strong> coordinates initial platform deployment, setup step tracking, team assignments, and final company activation across all operational modules.',
    instructions: '<ol><li><strong>Track Global Setup Progress:</strong> Review the overall setup completion progress bar at the top of the onboarding interface.</li><li><strong>Navigate Subtabs:</strong> Switch between the <em>Task Visibility Matrix</em> to configure required steps and the <em>Key Personnel Directory</em> to assign responsible staff.</li><li><strong>Finalize Deployment:</strong> Once all required setup tasks are complete, click <strong>Finalize Company Onboarding</strong> to activate regular accounts and dispatch welcome emails.</li></ol>'
  },
  visibility: {
    purpose: 'The <strong>Task Visibility Matrix Subtab</strong> empowers administrators to customize setup workflows by enabling or disabling specific onboarding steps based on company industry and operational scope.',
    instructions: '<ol><li><strong>Review Available Setup Steps:</strong> Scroll through operational setup modules such as Locations, Clients, Divisions, Project Types, and Assets.</li><li><strong>Modify Step Access:</strong> Toggle the switch next to optional steps to make them visible or hidden in user onboarding flows. (Locked steps remain enforced by system defaults).</li><li><strong>Save Configuration:</strong> Click <strong>Save Visibility Matrix</strong> to apply changes across field and administrative portals.</li></ol>'
  },
  kp: {
    purpose: 'The <strong>Key Personnel Directory Subtab</strong> allows admins to delegate setup tasks to specific staff leaders, track completion by employee, and send setup access invitations.',
    instructions: '<ol><li><strong>Enter Staff Details:</strong> Provide the Full Name and Email Address for the delegated key team member.</li><li><strong>Delegate Tasks:</strong> Select the specific setup steps (e.g., Asset Setup, Fuel Types, Employees) that person is responsible for filling out.</li><li><strong>Stage Member:</strong> Click <strong>+ Add Personnel Member</strong> to add the staged user to your pending directory.</li><li><strong>Send Invitations:</strong> Click <strong>Send Invitations &amp; Create Accounts</strong> to dispatch onboarding credentials and activation emails.</li></ol>'
  },
  settings: {
    purpose: 'The <strong>Settings Tab</strong> allows administrators to configure primary business classification settings, upload corporate assets, set system units of measure, and enforce strict form verification rules.',
    instructions: '<ol><li><strong>Configure Business Profile:</strong> Select your Primary Industry Sector, set NAICS code, and choose your preferred operational currency. Click <strong>Save Profile Settings</strong>.</li><li><strong>Branding Assets:</strong> Upload a high-resolution corporate PNG/SVG logo (max 500KB) to customize digital reports and field application headers.</li><li><strong>Form Verification Controls:</strong> Enable or disable mandatory field requirements for Meter Photos, Asset Photos, or GPS Location Tagging. Click <strong>Save Requirements Toggles</strong>.</li><li><strong>Organization Measurement System:</strong> Switch between Imperial (US) and Metric (Canadian) using the toggle buttons. This sets the default for all users on <em>Use Org Default</em>.</li><li><strong>Personal Units of Measure:</strong> Use the <strong>My Units of Measure</strong> dropdown in the welcome bar to set your personal preference. Choose <em>Use Org Default</em> to follow the organization setting, or override with Imperial or Metric for your own view.</li></ol>'
  },
  fuel: {
    purpose: 'The <strong>Fuel Management &amp; Tank Adjustment</strong> module handles real-time fluid balance monitoring, bulk delivery logs, fuel burn audits, and inventory dip overrides.',
    instructions: '<p><strong>Tank Adjustment Action Steps:</strong></p><ol><li><strong>Select Tank/Bowser:</strong> Locate the bulk storage unit or mobile fuel asset from the fuel dashboard.</li><li><strong>Initiate Level Override:</strong> Click <strong>Adjust Tank Level</strong> next to the selected container.</li><li><strong>Enter Measured Volume:</strong> Input accurate dipstick or automatic gauge readings.</li><li><strong>Document Variance Reason:</strong> Choose the primary reason code (e.g., <em>Dip Reconciliation, Calibration Variance, Spill/Loss</em>) and provide audit log notes.</li><li><strong>Confirm Override:</strong> Click <strong>Confirm Adjustment</strong> to update system inventory records.</li></ol>'
  }
};

function getActiveContext() {
  var onboardingTab = document.getElementById('tab-onboarding');
  if (onboardingTab && onboardingTab.classList.contains('active')) {
    var activeSubtab = document.querySelector('#onboardingSubtabBar .admin-subtab.active');
    if (activeSubtab) {
      var subtabKey = activeSubtab.getAttribute('data-subtab');
      if (subtabKey === 'key-personnel' || subtabKey === 'kp') return 'kp';
      if (subtabKey === 'visibility') return 'visibility';
    }
    return 'onboarding';
  }
  var activeTab = document.querySelector('.admin-tab.active');
  if (activeTab) {
    var tabKey = activeTab.getAttribute('data-tab');
    if (MODAL_CONTENT_MAP[tabKey]) return tabKey;
  }
  return 'overview';
}

function getContextTitle(key) {
  var labels = { overview: 'Overview', onboarding: 'Onboarding Hub', visibility: 'Task Visibility Matrix', kp: 'Key Personnel Directory', settings: 'Company Settings', fuel: 'Fuel Management & Tank Adjustments' };
  return labels[key] || 'Dashboard';
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showPageError() { var b = document.getElementById('pageErrorBanner'); if (b) b.classList.add('show'); }
function dismissPageError() { var b = document.getElementById('pageErrorBanner'); if (b) b.classList.remove('show'); }

function reportError(source, err) {
  var msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : 'Unknown error');
  var stack = (err && err.stack) ? err.stack : 'No stack trace';
  try { fetch('/api/log-error', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-org-id': activeOrgId || '' }, body: JSON.stringify({ source: 'Admin Dashboard (' + source + ')', message: msg, stack: stack, url: window.location.href, userAgent: navigator.userAgent }) }).catch(function() {}); } catch (e) {}
  console.error('[' + source + ']', msg, stack);
}

window.addEventListener('error', function(e) { reportError('window.onerror', e.error || e.message); showPageError(); });

function preserveAndNavigate(event, targetUrl) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  if (targetUrl && !targetUrl.endsWith('.html') && !targetUrl.includes('?')) { targetUrl += '.html'; }
  var userObj = currentUserObj || window.dashUser || window.drivenUser;
  if (!userObj) { try { userObj = JSON.parse(localStorage.getItem('driven_user') || sessionStorage.getItem('driven_user')); } catch (e) {} }
  userObj = userObj || {};
  if (!userObj.id && userObj.user_id) { userObj.id = userObj.user_id; }
  var targetOrg = activeOrgId || userObj.org_id || '';
  if (!targetOrg || targetOrg === 'default_org' || targetOrg === 'null') { window.location.href = '/public/login.html'; return; }
  var roleVal = userObj.role_id || localStorage.getItem('driven_role') || sessionStorage.getItem('driven_role') || userObj.role;
  if (!roleVal) { window.location.href = '/public/login.html'; return; }
  var userStr = JSON.stringify(userObj);
  localStorage.setItem('driven_org_id', targetOrg); localStorage.setItem('driven_user', userStr); localStorage.setItem('driven_role', roleVal);
  if (userObj.id) localStorage.setItem('driven_user_id', userObj.id);
  sessionStorage.setItem('driven_org_id', targetOrg); sessionStorage.setItem('driven_user', userStr); sessionStorage.setItem('driven_role', roleVal);
  if (userObj.id) sessionStorage.setItem('driven_user_id', userObj.id);
  var querySeparator = targetUrl.includes('?') ? '&' : '?';
  window.location.href = targetUrl + querySeparator + 'org_id=' + encodeURIComponent(targetOrg);
}
window.preserveAndNavigate = preserveAndNavigate;

function validateOrgContext() {
  if (!activeOrgId || activeOrgId === 'default_org' || activeOrgId === 'null') { activeOrgId = localStorage.getItem('driven_org_id') || sessionStorage.getItem('driven_org_id') || ''; }
  if (!activeOrgId) { window.location.href = '/public/login.html'; return false; }
  return true;
}

function adjustStickyOffsets() {
  var header = document.getElementById('dashHeader');
  var stickyContainer = document.getElementById('adminNavStickyContainer');
  var subtabContainer = document.getElementById('onboardingSubtabBar');
  if (header && stickyContainer) {
    var headerHeight = header.getBoundingClientRect().height || header.offsetHeight || 50;
    stickyContainer.style.top = headerHeight + 'px';
    if (subtabContainer) { var tabHeight = stickyContainer.getBoundingClientRect().height || stickyContainer.offsetHeight || 40; subtabContainer.style.top = (headerHeight + tabHeight) + 'px'; }
  }
}

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

  console.log('[AdminDashboard] Header rebuilt: single row, title="' + title + '"');
}

// MutationObserver: rebuild whenever old-layout content is injected into #dashHeader
function startHeaderObserver() {
  var header = document.getElementById('dashHeader');
  if (!header) return;

  var observer = new MutationObserver(function() {
    var h1s = header.querySelectorAll('h1');
    var rows = header.querySelectorAll('.dash-header-row1, .dash-header-row2, .dash-header-row3, .dash-utility-bar');
    if (h1s.length > 1 || rows.length > 1) {
      console.warn('[AdminDashboard] MutationObserver detected old layout -- h1s:' + h1s.length + ' rows:' + rows.length);
      observer.disconnect();
      rebuildHeader();
      setTimeout(function() { startHeaderObserver(); }, 100);
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

async function safeFetch(url, options) {
  options = options || {}; options.headers = options.headers || {};
  options.credentials = 'include';
  var storedUser = currentUserObj || window.dashUser || window.drivenUser || {};
  options.headers['x-user-id'] = storedUser.id || localStorage.getItem('driven_user_id') || sessionStorage.getItem('driven_user_id') || '';
  options.headers['x-org-id'] = activeOrgId || storedUser.org_id || '';
  var userRole = storedUser.role || storedUser.role_id || localStorage.getItem('driven_role') || sessionStorage.getItem('driven_role') || '';
  if (userRole) options.headers['x-user-role'] = userRole;
  var controller = new AbortController();
  var timeoutId = setTimeout(function() { controller.abort(); }, 8000);
  options.signal = controller.signal;
  try { var res = await fetch(url, options); clearTimeout(timeoutId); if (res.status === 401 || res.status === 403) { console.warn('[AdminDashboard] Session warning from:', url); return null; } return res; }
  catch (err) { clearTimeout(timeoutId); reportError('safeFetch', err); return null; }
}

function toggleSelectAllKpTasks(checked) { document.querySelectorAll('.kp-task-cb').forEach(function(cb) { cb.checked = checked; }); updateKpTaskCount(); }
function updateKpTaskCount() {
  var cbs = document.querySelectorAll('.kp-task-cb:checked'); var totalCbs = document.querySelectorAll('.kp-task-cb');
  var selectAll = document.getElementById('kpTaskSelectAll'); if (selectAll) selectAll.checked = (cbs.length === totalCbs.length && totalCbs.length > 0);
  var counter = document.getElementById('kpTaskCount'); if (counter) counter.textContent = cbs.length + ' task' + (cbs.length === 1 ? '' : 's') + ' selected';
}

function addKeyPersonnel() {
  if (!validateOrgContext()) return;
  var nameEl = document.getElementById('kpName'); var emailEl = document.getElementById('kpEmail');
  if (!nameEl || !emailEl) return;
  var name = nameEl.value.trim(); var email = emailEl.value.trim();
  var selectedCbs = document.querySelectorAll('.kp-task-cb:checked'); var selectedTasks = Array.from(selectedCbs).map(function(cb) { return cb.value; });
  if (!name || !email) { alert('Please enter both Full Name and Email Address.'); return; }
  if (selectedTasks.length === 0) { alert('Please select at least one task for this person.'); return; }
  var parts = name.split(' '); var fn = parts[0] || ''; var ln = parts.slice(1).join(' ') || '';
  pendingKP.push({ firstName: fn, lastName: ln, name: name, email: email, tasks: selectedTasks });
  nameEl.value = ''; emailEl.value = '';
  document.querySelectorAll('.kp-task-cb').forEach(function(cb) { cb.checked = false; });
  var selectAll = document.getElementById('kpTaskSelectAll'); if (selectAll) selectAll.checked = false;
  updateKpTaskCount(); renderKeyPersonnel();
}

function removeKpTask(personIdx, taskIdx) {
  var target = personIdx < keyPersonnel.length ? keyPersonnel[personIdx] : pendingKP[personIdx - keyPersonnel.length];
  var tasks = target.tasks || (target.roles ? target.roles.map(function(r) { return r.role; }) : [target.task]);
  tasks.splice(taskIdx, 1); target.tasks = tasks; delete target.roles; delete target.task;
  renderKeyPersonnel();
}

async function removeKpPerson(personIdx) {
  if (!validateOrgContext()) return;
  if (personIdx < keyPersonnel.length) {
    var kp = keyPersonnel[personIdx];
    if (kp.employeeId || kp.id) {
      try { var res = await safeFetch('/api/onboarding/key-personnel/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: kp.employeeId || kp.id, revokeAll: true }) }); if (!res || !res.ok) { throw new Error('The key personnel account could not be revoked.'); } }
      catch (e) { reportError('removeKpPerson', e); alert(e.message || 'The key personnel account could not be revoked.'); return; }
    }
    keyPersonnel.splice(personIdx, 1);
  } else { pendingKP.splice(personIdx - keyPersonnel.length, 1); }
  renderKeyPersonnel();
}

async function saveKeyPersonnelToDB() {
  if (!validateOrgContext()) return;
  var allKPToSave = keyPersonnel.concat(pendingKP);
  if (allKPToSave.length === 0) { alert('No key personnel to save.'); return; }
  var btn = document.getElementById('kpCompleteBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating Accounts & Sending Emails...'; }
  try {
    var resComplete = await safeFetch('/api/onboarding/key-personnel/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyPersonnel: allKPToSave }) });
    if (!resComplete) return;
    var dComplete = await resComplete.json();
    if (resComplete.ok && dComplete.success) {
      alert('Key personnel accounts created and invitation emails sent successfully!');
      keyPersonnel = allKPToSave; pendingKP = []; await loadKeyPersonnel(); notifySync();
    } else {
      var errorDetails = (dComplete.results || []).filter(function(r) { return r.error; }).map(function(r) { return (r.email || 'Item') + ': ' + r.error; }).join('\n');
      alert('Warning/Error during save:\n\n' + (dComplete.error || errorDetails || 'An unknown error occurred during save.'));
    }
  } catch (e) { reportError('saveKeyPersonnelToDB', e); alert('Error sending invitations: ' + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Send Invitations & Create Accounts'; } }
}

async function finalizeCompanyOnboarding() {
  if (!validateOrgContext()) return;
  if (!confirm('Are you ready to finalize onboarding? This will activate all regular employees and send them welcome emails.')) return;
  var finalizeBtn = document.getElementById('finalizeOnboardingBtn'); var originalText = finalizeBtn ? finalizeBtn.innerText : '';
  if (finalizeBtn) { finalizeBtn.innerText = 'Finalizing & Emailing...'; finalizeBtn.disabled = true; }
  try {
    var res = await safeFetch('/api/onboarding/finalize', { method: 'POST' });
    if (res) { var data = await res.json(); if (data.success) { var completePanel = document.getElementById('onboardingCompletePanel'); if (completePanel) completePanel.style.display = 'block'; if (finalizeBtn) finalizeBtn.style.display = 'none'; alert('Onboarding Complete! Welcome emails sent to ' + data.totalEmployees + ' employees.'); } else { alert('Failed to finalize onboarding: ' + data.error); } }
  } catch (err) { console.error('Error finalizing:', err); alert('A network error occurred while finalizing.'); }
  finally { if (finalizeBtn) { finalizeBtn.innerText = originalText; finalizeBtn.disabled = false; } }
}

async function loadDashboardStats() {
  var fetchSafe = function(urls) {
    var urlList = Array.isArray(urls) ? urls : [urls];
    var tryFetch = async function(idx) { if (idx >= urlList.length) return {}; try { var r = await safeFetch(urlList[idx]); if (r && r.ok) return await r.json(); else console.warn('[KPI] ' + urlList[idx] + ' returned ' + (r ? r.status : 'null')); } catch (e) { console.warn('[KPI] ' + urlList[idx] + ' threw', e.message); } return tryFetch(idx + 1); };
    return tryFetch(0);
  };
  try {
    var results = await Promise.all([ fetchSafe(['/api/onboarding/employees/list', '/api/users']), fetchSafe(['/api/Project', '/api/projects']), fetchSafe(['/api/Equipment', '/api/equipment']), fetchSafe(['/api/Clients?active_only=true', '/api/Clients', '/api/clients']) ]);
    console.log('[KPI] Raw API results:', results);
    var empData = results[0] || {}; var empList = empData.employees || empData.personnel || empData.users || empData.data || empData.records || (Array.isArray(empData) ? empData : []);
    var empCount = empList.filter(function(e) { var st = e.status !== undefined ? e.status : (e.is_active !== undefined ? e.is_active : e.employment_status); if (typeof st === 'string') st = st.toLowerCase(); return st === 1 || st === '1' || st === 'active' || st === true; }).length;
    var elEmp = document.getElementById('stat-employees'); if (elEmp) elEmp.textContent = empCount; localStorage.setItem('driven_employee_count', empCount);
    var projData = results[1] || {}; var projList = projData.projects || projData.data || projData.records || (Array.isArray(projData) ? projData : []);
    var elProj = document.getElementById('stat-projects'); if (elProj) elProj.textContent = projList.length; localStorage.setItem('driven_project_count', projList.length);
    var assetData = results[2] || {}; var assetList = assetData.equipment || assetData.assets || assetData.data || assetData.records || (Array.isArray(assetData) ? assetData : []);
    var elEq = document.getElementById('stat-equipment'); if (elEq) elEq.textContent = assetList.length; localStorage.setItem('driven_equipment_count', assetList.length);
    var clientData = results[3] || {}; var clientList = clientData.clients || clientData.records || clientData.data || clientData.results || (Array.isArray(clientData) ? clientData : []);
    var activeClients = clientList.filter(function(c) { var st = c.status !== undefined ? c.status : (c.is_active !== undefined ? c.is_active : c.active); if (typeof st === 'string') st = st.toLowerCase(); return st === undefined || st === null || st === 1 || st === '1' || st === 'active' || st === true; }).length;
    var elCli = document.getElementById('stat-clients'); if (elCli) elCli.textContent = activeClients; localStorage.setItem('driven_client_count', activeClients);
    console.log('[KPI] Parsed -- employees:' + empCount + ' projects:' + projList.length + ' assets:' + assetList.length + ' clients:' + activeClients);
  } catch (e) {
    console.error('loadDashboardStats error:', e);
    var elE = document.getElementById('stat-employees'); if (elE) elE.textContent = localStorage.getItem('driven_employee_count') || '0';
    var elP = document.getElementById('stat-projects'); if (elP) elP.textContent = localStorage.getItem('driven_project_count') || '0';
    var elEq2 = document.getElementById('stat-equipment'); if (elEq2) elEq2.textContent = localStorage.getItem('driven_equipment_count') || '0';
    var elC = document.getElementById('stat-clients'); if (elC) elC.textContent = localStorage.getItem('driven_client_count') || '0';
  }
}

function renderFormsTab() {
  var c = document.getElementById('adminFormsTabLinks'); if (!c) return;
  c.innerHTML = FORMS.map(function(f) { return '<a href="' + f.link + '" class="emp-form-card" data-link="' + f.link + '"><div style="font-weight:600;font-size:15px;margin-bottom:6px;">' + esc(f.label) + '</div><div style="font-size:13px;color:var(--text-muted);line-height:1.4;">' + esc(f.desc) + '</div></a>'; }).join('');
  c.querySelectorAll('.emp-form-card').forEach(function(card) { card.addEventListener('click', function(e) { preserveAndNavigate(e, this.getAttribute('data-link')); }); });
}

/* ===== USER-LEVEL UOM PREFERENCE (personal, separate from org setting) ===== */
function initUomPreference() {
  var select = document.getElementById('welcomeUomSelect');
  var hint = document.getElementById('welcomeUomHint');
  if (!select) return;

  if (window.DRIVEN_UNITS && DRIVEN_UNITS.getUserUnitPreference) {
    DRIVEN_UNITS.getUserUnitPreference().then(function(info) {
      if (!info) return;
      select.value = info.user_preference || 'org_default';
      if (info.org_default && info.user_preference === 'org_default') {
        if (hint) hint.textContent = 'Org default: ' + (info.org_default === 'metric' ? 'Metric' : 'Imperial');
      } else if (hint) {
        hint.textContent = '';
      }
    });
  }

  select.addEventListener('change', function() {
    var pref = select.value;
    if (!window.DRIVEN_UNITS || !DRIVEN_UNITS.setUserUnitPreference) return;
    DRIVEN_UNITS.setUserUnitPreference(pref).then(function(result) {
      if (!result) { alert('Failed to update unit preference. Please try again.'); return; }
      if (hint) {
        if (pref === 'org_default' && result.unit_system) {
          hint.textContent = 'Org default: ' + (result.unit_system === 'metric' ? 'Metric' : 'Imperial');
        } else { hint.textContent = ''; }
      }
      if (window.DRIVEN_APPLY_UNITS) { DRIVEN_APPLY_UNITS.refresh(); }
      try { localStorage.setItem('driv-en-unit-system-changed', Date.now().toString()); localStorage.setItem('driv-en-unit-system', result.unit_system); } catch (e) {}
    });
  });
}

/* ===== UNIT OF MEASURE -- Fetches from /api/settings/units API ===== */
function renderOnboardingUomDisplays() {
  var distEl = document.getElementById('uom-distance-display');
  var volEl = document.getElementById('uom-volume-display');
  var pressEl = document.getElementById('uom-pressure-display');
  var weightEl = document.getElementById('uom-weight-display');
  var tempEl = document.getElementById('uom-temperature-display');
  var impBtn = document.getElementById('uom-imperial-btn');
  var metBtn = document.getElementById('uom-metric-btn');

  fetch('/api/settings/units', { credentials: 'include' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      var sys = (data && data.result && data.result.unit_system) || 'imperial';
      var labels = sys === 'metric'
        ? { distance: 'Kilometers (km)', volume: 'Liters (L)', weight: 'Kilograms (kg)', pressure: 'Bar', temperature: '\u00B0C' }
        : { distance: 'Miles (mi)', volume: 'US Gallons (gal)', weight: 'Pounds (lbs)', pressure: 'PSI', temperature: '\u00B0F' };

      if (distEl) distEl.textContent = labels.distance;
      if (volEl) volEl.textContent = labels.volume;
      if (weightEl) weightEl.textContent = labels.weight;
      if (pressEl) pressEl.textContent = labels.pressure;
      if (tempEl) tempEl.textContent = labels.temperature;

      if (impBtn) { impBtn.style.background = sys === 'imperial' ? 'var(--primary)' : 'var(--bg-step)'; impBtn.style.color = sys === 'imperial' ? '#fff' : 'var(--text)'; }
      if (metBtn) { metBtn.style.background = sys === 'metric' ? 'var(--primary)' : 'var(--bg-step)'; metBtn.style.color = sys === 'metric' ? '#fff' : 'var(--text)'; }

      try { localStorage.setItem('driv-en-unit-system', sys); } catch (e) {}
    })
    .catch(function() {
      var stored = 'imperial';
      try { stored = localStorage.getItem('driv-en-unit-system') || 'imperial'; } catch (e) {}
      if (distEl) distEl.textContent = stored === 'metric' ? 'Kilometers (km)' : 'Miles (mi)';
      if (volEl) volEl.textContent = stored === 'metric' ? 'Liters (L)' : 'US Gallons (gal)';
      if (pressEl) pressEl.textContent = stored === 'metric' ? 'Bar' : 'PSI';
    });
}

function setUnitSystem(sys) {
  if (sys !== 'imperial' && sys !== 'metric') return;
  if (!confirm('Change measurement system to ' + (sys === 'metric' ? 'Metric (Canadian)' : 'Imperial (US)') + '?\n\nAll pages will display units in the new system.')) return;

  fetch('/api/settings/units', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unit_system: sys })
  })
    .then(function(r) { return r.ok ? r.json() : r.json().then(function(e) { throw new Error(e.error || 'Failed'); }); })
    .then(function() {
      try { localStorage.setItem('driv-en-unit-system', sys); } catch (e) {}
      renderOnboardingUomDisplays();
      // Update welcome card hint immediately — no refresh needed
      var hint = document.getElementById('welcomeUomHint');
      var select = document.getElementById('welcomeUomSelect');
      if (hint && select && select.value === 'org_default') {
        hint.textContent = 'Org default: ' + (sys === 'metric' ? 'Metric' : 'Imperial');
      }
      // Refresh any DRIVEN_APPLY_UNITS displays on this page
      if (window.DRIVEN_APPLY_UNITS && DRIVEN_APPLY_UNITS.refresh) { try { DRIVEN_APPLY_UNITS.refresh(); } catch (e) {} }
      if (window.DRIVEN_UNITS && DRIVEN_UNITS.refreshUnitSystem) { try { DRIVEN_UNITS.refreshUnitSystem(); } catch (e) {} }
      try { localStorage.setItem('driv-en-unit-system-changed', Date.now().toString()); } catch (e) {}
      alert('Measurement system updated to ' + (sys === 'metric' ? 'Metric' : 'Imperial') + '.\n\nOther open tabs will update automatically.');
    })
    .catch(function(err) {
      alert('Failed to update measurement system: ' + err.message);
    });
}

function switchTab(tabName) {
  var activeObTab = document.getElementById('tab-onboarding'); var activeSetTab = document.getElementById('tab-settings');
  if (visibilityDirty && activeObTab && activeObTab.classList.contains('active') && tabName !== 'onboarding') { if (!confirm('You have unsaved Task Visibility changes.\n\nClick Cancel to go back and save them, or OK to discard.')) return; clearVisibilityDirty(); }
  if ((settingsDirty || togglesDirty) && activeSetTab && activeSetTab.classList.contains('active') && tabName !== 'settings') { if (!confirm('You have unsaved changes in Settings.\n\nClick Cancel to go back and save them, or OK to discard.')) return; clearSettingsDirty(); clearTogglesDirty(); }
  document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  document.querySelectorAll('.admin-tab-content').forEach(function(c) { c.classList.remove('active'); });
  var targetTabBtn = document.querySelector('.admin-tab[data-tab="' + tabName + '"]'); var targetTabContent = document.getElementById('tab-' + tabName);
  if (targetTabBtn) { targetTabBtn.classList.add('active'); targetTabBtn.setAttribute('aria-selected', 'true'); }
  if (targetTabContent) targetTabContent.classList.add('active');
  var obBar = document.getElementById('onboardingSubtabBar'); if (obBar) obBar.classList.toggle('visible', tabName === 'onboarding');
  if (tabName === 'forms') renderFormsTab(); if (tabName === 'settings') renderOnboardingUomDisplays();
  adjustStickyOffsets();
}

function switchOnboardingSubtab(subtabName) {
  var visTab = document.getElementById('onboarding-subtab-visibility');
  if (visibilityDirty && visTab && visTab.classList.contains('active') && subtabName !== 'visibility') { if (!confirm('You have unsaved Task Visibility changes.\n\nClick Cancel to go back and save them, or OK to discard.')) return; clearVisibilityDirty(); }
  document.querySelectorAll('#onboardingSubtabBar .admin-subtab').forEach(function(t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  document.querySelectorAll('.admin-subtab-content[id^="onboarding-subtab-"]').forEach(function(c) { c.classList.remove('active'); });
  var targetSubtabBtn = document.querySelector('#onboardingSubtabBar [data-subtab="' + subtabName + '"]'); var targetSubtabContent = document.getElementById('onboarding-subtab-' + subtabName);
  if (targetSubtabBtn) { targetSubtabBtn.classList.add('active'); targetSubtabBtn.setAttribute('aria-selected', 'true'); }
  if (targetSubtabContent) targetSubtabContent.classList.add('active');
  if (subtabName === 'kp' || subtabName === 'key-personnel') { renderKeyPersonnel(); }
  if (subtabName === 'dashboard') { /* Onboarding Dashboard subtab -- link is in the HTML */ }
  adjustStickyOffsets();
}

/* Override the shared dashToggleTheme to add admin-specific behavior (broadcast + stats reload) */
window.dashToggleTheme = function() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  var newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('driven-theme', newTheme);
  var cb = document.getElementById('dashThemeCheckbox');
  if (cb) cb.checked = (newTheme === 'dark');
  var ll = document.getElementById('dashThemeLabelLight');
  var ld = document.getElementById('dashThemeLabelDark');
  if (ll) ll.classList.toggle('active', newTheme === 'light');
  if (ld) ld.classList.toggle('active', newTheme === 'dark');
  if (syncChannel) { try { syncChannel.postMessage({ type: 'theme_change', theme: newTheme }); } catch (e) {} }
  try { loadDashboardStats().catch(function() {}); } catch (e) {}
};

function renderLogoPreview(preview, logo, removeButton) {
  if (!preview) return; preview.textContent = '';
  if (typeof logo === 'string' && logo) { var img = document.createElement('img'); img.src = logo; img.alt = 'Logo'; img.style.maxHeight = '60px'; img.style.maxWidth = '140px'; img.style.objectFit = 'contain'; preview.appendChild(img); preview.style.border = 'none'; if (removeButton) removeButton.style.display = 'inline-block'; }
  else { preview.textContent = 'No logo'; preview.style.border = '2px dashed var(--border,#cbd5e1)'; if (removeButton) removeButton.style.display = 'none'; }
}

async function loadLogo() {
  var p = document.getElementById('logoPreview'); var r = document.getElementById('logoRemoveBtn'); if (!p) return;
  try { var res = await safeFetch('/auth/get-logo'); if (!res || !res.ok) throw new Error('Logo fetch failed'); var d = await res.json(); if (d.success && d.logo) { localStorage.setItem('driven_customer_logo', d.logo); renderLogoPreview(p, d.logo, r); } else { renderLogoPreview(p, '', r); } }
  catch (e) { renderLogoPreview(p, localStorage.getItem('driven_customer_logo'), r); }
}

async function handleLogoUpload() {
  if (!validateOrgContext()) return;
  var logoInput = document.getElementById('logoFile'); if (!logoInput || !logoInput.files || !logoInput.files[0]) return;
  var f = logoInput.files[0]; var statusEl = document.getElementById('logoStatus');
  if (f.size > 500000) { if (statusEl) { statusEl.textContent = 'File too large. Max 500KB.'; statusEl.style.color = 'var(--error,#ef4444)'; } return; }
  var rd = new FileReader();
  rd.onload = async function(e) { var du = e.target.result; localStorage.setItem('driven_customer_logo', du); try { var sr = await safeFetch('/auth/save-logo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo_data: du }) }); if (sr) { var sd = await sr.json(); if (sd.success && statusEl) { statusEl.textContent = 'Logo uploaded.'; statusEl.style.color = 'var(--success,#16a34a)'; } } } catch (ex) { reportError('handleLogoUpload', ex); } await loadLogo(); };
  rd.readAsDataURL(f);
}

async function handleLogoRemove() {
  if (!validateOrgContext()) return; var statusEl = document.getElementById('logoStatus');
  try { var res = await safeFetch('/auth/save-logo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo_data: '' }) }); if (!res || !res.ok) throw new Error('Logo could not be removed.'); var data = await res.json(); if (!data.success) throw new Error(data.error || 'Logo could not be removed.'); localStorage.removeItem('driven_customer_logo'); if (statusEl) statusEl.textContent = 'Logo removed.'; await loadLogo(); }
  catch (e) { reportError('handleLogoRemove', e); if (statusEl) { statusEl.textContent = e.message || 'Logo could not be removed.'; statusEl.style.color = 'var(--error,#ef4444)'; } }
}

async function loadSettings() {
  try {
    var res = await safeFetch('/auth/get-settings');
    if (res) { var data = await res.json(); if (data.success && data.settings) { orgSettings = data.settings; var bSelect = document.getElementById('businessTypeSelect'); var nInput = document.getElementById('naicsInput'); var cSelect = document.getElementById('currencySelect'); var mpToggle = document.getElementById('fuelMeterPhotoToggle'); var apToggle = document.getElementById('fuelAssetPhotoToggle'); var lrToggle = document.getElementById('locationReqToggle'); if (data.settings.business_type && bSelect) bSelect.value = data.settings.business_type; if (data.settings.naics_code && nInput) nInput.value = data.settings.naics_code; if (data.settings.currency && cSelect) cSelect.value = data.settings.currency; if (mpToggle && data.settings.fuel_meter_photo !== undefined) mpToggle.checked = Boolean(data.settings.fuel_meter_photo); if (apToggle && data.settings.fuel_asset_photo !== undefined) apToggle.checked = Boolean(data.settings.fuel_asset_photo); if (lrToggle && data.settings.location_request !== undefined) lrToggle.checked = Boolean(data.settings.location_request); if (data.settings.step_visibility && typeof data.settings.step_visibility === 'object' && !Array.isArray(data.settings.step_visibility)) { stepVisibility = data.settings.step_visibility; } else { stepVisibility = {}; applyBusinessTypeDefaults(); } if (data.settings.task_completions) { taskCompletions = data.settings.task_completions; localStorage.setItem('driven_task_completions', JSON.stringify(taskCompletions)); } if (data.settings.onboarding_complete) { onboardingComplete = true; } } else { applyBusinessTypeDefaults(); } } else { applyBusinessTypeDefaults(); }
  } catch (e) { reportError('loadSettings', e); applyBusinessTypeDefaults(); }
  renderStepToggles(); renderOnboardingUomDisplays(); updateProgress(); checkBusinessTypeRequired();
}

function checkBusinessTypeRequired() { var bt = orgSettings.business_type; var bEl = document.getElementById('businessTypeSelect'); if (bEl && (!bt || bt === '' || bt === 'null')) { bEl.style.border = '2px solid #ef4444'; } }
function markSettingsDirty() { settingsDirty = true; }
function clearSettingsDirty() { settingsDirty = false; }
function markTogglesDirty() { togglesDirty = true; }
function clearTogglesDirty() { togglesDirty = false; }
function markVisibilityDirty() { visibilityDirty = true; var w = document.getElementById('visibilityWarning'); if (w) w.style.display = 'block'; }
function clearVisibilityDirty() { visibilityDirty = false; var w = document.getElementById('visibilityWarning'); if (w) w.style.display = 'none'; }

async function saveSettings() {
  if (!validateOrgContext()) return;
  var bEl = document.getElementById('businessTypeSelect'); var bt = bEl ? bEl.value : ''; var naics = document.getElementById('naicsInput') ? document.getElementById('naicsInput').value.trim() : ''; var cur = document.getElementById('currencySelect') ? document.getElementById('currencySelect').value : 'USD'; var sStatus = document.getElementById('settingsStatus');
  if (!bt || bt === 'null') { alert('Please select a Business Type before saving settings.'); if (bEl) { bEl.style.border = '2px solid #ef4444'; bEl.focus(); } return; }
  try { var res = await safeFetch('/auth/save-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { business_type: bt, naics_code: naics, currency: cur } }) }); if (!res || !res.ok) throw new Error('Settings could not be saved.'); var d = await res.json(); if (!d.success) throw new Error(d.error || 'Settings could not be saved.'); orgSettings.business_type = bt; orgSettings.naics_code = naics; orgSettings.currency = cur; if (bEl) bEl.style.border = ''; if (sStatus) { sStatus.textContent = 'Saved.'; sStatus.style.color = 'var(--success,#16a34a)'; } clearSettingsDirty(); notifySync(); }
  catch (e) { reportError('saveSettings', e); if (sStatus) { sStatus.textContent = e.message || 'Settings could not be saved.'; sStatus.style.color = 'var(--error,#ef4444)'; } }
}

function onNaicsChange() { markSettingsDirty(); }
function onCurrencyChange() { markSettingsDirty(); }
function onFuelPhotoToggleChange() { markTogglesDirty(); }
function onLocationReqToggleChange() { markTogglesDirty(); }

async function saveToggles() {
  if (!validateOrgContext()) return;
  var mp = document.getElementById('fuelMeterPhotoToggle') ? document.getElementById('fuelMeterPhotoToggle').checked : false; var ap = document.getElementById('fuelAssetPhotoToggle') ? document.getElementById('fuelAssetPhotoToggle').checked : false; var lr = document.getElementById('locationReqToggle') ? document.getElementById('locationReqToggle').checked : false; var tStatus = document.getElementById('togglesStatus');
  try { var res = await safeFetch('/auth/save-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { fuel_meter_photo: mp, fuel_asset_photo: ap, location_request: lr } }) }); if (!res || !res.ok) throw new Error('Toggles could not be saved.'); var data = await res.json(); if (!data.success) throw new Error(data.error || 'Toggles could not be saved.'); localStorage.setItem('setting_fuel_meter_photo', mp); localStorage.setItem('setting_fuel_asset_photo', ap); localStorage.setItem('setting_location_request', lr); if (tStatus) { tStatus.textContent = 'Toggles saved.'; tStatus.style.color = 'var(--success,#16a34a)'; } clearTogglesDirty(); }
  catch (e) { reportError('saveToggles', e); if (tStatus) { tStatus.textContent = e.message || 'Toggles could not be saved.'; tStatus.style.color = 'var(--error,#ef4444)'; } }
}

function applyBusinessTypeDefaults() { if (!stepVisibility || typeof stepVisibility !== 'object') stepVisibility = {}; var bEl = document.getElementById('businessTypeSelect'); var bt = bEl ? bEl.value : ''; if (bt && BUSINESS_TYPE_DEFAULTS[bt]) { var df = BUSINESS_TYPE_DEFAULTS[bt]; for (var k in df) { if (!stepVisibility._manualOverrides || !stepVisibility._manualOverrides[k]) stepVisibility[k] = df[k]; } } }
function onBusinessTypeChange() { var bEl = document.getElementById('businessTypeSelect'); var bt = bEl ? bEl.value : ''; if (bt && BUSINESS_TYPE_DEFAULTS[bt]) { var df = BUSINESS_TYPE_DEFAULTS[bt]; for (var k in df) stepVisibility[k] = df[k]; stepVisibility._manualOverrides = {}; bEl.style.border = ''; } markSettingsDirty(); renderStepToggles(); }

function renderStepToggles() {
  if (!stepVisibility || typeof stepVisibility !== 'object') stepVisibility = {};
  var c = document.getElementById('stepToggleList'); if (!c) return;
  c.innerHTML = STEP_DEFS.map(function(s) { var v = stepVisibility[s.key] !== false; var ck = v ? 'checked' : ''; var dis = s.locked ? 'disabled' : ''; var ll = s.locked ? '<span class="step-toggle-locked">(always on)</span>' : ''; return '<div class="step-toggle-row"><div><div class="step-toggle-name">' + s.label + ' ' + ll + '</div><div class="step-toggle-desc">' + s.desc + '</div></div><label class="toggle-switch"><input type="checkbox" ' + ck + ' ' + dis + ' data-stepkey="' + s.key + '"><span class="toggle-slider"></span></label></div>'; }).join('');
  c.querySelectorAll('input[type="checkbox"]').forEach(function(inp) { inp.addEventListener('change', function() { var key = this.getAttribute('data-stepkey'); onToggleChange(key, this.checked); }); });
}

function onToggleChange(k, v) { if (!stepVisibility || typeof stepVisibility !== 'object') stepVisibility = {}; stepVisibility[k] = v; if (!stepVisibility._manualOverrides) stepVisibility._manualOverrides = {}; stepVisibility._manualOverrides[k] = true; markVisibilityDirty(); }

async function saveStepVisibility() {
  if (!validateOrgContext()) return; var st = document.getElementById('visibilityStatus'); if (!stepVisibility || typeof stepVisibility !== 'object') stepVisibility = {};
  try { var res = await safeFetch('/auth/save-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { step_visibility: stepVisibility } }) }); if (!res || !res.ok) throw new Error('Visibility settings could not be saved.'); var d = await res.json(); if (!d.success) throw new Error(d.error || 'Visibility settings could not be saved.'); if (st) { st.textContent = 'Visibility saved.'; st.style.color = 'var(--success,#16a34a)'; } clearVisibilityDirty(); renderStepToggles(); updateProgress(); notifySync(); }
  catch (e) { reportError('saveStepVisibility', e); if (st) { st.textContent = e.message || 'Visibility settings could not be saved.'; st.style.color = 'var(--error,#ef4444)'; } }
}

async function loadKeyPersonnel() {
  try { var res = await safeFetch('/api/onboarding/key-personnel/list'); if (res && res.ok) { var d = await res.json(); if (d && d.success && Array.isArray(d.keyPersonnel)) { keyPersonnel = d.keyPersonnel.map(function(kp) { return { employeeId: kp.employeeId || kp.id, name: kp.name || [kp.first_name, kp.last_name].filter(Boolean).join(' ') || 'Unknown', email: kp.email || '', role_id: kp.role_id || 'Unassigned', tasks: Array.isArray(kp.roles) ? kp.roles.map(function(r) { return r.role || r.task_name || r; }) : [] }; }); } else { keyPersonnel = []; } } else { keyPersonnel = []; } }
  catch (e) { reportError('loadKeyPersonnel', e); keyPersonnel = []; }
  renderKeyPersonnel();
  updateProgress();
}

function renderKeyPersonnel() {
  var all = keyPersonnel.concat(pendingKP);
  var container = document.getElementById('kpListBody') || document.getElementById('keyPersonnelList') || document.getElementById('kpList');
  var completeBtn = document.getElementById('kpCompleteBtn'); var unsavedBanner = document.getElementById('kpUnsavedBanner');
  if (!container) return;
  if (unsavedBanner) unsavedBanner.style.display = pendingKP.length > 0 ? 'flex' : 'none';
  if (completeBtn) completeBtn.style.display = pendingKP.length > 0 ? 'inline-block' : 'none';
  if (all.length === 0) { container.innerHTML = '<div class="kp-loading">No key personnel assigned yet.</div>'; return; }
  container.innerHTML = all.map(function(kp, personIdx) {
    var tasks = kp.tasks || (kp.roles ? kp.roles.map(function(r) { return r.role || r.task_name; }) : (kp.task ? [kp.task] : []));
    var isPending = personIdx >= keyPersonnel.length;
    var chips = tasks.map(function(t, taskIdx) { return '<div class="kp-task-chip">' + esc(t) + ' <button class="btn-remove-kptask" data-person="' + personIdx + '" data-task="' + taskIdx + '" title="Remove task">&times;</button></div>'; }).join('');
    return '<div class="kp-person-row"><div class="kp-person-info"><div class="kp-person-name">' + esc(kp.name || 'Unknown') + (isPending ? ' <span style="font-size:11px;color:#d97706;font-weight:normal;">(Pending Save)</span>' : '') + '</div><div class="kp-person-email">' + esc(kp.email || '') + '</div><div class="kp-person-tasks">' + (chips || '<span style="font-size:12px;color:var(--text-muted);font-style:italic;">No tasks assigned</span>') + '</div></div><div class="kp-person-actions"><button class="kp-person-remove" data-person="' + personIdx + '">Remove Person</button></div></div>';
  }).join('');
  container.querySelectorAll('.btn-remove-kptask').forEach(function(btn) { btn.addEventListener('click', function() { removeKpTask(parseInt(this.getAttribute('data-person'), 10), parseInt(this.getAttribute('data-task'), 10)); }); });
  container.querySelectorAll('.kp-person-remove').forEach(function(btn) { btn.addEventListener('click', function() { removeKpPerson(parseInt(this.getAttribute('data-person'), 10)); }); });
}

function loadTaskCompletions() { try { taskCompletions = JSON.parse(localStorage.getItem('driven_task_completions') || sessionStorage.getItem('driven_task_completions') || '{}'); } catch (e) { taskCompletions = {}; } }

function adminIsTaskComplete(taskKey) {
  var mapKeyToTask = { 'roles-permissions': 'Roles & Permissions', 'employees': 'Employees', 'locations': 'Locations', 'clients': 'Clients', 'divisions': 'Divisions', 'project-types': 'Project Types', 'projects': 'Projects', 'fuel-types': 'Fuels, Fluids & Energy', 'asset-types': 'Asset Types', 'assets': 'Assets' };
  var taskName = mapKeyToTask[taskKey]; if (!taskName) return false;
  var completions = taskCompletions[taskName] || []; var assignedEmails = []; var all = keyPersonnel.concat(pendingKP);
  all.forEach(function(kp) { var tasks = kp.tasks || (kp.roles ? kp.roles.map(function(r) { return r.role || r.task_name; }) : (kp.task ? [kp.task] : [])); if (tasks.indexOf(taskName) !== -1 && kp.email) { assignedEmails.push(kp.email.toLowerCase()); } });
  if (assignedEmails.length === 0) { return completions.length > 0; }
  for (var i = 0; i < assignedEmails.length; i++) { if (completions.indexOf(assignedEmails[i]) === -1) return false; }
  return true;
}

function updateProgress() {
  loadTaskCompletions(); var vs = STEP_DEFS.filter(function(s) { return stepVisibility[s.key] !== false; }); var comp = 0;
  vs.forEach(function(s) { if (adminIsTaskComplete(s.key)) comp++; });
  var tot = vs.length; var pct = tot > 0 ? Math.round((comp / tot) * 100) : 0;
  var fillEl = document.getElementById('progressBarFill'); var textEl = document.getElementById('progressText');
  if (fillEl) fillEl.style.width = pct + '%'; if (textEl) textEl.textContent = comp + ' of ' + tot + ' tasks complete';
}

function notifySync() { window.dispatchEvent(new CustomEvent('driven_completion_updated')); if (syncChannel) syncChannel.postMessage({ type: 'driven_completion_updated' }); }
function openModal(modalId) { var modal = document.getElementById(modalId); if (modal) { modal.classList.add('active', 'show'); modal.style.display = 'flex'; } }
function closeModal(modalId) { var modal = document.getElementById(modalId); if (modal) { modal.classList.remove('active', 'show'); modal.style.display = 'none'; } }
  // Onboarding tab is always visible for admins (no longer auto-hidden)

function injectGlobalUIStyles() {
  if (document.getElementById('driven-admin-ui-styles')) return;
  var style = document.createElement('style'); style.id = 'driven-admin-ui-styles';
  style.textContent = '.emp-form-card { border: 2px solid #16a34a !important; background-color: var(--card-bg, #ffffff) !important; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: border-color 200ms ease, box-shadow 200ms ease; } .emp-form-card:hover { border-color: #2563eb !important; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2) !important; } .theme-toggle-container { display: inline-flex; align-items: center; border: 2px solid var(--border, #94a3b8); border-radius: 20px; padding: 2px 6px; background: var(--bg-secondary, #f1f5f9); }';
  document.head.appendChild(style);
}

function attachEventHandlers() {
  document.querySelectorAll('.admin-tab').forEach(function(tab) {
    tab.addEventListener('click', function() { var tabName = this.getAttribute('data-tab'); if (tabName) switchTab(tabName); });
    tab.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); var tabName = this.getAttribute('data-tab'); if (tabName) switchTab(tabName); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var tabs = Array.from(document.querySelectorAll('.admin-tab'));
        var idx = tabs.indexOf(this);
        var dir = e.key === 'ArrowRight' ? 1 : -1;
        var next = tabs[(idx + dir + tabs.length) % tabs.length];
        if (next) { next.focus(); var tabName = next.getAttribute('data-tab'); if (tabName) switchTab(tabName); }
      }
    });
  });
  document.querySelectorAll('#onboardingSubtabBar .admin-subtab').forEach(function(subtab) {
    subtab.addEventListener('click', function() { var subtabName = this.getAttribute('data-subtab'); if (subtabName) switchOnboardingSubtab(subtabName); });
    subtab.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); var subtabName = this.getAttribute('data-subtab'); if (subtabName) switchOnboardingSubtab(subtabName); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var subtabs = Array.from(document.querySelectorAll('#onboardingSubtabBar .admin-subtab'));
        var idx = subtabs.indexOf(this);
        var dir = e.key === 'ArrowRight' ? 1 : -1;
        var next = subtabs[(idx + dir + subtabs.length) % subtabs.length];
        if (next) { next.focus(); var subtabName = next.getAttribute('data-subtab'); if (subtabName) switchOnboardingSubtab(subtabName); }
      }
    });
  });
  var btnPurpose = document.getElementById('btnTabPurpose');
  if (btnPurpose) { btnPurpose.addEventListener('click', function(e) { if (e) e.preventDefault(); var contextKey = getActiveContext(); var title = getContextTitle(contextKey); var content = MODAL_CONTENT_MAP[contextKey] || MODAL_CONTENT_MAP.overview; var mpt = document.getElementById('modalPurposeTitle'); var mpb = document.getElementById('modalPurposeBody'); if (mpt) mpt.textContent = title + ' - Purpose'; if (mpb) mpb.innerHTML = content.purpose; openModal('modalPurpose'); }); }
  var btnInstructions = document.getElementById('btnTabInstructions');
  if (btnInstructions) { btnInstructions.addEventListener('click', function(e) { if (e) e.preventDefault(); var contextKey = getActiveContext(); var title = getContextTitle(contextKey); var content = MODAL_CONTENT_MAP[contextKey] || MODAL_CONTENT_MAP.overview; var mit = document.getElementById('modalInstructionsTitle'); var mib = document.getElementById('modalInstructionsBody'); if (mit) mit.textContent = title + ' - Instructions'; if (mib) mib.innerHTML = content.instructions; openModal('modalInstructions'); }); }
  var btnClosePurpose = document.getElementById('btnClosePurposeModal'); if (btnClosePurpose) { btnClosePurpose.addEventListener('click', function() { closeModal('modalPurpose'); }); }
  var btnCloseInstructions = document.getElementById('btnCloseInstructionsModal'); if (btnCloseInstructions) { btnCloseInstructions.addEventListener('click', function() { closeModal('modalInstructions'); }); }
  window.addEventListener('click', function(e) { if (e.target === document.getElementById('modalPurpose')) closeModal('modalPurpose'); if (e.target === document.getElementById('modalInstructions')) closeModal('modalInstructions'); });
  /* Theme toggle is wired by shared dashboard-common.js via #dashThemeCheckbox -- no duplicate listener needed */
  var logoFile = document.getElementById('logoFile'); if (logoFile) { logoFile.addEventListener('change', handleLogoUpload); }
  var logoRemove = document.getElementById('logoRemoveBtn'); if (logoRemove) { logoRemove.addEventListener('click', handleLogoRemove); }
  var bSelect = document.getElementById('businessTypeSelect'); if (bSelect) { bSelect.addEventListener('change', onBusinessTypeChange); }
  var nInput = document.getElementById('naicsInput'); if (nInput) { nInput.addEventListener('input', onNaicsChange); }
  var cSelect = document.getElementById('currencySelect'); if (cSelect) { cSelect.addEventListener('change', onCurrencyChange); }
  var mpToggle = document.getElementById('fuelMeterPhotoToggle'); if (mpToggle) { mpToggle.addEventListener('change', onFuelPhotoToggleChange); }
  var apToggle = document.getElementById('fuelAssetPhotoToggle'); if (apToggle) { apToggle.addEventListener('change', onFuelPhotoToggleChange); }
  var lrToggle = document.getElementById('locationReqToggle'); if (lrToggle) { lrToggle.addEventListener('change', onLocationReqToggleChange); }
  var btnSaveSettings = document.getElementById('saveSettingsBtn'); if (btnSaveSettings) { btnSaveSettings.addEventListener('click', saveSettings); }
  var btnSaveNaics = document.getElementById('saveNaicsBtn'); if (btnSaveNaics) { btnSaveNaics.addEventListener('click', saveSettings); }
  var btnSaveCurrency = document.getElementById('saveCurrencyBtn'); if (btnSaveCurrency) { btnSaveCurrency.addEventListener('click', saveSettings); }
  var btnSaveToggles = document.getElementById('saveTogglesBtn'); if (btnSaveToggles) { btnSaveToggles.addEventListener('click', saveToggles); }
  var btnSaveVisibilityTop = document.getElementById('btnSaveStepVisibilityTop'); if (btnSaveVisibilityTop) { btnSaveVisibilityTop.addEventListener('click', saveStepVisibility); }
  var btnSaveVisibilityBottom = document.getElementById('btnSaveStepVisibilityBottom'); if (btnSaveVisibilityBottom) { btnSaveVisibilityBottom.addEventListener('click', saveStepVisibility); }
  var btnAddKp = document.getElementById('kpAddBtn'); if (btnAddKp) { btnAddKp.addEventListener('click', addKeyPersonnel); }
  var kpSelectAll = document.getElementById('kpTaskSelectAll'); if (kpSelectAll) { kpSelectAll.addEventListener('change', function() { toggleSelectAllKpTasks(this.checked); }); }
  var kpCompleteBtn = document.getElementById('kpCompleteBtn'); if (kpCompleteBtn) { kpCompleteBtn.addEventListener('click', saveKeyPersonnelToDB); }
  var finalizeBtn = document.getElementById('finalizeOnboardingBtn'); if (finalizeBtn) { finalizeBtn.addEventListener('click', finalizeCompanyOnboarding); }
  var btnDismissErr = document.getElementById('btnDismissError'); if (btnDismissErr) { btnDismissErr.addEventListener('click', dismissPageError); }
  // Unit of Measure toggle buttons -- no inline onclick for CSP compliance
  var impBtn = document.getElementById('uom-imperial-btn'); if (impBtn) impBtn.addEventListener('click', function() { setUnitSystem('imperial'); });
  var metBtn = document.getElementById('uom-metric-btn'); if (metBtn) metBtn.addEventListener('click', function() { setUnitSystem('metric'); });
  // Stat card navigation -- direct navigation with org_id only (no role_id to avoid auth-check override)
  document.querySelectorAll('.stat-card[data-nav]').forEach(function(card) {
    card.addEventListener('click', function(e) { 
      e.preventDefault(); 
      var url = this.getAttribute('data-nav');
      var orgId = activeOrgId || localStorage.getItem('driven_org_id') || '';
      if (orgId) { url += (url.includes('?') ? '&' : '?') + 'org_id=' + encodeURIComponent(orgId); }
      window.location.href = url; 
    });
    card.addEventListener('keydown', function(e) { 
      if (e.key === 'Enter' || e.key === ' ') { 
        e.preventDefault(); 
        var url = this.getAttribute('data-nav');
        var orgId = activeOrgId || localStorage.getItem('driven_org_id') || '';
        if (orgId) { url += (url.includes('?') ? '&' : '?') + 'org_id=' + encodeURIComponent(orgId); }
        window.location.href = url; 
      } 
    });
  });
  var btnLogout = document.getElementById('btnAdminLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function(e) { if (e) { e.preventDefault(); e.stopPropagation(); } if (pendingKP.length > 0 && !confirm('You have unsaved Key Personnel assignments that will be lost. Continue logging out?')) return; localStorage.clear(); sessionStorage.clear(); if (typeof window.dashLogout === 'function') { try { window.dashLogout(); } catch (err) {} } window.location.href = '/public/login.html'; });
    btnLogout.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (pendingKP.length > 0 && !confirm('You have unsaved Key Personnel assignments that will be lost. Continue logging out?')) return; localStorage.clear(); sessionStorage.clear(); if (typeof window.dashLogout === 'function') { try { window.dashLogout(); } catch (err) {} } window.location.href = '/public/login.html'; } });
  }
}

async function startAdminApp(user) {
  if (adminAppStarted) return;
  if (!user) { var savedUserStr = localStorage.getItem('driven_user') || sessionStorage.getItem('driven_user'); if (savedUserStr) { try { user = JSON.parse(savedUserStr); } catch (e) {} } }
  if (!user) { console.warn('[AdminDashboard] No user found - startAdminApp cannot proceed.'); return; }
  currentUserObj = user;
  var roleVal = String((user && (user.role || user.role_id)) || '').trim().toLowerCase();
  var isAllowedAdmin = roleVal === 'admin' || roleVal === 'ro-admin';
  if (!isAllowedAdmin) { console.warn('[AdminDashboard] Guard rejected role:', roleVal); adminAppStarted = true; window.location.href = '/public/login.html'; return; }
  activeOrgId = user.org_id || user.customer_id || '';
  if (!activeOrgId || activeOrgId === 'default_org' || activeOrgId === 'null') { adminAppStarted = true; window.location.href = '/public/login.html'; return; }
  adminAppStarted = true;

  // Force header rebuild now that the app is starting (catches any stale SW content)
  rebuildHeader();

  // ===== GUARANTEE: Show dashboard even if anything below throws =====
  // Every code path after this point must end with the dashboard visible.
  // We use a try-finally so the dashboard is shown no matter what.
  try {
    if (!user.id && user.user_id) user.id = user.user_id;
    var userStr = JSON.stringify(user); var userRole = user.role || user.role_id || '';
    localStorage.setItem('driven_org_id', activeOrgId); localStorage.setItem('driven_user', userStr);
    if (userRole) localStorage.setItem('driven_role', userRole); if (user.id) localStorage.setItem('driven_user_id', user.id);
    sessionStorage.setItem('driven_org_id', activeOrgId); sessionStorage.setItem('driven_user', userStr);
    if (userRole) sessionStorage.setItem('driven_role', userRole); if (user.id) sessionStorage.setItem('driven_user_id', user.id);
    var firstName = user.first_name || user.email; var orgName = user.org_name || localStorage.getItem('driven_org_name') || '';
    var welcomeEl = document.getElementById('welcome-name'); if (welcomeEl) { welcomeEl.textContent = firstName ? ('Welcome back, ' + firstName + (orgName ? ' - ' + orgName : '')) : 'Welcome back'; }
    var accountNameEl = document.getElementById('account-name'); if (accountNameEl) { accountNameEl.textContent = user.first_name ? (user.first_name + ' ' + (user.last_name || '')) : user.email; }
    var emailEl = document.getElementById('account-email'); if (emailEl) emailEl.textContent = user.email || '';
    var elRole = document.getElementById('welcome-role'); if (elRole) elRole.textContent = user.role || user.role_id || '';
    var elMail = document.getElementById('welcome-email'); if (elMail) elMail.textContent = user.email || '';
    initUomPreference();
    try { injectGlobalUIStyles(); attachEventHandlers(); } catch (e) { reportError('startAdminApp-init', e); }
    adjustStickyOffsets();
    loadLogo().catch(function(e) { reportError('loadLogo', e); });
    await loadSettings().catch(function(e) { reportError('loadSettings', e); });
    await loadKeyPersonnel().catch(function(e) { reportError('loadKeyPersonnel', e); });
    updateProgress(); renderFormsTab();
    await loadDashboardStats().catch(function(e) { reportError('init-loadDashboardStats', e); });
    setTimeout(function() { loadDashboardStats().catch(function(e) { reportError('init-loadDashboardStats-retry', e); }); }, 1000);
  } catch (e) {
    reportError('startAdminApp-outer', e);
    console.error('[AdminDashboard] Error during initialization:', e);
  } finally {
    // ALWAYS show the dashboard -- even if everything above failed
    rebuildHeader(); // final header rebuild safety net
    var loadingEl = document.getElementById('loading'); var dashEl = document.getElementById('dashboard');
    if (loadingEl) loadingEl.style.display = 'none';
    if (dashEl) dashEl.style.display = 'block';
    // Ensure the overview tab is active
    var overviewTab = document.getElementById('tab-overview');
    if (overviewTab && !overviewTab.classList.contains('active')) { overviewTab.classList.add('active'); }
    var overviewBtn = document.querySelector('.admin-tab[data-tab="overview"]');
    if (overviewBtn && !overviewBtn.classList.contains('active')) { overviewBtn.classList.add('active'); }
    adjustStickyOffsets();
  }
}

async function init() {
  var savedTheme = localStorage.getItem('driven-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  // ===== AGGRESSIVE HEADER REBUILD =====
  // Force rebuild the header as a single row to prevent duplicate titles
  // from stale service worker cache (old 3-row dashboard-header.html).
  rebuildHeader();
  startHeaderObserver();
  scheduleHeaderRebuilds();
  window.addEventListener('resize', adjustStickyOffsets);
  window.addEventListener('orientationchange', adjustStickyOffsets);
  window.addEventListener('scroll', adjustStickyOffsets, { passive: true });
  window.addEventListener('driven_completion_updated', function() { updateProgress(); });
  window.addEventListener('load', adjustStickyOffsets);
  if (syncChannel) { syncChannel.onmessage = function(msg) { if (msg.data && msg.data.type === 'driven_completion_updated') { updateProgress(); } }; }
  function getUserFromStorage() { var s = localStorage.getItem('driven_user') || sessionStorage.getItem('driven_user'); if (s) { try { return JSON.parse(s); } catch (e) { return null; } } return null; }
  var current = window.dashUser || window.drivenUser || getUserFromStorage();
  if (current) { startAdminApp(current); return; }
  var onSessionLoaded = function(e) { var u = (e && e.detail) || window.dashUser || window.drivenUser || getUserFromStorage(); rebuildHeader(); scheduleHeaderRebuilds(); if (u) startAdminApp(u); };
  document.addEventListener('dashSessionLoaded', onSessionLoaded);
  window.addEventListener('dashSessionLoaded', onSessionLoaded);
  var pollAttempts = 0;
  var pollTimer = setInterval(function() { pollAttempts++; var u = window.dashUser || window.drivenUser || getUserFromStorage(); if (u) { clearInterval(pollTimer); startAdminApp(u); } else if (pollAttempts >= 40) { clearInterval(pollTimer); var lastResort = getUserFromStorage(); if (lastResort) { startAdminApp(lastResort); } else { window.location.href = '/public/login.html'; } } }, 250);
  window.addEventListener('load', function() { if (!adminAppStarted) { rebuildHeader(); var u = window.dashUser || window.drivenUser || getUserFromStorage(); if (u) startAdminApp(u); } });

  // Cross-tab unit system sync — update displays when another tab changes the org default
  window.addEventListener('storage', function(e) {
    if (e.key === 'driv-en-unit-system-changed') {
      renderOnboardingUomDisplays();
      var hint = document.getElementById('welcomeUomHint');
      var select = document.getElementById('welcomeUomSelect');
      if (hint && select && select.value === 'org_default') {
        try { var sys = localStorage.getItem('driv-en-unit-system') || 'imperial'; hint.textContent = 'Org default: ' + (sys === 'metric' ? 'Metric' : 'Imperial'); } catch (err) {}
      }
      if (window.DRIVEN_APPLY_UNITS && DRIVEN_APPLY_UNITS.refresh) { try { DRIVEN_APPLY_UNITS.refresh(); } catch (err) {} }
    }
  });

  // ===== FALLBACK: After 10s, redirect to login if no session was found =====
  // (The poll at 250ms x 40 = 10s already handles starting the app when a user
  // appears.  This fallback only fires the login redirect so it does NOT
  // compete with the poll or prematurely show the dashboard with a stale user.)
  setTimeout(function() {
    if (adminAppStarted) return;
    console.warn('[AdminDashboard] No session found after timeout -- redirecting to login');
    window.location.href = '/public/login.html';
  }, 10000);
}

init();
