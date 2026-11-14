(function() {
'use strict';
var allProjects = [];
var allClients = [];
var projectTypes = [];
var editingProjectId = null;
var editingClientId = null;
var editingTypeIndex = null;
var canModify = false;
var pmDirty = false;
var PROJECT_COL_DEFS = [
{ key: 'code',       label: 'Project Number', defaultVisible: true,  width: 120 },
{ key: 'name',       label: 'Project Name',   defaultVisible: true,  width: 240 },
{ key: 'street',      label: 'Street',         defaultVisible: true,  width: 180 },
{ key: 'city',        label: 'City',           defaultVisible: true,  width: 120 },
{ key: 'state',       label: 'State',          defaultVisible: true,  width: 80 },
{ key: 'zip',         label: 'Zip',            defaultVisible: false, width: 80 },
{ key: 'status',     label: 'Status',         defaultVisible: true,  width: 100 },
{ key: 'expectedStartDate',  label: 'Expected Start',    defaultVisible: true,  width: 140 },
{ key: 'actualStartDate',    label: 'Actual Start',      defaultVisible: false, width: 140 },
{ key: 'expectedCompletionDate', label: 'Expected Completion', defaultVisible: true, width: 160 },
{ key: 'actualCompletionDate',   label: 'Actual Completion',   defaultVisible: false, width: 160 },
{ key: 'awardDate',              label: 'Award Date',           defaultVisible: false, width: 140 },
{ key: 'projectManager',        label: 'Project Manager',      defaultVisible: false, width: 140 },
{ key: 'notes',                label: 'Notes',                defaultVisible: false, width: 200 },
];
var CLIENT_COL_DEFS = [
{ key: 'clientName',   label: 'Client Name',  defaultVisible: true,  width: 200 },
{ key: 'contactName',  label: 'Contact Name', defaultVisible: true,  width: 160 },
{ key: 'contactEmail', label: 'Email',        defaultVisible: true,  width: 200 },
{ key: 'contactPhone', label: 'Phone',        defaultVisible: true,  width: 140 },
{ key: 'industry',     label: 'Industry',     defaultVisible: false, width: 140 },
{ key: 'city',         label: 'City',          defaultVisible: false, width: 120 },
{ key: 'state',        label: 'State',         defaultVisible: false, width: 80 },
{ key: 'status',       label: 'Status',        defaultVisible: true,  width: 100 },
];
function makeColumnsResizable(tableEl, storageKey, colWidths) {
if (!tableEl) return;
var ths = tableEl.querySelectorAll('thead th');
if (!ths.length) return;
tableEl.style.tableLayout = 'fixed';
var saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch(e) {}
function syncTableWidth() {
var total = 0;
tableEl.querySelectorAll('thead th').forEach(function(th) { total += th.offsetWidth; });
tableEl.style.width = total + 'px';
}
ths.forEach(function(th, i) {
var w = saved[i] || (colWidths && colWidths[i]) || 120;
th.style.width = w + 'px';
th.style.minWidth = '20px';
var oldR = th.querySelector('.pm-col-resizer');
if (oldR) oldR.remove();
var resizer = document.createElement('div');
resizer.className = 'pm-col-resizer';
th.appendChild(resizer);
resizer.addEventListener('mousedown', function(e) {
e.preventDefault(); e.stopPropagation();
resizer.classList.add('dragging');
var startX = e.clientX; var startW = th.offsetWidth;
document.body.style.cursor = 'col-resize';
function onMove(ev) {
var newW = Math.max(20, startW + (ev.clientX - startX));
var oldW = parseInt(th.style.width, 10) || th.offsetWidth;
var delta = newW - oldW;
var currentTotal = parseInt(tableEl.style.width, 10) || tableEl.offsetWidth;
tableEl.style.width = (currentTotal + delta) + 'px';
th.style.width = newW + 'px';
}
function onUp() {
document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
document.body.style.cursor = ''; resizer.classList.remove('dragging');
saved[i] = th.offsetWidth;
try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch(e) {}
syncTableWidth();
}
document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
});
});
syncTableWidth();
}
function makeColumnsDraggable(tableEl, orderKey) {
if (!tableEl) return;
var ths = tableEl.querySelectorAll('thead th');
if (!ths.length) return;
var total = ths.length;
var lastIdx = total - 1;
var savedOrder = null;
try { savedOrder = JSON.parse(localStorage.getItem(orderKey) || 'null'); } catch(e) {}
if (savedOrder && savedOrder.length === total) {
applyColumnOrder(tableEl, savedOrder);
}
ths = tableEl.querySelectorAll('thead th');
ths.forEach(function(th, i) {
if (i === lastIdx) return;
th.setAttribute('draggable', 'true');
th.addEventListener('dragstart', function(e) {
e.dataTransfer.effectAllowed = 'move';
e.dataTransfer.setData('text/plain', String(i));
th.style.opacity = '0.5';
});
th.addEventListener('dragend', function() { th.style.opacity = ''; });
th.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
th.addEventListener('drop', function(e) {
e.preventDefault();
var fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
var toIdx = i;
if (fromIdx === toIdx || isNaN(fromIdx)) return;
var currentOrder = [];
for (var j = 0; j < total; j++) currentOrder.push(j);
if (savedOrder && savedOrder.length === total) currentOrder = savedOrder.slice();
var moved = currentOrder.splice(fromIdx, 1)[0];
currentOrder.splice(toIdx, 0, moved);
var lastVal = currentOrder[currentOrder.length - 1];
if (lastVal !== lastIdx) {
currentOrder = currentOrder.filter(function(v) { return v !== lastIdx; });
currentOrder.push(lastIdx);
}
savedOrder = currentOrder;
try { localStorage.setItem(orderKey, JSON.stringify(currentOrder)); } catch(e) {}
applyColumnOrder(tableEl, currentOrder);
var totalW = 0;
tableEl.querySelectorAll('thead th').forEach(function(th) { totalW += th.offsetWidth; });
tableEl.style.width = totalW + 'px';
});
});
}
function applyColumnOrder(tableEl, order) {
var thead = tableEl.querySelector('thead');
var tbody = tableEl.querySelector('tbody');
if (!thead) return;
var ths = Array.from(thead.querySelectorAll('th'));
var orderedThs = order.map(function(idx) { return ths[idx]; });
thead.textContent = '';
orderedThs.forEach(function(th) { thead.appendChild(th); });
if (tbody) {
Array.from(tbody.querySelectorAll('tr')).forEach(function(row) {
var tds = Array.from(row.querySelectorAll('td'));
if (tds.length !== order.length) return;
var orderedTds = order.map(function(idx) { return tds[idx]; });
row.textContent = '';
orderedTds.forEach(function(td) { row.appendChild(td); });
});
}
}
var projectSortKey = 'name';
var projectSortDir = 'asc';
var projectPage = 1;
var projectPageSize = 10;
var ovProjPage = 1;
var ovProjPageSize = 10;
var projectVisibleCols = {};
var clientSortKey = 'clientName';
var clientSortDir = 'asc';
var clientPage = 1;
var clientPageSize = 10;
var ovClientPage = 1;
var ovClientPageSize = 10;
var typePage = 1;
var typePageSize = 10;
var clientVisibleCols = {};
var projectExportFormat = 'csv';
var clientExportFormat = 'csv';
function rebuildHeader() {
var header = document.getElementById('dashHeader');
if (!header) return;
var title = document.body.getAttribute('data-page-title') || 'Dashboard';
var logoArea = header.querySelector('#dashCustomerLogoArea');
var drivenLogo = header.querySelector('.dash-driven-logo') || header.querySelector('img.dash-driven-logo');
header.innerHTML = '';
var dashHeader = document.createElement('div');
dashHeader.className = 'dash-header';
var row1 = document.createElement('div');
row1.className = 'dash-header-row1';
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
var h1 = document.createElement('h1');
h1.id = 'dashPageTitle';
h1.className = 'dash-header-title';
h1.textContent = title;
row1.appendChild(h1);
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
var header = document.getElementById('dashHeader');
if (!header) return;
var observer = new MutationObserver(function(mutations) {
for (var i = 0; i < mutations.length; i++) {
if (mutations[i].addedNodes.length > 0) {
observer.disconnect();
rebuildHeader();
setTimeout(function() { startHeaderObserver(); }, 100);
return;
}
}
});
observer.observe(header, { childList: true, subtree: true });
}
function scheduleHeaderRebuilds() {
setTimeout(rebuildHeader, 50);
setTimeout(rebuildHeader, 200);
setTimeout(rebuildHeader, 500);
setTimeout(rebuildHeader, 1000);
setTimeout(rebuildHeader, 2000);
setTimeout(rebuildHeader, 3000);
}
function initVisibleCols() {
try {
var savedP = JSON.parse(localStorage.getItem('driven_pm_proj_cols') || '{}');
PROJECT_COL_DEFS.forEach(function(c) {
projectVisibleCols[c.key] = (savedP[c.key] !== undefined) ? savedP[c.key] : c.defaultVisible;
});
} catch(e) {
PROJECT_COL_DEFS.forEach(function(c) { projectVisibleCols[c.key] = c.defaultVisible; });
}
try {
var savedC = JSON.parse(localStorage.getItem('driven_pm_cli_cols') || '{}');
CLIENT_COL_DEFS.forEach(function(c) {
clientVisibleCols[c.key] = (savedC[c.key] !== undefined) ? savedC[c.key] : c.defaultVisible;
});
} catch(e) {
CLIENT_COL_DEFS.forEach(function(c) { clientVisibleCols[c.key] = c.defaultVisible; });
}
}
function saveProjectVisibleCols() {
try { localStorage.setItem('driven_pm_proj_cols', JSON.stringify(projectVisibleCols)); } catch(e) {}
}
function saveClientVisibleCols() {
try { localStorage.setItem('driven_pm_cli_cols', JSON.stringify(clientVisibleCols)); } catch(e) {}
}
var pmInitDone = false;
document.addEventListener('dashSessionLoaded', initProjectManagement);
if (document.readyState !== 'loading') { initProjectManagement(); }
async function initProjectManagement() {
if (pmInitDone) return;
pmInitDone = true;
rebuildHeader();
startHeaderObserver();
scheduleHeaderRebuilds();
function updateHeaderHeight() {
var header = document.getElementById('dashHeader');
if (header) {
var h = header.offsetHeight;
if (h > 0) document.documentElement.style.setProperty('--header-height', h + 'px');
}
}
updateHeaderHeight();
setInterval(updateHeaderHeight, 500);
window.addEventListener('resize', updateHeaderHeight);
var user = window.dashUser || window.drivenUser;
if (!user) {
try { user = JSON.parse(localStorage.getItem('driven_user') || sessionStorage.getItem('driven_user')); } catch(e) {}
}
if (!user) { window.location.href = '/public/login.html'; return; }
var firstName = user.first_name || user.email || '';
var orgName = user.org_name || localStorage.getItem('driven_org_name') || '';
var welcomeNameEl = document.getElementById('pm-welcome-name');
if (welcomeNameEl) {
welcomeNameEl.textContent = firstName ? ('Welcome back, ' + firstName + (orgName ? ' - ' + orgName : '')) : 'Welcome back';
}
var welcomeRoleEl = document.getElementById('pm-welcome-role');
if (welcomeRoleEl) welcomeRoleEl.textContent = user.role || user.role_id || '';
var welcomeEmailEl = document.getElementById('pm-welcome-email');
if (welcomeEmailEl) welcomeEmailEl.textContent = user.email || '';
var role = (user.role || '').toLowerCase();
var isAdmin = role === 'admin' || role === 'administrator' || role.indexOf('founder') !== -1 || role === 'owner';
canModify = isAdmin;
if (!isAdmin) {
var customerId = localStorage.getItem('driven_customer_id');
if (customerId) {
try {
var kpResp = await fetch('/api/onboarding/key-personnel/list?customerId=' + encodeURIComponent(customerId));
var kpData = await kpResp.json();
if (kpData.success && kpData.keyPersonnel) {
var myEmail = user.email ? user.email.toLowerCase() : '';
var myRecord = kpData.keyPersonnel.find(function(kp) {
return kp.email && kp.email.toLowerCase() === myEmail;
});
if (myRecord && myRecord.roles) {
var myTasks = myRecord.roles.map(function(r) { return r.role; });
canModify = myTasks.indexOf('Projects') !== -1 || myTasks.indexOf('Clients') !== -1;
}
}
} catch(e) {
if (window.DRIVENErrorHandler) {
window.DRIVENErrorHandler.report(
'project-management.html: KP permission check failed — ' + (e.message || e),
'kp-permission-check', e && e.stack ? e.stack : null
);
}
}
}
}
if (!canModify) {
document.getElementById('addProjectForm').style.display = 'none';
document.getElementById('addClientForm').style.display = 'none';
document.getElementById('addTypeForm').style.display = 'none';
}
initVisibleCols();
bindStaticEvents();
pmLoadPrefs();
await loadProjectTypes();
await loadProjects();
await loadClients();
populateClientDropdown();
populateProjectManagerDropdown();
renderOverview();
populateYearFilter();
initOverviewSearch();
initGanttControls();
document.getElementById('pmLoading').style.display = 'none';
document.getElementById('tab-overview').style.display = 'block';
if (typeof initVoice === 'function') initVoice();
}
function bindStaticEvents() {
document.querySelectorAll('.pm-tab[data-tab]').forEach(function(tab) {
tab.addEventListener('click', function() { switchTab(tab.getAttribute('data-tab')); });
});
var dashTab = document.getElementById('pmTabDashboard');
if (dashTab) dashTab.addEventListener('click', goToMainDashboard);
var logoutTab = document.getElementById('pmTabLogout');
if (logoutTab) logoutTab.addEventListener('click', confirmLogout);
var ps = document.getElementById('pmProjectSearch');
if (ps) ps.addEventListener('input', onProjectSearchInput);
var pfs = document.getElementById('pmProjectFilterStatus');
if (pfs) pfs.addEventListener('change', renderProjectTable);
var bpCols = document.getElementById('btnProjectCols');
if (bpCols) bpCols.addEventListener('click', toggleProjectColPanel);
var bpPrint = document.getElementById('btnProjectPrint');
if (bpPrint) bpPrint.addEventListener('click', openProjectPrintModal);
var bpCsv = document.getElementById('btnProjectExportCsv');
if (bpCsv) bpCsv.addEventListener('click', function() { openProjectExportModal('csv'); });
var bpXls = document.getElementById('btnProjectExportExcel');
if (bpXls) bpXls.addEventListener('click', function() { openProjectExportModal('excel'); });
var btnAddProj = document.getElementById('btnAddProject');
if (btnAddProj) btnAddProj.addEventListener('click', addProject);
var btnAddType = document.getElementById('btnAddType');
if (btnAddType) btnAddType.addEventListener('click', addProjectType);
var cs = document.getElementById('pmClientSearch');
if (cs) cs.addEventListener('input', onClientSearchInput);
var cfs = document.getElementById('pmClientFilterStatus');
if (cfs) cfs.addEventListener('change', renderClientTable);
var bcCols = document.getElementById('btnClientCols');
if (bcCols) bcCols.addEventListener('click', toggleClientColPanel);
var bcPrint = document.getElementById('btnClientPrint');
if (bcPrint) bcPrint.addEventListener('click', openClientPrintModal);
var bcCsv = document.getElementById('btnClientExportCsv');
if (bcCsv) bcCsv.addEventListener('click', function() { openClientExportModal('csv'); });
var bcXls = document.getElementById('btnClientExportExcel');
if (bcXls) bcXls.addEventListener('click', function() { openClientExportModal('excel'); });
var btnAddCli = document.getElementById('btnAddClient');
if (btnAddCli) btnAddCli.addEventListener('click', addClient);
var btnCancelEP = document.getElementById('btnCancelEditProject');
if (btnCancelEP) btnCancelEP.addEventListener('click', closeEditProjectModal);
var btnSaveEP = document.getElementById('btnSaveEditProject');
if (btnSaveEP) btnSaveEP.addEventListener('click', saveEditProject);
var btnCancelEC = document.getElementById('btnCancelEditClient');
if (btnCancelEC) btnCancelEC.addEventListener('click', closeEditClientModal);
var btnSaveEC = document.getElementById('btnSaveEditClient');
if (btnSaveEC) btnSaveEC.addEventListener('click', saveEditClient);
var btnCancelET = document.getElementById('btnCancelEditType');
if (btnCancelET) btnCancelET.addEventListener('click', closeEditTypeModal);
var btnSaveET = document.getElementById('btnSaveEditType');
if (btnSaveET) btnSaveET.addEventListener('click', saveEditProjectType);
var btnAddSH = document.getElementById('btnAddStatusHistory');
if (btnAddSH) btnAddSH.addEventListener('click', function() {
if (!editingProjectId) return;
var status = document.getElementById('pmStatusHistoryStatus').value;
var date = document.getElementById('pmStatusHistoryDate').value;
var note = document.getElementById('pmStatusHistoryNote').value.trim();
if (!date) { showProjectMessage('Please pick a date for the status change.', 'error'); return; }
var rows = pmStatusHistory[editingProjectId] || [];
rows.push({ status: status, changedAt: date, note: note });
rows.sort(function(a, b) { return (a.changedAt || '').localeCompare(b.changedAt || ''); });
pmStatusHistory[editingProjectId] = rows;
renderStatusHistory(editingProjectId);
document.getElementById('pmStatusHistoryDate').value = '';
document.getElementById('pmStatusHistoryNote').value = '';
});
var btnCanPP = document.getElementById('btnCancelProjectPrint');
if (btnCanPP) btnCanPP.addEventListener('click', function() { closeModal('pmProjectPrintModal'); });
var btnDoPP = document.getElementById('btnDoProjectPrint');
if (btnDoPP) btnDoPP.addEventListener('click', doProjectPrint);
var btnCanPE = document.getElementById('btnCancelProjectExport');
if (btnCanPE) btnCanPE.addEventListener('click', function() { closeModal('pmProjectExportModal'); });
var btnDoPE = document.getElementById('pmProjectExportBtn');
if (btnDoPE) btnDoPE.addEventListener('click', doProjectExport);
var btnCanCP = document.getElementById('btnCancelClientPrint');
if (btnCanCP) btnCanCP.addEventListener('click', function() { closeModal('pmClientPrintModal'); });
var btnDoCP = document.getElementById('btnDoClientPrint');
if (btnDoCP) btnDoCP.addEventListener('click', doClientPrint);
var btnCanCE = document.getElementById('btnCancelClientExport');
if (btnCanCE) btnCanCE.addEventListener('click', function() { closeModal('pmClientExportModal'); });
var btnDoCE = document.getElementById('pmClientExportBtn');
if (btnDoCE) btnDoCE.addEventListener('click', doClientExport);
var modals = ['pmEditProjectModal','pmEditClientModal','pmEditTypeModal','pmProjectPrintModal','pmProjectExportModal','pmClientPrintModal','pmClientExportModal'];
modals.forEach(function(id) {
var el = document.getElementById(id);
if (el) el.addEventListener('click', function(e) { if (e.target === el) closeModal(id); });
});
var pn = document.getElementById('pmProjectName');
if (pn) pn.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); addProject(); } });
var cn = document.getElementById('pmClientName');
if (cn) cn.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); addClient(); } });
document.addEventListener('click', function(e) {
var pPanel = document.getElementById('pmProjectColPanel');
if (pPanel && pPanel.classList.contains('active') && !pPanel.contains(e.target) && e.target.textContent !== 'Columns') {
pPanel.classList.remove('active');
}
var cPanel = document.getElementById('pmClientColPanel');
if (cPanel && cPanel.classList.contains('active') && !cPanel.contains(e.target) && e.target.textContent !== 'Columns') {
cPanel.classList.remove('active');
}
});
window.addEventListener('beforeunload', function(e) {
if (pmDirty) { e.preventDefault(); e.returnValue = 'You have unsaved changes.'; }
});
}
function normalizeProject(r) {
var f = (r && r.fields && typeof r.fields === 'object') ? r.fields : r;
return {
id: r.id || ('prj-' + Math.random().toString(36).substr(2, 9)),
name:       f['Project Name'] || f.name || '',
code:       f['Project Code'] || f.code || f['project_number'] || '',
status:     f['Status'] || f.status || 'Awarded',
location:   f['Location'] || f.location || '',
createdAt:  f['Created Date'] || f.created_at || '',
expectedStartDate:       f['Expected Start Date'] || f.expected_start_date || '',
actualStartDate:         f['Actual Start Date'] || f.actual_start_date || '',
expectedCompletionDate:  f['Expected Completion Date'] || f.expected_completion_date || '',
actualCompletionDate:    f['Actual Completion Date'] || f.actual_completion_date || '',
awardDate:              f['Award Date'] || f.award_date || '',
street:                f['Street'] || f.street || '',
city:                  f['City'] || f.city || '',
state:                 f['State'] || f.state || '',
zip:                   f['Zip'] || f.zip || f['Zip Code'] || f.zip_code || '',
projectManager:        f['Project Manager'] || f.project_manager || '',
notes:                f['Notes'] || f.notes || '',
};
}
function normalizeClient(r) {
var f = (r && r.fields && typeof r.fields === 'object') ? r.fields : r;
return {
id: r.id || ('cli-' + Math.random().toString(36).substr(2, 9)),
clientName:   f['Client Name'] || f.client_name || '',
contactName:  f['Contact Name'] || f.contact_name || '',
contactEmail: f['Contact Email'] || f.contact_email || '',
contactPhone: f['Contact Phone'] || f.contact_phone || '',
address:      f['Address'] || f.address || '',
city:         f['City'] || f.city || '',
state:        f['State'] || f.state || '',
zip:          f['Zip Code'] || f.zip_code || '',
country:      f['Country'] || f.country || '',
industry:     f['Industry'] || f.industry || '',
status:       f['Status'] || f.status || 'Active',
notes:        f['Notes'] || f.notes || '',
createdAt:    f['Created Date'] || f.created_at || '',
};
}
async function loadProjects() {
try {
var resp = await fetch('/api/Project');
var data = await resp.json();
if (resp.ok && data && data.records) {
allProjects = data.records.map(normalizeProject);
} else {
allProjects = [];
}
} catch(e) {
allProjects = [];
}
}
async function loadProjectTypes() {
try {
var saved = localStorage.getItem('driven_project_types');
if (saved) projectTypes = JSON.parse(saved);
} catch(e) {
projectTypes = [];
}
}
async function saveProjectTypes() {
try { localStorage.setItem('driven_project_types', JSON.stringify(projectTypes)); } catch(e) {}
try {
await fetch('/auth/save-settings', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ project_types: JSON.stringify(projectTypes) })
});
} catch(e) {}
}
async function loadClients() {
try {
var resp = await fetch('/api/Clients');
var data = await resp.json();
if (resp.ok && data && data.records) {
allClients = data.records.map(normalizeClient);
} else {
allClients = [];
}
} catch(e) {
allClients = [];
}
}
function populateClientDropdown() {
var sel = document.getElementById('pmProjectClient');
if (!sel) return;
var current = sel.value;
sel.innerHTML = '<option value="">None</option>';
allClients.forEach(function(c) {
var opt = document.createElement('option');
opt.value = c.id;
opt.textContent = c.clientName || '(unnamed)';
sel.appendChild(opt);
});
sel.value = current;
}
async function populateProjectManagerDropdown() {
var sel = document.getElementById('pmProjectManager');
if (!sel) return;
var current = sel.value;
sel.innerHTML = '<option value="">None</option>';
try {
var resp = await fetch('/api/Employee');
var data = await resp.json();
if (resp.ok && data && data.records) {
data.records.forEach(function(r) {
var f = (r.fields && typeof r.fields === 'object') ? r.fields : r;
var name = f['Full Name'] || f.full_name || f['Name'] || f.name || f['Email'] || f.email || '';
if (name) {
var opt = document.createElement('option');
opt.value = name;
opt.textContent = name;
sel.appendChild(opt);
}
});
}
} catch(e) {}
sel.value = current;
}
function renderOverview() {
var fp = getYearFilteredProjects();
var fc = getYearFilteredClients();
document.getElementById('kpiTotalProjects').textContent = fp.length;
document.getElementById('kpiAwardedProjects').textContent = fp.filter(function(p) { return String(p.status || '').toLowerCase() === 'awarded'; }).length;
document.getElementById('kpiInProgressProjects').textContent = fp.filter(function(p) { return String(p.status || '').toLowerCase() === 'in progress'; }).length;
document.getElementById('kpiOnHoldProjects').textContent = fp.filter(function(p) { return String(p.status || '').toLowerCase() === 'on hold'; }).length;
document.getElementById('kpiCompletedProjects').textContent = fp.filter(function(p) { return String(p.status || '').toLowerCase() === 'completed'; }).length;
document.getElementById('kpiCancelledProjects').textContent = fp.filter(function(p) { return String(p.status || '').toLowerCase() === 'cancelled'; }).length;
renderStatusDonut(fp);
renderTrendChart(fp);
renderOverviewProjects(fp);
renderOverviewClients(fc);
makeColumnsResizable(document.getElementById('pmOverviewProjectsTable'), 'pmColW_ovProjects', [120, 240, 200, 100]);
makeColumnsDraggable(document.getElementById('pmOverviewProjectsTable'), 'pmColOrder_ovProjects');
makeColumnsResizable(document.getElementById('pmOverviewClientsTable'), 'pmColW_ovClients', [200, 160, 100]);
makeColumnsDraggable(document.getElementById('pmOverviewClientsTable'), 'pmColOrder_ovClients');
if (typeof initVoice === 'function') initVoice();
}
function kpiClick(el) {
var status = el.getAttribute('data-kpi-status') || '';
var sel = document.getElementById('pmProjectFilterStatus');
if (sel) sel.value = status;
switchTab('projects');
}
function statusLabel(s) {
var map = { 'awarded': 'Awarded', 'in progress': 'In Progress', 'on hold': 'On Hold', 'completed': 'Completed', 'cancelled': 'Cancelled' };
return map[String(s || '').toLowerCase()] || s;
}
function statusBadgeHtml(status) {
if (!status) return '\u2014';
var cls = 'pm-badge pm-badge-' + String(status).toLowerCase().replace(/\s+/g, '-');
return '<span class="' + cls + '">' + escapeHtml(status) + '</span>';
}
function renderProjectTableHead() {
var thead = document.getElementById('pmProjectTableHead');
thead.textContent = '';
var tr = document.createElement('tr');
PROJECT_COL_DEFS.forEach(function(col) {
if (!projectVisibleCols[col.key]) return;
var th = document.createElement('th');
th.dataset.key = col.key;
th.textContent = col.label;
var arrow = document.createElement('span');
arrow.className = 'pm-sort-arrow';
if (projectSortKey === col.key) {
arrow.textContent = projectSortDir === 'asc' ? ' \u25B2' : ' \u25BC';
th.classList.add(projectSortDir === 'asc' ? 'pm-sorted-asc' : 'pm-sorted-desc');
} else {
arrow.textContent = ' \u2195';
}
th.appendChild(arrow);
th.addEventListener('click', function() { onProjectSortClick(col.key); });
tr.appendChild(th);
});
if (canModify) {
var thActions = document.createElement('th');
thActions.textContent = 'Actions';
thActions.style.cursor = 'default';
tr.appendChild(thActions);
}
thead.appendChild(tr);
}
function onProjectSortClick(key) {
if (projectSortKey === key) {
projectSortDir = (projectSortDir === 'asc') ? 'desc' : 'asc';
} else {
projectSortKey = key;
projectSortDir = 'asc';
}
projectPage = 1;
renderProjectTableHead();
renderProjectTable();
}
var projectSearchTimer = null;
function onProjectSearchInput() {
clearTimeout(projectSearchTimer);
projectSearchTimer = setTimeout(function() {
projectPage = 1;
renderProjectTable();
}, 200);
}
function renderProjectTable() {
var tbody = document.getElementById('pmProjectTableBody');
var search = document.getElementById('pmProjectSearch').value.toLowerCase().trim();
var filterStatus = document.getElementById('pmProjectFilterStatus').value;
var filtered = allProjects.filter(function(p) {
var matchesSearch = !search ||
(p.name && p.name.toLowerCase().indexOf(search) !== -1) ||
(p.code && p.code.toLowerCase().indexOf(search) !== -1) ||
(p.street && p.street.toLowerCase().indexOf(search) !== -1) ||
(p.city && p.city.toLowerCase().indexOf(search) !== -1);
var matchesStatus = !filterStatus || (p.status && p.status.toLowerCase() === filterStatus.toLowerCase());
return matchesSearch && matchesStatus;
});
filtered.sort(function(a, b) {
var va = a[projectSortKey] || '';
var vb = b[projectSortKey] || '';
va = String(va).toLowerCase();
vb = String(vb).toLowerCase();
if (va < vb) return projectSortDir === 'asc' ? -1 : 1;
if (va > vb) return projectSortDir === 'asc' ? 1 : -1;
return 0;
});
document.getElementById('pmProjectCount').textContent = filtered.length + ' project' + (filtered.length === 1 ? '' : 's');
var totalPages = Math.max(1, Math.ceil(filtered.length / projectPageSize));
if (projectPage > totalPages) projectPage = totalPages;
var startIdx = (projectPage - 1) * projectPageSize;
var pageItems = filtered.slice(startIdx, startIdx + projectPageSize);
tbody.textContent = '';
if (filtered.length === 0) {
var tr = document.createElement('tr');
var td = document.createElement('td');
td.className = 'pm-empty';
td.textContent = allProjects.length === 0 ? 'No projects found. Add your first project above.' : 'No projects match your search.';
tr.appendChild(td);
tbody.appendChild(tr);
renderPagination('pmProjectPagination', 0, 1, projectPage, projectPageSize, function(p) { projectPage = p; renderProjectTable(); }, function(sz) { projectPageSize = sz; projectPage = 1; renderProjectTable(); });
return;
}
var dateKeys = ['createdAt','expectedStartDate','actualStartDate','expectedCompletionDate','actualCompletionDate','awardDate'];
pageItems.forEach(function(p) {
var tr = document.createElement('tr');
PROJECT_COL_DEFS.forEach(function(col) {
if (!projectVisibleCols[col.key]) return;
var td = document.createElement('td');
var val = p[col.key];
if (col.key === 'status' && val) {
td.innerHTML = statusBadgeHtml(val);
} else if (val && dateKeys.indexOf(col.key) !== -1) {
td.textContent = new Date(val).toLocaleDateString();
} else {
td.textContent = (val !== undefined && val !== null && val !== '') ? val : '\u2014';
}
tr.appendChild(td);
});
if (canModify) {
var actionsTd = document.createElement('td');
actionsTd.className = 'pm-actions';
var btnEdit = document.createElement('button');
btnEdit.className = 'pm-table-btn';
btnEdit.textContent = 'Edit';
btnEdit.addEventListener('click', function() { openEditProjectModal(p.id); });
actionsTd.appendChild(btnEdit);
tr.appendChild(actionsTd);
}
tbody.appendChild(tr);
});
renderPagination('pmProjectPagination', filtered.length, totalPages, projectPage, projectPageSize, function(p) { projectPage = p; renderProjectTable(); }, function(sz) { projectPageSize = sz; projectPage = 1; renderProjectTable(); });
var pColW = PROJECT_COL_DEFS.filter(function(c) { return c.defaultVisible; }).map(function(c) { return c.width || 120; });
pColW.push(80);
makeColumnsResizable(document.getElementById('pmProjectTable'), 'pmColW_projects', pColW);
makeColumnsDraggable(document.getElementById('pmProjectTable'), 'pmColOrder_projects');
if (typeof initVoice === 'function') initVoice();
}
function renderClientTableHead() {
var thead = document.getElementById('pmClientTableHead');
thead.textContent = '';
var tr = document.createElement('tr');
CLIENT_COL_DEFS.forEach(function(col) {
if (!clientVisibleCols[col.key]) return;
var th = document.createElement('th');
th.dataset.key = col.key;
th.textContent = col.label;
var arrow = document.createElement('span');
arrow.className = 'pm-sort-arrow';
if (clientSortKey === col.key) {
arrow.textContent = clientSortDir === 'asc' ? ' \u25B2' : ' \u25BC';
th.classList.add(clientSortDir === 'asc' ? 'pm-sorted-asc' : 'pm-sorted-desc');
} else {
arrow.textContent = ' \u2195';
}
th.appendChild(arrow);
th.addEventListener('click', function() { onClientSortClick(col.key); });
tr.appendChild(th);
});
if (canModify) {
var thActions = document.createElement('th');
thActions.textContent = 'Actions';
thActions.style.cursor = 'default';
tr.appendChild(thActions);
}
thead.appendChild(tr);
}
function onClientSortClick(key) {
if (clientSortKey === key) {
clientSortDir = (clientSortDir === 'asc') ? 'desc' : 'asc';
} else {
clientSortKey = key;
clientSortDir = 'asc';
}
clientPage = 1;
renderClientTableHead();
renderClientTable();
}
var clientSearchTimer = null;
function onClientSearchInput() {
clearTimeout(clientSearchTimer);
clientSearchTimer = setTimeout(function() {
clientPage = 1;
renderClientTable();
}, 200);
}
function renderClientTable() {
var tbody = document.getElementById('pmClientTableBody');
var search = document.getElementById('pmClientSearch').value.toLowerCase().trim();
var filterStatus = document.getElementById('pmClientFilterStatus').value;
var filtered = allClients.filter(function(c) {
var matchesSearch = !search ||
(c.clientName && c.clientName.toLowerCase().indexOf(search) !== -1) ||
(c.contactName && c.contactName.toLowerCase().indexOf(search) !== -1) ||
(c.contactEmail && c.contactEmail.toLowerCase().indexOf(search) !== -1);
var matchesStatus = !filterStatus || (c.status && c.status.toLowerCase() === filterStatus.toLowerCase());
return matchesSearch && matchesStatus;
});
filtered.sort(function(a, b) {
var va = a[clientSortKey] || '';
var vb = b[clientSortKey] || '';
va = String(va).toLowerCase();
vb = String(vb).toLowerCase();
if (va < vb) return clientSortDir === 'asc' ? -1 : 1;
if (va > vb) return clientSortDir === 'asc' ? 1 : -1;
return 0;
});
document.getElementById('pmClientCount').textContent = filtered.length + ' client' + (filtered.length === 1 ? '' : 's');
var totalPages = Math.max(1, Math.ceil(filtered.length / clientPageSize));
if (clientPage > totalPages) clientPage = totalPages;
var startIdx = (clientPage - 1) * clientPageSize;
var pageItems = filtered.slice(startIdx, startIdx + clientPageSize);
tbody.textContent = '';
if (filtered.length === 0) {
var tr = document.createElement('tr');
var td = document.createElement('td');
td.className = 'pm-empty';
td.textContent = allClients.length === 0 ? 'No clients found. Add your first client above.' : 'No clients match your search.';
tr.appendChild(td);
tbody.appendChild(tr);
renderPagination('pmClientPagination', 0, 1, clientPage, clientPageSize, function(p) { clientPage = p; renderClientTable(); }, function(sz) { clientPageSize = sz; clientPage = 1; renderClientTable(); });
return;
}
var dateKeys = ['createdAt','expectedStartDate','actualStartDate','expectedCompletionDate','actualCompletionDate','awardDate'];
pageItems.forEach(function(c) {
var tr = document.createElement('tr');
CLIENT_COL_DEFS.forEach(function(col) {
if (!clientVisibleCols[col.key]) return;
var td = document.createElement('td');
var val = c[col.key];
if (col.key === 'status' && val) {
td.innerHTML = statusBadgeHtml(val);
} else if (val && dateKeys.indexOf(col.key) !== -1) {
td.textContent = new Date(val).toLocaleDateString();
} else {
td.textContent = (val !== undefined && val !== null && val !== '') ? val : '\u2014';
}
tr.appendChild(td);
});
if (canModify) {
var actionsTd = document.createElement('td');
actionsTd.className = 'pm-actions';
var btnEdit = document.createElement('button');
btnEdit.className = 'pm-table-btn';
btnEdit.textContent = 'Edit';
btnEdit.addEventListener('click', function() { openEditClientModal(c.id); });
actionsTd.appendChild(btnEdit);
tr.appendChild(actionsTd);
}
tbody.appendChild(tr);
});
renderPagination('pmClientPagination', filtered.length, totalPages, clientPage, clientPageSize, function(p) { clientPage = p; renderClientTable(); }, function(sz) { clientPageSize = sz; clientPage = 1; renderClientTable(); });
var cColW = CLIENT_COL_DEFS.filter(function(c) { return c.defaultVisible; }).map(function(c) { return c.width || 120; });
cColW.push(80);
makeColumnsResizable(document.getElementById('pmClientTable'), 'pmColW_clients', cColW);
makeColumnsDraggable(document.getElementById('pmClientTable'), 'pmColOrder_clients');
if (typeof initVoice === 'function') initVoice();
}
function renderPagination(containerId, totalItems, totalPages, currentPage, pageSize, onPageChange, onPageSizeChange) {
var container = document.getElementById(containerId);
container.textContent = '';
if (totalItems === 0) return;
var info = document.createElement('span');
info.className = 'pm-page-info';
var startIdx = (currentPage - 1) * pageSize + 1;
var endIdx = Math.min(currentPage * pageSize, totalItems);
info.textContent = 'Showing ' + startIdx + '\u2013' + endIdx + ' of ' + totalItems;
container.appendChild(info);
var sizeDiv = document.createElement('div');
sizeDiv.style.display = 'flex';
sizeDiv.style.alignItems = 'center';
sizeDiv.style.gap = '6px';
var sizeLabel = document.createElement('span');
sizeLabel.className = 'pm-page-info';
sizeLabel.textContent = 'Per page:';
sizeDiv.appendChild(sizeLabel);
var sizeSelect = document.createElement('select');
sizeSelect.className = 'pm-filter-select';
sizeSelect.style.padding = '4px 8px';
sizeSelect.style.fontSize = '13px';
[10, 25, 50].forEach(function(sz) {
var opt = document.createElement('option');
opt.value = sz;
opt.textContent = sz;
if (sz === pageSize) opt.selected = true;
sizeSelect.appendChild(opt);
});
sizeSelect.addEventListener('change', function() { onPageSizeChange(parseInt(sizeSelect.value)); });
sizeDiv.appendChild(sizeSelect);
container.appendChild(sizeDiv);
var btnsDiv = document.createElement('div');
btnsDiv.className = 'pm-page-btns';
var btnPrev = document.createElement('button');
btnPrev.className = 'pm-page-btn';
btnPrev.textContent = '\u25C0 Prev';
btnPrev.disabled = currentPage <= 1;
btnPrev.addEventListener('click', function() { onPageChange(currentPage - 1); });
btnsDiv.appendChild(btnPrev);
var maxVisible = 7;
var startPage = 1, endPage = totalPages;
if (totalPages > maxVisible) {
if (currentPage <= 4) { startPage = 1; endPage = maxVisible; }
else if (currentPage >= totalPages - 3) { startPage = totalPages - maxVisible + 1; endPage = totalPages; }
else { startPage = currentPage - 3; endPage = currentPage + 3; }
}
for (var p = startPage; p <= endPage; p++) {
var btn = document.createElement('button');
btn.className = 'pm-page-btn' + (p === currentPage ? ' active' : '');
btn.textContent = p;
btn.addEventListener('click', function(page) { return function() { onPageChange(page); }; }(p));
btnsDiv.appendChild(btn);
}
var btnNext = document.createElement('button');
btnNext.className = 'pm-page-btn';
btnNext.textContent = 'Next \u25B6';
btnNext.disabled = currentPage >= totalPages;
btnNext.addEventListener('click', function() { onPageChange(currentPage + 1); });
btnsDiv.appendChild(btnNext);
container.appendChild(btnsDiv);
}
function toggleProjectColPanel(e) {
e.stopPropagation();
var panel = document.getElementById('pmProjectColPanel');
panel.classList.toggle('active');
if (panel.classList.contains('active')) {
renderProjectColTogglePanel();
var rect = e.target.getBoundingClientRect();
panel.style.position = 'fixed';
panel.style.top = (rect.bottom + 4) + 'px';
panel.style.left = rect.left + 'px';
}
}
function renderProjectColTogglePanel() {
var container = document.getElementById('pmProjectColToggleItems');
container.textContent = '';
PROJECT_COL_DEFS.forEach(function(col) {
var item = document.createElement('label');
item.className = 'pm-col-toggle-item';
var cb = document.createElement('input');
cb.type = 'checkbox';
cb.checked = projectVisibleCols[col.key];
cb.addEventListener('change', function() {
projectVisibleCols[col.key] = cb.checked;
saveProjectVisibleCols();
renderProjectTableHead();
renderProjectTable();
});
item.appendChild(cb);
item.appendChild(document.createTextNode(col.label));
container.appendChild(item);
});
}
function toggleClientColPanel(e) {
e.stopPropagation();
var panel = document.getElementById('pmClientColPanel');
panel.classList.toggle('active');
if (panel.classList.contains('active')) {
renderClientColTogglePanel();
var rect = e.target.getBoundingClientRect();
panel.style.position = 'fixed';
panel.style.top = (rect.bottom + 4) + 'px';
panel.style.left = rect.left + 'px';
}
}
function renderClientColTogglePanel() {
var container = document.getElementById('pmClientColToggleItems');
container.textContent = '';
CLIENT_COL_DEFS.forEach(function(col) {
var item = document.createElement('label');
item.className = 'pm-col-toggle-item';
var cb = document.createElement('input');
cb.type = 'checkbox';
cb.checked = clientVisibleCols[col.key];
cb.addEventListener('change', function() {
clientVisibleCols[col.key] = cb.checked;
saveClientVisibleCols();
renderClientTableHead();
renderClientTable();
});
item.appendChild(cb);
item.appendChild(document.createTextNode(col.label));
container.appendChild(item);
});
}
async function addProject() {
var name = document.getElementById('pmProjectName').value.trim();
var code = document.getElementById('pmProjectCode').value.trim();
var status = document.getElementById('pmProjectStatus').value;
var street = document.getElementById('pmProjectStreet').value.trim();
var city = document.getElementById('pmProjectCity').value.trim();
var state = document.getElementById('pmProjectState').value.trim();
var zip = document.getElementById('pmProjectZip').value.trim();
var clientId = document.getElementById('pmProjectClient').value;
var projectManager = document.getElementById('pmProjectManager').value;
if (!name) { showProjectMessage('Please enter a project name.', 'error'); return; }
if (!street) { showProjectMessage('Please enter a street address.', 'error'); return; }
if (!city) { showProjectMessage('Please enter a city.', 'error'); return; }
if (!state) { showProjectMessage('Please enter a state.', 'error'); return; }
if (!status) { showProjectMessage('Please select a status.', 'error'); return; }
var payload = {
'Project Name': name,
'Project Number': code,
'Status': status,
'Street': street,
'City': city,
'State': state,
};
if (zip) payload['Zip'] = zip;
if (clientId) payload['Client'] = clientId;
if (projectManager) payload['Project Manager'] = projectManager;
var notes = document.getElementById('pmProjectNotes').value.trim();
if (notes) payload['Notes'] = notes;
var awd = document.getElementById('pmAwardDate').value;
var esd = document.getElementById('pmExpectedStartDate').value;
var asd = document.getElementById('pmActualStartDate').value;
var ecd = document.getElementById('pmExpectedCompletionDate').value;
var acd = document.getElementById('pmActualCompletionDate').value;
if (esd) payload['Expected Start Date'] = esd;
if (asd) payload['Actual Start Date'] = asd;
if (ecd) payload['Expected Completion Date'] = ecd;
if (acd) payload['Actual Completion Date'] = acd;
if (awd) payload['Award Date'] = awd;
try {
var resp = await fetch('/api/Project', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
var data = await resp.json();
if (!resp.ok) throw new Error(data.error || data.message || 'Save failed (' + resp.status + ')');
if (data.record) {
allProjects.push(normalizeProject(data.record));
} else {
await loadProjects();
}
document.getElementById('pmProjectName').value = '';
document.getElementById('pmProjectCode').value = '';
document.getElementById('pmProjectStreet').value = '';
document.getElementById('pmProjectCity').value = '';
document.getElementById('pmProjectState').value = '';
document.getElementById('pmProjectZip').value = '';
document.getElementById('pmProjectClient').value = '';
document.getElementById('pmProjectManager').value = '';
document.getElementById('pmProjectNotes').value = '';
document.getElementById('pmAwardDate').value = '';
document.getElementById('pmExpectedStartDate').value = '';
document.getElementById('pmActualStartDate').value = '';
document.getElementById('pmExpectedCompletionDate').value = '';
document.getElementById('pmActualCompletionDate').value = '';
document.getElementById('pmProjectStatus').value = 'Awarded';
showProjectMessage('Project "' + name + '" added.', 'success');
renderOverview();
switchTab('projects');
} catch(e) {
showProjectMessage('Failed to add project: ' + e.message, 'error');
if (window.DRIVENErrorHandler) {
window.DRIVENErrorHandler.report('project-management.html: addProject failed \u2014 ' + (e.message || e), 'addProject', e && e.stack ? e.stack : null);
}
}
}
function openEditProjectModal(projectId) {
var project = allProjects.find(function(p) { return p.id === projectId; });
if (!project) return;
editingProjectId = projectId;
document.getElementById('pmEditProjectName').value = project.name || '';
document.getElementById('pmEditProjectCode').value = project.code || '';
document.getElementById('pmEditProjectStatus').value = project.status || 'Awarded';
document.getElementById('pmEditProjectStreet').value = project.street || '';
document.getElementById('pmEditProjectCity').value = project.city || '';
document.getElementById('pmEditProjectState').value = project.state || '';
document.getElementById('pmEditProjectZip').value = project.zip || '';
var editClientSel = document.getElementById('pmEditProjectClient');
editClientSel.innerHTML = '<option value="">None</option>';
allClients.forEach(function(c) { var opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.clientName || '(unnamed)'; editClientSel.appendChild(opt); });
editClientSel.value = project.clientId || project.client || '';
document.getElementById('pmEditAwardDate').value = project.awardDate || '';
document.getElementById('pmEditExpectedStartDate').value = project.expectedStartDate || '';
document.getElementById('pmEditActualStartDate').value = project.actualStartDate || '';
document.getElementById('pmEditExpectedCompletionDate').value = project.expectedCompletionDate || '';
document.getElementById('pmEditActualCompletionDate').value = project.actualCompletionDate || '';
document.getElementById('pmEditProjectManager').value = project.projectManager || '';
document.getElementById("pmEditProjectNotes").value = project.notes || '';
document.getElementById('pmEditProjectModal').classList.add('active');
renderStatusHistory(projectId);
}
function closeEditProjectModal() {
document.getElementById('pmEditProjectModal').classList.remove('active');
editingProjectId = null;
}
async function saveEditProject() {
if (!editingProjectId) return;
var name = document.getElementById('pmEditProjectName').value.trim();
var code = document.getElementById('pmEditProjectCode').value.trim();
var status = document.getElementById('pmEditProjectStatus').value;
var street = document.getElementById('pmEditProjectStreet').value.trim();
var city = document.getElementById('pmEditProjectCity').value.trim();
var state = document.getElementById('pmEditProjectState').value.trim();
var zip = document.getElementById('pmEditProjectZip').value.trim();
var clientId = document.getElementById('pmEditProjectClient').value;
var projectManager = document.getElementById('pmEditProjectManager').value;
if (!name) { showProjectMessage('Project name is required.', 'error'); return; }
if (!street) { showProjectMessage('Street address is required.', 'error'); return; }
if (!city) { showProjectMessage('City is required.', 'error'); return; }
if (!state) { showProjectMessage('State is required.', 'error'); return; }
var payload = {
'Project Name': name,
'Project Number': code,
'Status': status,
'Street': street,
'City': city,
'State': state,
};
if (zip) payload['Zip'] = zip;
if (clientId) payload['Client'] = clientId;
if (projectManager) payload['Project Manager'] = projectManager;
var notes = document.getElementById('pmEditProjectNotes').value.trim();
if (notes) payload['Notes'] = notes;
var awd = document.getElementById('pmEditAwardDate');
var esd = document.getElementById('pmEditExpectedStartDate');
var asd = document.getElementById('pmEditActualStartDate');
var ecd = document.getElementById('pmEditExpectedCompletionDate');
var acd = document.getElementById('pmEditActualCompletionDate');
if (esd && esd.value) payload['Expected Start Date'] = esd.value;
if (asd && asd.value) payload['Actual Start Date'] = asd.value;
if (ecd && ecd.value) payload['Expected Completion Date'] = ecd.value;
if (acd && acd.value) payload['Actual Completion Date'] = acd.value;
if (awd && awd.value) payload['Award Date'] = awd.value;
try {
var shRows = pmStatusHistory[editingProjectId] || [];
if (shRows.length > 0) {
try {
await fetch('/api/ProjectStatusHistory?project_id=' + encodeURIComponent(editingProjectId), {
method: 'PUT',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ records: shRows })
});
} catch(e) {}
}
var resp = await fetch('/api/Project/' + encodeURIComponent(editingProjectId), {
method: 'PUT',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
var data = await resp.json();
if (!resp.ok) throw new Error(data.error || data.message || 'Update failed (' + resp.status + ')');
if (data.record) {
var updated = normalizeProject(data.record);
var idx = allProjects.findIndex(function(p) { return p.id === editingProjectId; });
if (idx !== -1) allProjects[idx] = updated;
} else {
var project = allProjects.find(function(p) { return p.id === editingProjectId; });
if (project) { project.name = name; project.code = code; project.status = status; project.street = street; project.city = city; project.state = state; project.zip = zip; project.projectManager = projectManager; project.notes = notes; }
}
showProjectMessage('Project "' + name + '" updated.', 'success');
closeEditProjectModal();
renderProjectTable();
renderOverview();
} catch(e) {
showProjectMessage('Failed to update project: ' + e.message, 'error');
if (window.DRIVENErrorHandler) {
window.DRIVENErrorHandler.report('project-management.html: saveEditProject failed \u2014 ' + (e.message || e), 'saveEditProject', e && e.stack ? e.stack : null);
}
}
}
async function deleteProject(projectId) {
var project = allProjects.find(function(p) { return p.id === projectId; });
if (!project) return;
if (!confirm('Delete project "' + (project.name || project.code) + '"? This cannot be undone.')) return;
try {
var resp = await fetch('/api/Project/' + encodeURIComponent(projectId), { method: 'DELETE' });
if (!resp.ok) {
var data = await resp.json();
throw new Error(data.error || data.message || 'Delete failed (' + resp.status + ')');
}
allProjects = allProjects.filter(function(p) { return p.id !== projectId; });
showProjectMessage('Project "' + (project.name || project.code) + '" deleted.', 'success');
renderProjectTable();
renderOverview();
} catch(e) {
showProjectMessage('Failed to delete project: ' + e.message, 'error');
if (window.DRIVENErrorHandler) {
window.DRIVENErrorHandler.report('project-management.html: deleteProject failed \u2014 ' + (e.message || e), 'deleteProject', e && e.stack ? e.stack : null);
}
}
}
async function addClient() {
var clientName = document.getElementById('pmClientName').value.trim();
var contactName = document.getElementById('pmContactName').value.trim();
var contactEmail = document.getElementById('pmContactEmail').value.trim();
var contactPhone = document.getElementById('pmContactPhone').value.trim();
var industry = document.getElementById('pmIndustry').value.trim();
var address = document.getElementById('pmAddress').value.trim();
var city = document.getElementById('pmCity').value.trim();
var state = document.getElementById('pmState').value.trim();
var zip = document.getElementById('pmZip').value.trim();
var status = document.getElementById('pmClientStatus').value;
var notes = document.getElementById('pmClientNotes').value.trim();
if (!clientName) { showClientMessage('Please enter a client name.', 'error'); return; }
if (!contactName) { showClientMessage('Please enter a contact name.', 'error'); return; }
if (!contactEmail) { showClientMessage('Please enter a contact email.', 'error'); return; }
var payload = {
'Client Name': clientName,
'Contact Name': contactName,
'Contact Email': contactEmail,
'Status': status,
};
if (contactPhone) payload['Contact Phone'] = contactPhone;
if (industry) payload['Industry'] = industry;
if (address) payload['Address'] = address;
if (city) payload['City'] = city;
if (state) payload['State'] = state;
if (zip) payload['Zip Code'] = zip;
if (notes) payload['Notes'] = notes;
try {
var resp = await fetch('/api/Clients', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
var data = await resp.json();
if (!resp.ok) throw new Error(data.error || data.message || 'Save failed (' + resp.status + ')');
if (data.record) {
allClients.push(normalizeClient(data.record));
} else {
await loadClients();
}
['pmClientName','pmContactName','pmContactEmail','pmContactPhone','pmIndustry','pmAddress','pmCity','pmState','pmZip','pmClientNotes'].forEach(function(id) {
document.getElementById(id).value = '';
});
document.getElementById('pmClientStatus').value = 'Active';
showClientMessage('Client "' + clientName + '" added.', 'success');
renderOverview();
switchTab('clients');
} catch(e) {
showClientMessage('Failed to add client: ' + e.message, 'error');
if (window.DRIVENErrorHandler) {
window.DRIVENErrorHandler.report('project-management.html: addClient failed \u2014 ' + (e.message || e), 'addClient', e && e.stack ? e.stack : null);
}
}
}
function openEditClientModal(clientId) {
var client = allClients.find(function(c) { return c.id === clientId; });
if (!client) return;
editingClientId = clientId;
document.getElementById('pmEditClientName').value = client.clientName || '';
document.getElementById('pmEditContactName').value = client.contactName || '';
document.getElementById('pmEditContactEmail').value = client.contactEmail || '';
document.getElementById('pmEditContactPhone').value = client.contactPhone || '';
document.getElementById('pmEditIndustry').value = client.industry || '';
document.getElementById('pmEditAddress').value = client.address || '';
document.getElementById('pmEditCity').value = client.city || '';
document.getElementById('pmEditState').value = client.state || '';
document.getElementById('pmEditZip').value = client.zip || '';
document.getElementById('pmEditClientStatus').value = client.status || 'Active';
document.getElementById('pmEditClientNotes').value = client.notes || '';
document.getElementById('pmEditClientModal').classList.add('active');
}
function closeEditClientModal() {
document.getElementById('pmEditClientModal').classList.remove('active');
editingClientId = null;
}
async function saveEditClient() {
if (!editingClientId) return;
var clientName = document.getElementById('pmEditClientName').value.trim();
var contactName = document.getElementById('pmEditContactName').value.trim();
var contactEmail = document.getElementById('pmEditContactEmail').value.trim();
var contactPhone = document.getElementById('pmEditContactPhone').value.trim();
var industry = document.getElementById('pmEditIndustry').value.trim();
var address = document.getElementById('pmEditAddress').value.trim();
var city = document.getElementById('pmEditCity').value.trim();
var state = document.getElementById('pmEditState').value.trim();
var zip = document.getElementById('pmEditZip').value.trim();
var status = document.getElementById('pmEditClientStatus').value;
var notes = document.getElementById('pmEditClientNotes').value.trim();
if (!clientName) { showClientMessage('Client name is required.', 'error'); return; }
if (!contactName) { showClientMessage('Contact name is required.', 'error'); return; }
if (!contactEmail) { showClientMessage('Contact email is required.', 'error'); return; }
var payload = {
'Client Name': clientName,
'Contact Name': contactName,
'Contact Email': contactEmail,
'Status': status,
};
if (contactPhone) payload['Contact Phone'] = contactPhone;
if (industry) payload['Industry'] = industry;
if (address) payload['Address'] = address;
if (city) payload['City'] = city;
if (state) payload['State'] = state;
if (zip) payload['Zip Code'] = zip;
if (notes) payload['Notes'] = notes;
try {
var resp = await fetch('/api/Clients/' + encodeURIComponent(editingClientId), {
method: 'PUT',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
var data = await resp.json();
if (!resp.ok) throw new Error(data.error || data.message || 'Update failed (' + resp.status + ')');
if (data.record) {
var updated = normalizeClient(data.record);
var idx = allClients.findIndex(function(c) { return c.id === editingClientId; });
if (idx !== -1) allClients[idx] = updated;
}
showClientMessage('Client "' + clientName + '" updated.', 'success');
closeEditClientModal();
renderClientTable();
renderOverview();
} catch(e) {
showClientMessage('Failed to update client: ' + e.message, 'error');
if (window.DRIVENErrorHandler) {
window.DRIVENErrorHandler.report('project-management.html: saveEditClient failed \u2014 ' + (e.message || e), 'saveEditClient', e && e.stack ? e.stack : null);
}
}
}
async function deleteClient(clientId) {
var client = allClients.find(function(c) { return c.id === clientId; });
if (!client) return;
if (!confirm('Delete client "' + (client.clientName || '') + '"? This cannot be undone.')) return;
try {
var resp = await fetch('/api/Clients/' + encodeURIComponent(clientId), { method: 'DELETE' });
if (!resp.ok) {
var data = await resp.json();
throw new Error(data.error || data.message || 'Delete failed (' + resp.status + ')');
}
allClients = allClients.filter(function(c) { return c.id !== clientId; });
showClientMessage('Client "' + (client.clientName || '') + '" deleted.', 'success');
renderClientTable();
renderOverview();
} catch(e) {
showClientMessage('Failed to delete client: ' + e.message, 'error');
if (window.DRIVENErrorHandler) {
window.DRIVENErrorHandler.report('project-management.html: deleteClient failed \u2014 ' + (e.message || e), 'deleteClient', e && e.stack ? e.stack : null);
}
}
}
function renderProjectTypes() {
var tbody = document.getElementById('pmTypeTableBody');
tbody.textContent = '';
document.getElementById('pmTypeCount').textContent = projectTypes.length + ' type' + (projectTypes.length === 1 ? '' : 's');
if (projectTypes.length === 0) {
tbody.innerHTML = '<tr><td class="pm-empty">No project types defined yet. Add one above.</td></tr>';
document.getElementById('pmTypePagination').textContent = '';
return;
}
var totalPages = Math.max(1, Math.ceil(projectTypes.length / typePageSize));
if (typePage > totalPages) typePage = 1;
var pageStart = (typePage - 1) * typePageSize;
var pageItems = projectTypes.slice(pageStart, pageStart + typePageSize);
pageItems.forEach(function(t, idx) {
var actualIdx = pageStart + idx;
var tr = document.createElement('tr');
tr.innerHTML = '<td style="font-weight:600;">' + escapeHtml(t.name || '') + '</td><td>' + escapeHtml(t.description || '\u2014') + '</td>';
if (canModify) {
var actionsTd = document.createElement('td');
actionsTd.className = 'pm-actions';
var btnEdit = document.createElement('button');
btnEdit.className = 'pm-table-btn';
btnEdit.textContent = 'Edit';
btnEdit.addEventListener('click', function() { openEditTypeModal(actualIdx); });
actionsTd.appendChild(btnEdit);
tr.appendChild(actionsTd);
}
tbody.appendChild(tr);
});
renderPagination('pmTypePagination', projectTypes.length, totalPages, typePage, typePageSize, function(p) { typePage = p; renderProjectTypes(); }, function(sz) { typePageSize = sz; typePage = 1; renderProjectTypes(); });
makeColumnsResizable(document.getElementById('pmTypeTable'), 'pmColW_types', [160, 400, 100]);
makeColumnsDraggable(document.getElementById('pmTypeTable'), 'pmColOrder_types');
if (typeof initVoice === 'function') initVoice();
}
async function addProjectType() {
var name = document.getElementById('pmTypeName').value.trim();
var desc = document.getElementById('pmTypeDesc').value.trim();
if (!name) { showTypeMessage('Please enter a type name.', 'error'); return; }
var dup = projectTypes.find(function(t) { return t.name && t.name.toLowerCase() === name.toLowerCase(); });
if (dup) { showTypeMessage('A project type with name "' + name + '" already exists.', 'error'); return; }
projectTypes.push({ name: name, description: desc });
await saveProjectTypes();
document.getElementById('pmTypeName').value = '';
document.getElementById('pmTypeDesc').value = '';
showTypeMessage('Project type "' + name + '" added.', 'success');
renderProjectTypes();
}
function openEditTypeModal(idx) {
editingTypeIndex = idx;
var t = projectTypes[idx];
document.getElementById('pmEditTypeName').value = t.name || '';
document.getElementById('pmEditTypeDesc').value = t.description || '';
document.getElementById('pmEditTypeModal').classList.add('active');
}
function closeEditTypeModal() {
document.getElementById('pmEditTypeModal').classList.remove('active');
editingTypeIndex = null;
}
async function saveEditProjectType() {
if (editingTypeIndex === null) return;
var name = document.getElementById('pmEditTypeName').value.trim();
var desc = document.getElementById('pmEditTypeDesc').value.trim();
if (!name) { showTypeMessage('Type name is required.', 'error'); return; }
var dup = projectTypes.find(function(t, i) { return i !== editingTypeIndex && t.name && t.name.toLowerCase() === name.toLowerCase(); });
if (dup) { showTypeMessage('A project type with name "' + name + '" already exists.', 'error'); return; }
projectTypes[editingTypeIndex] = { name: name, description: desc };
await saveProjectTypes();
showTypeMessage('Project type "' + name + '" updated.', 'success');
closeEditTypeModal();
renderProjectTypes();
}
async function deleteProjectType(idx) {
var t = projectTypes[idx];
if (!t) return;
if (!confirm('Delete project type "' + (t.name || '') + '"?')) return;
projectTypes.splice(idx, 1);
await saveProjectTypes();
showTypeMessage('Project type "' + (t.name || '') + '" deleted.', 'success');
renderProjectTypes();
}
function openProjectPrintModal() {
var container = document.getElementById('pmProjectPrintCols');
container.textContent = '';
PROJECT_COL_DEFS.forEach(function(col) {
var item = document.createElement('label');
item.className = 'pm-check-item';
var cb = document.createElement('input');
cb.type = 'checkbox';
cb.checked = projectVisibleCols[col.key];
cb.dataset.key = col.key;
item.appendChild(cb);
item.appendChild(document.createTextNode(col.label));
container.appendChild(item);
});
document.getElementById('pmProjectPrintModal').classList.add('active');
}
function doProjectPrint() {
var checkboxes = document.querySelectorAll('#pmProjectPrintCols input[type="checkbox"]');
var selectedCols = [];
checkboxes.forEach(function(cb) {
if (cb.checked) {
var col = PROJECT_COL_DEFS.find(function(c) { return c.key === cb.dataset.key; });
if (col) selectedCols.push(col);
}
});
if (selectedCols.length === 0) { showProjectMessage('Select at least one column to print.', 'error'); return; }
var filtered = getFilteredSortedProjects();
var dateKeys = ['createdAt','expectedStartDate','actualStartDate','expectedCompletionDate','actualCompletionDate','awardDate'];
var html = '<html><head><title>DRIV-EN Project List</title><style>';
html += 'body{font-family:Arial,sans-serif;margin:20px;}h2{margin:0 0 16px 0;}table{width:100%;border-collapse:collapse;font-size:12px;}';
html += 'th{background:#e2e8f0;padding:8px 10px;text-align:left;border:1px solid #94a3b8;}td{padding:6px 10px;border:1px solid #cbd5e1;}';
html += '.print-date{font-size:12px;color:#64748b;margin-bottom:12px;}</style></head><body>';
html += '<h2>DRIV-EN Project List</h2>';
html += '<div class="print-date">Generated: ' + new Date().toLocaleString() + ' | Total: ' + filtered.length + ' projects</div>';
html += '<table><thead><tr>';
selectedCols.forEach(function(col) { html += '<th>' + escapeHtml(col.label) + '</th>'; });
html += '</tr></thead><tbody>';
filtered.forEach(function(p) {
html += '<tr>';
selectedCols.forEach(function(col) {
var val = p[col.key];
if (val && dateKeys.indexOf(col.key) !== -1) { val = new Date(val).toLocaleDateString(); }
html += '<td>' + escapeHtml((val !== undefined && val !== null && val !== '') ? String(val) : '\u2014') + '</td>';
});
html += '</tr>';
});
html += '</tbody></table></body></html>';
var printWin = window.open('', '_blank');
printWin.document.write(html);
printWin.document.close();
printWin.focus();
setTimeout(function() { printWin.print(); }, 300);
closeModal('pmProjectPrintModal');
}
function openProjectExportModal(format) {
projectExportFormat = format || 'csv';
var container = document.getElementById('pmProjectExportCols');
container.textContent = '';
PROJECT_COL_DEFS.forEach(function(col) {
var item = document.createElement('label');
item.className = 'pm-check-item';
var cb = document.createElement('input');
cb.type = 'checkbox';
cb.checked = projectVisibleCols[col.key];
cb.dataset.key = col.key;
item.appendChild(cb);
item.appendChild(document.createTextNode(col.label));
container.appendChild(item);
});
if (projectExportFormat === 'excel') {
document.getElementById('pmProjectExportTitle').textContent = 'Export to Excel';
document.getElementById('pmProjectExportBtn').textContent = 'Download Excel';
} else {
document.getElementById('pmProjectExportTitle').textContent = 'Export to CSV';
document.getElementById('pmProjectExportBtn').textContent = 'Download CSV';
}
document.getElementById('pmProjectExportModal').classList.add('active');
}
function doProjectExport() {
var checkboxes = document.querySelectorAll('#pmProjectExportCols input[type="checkbox"]');
var selectedCols = [];
checkboxes.forEach(function(cb) {
if (cb.checked) {
var col = PROJECT_COL_DEFS.find(function(c) { return c.key === cb.dataset.key; });
if (col) selectedCols.push(col);
}
});
if (selectedCols.length === 0) { showProjectMessage('Select at least one column to export.', 'error'); return; }
var filtered = getFilteredSortedProjects();
var dateStr = new Date().toISOString().slice(0, 10);
var label = projectExportFormat === 'excel' ? 'Excel' : 'CSV';
if (projectExportFormat === 'excel') {
var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
html += '<head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';
selectedCols.forEach(function(col) { html += '<th style="background:#e2e8f0;font-weight:bold;">' + escapeHtml(col.label) + '</th>'; });
html += '</tr></thead><tbody>';
filtered.forEach(function(p) {
html += '<tr>';
selectedCols.forEach(function(col) {
var val = p[col.key];
html += '<td>' + escapeHtml((val !== undefined && val !== null && val !== '') ? String(val) : '') + '</td>';
});
html += '</tr>';
});
html += '</tbody></table></body></html>';
var blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
var url = URL.createObjectURL(blob);
var link = document.createElement('a');
link.href = url;
link.download = 'driv-en-projects-' + dateStr + '.xls';
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
URL.revokeObjectURL(url);
} else {
var csv = selectedCols.map(function(c) { return csvEscape(c.label); }).join(',') + '\n';
filtered.forEach(function(p) {
var row = selectedCols.map(function(col) {
var val = p[col.key];
return csvEscape((val !== undefined && val !== null && val !== '') ? String(val) : '');
});
csv += row.join(',') + '\n';
});
var blob2 = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
var url2 = URL.createObjectURL(blob2);
var link2 = document.createElement('a');
link2.href = url2;
link2.download = 'driv-en-projects-' + dateStr + '.csv';
document.body.appendChild(link2);
link2.click();
document.body.removeChild(link2);
URL.revokeObjectURL(url2);
}
closeModal('pmProjectExportModal');
showProjectMessage('Exported ' + filtered.length + ' projects to ' + label + '.', 'success');
}
function getFilteredSortedProjects() {
var search = document.getElementById('pmProjectSearch').value.toLowerCase().trim();
var filterStatus = document.getElementById('pmProjectFilterStatus').value;
var filtered = allProjects.filter(function(p) {
var matchesSearch = !search ||
(p.name && p.name.toLowerCase().indexOf(search) !== -1) ||
(p.code && p.code.toLowerCase().indexOf(search) !== -1) ||
(p.street && p.street.toLowerCase().indexOf(search) !== -1) ||
(p.city && p.city.toLowerCase().indexOf(search) !== -1);
var matchesStatus = !filterStatus || (p.status && p.status.toLowerCase() === filterStatus.toLowerCase());
return matchesSearch && matchesStatus;
});
filtered.sort(function(a, b) {
var va = String(a[projectSortKey] || '').toLowerCase();
var vb = String(b[projectSortKey] || '').toLowerCase();
if (va < vb) return projectSortDir === 'asc' ? -1 : 1;
if (va > vb) return projectSortDir === 'asc' ? 1 : -1;
return 0;
});
return filtered;
}
function openClientPrintModal() {
var container = document.getElementById('pmClientPrintCols');
container.textContent = '';
CLIENT_COL_DEFS.forEach(function(col) {
var item = document.createElement('label');
item.className = 'pm-check-item';
var cb = document.createElement('input');
cb.type = 'checkbox';
cb.checked = clientVisibleCols[col.key];
cb.dataset.key = col.key;
item.appendChild(cb);
item.appendChild(document.createTextNode(col.label));
container.appendChild(item);
});
document.getElementById('pmClientPrintModal').classList.add('active');
}
function doClientPrint() {
var checkboxes = document.querySelectorAll('#pmClientPrintCols input[type="checkbox"]');
var selectedCols = [];
checkboxes.forEach(function(cb) {
if (cb.checked) {
var col = CLIENT_COL_DEFS.find(function(c) { return c.key === cb.dataset.key; });
if (col) selectedCols.push(col);
}
});
if (selectedCols.length === 0) { showClientMessage('Select at least one column to print.', 'error'); return; }
var dateKeys = ['createdAt','expectedStartDate','actualStartDate','expectedCompletionDate','actualCompletionDate','awardDate'];
var filtered = getFilteredSortedClients();
var html = '<html><head><title>DRIV-EN Client List</title><style>';
html += 'body{font-family:Arial,sans-serif;margin:20px;}h2{margin:0 0 16px 0;}table{width:100%;border-collapse:collapse;font-size:12px;}';
html += 'th{background:#e2e8f0;padding:8px 10px;text-align:left;border:1px solid #94a3b8;}td{padding:6px 10px;border:1px solid #cbd5e1;}';
html += '.print-date{font-size:12px;color:#64748b;margin-bottom:12px;}</style></head><body>';
html += '<h2>DRIV-EN Client List</h2>';
html += '<div class="print-date">Generated: ' + new Date().toLocaleString() + ' | Total: ' + filtered.length + ' clients</div>';
html += '<table><thead><tr>';
selectedCols.forEach(function(col) { html += '<th>' + escapeHtml(col.label) + '</th>'; });
html += '</tr></thead><tbody>';
filtered.forEach(function(c) {
html += '<tr>';
selectedCols.forEach(function(col) {
var val = c[col.key];
if (val && dateKeys.indexOf(col.key) !== -1) { val = new Date(val).toLocaleDateString(); }
html += '<td>' + escapeHtml((val !== undefined && val !== null && val !== '') ? String(val) : '\u2014') + '</td>';
});
html += '</tr>';
});
html += '</tbody></table></body></html>';
var printWin = window.open('', '_blank');
printWin.document.write(html);
printWin.document.close();
printWin.focus();
setTimeout(function() { printWin.print(); }, 300);
closeModal('pmClientPrintModal');
}
function openClientExportModal(format) {
clientExportFormat = format || 'csv';
var container = document.getElementById('pmClientExportCols');
container.textContent = '';
CLIENT_COL_DEFS.forEach(function(col) {
var item = document.createElement('label');
item.className = 'pm-check-item';
var cb = document.createElement('input');
cb.type = 'checkbox';
cb.checked = clientVisibleCols[col.key];
cb.dataset.key = col.key;
item.appendChild(cb);
item.appendChild(document.createTextNode(col.label));
container.appendChild(item);
});
if (clientExportFormat === 'excel') {
document.getElementById('pmClientExportTitle').textContent = 'Export to Excel';
document.getElementById('pmClientExportBtn').textContent = 'Download Excel';
} else {
document.getElementById('pmClientExportTitle').textContent = 'Export to CSV';
document.getElementById('pmClientExportBtn').textContent = 'Download CSV';
}
document.getElementById('pmClientExportModal').classList.add('active');
}
function doClientExport() {
var checkboxes = document.querySelectorAll('#pmClientExportCols input[type="checkbox"]');
var selectedCols = [];
checkboxes.forEach(function(cb) {
if (cb.checked) {
var col = CLIENT_COL_DEFS.find(function(c) { return c.key === cb.dataset.key; });
if (col) selectedCols.push(col);
}
});
if (selectedCols.length === 0) { showClientMessage('Select at least one column to export.', 'error'); return; }
var filtered = getFilteredSortedClients();
var dateStr = new Date().toISOString().slice(0, 10);
var label = clientExportFormat === 'excel' ? 'Excel' : 'CSV';
if (clientExportFormat === 'excel') {
var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
html += '<head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';
selectedCols.forEach(function(col) { html += '<th style="background:#e2e8f0;font-weight:bold;">' + escapeHtml(col.label) + '</th>'; });
html += '</tr></thead><tbody>';
filtered.forEach(function(c) {
html += '<tr>';
selectedCols.forEach(function(col) {
var val = c[col.key];
html += '<td>' + escapeHtml((val !== undefined && val !== null && val !== '') ? String(val) : '') + '</td>';
});
html += '</tr>';
});
html += '</tbody></table></body></html>';
var blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
var url = URL.createObjectURL(blob);
var link = document.createElement('a');
link.href = url;
link.download = 'driv-en-clients-' + dateStr + '.xls';
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
URL.revokeObjectURL(url);
} else {
var csv = selectedCols.map(function(c) { return csvEscape(c.label); }).join(',') + '\n';
filtered.forEach(function(c) {
var row = selectedCols.map(function(col) {
var val = c[col.key];
return csvEscape((val !== undefined && val !== null && val !== '') ? String(val) : '');
});
csv += row.join(',') + '\n';
});
var blob2 = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
var url2 = URL.createObjectURL(blob2);
var link2 = document.createElement('a');
link2.href = url2;
link2.download = 'driv-en-clients-' + dateStr + '.csv';
document.body.appendChild(link2);
link2.click();
document.body.removeChild(link2);
URL.revokeObjectURL(url2);
}
closeModal('pmClientExportModal');
showClientMessage('Exported ' + filtered.length + ' clients to ' + label + '.', 'success');
}
function getFilteredSortedClients() {
var search = document.getElementById('pmClientSearch').value.toLowerCase().trim();
var filterStatus = document.getElementById('pmClientFilterStatus').value;
var filtered = allClients.filter(function(c) {
var matchesSearch = !search ||
(c.clientName && c.clientName.toLowerCase().indexOf(search) !== -1) ||
(c.contactName && c.contactName.toLowerCase().indexOf(search) !== -1) ||
(c.contactEmail && c.contactEmail.toLowerCase().indexOf(search) !== -1);
var matchesStatus = !filterStatus || (c.status && c.status.toLowerCase() === filterStatus.toLowerCase());
return matchesSearch && matchesStatus;
});
filtered.sort(function(a, b) {
var va = String(a[clientSortKey] || '').toLowerCase();
var vb = String(b[clientSortKey] || '').toLowerCase();
if (va < vb) return clientSortDir === 'asc' ? -1 : 1;
if (va > vb) return clientSortDir === 'asc' ? 1 : -1;
return 0;
});
return filtered;
}
function escapeHtml(str) {
var div = document.createElement('div');
div.textContent = str;
return div.innerHTML;
}
function csvEscape(val) {
if (val === null || val === undefined) return '';
var s = String(val);
if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
return '"' + s.replace(/"/g, '""') + '"';
}
return s;
}
function closeModal(modalId) {
document.getElementById(modalId).classList.remove('active');
}
function showProjectMessage(msg, type) {
var el = document.getElementById('pmProjectsMessage');
if (!el) el = document.getElementById('pmAddProjectMessage');
el.textContent = msg;
el.className = 'pm-message ' + type;
el.style.display = 'block';
setTimeout(function() { el.style.display = 'none'; }, 5000);
}
function showClientMessage(msg, type) {
var el = document.getElementById('pmClientsMessage');
if (!el) el = document.getElementById('pmAddClientMessage');
el.textContent = msg;
el.className = 'pm-message ' + type;
el.style.display = 'block';
setTimeout(function() { el.style.display = 'none'; }, 5000);
}
function showTypeMessage(msg, type) {
var el = document.getElementById('pmTypesMessage');
el.textContent = msg;
el.className = 'pm-message ' + type;
el.style.display = 'block';
setTimeout(function() { el.style.display = 'none'; }, 5000);
}
function switchTab(tab) {
document.querySelectorAll('.pm-tab').forEach(function(t) { t.classList.remove('active'); });
document.querySelectorAll('.pm-tab-content').forEach(function(c) { c.style.display = 'none'; });
document.querySelector('.pm-tab[data-tab="' + tab + '"]').classList.add('active');
document.getElementById('tab-' + tab).style.display = 'block';
var yf = document.querySelector('.pm-pill-bar .pm-year-filter-bar');
if (yf) yf.style.display = (tab === 'overview') ? '' : 'none';
if (tab === 'overview') renderOverview();
if (tab === 'overview') {
makeColumnsResizable(document.getElementById('pmOverviewProjectsTable'), 'pmColW_ovProjects', [120, 240, 200, 100]);
makeColumnsDraggable(document.getElementById('pmOverviewProjectsTable'), 'pmColOrder_ovProjects');
makeColumnsResizable(document.getElementById('pmOverviewClientsTable'), 'pmColW_ovClients', [200, 160, 100]);
makeColumnsDraggable(document.getElementById('pmOverviewClientsTable'), 'pmColOrder_ovClients');
}
if (tab === 'projects') {
renderProjectTableHead();
renderProjectTable();
var pColW = PROJECT_COL_DEFS.filter(function(c) { return c.defaultVisible; }).map(function(c) { return c.width || 120; });
pColW.push(80);
makeColumnsResizable(document.getElementById('pmProjectTable'), 'pmColW_projects', pColW);
makeColumnsDraggable(document.getElementById('pmProjectTable'), 'pmColOrder_projects');
}
if (tab === 'clients') {
renderClientTableHead();
renderClientTable();
var cColW = CLIENT_COL_DEFS.filter(function(c) { return c.defaultVisible; }).map(function(c) { return c.width || 120; });
cColW.push(80);
makeColumnsResizable(document.getElementById('pmClientTable'), 'pmColW_clients', cColW);
makeColumnsDraggable(document.getElementById('pmClientTable'), 'pmColOrder_clients');
}
if (tab === 'types') {
renderProjectTypes();
makeColumnsResizable(document.getElementById('pmTypeTable'), 'pmColW_types', [160, 400, 100]);
makeColumnsDraggable(document.getElementById('pmTypeTable'), 'pmColOrder_types');
}
if (typeof initVoice === 'function') initVoice();
}
function goToMainDashboard() {
if (pmDirty) {
if (!confirm('You have unsaved changes. Click OK to leave without saving, or Cancel to stay.')) return;
}
var savedOrigin = sessionStorage.getItem('driven_dashboard_origin');
if (savedOrigin) { window.location.href = savedOrigin; return; }
if (document.referrer && document.referrer.indexOf('driv-en.com') !== -1) {
window.location.href = document.referrer; return;
}
var user = window.dashUser;
if (user) {
var role = (user.role || '').toLowerCase();
var rid = (user.role_id || '').toLowerCase();
if (role === 'driv-en founder' || role === 'owner' || rid === 'ro-founder') {
window.location.href = '/app/dashboard/owner-dashboard.html'; return;
} else if (role === 'admin' || rid === 'ro-admin') {
window.location.href = '/app/dashboard/admin.html'; return;
} else {
window.location.href = '/app/dashboard/employee-dashboard.html'; return;
}
}
window.location.href = '/app/dashboard/admin.html';
}
function confirmLogout() {
if (pmDirty) {
if (!confirm('You have unsaved changes. Click OK to log out without saving, or Cancel to stay.')) return;
}
if (typeof dashLogout === 'function') dashLogout();
}
var STATUS_COLORS = { 'awarded': '#3b82f6', 'in progress': '#16a34a', 'on hold': '#f59e0b', 'completed': '#6366f1', 'cancelled': '#ef4444' };
var STATUS_ORDER = ['awarded', 'in progress', 'on hold', 'completed', 'cancelled'];
function renderStatusDonut(projArr) {
var donut = document.getElementById('pmStatusDonut');
var legend = document.getElementById('pmStatusLegend');
if (!donut || !legend) return;
var sub = document.getElementById('pmDonutSubtitle');
if (sub) sub.textContent = pmYearFilter ? 'for ' + pmYearFilter : 'for all years';
var projs = projArr || allProjects;
var counts = {};
STATUS_ORDER.forEach(function(s) { counts[s] = 0; });
projs.forEach(function(p) {
var key = String(p.status || '').toLowerCase();
if (counts[key] !== undefined) counts[key]++;
});
var total = projs.length || 1;
var stops = [];
var cum = 0;
STATUS_ORDER.forEach(function(s) {
var pct = counts[s] / total;
if (pct > 0) stops.push(STATUS_COLORS[s] + ' ' + (cum * 360).toFixed(1) + 'deg ' + ((cum + pct) * 360).toFixed(1) + 'deg');
cum += pct;
});
if (stops.length === 0) stops.push('#e2e8f0 0deg 360deg');
donut.style.background = 'conic-gradient(' + stops.join(', ') + ')';
donut.style.position = 'relative';
donut.innerHTML = '<div style="position:absolute;width:90px;height:90px;border-radius:50%;background:var(--bg-card,#fff);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:var(--text);top:25px;left:25px;">' + total + '</div>';
legend.textContent = '';
STATUS_ORDER.forEach(function(s) {
var item = document.createElement('div');
item.className = 'pm-donut-legend-item';
item.innerHTML = '<div class="pm-donut-legend-dot" style="background:' + STATUS_COLORS[s] + '"></div><span>' + escapeHtml(statusLabel(s)) + ': ' + counts[s] + '</span>';
legend.appendChild(item);
});
}
var pmTrendPage = 1;
var pmTrendPageSize = 10;
var pmGanttWindow = 'all'; /* 'all' | '12' | '24' | '36' (months) */
var pmGanttOffset = 0; /* slider offset in months from chartStart */
function pmSavePrefs() {
try {
localStorage.setItem('pm_prefs', JSON.stringify({
year: pmYearFilter || '',
window: pmGanttWindow || 'all',
offset: pmGanttOffset || 0,
pageSize: pmTrendPageSize || 10,
page: pmTrendPage || 1
}));
} catch(e) {}
}
function pmLoadPrefs() {
try {
var raw = localStorage.getItem('pm_prefs');
if (!raw) return;
var prefs = JSON.parse(raw);
if (prefs.year !== undefined) pmYearFilter = prefs.year;
if (prefs.window !== undefined) pmGanttWindow = prefs.window;
if (prefs.offset !== undefined) pmGanttOffset = prefs.offset;
if (prefs.pageSize !== undefined) pmTrendPageSize = prefs.pageSize;
if (prefs.page !== undefined) pmTrendPage = prefs.page;
} catch(e) {}
}
function getEarliestDate(p) {
var dates = [p.awardDate, p.expectedStartDate, p.actualStartDate, p.expectedCompletionDate, p.actualCompletionDate].filter(function(d) { return d; });
if (dates.length === 0) return p.createdAt ? new Date(p.createdAt) : null;
return new Date(Math.min.apply(null, dates.map(function(d) { return new Date(d).getTime(); })));
}
function getLatestDate(p) {
var dates = [p.awardDate, p.expectedStartDate, p.actualStartDate, p.expectedCompletionDate, p.actualCompletionDate].filter(function(d) { return d; });
if (dates.length === 0) return p.createdAt ? new Date(p.createdAt) : null;
return new Date(Math.max.apply(null, dates.map(function(d) { return new Date(d).getTime(); })));
}
function getChartRange(projs) {
var year = pmYearFilter ? parseInt(pmYearFilter) : null;
var minD = null, maxD = null;
projs.forEach(function(p) {
var e = getEarliestDate(p), l = getLatestDate(p);
if (e && (!minD || e < minD)) minD = e;
if (l && (!maxD || l > maxD)) maxD = l;
});
if (year) {
return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
}
if (!minD || !maxD) {
var now = new Date();
return { start: new Date(now.getFullYear(), now.getMonth() - 11, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}
var padStart = new Date(minD.getFullYear(), minD.getMonth() - 1, 1);
var padEnd = new Date(maxD.getFullYear(), maxD.getMonth() + 2, 1);
return { start: padStart, end: padEnd };
}
function renderTrendChart(projArr) {
var projs = projArr || allProjects;
var container = document.getElementById('pmTrendChart');
if (!container) return;
container.textContent = '';
var year = pmYearFilter ? parseInt(pmYearFilter) : null;
var fullRange = getChartRange(projs);
var chartStart = fullRange.start, chartEnd = fullRange.end;
if (!year && pmGanttWindow !== 'all') {
var winMonths = parseInt(pmGanttWindow) || 12;
var totalMonths = Math.round((chartEnd - chartStart) / (30.44 * 24 * 3600 * 1000));
var maxOffset = Math.max(0, totalMonths - winMonths);
var slider = document.getElementById('pmGanttSlider');
if (slider) {
slider.max = maxOffset;
slider.value = Math.min(pmGanttOffset, maxOffset);
pmGanttOffset = parseInt(slider.value) || 0;
}
chartStart = new Date(chartStart.getFullYear(), chartStart.getMonth() + pmGanttOffset, 1);
chartEnd = new Date(chartStart.getFullYear(), chartStart.getMonth() + winMonths, 1);
}
var rangeMs = chartEnd - chartStart;
var projects = projs.filter(function(p) {
var e = getEarliestDate(p), l = getLatestDate(p);
if (!e || !l) return false;
return e <= chartEnd && l >= chartStart;
}).sort(function(a, b) {
return getEarliestDate(a) - getEarliestDate(b);
});
var countEl = document.getElementById('pmTrendCount');
if (countEl) countEl.textContent = projects.length;
if (projects.length === 0) {
container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;">No projects with dates in this period.</div>';
var pagEl = document.getElementById('pmTrendPagination');
if (pagEl) pagEl.textContent = '';
return;
}
var rowH = 28;
var labelW = 160;
var months = [];
var totalMonthsRange = Math.round((chartEnd - chartStart) / (30.44 * 24 * 3600 * 1000)) + 1;
for (var m = 0; m < totalMonthsRange; m++) {
var d = new Date(chartStart.getFullYear(), chartStart.getMonth() + m, 1);
if (d >= chartEnd) break;
months.push({ label: d.toLocaleDateString('en', { month: 'short' }), start: d });
}
var totalPages = Math.max(1, Math.ceil(projects.length / pmTrendPageSize));
if (pmTrendPage > totalPages) pmTrendPage = totalPages;
var pageStart = (pmTrendPage - 1) * pmTrendPageSize;
var pageProjects = projects.slice(pageStart, pageStart + pmTrendPageSize);
var html = '<div class="pm-gantt-wrap"><div class="pm-gantt-inner">';
html += '<div class="pm-gantt-header">';
html += '<div class="pm-gantt-header-label">Project</div>';
html += '<div class="pm-gantt-track" style="height:24px;">';
months.forEach(function(mo) {
var pct = (mo.start - chartStart) / rangeMs * 100;
html += '<div class="pm-gantt-month" style="left:' + pct + '%;">' + mo.label + '</div>';
});
html += '</div></div>';
pageProjects.forEach(function(p) {
var e = getEarliestDate(p), l = getLatestDate(p);
var color = STATUS_COLORS[String(p.status || '').toLowerCase()] || '#94a3b8';
html += '<div class="pm-gantt-row" style="height:' + rowH + 'px;">';
html += '<div class="pm-gantt-label" title="' + escapeHtml(p.name || '') + '">' + escapeHtml(p.code || '') + ' ' + escapeHtml(p.name || '') + '</div>';
html += '<div class="pm-gantt-track" style="height:' + rowH + 'px;">';
/* Award marker */
if (p.awardDate) {
var awardPct = (new Date(p.awardDate) - chartStart) / rangeMs * 100;
if (awardPct >= 0 && awardPct <= 100) html += '<div class="pm-gantt-marker" style="left:' + awardPct + '%;background:#f59e0b;" title="Award: ' + p.awardDate + '"></div>';
}
/* Start marker */
if (p.actualStartDate) {
var startPct = (new Date(p.actualStartDate) - chartStart) / rangeMs * 100;
if (startPct >= 0 && startPct <= 100) html += '<div class="pm-gantt-marker" style="left:' + startPct + '%;background:#16a34a;" title="Start: ' + p.actualStartDate + '"></div>';
}
/* Completion marker */
if (p.actualCompletionDate) {
var compPct = (new Date(p.actualCompletionDate) - chartStart) / rangeMs * 100;
if (compPct >= 0 && compPct <= 100) html += '<div class="pm-gantt-marker" style="left:' + compPct + '%;background:#6366f1;" title="Completion: ' + p.actualCompletionDate + '"></div>';
}
/* Work window: from actual start (or expected start if no actual) to completion (or latest date) */
var workStart = p.actualStartDate ? new Date(p.actualStartDate) : (p.expectedStartDate ? new Date(p.expectedStartDate) : e);
var workEnd = p.actualCompletionDate ? new Date(p.actualCompletionDate) : l;
var barStart = Math.max(workStart, chartStart);
var barEnd = Math.min(workEnd, chartEnd);
var leftPct = (barStart - chartStart) / rangeMs * 100;
var widthPct = Math.max(1, (barEnd - barStart) / rangeMs * 100);
html += '<div class="pm-gantt-bar" style="left:' + leftPct + '%;width:' + widthPct + '%;background:' + color + ';" title="' + escapeHtml(p.name || '') + ' | Status: ' + escapeHtml(p.status || '') + '"></div>';
/* Dashed segment from award to start (no activity period) */
if (p.awardDate && (p.actualStartDate || p.expectedStartDate)) {
var awardD = new Date(p.awardDate);
var startD = p.actualStartDate ? new Date(p.actualStartDate) : new Date(p.expectedStartDate);
if (startD > awardD) {
var dashStart = Math.max(awardD, chartStart);
var dashEnd = Math.min(startD, chartEnd);
var dashLeft = (dashStart - chartStart) / rangeMs * 100;
var dashWidth = Math.max(1, (dashEnd - dashStart) / rangeMs * 100);
html += '<div class="pm-gantt-dash" style="left:' + dashLeft + '%;width:' + dashWidth + '%;" title="Awarded ' + p.awardDate + ' \u2014 no activity until start"></div>';
}
}
html += '</div></div>';
});
html += '<div style="display:flex;gap:12px;margin-top:8px;font-size:11px;color:#64748b;">';
html += '<span><span style="display:inline-block;width:12px;height:12px;background:#f59e0b;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Award</span>';
html += '<span><span style="display:inline-block;width:12px;height:12px;background:#16a34a;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Start</span>';
html += '<span><span style="display:inline-block;width:12px;height:12px;background:#6366f1;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Completion</span>';
html += '<span><span style="display:inline-block;width:12px;height:12px;background:#3b82f6;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Awarded</span>';
html += '<span><span style="display:inline-block;width:12px;height:12px;background:#16a34a;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>In Progress</span>';
html += '</div>';
html += '</div></div>';
container.innerHTML = html;
renderPagination('pmTrendPagination', projects.length, totalPages, pmTrendPage, pmTrendPageSize, function(p) { pmTrendPage = p; pmSavePrefs(); renderTrendChart(projArr); }, function(sz) { pmTrendPageSize = sz; pmTrendPage = 1; pmSavePrefs(); renderTrendChart(projArr); });
updateGanttSliderLabel();
}
function updateGanttSliderLabel() {
var slider = document.getElementById('pmGanttSlider');
var label = document.getElementById('pmGanttSliderLabel');
if (!slider || !label) return;
var year = pmYearFilter ? parseInt(pmYearFilter) : null;
if (year || pmGanttWindow === 'all') {
slider.style.display = 'none';
label.textContent = '';
return;
}
slider.style.display = 'inline-block';
var winMonths = parseInt(pmGanttWindow) || 12;
var start = new Date();
var fullRange = getChartRange(allProjects);
var chartStart = new Date(fullRange.start.getFullYear(), fullRange.start.getMonth() + pmGanttOffset, 1);
label.textContent = chartStart.toLocaleDateString('en', { month: 'short', year: 'numeric' }) + ' \u2013 ' + new Date(chartStart.getFullYear(), chartStart.getMonth() + winMonths - 1, 1).toLocaleDateString('en', { month: 'short', year: 'numeric' });
}
function initGanttControls() {
var zoom = document.getElementById('pmGanttZoom');
var slider = document.getElementById('pmGanttSlider');
if (zoom) zoom.value = pmGanttWindow;
if (zoom) zoom.addEventListener('change', function() {
pmGanttWindow = zoom.value;
pmGanttOffset = 0;
pmTrendPage = 1;
pmSavePrefs();
renderTrendChart();
});
if (slider) slider.addEventListener('input', function() {
pmGanttOffset = parseInt(slider.value) || 0;
pmSavePrefs();
renderTrendChart();
});
}
var ovProjSearch = '', ovClientSearch = '', pmYearFilter = '';
function populateYearFilter() {
var sel = document.getElementById('pmYearFilter');
if (!sel) return;
var years = {};
allProjects.forEach(function(p) { if (p.createdAt) { var y = new Date(p.createdAt).getFullYear(); years[y] = true; } });
allClients.forEach(function(c) { if (c.createdAt) { var y = new Date(c.createdAt).getFullYear(); years[y] = true; } });
var sorted = Object.keys(years).sort(function(a, b) { return b - a; });
var current = pmYearFilter || sel.value;
sel.innerHTML = '<option value="">All Years</option>';
sorted.forEach(function(y) { var opt = document.createElement('option'); opt.value = y; opt.textContent = y; sel.appendChild(opt); });
sel.value = current;
}
function getYearFilteredProjects() {
if (!pmYearFilter) return allProjects;
return allProjects.filter(function(p) { return p.createdAt && String(new Date(p.createdAt).getFullYear()) === pmYearFilter; });
}
function getYearFilteredClients() {
if (!pmYearFilter) return allClients;
return allClients.filter(function(c) { return c.createdAt && String(new Date(c.createdAt).getFullYear()) === pmYearFilter; });
}
function initOverviewSearch() {
var ps = document.getElementById('pmOverviewProjectSearch');
var cs = document.getElementById('pmOverviewClientSearch');
var yf = document.getElementById('pmYearFilter');
if (ps) ps.addEventListener('input', function() { ovProjSearch = ps.value.toLowerCase(); renderOverviewProjects(getYearFilteredProjects()); });
if (cs) cs.addEventListener('input', function() { ovClientSearch = cs.value.toLowerCase(); renderOverviewClients(getYearFilteredClients()); });
if (yf) yf.addEventListener('change', function() { pmYearFilter = yf.value; pmTrendPage = 1; pmSavePrefs(); renderOverview(); });
}
function renderOverviewProjects(projArr) {
var projs = projArr || allProjects;
var recent = projs.slice().sort(function(a, b) {
var da = a.createdAt || ''; var db = b.createdAt || '';
return db < da ? -1 : db > da ? 1 : 0;
});
if (ovProjSearch) {
recent = recent.filter(function(p) {
return (p.name && p.name.toLowerCase().indexOf(ovProjSearch) !== -1) ||
(p.code && p.code.toLowerCase().indexOf(ovProjSearch) !== -1) ||
(p.clientName && p.clientName.toLowerCase().indexOf(ovProjSearch) !== -1);
});
}
document.getElementById('recentProjectsCount').textContent = recent.length;
var totalPages = Math.max(1, Math.ceil(recent.length / ovProjPageSize));
if (ovProjPage > totalPages) ovProjPage = 1;
var pageStart = (ovProjPage - 1) * ovProjPageSize;
var pageItems = recent.slice(pageStart, pageStart + ovProjPageSize);
var body = document.getElementById('pmOverviewProjectsBody');
body.textContent = '';
if (recent.length === 0) {
body.innerHTML = '<tr><td class="pm-empty">No projects found. <a class="pm-empty-action" onclick="switchTab(\'addproject\')">Add New Project</a></td></tr>';
} else {
pageItems.forEach(function(p) {
var tr = document.createElement('tr');
tr.style.cursor = 'pointer';
tr.addEventListener('click', function() { openProjectDetail(p); });
tr.innerHTML = '<td>' + escapeHtml(p.code || '\u2014') + '</td><td style="font-weight:600;">' + escapeHtml(p.name || '') + '</td><td>' + escapeHtml(p.clientName || p.client_name || '\u2014') + '</td><td>' + statusBadgeHtml(p.status) + '</td>';
body.appendChild(tr);
});
}
renderPagination('pmOverviewProjectsPagination', recent.length, totalPages, ovProjPage, ovProjPageSize, function(p) { ovProjPage = p; renderOverviewProjects(getYearFilteredProjects()); }, function(sz) { ovProjPageSize = sz; ovProjPage = 1; renderOverviewProjects(getYearFilteredProjects()); });
}
function renderOverviewClients(clientArr) {
var clients = clientArr || allClients;
var recent = clients.slice().sort(function(a, b) {
var da = a.createdAt || ''; var db = b.createdAt || '';
return db < da ? -1 : db > da ? 1 : 0;
});
if (ovClientSearch) {
recent = recent.filter(function(c) {
return (c.clientName && c.clientName.toLowerCase().indexOf(ovClientSearch) !== -1) ||
(c.contactName && c.contactName.toLowerCase().indexOf(ovClientSearch) !== -1) ||
(c.contactEmail && c.contactEmail.toLowerCase().indexOf(ovClientSearch) !== -1);
});
}
document.getElementById('recentClientsCount').textContent = recent.length;
var totalPages = Math.max(1, Math.ceil(recent.length / ovClientPageSize));
if (ovClientPage > totalPages) ovClientPage = 1;
var pageStart = (ovClientPage - 1) * ovClientPageSize;
var pageItems = recent.slice(pageStart, pageStart + ovClientPageSize);
var body = document.getElementById('pmOverviewClientsBody');
body.textContent = '';
if (recent.length === 0) {
body.innerHTML = '<tr><td class="pm-empty">No clients found. <a class="pm-empty-action" onclick="switchTab(\'addclient\')">Add New Client</a></td></tr>';
} else {
pageItems.forEach(function(c) {
var tr = document.createElement('tr');
tr.style.cursor = 'pointer';
tr.addEventListener('click', function() { switchTab('clients'); });
tr.innerHTML = '<td style="font-weight:600;">' + escapeHtml(c.clientName || '') + '</td><td>' + escapeHtml(c.contactName || c.contactEmail || '\u2014') + '</td><td>' + statusBadgeHtml(c.status) + '</td>';
body.appendChild(tr);
});
}
renderPagination('pmOverviewClientsPagination', recent.length, totalPages, ovClientPage, ovClientPageSize, function(p) { ovClientPage = p; renderOverviewClients(getYearFilteredClients()); }, function(sz) { ovClientPageSize = sz; ovClientPage = 1; renderOverviewClients(getYearFilteredClients()); });
}
function openProjectDetail(p) {
var grid = document.getElementById('pmDetailGrid');
document.getElementById('pmDetailTitle').textContent = p.name || 'Project Details';
var fields = [
['Project Number', p.code || '\u2014'],
['Project Name', p.name || '\u2014'],
['Status', p.status || '\u2014'],
['Client', p.clientName || p.client_name || '\u2014'],
['Street', p.street || '\u2014'],
['City', p.city || '\u2014'],
['State', p.state || '\u2014'],
['Zip', p.zip || '\u2014'],
['Project Manager', p.projectManager || '\u2014'],
['Award Date', p.awardDate || '\u2014'],
['Expected Start', p.expectedStartDate || '\u2014'],
['Actual Start', p.actualStartDate || '\u2014'],
['Expected Completion', p.expectedCompletionDate || '\u2014'],
['Actual Completion', p.actualCompletionDate || 'u2014'],
['Notes', p.notes || '\u2014']
];
grid.innerHTML = fields.map(function(f) {
return '<div class="pm-detail-field"><span class="pm-detail-label">' + f[0] + '</span><span class="pm-detail-value">' + escapeHtml(f[1]) + '</span></div>';
}).join('');
document.getElementById('pmDetailModal').classList.add('active');
}
function getActiveContext() {
var activeTab = document.querySelector('.pm-tab.active');
if (!activeTab) return 'overview';
var key = activeTab.getAttribute('data-tab') || 'overview';
return PM_MODAL_CONTENT[key] ? key : 'overview';
}
function openPmModal(type) {
var ctx = getActiveContext();
var info = PM_MODAL_CONTENT[ctx] || PM_MODAL_CONTENT.overview;
if (type === 'purpose') {
document.getElementById('pmModalPurposeTitle').textContent = info.title + ' \u2014 Purpose';
document.getElementById('pmModalPurposeBody').innerHTML = info.purpose;
document.getElementById('pmModalPurpose').classList.add('active');
} else {
document.getElementById('pmModalInstructionsTitle').textContent = info.title + ' \u2014 Instructions';
document.getElementById('pmModalInstructionsBody').innerHTML = info.instructions;
document.getElementById('pmModalInstructions').classList.add('active');
}
}
var btnPurpose = document.getElementById('pmBtnPurpose');
if (btnPurpose) btnPurpose.addEventListener('click', function() { openPmModal('purpose'); });
var btnInstructions = document.getElementById('pmBtnInstructions');
if (btnInstructions) btnInstructions.addEventListener('click', function() { openPmModal('instructions'); });

document.querySelectorAll('.pm-modal-overlay').forEach(function(overlay) {
overlay.addEventListener('click', function(e) {
if (e.target === overlay) overlay.classList.remove('active');
});
});
})();
