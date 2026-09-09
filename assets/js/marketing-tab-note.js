/* ==========================================================================
   MARKETING TAB — REFERRAL CODE/LINK SUNSET NOTICE
   ==========================================================================
   PURPOSE: Adds a notice to the Marketing tab in the Referrer Dashboard
   informing partners that the "Your Referral Code & Link" section will
   eventually be removed.

   USAGE: Add this to referrer-dashboard.html, inside the Marketing tab panel:
     <script src="/assets/js/marketing-tab-note.js"></script>
   ========================================================================== */

(function () {
  'use strict';

  function addSunsetNotice() {
    var container = document.getElementById('marketing-referral-link-section');
    if (!container) {
      var headings = document.querySelectorAll('h2, h3, h4');
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].textContent.toLowerCase().includes('referral code') || headings[i].textContent.toLowerCase().includes('referral link')) {
          container = headings[i].parentElement;
          break;
        }
      }
    }
    if (!container) return;
    var notice = document.createElement('div');
    notice.style.cssText = 'background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-family:Arial,sans-serif;font-size:13px;color:#92400e;line-height:1.5;display:flex;align-items:flex-start;gap:10px;';
    notice.innerHTML = '<span style="font-size:18px;flex-shrink:0;">ℹ️</span><div><strong>Notice:</strong> The "Your Referral Code & Link" section will be phased out in a future update. DRIV-EN will provide official marketing materials for you to share with potential customers, ensuring all outreach is professional and consistent. Please use the marketing resources provided here rather than sharing your direct referral link.</div>';
    container.insertBefore(notice, container.firstChild);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', addSunsetNotice); }
  else { addSunsetNotice(); }
})();
