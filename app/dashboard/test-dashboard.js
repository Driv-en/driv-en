/* ==========================================================================
   DRIV-EN Platform — Test Dashboard JavaScript
   File: /app/dashboard/test-dashboard.js
   Minimal page — just verifies the shared header and footer load correctly.
   ========================================================================== */

'use strict';

(function() {
  'use strict';

  // Wait for the session to load, then log what we got
  document.addEventListener('dashSessionLoaded', function(e) {
    var user = (e && e.detail) || window.dashUser;
    if (user) {
      console.log('[TestDashboard] Session loaded:', {
        name: user.first_name || '(no name)',
        email: user.email || '(no email)',
        role: user.role || user.role_id || '(no role)',
        org_id: user.org_id || '(no org_id)'
      });
    } else {
      console.warn('[TestDashboard] No session — user may not be logged in');
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

    // Check for leftover utility bar elements (should NOT exist)
    var utilityBar = document.querySelector('.dash-utility-bar');
    var dashLogout = document.getElementById('dashLogoutBtn');
    var dashHome = document.getElementById('dashHomeBtn');
    var dashTheme = document.getElementById('dashThemeCheckbox');

    if (utilityBar) console.warn('[TestDashboard] WARNING: .dash-utility-bar still present in header');
    if (dashLogout) console.warn('[TestDashboard] WARNING: #dashLogoutBtn still present');
    if (dashHome) console.warn('[TestDashboard] WARNING: #dashHomeBtn still present');
    if (dashTheme) console.warn('[TestDashboard] WARNING: #dashThemeCheckbox still present');

    if (!utilityBar && !dashLogout && !dashHome && !dashTheme) {
      console.log('[TestDashboard] ✓ Utility bar correctly removed — no leftover elements');
    }
  });
})();
