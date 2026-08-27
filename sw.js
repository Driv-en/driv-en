const CACHE = 'driv-en-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/onboarding-key-personnel.html',
  '/onboarding-dashboard.html',
  '/onboarding-clients.html',
  '/onboarding-divisions.html',
  '/onboarding-employees.html',
  '/onboarding-projects.html',
  '/login.html',
  '/admin.html',
  '/equipment.html',
  '/equipment-detail.html',
  '/inspections.html',
  '/inspection-detail.html',
  '/pm.html',
  '/pm-detail.html',
  '/workorders.html',
  '/workorder-detail.html',
  '/module-selection.html',
  '/change-password.html',
  '/cart.html',
  '/checkout.html',
  '/logo.png',
  '/icons/favicon.png',
  '/icons/driven-icon-192.png',
  '/icons/driven-icon-512.png',
  '/css/theme.css',
  '/js/theme.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
