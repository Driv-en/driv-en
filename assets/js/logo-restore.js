/* ==========================================================================
   OWNER DASHBOARD — LOGO RESTORE
   ==========================================================================
   PURPOSE: Restores the DSI logo on the Owner Dashboard by fetching it from
   the auth worker's /auth/get-logo endpoint and displaying it.

   USAGE: Add to owner-dashboard.html:
     1. <script src="/assets/js/logo-restore.js"></script> in <head>
     2. Add a logo element in the header:
        <img id="dsi-logo" alt="DSI Logo" style="height:40px;display:none;" />
   ========================================================================== */

(function () {
  'use strict';

  async function restoreLogo() {
    try {
      var res = await fetch('/auth/get-logo', { credentials: 'include' });
      var data = await res.json();
      if (data.success && data.logo) {
        var selectors = ['#dsi-logo', '#logo-img', '#company-logo', '#header-logo', '.logo-img', '.company-logo'];
        var logoEl = null;
        for (var i = 0; i < selectors.length; i++) { logoEl = document.querySelector(selectors[i]); if (logoEl) break; }
        if (logoEl) {
          logoEl.src = data.logo;
          logoEl.style.display = 'block';
          logoEl.style.height = logoEl.style.height || '40px';
        } else {
          var header = document.querySelector('header') || document.querySelector('.header') || document.querySelector('.navbar');
          if (header) {
            var img = document.createElement('img');
            img.id = 'dsi-logo';
            img.src = data.logo;
            img.alt = 'DSI Logo';
            img.style.cssText = 'height:40px;display:block;';
            header.insertBefore(img, header.firstChild);
          }
        }
      }
    } catch (err) { console.error('Logo restore error:', err); }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', restoreLogo); }
  else { restoreLogo(); }
})();
