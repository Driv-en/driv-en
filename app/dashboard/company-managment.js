/**
 * company-management.js -- DRIV-EN Company Management page logic (v1)
 *
 * Extracted from company-management.html inline script.
 * Handles: tab switching (Overview, Divisions, Locations), dashboard navigation.
 *
 * Includes rebuildHeader() to handle stale 3-row SW header template.
 * Uses role_id for dashboard redirect (RO-Founder, RO-admin).
 *
 * Load order: auth-check.js -> dashboard-common.js -> units-global.js -> apply-units.js -> voice.js -> this file
 */

// ============================================================
// HEADER REBUILD -- handles stale 3-row SW header template
// ============================================================
function rebuildHeader() {
  var container = document.getElementById('dashHeader');
  if (!container) return;

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
  html += '<div class="admin-header-title" style="flex:1;text-align:center;font-size:20px;font-weight:600;color:var(--text);">Company Management</div>';

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
// TAB SWITCHING
// ============================================================
function switchTab(tab) {
  document.querySelectorAll('.cm-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.cm-tab-content').forEach(function(c) { c.style.display = 'none'; });
  var tabBtn = document.querySelector('.cm-tab[data-tab="' + tab + '"]');
  if (tabBtn) tabBtn.classList.add('active');
  var content = document.getElementById('tab-' + tab);
  if (content) content.style.display = 'block';

  // Re-init voice for newly visible content
  if (window.DRIVEN_VOICE) {
    try { DRIVEN_VOICE.init(); } catch (e) {}
  }
}

// ============================================================
// GO TO MAIN DASHBOARD
// ============================================================
function goToMainDashboard() {
  // Try sessionStorage origin (set by dashboard-common.js)
  var savedOrigin = sessionStorage.getItem('driven_dashboard_origin');
  if (savedOrigin) { window.location.href = savedOrigin; return; }
  // Try referrer (if we came from a dashboard)
  if (document.referrer && document.referrer.indexOf('driv-en.com') !== -1) {
    window.location.href = document.referrer; return;
  }
  // Try role-based redirect (role_id first, then role name)
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
  // Fallback: go to admin dashboard (these pages are linked from admin Quick Links)
  window.location.href = '/app/dashboard/admin.html';
}

// ============================================================
// STATIC EVENT WIRING
// ============================================================
function bindStaticEvents() {
  // Tab buttons
  document.querySelectorAll('.cm-tab[data-tab]').forEach(function(tab) {
    tab.addEventListener('click', function() {
      switchTab(tab.getAttribute('data-tab'));
    });
  });

  // Dashboard link
  var dashLink = document.getElementById('cmDashLink');
  if (dashLink) {
    dashLink.addEventListener('click', goToMainDashboard);
  }

  // Logout button
  var logoutBtn = document.getElementById('cmLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      if (typeof dashLogout === 'function') dashLogout();
    });
  }

  // Module cards (data-tab-link attribute)
  document.querySelectorAll('.cm-module-card[data-tab-link]').forEach(function(card) {
    card.addEventListener('click', function() {
      switchTab(card.getAttribute('data-tab-link'));
    });
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('dashSessionLoaded', function() {
  var user = window.dashUser;
  if (!user) { window.location.href = '/public/login.html'; return; }

  // Rebuild header
  scheduleHeaderRebuilds();
  startHeaderObserver();

  document.getElementById('cmLoading').style.display = 'none';
  document.getElementById('tab-overview').style.display = 'block';

  // Wire static events
  bindStaticEvents();

  // Load clients
  loadClients();

  // Wire up voice
  if (window.DRIVEN_VOICE) {
    try { DRIVEN_VOICE.init(); } catch (e) {}
  }
});

// ============================================================
// CLIENT MANAGEMENT
// ============================================================
var allClients = [];
var editingClientId = null;
var clientPage = 1;
var clientPageSize = 10;

// Normalize API response to flat object
function normalizeClient(r) {
  var f = (r && r.fields && typeof r.fields === 'object') ? r.fields : r;
  return {
    id: r.id || ('cl-' + Math.random().toString(36).substr(2, 9)),
    clientName:  f['Client Name']   || f.client_name   || f.name || '',
    contactName: f['Contact Name']  || f.contact_name  || '',
    contactEmail:f['Contact Email'] || f.contact_email || '',
    contactPhone:f['Contact Phone'] || f.contact_phone || '',
    company:     f['Company']       || f.company       || '',
    address:     f['Address']       || f.address       || '',
    city:        f['City']          || f.city          || '',
    state:       f['State']         || f.state         || '',
    zipCode:     f['Zip Code']      || f.zip_code      || '',
    country:     f['Country']       || f.country       || '',
    industry:    f['Industry']      || f.industry      || '',
    status:      f['Status']        || f.status        || 'Active',
    notes:       f['Notes']         || f.notes         || '',
  };
}

async function loadClients() {
  var tbody = document.getElementById('cmClientTableBody');
  if (!tbody) return;
  tbody.textContent = '';
  var loadingRow = document.createElement('tr');
  var loadingCell = document.createElement('td');
  loadingCell.className = 'cm-empty';
  loadingCell.textContent = 'Loading clients…';
  loadingRow.appendChild(loadingCell);
  tbody.appendChild(loadingRow);

  try {
    var resp = await fetch('/api/Clients');
    var data = await resp.json();
    if (resp.ok && data && data.records) {
      allClients = data.records.map(normalizeClient);
    } else if (resp.status === 401) {
      allClients = [];
      showClientError('Your session has expired. Please log in again.');
      return;
    } else if (resp.status === 403) {
      allClients = [];
      showClientError('You do not have permission to view clients.');
      return;
    } else {
      allClients = [];
      showClientError('Failed to load clients (HTTP ' + resp.status + ').');
      return;
    }
  } catch(e) {
    console.error('loadClients error:', e);
    allClients = [];
    showClientError('Network error — could not reach the server.');
    return;
  }

  renderClientTable();
}

function showClientError(msg) {
  var tbody = document.getElementById('cmClientTableBody');
  if (!tbody) return;
  tbody.textContent = '';
  var row = document.createElement('tr');
  var cell = document.createElement('td');
  cell.className = 'cm-empty';
  cell.style.color = 'var(--error)';
  cell.textContent = msg;
  row.appendChild(cell);
  tbody.appendChild(row);
}

function onClientSearchInput() {
  clearTimeout(window._clientSearchTimer);
  window._clientSearchTimer = setTimeout(function() {
    clientPage = 1;
    renderClientTable();
  }, 200);
}

function renderClientTable() {
  var tbody = document.getElementById('cmClientTableBody');
  if (!tbody) return;
  var search = (document.getElementById('cmClientSearch').value || '').toLowerCase().trim();
  var filterStatus = document.getElementById('cmClientFilterStatus').value;

  var filtered = allClients.filter(function(c) {
    var matchesSearch = !search ||
      (c.clientName && c.clientName.toLowerCase().indexOf(search) !== -1) ||
      (c.contactName && c.contactName.toLowerCase().indexOf(search) !== -1) ||
      (c.company && c.company.toLowerCase().indexOf(search) !== -1) ||
      (c.contactEmail && c.contactEmail.toLowerCase().indexOf(search) !== -1);
    var matchesStatus = !filterStatus || (c.status && c.status.toLowerCase() === filterStatus.toLowerCase());
    return matchesSearch && matchesStatus;
  });

  document.getElementById('cmClientCount').textContent = filtered.length + ' client' + (filtered.length === 1 ? '' : 's');

  var totalPages = Math.max(1, Math.ceil(filtered.length / clientPageSize));
  if (clientPage > totalPages) clientPage = totalPages;
  var startIdx = (clientPage - 1) * clientPageSize;
  var pageItems = filtered.slice(startIdx, startIdx + clientPageSize);

  tbody.textContent = '';
  if (filtered.length === 0) {
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.className = 'cm-empty';
    td.textContent = allClients.length === 0 ? 'No clients found. Add your first client above.' : 'No clients match your search.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    renderClientPagination(0, 1);
    return;
  }

  pageItems.forEach(function(c) {
    var tr = document.createElement('tr');

    function addCell(text) {
      var td = document.createElement('td');
      td.textContent = (text !== undefined && text !== null && text !== '') ? text : '—';
      tr.appendChild(td);
    }

    addCell(c.clientName);
    addCell(c.contactName);
    addCell(c.contactEmail);
    addCell(c.contactPhone);
    addCell(c.company);

    // Status badge
    var statusTd = document.createElement('td');
    if (c.status) {
      var badge = document.createElement('span');
      badge.className = 'cm-badge cm-badge-' + c.status.toLowerCase();
      badge.textContent = c.status;
      statusTd.appendChild(badge);
    } else {
      statusTd.textContent = '—';
    }
    tr.appendChild(statusTd);

    // Actions
    var actionsTd = document.createElement('td');
    actionsTd.className = 'cm-actions';
    var btnEdit = document.createElement('button');
    btnEdit.className = 'cm-table-btn';
    btnEdit.textContent = 'Edit';
    btnEdit.addEventListener('click', function() { openEditClientModal(c.id); });
    actionsTd.appendChild(btnEdit);

    var btnDelete = document.createElement('button');
    btnDelete.className = 'cm-table-btn danger';
    btnDelete.textContent = 'Delete';
    btnDelete.addEventListener('click', function() { deleteClient(c.id); });
    actionsTd.appendChild(btnDelete);
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);
  });

  renderClientPagination(filtered.length, totalPages);
}

function renderClientPagination(totalItems, totalPages) {
  var container = document.getElementById('cmClientPagination');
  if (!container) return;
  container.textContent = '';
  if (totalItems === 0) return;

  var info = document.createElement('span');
  info.className = 'cm-page-info';
  var startIdx = (clientPage - 1) * clientPageSize + 1;
  var endIdx = Math.min(clientPage * clientPageSize, totalItems);
  info.textContent = 'Showing ' + startIdx + '–' + endIdx + ' of ' + totalItems;
  container.appendChild(info);

  var btnsDiv = document.createElement('div');
  btnsDiv.className = 'cm-page-btns';

  var btnPrev = document.createElement('button');
  btnPrev.className = 'cm-page-btn';
  btnPrev.textContent = '◀ Prev';
  btnPrev.disabled = clientPage <= 1;
  btnPrev.addEventListener('click', function() { clientPage--; renderClientTable(); });
  btnsDiv.appendChild(btnPrev);

  for (var p = 1; p <= totalPages && p <= 7; p++) {
    var btn = document.createElement('button');
    btn.className = 'cm-page-btn' + (p === clientPage ? ' active' : '');
    btn.textContent = p;
    btn.addEventListener('click', function(page) { return function() { clientPage = page; renderClientTable(); }; }(p));
    btnsDiv.appendChild(btn);
  }

  var btnNext = document.createElement('button');
  btnNext.className = 'cm-page-btn';
  btnNext.textContent = 'Next ▶';
  btnNext.disabled = clientPage >= totalPages;
  btnNext.addEventListener('click', function() { clientPage++; renderClientTable(); });
  btnsDiv.appendChild(btnNext);

  container.appendChild(btnsDiv);
}

// ===== ADD CLIENT =====
async function addClient() {
  var clientName = document.getElementById('cmClientName').value.trim();
  if (!clientName) { showClientMessage('Please enter a client name.', 'error'); return; }

  var payload = {
    'Client Name': clientName,
    'Contact Name': document.getElementById('cmContactName').value.trim(),
    'Contact Email': document.getElementById('cmContactEmail').value.trim(),
    'Contact Phone': document.getElementById('cmContactPhone').value.trim(),
    'Company': document.getElementById('cmCompany').value.trim(),
    'Industry': document.getElementById('cmIndustry').value.trim(),
    'Address': document.getElementById('cmAddress').value.trim(),
    'City': document.getElementById('cmCity').value.trim(),
    'State': document.getElementById('cmState').value.trim(),
    'Zip Code': document.getElementById('cmZipCode').value.trim(),
    'Status': document.getElementById('cmStatus').value,
    'Notes': document.getElementById('cmNotes').value.trim(),
  };

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
      showClientMessage('Client "' + clientName + '" added.', 'success');
      switchTab('clients');
      return;
    }

    // Clear form
    ['cmClientName','cmContactName','cmContactEmail','cmContactPhone','cmCompany','cmIndustry','cmAddress','cmCity','cmState','cmZipCode','cmNotes'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('cmStatus').value = 'Active';
    showClientMessage('Client "' + clientName + '" added.', 'success');
    clientPage = 1;
    renderClientTable();
    switchTab('clients');
  } catch(e) {
    showClientMessage('Failed to add client: ' + e.message, 'error');
  }
}

