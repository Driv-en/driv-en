/**
 * company-profile.js — DRIV-EN Company Profile (v2)
 * Divisions + Locations CRUD with search, filter, pagination, print, modals.
 * Overrides inline fallbacks for switchTab / goToMainDashboard.
 */

// ============================================================
// TAB SWITCHING (overrides inline fallback)
// ============================================================
function switchTab(tab) {
  document.querySelectorAll('.cm-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.cm-tab-content').forEach(function(c) { c.style.display = 'none'; });
  var tabBtn = document.querySelector('.cm-tab[data-tab="' + tab + '"]');
  if (tabBtn) tabBtn.classList.add('active');
  var content = document.getElementById('tab-' + tab);
  if (content) content.style.display = 'block';
  if (window.DRIVEN_VOICE) { try { DRIVEN_VOICE.init(); } catch (e) {} }
}

// ============================================================
// NAVIGATION (overrides inline fallback)
// ============================================================
function goToMainDashboard() {
  var origin = window._cmSavedOrigin;
  if (origin) { window.location.href = origin; return; }
  var user = window.dashUser;
  if (user) {
    var role = (user.role || '').toLowerCase(); var rid = (user.role_id || '').toLowerCase();
    if (role === 'driv-en founder' || role === 'owner' || rid === 'ro-founder') { window.location.href = '/app/dashboard/owner-dashboard.html'; return; }
    if (role === 'admin' || rid === 'ro-admin') { window.location.href = '/app/dashboard/admin.html'; return; }
    window.location.href = '/app/dashboard/employee-dashboard.html'; return;
  }
  window.location.href = '/app/dashboard/admin.html';
}

// ============================================================
// INIT — let dashboard-common.js handle header + logos
// ============================================================
var cmPageInitialized = false;
function initPage() {
  if (cmPageInitialized) return true;
  var user = window.dashUser;
  if (!user) return false;
  cmPageInitialized = true;
  loadColSettings();
  populateWelcomeCard();
  setupInfoModals();
  loadDivisions();
  loadLocations();
  if (window.DRIVEN_VOICE) { try { DRIVEN_VOICE.init(); } catch (e) {} }
  return true;
}
document.addEventListener('dashSessionLoaded', initPage);
if (window.dashUser) { initPage(); }
document.addEventListener('DOMContentLoaded', function() {
  if (!initPage()) {
    var tries = 0;
    var poll = setInterval(function() {
      tries++;
      if (initPage() || tries > 20) { clearInterval(poll); if (tries > 20 && !window.dashUser) { window.location.href = '/public/login.html'; } }
    }, 250);
  }
});
window.addEventListener('load', function() { initPage(); });

// ============================================================
// COLUMN SETTINGS (persisted to localStorage)
// ============================================================
var DIV_COLUMNS = [
  { key: 'name', label: 'Name', visible: true, width: 200 },
  { key: 'code', label: 'Code', visible: true, width: 120 },
  { key: 'manager', label: 'Manager', visible: true, width: 180 },
  { key: 'status', label: 'Status', visible: true, width: 100 },
  { key: 'actions', label: 'Actions', visible: true, width: 140 }
];

var LOC_COLUMNS = [
  { key: 'name', label: 'Name', visible: true, width: 200 },
  { key: 'code', label: 'Code', visible: true, width: 120 },
  { key: 'type', label: 'Type', visible: true, width: 120 },
  { key: 'city', label: 'City', visible: true, width: 140 },
  { key: 'state', label: 'State', visible: true, width: 100 },
  { key: 'division', label: 'Division', visible: true, width: 160 },
  { key: 'status', label: 'Status', visible: true, width: 100 },
  { key: 'actions', label: 'Actions', visible: true, width: 140 }
];

var divSort = { key: 'name', dir: 'asc' };
var locSort = { key: 'name', dir: 'asc' };

function loadColSettings() {
  try {
    var divSaved = JSON.parse(localStorage.getItem('cm_div_columns') || 'null');
    if (divSaved) DIV_COLUMNS = divSaved;
    var locSaved = JSON.parse(localStorage.getItem('cm_loc_columns') || 'null');
    if (locSaved) LOC_COLUMNS = locSaved;
  } catch (e) {}
}

function saveColSettings() {
  try {
    localStorage.setItem('cm_div_columns', JSON.stringify(DIV_COLUMNS));
    localStorage.setItem('cm_loc_columns', JSON.stringify(LOC_COLUMNS));
  } catch (e) {}
}

function toggleDivColSettings(e) {
  e.stopPropagation();
  var dd = document.getElementById('cmDivColSettings');
  var open = dd.classList.contains('open');
  document.querySelectorAll('.cm-col-dropdown').forEach(function(x) { x.classList.remove('open'); });
  if (!open) { renderColSettings('div'); dd.classList.add('open'); }
}

function toggleLocColSettings(e) {
  e.stopPropagation();
  var dd = document.getElementById('cmLocColSettings');
  var open = dd.classList.contains('open');
  document.querySelectorAll('.cm-col-dropdown').forEach(function(x) { x.classList.remove('open'); });
  if (!open) { renderColSettings('loc'); dd.classList.add('open'); }
}

