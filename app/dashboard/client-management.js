/**
 * client-management.js — DRIV-EN Client Management (v3)
 * Client CRUD with search, filter, pagination.
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
  var user = window.dashUser; if (!user) return false;
  cmPageInitialized = true;
  loadClients();
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
// CLIENT MANAGEMENT
// ============================================================
var allClients = []; var editingClientId = null; var clientPage = 1; var clientPageSize = 10;

function normalizeClient(r) {
  var f = (r && r.fields && typeof r.fields === 'object') ? r.fields : r;
  return {
    id: r.id || ('cl-' + Math.random().toString(36).substr(2, 9)),
    clientName: f['Client Name'] || f.client_name || f.name || '',
    contactName: f['Contact Name'] || f.contact_name || '',
    contactEmail: f['Contact Email'] || f.contact_email || '',
    contactPhone: f['Contact Phone'] || f.contact_phone || '',
    company: f['Company'] || f.company || '',
    address: f['Address'] || f.address || '', city: f['City'] || f.city || '',
    state: f['State'] || f.state || '', zipCode: f['Zip Code'] || f.zip_code || '',
    industry: f['Industry'] || f.industry || '',
    status: f['Status'] || f.status || 'Active', notes: f['Notes'] || f.notes || '',
  };
}

async function loadClients() {
  var tbody = document.getElementById('cmClientTableBody'); if (!tbody) return;
  try {
    var resp = await fetch('/api/Clients'); var data = await resp.json();
    if (resp.ok && data && data.records) { allClients = data.records.map(normalizeClient); }
    else if (resp.status === 401) { allClients = []; showClientError('Your session has expired. Please log in again.'); return; }
    else if (resp.status === 403) { allClients = []; showClientError('You do not have permission to view clients.'); return; }
    else { allClients = []; }
  } catch(e) { allClients = []; showClientError('Network error \u2014 could not reach the server.'); return; }
  renderClientTable();
}

function showClientError(msg) {
  var tbody = document.getElementById('cmClientTableBody'); if (!tbody) return; tbody.textContent = '';
  var row = document.createElement('tr'); var cell = document.createElement('td');
  cell.className = 'cm-empty'; cell.style.color = 'var(--error)'; cell.textContent = msg;
  row.appendChild(cell); tbody.appendChild(row);
}

function onClientSearchInput() {
  clearTimeout(window._clientSearchTimer);
  window._clientSearchTimer = setTimeout(function() { clientPage = 1; renderClientTable(); }, 200);
}

function renderClientTable() {
  var tbody = document.getElementById('cmClientTableBody'); if (!tbody) return;
  var search = (document.getElementById('cmClientSearch').value || '').toLowerCase().trim();
  var filterStatus = document.getElementById('cmClientFilterStatus').value;
  var filtered = allClients.filter(function(c) {
    var matchesSearch = !search || (c.clientName && c.clientName.toLowerCase().indexOf(search) !== -1) || (c.contactName && c.contactName.toLowerCase().indexOf(search) !== -1) || (c.company && c.company.toLowerCase().indexOf(search) !== -1) || (c.contactEmail && c.contactEmail.toLowerCase().indexOf(search) !== -1);
    var matchesStatus = !filterStatus || (c.status && c.status.toLowerCase() === filterStatus.toLowerCase());
    return matchesSearch && matchesStatus;
  });
  document.getElementById('cmClientCount').textContent = filtered.length + ' client' + (filtered.length === 1 ? '' : 's');
  var totalPages = Math.max(1, Math.ceil(filtered.length / clientPageSize));
  if (clientPage > totalPages) clientPage = totalPages;
  var startIdx = (clientPage - 1) * clientPageSize; var pageItems = filtered.slice(startIdx, startIdx + clientPageSize);
  tbody.textContent = '';
  if (filtered.length === 0) {
    var tr = document.createElement('tr'); var td = document.createElement('td');
    td.className = 'cm-empty'; td.textContent = allClients.length === 0 ? 'No clients found. Add your first client above.' : 'No clients match your search.';
    tr.appendChild(td); tbody.appendChild(tr); renderClientPagination(0, 1); return;
  }
  pageItems.forEach(function(c) {
    var tr = document.createElement('tr');
    function addCell(text) { var td = document.createElement('td'); td.textContent = (text !== undefined && text !== null && text !== '') ? text : '\u2014'; tr.appendChild(td); }
    addCell(c.clientName); addCell(c.contactName); addCell(c.contactEmail); addCell(c.contactPhone); addCell(c.company);
    var statusTd = document.createElement('td');
    if (c.status) { var badge = document.createElement('span'); badge.className = 'cm-badge cm-badge-' + c.status.toLowerCase(); badge.textContent = c.status; statusTd.appendChild(badge); } else { statusTd.textContent = '\u2014'; }
    tr.appendChild(statusTd);
    var actionsTd = document.createElement('td'); actionsTd.className = 'cm-actions';
    var btnEdit = document.createElement('button'); btnEdit.className = 'cm-table-btn'; btnEdit.textContent = 'Edit';
    btnEdit.addEventListener('click', function() { openEditClientModal(c.id); }); actionsTd.appendChild(btnEdit);
    var btnDelete = document.createElement('button'); btnDelete.className = 'cm-table-btn danger'; btnDelete.textContent = 'Delete';
    btnDelete.addEventListener('click', function() { deleteClient(c.id); }); actionsTd.appendChild(btnDelete);
    tr.appendChild(actionsTd); tbody.appendChild(tr);
  });
  renderClientPagination(filtered.length, totalPages);
}

function renderClientPagination(totalItems, totalPages) {
  var container = document.getElementById('cmClientPagination'); if (!container) return; container.textContent = '';
  if (totalItems === 0) return;
  var info = document.createElement('span'); info.className = 'cm-page-info';
  var startIdx = (clientPage - 1) * clientPageSize + 1; var endIdx = Math.min(clientPage * clientPageSize, totalItems);
  info.textContent = 'Showing ' + startIdx + '\u2013' + endIdx + ' of ' + totalItems; container.appendChild(info);
  var btnsDiv = document.createElement('div'); btnsDiv.className = 'cm-page-btns';
  var btnPrev = document.createElement('button'); btnPrev.className = 'cm-page-btn'; btnPrev.textContent = '\u25C0 Prev'; btnPrev.disabled = clientPage <= 1;
  btnPrev.addEventListener('click', function() { clientPage--; renderClientTable(); }); btnsDiv.appendChild(btnPrev);
  for (var p = 1; p <= totalPages && p <= 7; p++) {
    var btn = document.createElement('button'); btn.className = 'cm-page-btn' + (p === clientPage ? ' active' : ''); btn.textContent = p;
    btn.addEventListener('click', function(page) { return function() { clientPage = page; renderClientTable(); }; }(p)); btnsDiv.appendChild(btn);
  }
  var btnNext = document.createElement('button'); btnNext.className = 'cm-page-btn'; btnNext.textContent = 'Next \u25B6'; btnNext.disabled = clientPage >= totalPages;
  btnNext.addEventListener('click', function() { clientPage++; renderClientTable(); }); btnsDiv.appendChild(btnNext);
  container.appendChild(btnsDiv);
}

async function addClient() {
  var clientName = document.getElementById('cmClientName').value.trim();
  if (!clientName) { showClientMessage('Please enter a client name.', 'error'); return; }
  var payload = {
    'Client Name': clientName, 'Contact Name': document.getElementById('cmContactName').value.trim(),
    'Contact Email': document.getElementById('cmContactEmail').value.trim(), 'Contact Phone': document.getElementById('cmContactPhone').value.trim(),
    'Company': document.getElementById('cmCompany').value.trim(), 'Industry': document.getElementById('cmIndustry').value.trim(),
    'Address': document.getElementById('cmAddress').value.trim(), 'City': document.getElementById('cmCity').value.trim(),
    'State': document.getElementById('cmState').value.trim(), 'Zip Code': document.getElementById('cmZipCode').value.trim(),
    'Status': document.getElementById('cmStatus').value, 'Notes': document.getElementById('cmNotes').value.trim(),
  };
  try {
    var resp = await fetch('/api/Clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Save failed (' + resp.status + ')');
    if (data.record) { allClients.push(normalizeClient(data.record)); } else { await loadClients(); showClientMessage('Client "' + clientName + '" added.', 'success'); switchTab('clients'); return; }
    ['cmClientName','cmContactName','cmContactEmail','cmContactPhone','cmCompany','cmIndustry','cmAddress','cmCity','cmState','cmZipCode','cmNotes'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('cmStatus').value = 'Active';
    showClientMessage('Client "' + clientName + '" added.', 'success');
    clientPage = 1; renderClientTable(); switchTab('clients');
  } catch(e) { showClientMessage('Failed to add client: ' + e.message, 'error'); }
}

function openEditClientModal(clientId) {
  var client = allClients.find(function(c) { return c.id === clientId; }); if (!client) return;
  editingClientId = clientId;
  document.getElementById('cmEditClientName').value = client.clientName || '';
  document.getElementById('cmEditContactName').value = client.contactName || '';
  document.getElementById('cmEditContactEmail').value = client.contactEmail || '';
  document.getElementById('cmEditContactPhone').value = client.contactPhone || '';
  document.getElementById('cmEditCompany').value = client.company || '';
  document.getElementById('cmEditIndustry').value = client.industry || '';
  document.getElementById('cmEditAddress').value = client.address || '';
  document.getElementById('cmEditCity').value = client.city || '';
  document.getElementById('cmEditState').value = client.state || '';
  document.getElementById('cmEditZipCode').value = client.zipCode || '';
  document.getElementById('cmEditStatus').value = client.status || 'Active';
  document.getElementById('cmEditNotes').value = client.notes || '';
  document.getElementById('cmEditModal').classList.add('active');
}
function closeEditClientModal() { document.getElementById('cmEditModal').classList.remove('active'); editingClientId = null; }

async function saveEditClient() {
  if (!editingClientId) return;
  var clientName = document.getElementById('cmEditClientName').value.trim();
  if (!clientName) { showClientMessage('Client name is required.', 'error'); return; }
  var payload = {
    'Client Name': clientName, 'Contact Name': document.getElementById('cmEditContactName').value.trim(),
    'Contact Email': document.getElementById('cmEditContactEmail').value.trim(), 'Contact Phone': document.getElementById('cmEditContactPhone').value.trim(),
    'Company': document.getElementById('cmEditCompany').value.trim(), 'Industry': document.getElementById('cmEditIndustry').value.trim(),
    'Address': document.getElementById('cmEditAddress').value.trim(), 'City': document.getElementById('cmEditCity').value.trim(),
    'State': document.getElementById('cmEditState').value.trim(), 'Zip Code': document.getElementById('cmEditZipCode').value.trim(),
    'Status': document.getElementById('cmEditStatus').value, 'Notes': document.getElementById('cmEditNotes').value.trim(),
  };
  try {
    var resp = await fetch('/api/Clients/' + encodeURIComponent(editingClientId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Update failed (' + resp.status + ')');
    if (data.record) { var updated = normalizeClient(data.record); var idx = allClients.findIndex(function(c) { return c.id === editingClientId; }); if (idx !== -1) allClients[idx] = updated; }
    showClientMessage('Client "' + clientName + '" updated.', 'success');
    closeEditClientModal(); renderClientTable();
  } catch(e) { showClientMessage('Failed to update client: ' + e.message, 'error'); }
}

async function deleteClient(clientId) {
  var client = allClients.find(function(c) { return c.id === clientId; }); if (!client) return;
  if (!confirm('Delete client "' + (client.clientName || 'Unknown') + '"? This cannot be undone.')) return;
  try {
    var resp = await fetch('/api/Clients/' + encodeURIComponent(clientId), { method: 'DELETE' });
    if (!resp.ok) { var data = await resp.json(); throw new Error(data.error || data.message || 'Delete failed (' + resp.status + ')'); }
    allClients = allClients.filter(function(c) { return c.id !== clientId; });
    showClientMessage('Client "' + (client.clientName || 'Unknown') + '" deleted.', 'success'); renderClientTable();
  } catch(e) { showClientMessage('Failed to delete client: ' + e.message, 'error'); }
}

function showClientMessage(msg, type) {
  var el = document.getElementById('cmClientMessage'); if (!el) return;
  el.textContent = msg; el.className = 'cm-message ' + type; el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 5000);
}

document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById('cmEditModal');
  if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeEditClientModal(); });
});