// ===== EDIT CLIENT =====
function openEditClientModal(clientId) {
  var client = allClients.find(function(c) { return c.id === clientId; });
  if (!client) return;

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

function closeEditClientModal() {
  document.getElementById('cmEditModal').classList.remove('active');
  editingClientId = null;
}

async function saveEditClient() {
  if (!editingClientId) return;

  var clientName = document.getElementById('cmEditClientName').value.trim();
  if (!clientName) { showClientMessage('Client name is required.', 'error'); return; }

  var payload = {
    'Client Name': clientName,
    'Contact Name': document.getElementById('cmEditContactName').value.trim(),
    'Contact Email': document.getElementById('cmEditContactEmail').value.trim(),
    'Contact Phone': document.getElementById('cmEditContactPhone').value.trim(),
    'Company': document.getElementById('cmEditCompany').value.trim(),
    'Industry': document.getElementById('cmEditIndustry').value.trim(),
    'Address': document.getElementById('cmEditAddress').value.trim(),
    'City': document.getElementById('cmEditCity').value.trim(),
    'State': document.getElementById('cmEditState').value.trim(),
    'Zip Code': document.getElementById('cmEditZipCode').value.trim(),
    'Status': document.getElementById('cmEditStatus').value,
    'Notes': document.getElementById('cmEditNotes').value.trim(),
  };

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
    } else {
      var client = allClients.find(function(c) { return c.id === editingClientId; });
      if (client) {
        Object.assign(client, normalizeClient({ fields: payload, id: editingClientId }));
      }
    }

    showClientMessage('Client "' + clientName + '" updated.', 'success');
    closeEditClientModal();
    renderClientTable();
  } catch(e) {
    showClientMessage('Failed to update client: ' + e.message, 'error');
  }
}

