/**
 * sw.js — DRIV-EN Service Worker
 * 
 * Caches the app shell for offline use.
 * Uses stale-while-revalidate strategy: serve from cache, update in background.
 * 
 * v2.0 will add Background Sync API for automatic offline data sync.
 *
 * v5 — September 1, 2026: Updated cache paths for /app/ directory restructure.
 *      All post-login pages moved from /public/ to /app/.
 *      Shared resources moved from /components/ and /styles/ to /app/shared/.
 *      Static assets moved to /assets/.
 */

const CACHE = 'driv-en-v5';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/public/login.html',
  '/app/dashboard/onboarding-dashboard.html',
  '/app/onboarding/key-personnel.html',
  '/app/auth/change-password.html',
  '/app/auth/reset-password.html',
  '/app/auth/2fa-setup.html',
  '/app/auth/2fa-verify.html',
  '/app/auth/2fa-backup-codes.html',
  '/app/dashboard/admin.html',
  '/assets/logo.png',
  '/assets/favicon.png',
  '/assets/icons/favicon.png',
  '/assets/icons/driven-icon-192.png',
  '/assets/icons/driven-icon-512.png',
  '/app/shared/dashboard.css',
  '/app/shared/offline-db.js',
  '/app/shared/api.js',
  '/app/shared/auth-check.js',
  '/app/shared/dashboard-common.js',
  '/app/shared/dashboard-header.html',
  '/app/shared/dashboard-footer.html',
  '/app/shared/template-helpers.js',
  '/styles/header.css',
  '/styles/footer.css',
  '/components/header.html',
  '/components/footer.html',
  '/components/nav.js'
];

// Install — cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL_ASSETS)).catch(err => {
      console.log('SW: Some assets failed to cache', err);
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch — stale-while-revalidate for same-origin GET requests
self.addEventListener('fetch', e => {
  const request = e.request;
  
  // Only handle GET requests for same-origin
  if (request.method !== 'GET') return;
  
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  
  // Don't cache API calls — they need to hit the server
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return;
  }
  
  e.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline — return cached if available, otherwise nothing
        return cached || new Response('', { status: 504, statusText: 'Offline' });
      });
      
      // Return cached immediately, update in background
      return cached || fetchPromise;
    })
  );
});

// Listen for messages from the page (e.g., "skipWaiting" for updates)
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