function renderColSettings(type) {
  var cols = type === 'div' ? DIV_COLUMNS : LOC_COLUMNS;
  var container = document.getElementById(type === 'div' ? 'cmDivColSettings' : 'cmLocColSettings');
  container.textContent = '';
  var header = document.createElement('div');
  header.className = 'cm-col-dropdown-header';
  header.textContent = 'Show / Hide / Reorder Columns';
  container.appendChild(header);
  cols.forEach(function(col, idx) {
    var item = document.createElement('div');
    item.className = 'cm-col-item';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = col.visible;
    cb.addEventListener('change', function() { col.visible = cb.checked; saveColSettings(); renderTableForType(type); });
    item.appendChild(cb);
    var label = document.createElement('label');
    label.textContent = col.label;
    item.appendChild(label);
    var widthInput = document.createElement('input');
    widthInput.type = 'number'; widthInput.value = col.width; widthInput.min = 60; widthInput.max = 400; widthInput.style.width = '60px';
    widthInput.addEventListener('change', function() { col.width = parseInt(widthInput.value) || 120; saveColSettings(); renderTableForType(type); });
    item.appendChild(widthInput);
    var reorder = document.createElement('div');
    reorder.className = 'cm-col-reorder';
    var upBtn = document.createElement('button'); upBtn.textContent = '▲';
    upBtn.addEventListener('click', function() { if (idx > 0) { var t = cols[idx-1]; cols[idx-1] = cols[idx]; cols[idx] = t; saveColSettings(); renderColSettings(type); renderTableForType(type); } });
    var downBtn = document.createElement('button'); downBtn.textContent = '▼';
    downBtn.addEventListener('click', function() { if (idx < cols.length-1) { var t = cols[idx+1]; cols[idx+1] = cols[idx]; cols[idx] = t; saveColSettings(); renderColSettings(type); renderTableForType(type); } });
    reorder.appendChild(upBtn); reorder.appendChild(downBtn);
    item.appendChild(reorder);
    container.appendChild(item);
  });
}

function renderTableForType(type) {
  if (type === 'div') renderDivTable(); else renderLocTable();
}

function renderDivTableHead() {
  var thead = document.getElementById('cmDivTableHead');
  if (!thead) return;
  thead.textContent = '';
  var tr = document.createElement('tr');
  DIV_COLUMNS.forEach(function(col) {
    if (!col.visible) return;
    var th = document.createElement('th');
    th.style.width = col.width + 'px';
    th.style.minWidth = col.width + 'px';
    th.className = 'cm-th-sortable';
    th.dataset.key = col.key;
    th.textContent = col.label;
    var indicator = document.createElement('span');
    indicator.className = 'cm-sort-indicator';
    if (divSort.key === col.key) indicator.textContent = divSort.dir === 'asc' ? '▲' : '▼';
    else indicator.textContent = '↕';
    th.appendChild(indicator);
    th.addEventListener('click', function() {
      if (divSort.key === col.key) divSort.dir = divSort.dir === 'asc' ? 'desc' : 'asc';
      else { divSort.key = col.key; divSort.dir = 'asc'; }
      renderDivTable();
    });
    tr.appendChild(th);
  });
  thead.appendChild(tr);
}

function renderLocTableHead() {
  var thead = document.getElementById('cmLocTableHead');
  if (!thead) return;
  thead.textContent = '';
  var tr = document.createElement('tr');
  LOC_COLUMNS.forEach(function(col) {
    if (!col.visible) return;
    var th = document.createElement('th');
    th.style.width = col.width + 'px';
    th.style.minWidth = col.width + 'px';
    th.className = 'cm-th-sortable';
    th.dataset.key = col.key;
    th.textContent = col.label;
    var indicator = document.createElement('span');
    indicator.className = 'cm-sort-indicator';
    if (locSort.key === col.key) indicator.textContent = locSort.dir === 'asc' ? '▲' : '▼';
    else indicator.textContent = '↕';
    th.appendChild(indicator);
    th.addEventListener('click', function() {
      if (locSort.key === col.key) locSort.dir = locSort.dir === 'asc' ? 'desc' : 'asc';
      else { locSort.key = col.key; locSort.dir = 'asc'; }
      renderLocTable();
    });
    tr.appendChild(th);
  });
  thead.appendChild(tr);
}

// ============================================================
// DIVISION MANAGEMENT
// ============================================================
var allDivisions = [];
var editingDivId  = null;
var divPage       = 1;
var divPageSize   = 10;

function normalizeDiv(r) {
  var f = (r && r.fields && typeof r.fields === 'object') ? r.fields : r;
  return {
    id:          r.id || ('div-' + Math.random().toString(36).substr(2, 9)),
    name:        f['Division Name'] || f.name || '',
    code:        f['Division Code'] || f.code || '',
    description: f['Description']   || f.description || '',
    manager:     f['Manager']       || f.manager || '',
    status:      f['Status']        || f.status || 'Active',
  };
}

async function loadDivisions() {
  var tbody = document.getElementById('cmDivTableBody');
  if (!tbody) return;
  try {
    var resp = await fetch('/api/Divisions');
    var data = await resp.json();
    if (resp.ok && data && data.records) {
      allDivisions = data.records.map(normalizeDiv);
    } else {
      allDivisions = [];
      var errMsg = (data && data.error) ? data.error : 'No records returned (HTTP ' + resp.status + ')';
      showDivError('Could not load divisions: ' + errMsg);
    }
  } catch (e) {
    allDivisions = [];
     showDivError('Network error loading divisions: ' + e.message);
    if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report(e.message, 'loadDivisions', e.stack);
  }
  renderDivTable();
  populateDivisionDropdowns();
}

