/* ==========================================================================
   DRIV‑EN DASHBOARD COMMON JS — Shared across all dashboard pages
   v11 — September 30, 2026: Fixed dashboard origin tracking.
   ========================================================================== */
(function() {
  'use strict';
  var dashUser = null;
  (function registerPWA() {
    if (!document.querySelector('link[rel="manifest"]')) {
      var ml = document.createElement('link'); ml.rel = 'manifest'; ml.href = '/manifest.json'; document.head.appendChild(ml);
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
    var s = document.createElement('script'); s.src = '/assets/js/error-handler.js'; s.async = false; document.head.appendChild(s);
  })();
  async function loadComponent(elementId, file) {
    try { var el = document.getElementById(elementId); if (!el) return; var r = await fetch(file); el.innerHTML = await r.text(); }
    catch (e) { console.error("Failed to load component:", elementId, file, e.message); }
  }
  window.dashToggleTheme = function() {
    var c = document.documentElement.getAttribute("data-theme"); var n = c === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", n); localStorage.setItem("driven-theme", n); updateThemeSwitch();
  };
  function updateThemeSwitch() {
    var c = document.documentElement.getAttribute("data-theme");
    var cb = document.getElementById("dashThemeCheckbox"); var ll = document.getElementById("dashThemeLabelLight"); var ld = document.getElementById("dashThemeLabelDark");
    if (cb) cb.checked = (c === "dark"); if (ll) ll.classList.toggle("active", c === "light"); if (ld) ld.classList.toggle("active", c === "dark");
  }
  window.dashLogout = async function() {
    try { await fetch("/auth/logout", { method: "POST" }); } catch (e) { console.error("Logout error:", e.message); }
    window.location.href = "/public/login.html";
  };
  function setPageTitle() {
    var t = document.body.getAttribute("data-page-title") || "Dashboard"; var te = document.getElementById("dashPageTitle"); if (te) te.textContent = t;
  }
  async function loadCustomerLogo() {
    var area = document.getElementById("dashCustomerLogoArea"); if (!area) return;
    try { var lr = await fetch("/auth/get-logo"); var ld = await lr.json(); if (ld.success && ld.logo) { localStorage.setItem("driven_customer_logo", ld.logo); area.innerHTML = '<img src="' + ld.logo + '" class="dash-customer-logo" alt="Company Logo">'; return; } }
    catch (e) { console.error("Logo fetch error:", e.message); }
    var lu = localStorage.getItem("driven_customer_logo"); if (lu) area.innerHTML = '<img src="' + lu + '" class="dash-customer-logo" alt="Company Logo">';
  }
  async function loadSession() {
    try {
      var response = await fetch("/auth/session"); var data = await response.json();
      if (data.authenticated && data.user) {
        dashUser = data.user;
        if (data.user.org_id) localStorage.setItem("driven_customer_id", data.user.org_id);
        var ge = document.getElementById("dashGreetingText");
        if (ge) { var fn = data.user.first_name || ""; var on = data.user.org_name || ""; if (fn && on) ge.innerHTML = "Welcome, <strong>" + fn + "</strong> — " + escapeHtml(on); else if (fn) ge.innerHTML = "Welcome, <strong>" + fn + "</strong>"; else ge.innerHTML = "Welcome"; }
        if (data.user.org_name) localStorage.setItem("driven_org_name", data.user.org_name);
        window.dashUser = data.user;
        var role = (data.user.role || '').toLowerCase(); var dashUrl;
        var savedOrigin = sessionStorage.getItem('driven_dashboard_origin');
        if (savedOrigin) dashUrl = savedOrigin;
        else if (role === 'owner') dashUrl = '/app/dashboard/owner-dashboard.html';
        else if (role === 'admin') dashUrl = '/app/dashboard/admin.html';
        else dashUrl = '/app/dashboard/employee-dashboard.html';
        var hb = document.getElementById('dashHomeBtn'); if (hb) hb.href = dashUrl;
        var cp = window.location.pathname;
        var isMain = cp.indexOf('/dashboard/') !== -1 && cp.indexOf('/forms/') === -1
          && cp.indexOf('user-management') === -1 && cp.indexOf('fuel') === -1
          && cp.indexOf('equipment') === -1 && cp.indexOf('transfers') === -1
          && cp.indexOf('work-orders') === -1 && cp.indexOf('inspections') === -1
          && cp.indexOf('pm') === -1 && cp.indexOf('projects') === -1
          && cp.indexOf('extraction') === -1 && cp.indexOf('settings') === -1;
        if (isMain) sessionStorage.setItem('driven_dashboard_origin', cp);
        return true;
      }
    } catch (e) { console.error("Session load error:", e.message); }
    return false;
  }
  async function init() {
    await loadComponent("dashHeader", "/app/shared/dashboard-header.html");
    setPageTitle(); updateThemeSwitch(); await loadCustomerLogo(); await loadSession();
    await loadComponent("dashFooter", "/app/shared/dashboard-footer.html");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.addEventListener("dashSessionLoaded", function() { window.dashUser = dashUser; });
  var ols = loadSession;
  loadSession = async function() { var r = await ols(); document.dispatchEvent(new CustomEvent("dashSessionLoaded", { detail: dashUser })); return r; };
  var SRF = 30 * 60 * 1000, lsa = Date.now(), srt = null;
  function ssr() { if (srt) clearTimeout(srt); srt = setTimeout(rst, SRF); }
  async function rst() { try { var r = await fetch("/auth/refresh", { method: "POST", credentials: "include" }); if (r.ok) ssr(); else console.warn("Session refresh failed:", r.status); } catch (e) { console.warn("Session refresh error:", e.message); } }
  function osa() { var n = Date.now(); if (n - lsa > 60000) { lsa = n; ssr(); } }
  document.addEventListener("dashSessionLoaded", function() { if (!dashUser) return; ssr(); ["click","keydown","scroll","touchstart","mousemove"].forEach(function(e) { document.addEventListener(e, osa, { passive: true }); }); });
  function escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
})();
