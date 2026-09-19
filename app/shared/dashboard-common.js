/* ==========================================================================
   DRIV‑EN DASHBOARD COMMON JS — Shared across all dashboard pages
   ==========================================================================
   This file is loaded by every dashboard page via:
   <script src="/app/shared/dashboard-common.js?v=7"></script>

   WHAT IT DOES (in order):
   1. Loads the shared dashboard header into <div id="dashHeader"></div>
   2. Sets the page title from <body data-page-title="...">
   3. Loads the customer logo from D1 (syncs across all devices)
   4. Initializes the theme toggle (light/dark mode)
   5. Fills the greeting bar if one exists on the page
   6. Stores the user's org_id in localStorage for API calls

   HOW TO USE:
   1. Include this script on your dashboard page
   2. Make sure <div id="dashHeader"></div> exists in the HTML
   3. Set <body data-page-title="Your Page Title">
   4. (Optional) Add <div class="dash-greeting-bar"><span id="dashGreetingText">Welcome</span></div>
      and it will be auto-filled with "Welcome, [First Name]"

   YOU SHOULD NOT NEED TO EDIT THIS FILE.
   All customization is done per-page via HTML attributes.
   ========================================================================== */

(function() {
  'use strict';

  /* ===== STATE VARIABLES ===== */
  var dashUser = null;  // Will hold the logged-in user object from /auth/session

  /* ===== HELPER: Load an HTML component via fetch ===== */
  // Fetches an HTML file and injects it into a target element
  // Parameters:
  //   elementId — the id of the DOM element to inject HTML into
  //   file      — the URL of the HTML file to fetch
  async function loadComponent(elementId, file) {
    try {
      var el = document.getElementById(elementId);
      if (!el) return;
      var response = await fetch(file);
      var html = await response.text();
      el.innerHTML = html;
    } catch (e) {
      console.error("Failed to load component:", elementId, file, e.message);
    }
  }

  /* ===== THEME TOGGLE ===== */
  // Toggles between light and dark mode
  // Reads current theme from <html data-theme="...">
  // Saves the new theme to localStorage key "driven-theme"
  // Updates the slide switch checkbox and labels
  // This function is called by the header's onchange="dashToggleTheme()"
  window.dashToggleTheme = function() {
    var current = document.documentElement.getAttribute("data-theme");
    var newTheme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("driven-theme", newTheme);
    updateThemeSwitch();
  };

  // Updates the theme switch UI to match the current theme
  // Called on page load and after toggle
  function updateThemeSwitch() {
    var current = document.documentElement.getAttribute("data-theme");
    var checkbox = document.getElementById("dashThemeCheckbox");
    var labelLight = document.getElementById("dashThemeLabelLight");
    var labelDark = document.getElementById("dashThemeLabelDark");
    if (checkbox) checkbox.checked = (current === "dark");
    if (labelLight) labelLight.classList.toggle("active", current === "light");
    if (labelDark) labelDark.classList.toggle("active", current === "dark");
  }

  /* ===== LOGOUT ===== */
  // Calls /auth/logout to destroy the session
  // Then redirects to the login page
  // This function is called by the header's onclick="dashLogout()"
  window.dashLogout = async function() {
    try {
      await fetch("/auth/logout", { method: "POST" });
    } catch (e) {
      // Even if logout fails, redirect to login
      console.error("Logout error:", e.message);
    }
    // Redirect to the correct login page based on role
    var requiredRole = document.body.getAttribute("data-required-role");
    if (requiredRole && requiredRole.toLowerCase().indexOf("founder") !== -1) {
      window.location.href = "/app/auth/founder-login.html";
    } else {
      window.location.href = "/public/login.html";
    }
  };

  /* ===== SET PAGE TITLE ===== */
  // Reads the page title from <body data-page-title="...">
  // and inserts it into the header's <h1 id="dashPageTitle">
  // If no data-page-title is set, defaults to "Dashboard"
  function setPageTitle() {
    var title = document.body.getAttribute("data-page-title") || "Dashboard";
    var titleEl = document.getElementById("dashPageTitle");
    if (titleEl) titleEl.textContent = title;
  }

  /* ===== LOAD CUSTOMER LOGO ===== */
  // Fetches the customer logo from D1 database via /auth/get-logo
  // If a logo is found, it is inserted into the header and cached in localStorage
  // If no logo in D1, falls back to localStorage cache
  // If no logo at all, shows a placeholder
  // This syncs the logo across all devices and employees
  async function loadCustomerLogo() {
    var area = document.getElementById("dashCustomerLogoArea");
    if (!area) return;

    // Try fetching from D1 first
    try {
      var logoRes = await fetch("/auth/get-logo");
      var logoData = await logoRes.json();
      if (logoData.success && logoData.logo) {
        // Logo found in D1 — save to localStorage as cache
        localStorage.setItem("driven_customer_logo", logoData.logo);
        area.innerHTML = '<img src="' + logoData.logo + '" class="dash-customer-logo" alt="Company Logo">';
        return;
      }
    } catch (e) {
      console.error("Logo fetch from D1 error:", e.message);
    }

    // Fallback: check localStorage
    var logoUrl = localStorage.getItem("driven_customer_logo");
    if (logoUrl) {
      area.innerHTML = '<img src="' + logoUrl + '" class="dash-customer-logo" alt="Company Logo">';
    }
    // If no logo at all, the placeholder div stays (it's in the HTML by default)
  }

  /* ===== LOAD SESSION ===== */
  // Fetches the user's session from /auth/session
  // Stores the user object in dashUser (module-level variable)
  // Stores org_id in localStorage for API calls (e.g., key personnel list)
  // Fills the greeting bar if one exists on the page:
  //   <div class="dash-greeting-bar"><span id="dashGreetingText">Welcome</span></div>
  // Returns true if authenticated, false if not
  async function loadSession() {
    try {
      var response = await fetch("/auth/session");
      var data = await response.json();

      if (data.authenticated && data.user) {
        dashUser = data.user;

        // Store org_id in localStorage for API calls
        if (data.user.org_id) {
          localStorage.setItem("driven_customer_id", data.user.org_id);
        }

        // Fill greeting bar if it exists on this page
        var greetingEl = document.getElementById("dashGreetingText");
        if (greetingEl) {
          var firstName = data.user.first_name || "";
          var orgName = data.user.org_name || "";
          if (firstName && orgName) {
            greetingEl.innerHTML = "Welcome, <strong>" + firstName + "</strong> — " + escapeHtml(orgName);
          } else if (firstName) {
            greetingEl.innerHTML = "Welcome, <strong>" + firstName + "</strong>";
          } else {
            greetingEl.innerHTML = "Welcome";
          }
        }

        // Store org name in localStorage for pages that need it
        if (data.user.org_name) {
          localStorage.setItem("driven_org_name", data.user.org_name);
        }

        // Also expose user data on window.dashUser immediately
        // (in addition to the dashSessionLoaded event)
        window.dashUser = data.user;

        // ===== RESOLVE DASHBOARD BUTTON (return to main dashboard) =====
        // Sub-dashboards (fuel, transfers, work-orders, fuel-alerts) are accessed
        // by customer employees with permissions. The Dashboard button returns:
        //   Admin role → admin.html
        //   All other employees → employee-dashboard.html (permission-based)
        var role = (data.user.role || '').toLowerCase();
        var dashUrl;
        if (role === 'admin') {
          dashUrl = '/app/dashboard/admin.html';
        } else {
          dashUrl = '/app/dashboard/employee-dashboard.html';
        }
        var homeBtn = document.getElementById('dashHomeBtn');
        if (homeBtn) {
          homeBtn.href = dashUrl;
        }

        return true;
      }
    } catch (e) {
      console.error("Session load error:", e.message);
    }
    return false;
  }

  /* ===== INIT ===== */
  // Main initialization — runs on DOMContentLoaded
  // 1. Load the shared dashboard header HTML
  // 2. Set the page title from body data-page-title
  // 3. Update the theme switch to match current theme
  // 4. Load the customer logo from D1
  // 5. Load the user session (greeting + org_id)
  async function init() {
    // Step 1: Load the shared header
    await loadComponent("dashHeader", "/app/shared/dashboard-header.html");

    // Step 2: Set the page title from <body data-page-title="...">
    setPageTitle();

    // Step 3: Update theme switch to match current theme
    updateThemeSwitch();

    // Step 4: Load customer logo from D1
    await loadCustomerLogo();

    // Step 5: Load session (greeting + org_id)
    await loadSession();

    // Step 6: Load the shared dashboard footer (if a placeholder exists)
    await loadComponent("dashFooter", "/app/shared/dashboard-footer.html");
  }

  // Run init when the DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // DOM already loaded (script loaded with defer or at end of body)
    init();
  }

  // Expose dashUser globally so page-specific scripts can access it
  // Example: if (window.dashUser) { console.log(dashUser.email); }
  // Note: dashUser is null until loadSession() completes.
  // Page scripts that need it should wait for the "dashReady" event.
  window.addEventListener("dashSessionLoaded", function() {
    window.dashUser = dashUser;
  });

  // Dispatch a custom event after session loads so page scripts know
  // the user info is available
  // Page scripts can listen: document.addEventListener("dashSessionLoaded", myFunction);
  var originalLoadSession = loadSession;
  loadSession = async function() {
    var result = await originalLoadSession();
    document.dispatchEvent(new CustomEvent("dashSessionLoaded", { detail: dashUser }));
    return result;
  };

  /* ===== SLIDING SESSION REFRESH (prevents active users from being logged out) ===== */
  // The auth worker issues a session JWT that expires after SESSION_LIFETIME
  // (currently 3600s = 1 hour).  If the user is actively using the dashboard,
  // we proactively call POST /auth/refresh (which exchanges the long-lived
  // refresh cookie for a fresh session cookie) BEFORE the session expires.
  // The refresh timer resets on user activity (clicks, keys, scroll, touch),
  // so an idle user eventually logs out, but an active user never does.
  var SESSION_REFRESH_MS = 30 * 60 * 1000;   // refresh every 30 minutes
  var SESSION_ACTIVITY_MS = 5 * 60 * 1000;   // reset timer after 5 min of activity
  var sessionRefreshTimer = null;
  var sessionActivityTimer = null;
  var lastSessionActivity = Date.now();

  function scheduleSessionRefresh() {
    if (sessionRefreshTimer) clearTimeout(sessionRefreshTimer);
    sessionRefreshTimer = setTimeout(refreshSessionToken, SESSION_REFRESH_MS);
  }

  async function refreshSessionToken() {
    try {
      var resp = await fetch("/auth/refresh", { method: "POST", credentials: "include" });
      if (resp.ok) {
        // Session cookie refreshed — schedule the next refresh
        scheduleSessionRefresh();
      } else {
        // Refresh failed (e.g., refresh cookie also expired) — the next
        // /auth/session call will redirect to login.  Do nothing here.
        console.warn("Session refresh failed:", resp.status);
      }
    } catch (e) {
      console.warn("Session refresh error:", e.message);
    }
  }

  function onSessionActivity() {
    var now = Date.now();
    // Only reset the timer if the user has been active for a meaningful
    // stretch — this prevents a single stray event from keeping the
    // session alive forever.
    if (now - lastSessionActivity > 60 * 1000) {
      lastSessionActivity = now;
      scheduleSessionRefresh();
    }
  }

  // Start the sliding refresh once the session is loaded and the user is
  // authenticated.  Only start it for authenticated sessions (dashUser set).
  document.addEventListener("dashSessionLoaded", function() {
    if (!dashUser) return;
    scheduleSessionRefresh();
    ["click", "keydown", "scroll", "touchstart", "mousemove"].forEach(function(evt) {
      document.addEventListener(evt, onSessionActivity, { passive: true });
    });
  });

  /* ===== HTML ESCAPE HELPER ===== */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();
