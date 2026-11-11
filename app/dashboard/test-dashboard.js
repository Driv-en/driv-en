/* ==========================================================================
   DRIV-EN Platform — Test Dashboard JavaScript
   File: /app/dashboard/test-dashboard.js
   Minimal page — just verifies the shared header and footer load correctly.
   ========================================================================== */

'use strict';

(function() {
  'use strict';

  // ===== AGGRESSIVE HEADER CLEANUP =====
  // The service worker may serve a stale dashboard-header.html (old 3-row
  // layout with a duplicate title in Row 2) and a stale dashboard-common.js
  // (without the cleanup code). This function runs from test-dashboard.js
  // (which has a unique ?v= URL the SW can't have cached) and forcibly
  // rebuilds the header as a single row if any old layout is detected.

  function rebuildHeaderIfNeeded() {
    var header = document.getElementById('dashHeader');
    if (!header) return;

    var title = document.body.getAttribute('data-page-title') || 'Dashboard';

    // Check for old 3-row layout: .dash-header-row2, .dash-header-row3, .dash-utility-bar
    var oldRow2 = header.querySelector('.dash-header-row2');
    var oldRow3 = header.querySelector('.dash-header-row3');
    var oldUtil = header.querySelector('.dash-utility-bar');
    var allH1s = header.querySelectorAll('h1');

    if (!oldRow2 && !oldRow3 && !oldUtil && allH1s.length <= 1) {
      console.log('[TestDashboard] Header is already single-row — no rebuild needed');
      return;
    }

    console.warn('[TestDashboard] Old header layout detected — rebuilding as single row', {
      hasRow2: !!oldRow2,
      hasRow3: !!oldRow3,
      hasUtilityBar: !!oldUtil,
      h1Count: allH1s.length
    });

    // Extract existing logo elements
    var logoArea = header.querySelector('#dashCustomerLogoArea');
    var drivenLogo = header.querySelector('.dash-driven-logo') || header.querySelector('img');

    // Build new single-row header
    var dashHeader = header.querySelector('.dash-header') || header;
    dashHeader.innerHTML = '';
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

    // Center: page title (only ONE h1)
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
    console.log('[TestDashboard] ✓ Header rebuilt as single row with title: "' + title + '"');
  }

  // Run after DOM is ready, after dashboard-common.js loads the header,
  // and again after a delay to catch any late SW-injected content.
  function scheduleHeaderCheck() {
    // Check after 100ms (header usually loads via fetch in init())
    setTimeout(rebuildHeaderIfNeeded, 100);
    // Check again after 1s (in case fetch was slow)
    setTimeout(rebuildHeaderIfNeeded, 1000);
    // Check again after 3s (last resort for slow SW cache)
    setTimeout(rebuildHeaderIfNeeded, 3000);
  }

  // ===== SESSION LOADED — fill welcome card =====
  document.addEventListener('dashSessionLoaded', function(e) {
    scheduleHeaderCheck(); // rebuild header after session loads
    var user = (e && e.detail) || window.dashUser;
    if (user) {
      console.log('[TestDashboard] Session loaded:', {
        name: user.first_name || '(no name)',
        email: user.email || '(no email)',
        role: user.role || user.role_id || '(no role)',
        org: user.org_name || '(no org)',
        org_id: user.org_id || '(no org_id)'
      });

      // Fill welcome card
      var nameEl = document.getElementById('testWelcomeName');
      var orgEl = document.getElementById('testWelcomeOrg');
      var titleEl = document.getElementById('testWelcomeTitle');
      var emailEl = document.getElementById('testWelcomeEmail');

      var firstName = user.first_name || '';
      var orgName = user.org_name || '';
      var role = user.role || user.role_name || '';
      var email = user.email || '';

      if (nameEl) {
        nameEl.textContent = firstName ? ('Welcome back, ' + firstName) : 'Welcome back';
      }
      if (orgEl) {
        orgEl.textContent = orgName || '';
      }
      if (titleEl) {
        titleEl.textContent = role || '—';
      }
      if (emailEl) {
        emailEl.textContent = email || '—';
      }
    } else {
      console.warn('[TestDashboard] No session — user may not be logged in');
      var nameEl = document.getElementById('testWelcomeName');
      if (nameEl) nameEl.textContent = 'Not logged in';
    }
  });

  // Verify header elements exist after load
  window.addEventListener('load', function() {
    scheduleHeaderCheck(); // rebuild header after everything loads
    var header = document.getElementById('dashHeader');
    var footer = document.getElementById('dashFooter');
    var title = document.getElementById('dashPageTitle');
    var logoArea = document.getElementById('dashCustomerLogoArea');

    console.log('[TestDashboard] Header loaded:', header ? header.children.length + ' child element(s)' : 'MISSING');
    console.log('[TestDashboard] Footer loaded:', footer ? 'yes' : 'MISSING');
    console.log('[TestDashboard] Page title element:', title ? '"' + title.textContent + '"' : 'MISSING');

    // Check sticky position — should be sticky to the TOP
    if (header) {
      var stickyPos = getComputedStyle(header).position;
      var stickyTop = getComputedStyle(header).top;
      console.log('[TestDashboard] Header position:', stickyPos, 'top:', stickyTop);
      if (stickyPos === 'sticky' && stickyTop === '0px') {
        console.log('[TestDashboard] ✓ Header is sticky to the top');
      } else {
        console.warn('[TestDashboard] WARNING: Header is not sticky-top (position:' + stickyPos + ' top:' + stickyTop + ')');
      }
    }
    console.log('[TestDashboard] Customer logo area:', logoArea ? 'present' : 'MISSING');

    // Check for leftover utility bar elements (should NOT exist in header)
    var utilityBar = document.querySelector('.dash-utility-bar');
    var dashLogout = document.getElementById('dashLogoutBtn');
    var dashHome = document.getElementById('dashHomeBtn');

    if (utilityBar) console.warn('[TestDashboard] WARNING: .dash-utility-bar still present in header');
    if (dashLogout) console.warn('[TestDashboard] WARNING: #dashLogoutBtn still present');
    if (dashHome) console.warn('[TestDashboard] WARNING: #dashHomeBtn still present');

    // Theme toggle SHOULD exist on the page (in the theme bar, not in the header)
    var dashTheme = document.getElementById('dashThemeCheckbox');
    if (dashTheme) {
      console.log('[TestDashboard] ✓ Theme toggle (#dashThemeCheckbox) present and wired');
    } else {
      console.warn('[TestDashboard] WARNING: #dashThemeCheckbox not found — theme toggle missing');
    }

    // Check for duplicate page titles
    var titleElements = document.querySelectorAll('#dashPageTitle');
    if (titleElements.length === 1) {
      console.log('[TestDashboard] ✓ Page title appears exactly once');
    } else if (titleElements.length > 1) {
      console.warn('[TestDashboard] WARNING: #dashPageTitle found ' + titleElements.length + ' times — duplicate title!');
    } else {
      console.warn('[TestDashboard] WARNING: #dashPageTitle not found');
    }

    if (!utilityBar && !dashLogout && !dashHome) {
      console.log('[TestDashboard] ✓ Utility bar correctly removed — no leftover buttons');
    }
  });
})();
