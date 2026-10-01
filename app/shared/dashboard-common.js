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

  /* ===== SAFE STORAGE HELPERS ===== */
  // localStorage can throw in private browsing, blocked storage, or
  // some browser security modes. Wrap all access in try/catch.
  function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function safeRemoveItem(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  /* ===== PWA: MANIFEST LINK + SERVICE WORKER REGISTRATION ===== */
  (function registerPWA() {
    if (!document.querySelector('link[rel="manifest"]')) {
      var manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.json';
      document.head.appendChild(manifestLink);
    }
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(reg) {
          console.log('[DRIV-EN] Service worker registered:', reg.scope);
        }).catch(function(err) {
          console.warn('[DRIV-EN] SW registration failed:', err);
        });
      });
    }
  })();

  /* ===== ERROR HANDLER LOADING ===== */
  (function loadErrorHandler() {
    if (window.DRIVENErrorHandler) return;
    var script = document.createElement('script');
    script.src = '/assets/js/error-handler.js';
    script.async = false;
    document.head.appendChild(script);
  })();

  /* ===== HELPER: Escape HTML (prevents XSS in injected strings) ===== */
  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

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
    safeSetItem("driven-theme", newTheme);
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
    window.location.href = "/public/login.html";
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
        safeSetItem("driven_customer_logo", logoData.logo);
        var logoImg = document.createElement("img");
        logoImg.src = logoData.logo;
        logoImg.className = "dash-customer-logo";
        logoImg.alt = "Company Logo";
        area.innerHTML = "";
        area.appendChild(logoImg);
        return;
      }
    } catch (e) {
      console.error("Logo fetch from D1 error:", e.message);
    }
    var logoUrl = safeGetItem("driven_customer_logo");
    if (logoUrl) {
      var fallbackImg = document.createElement("img");
      fallbackImg.src = logoUrl;
      fallbackImg.className = "dash-customer-logo";
      fallbackImg.alt = "Company Logo";
      area.innerHTML = "";
      area.appendChild(fallbackImg);
    }
  }

  /* ===== LOAD SESSION ===== */
  async function loadSession() {
    try {
      var response = await fetch("/auth/session");
      var data = await response.json();
      if (data.authenticated && data.user) {
        dashUser = data.user;
        if (data.user.org_id) {
          safeSetItem("driven_customer_id", data.user.org_id);
        }
        var greetingEl = document.getElementById("dashGreetingText");
        if (greetingEl) {
          var firstName = data.user.first_name || "";
          var orgName = data.user.org_name || "";
          if (firstName && orgName) {
            greetingEl.innerHTML = "Welcome, <strong>" + escapeHtml(firstName) + "</strong> — " + escapeHtml(orgName);
          } else if (firstName) {
            greetingEl.innerHTML = "Welcome, <strong>" + escapeHtml(firstName) + "</strong>";
          } else {
            greetingEl.innerHTML = "Welcome";
          }
        }
        if (data.user.org_name) {
          safeSetItem("driven_org_name", data.user.org_name);
        }
        window.dashUser = data.user;
        var role = (data.user.role || '').toLowerCase();
        var dashUrl;
        var savedOrigin = sessionStorage.getItem('driven_dashboard_origin');
        if (savedOrigin) {
          dashUrl = savedOrigin;
        } else if (role === 'owner') {
          dashUrl = '/app/dashboard/owner-dashboard.html';
        } else if (role === 'admin') {
          dashUrl = '/app/dashboard/admin.html';
        } else {
          dashUrl = '/app/dashboard/employee-dashboard.html';
        }
        var homeBtn = document.getElementById('dashHomeBtn');
        if (homeBtn) {
          homeBtn.href = dashUrl;
        }
        var currentPage = window.location.pathname;
        var isMainDashboard = currentPage.indexOf('/dashboard/') !== -1
          && currentPage.indexOf('/forms/') === -1
          && currentPage.indexOf('user-management') === -1
          && currentPage.indexOf('fuel') === -1
          && currentPage.indexOf('equipment') === -1
          && currentPage.indexOf('transfers') === -1
          && currentPage.indexOf('work-orders') === -1
          && currentPage.indexOf('inspections') === -1
          && currentPage.indexOf('pm') === -1
          && currentPage.indexOf('projects') === -1
          && currentPage.indexOf('extraction') === -1
          && currentPage.indexOf('settings') === -1
          && currentPage.indexOf('asset-management') === -1
          && currentPage.indexOf('project-management') === -1
          && currentPage.indexOf('company-management') === -1;
        if (isMainDashboard) {
          sessionStorage.setItem('driven_dashboard_origin', currentPage);
        }
        return true;
      }
    } catch (e) {
      console.error("Session load error:", e.message);
    }
    return false;
  }

  /* ===== INIT ===== */
  async function init() {
    await loadComponent("dashHeader", "/app/shared/dashboard-header.html");
    setPageTitle();
    updateThemeSwitch();
    await loadCustomerLogo();
    await loadSession();
    await loadComponent("dashFooter", "/app/shared/dashboard-footer.html");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("dashSessionLoaded", function() {
    window.dashUser = dashUser;
  });

  var originalLoadSession = loadSession;
  loadSession = async function() {
    var result = await originalLoadSession();
    document.dispatchEvent(new CustomEvent("dashSessionLoaded", { detail: dashUser }));
    return result;
  };

  /* ===== SLIDING SESSION REFRESH ===== */
  var SESSION_REFRESH_MS = 30 * 60 * 1000;
  var sessionRefreshTimer = null;
  var lastSessionActivity = Date.now();

  function scheduleSessionRefresh() {
    if (sessionRefreshTimer) clearTimeout(sessionRefreshTimer);
    sessionRefreshTimer = setTimeout(refreshSessionToken, SESSION_REFRESH_MS);
  }

  async function refreshSessionToken() {
    try {
      var resp = await fetch("/auth/refresh", { method: "POST", credentials: "include" });
      if (resp.ok) {
        scheduleSessionRefresh();
      } else {
        console.warn("Session refresh failed:", resp.status);
      }
    } catch (e) {
      console.warn("Session refresh error:", e.message);
    }
  }

  function onSessionActivity() {
    var now = Date.now();
    if (now - lastSessionActivity > 60 * 1000) {
      lastSessionActivity = now;
      scheduleSessionRefresh();
    }
  }

  document.addEventListener("dashSessionLoaded", function() {
    if (!dashUser) return;
    scheduleSessionRefresh();
    ["click", "keydown", "scroll", "touchstart", "mousemove"].forEach(function(evt) {
      document.addEventListener(evt, onSessionActivity, { passive: true });
    });
  });

})();
