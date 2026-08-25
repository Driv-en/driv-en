// ===== DRIV-EN SHARED THEME + HEADER/FOOTER + PWA =====
(function () {
  // ---- Apply saved theme on load ----
  var saved = localStorage.getItem('driv-en-theme') || 'dark';
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  // ---- Update all toggle buttons ----
  function updateButtons() {
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    var label = isLight ? '☀️ Light' : '🌙 Dark';
    var buttons = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].textContent = label;
    }
  }

  // ---- Toggle handler (delegated so it works on injected header) ----
  document.addEventListener('click', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('theme-toggle')) {
      var isLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('driv-en-theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('driv-en-theme', 'light');
      }
      updateButtons();
    }
  });

  // ---- Inject shared header and footer ----
  function injectPartial(placeholderId, url) {
    var placeholder = document.getElementById(placeholderId);
    if (!placeholder) return;
    fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        placeholder.outerHTML = html;
        updateButtons();
        // Load customer logo from localStorage
        var logo = document.getElementById('customerLogo');
        if (logo) {
          var savedLogo = localStorage.getItem('driven_customer_logo');
          if (savedLogo) logo.src = savedLogo;
        }
      })
      .catch(function (err) {
        console.log('Failed to load ' + url + ':', err);
      });
  }

  // ---- Auto-update copyright year ----
  function setCopyright() {
    var el = document.getElementById('copyright');
    if (el) {
      el.textContent = '© ' + new Date().getFullYear() + ' Digital Safety Inspection, LLC.';
    }
  }

  // ---- Run on DOM ready ----
  document.addEventListener('DOMContentLoaded', function () {
    injectPartial('header-placeholder', '/includes/header.html');
    injectPartial('footer-placeholder', '/includes/footer.html');
    // Copyright runs after footer is injected (slight delay)
    setTimeout(setCopyright, 300);
    updateButtons();
  });

  // ---- Register service worker for PWA ----
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.log('SW registration failed:', err);
    });
  }
})();
