/* ==========================================================================
   MARKETING TAB — REFERRAL CODE/LINK SUNSET NOTICE
   ==========================================================================
   PURPOSE: Adds a notice to the Marketing tab in the Referrer Dashboard
   informing partners that the "Your Referral Code & Link" section will
   eventually be removed. The plan is for referrers to use only the
   marketing materials provided by DRIV-EN, not share their link directly,
   to ensure links are distributed appropriately.

   USAGE: Add this to referrer-dashboard.html, inside the Marketing tab panel:
     <script src="/assets/js/marketing-tab-note.js"></script>

   The Marketing tab should have a container div:
     <div id="marketing-referral-link-section"></div>
   ========================================================================== */

(function () {
  'use strict';

  function addSunsetNotice() {
    var container = document.getElementById('marketing-referral-link-section');
    if (!container) {
      var headings = document.querySelectorAll('h2, h3, h4');
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].textContent.toLowerCase().includes('referral code') ||
            headings[i].textContent.toLowerCase().includes('referral link')) {
          container = headings[i].parentElement;
          break;
        }
      }
    }
    if (!container) return;

    var notice = document.createElement('div');
    notice.style.cssText = [
      'background:#fffbeb',
      'border:1px solid #fcd34d',
      'border-radius:8px',
      'padding:12px 16px',
      'margin-bottom:16px',
      'font-family:Arial,sans-serif',
      'font-size:13px',
      'color:#92400e',
      'line-height:1.5',
      'display:flex',
      'align-items:flex-start',
      'gap:10px'
    ].join(';');

    notice.innerHTML = '\n      <span style="font-size:18px;flex-shrink:0;">ℹ️</span>\n      <div>\n        <strong>Notice:</strong> The "Your Referral Code & Link" section will be phased out in a future update.\n        DRIV-EN will provide official marketing materials for you to share with potential customers,\n        ensuring all outreach is professional and consistent. Please use the marketing resources provided\n        here rather than sharing your direct referral link.\n      </div>\n    ';

    container.insertBefore(notice, container.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addSunsetNotice);
  } else {
    addSunsetNotice();
  }
})();
