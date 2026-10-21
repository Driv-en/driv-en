/**
 * sw.js — DRIV‑EN Service Worker
 * v15 — October 2026: Fix navigation caching & bypass dashboard/public auth routes
 */

const CACHE = 'driv-en-v15';
const STATIC_ASSETS = [
  '/app/shared/dashboard.css',
  '/app/shared/dashboard-common.js',
  '/app/shared/dashboard-header.html',
  '/app/shared/dashboard-footer.html',
  '/app/shared/auth-check.js',
  '/styles/header.css',
  '/styles/footer.css',
  '/styles/diamond-plate.css',
  '/components/header.html',
  '/components/footer.html',
  '/components/nav.js',
  '/assets/logo.png',
  '/assets/favicon.png',
  '/assets/icons/favicon.png',
  '/assets/icons/favicon-96.png',
  '/assets/icons/favicon-192.png',
  '/assets/icons/favicon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return Promise.all(
        STATIC_ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.log('[SW] Asset not cached (may not exist yet):', url);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', e => {
  const request = e.request;
  if (request.method !== 'GET') return;
  
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // 1. ALWAYS BYPASS SERVICE WORKER FOR AUTH, APIS, AND PROTECTED DASHBOARDS
  if (
    url.pathname.startsWith('/api/') || 
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/app/') ||
    url.pathname.startsWith('/public/')
  ) {
    return; // Pass through directly to network
  }

  if (url.hostname.includes('cloudflareinsights.com')) return;

  const isNavigation = request.mode === 'navigate';
  const isStaticAsset = url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/i);

  // 2. NETWORK-FIRST FOR NAVIGATION (DO NOT STORE DYNAMIC HTML REDIRECTS IN SW CACHE)
  if (isNavigation) {
    e.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then(cached => {
          if (cached) return cached;
          return new Response(
            '<!DOCTYPE html><html><head><title>Offline</title></head><body style="font-family:sans-serif;text-align:center;padding:60px 20px;"><h1>You are offline</h1><p>Please check your internet connection.</p></body></html>',
            { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
    );
  } else if (isStaticAsset) {
    // 3. STALE-WHILE-REVALIDATE FOR STATIC ASSETS ONLY
    e.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return response;
        }).catch(() => {});

        return cached || fetchPromise;
      })
    );
  }
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
