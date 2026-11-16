/**
 * company-management.js -- DRIV-EN Company Profile page logic (v5)
 *
 * Handles: tab switching, header rebuild, division CRUD, location CRUD.
 * Load order: auth-check -> dashboard-common -> units -> voice -> translate -> this file
 */

// ============================================================
// HEADER REBUILD
// ============================================================
function rebuildHeader() {
  var container = document.getElementById('dashHeader');
  if (!container) return;
  var html = '<div class="dash-header"><div class="dash-header-row1" style="display:flex;align-items:center;justify-content:space-between;padding:8px 20px;">';
  html += '<div style="flex:0 0 auto;">';
  var logo = localStorage.getItem('driven_logo_url');
  if (logo) { html += '<img src="' + logo + '" alt="Logo" style="max-height:40px;max-width:120px;object-fit:contain;">'; }
  else { html += '<div style="font-size:18px;font-weight:700;color:#2563eb;">DRIV-EN</div>'; }
  html += '</div>';
  html += '<div style="flex:1;text-align:center;font-size:20px;font-weight:600;color:var(--text);">Company Profile</div>';
  html += '<div style="flex:0 0 auto;">';
  if (logo) { html += '<img src="' + logo + '" alt="Logo" style="max-height:40px;max-width:120px;object-fit:contain;">'; }
  else { html += '<div style="font-size:18px;font-weight:700;color:#2563eb;">DRIV-EN</div>'; }
  html += '</div></div></div>';
  container.innerHTML = html;
}

function startHeaderObserver() {
  var container = document.getElementById('dashHeader');
  if (!container) return;
  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        if (added[j].nodeType === 1) {
          var h1s = container.querySelectorAll('h1');
          var rows = container.querySelectorAll('.dash-header-row2, .dash-header-row3');
          if (h1s.length > 1 || rows.length > 0) { rebuildHeader(); return; }
        }
      }
    }
  });
  observer.observe(container, { childList: true, subtree: true });
}

function scheduleHeaderRebuilds() {
  rebuildHeader();
  setTimeout(rebuildHeader, 50); setTimeout(rebuildHeader, 200);
  setTimeout(rebuildHeader, 500); setTimeout(rebuildHeader, 1000);
  setTimeout(rebuildHeader, 2000); setTimeout(rebuildHeader, 3000);
}

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
  var savedOrigin = sessionStorage.getItem('driven_dashboard_origin');
  if (savedOrigin) { window.location.href = savedOrigin; return; }
  if (document.referrer && document.referrer.indexOf('driv-en.com') !== -1) { window.location.href = document.referrer; return; }
  var user = window.dashUser;
  if (user) {
    var role = (user.role || '').toLowerCase();
    var rid = (user.role_id || '').toLowerCase();
    if (role === 'driv-en founder' || role === 'owner' || rid === 'ro-founder') { window.location.href = '/app/dashboard/owner-dashboard.html'; return; }
    if (role === 'admin' || rid === 'ro-admin') { window.location.href = '/app/dashboard/admin.html'; return; }
    window.location.href = '/app/dashboard/employee-dashboard.html'; return;
  }
  window.location.href = '/app/dashboard/admin.html';
}

