// ===== DRIV-EN SHARED THEME + PWA =====
(function () {
  // Apply saved theme on load
  const saved = localStorage.getItem('driv-en-theme') || 'dark';
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  // Wire up toggle button(s)
  document.addEventListener('DOMContentLoaded', function () {
    const updateButtons = () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.textContent = isLight ? '☀️ Light' : '🌙 Dark';
      });
    };
    updateButtons();

    document.addEventListener('click', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('theme-toggle')) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
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
  });

  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.log('SW registration failed:', err);
    });
  }
})();
