/* ==========================================================================
   DRIV‑EN DASHBOARD COMMON JS — Shared across all dashboard pages
   ==========================================================================
   This file is loaded by every dashboard page via:
   <script src="/components/dashboard-common.js?v=2"></script>

   WHAT IT DOES (in order):
   1. Loads the shared dashboard header into <div id="dashHeader"></div>
   2. Sets the page title from <body data-page-title="...">
   3. Loads the customer logo from D1 (syncs across all devices)
   4. Initializes the theme toggle (light/dark mode)
   5. Fills the greeting bar if one exists on the page
   6. Stores the user's org_id in localStorage for API calls
   7. Verifies user authentication and grants Founder access
   ========================================================================== */

(function() {
  'use strict';

  /* ===== STATE VARIABLES ===== */
  var dashUser = null;  // Will hold the logged-in user object from /auth/session

  /* ===== HELPER: Load an HTML component via fetch ===== */
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
  window.dashToggleTheme = function() {
    var current = document.documentElement.getAttribute("data-theme");
    var newTheme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("driven-theme", newTheme);
    updateThemeSwitch();
  };

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
  window.dashLogout = async function() {
    try {
      await fetch("/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error:", e.message);
    }
    var requiredRole = document.body.getAttribute("data-required-role");
    if (requiredRole === "DRIV-EN Founder") {
      window.location.href = "/app/auth/founder-login.html";
    } else {
      window.location.href = "/public/login.html";
    }
  };

  /* ===== SET PAGE TITLE ===== */
  function setPageTitle() {
    var title = document.body.getAttribute("data-page-title") || "Dashboard";
    var titleEl = document.getElementById("dashPageTitle");
    if (titleEl) titleEl.textContent = title;
  }

  /* ===== LOAD CUSTOMER LOGO ===== */
  async function loadCustomerLogo() {
    var area = document.getElementById("dashCustomerLogoArea");
    if (!area) return;

    try {
      var logoRes = await fetch("/auth/get-logo");
      var logoData = await logoRes.json();
      if (logoData.success && logoData.logo) {
        localStorage.setItem("driven_customer_logo", logoData.logo);
        area.innerHTML = '<img src="' + logoData.logo + '" class="dash-customer-logo" alt="Company Logo">';
        return;
      }
    } catch (e) {
      console.error("Logo fetch from D1 error:", e.message);
    }

    var logoUrl = localStorage.getItem("driven_customer_logo");
    if (logoUrl) {
      area.innerHTML = '<img src="' + logoUrl + '" class="dash-customer-logo" alt="Company Logo">';
    }
  }

  /* ===== LOAD SESSION & AUTH VERIFICATION ===== */
  async function loadSession() {
    try {
      var response = await fetch("/auth/session");
      if (!response.ok) {
        window.location.href = "/public/login.html";
        return false;
      }

      var data = await response.json();

      if (data.authenticated && data.user) {
        dashUser = data.user;
        window.dashUser = data.user;

        var cleanEmail = (data.user.email || '').toLowerCase().trim();
        var isFounder = (
          cleanEmail === 'jblood@digitalsafetyinspection.com' ||
          data.user.role_id === 'RO-Founder' ||
          data.user.role === 'DRIV-EN Founder'
        );

        var requiredRole = document.body.getAttribute("data-required-role");
        if (requiredRole && !isFounder && data.user.role !== requiredRole && data.user.role_id !== requiredRole) {
          console.warn("Unauthorized role for this page, redirecting...");
          window.location.href = "/public/login.html";
          return false;
        }

        if (data.user.org_id) {
          localStorage.setItem("driven_customer_id", data.user.org_id);
        }

        var greetingEl = document.getElementById("dashGreetingText");
        if (greetingEl) {
          var firstName = data.user.first_name || "";
          if (firstName) {
            greetingEl.innerHTML = "Welcome, <strong>" + firstName + "</strong>";
          } else {
            greetingEl.innerHTML = "Welcome";
          }
        }

        return true;
      } else {
        window.location.href = "/public/login.html";
        return false;
      }
    } catch (e) {
      console.error("Session load error:", e.message);
      window.location.href = "/public/login.html";
      return false;
    }
  }

  /* ===== INIT ===== */
  async function init() {
    await loadComponent("dashHeader", "/components/dashboard-header.html");
    setPageTitle();
    updateThemeSwitch();
    await loadCustomerLogo();
    await loadSession();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("dashSessionLoaded", function() {
    window.dashUser = dashUser;
  });

  var originalLoadSession = loadSession;
  loadSession = async function() {
    var result = await originalLoadSession();
    document.dispatchEvent(new CustomEvent("dashSessionLoaded", { detail: dashUser }));
    return result;
  };

})();