// ============================================================
// INIT
// ============================================================
var cmPageInitialized = false;
function initPage() {
  if (cmPageInitialized) return true;
  var user = window.dashUser;
  if (!user) return false;
  cmPageInitialized = true;
  scheduleHeaderRebuilds();
  startHeaderObserver();
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
window.addEventListener('load', function() { initPage(); rebuildHeader(); setTimeout(rebuildHeader, 200); });

// ============================================================
// DIVISION MANAGEMENT
// ============================================================
var allDivisions = [];
var editingDivId = null;
var divPage = 1;
var divPageSize = 10;

function normalizeDiv(r) {
  var f = (r && r.fields && typeof r.fields === 'object') ? r.fields : r;
  return {
    id: r.id || ('div-' + Math.random().toString(36).substr(2, 9)),
    name: f['Division Name'] || f.name || '',
    code: f['Division Code'] || f.code || '',
    description: f['Description'] || f.description || '',
    manager: f['Manager'] || f.manager || '',
    status: f['Status'] || f.status || 'Active',
  };
}

async function loadDivisions() {
  var tbody = document.getElementById('cmDivTableBody');
  if (!tbody) return;
  try {
    var resp = await fetch('/api/Divisions');
    var data = await resp.json();
    if (resp.ok && data && data.records) { allDivisions = data.records.map(normalizeDiv); }
    else { allDivisions = []; }
  } catch(e) { allDivisions = []; }
  renderDivTable();
  populateDivisionDropdowns();
}

function populateDivisionDropdowns() {
  var selects = [document.getElementById('cmLocDivision'), document.getElementById('cmEditLocDivision')];
  selects.forEach(function(sel) {
    if (!sel) return;
    var currentVal = sel.value;
    sel.innerHTML = '<option value="">\u2014 None \u2014</option>';
    allDivisions.forEach(function(d) {
      var opt = document.createElement('option');
      opt.value = d.name; opt.textContent = d.name;
      sel.appendChild(opt);
    });
    if (currentVal) sel.value = currentVal;
  });
}

function onDivSearchInput() {
  clearTimeout(window._divSearchTimer);
  window._divSearchTimer = setTimeout(function() { divPage = 1; renderDivTable(); }, 200);
}

function renderDivTable() {
  var tbody = document.getElementById('cmDivTableBody');
  if (!tbody) return;
  var search = (document.getElementById('cmDivSearch').value || '').toLowerCase().trim();
  var filterStatus = document.getElementById('cmDivFilterStatus').value;
  var filtered = allDivisions.filter(function(d) {
    var matchesSearch = !search ||
      (d.name && d.name.toLowerCase().indexOf(search) !== -1) ||
      (d.code && d.code.toLowerCase().indexOf(search) !== -1) ||
      (d.manager && d.manager.toLowerCase().indexOf(search) !== -1);
    var matchesStatus = !filterStatus || (d.status && d.status.toLowerCase() === filterStatus.toLowerCase());
    return matchesSearch && matchesStatus;
  });
  document.getElementById('cmDivCount').textContent = filtered.length + ' division' + (filtered.length === 1 ? '' : 's');
  var totalPages = Math.max(1, Math.ceil(filtered.length / divPageSize));
  if (divPage > totalPages) divPage = totalPages;
  var startIdx = (divPage - 1) * divPageSize;
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
  pageItems.forEach(function(d) {
    var tr = document.createElement('tr');
    function addCell(text) { var td = document.createElement('td'); td.textContent = (text !== undefined && text !== null && text !== '') ? text : '\u2014'; tr.appendChild(td); }
    addCell(d.name); addCell(d.code); addCell(d.manager);
    var statusTd = document.createElement('td');
    if (d.status) { var badge = document.createElement('span'); badge.className = 'cm-badge cm-badge-' + d.status.toLowerCase(); badge.textContent = d.status; statusTd.appendChild(badge); }
    else { statusTd.textContent = '\u2014'; }
    tr.appendChild(statusTd);
    var actionsTd = document.createElement('td'); actionsTd.className = 'cm-actions';
    var btnEdit = document.createElement('button'); btnEdit.className = 'cm-table-btn'; btnEdit.textContent = 'Edit';
    btnEdit.addEventListener('click', function() { openEditDivModal(d.id); }); actionsTd.appendChild(btnEdit);
    var btnDelete = document.createElement('button'); btnDelete.className = 'cm-table-btn danger'; btnDelete.textContent = 'Delete';
    btnDelete.addEventListener('click', function() { deleteDivision(d.id); }); actionsTd.appendChild(btnDelete);
    tr.appendChild(actionsTd); tbody.appendChild(tr);
  });
  renderDivPagination(filtered.length, totalPages);
}

function renderDivPagination(totalItems, totalPages) {
  var container = document.getElementById('cmDivPagination');
  if (!container) return; container.textContent = '';
  if (totalItems === 0) return;
  var info = document.createElement('span'); info.className = 'cm-page-info';
  var startIdx = (divPage - 1) * divPageSize + 1;
  var endIdx = Math.min(divPage * divPageSize, totalItems);
  info.textContent = 'Showing ' + startIdx + '\u2013' + endIdx + ' of ' + totalItems;
  container.appendChild(info);
  var btnsDiv = document.createElement('div'); btnsDiv.className = 'cm-page-btns';
  var btnPrev = document.createElement('button'); btnPrev.className = 'cm-page-btn'; btnPrev.textContent = '\u25C0 Prev'; btnPrev.disabled = divPage <= 1;
  btnPrev.addEventListener('click', function() { divPage--; renderDivTable(); }); btnsDiv.appendChild(btnPrev);
  for (var p = 1; p <= totalPages && p <= 7; p++) {
    var btn = document.createElement('button'); btn.className = 'cm-page-btn' + (p === divPage ? ' active' : ''); btn.textContent = p;
    btn.addEventListener('click', function(page) { return function() { divPage = page; renderDivTable(); }; }(p));
    btnsDiv.appendChild(btn);
  }
  var btnNext = document.createElement('button'); btnNext.className = 'cm-page-btn'; btnNext.textContent = 'Next \u25B6'; btnNext.disabled = divPage >= totalPages;
  btnNext.addEventListener('click', function() { divPage++; renderDivTable(); }); btnsDiv.appendChild(btnNext);
  container.appendChild(btnsDiv);
}

async function addDivision() {
  var name = document.getElementById('cmDivName').value.trim();
  if (!name) { showDivMessage('Please enter a division name.', 'error'); return; }
  var payload = {
    'Division Name': name,
    'Division Code': document.getElementById('cmDivCode').value.trim(),
    'Manager': document.getElementById('cmDivManager').value.trim(),
    'Description': document.getElementById('cmDivDescription').value.trim(),
    'Status': document.getElementById('cmDivStatus').value,
  };
  try {
    var resp = await fetch('/api/Divisions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Save failed (' + resp.status + ')');
    if (data.record) { allDivisions.push(normalizeDiv(data.record)); } else { await loadDivisions(); }
    ['cmDivName','cmDivCode','cmDivManager','cmDivDescription'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('cmDivStatus').value = 'Active';
    showDivMessage('Division "' + name + '" added.', 'success');
    divPage = 1; renderDivTable(); populateDivisionDropdowns(); switchTab('divisions');
  } catch(e) { showDivMessage('Failed to add division: ' + e.message, 'error'); }
}

function openEditDivModal(id) {
  var d = allDivisions.find(function(x) { return x.id === id; });
  if (!d) return;
  editingDivId = id;
  document.getElementById('cmEditDivName').value = d.name || '';
  document.getElementById('cmEditDivCode').value = d.code || '';
  document.getElementById('cmEditDivManager').value = d.manager || '';
  document.getElementById('cmEditDivDescription').value = d.description || '';
  document.getElementById('cmEditDivStatus').value = d.status || 'Active';
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
    'Manager': document.getElementById('cmEditDivManager').value.trim(),
    'Description': document.getElementById('cmEditDivDescription').value.trim(),
    'Status': document.getElementById('cmEditDivStatus').value,
  };
  try {
    var resp = await fetch('/api/Divisions/' + encodeURIComponent(editingDivId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Update failed (' + resp.status + ')');
    if (data.record) { var updated = normalizeDiv(data.record); var idx = allDivisions.findIndex(function(x) { return x.id === editingDivId; }); if (idx !== -1) allDivisions[idx] = updated; }
    showDivMessage('Division "' + name + '" updated.', 'success');
    closeEditDivModal(); renderDivTable(); populateDivisionDropdowns();
  } catch(e) { showDivMessage('Failed to update division: ' + e.message, 'error'); }
}

async function deleteDivision(id) {
  var d = allDivisions.find(function(x) { return x.id === id; });
  if (!d) return;
  if (!confirm('Delete division "' + (d.name || 'Unknown') + '"? This cannot be undone.')) return;
  try {
    var resp = await fetch('/api/Divisions/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!resp.ok) { var data = await resp.json(); throw new Error(data.error || data.message || 'Delete failed (' + resp.status + ')'); }
    allDivisions = allDivisions.filter(function(x) { return x.id !== id; });
    showDivMessage('Division "' + (d.name || 'Unknown') + '" deleted.', 'success');
    renderDivTable(); populateDivisionDropdowns();
  } catch(e) { showDivMessage('Failed to delete division: ' + e.message, 'error'); }
}

function showDivMessage(msg, type) {
  var el = document.getElementById('cmDivMessage');
  if (!el) return; el.textContent = msg; el.className = 'cm-message ' + type; el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 5000);
}

// ============================================================
// LOCATION MANAGEMENT
// ============================================================
var allLocations = [];
var editingLocId = null;
var locPage = 1;
var locPageSize = 10;

function normalizeLoc(r) {
  var f = (r && r.fields && typeof r.fields === 'object') ? r.fields : r;
  return {
    id: r.id || ('loc-' + Math.random().toString(36).substr(2, 9)),
    name: f['Location Name'] || f.name || '',
    code: f['Location Code'] || f.code || '',
    type: f['Type'] || f.type || '',
    address: f['Address'] || f.address || '',
    city: f['City'] || f.city || '',
    state: f['State'] || f.state || '',
    zipCode: f['Zip Code'] || f.zip_code || '',
    division: f['Division'] || f.division || '',
    status: f['Status'] || f.status || 'Active',
  };
}

async function loadLocations() {
  var tbody = document.getElementById('cmLocTableBody');
  if (!tbody) return;
  try {
    var resp = await fetch('/api/Locations');
    var data = await resp.json();
    if (resp.ok && data && data.records) { allLocations = data.records.map(normalizeLoc); }
    else { allLocations = []; }
  } catch(e) { allLocations = []; }
  renderLocTable();
}

function onLocSearchInput() {
  clearTimeout(window._locSearchTimer);
  window._locSearchTimer = setTimeout(function() { locPage = 1; renderLocTable(); }, 200);
}

function renderLocTable() {
  var tbody = document.getElementById('cmLocTableBody');
  if (!tbody) return;
  var search = (document.getElementById('cmLocSearch').value || '').toLowerCase().trim();
  var filterStatus = document.getElementById('cmLocFilterStatus').value;
  var filtered = allLocations.filter(function(l) {
    var matchesSearch = !search ||
      (l.name && l.name.toLowerCase().indexOf(search) !== -1) ||
      (l.code && l.code.toLowerCase().indexOf(search) !== -1) ||
      (l.city && l.city.toLowerCase().indexOf(search) !== -1) ||
      (l.address && l.address.toLowerCase().indexOf(search) !== -1);
    var matchesStatus = !filterStatus || (l.status && l.status.toLowerCase() === filterStatus.toLowerCase());
    return matchesSearch && matchesStatus;
  });
  document.getElementById('cmLocCount').textContent = filtered.length + ' location' + (filtered.length === 1 ? '' : 's');
  var totalPages = Math.max(1, Math.ceil(filtered.length / locPageSize));
  if (locPage > totalPages) locPage = totalPages;
  var startIdx = (locPage - 1) * locPageSize;
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
  pageItems.forEach(function(l) {
    var tr = document.createElement('tr');
    function addCell(text) { var td = document.createElement('td'); td.textContent = (text !== undefined && text !== null && text !== '') ? text : '\u2014'; tr.appendChild(td); }
    addCell(l.name); addCell(l.code); addCell(l.type); addCell(l.city); addCell(l.state); addCell(l.division);
    var statusTd = document.createElement('td');
    if (l.status) { var badge = document.createElement('span'); badge.className = 'cm-badge cm-badge-' + l.status.toLowerCase(); badge.textContent = l.status; statusTd.appendChild(badge); }
    else { statusTd.textContent = '\u2014'; }
    tr.appendChild(statusTd);
    var actionsTd = document.createElement('td'); actionsTd.className = 'cm-actions';
    var btnEdit = document.createElement('button'); btnEdit.className = 'cm-table-btn'; btnEdit.textContent = 'Edit';
    btnEdit.addEventListener('click', function() { openEditLocModal(l.id); }); actionsTd.appendChild(btnEdit);
    var btnDelete = document.createElement('button'); btnDelete.className = 'cm-table-btn danger'; btnDelete.textContent = 'Delete';
    btnDelete.addEventListener('click', function() { deleteLocation(l.id); }); actionsTd.appendChild(btnDelete);
    tr.appendChild(actionsTd); tbody.appendChild(tr);
  });
  renderLocPagination(filtered.length, totalPages);
}

function renderLocPagination(totalItems, totalPages) {
  var container = document.getElementById('cmLocPagination');
  if (!container) return; container.textContent = '';
  if (totalItems === 0) return;
  var info = document.createElement('span'); info.className = 'cm-page-info';
  var startIdx = (locPage - 1) * locPageSize + 1;
  var endIdx = Math.min(locPage * locPageSize, totalItems);
  info.textContent = 'Showing ' + startIdx + '\u2013' + endIdx + ' of ' + totalItems;
  container.appendChild(info);
  var btnsDiv = document.createElement('div'); btnsDiv.className = 'cm-page-btns';
  var btnPrev = document.createElement('button'); btnPrev.className = 'cm-page-btn'; btnPrev.textContent = '\u25C0 Prev'; btnPrev.disabled = locPage <= 1;
  btnPrev.addEventListener('click', function() { locPage--; renderLocTable(); }); btnsDiv.appendChild(btnPrev);
  for (var p = 1; p <= totalPages && p <= 7; p++) {
    var btn = document.createElement('button'); btn.className = 'cm-page-btn' + (p === locPage ? ' active' : ''); btn.textContent = p;
    btn.addEventListener('click', function(page) { return function() { locPage = page; renderLocTable(); }; }(p));
    btnsDiv.appendChild(btn);
  }
  var btnNext = document.createElement('button'); btnNext.className = 'cm-page-btn'; btnNext.textContent = 'Next \u25B6'; btnNext.disabled = locPage >= totalPages;
  btnNext.addEventListener('click', function() { locPage++; renderLocTable(); }); btnsDiv.appendChild(btnNext);
  container.appendChild(btnsDiv);
}

async function addLocation() {
  var name = document.getElementById('cmLocName').value.trim();
  if (!name) { showLocMessage('Please enter a location name.', 'error'); return; }
  var payload = {
    'Location Name': name,
    'Location Code': document.getElementById('cmLocCode').value.trim(),
    'Type': document.getElementById('cmLocType').value,
    'Division': document.getElementById('cmLocDivision').value,
    'Address': document.getElementById('cmLocAddress').value.trim(),
    'City': document.getElementById('cmLocCity').value.trim(),
    'State': document.getElementById('cmLocState').value.trim(),
    'Zip Code': document.getElementById('cmLocZipCode').value.trim(),
    'Status': document.getElementById('cmLocStatus').value,
  };
  try {
    var resp = await fetch('/api/Locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Save failed (' + resp.status + ')');
    if (data.record) { allLocations.push(normalizeLoc(data.record)); } else { await loadLocations(); }
    ['cmLocName','cmLocCode','cmLocAddress','cmLocCity','cmLocState','cmLocZipCode'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('cmLocType').value = ''; document.getElementById('cmLocDivision').value = ''; document.getElementById('cmLocStatus').value = 'Active';
    showLocMessage('Location "' + name + '" added.', 'success');
    locPage = 1; renderLocTable(); switchTab('locations');
  } catch(e) { showLocMessage('Failed to add location: ' + e.message, 'error'); }
}

function openEditLocModal(id) {
  var l = allLocations.find(function(x) { return x.id === id; });
  if (!l) return;
  editingLocId = id;
  document.getElementById('cmEditLocName').value = l.name || '';
  document.getElementById('cmEditLocCode').value = l.code || '';
  document.getElementById('cmEditLocType').value = l.type || '';
  populateDivisionDropdowns();
  document.getElementById('cmEditLocDivision').value = l.division || '';
  document.getElementById('cmEditLocAddress').value = l.address || '';
  document.getElementById('cmEditLocCity').value = l.city || '';
  document.getElementById('cmEditLocState').value = l.state || '';
  document.getElementById('cmEditLocZipCode').value = l.zipCode || '';
  document.getElementById('cmEditLocStatus').value = l.status || 'Active';
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
    'Type': document.getElementById('cmEditLocType').value,
    'Division': document.getElementById('cmEditLocDivision').value,
    'Address': document.getElementById('cmEditLocAddress').value.trim(),
    'City': document.getElementById('cmEditLocCity').value.trim(),
    'State': document.getElementById('cmEditLocState').value.trim(),
    'Zip Code': document.getElementById('cmEditLocZipCode').value.trim(),
    'Status': document.getElementById('cmEditLocStatus').value,
  };
  try {
    var resp = await fetch('/api/Locations/' + encodeURIComponent(editingLocId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Update failed (' + resp.status + ')');
    if (data.record) { var updated = normalizeLoc(data.record); var idx = allLocations.findIndex(function(x) { return x.id === editingLocId; }); if (idx !== -1) allLocations[idx] = updated; }
    showLocMessage('Location "' + name + '" updated.', 'success');
    closeEditLocModal(); renderLocTable();
  } catch(e) { showLocMessage('Failed to update location: ' + e.message, 'error'); }
}

async function deleteLocation(id) {
  var l = allLocations.find(function(x) { return x.id === id; });
  if (!l) return;
  if (!confirm('Delete location "' + (l.name || 'Unknown') + '"? This cannot be undone.')) return;
  try {
    var resp = await fetch('/api/Locations/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!resp.ok) { var data = await resp.json(); throw new Error(data.error || data.message || 'Delete failed (' + resp.status + ')'); }
    allLocations = allLocations.filter(function(x) { return x.id !== id; });
    showLocMessage('Location "' + (l.name || 'Unknown') + '" deleted.', 'success');
    renderLocTable();
  } catch(e) { showLocMessage('Failed to delete location: ' + e.message, 'error'); }
}

function showLocMessage(msg, type) {
  var el = document.getElementById('cmLocMessage');
  if (!el) return; el.textContent = msg; el.className = 'cm-message ' + type; el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 5000);
}

// Modal overlay clicks
document.addEventListener('DOMContentLoaded', function() {
  var dm = document.getElementById('cmEditDivModal');
  if (dm) dm.addEventListener('click', function(e) { if (e.target === dm) closeEditDivModal(); });
  var lm = document.getElementById('cmEditLocModal');
  if (lm) lm.addEventListener('click', function(e) { if (e.target === lm) closeEditLocModal(); });
});
