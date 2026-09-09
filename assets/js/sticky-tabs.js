/* ==========================================================================
   STICKY TABS — Shared JS for Referrer Dashboard & Owner Dashboard
   ==========================================================================
   PURPOSE: Makes the tab navigation bar sticky and adds a scroll shadow.
   Also handles tab switching (show/hide tab content panels).

   USAGE:
   1. Wrap your tab buttons in a container:
      <div class="tab-nav-container">
        <div class="tab-nav-inner">
          <button class="tab-btn active" data-tab="overview">Overview</button>
          <button class="tab-btn" data-tab="activity">Activity</button>
          ...
        </div>
      </div>

   2. Give each tab content panel a matching id:
      <div id="tab-overview" class="tab-panel">...</div>
      <div id="tab-activity" class="tab-panel" style="display:none">...</div>

   3. Include this script after the HTML:
      <script src="/assets/js/sticky-tabs.js"></script>
   ========================================================================== */

(function () {
  'use strict';

  function initStickyTabs() {
    var navContainer = document.querySelector('.tab-nav-container');
    if (!navContainer) return;

    var tabButtons = navContainer.querySelectorAll('.tab-btn');
    var tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tabName = btn.getAttribute('data-tab');
        if (!tabName) return;

        tabButtons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        tabPanels.forEach(function (panel) {
          var panelTab = panel.getAttribute('data-tab') || panel.id.replace('tab-', '');
          if (panelTab === tabName) {
            panel.style.display = '';
            panel.classList.add('active');
          } else {
            panel.style.display = 'none';
            panel.classList.remove('active');
          }
        });

        if (history.replaceState) {
          history.replaceState(null, null, '#' + tabName);
        }
      });
    });

    var stickyOffset = 0;
    function updateStickyOffset() {
      var rect = navContainer.getBoundingClientRect();
      stickyOffset = rect.top + window.pageYOffset;
    }
    updateStickyOffset();
    window.addEventListener('resize', updateStickyOffset);

    window.addEventListener('scroll', function () {
      if (window.pageYOffset > stickyOffset) {
        navContainer.classList.add('is-stuck');
      } else {
        navContainer.classList.remove('is-stuck');
      }
    }, { passive: true });

    var hash = window.location.hash;
    if (hash) {
      var tabName = hash.replace('#', '');
      var matchingBtn = navContainer.querySelector('.tab-btn[data-tab="' + tabName + '"]');
      if (matchingBtn) {
        matchingBtn.click();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStickyTabs);
  } else {
    initStickyTabs();
  }
})();
