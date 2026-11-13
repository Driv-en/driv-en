/**
 * fuel-alerts.js -- DRIV-EN Fuel Alerts page logic (v2)
 *
 * Extracted from fuel-alerts.html inline script.
 * Handles: fuel capacity flags, consumption anomalies, employee tank fills,
 * email notification settings, flag resolution.
 *
 * v2 changes: All inline onclick/onchange handlers removed from HTML.
 *   Everything wired via addEventListener + event delegation.
 *
 * Includes rebuildHeader() to handle stale 3-row SW header template.
 *
 * Load order: auth-check.js -> dashboard-common.js -> units-global.js -> apply-units.js -> voice.js -> this file
 */

// ============================================================
// STATE
// ============================================================
var currentFilter = 'open';
var allFlags = [];

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
  html += '<div class="admin-header-title" style="flex:1;text-align:center;font-size:20px;font-weight:600;color:var(--text);">Fuel Alerts</div>';

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
// FLAG LOADING & RENDERING
// ============================================================
async function loadFlags() {
  try {
    var resp = await fetch('/api/fuel-flags');
    var data = await resp.json();
    if (data.success) {
      allFlags = data.flags || [];
      renderFlags();
    } else {
      document.getElementById('flagsList').innerHTML = '<div class="empty-state">Failed to load flags.</div>';
    }
  } catch (e) {
    document.getElementById('flagsList').innerHTML = '<div class="empty-state">Error: ' + esc(e.message) + '</div>';
  }
}

function renderFlags() {
  var filtered = allFlags;
  if (currentFilter === 'open') filtered = allFlags.filter(function(f) { return f.status === 'open'; });
  else if (currentFilter === 'resolved') filtered = allFlags.filter(function(f) { return f.status === 'resolved'; });
  else if (currentFilter !== 'all') filtered = allFlags.filter(function(f) { return f.flag_type === currentFilter; });

  if (filtered.length === 0) {
    document.getElementById('flagsList').innerHTML = '<div class="empty-state">No fuel alerts found.</div>';
    return;
  }

  document.getElementById('flagsList').innerHTML = filtered.map(function(f) {
    var sevClass = f.severity || 'warning';
    var resolved = f.status === 'resolved';
    var date = new Date(f.created_at).toLocaleString();
    var html = '<div class="flag-card ' + sevClass + (resolved ? ' resolved' : '') + '">';
    html += '<div class="flag-header">';
    html += '<span class="flag-type ' + f.flag_type + '">' + f.flag_type.replace(/_/g, ' ') + '</span>';
    html += resolved ? '<span class="flag-resolved-badge">Resolved by ' + esc(f.resolved_by || '\u2014') + '</span>' : '';
    html += '</div>';
    html += '<div class="flag-message" data-voice-read>' + esc(f.message || '') + '</div>';
    html += '<div class="flag-meta">';
    if (f.asset_name) html += '<span>Asset: ' + esc(f.asset_name) + '</span>';
    if (f.tank_name) html += '<span>Tank: ' + esc(f.tank_name) + '</span>';
    html += '<span>' + date + '</span>';
    html += '</div>';
    if (!resolved) {
      html += '<div class="flag-actions">';
      html += '<input type="text" class="flag-resolve-input" id="notes-' + f.id + '" placeholder="Resolution notes..." data-voice-input>';
      html += '<button class="flag-resolve-btn" data-resolve-id="' + f.id + '">Resolve</button>';
      html += '</div>';
    }
    if (resolved && f.resolution_notes) {
      html += '<div style="margin-top:6px;font-size:12px;color:var(--text-muted);">Notes: ' + esc(f.resolution_notes) + '</div>';
    }
    html += '</div>';
    return html;
  }).join('');

  // Wire up voice on newly rendered content
  if (window.DRIVEN_VOICE) {
    try { DRIVEN_VOICE.init(); } catch (e) {}
  }
}

// ============================================================
// FLAG RESOLUTION
// ============================================================
async function resolveFlag(id) {
  var notesEl = document.getElementById('notes-' + id);
  var notes = notesEl ? notesEl.value : '';
  try {
    var resp = await fetch('/api/fuel-flags/' + id + '/resolve', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_notes: notes })
    });
    var data = await resp.json();
    if (data.success) {
      loadFlags();
    } else {
      alert('Failed to resolve: ' + (data.error || 'Unknown error'));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ============================================================
// FILTERING
// ============================================================
function filterFlags(type, btn) {
  currentFilter = type;
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderFlags();
}

// ============================================================
// SETTINGS
// ============================================================
async function loadSettings() {
  try {
    var resp = await fetch('/api/org-settings');
    var data = await resp.json();
    if (data.success && data.settings) {
      document.getElementById('toggleCapacity').checked = !!data.settings.notify_capacity_flags_email;
      document.getElementById('toggleConsumption').checked = !!data.settings.notify_consumption_flags_email;
      document.getElementById('toggleEmployee').checked = !!data.settings.notify_employee_tank_flags_email;
      document.getElementById('toggleManager').checked = !!data.settings.notify_equipment_manager_email;
    }
  } catch (e) { console.error('Settings load error:', e); }
}

async function saveSettings() {
  try {
    await fetch('/api/org-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notify_capacity_flags_email: document.getElementById('toggleCapacity').checked,
        notify_equipment_manager_email: document.getElementById('toggleManager').checked,
        notify_consumption_flags_email: document.getElementById('toggleConsumption').checked,
        notify_employee_tank_flags_email: document.getElementById('toggleEmployee').checked
      })
    });
  } catch (e) { console.error('Settings save error:', e); }
}

// ============================================================
// STATIC EVENT WIRING (replaces inline onclick/onchange)
// ============================================================
function bindStaticEvents() {
  // Logout button
  var logoutBtn = document.getElementById('faLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      if (typeof dashLogout === 'function') dashLogout();
    });
  }

  // Toggle switches -- save on change
  ['toggleCapacity', 'toggleConsumption', 'toggleEmployee', 'toggleManager'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', saveSettings);
  });

  // Filter buttons -- use data-filter attribute
  document.querySelectorAll('.filter-btn[data-filter]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterFlags(btn.getAttribute('data-filter'), btn);
    });
  });

  // Event delegation for dynamically generated resolve buttons
  document.getElementById('flagsList').addEventListener('click', function(e) {
    var btn = e.target.closest('.flag-resolve-btn');
    if (btn) {
      var id = btn.getAttribute('data-resolve-id');
      if (id) resolveFlag(id);
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

  // Wire static events now that dashboard is visible
  bindStaticEvents();

  loadSettings();
  loadFlags();

  // Wire up voice
  if (window.DRIVEN_VOICE) {
    try { DRIVEN_VOICE.init(); } catch (e) {}
  }
});

window.addEventListener('load', function() {
  rebuildHeader();
  setTimeout(rebuildHeader, 200);
});
