const CACHE = 'driv-en-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/onboarding-key-personnel.html',
  '/onboarding-dashboard.html',
  '/logo.png',
  '/icons/favicon.png',
  '/icons/driven-icon-192.png',
  '/icons/driven-icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
