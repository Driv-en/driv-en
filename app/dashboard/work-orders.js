/**
 * work-orders.js — DRIV-EN Work Orders page logic
 *
 * Fetches work orders from /api/work-orders, renders sortable/filterable table,
 * and shows detail view with checklist and parts.
 *
 * @requires auth-check.js, dashboard-common.js
 */

(function() {
  'use strict';

  /* ===== STATE ===== */
  var allWOs = [];
  var filteredWOs = [];
  var woSortCol = 'created_at';
  var woSortDir = 'desc';
  var woSearchText = '';
  var woStatusFilterVal = '';
  var woPriorityFilterVal = '';

  /* ===== HELPERS ===== */
  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function reportError(source, err) {
    var msg = (err && err.message) ? err.message : String(err);
    var stack = (err && err.stack) ? err.stack : '';
    try {
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'Work Orders (' + source + ')',
          error_message: msg,
          stack_trace: stack + '\n--- CONTEXT ---\nURL: ' + window.location.href +
            '\nTime: ' + new Date().toISOString(),
          severity: 'error'
        })
      });
    } catch (e) {}
    console.error('[WorkOrders:' + source + ']', err);
  }

  /* ===== HEADER REBUILD — nuke stale 3-row header, rebuild single row =====
     Copied from admin.js — the admin dashboard uses this exact approach.
     CSS alone doesn't work because dashboard-common.js re-injects the
     stale template async. We must physically replace #dashHeader innerHTML. */
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

  // MutationObserver: rebuild whenever old-layout content is injected
  function startHeaderObserver() {
    var header = document.getElementById('dashHeader');
    if (!header) return;

    var observer = new MutationObserver(function() {
      var h1s = header.querySelectorAll('h1');
      var rows = header.querySelectorAll('.dash-header-row1, .dash-header-row2, .dash-header-row3, .dash-utility-bar');
      if (h1s.length > 1 || rows.length > 1) {
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

  // Kick off header rebuilds immediately
  rebuildHeader();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      rebuildHeader();
      startHeaderObserver();
      scheduleHeaderRebuilds();
    });
  } else {
    startHeaderObserver();
    scheduleHeaderRebuilds();
  }
  window.addEventListener('load', function() { rebuildHeader(); });

  /* ===== LOGOUT OVERRIDE ===== */
  window.dashLogout = function() {
    try { fetch('/auth/logout', { method: 'POST' }); } catch (e) {}
    window.location.href = '/public/login.html';
  };

  /* ===== SORTING ===== */
  function sortWOs(wos, col, dir) {
    var sorted = wos.slice();
    sorted.sort(function(a, b) {
      var av, bv;
      if (col === 'wo_number') { av = (a.wo_number || '').toLowerCase(); bv = (b.wo_number || '').toLowerCase(); }
      else if (col === 'wo_type') { av = (a.wo_type || '').toLowerCase(); bv = (b.wo_type || '').toLowerCase(); }
      else if (col === 'priority') {
        var priOrder = { high: 3, medium: 2, low: 1 };
        av = priOrder[a.priority] || 0; bv = priOrder[b.priority] || 0;
      }
      else if (col === 'status') { av = (a.status || '').toLowerCase(); bv = (b.status || '').toLowerCase(); }
      else if (col === 'assigned_to') { av = (a.assigned_to || '').toLowerCase(); bv = (b.assigned_to || '').toLowerCase(); }
      else { av = a.created_at || ''; bv = b.created_at || ''; }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  /* ===== FILTERING ===== */
  function applyFilters() {
    woStatusFilterVal = document.getElementById('woStatusFilter').value;
    woPriorityFilterVal = document.getElementById('woPriorityFilter').value;
    woSearchText = (document.getElementById('woSearchInput').value || '').toLowerCase();

    filteredWOs = allWOs.filter(function(w) {
      if (woStatusFilterVal && w.status !== woStatusFilterVal) return false;
      if (woPriorityFilterVal && (w.priority || 'low') !== woPriorityFilterVal) return false;
      if (woSearchText) {
        var haystack = [
          w.wo_number, w.wo_type, w.description, w.status, w.priority, w.assigned_to
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(woSearchText)) return false;
      }
      return true;
    });

    renderTable();
  }

  /* ===== RENDER TABLE ===== */
  function renderTable() {
    var container = document.getElementById('woTableContainer');
    var sorted = sortWOs(filteredWOs, woSortCol, woSortDir);

    document.getElementById('woCount').textContent = sorted.length + ' work order' + (sorted.length !== 1 ? 's' : '');

    if (sorted.length === 0) {
      container.innerHTML = '<div class="empty-state">No work orders match your filters.</div>';
      return;
    }

    var html = '<div class="wo-table-wrap">' +
      '<table class="wo-table" id="woTable">' +
        '<thead><tr>' +
          '<th data-col="wo_number" class="sortable">WO # <span class="sort-arrow"></span></th>' +
          '<th data-col="wo_type" class="sortable">Type <span class="sort-arrow"></span></th>' +
          '<th data-col="priority" class="sortable">Priority <span class="sort-arrow"></span></th>' +
          '<th data-col="status" class="sortable">Status <span class="sort-arrow"></span></th>' +
          '<th data-col="assigned_to" class="sortable">Assigned <span class="sort-arrow"></span></th>' +
          '<th data-col="created_at" class="sortable">Date <span class="sort-arrow"></span></th>' +
        '</tr></thead>' +
        '<tbody>';

    sorted.forEach(function(w) {
      var date = w.created_at ? new Date(w.created_at).toLocaleDateString() : '—';
      html += '<tr data-wo-id="' + esc(w.id) + '">' +
        '<td style="font-weight:600;">' + esc(w.wo_number || w.id.slice(0, 8)) + '</td>' +
        '<td>' + esc((w.wo_type || '').replace(/_/g, ' ')) + '</td>' +
        '<td><span class="wo-priority ' + (w.priority || 'low') + '">' + esc(w.priority || 'low') + '</span></td>' +
        '<td><span class="wo-status ' + (w.status || 'open') + '">' + esc(w.status || 'open') + '</span></td>' +
        '<td>' + esc(w.assigned_to || '—') + '</td>' +
        '<td>' + date + '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    updateWoSortIndicators();

    // Wire up row clicks
    var rows = container.querySelectorAll('tr[data-wo-id]');
    for (var i = 0; i < rows.length; i++) {
      (function(row) {
        row.addEventListener('click', function() { showDetail(row.getAttribute('data-wo-id')); });
      })(rows[i]);
    }

    // Wire up sort header clicks
    var ths = container.querySelectorAll('th.sortable');
    for (var j = 0; j < ths.length; j++) {
      (function(th) {
        th.addEventListener('click', function() { onWoSort(th.getAttribute('data-col')); });
      })(ths[j]);
    }
  }

  function onWoSort(col) {
    if (woSortCol === col) {
      woSortDir = woSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      woSortCol = col;
      woSortDir = 'asc';
    }
    renderTable();
  }

  function updateWoSortIndicators() {
    var container = document.getElementById('woTableContainer');
    if (!container) return;
    var ths = container.querySelectorAll('th.sortable');
    ths.forEach(function(th) { th.classList.remove('sorted-asc', 'sorted-desc'); });
    var th = container.querySelector('th[data-col="' + woSortCol + '"]');
    if (th) th.classList.add(woSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
  }

  /* ===== DETAIL VIEW ===== */
  async function showDetail(id) {
    document.getElementById('woListView').style.display = 'none';
    document.getElementById('woDetailView').style.display = '';
    document.getElementById('woDetail').innerHTML = '<div class="wo-loading">Loading…</div>';

    try {
      var resp = await fetch('/api/work-orders/' + id);
      var data = await resp.json();
      if (data.success && data.work_order) {
        var w = data.work_order;
        var items = data.items || [];
        var parts = data.parts || [];

        var html = '<div class="wo-card">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
        html += '<span style="font-size:15px;font-weight:700;color:var(--text);">' + esc(w.wo_number || w.id.slice(0, 8)) + '</span>';
        html += '<span class="wo-status ' + (w.status || 'open') + '">' + esc(w.status || 'open') + '</span>';
        html += '</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;">';
        html += '<span>Type: ' + esc((w.wo_type || '').replace(/_/g, ' ')) + '</span>';
        html += '<span class="wo-priority ' + (w.priority || 'low') + '">' + esc(w.priority || 'low') + '</span>';
        if (w.assigned_to) html += '<span>Assigned: ' + esc(w.assigned_to) + '</span>';
        if (w.labor_hours != null) html += '<span>Labor: ' + w.labor_hours + 'h</span>';
        html += '</div>';
        if (w.description) html += '<p data-voice-read style="margin-top:10px;font-size:14px;color:var(--text);">' + esc(w.description) + '</p>';
        html += '</div>';

        if (items.length > 0) {
          html += '<div class="section-title">Checklist (' + items.filter(function(i) { return i.status === 'completed'; }).length + '/' + items.length + ')</div>';
          html += '<div class="wo-card" data-voice-read>';
          html += items.map(function(i) {
            var done = i.status === 'completed';
            return '<div class="wo-checklist-item">' +
              '<div class="wo-check-icon ' + (done ? 'completed' : '') + '">' + (done ? '&#x2713;' : '') + '</div>' +
              '<div class="wo-check-text ' + (done ? 'completed' : '') + '">' + esc(i.item_text || '') + '</div>' +
            '</div>';
          }).join('');
          html += '</div>';
        }

        if (parts.length > 0) {
          html += '<div class="section-title">Parts</div>';
          html += '<div class="wo-card" data-voice-read>';
          html += parts.map(function(p) {
            return '<div class="wo-parts">' + (p.quantity || 1) + 'x ' + esc(p.description || p.part_number || '') + (p.part_number ? ' [' + esc(p.part_number) + ']' : '') + '</div>';
          }).join('');
          html += '</div>';
        }

        document.getElementById('woDetail').innerHTML = html;

        // Wire up voice Read Aloud buttons on newly rendered content
        if (window.DRIVEN_VOICE) {
          try { DRIVEN_VOICE.init(); } catch (e) {}
        }
      } else {
        document.getElementById('woDetail').innerHTML = '<div class="empty-state">Failed to load work order.</div>';
      }
    } catch (e) {
      reportError('showDetail', e);
      document.getElementById('woDetail').innerHTML = '<div class="empty-state">Error: ' + esc(e.message) + '</div>';
    }
  }

  function showList() {
    document.getElementById('woListView').style.display = '';
    document.getElementById('woDetailView').style.display = 'none';
  }

  /* ===== LOAD WORK ORDERS ===== */
  async function loadWorkOrders() {
    try {
      var resp = await fetch('/api/work-orders');
      var data = await resp.json();
      if (data.success && data.work_orders) {
        allWOs = data.work_orders;
        applyFilters();
      } else {
        document.getElementById('woTableContainer').innerHTML = '<div class="empty-state">Failed to load work orders.</div>';
      }
    } catch (e) {
      reportError('loadWorkOrders', e);
      document.getElementById('woTableContainer').innerHTML = '<div class="empty-state">Error: ' + esc(e.message) + '</div>';
    }
  }

  /* ===== INIT ===== */
  function handleSessionLoaded() {
    var user = window.dashUser;
    if (!user) return;

    // Rebuild header (catches any stale content injected after our initial rebuild)
    rebuildHeader();
    scheduleHeaderRebuilds();

    // Populate welcome card
    var firstName = user.first_name || user.fullName || user.name || 'User';
    var orgName = user.org_name || user.organization || '';
    var nameEl = document.getElementById('woWelcomeName');
    if (orgName) {
      nameEl.textContent = 'Welcome back, ' + firstName + ' - ' + orgName;
    } else {
      nameEl.textContent = 'Welcome back, ' + firstName;
    }

    document.getElementById('woWelcomeRole').textContent = user.role || user.role_id || '-';
    document.getElementById('woWelcomeEmail').textContent = user.email || '-';

    // Dashboard tab returns to user's main dashboard
    var roleId = (user.role_id || user.role || '').toLowerCase();
    var dashUrl = '/app/dashboard/employee-dashboard.html';
    if (roleId === 'ro-founder') dashUrl = '/app/dashboard/owner-dashboard.html';
    else if (roleId === 'ro-admin') dashUrl = '/app/dashboard/admin.html';
    var homeLink = document.getElementById('dashHomeLink');
    if (homeLink) homeLink.href = dashUrl;

    document.getElementById('loading').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    loadWorkOrders();
  }

  /* ===== WIRE UP EVENTS ===== */
  function attachEventHandlers() {
    var statusFilter = document.getElementById('woStatusFilter');
    var priorityFilter = document.getElementById('woPriorityFilter');
    var searchInput = document.getElementById('woSearchInput');
    var backBtn = document.getElementById('woBackBtn');

    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (priorityFilter) priorityFilter.addEventListener('change', applyFilters);
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (backBtn) backBtn.addEventListener('click', showList);
  }

  /* ===== INIT ===== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      attachEventHandlers();
      document.addEventListener('dashSessionLoaded', handleSessionLoaded);
    });
  } else {
    attachEventHandlers();
    document.addEventListener('dashSessionLoaded', handleSessionLoaded);
  }

  // Global error handler
  window.addEventListener('error', function(e) {
    reportError('window.onerror', e.error || new Error(e.message));
  });
  window.addEventListener('unhandledrejection', function(e) {
    reportError('unhandledrejection', e.reason || new Error('Unhandled promise rejection'));
  });

})();
