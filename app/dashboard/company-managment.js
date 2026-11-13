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

  // Wire up voice
  if (window.DRIVEN_VOICE) {
    try { DRIVEN_VOICE.init(); } catch (e) {}
  }
});

window.addEventListener('load', function() {
  rebuildHeader();
  setTimeout(rebuildHeader, 200);
});
