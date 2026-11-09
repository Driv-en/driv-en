/**
 * DRIV-EN Platform: Theme & Page Initialization
 * File: /app/shared/theme-init.js
 *
 * Loaded in the <head> of every dashboard page. Handles three tasks:
 *
 * 1. THEME — Reads saved theme from localStorage("driven-theme") and applies
 *    it to <html data-theme="..."> BEFORE the body renders (prevents flash).
 *
 * 2. HEADER TITLE — After the header loads (via dashboard-common.js fetch),
 *    inserts the page title (from body data-page-title) into header row 1,
 *    centered between the org logo and DRIV-EN logo.
 *
 * 3. FOOTER YEAR — After the footer loads (via dashboard-common.js fetch),
 *    updates the copyright year to the current year. Needed because
 *    loadComponent() uses innerHTML which does not execute inline scripts.
 *
 * REQUIREMENTS:
 * - Every dashboard page must include this in the <head>:
 *   <script src="/app/shared/theme-init.js"></script>
 * - Every dashboard page must set data-page-title on the <body> tag:
 *   <body data-page-title="Page Name">
 * - The header must have .dash-header-row1 with 3-column grid layout
 * - The footer must have <span id="dashFooterYear"> element
 */

// 1. Apply theme immediately — runs before body renders
(function() {
  var savedTheme = localStorage.getItem("driven-theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
})();

// 2. After DOM loads, insert header title and update footer year
document.addEventListener("DOMContentLoaded", function() {
  var pageTitle = document.body.getAttribute("data-page-title") || "Dashboard";
  var currentYear = new Date().getFullYear();
  var titleInserted = false;
  var yearUpdated = false;
  var attempts = 0;
  var maxAttempts = 50; // 50 x 100ms = 5 seconds max wait

  function checkAndInsert() {
    attempts++;

    // Insert header title into row 1 (centered between logos)
    if (!titleInserted) {
      var headerRow = document.querySelector(".dash-header-row1");
      if (headerRow) {
        var existing = headerRow.querySelector(".page-header-title");
        if (!existing) {
          var titleEl = document.createElement("div");
          titleEl.className = "page-header-title";
          titleEl.textContent = pageTitle;
          headerRow.appendChild(titleEl);
        }
        titleInserted = true;
      }
    }

    // Update footer year to current year
    if (!yearUpdated) {
      var yearEl = document.getElementById("dashFooterYear");
      if (yearEl) {
        yearEl.textContent = currentYear;
        yearUpdated = true;
      }
    }

    // Keep polling until both are done or max attempts reached
    if ((!titleInserted || !yearUpdated) && attempts < maxAttempts) {
      setTimeout(checkAndInsert, 100);
    }
  }

  checkAndInsert();
});