// ===== DELETE CLIENT =====
async function deleteClient(clientId) {
  var client = allClients.find(function(c) { return c.id === clientId; });
  if (!client) return;
  if (!confirm('Delete client "' + (client.clientName || 'Unknown') + '"? This cannot be undone.')) return;

  try {
    var resp = await fetch('/api/Clients/' + encodeURIComponent(clientId), { method: 'DELETE' });
    if (!resp.ok) {
      var data = await resp.json();
      throw new Error(data.error || data.message || 'Delete failed (' + resp.status + ')');
    }

    allClients = allClients.filter(function(c) { return c.id !== clientId; });
    showClientMessage('Client "' + (client.clientName || 'Unknown') + '" deleted.', 'success');
    renderClientTable();
  } catch(e) {
    showClientMessage('Failed to delete client: ' + e.message, 'error');
  }
}

// ===== CLIENT MESSAGE HELPER =====
function showClientMessage(msg, type) {
  var el = document.getElementById('cmClientMessage');
  if (!el) return;
  el.textContent = msg;
  el.className = 'cm-message ' + type;
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 5000);
}

// Close edit modal on overlay click
document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById('cmEditModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeEditClientModal();
    });
  }
});

window.addEventListener('load', function() {
  rebuildHeader();
  setTimeout(rebuildHeader, 200);
});
