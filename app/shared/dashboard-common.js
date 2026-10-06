/* DRIV-EN DASHBOARD COMMON JS - Shared across all dashboard pages */
(function() {
  'use strict';
  var dashUser = null;
  function safeGetItem(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSetItem(key, value) { try { localStorage.setItem(key, value); } catch (e) { } }
  function safeRemoveItem(key) { try { localStorage.removeItem(key); } catch (e) { } }
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
        }).catch(function(err) { console.warn('[DRIV-EN] SW registration failed:', err); });
      });
    }
  })();
  (function loadErrorHandler() {
    if (window.DRIVENErrorHandler) return;
    var script = document.createElement('script');
    script.src = '/assets/js/error-handler.js';
    script.async = false;
    document.head.appendChild(script);
  })();
  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  async function loadComponent(elementId, file) {
    try {
      var el = document.getElementById(elementId);
      if (!el) return;
      var response = await fetch(file);
      var html = await response.text();
      el.innerHTML = html;
    } catch (e) { console.error("Failed to load component:", elementId, file, e.message); }
  }
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
  window.dashLogout = async function() {
    try { await fetch("/auth/logout", { method: "POST" }); } catch (e) { console.error("Logout error:", e.message); }
    window.location.href = "/public/login.html";
  };
  function setPageTitle() {
    var title = document.body.getAttribute("data-page-title") || "Dashboard";
    var titleEl = document.getElementById("dashPageTitle");
    if (titleEl) titleEl.textContent = title;
  }
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
    } catch (e) { console.error("Logo fetch from D1 error:", e.message); }
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
  async function loadSession() {
    try {
      var response = await fetch("/auth/session");
      var data = await response.json();
      if (data.authenticated && data.user) {
        dashUser = data.user;
        if (data.user.org_id) { safeSetItem("driven_customer_id", data.user.org_id); }
        var greetingEl = document.getElementById("dashGreetingText");
        if (greetingEl) {
          var firstName = data.user.first_name || "";
          var orgName = data.user.org_name || "";
          if (firstName && orgName) { greetingEl.innerHTML = "Welcome, <strong>" + escapeHtml(firstName) + "</strong> \u2014 " + escapeHtml(orgName); }
          else if (firstName) { greetingEl.innerHTML = "Welcome, <strong>" + escapeHtml(firstName) + "</strong>"; }
          else { greetingEl.innerHTML = "Welcome"; }
        }
        if (data.user.org_name) { safeSetItem("driven_org_name", data.user.org_name); }
        window.dashUser = data.user;
        var role = (data.user.role || '').toLowerCase();
        var dashUrl;
        var savedOrigin = sessionStorage.getItem('driven_dashboard_origin');
        if (savedOrigin) { dashUrl = savedOrigin; }
        else if (role === 'owner') { dashUrl = '/app/dashboard/owner-dashboard.html'; }
        else if (role === 'admin') { dashUrl = '/app/dashboard/admin.html'; }
        else { dashUrl = '/app/dashboard/employee-dashboard.html'; }
        var homeBtn = document.getElementById('dashHomeBtn');
        if (homeBtn) { homeBtn.href = dashUrl; }
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
        if (isMainDashboard) { sessionStorage.setItem('driven_dashboard_origin', currentPage); }
        return true;
      }
    } catch (e) { console.error("Session load error:", e.message); }
    return false;
  }
  async function init() {
    await loadComponent("dashHeader", "/app/shared/dashboard-header.html");
    setPageTitle();
    updateThemeSwitch();
    await loadCustomerLogo();
    await loadSession();
    await loadComponent("dashFooter", "/app/shared/dashboard-footer.html");
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
  else { init(); }
  document.addEventListener("dashSessionLoaded", function() { window.dashUser = dashUser; });
  var originalLoadSession = loadSession;
  loadSession = async function() {
    var result = await originalLoadSession();
    document.dispatchEvent(new CustomEvent("dashSessionLoaded", { detail: dashUser }));
    return result;
  };
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
      if (resp.ok) { scheduleSessionRefresh(); }
      else { console.warn("Session refresh failed:", resp.status); }
    } catch (e) { console.warn("Session refresh error:", e.message); }
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
  window.goToMainDashboard = function() {
    try {
      var savedOrigin = sessionStorage.getItem('driven_dashboard_origin');
      if (savedOrigin) { window.location.href = savedOrigin; return; }
    } catch(e) {}
    var user = window.dashUser;
    if (!user) { window.location.href = '/public/login.html'; return; }
    var role = (user.role || '').toLowerCase();
    if (role === 'driv-en founder' || role === 'owner') { window.location.href = '/app/dashboard/owner-dashboard.html'; }
    else if (role === 'admin' || role === 'administrator') { window.location.href = '/app/dashboard/admin.html'; }
    else { window.location.href = '/app/dashboard/employee-dashboard.html'; }
  };
  /* ===== GLOBAL: ERROR RECOVERY BANNER + /api/log-error REPORTING ===== */
  window.addEventListener('error', function(e) {
    if (document.getElementById('driv-en-recovery-banner')) return;
    var errSrc = 'Global Error Handler';
    var errMsg = (e && e.message) ? e.message : 'Unknown page error';
    var errStack = (e && e.error && e.error.stack) ? e.error.stack : (e && e.filename ? (e.filename + ':' + (e.lineno||0) + ':' + (e.colno||0)) : 'No stack trace');
    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'Dashboard Common (' + errSrc + ')', message: errMsg, stack: errStack, url: window.location.href, userAgent: navigator.userAgent })
      }).catch(function() {});
    } catch(logErr) { console.error('Failed to report error to Owner Dashboard:', logErr); }
    var banner = document.createElement('div');
    banner.id = 'driv-en-recovery-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999998;background:#fee2e2;border-bottom:3px solid #dc2626;padding:16px 20px;font-family:Arial,sans-serif;display:flex;align-items:center;gap:16px;justify-content:center;flex-wrap:wrap;';
    var icon = '<span style="font-size:24px;">\u26a0\ufe0f</span>';
    var msg = '<span style="font-size:14px;color:#7f1d1d;"><strong>A page error occurred.</strong> The DRIV-EN team has been notified.</span>';
    var btn = '<button onclick="window.goToMainDashboard()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;">Return to Dashboard</button>';
    var dismiss = '<button onclick="document.getElementById(\'driv-en-recovery-banner\').remove()" style="background:none;border:none;font-size:18px;color:#999;cursor:pointer;margin-left:8px;">\u00d7</button>';
    banner.innerHTML = icon + msg + btn + dismiss;
    if (document.body) document.body.appendChild(banner);
    else document.documentElement.appendChild(banner);
  });
  /* ===== CATCH UNHANDLED PROMISE REJECTIONS ===== */
  window.addEventListener('unhandledrejection', function(e) {
    var errSrc = 'Unhandled Promise Rejection';
    var errMsg = (e && e.reason && e.reason.message) ? e.reason.message : (e && e.reason ? String(e.reason) : 'Unknown promise rejection');
    var errStack = (e && e.reason && e.reason.stack) ? e.reason.stack : 'No stack trace';
    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'Dashboard Common (' + errSrc + ')', message: errMsg, stack: errStack, url: window.location.href, userAgent: navigator.userAgent })
      }).catch(function() {});
    } catch(logErr) { console.error('Failed to report promise rejection to Owner Dashboard:', logErr); }
  });
})();
