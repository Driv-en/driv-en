/**
 * transfers.js -- DRIV-EN Transfers page logic (v1)
 *
 * Extracted from transfers.html inline script.
 * Handles: transfer ticket list, filtering, sorting, detail view, warning banners.
 *
 * Includes rebuildHeader() to handle stale 3-row SW header template.
 * Uses role_id for dashboard redirect (RO-Founder, RO-admin).
 * All events wired via addEventListener + event delegation (no inline handlers).
 *
 * Load order: auth-check.js -> dashboard-common.js -> units-global.js -> apply-units.js -> voice.js -> this file
 */

// ============================================================
// STATE
// ============================================================
var allTransfers = [];
var filteredTransfers = [];
var tfSortCol = 'created_at';
var tfSortDir = 'desc';
var tfSearchText = '';
var tfStatusFilterVal = '';
var UNCLOSED_THRESHOLD_HOURS = 12;

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
  html += '<div class="admin-header-title" style="flex:1;text-align:center;font-size:20px;font-weight:600;color:var(--text);">Transfers</div>';

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
// UTILITIES
// ============================================================
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================
// LOGOUT OVERRIDE (async with timeout, matching employee-dashboard pattern)
// ============================================================
window.dashLogout = function() {
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 3000);
    fetch('/auth/logout', { method: 'POST', signal: controller.signal })
      .then(function() { clearTimeout(timeout); })
      .catch(function() { clearTimeout(timeout); });
  } catch (e) {}
  window.location.href = '/public/login.html';
};

// ============================================================
// FLAG LOGIC
// ============================================================
function isOpenTransfer(t) {
  return ['created', 'picked_up', 'in_transit', 'delivered'].includes(t.status);
}

function hoursSince(dateStr) {
  var now = new Date();
  var created = new Date(dateStr);
  return Math.floor((now - created) / (1000 * 60 * 60));
}

function isUnclosedTransfer(t) {
  if (!isOpenTransfer(t)) return false;
  return hoursSince(t.created_at) >= UNCLOSED_THRESHOLD_HOURS;
}

function getDuplicateOpenTransfers() {
  var openByAsset = {};
  allTransfers.forEach(function(t) {
    if (isOpenTransfer(t) && t.asset_id) {
      if (!openByAsset[t.asset_id]) openByAsset[t.asset_id] = [];
      openByAsset[t.asset_id].push(t);
    }
  });
  var duplicates = {};
  Object.keys(openByAsset).forEach(function(assetId) {
    if (openByAsset[assetId].length > 1) {
      openByAsset[assetId].forEach(function(t) { duplicates[t.id] = true; });
    }
  });
  return duplicates;
}