function showDivError(msg) {
  var el = document.getElementById('cmDivMessage');
  if (!el) return;
  el.textContent = msg; el.className = 'cm-message error'; el.style.display = 'block';
}

function populateDivisionDropdowns() {
  var selects = [document.getElementById('cmLocDivision'), document.getElementById('cmEditLocDivision')];
  selects.forEach(function (sel) {
    if (!sel) return;
    var currentVal = sel.value;
    sel.innerHTML = '<option value="">\u2014 None \u2014</option>';
    allDivisions.forEach(function (d) {
      var opt = document.createElement('option');
      opt.value = d.name; opt.textContent = d.name;
      sel.appendChild(opt);
    });
    if (currentVal) sel.value = currentVal;
  });
}

function onDivSearchInput() {
  clearTimeout(window._divSearchTimer);
  window._divSearchTimer = setTimeout(function () { divPage = 1; renderDivTable(); }, 200);
}

function renderDivTable() {
  var tbody = document.getElementById('cmDivTableBody');
  if (!tbody) return;
  renderDivTableHead();
  var search       = (document.getElementById('cmDivSearch').value || '').toLowerCase().trim();
  var filterStatus = document.getElementById('cmDivFilterStatus').value;
  var filtered = allDivisions.filter(function (d) {
    var matchesSearch = !search ||
      (d.name && d.name.toLowerCase().indexOf(search) !== -1) ||
      (d.code && d.code.toLowerCase().indexOf(search) !== -1) ||
      (d.manager && d.manager.toLowerCase().indexOf(search) !== -1);
    var matchesStatus = !filterStatus || (d.status && d.status.toLowerCase() === filterStatus.toLowerCase());
    return matchesSearch && matchesStatus;
  });
  // Sort
  filtered.sort(function(a, b) {
    var av = (a[divSort.key] || '').toString().toLowerCase();
    var bv = (b[divSort.key] || '').toString().toLowerCase();
    if (av < bv) return divSort.dir === 'asc' ? -1 : 1;
    if (av > bv) return divSort.dir === 'asc' ? 1 : -1;
    return 0;
  });
  document.getElementById('cmDivCount').textContent = filtered.length + ' division' + (filtered.length === 1 ? '' : 's');
  var totalPages = Math.max(1, Math.ceil(filtered.length / divPageSize));
  if (divPage > totalPages) divPage = totalPages;
  var startIdx  = (divPage - 1) * divPageSize;
  var pageItems = filtered.slice(startIdx, startIdx + divPageSize);
  tbody.textContent = '';
  if (filtered.length === 0) {
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.className = 'cm-empty';
    td.textContent = allDivisions.length === 0 ? 'No divisions found. Add your first division above.' : 'No divisions match your search.';
    tr.appendChild(td); tbody.appendChild(tr);
    renderDivPagination(0, 1); return;
  }
  pageItems.forEach(function (d) {
    var tr = document.createElement('tr');
    DIV_COLUMNS.forEach(function(col) {
      if (!col.visible) return;
      var td = document.createElement('td');
      td.style.width = col.width + 'px';
      if (col.key === 'actions') {
        td.className = 'cm-actions';
        var btnEdit = document.createElement('button'); btnEdit.className = 'cm-table-btn'; btnEdit.textContent = 'Edit';
        btnEdit.addEventListener('click', function () { openEditDivModal(d.id); }); td.appendChild(btnEdit);
        var btnDelete = document.createElement('button'); btnDelete.className = 'cm-table-btn danger'; btnDelete.textContent = 'Delete';
        btnDelete.addEventListener('click', function () { deleteDivision(d.id); }); td.appendChild(btnDelete);
      } else if (col.key === 'status') {
        if (d.status) { var badge = document.createElement('span'); badge.className = 'cm-badge cm-badge-' + d.status.toLowerCase(); badge.textContent = d.status; td.appendChild(badge); }
        else { td.textContent = '\u2014'; }
      } else {
        td.textContent = (d[col.key] !== undefined && d[col.key] !== null && d[col.key] !== '') ? d[col.key] : '\u2014';
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  renderDivPagination(filtered.length, totalPages);
}

function renderDivPagination(totalItems, totalPages) {
  var container = document.getElementById('cmDivPagination');
  if (!container) return; container.textContent = '';
  if (totalItems === 0) return;
  var info = document.createElement('span'); info.className = 'cm-page-info';
  var startIdx = (divPage - 1) * divPageSize + 1;
  var endIdx   = Math.min(divPage * divPageSize, totalItems);
  info.textContent = 'Showing ' + startIdx + '\u2013' + endIdx + ' of ' + totalItems;
  container.appendChild(info);
  var btnsDiv = document.createElement('div'); btnsDiv.className = 'cm-page-btns';
  var btnPrev = document.createElement('button'); btnPrev.className = 'cm-page-btn'; btnPrev.textContent = '\u25C0 Prev'; btnPrev.disabled = divPage <= 1;
  btnPrev.addEventListener('click', function () { divPage--; renderDivTable(); }); btnsDiv.appendChild(btnPrev);
  for (var p = 1; p <= totalPages && p <= 7; p++) {
    var btn = document.createElement('button'); btn.className = 'cm-page-btn' + (p === divPage ? ' active' : ''); btn.textContent = p;
    btn.addEventListener('click', function (page) { return function () { divPage = page; renderDivTable(); }; }(p));
    btnsDiv.appendChild(btn);
  }
  var btnNext = document.createElement('button'); btnNext.className = 'cm-page-btn'; btnNext.textContent = 'Next \u25B6'; btnNext.disabled = divPage >= totalPages;
  btnNext.addEventListener('click', function () { divPage++; renderDivTable(); }); btnsDiv.appendChild(btnNext);
  container.appendChild(btnsDiv);
}

async function addDivision() {
  var name = document.getElementById('cmDivName').value.trim();
  if (!name) { showDivMessage('Please enter a division name.', 'error'); return; }
  var payload = {
    'Division Name': name,
    'Division Code': document.getElementById('cmDivCode').value.trim(),
    'Manager':       document.getElementById('cmDivManager').value.trim(),
    'Description':   document.getElementById('cmDivDescription').value.trim(),
    'Status':        document.getElementById('cmDivStatus').value,
  };
  try {
    var resp = await fetch('/api/Divisions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Save failed (' + resp.status + ')');
    if (data.record) { allDivisions.push(normalizeDiv(data.record)); } else { await loadDivisions(); }
    ['cmDivName', 'cmDivCode', 'cmDivManager', 'cmDivDescription'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('cmDivStatus').value = 'Active';
    showDivMessage('Division "' + name + '" added.', 'success');
    divPage = 1; renderDivTable(); populateDivisionDropdowns(); switchTab('divisions');
  } catch (e) { showDivMessage('Failed to add division: ' + e.message, 'error'); if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report(e.message, 'addDivision', e.stack); }
}

function openEditDivModal(id) {
  var d = allDivisions.find(function (x) { return x.id === id; });
  if (!d) return;
  editingDivId = id;
  document.getElementById('cmEditDivName').value        = d.name || '';
  document.getElementById('cmEditDivCode').value        = d.code || '';
  document.getElementById('cmEditDivManager').value     = d.manager || '';
  document.getElementById('cmEditDivDescription').value = d.description || '';
  document.getElementById('cmEditDivStatus').value      = d.status || 'Active';
  document.getElementById('cmEditDivModal').classList.add('active');
}
function closeEditDivModal() { document.getElementById('cmEditDivModal').classList.remove('active'); editingDivId = null; }

async function saveEditDivision() {
  if (!editingDivId) return;
  var name = document.getElementById('cmEditDivName').value.trim();
  if (!name) { showDivMessage('Division name is required.', 'error'); return; }
  var payload = {
    'Division Name': name,
    'Division Code': document.getElementById('cmEditDivCode').value.trim(),
    'Manager':       document.getElementById('cmEditDivManager').value.trim(),
    'Description':   document.getElementById('cmEditDivDescription').value.trim(),
    'Status':        document.getElementById('cmEditDivStatus').value,
  };
  try {
    var resp = await fetch('/api/Divisions/' + encodeURIComponent(editingDivId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Update failed (' + resp.status + ')');
    if (data.record) { var updated = normalizeDiv(data.record); var idx = allDivisions.findIndex(function (x) { return x.id === editingDivId; }); if (idx !== -1) allDivisions[idx] = updated; }
    showDivMessage('Division "' + name + '" updated.', 'success');
    closeEditDivModal(); renderDivTable(); populateDivisionDropdowns();
  } catch (e) { showDivMessage('Failed to update division: ' + e.message, 'error'); if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report(e.message, 'saveEditDivision', e.stack); }
}

async function deleteDivision(id) {
  var d = allDivisions.find(function (x) { return x.id === id; });
  if (!d) return;
  if (!confirm('Delete division "' + (d.name || 'Unknown') + '"? This cannot be undone.')) return;
  try {
    var resp = await fetch('/api/Divisions/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!resp.ok) { var data = await resp.json(); throw new Error(data.error || data.message || 'Delete failed (' + resp.status + ')'); }
    allDivisions = allDivisions.filter(function (x) { return x.id !== id; });
    showDivMessage('Division "' + (d.name || 'Unknown') + '" deleted.', 'success');
    renderDivTable(); populateDivisionDropdowns();
  } catch (e) { showDivMessage('Failed to delete division: ' + e.message, 'error'); if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report(e.message, 'deleteDivision', e.stack); }
}

function showDivMessage(msg, type) {
  var el = document.getElementById('cmDivMessage');
  if (!el) return; el.textContent = msg; el.className = 'cm-message ' + type; el.style.display = 'block';
  setTimeout(function () { el.style.display = 'none'; }, 5000);
}

// ============================================================
// LOCATION MANAGEMENT
// ============================================================
var allLocations = [];
var editingLocId  = null;
var locPage       = 1;
var locPageSize   = 10;

function normalizeLoc(r) {
  var f = (r && r.fields && typeof r.fields === 'object') ? r.fields : r;
  return {
    id:       r.id || ('loc-' + Math.random().toString(36).substr(2, 9)),
    name:     f['Location Name'] || f.name || '',
    code:     f['Location Code'] || f.code || '',
    type:     f['Type']           || f.type || '',
    address:  f['Address']        || f.address || '',
    city:     f['City']           || f.city || '',
    state:    f['State']          || f.state || '',
    zipCode:  f['Zip Code']       || f.zip_code || '',
    division: f['Division']       || f.division || '',
    status:   f['Status']         || f.status || 'Active',
  };
}

async function loadLocations() {
  var tbody = document.getElementById('cmLocTableBody');
  if (!tbody) return;
  try {
    var resp = await fetch('/api/Locations');
    var data = await resp.json();
    if (resp.ok && data && data.records) {
      allLocations = data.records.map(normalizeLoc);
    } else {
      allLocations = [];
      var errMsg = (data && data.error) ? data.error : 'No records returned (HTTP ' + resp.status + ')';
      showLocError('Could not load locations: ' + errMsg);
    }
  } catch (e) {
    allLocations = [];
    showLocError('Network error loading locations: ' + e.message);
    if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report(e.message, 'loadLocations', e.stack);
  }
  renderLocTable();
}

function showLocError(msg) {
  var el = document.getElementById('cmLocMessage');
  if (!el) return;
  el.textContent = msg; el.className = 'cm-message error'; el.style.display = 'block';
}

function onLocSearchInput() {
  clearTimeout(window._locSearchTimer);
  window._locSearchTimer = setTimeout(function () { locPage = 1; renderLocTable(); }, 200);
}

function renderLocTable() {
  var tbody = document.getElementById('cmLocTableBody');
  if (!tbody) return;
  renderLocTableHead();
  var search       = (document.getElementById('cmLocSearch').value || '').toLowerCase().trim();
  var filterStatus = document.getElementById('cmLocFilterStatus').value;
  var filtered = allLocations.filter(function (l) {
    var matchesSearch = !search ||
      (l.name && l.name.toLowerCase().indexOf(search) !== -1) ||
      (l.code && l.code.toLowerCase().indexOf(search) !== -1) ||
      (l.city && l.city.toLowerCase().indexOf(search) !== -1) ||
      (l.address && l.address.toLowerCase().indexOf(search) !== -1);
    var matchesStatus = !filterStatus || (l.status && l.status.toLowerCase() === filterStatus.toLowerCase());
    return matchesSearch && matchesStatus;
  });
  // Sort
  filtered.sort(function(a, b) {
    var av = (a[locSort.key] || '').toString().toLowerCase();
    var bv = (b[locSort.key] || '').toString().toLowerCase();
    if (av < bv) return locSort.dir === 'asc' ? -1 : 1;
    if (av > bv) return locSort.dir === 'asc' ? 1 : -1;
    return 0;
  });
  document.getElementById('cmLocCount').textContent = filtered.length + ' location' + (filtered.length === 1 ? '' : 's');
  var totalPages = Math.max(1, Math.ceil(filtered.length / locPageSize));
  if (locPage > totalPages) locPage = totalPages;
  var startIdx  = (locPage - 1) * locPageSize;
  var pageItems = filtered.slice(startIdx, startIdx + locPageSize);
  tbody.textContent = '';
  if (filtered.length === 0) {
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.className = 'cm-empty';
    td.textContent = allLocations.length === 0 ? 'No locations found. Add your first location above.' : 'No locations match your search.';
    tr.appendChild(td); tbody.appendChild(tr);
    renderLocPagination(0, 1); return;
  }
  pageItems.forEach(function (l) {
    var tr = document.createElement('tr');
    LOC_COLUMNS.forEach(function(col) {
      if (!col.visible) return;
      var td = document.createElement('td');
      td.style.width = col.width + 'px';
      if (col.key === 'actions') {
        td.className = 'cm-actions';
        var btnEdit = document.createElement('button'); btnEdit.className = 'cm-table-btn'; btnEdit.textContent = 'Edit';
        btnEdit.addEventListener('click', function () { openEditLocModal(l.id); }); td.appendChild(btnEdit);
        var btnDelete = document.createElement('button'); btnDelete.className = 'cm-table-btn danger'; btnDelete.textContent = 'Delete';
        btnDelete.addEventListener('click', function () { deleteLocation(l.id); }); td.appendChild(btnDelete);
      } else if (col.key === 'status') {
        if (l.status) { var badge = document.createElement('span'); badge.className = 'cm-badge cm-badge-' + l.status.toLowerCase(); badge.textContent = l.status; td.appendChild(badge); }
        else { td.textContent = '\u2014'; }
      } else {
        td.textContent = (l[col.key] !== undefined && l[col.key] !== null && l[col.key] !== '') ? l[col.key] : '\u2014';
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  renderLocPagination(filtered.length, totalPages);
}

function renderLocPagination(totalItems, totalPages) {
  var container = document.getElementById('cmLocPagination');
  if (!container) return; container.textContent = '';
  if (totalItems === 0) return;
  var info = document.createElement('span'); info.className = 'cm-page-info';
  var startIdx = (locPage - 1) * locPageSize + 1;
  var endIdx   = Math.min(locPage * locPageSize, totalItems);
  info.textContent = 'Showing ' + startIdx + '\u2013' + endIdx + ' of ' + totalItems;
  container.appendChild(info);
  var btnsDiv = document.createElement('div'); btnsDiv.className = 'cm-page-btns';
  var btnPrev = document.createElement('button'); btnPrev.className = 'cm-page-btn'; btnPrev.textContent = '\u25C0 Prev'; btnPrev.disabled = locPage <= 1;
  btnPrev.addEventListener('click', function () { locPage--; renderLocTable(); }); btnsDiv.appendChild(btnPrev);
  for (var p = 1; p <= totalPages && p <= 7; p++) {
    var btn = document.createElement('button'); btn.className = 'cm-page-btn' + (p === locPage ? ' active' : ''); btn.textContent = p;
    btn.addEventListener('click', function (page) { return function () { locPage = page; renderLocTable(); }; }(p));
    btnsDiv.appendChild(btn);
  }
  var btnNext = document.createElement('button'); btnNext.className = 'cm-page-btn'; btnNext.textContent = 'Next \u25B6'; btnNext.disabled = locPage >= totalPages;
  btnNext.addEventListener('click', function () { locPage++; renderLocTable(); }); btnsDiv.appendChild(btnNext);
  container.appendChild(btnsDiv);
}

async function addLocation() {
  var name = document.getElementById('cmLocName').value.trim();
  if (!name) { showLocMessage('Please enter a location name.', 'error'); return; }
  var payload = {
    'Location Name': name,
    'Location Code': document.getElementById('cmLocCode').value.trim(),
    'Type':          document.getElementById('cmLocType').value,
    'Division':      document.getElementById('cmLocDivision').value,
    'Address':       document.getElementById('cmLocAddress').value.trim(),
    'City':          document.getElementById('cmLocCity').value.trim(),
    'State':         document.getElementById('cmLocState').value.trim(),
    'Zip Code':      document.getElementById('cmLocZipCode').value.trim(),
    'Status':        document.getElementById('cmLocStatus').value,
  };
  try {
    var resp = await fetch('/api/Locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Save failed (' + resp.status + ')');
    if (data.record) { allLocations.push(normalizeLoc(data.record)); } else { await loadLocations(); }
    ['cmLocName', 'cmLocCode', 'cmLocAddress', 'cmLocCity', 'cmLocState', 'cmLocZipCode'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('cmLocType').value = ''; document.getElementById('cmLocDivision').value = ''; document.getElementById('cmLocStatus').value = 'Active';
    showLocMessage('Location "' + name + '" added.', 'success');
    locPage = 1; renderLocTable(); switchTab('locations');
  } catch (e) { showLocMessage('Failed to add location: ' + e.message, 'error'); if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report(e.message, 'addLocation', e.stack); }
}

function openEditLocModal(id) {
  var l = allLocations.find(function (x) { return x.id === id; });
  if (!l) return;
  editingLocId = id;
  document.getElementById('cmEditLocName').value      = l.name || '';
  document.getElementById('cmEditLocCode').value      = l.code || '';
  document.getElementById('cmEditLocType').value      = l.type || '';
  populateDivisionDropdowns();
  document.getElementById('cmEditLocDivision').value  = l.division || '';
  document.getElementById('cmEditLocAddress').value   = l.address || '';
  document.getElementById('cmEditLocCity').value       = l.city || '';
  document.getElementById('cmEditLocState').value      = l.state || '';
  document.getElementById('cmEditLocZipCode').value     = l.zipCode || '';
  document.getElementById('cmEditLocStatus').value      = l.status || 'Active';
  document.getElementById('cmEditLocModal').classList.add('active');
}
function closeEditLocModal() { document.getElementById('cmEditLocModal').classList.remove('active'); editingLocId = null; }

async function saveEditLocation() {
  if (!editingLocId) return;
  var name = document.getElementById('cmEditLocName').value.trim();
  if (!name) { showLocMessage('Location name is required.', 'error'); return; }
  var payload = {
    'Location Name': name,
    'Location Code': document.getElementById('cmEditLocCode').value.trim(),
    'Type':          document.getElementById('cmEditLocType').value,
    'Division':      document.getElementById('cmEditLocDivision').value,
    'Address':       document.getElementById('cmEditLocAddress').value.trim(),
    'City':          document.getElementById('cmEditLocCity').value.trim(),
    'State':         document.getElementById('cmEditLocState').value.trim(),
    'Zip Code':      document.getElementById('cmEditLocZipCode').value.trim(),
    'Status':        document.getElementById('cmEditLocStatus').value,
  };
  try {
    var resp = await fetch('/api/Locations/' + encodeURIComponent(editingLocId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Update failed (' + resp.status + ')');
    if (data.record) { var updated = normalizeLoc(data.record); var idx = allLocations.findIndex(function (x) { return x.id === editingLocId; }); if (idx !== -1) allLocations[idx] = updated; }
    showLocMessage('Location "' + name + '" updated.', 'success');
    closeEditLocModal(); renderLocTable();
  } catch (e) { showLocMessage('Failed to update location: ' + e.message, 'error'); if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report(e.message, 'saveEditLocation', e.stack); }
}

async function deleteLocation(id) {
  var l = allLocations.find(function (x) { return x.id === id; });
  if (!l) return;
  if (!confirm('Delete location "' + (l.name || 'Unknown') + '"? This cannot be undone.')) return;
  try {
    var resp = await fetch('/api/Locations/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!resp.ok) { var data = await resp.json(); throw new Error(data.error || data.message || 'Delete failed (' + resp.status + ')'); }
    allLocations = allLocations.filter(function (x) { return x.id !== id; });
    showLocMessage('Location "' + (l.name || 'Unknown') + '" deleted.', 'success');
    renderLocTable();
  } catch (e) { showLocMessage('Failed to delete location: ' + e.message, 'error'); if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report(e.message, 'deleteLocation', e.stack); }
}

function showLocMessage(msg, type) {
  var el = document.getElementById('cmLocMessage');
  if (!el) return; el.textContent = msg; el.className = 'cm-message ' + type; el.style.display = 'block';
  setTimeout(function () { el.style.display = 'none'; }, 5000);
}

// ============================================================
// MODAL OVERLAY CLICKS
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  var dm = document.getElementById('cmEditDivModal');
  if (dm) dm.addEventListener('click', function (e) { if (e.target === dm) closeEditDivModal(); });
  var lm = document.getElementById('cmEditLocModal');
  if (lm) lm.addEventListener('click', function (e) { if (e.target === lm) closeEditLocModal(); });
  // Close column settings when clicking outside
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.cm-col-dropdown') && !e.target.closest('.cm-col-btn')) {
      document.querySelectorAll('.cm-col-dropdown').forEach(function (x) { x.classList.remove('open'); });
    }
  });
});

// ============================================================
// PRINT FUNCTIONS
// ============================================================
function printDivisions() {
  var div = document.getElementById('tab-divisions');
  if (!div) return;
  var table = div.querySelector('.cm-table');
  if (!table) return;
  var visibleCols = DIV_COLUMNS.filter(function(c) { return c.visible; });
  var win = window.open('', '_blank');
  win.document.write('<html><head><title>Divisions List</title><style>body{font-family:Arial,sans-serif;padding:20px;} h2{margin-bottom:4px;} table{width:100%;border-collapse:collapse;margin-top:12px;} th,td{border:1px solid #ccc;padding:8px 10px;text-align:left;font-size:13px;} th{background:#f1f5f9;font-weight:600;} .meta{font-size:12px;color:#64748b;margin-bottom:12px;}</style></head><body>');
  win.document.write('<h2>Divisions</h2>');
  win.document.write('<div class="meta">Printed: ' + new Date().toLocaleString() + ' | ' + allDivisions.length + ' divisions</div>');
  // Build print table from all filtered data (not just current page)
  var search = (document.getElementById('cmDivSearch').value || '').toLowerCase().trim();
  var filterStatus = document.getElementById('cmDivFilterStatus').value;
  var filtered = allDivisions.filter(function(d) {
    var ms = !search || (d.name||'').toLowerCase().indexOf(search)!==-1 || (d.code||'').toLowerCase().indexOf(search)!==-1 || (d.manager||'').toLowerCase().indexOf(search)!==-1;
    var mf = !filterStatus || (d.status||'').toLowerCase() === filterStatus.toLowerCase();
    return ms && mf;
  });
  filtered.sort(function(a,b) { var av=(a[divSort.key]||'').toString().toLowerCase(), bv=(b[divSort.key]||'').toString().toLowerCase(); return av<bv?-1:av>bv?1:0; });
  var html = '<table><thead><tr>';
  visibleCols.forEach(function(c) { if (c.key !== 'actions') html += '<th>' + c.label + '</th>'; });
  html += '</tr></thead><tbody>';
  filtered.forEach(function(d) {
    html += '<tr>';
    visibleCols.forEach(function(c) {
      if (c.key === 'actions') return;
      html += '<td>' + (d[c.key] !== undefined && d[c.key] !== null && d[c.key] !== '' ? d[c.key] : '\u2014') + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  win.document.write(html);
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 300);
}

function printLocations() {
  var div = document.getElementById('tab-locations');
  if (!div) return;
  var visibleCols = LOC_COLUMNS.filter(function(c) { return c.visible; });
  var win = window.open('', '_blank');
  win.document.write('<html><head><title>Locations List</title><style>body{font-family:Arial,sans-serif;padding:20px;} h2{margin-bottom:4px;} table{width:100%;border-collapse:collapse;margin-top:12px;} th,td{border:1px solid #ccc;padding:8px 10px;text-align:left;font-size:13px;} th{background:#f1f5f9;font-weight:600;} .meta{font-size:12px;color:#64748b;margin-bottom:12px;}</style></head><body>');
  win.document.write('<h2>Locations</h2>');
  win.document.write('<div class="meta">Printed: ' + new Date().toLocaleString() + ' | ' + allLocations.length + ' locations</div>');
  var search = (document.getElementById('cmLocSearch').value || '').toLowerCase().trim();
  var filterStatus = document.getElementById('cmLocFilterStatus').value;
  var filtered = allLocations.filter(function(l) {
    var ms = !search || (l.name||'').toLowerCase().indexOf(search)!==-1 || (l.code||'').toLowerCase().indexOf(search)!==-1 || (l.city||'').toLowerCase().indexOf(search)!==-1 || (l.address||'').toLowerCase().indexOf(search)!==-1;
    var mf = !filterStatus || (l.status||'').toLowerCase() === filterStatus.toLowerCase();
    return ms && mf;
  });
  filtered.sort(function(a,b) { var av=(a[locSort.key]||'').toString().toLowerCase(), bv=(b[locSort.key]||'').toString().toLowerCase(); return av<bv?-1:av>bv?1:0; });
  var html = '<table><thead><tr>';
  visibleCols.forEach(function(c) { if (c.key !== 'actions') html += '<th>' + c.label + '</th>'; });
  html += '</tr></thead><tbody>';
  filtered.forEach(function(l) {
    html += '<tr>';
    visibleCols.forEach(function(c) {
      if (c.key === 'actions') return;
      html += '<td>' + (l[c.key] !== undefined && l[c.key] !== null && l[c.key] !== '' ? l[c.key] : '\u2014') + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  win.document.write(html);
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 300);
}

// ============================================================
// PURPOSE & INSTRUCTIONS MODALS
// ============================================================
var CM_MODAL_CONTENT = {
  overview: {
    purpose: 'The <strong>Company Profile</strong> page is the central hub for managing your organization\'s structural hierarchy. From here, administrators can create, edit, and manage <strong>Divisions</strong> and <strong>Locations</strong> that define how the organization is segmented for reporting, asset assignment, and operational oversight.',
    instructions: '<ol><li><strong>Overview Tab:</strong> View a summary of your organization\'s divisions and locations at a glance.</li><li><strong>Divisions Tab:</strong> Create new divisions, search and filter existing ones, edit or delete divisions. Each division can have a name, code, manager, description, and status.</li><li><strong>Locations Tab:</strong> Create new locations, search and filter existing ones, edit or delete locations. Each location can have a name, code, type, address, city, state, zip code, assigned division, and status.</li><li><strong>Add Division/Location:</strong> Use the respective "Add" tabs to create new entries with a simple form.</li><li><strong>Print:</strong> Use the "Print List" button on either the Divisions or Locations tab to print the current list.</li></ol>'
  },
  divisions: {
    purpose: 'The <strong>Divisions Tab</strong> allows administrators to define and manage the organizational divisions within the company. Divisions represent high-level segments of the organization (e.g., Operations, Maintenance, Administration) and can be assigned to locations for hierarchical grouping.',
    instructions: '<ol><li><strong>View Divisions:</strong> All divisions for your organization are listed in the table.</li><li><strong>Search:</strong> Use the search box to filter divisions by name, code, or manager.</li><li><strong>Add Division:</strong> Click the "Add Division" tab, fill in the form (name is required), and click "Add Division".</li><li><strong>Edit Division:</strong> Click the edit (pencil) icon next to any division to update its details.</li><li><strong>Delete Division:</strong> Click the delete (trash) icon to remove a division.</li><li><strong>Print List:</strong> Click "Print List" to print the current division table.</li></ol>'
  },
  locations: {
    purpose: 'The <strong>Locations Tab</strong> allows administrators to define and manage physical or logical locations within the organization. Locations can be assigned to a division and include address information for operational planning and asset tracking.',
    instructions: '<ol><li><strong>View Locations:</strong> All locations for your organization are listed in the table.</li><li><strong>Search:</strong> Use the search box to filter locations by name, code, city, or type.</li><li><strong>Add Location:</strong> Click the "Add Location" tab, fill in the form (name is required), and click "Add Location".</li><li><strong>Edit Location:</strong> Click the edit (pencil) icon next to any location to update its details.</li><li><strong>Delete Location:</strong> Click the delete (trash) icon to remove a location.</li><li><strong>Print List:</strong> Click "Print List" to print the current location table.</li></ol>'
  }
};

function getActiveContext() {
  var activeTab = document.querySelector('.cm-tab.active');
  if (activeTab) {
    var tab = activeTab.getAttribute('data-tab');
    if (tab === 'divisions' || tab === 'adddivision') return 'divisions';
    if (tab === 'locations' || tab === 'addlocation') return 'locations';
  }
  return 'overview';
}

function getContextTitle(key) {
  if (key === 'divisions') return 'Divisions';
  if (key === 'locations') return 'Locations';
  return 'Company Profile';
}

function openInfoModal(modal) {
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length > 0) focusable[0].focus();
}

function closeInfoModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function setupInfoModals() {
  var btnPurpose = document.getElementById('btnTabPurpose');
  var btnInstructions = document.getElementById('btnTabInstructions');
  var purposeModal = document.getElementById('purposeModal');
  var instructionsModal = document.getElementById('instructionsModal');

  if (btnPurpose && purposeModal) {
    btnPurpose.addEventListener('click', function () {
      var key = getActiveContext();
      var title = getContextTitle(key);
      var content = CM_MODAL_CONTENT[key] || CM_MODAL_CONTENT.overview;
      var mpt = document.getElementById('purposeModalTitle');
      var mpb = document.getElementById('purposeModalBody');
      if (mpt) mpt.textContent = title + ' - Purpose';
      if (mpb) mpb.innerHTML = content.purpose;
      openInfoModal(purposeModal);
    });
  }

  if (btnInstructions && instructionsModal) {
    btnInstructions.addEventListener('click', function () {
      var key = getActiveContext();
      var title = getContextTitle(key);
      var content = CM_MODAL_CONTENT[key] || CM_MODAL_CONTENT.overview;
      var mit = document.getElementById('instructionsModalTitle');
      var mib = document.getElementById('instructionsModalBody');
      if (mit) mit.textContent = title + ' - Instructions';
      if (mib) mib.innerHTML = content.instructions;
      openInfoModal(instructionsModal);
    });
  }

  document.querySelectorAll('.info-modal-backdrop').forEach(function (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) closeInfoModal(modal); });
    var closeBtns = modal.querySelectorAll('[data-dismiss="info-modal"]');
    closeBtns.forEach(function (btn) { btn.addEventListener('click', function () { closeInfoModal(modal); }); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var active = document.querySelector('.info-modal-backdrop.active');
      if (active) closeInfoModal(active);
    }
  });
}

// ============================================================
// WELCOME CARD POPULATION
// ============================================================
function populateWelcomeCard() {
  var user = window.dashUser;
  if (!user) return;
  var nameEl = document.getElementById('cmWelcomeName');
  var roleEl = document.getElementById('cmWelcomeRole');
  var emailEl = document.getElementById('cmWelcomeEmail');
  if (nameEl) {
    var firstName = user.first_name || user.firstName || user.name || '';
    var orgName = user.org_name || user.orgName || '';
    nameEl.textContent = firstName ? ('Welcome back, ' + firstName + (orgName ? ' - ' + orgName : '')) : 'Welcome back';
  }
  if (roleEl) roleEl.textContent = user.role || user.role_name || 'Administrator';
  if (emailEl) emailEl.textContent = user.email || '';
}
