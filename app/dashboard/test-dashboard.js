/* ==========================================================================
   DRIV-EN Platform — Test Dashboard JavaScript
   File: /app/dashboard/test-dashboard.js
   Minimal page — just verifies the shared header and footer load correctly.
   ========================================================================== */

'use strict';

(function() {
  'use strict';

  // Wait for the session to load, then fill the welcome card
  document.addEventListener('dashSessionLoaded', function(e) {
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
    var header = document.getElementById('dashHeader');
    var footer = document.getElementById('dashFooter');
    var title = document.getElementById('dashPageTitle');
    var logoArea = document.getElementById('dashCustomerLogoArea');

    console.log('[TestDashboard] Header loaded:', header ? header.children.length + ' child element(s)' : 'MISSING');
    console.log('[TestDashboard] Footer loaded:', footer ? 'yes' : 'MISSING');
    console.log('[TestDashboard] Page title element:', title ? '"' + title.textContent + '"' : 'MISSING');
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