function renderWarnings() {
  var banner = document.getElementById('tfWarningsBanner');
  var list = document.getElementById('tfWarningsList');
  var warnings = [];

  var unclosed = allTransfers.filter(isUnclosedTransfer);
  if (unclosed.length > 0) {
    warnings.push('<strong>' + unclosed.length + ' transfer' + (unclosed.length > 1 ? 's' : '') + '</strong> open for ' + UNCLOSED_THRESHOLD_HOURS + '+ hours: ' +
      unclosed.map(function(t) { return '<a data-jump-id="' + t.id + '">' + esc(t.ticket_number || '\u2014') + '</a>'; }).join(', '));
  }

  var duplicates = getDuplicateOpenTransfers();
  var dupAssetIds = {};
  allTransfers.forEach(function(t) {
    if (duplicates[t.id] && t.asset_id) {
      if (!dupAssetIds[t.asset_id]) dupAssetIds[t.asset_id] = { name: t.asset_name || t.asset_number || 'Unknown', tickets: [] };
      dupAssetIds[t.asset_id].tickets.push(t.ticket_number || '\u2014');
    }
  });
  var dupCount = Object.keys(dupAssetIds).length;
  if (dupCount > 0) {
    var dupDetails = Object.values(dupAssetIds).map(function(d) {
      return d.name + ' (' + d.tickets.join(', ') + ')';
    }).join('; ');
    warnings.push('<strong>' + dupCount + ' asset' + (dupCount > 1 ? 's' : '') + '</strong> with multiple open transfer tickets: ' + dupDetails);
  }

  if (warnings.length > 0) {
    list.innerHTML = warnings.map(function(w) { return '<li>' + w + '</li>'; }).join('');
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
}

// ============================================================
// SORTING
// ============================================================
function sortTransfers(transfers, col, dir) {
  var sorted = transfers.slice();
  sorted.sort(function(a, b) {
    var av, bv;
    if (col === 'ticket_number') { av = (a.ticket_number||'').toLowerCase(); bv = (b.ticket_number||'').toLowerCase(); }
    else if (col === 'asset_name') { av = (a.asset_name||a.asset_number||'').toLowerCase(); bv = (b.asset_name||b.asset_number||'').toLowerCase(); }
    else if (col === 'from_location') { av = (a.from_location||a.from_project_name||'').toLowerCase(); bv = (b.from_location||b.from_project_name||'').toLowerCase(); }
    else if (col === 'to_location') { av = (a.to_location||a.to_project_name||'').toLowerCase(); bv = (b.to_location||b.to_project_name||'').toLowerCase(); }
    else if (col === 'status') { av = (a.status||'').toLowerCase(); bv = (b.status||'').toLowerCase(); }
    else if (col === 'carrier_type') { av = (a.carrier_type||'').toLowerCase(); bv = (b.carrier_type||'').toLowerCase(); }
    else { av = a.created_at||''; bv = b.created_at||''; }
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

// ============================================================
// FILTERING
// ============================================================
function applyFilters() {
  tfStatusFilterVal = document.getElementById('tfStatusFilter').value;
  tfSearchText = (document.getElementById('tfSearchInput').value || '').toLowerCase();

  filteredTransfers = allTransfers.filter(function(t) {
    if (tfStatusFilterVal === 'open') {
      if (!isOpenTransfer(t)) return false;
    } else if (tfStatusFilterVal && t.status !== tfStatusFilterVal) {
      return false;
    }
    if (tfSearchText) {
      var haystack = [
        t.ticket_number, t.asset_name, t.asset_number,
        t.from_location, t.to_location, t.from_project_name,
        t.to_project_name, t.carrier_name, t.status
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(tfSearchText)) return false;
    }
    return true;
  });

  renderTable();
}

// ============================================================
// RENDER TABLE
// ============================================================
function renderTable() {
  var container = document.getElementById('tfTableContainer');
  var sorted = sortTransfers(filteredTransfers, tfSortCol, tfSortDir);

  document.getElementById('tfCount').textContent = sorted.length + ' ticket' + (sorted.length !== 1 ? 's' : '');

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state">No transfer tickets match your filters.</div>';
    return;
  }

  var duplicates = getDuplicateOpenTransfers();

  var html = '<div class="tf-table-wrap">' +
    '<table class="tf-table" id="tfTable">' +
      '<thead><tr>' +
        '<th data-sort="ticket_number" class="sortable">Ticket # <span class="sort-arrow"></span></th>' +
        '<th data-sort="asset_name" class="sortable">Asset <span class="sort-arrow"></span></th>' +
        '<th data-sort="from_location" class="sortable">From <span class="sort-arrow"></span></th>' +
        '<th data-sort="to_location" class="sortable">To <span class="sort-arrow"></span></th>' +
        '<th data-sort="carrier_type" class="sortable">Carrier <span class="sort-arrow"></span></th>' +
        '<th data-sort="status" class="sortable">Status <span class="sort-arrow"></span></th>' +
        '<th data-sort="created_at" class="sortable">Date <span class="sort-arrow"></span></th>' +
      '</tr></thead>' +
      '<tbody>';

  sorted.forEach(function(t) {
    var date = t.created_at ? new Date(t.created_at).toLocaleDateString() : '\u2014';
    var flags = '';
    if (isUnclosedTransfer(t)) {
      flags += '<span class="tf-flag tf-flag-unclosed" title="Open for ' + hoursSince(t.created_at) + ' hours">\u23F0 ' + hoursSince(t.created_at) + 'h</span>';
    }
    if (duplicates[t.id]) {
      flags += '<span class="tf-flag tf-flag-duplicate" title="Asset has multiple open tickets">\u26A0 Dup</span>';
    }
    html += '<tr data-detail-id="' + t.id + '">' +
      '<td style="font-weight:600;">' + esc(t.ticket_number||'\u2014') + flags + '</td>' +
      '<td>' + esc(t.asset_name||t.asset_number||'\u2014') + '</td>' +
      '<td>' + esc(t.from_location||t.from_project_name||'\u2014') + '</td>' +
      '<td>' + esc(t.to_location||t.to_project_name||'\u2014') + '</td>' +
      '<td>' + esc(t.carrier_type === 'third_party' ? '3rd Party' : (t.carrier_type||'\u2014')) + '</td>' +
      '<td><span class="tf-status ' + (t.status||'created') + '">' + esc(t.status||'created') + '</span></td>' +
      '<td>' + date + '</td>' +
    '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;

  updateTfSortIndicators();
}

function onTfSort(col) {
  if (tfSortCol === col) {
    tfSortDir = tfSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    tfSortCol = col;
    tfSortDir = 'asc';
  }
  renderTable();
}

function updateTfSortIndicators() {
  var container = document.getElementById('tfTableContainer');
  if (!container) return;
  var ths = container.querySelectorAll('th.sortable');
  ths.forEach(function(th) { th.classList.remove('sorted-asc', 'sorted-desc'); });
  var th = container.querySelector('th[data-sort="' + tfSortCol + '"]');
  if (th) th.classList.add(tfSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
}

// ============================================================
// DETAIL VIEW
// ============================================================
async function showDetail(id) {
  document.getElementById('tfListView').style.display = 'none';
  document.getElementById('tfDetailView').style.display = '';
  document.getElementById('tfDetail').innerHTML = '<div class="tf-loading">Loading...</div>';

  try {
    var resp = await fetch('/api/transfers/' + id);
    var data = await resp.json();
    if (data.success && data.transfer) {
      var t = data.transfer;
      var events = data.events || [];
      var html = '<div class="tf-detail">';

      var flags = '';
      if (isUnclosedTransfer(t)) {
        var hrs = hoursSince(t.created_at);
        flags += '<span class="tf-flag tf-flag-unclosed">\u23F0 Open ' + hrs + ' hours -- needs closing</span>';
      }
      if (getDuplicateOpenTransfers()[t.id]) {
        flags += '<span class="tf-flag tf-flag-duplicate">\u26A0 Asset has multiple open tickets</span>';
      }

      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
      html += '<span style="font-size:15px;font-weight:700;color:var(--text);">' + esc(t.ticket_number||'\u2014') + flags + '</span>';
      html += '<span class="tf-status ' + (t.status||'created') + '">' + esc(t.status||'created') + '</span>';
      html += '</div>';
      html += '<div style="font-size:12px;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;">';
      html += '<span>From: ' + esc(t.from_location||t.from_project_name||'\u2014') + '</span>';
      html += '<span>To: ' + esc(t.to_location||t.to_project_name||'\u2014') + '</span>';
      html += '<span>Carrier: ' + esc(t.carrier_type||'\u2014') + '</span>';
      if (t.carrier_name) html += '<span>' + esc(t.carrier_name) + '</span>';
      if (t.asset_name) html += '<span>\uD83D\uDCE6 ' + esc(t.asset_name) + '</span>';
      html += '</div>';
      if (t.notes) html += '<p style="margin-top:10px;font-size:13px;color:var(--text-muted);" data-voice-read>Notes: ' + esc(t.notes) + '</p>';
      html += '</div>';

      html += '<div class="section-title">Event Trail</div>';
      html += '<div class="tf-detail">';
      if (events.length === 0) {
        html += '<div class="empty-state">No events recorded.</div>';
      } else {
        html += events.map(function(e) {
          var time = new Date(e.event_at || e.created_at).toLocaleString();
          return '<div class="tf-event">' +
            '<div class="tf-event-dot"></div>' +
            '<div>' +
              '<div class="tf-event-content"><strong>' + esc(e.event_type||'event') + '</strong>' + (e.notes ? ' -- ' + esc(e.notes) : '') + '</div>' +
              '<div class="tf-event-time">' + time + (e.event_by ? ' \u00B7 ' + esc(e.event_by) : '') + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }
      html += '</div>';

      document.getElementById('tfDetail').innerHTML = html;

      // Re-init voice for detail content
      if (window.DRIVEN_VOICE) {
        try { DRIVEN_VOICE.init(); } catch (e) {}
      }
    } else {
      document.getElementById('tfDetail').innerHTML = '<div class="empty-state">Failed to load transfer detail.</div>';
    }
  } catch (e) {
    document.getElementById('tfDetail').innerHTML = '<div class="empty-state">Error: ' + esc(e.message) + '</div>';
  }
}

function showList() {
  document.getElementById('tfListView').style.display = '';
  document.getElementById('tfDetailView').style.display = 'none';
}

// ============================================================
// LOAD TRANSFERS
// ============================================================
async function loadTransfers() {
  try {
    var resp = await fetch('/api/transfers');
    var data = await resp.json();
    if (data.success && data.transfers) {
      allTransfers = data.transfers;
      applyFilters();
      renderWarnings();
    } else {
      document.getElementById('tfTableContainer').innerHTML = '<div class="empty-state">Failed to load transfers.</div>';
    }
  } catch (e) {
    document.getElementById('tfTableContainer').innerHTML = '<div class="empty-state">Error: ' + esc(e.message) + '</div>';
  }
}

// ============================================================
// STATIC EVENT WIRING (replaces inline onclick/onchange/oninput)
// ============================================================
function bindStaticEvents() {
  // Logout button
  var logoutBtn = document.getElementById('tfLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      if (typeof dashLogout === 'function') dashLogout();
    });
  }

  // Status filter -- applyFilters on change
  var statusFilter = document.getElementById('tfStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', applyFilters);
  }

  // Search input -- applyFilters on input
  var searchInput = document.getElementById('tfSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  // Back button
  var backBtn = document.getElementById('tfBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', showList);
  }

  // Event delegation: table row click -> showDetail
  document.getElementById('tfTableContainer').addEventListener('click', function(e) {
    var th = e.target.closest('th[data-sort]');
    if (th) {
      onTfSort(th.getAttribute('data-sort'));
      return;
    }
    var tr = e.target.closest('tr[data-detail-id]');
    if (tr) {
      showDetail(tr.getAttribute('data-detail-id'));
    }
  });

  // Event delegation: warning banner link click -> showDetail
  document.getElementById('tfWarningsList').addEventListener('click', function(e) {
    var link = e.target.closest('a[data-jump-id]');
    if (link) {
      showDetail(link.getAttribute('data-jump-id'));
    }
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

  // Dashboard tab returns to user's main dashboard (role_id first, then role name)
  var role = (user.role || '').toLowerCase();
  var rid = (user.role_id || '').toLowerCase();
  var dashUrl;
  if (role === 'driv-en founder' || role === 'owner' || rid === 'ro-founder') dashUrl = '/app/dashboard/owner-dashboard.html';
  else if (role === 'admin' || rid === 'ro-admin') dashUrl = '/app/dashboard/admin.html';
  else dashUrl = '/app/dashboard/employee-dashboard.html';

  var homeLink = document.getElementById('dashHomeLink');
  if (homeLink) homeLink.href = dashUrl;

  document.getElementById('loading').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  // Wire static events
  bindStaticEvents();

  loadTransfers();

  // Wire up voice
  if (window.DRIVEN_VOICE) {
    try { DRIVEN_VOICE.init(); } catch (e) {}
  }
});

window.addEventListener('load', function() {
  rebuildHeader();
  setTimeout(rebuildHeader, 200);
});
