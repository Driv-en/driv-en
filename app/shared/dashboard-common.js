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
    window.location.href = "/app/auth/login.html";
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
          if (firstName) {
            greetingEl.innerHTML = "Welcome, <strong>" + firstName + "</strong>";
          } else {
            greetingEl.innerHTML = "Welcome";
          }
        }

        // Also expose user data on window.dashUser immediately
        // (in addition to the dashSessionLoaded event)
        window.dashUser = data.user;

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

})();
