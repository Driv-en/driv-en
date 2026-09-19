/**
 * sw.js — DRIV‑EN Service Worker
 * 
 * Strategy: Network-first for pages, cache-first for static assets.
 * Pages are cached on-demand as they're visited (no pre-caching).
 * This avoids the atomic failure problem where one missing file
 * breaks the entire cache.
 *
 * v9 — September 19, 2026: Fixed "page can't be reached" bug.
 *      Previous v8 used addAll() which failed atomically if any asset 404'd,
 *      leaving the cache empty and serving 504 empty responses.
 *      Now uses on-demand caching: pages are cached as they're visited.
 *      Navigation requests are network-first (always try network, fall back
 *      to cache only when offline). Static assets are cache-first.
 */

const CACHE = 'driv-en-v9';
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

// Install — pre-cache only static assets (individually, not addAll)
// If any asset fails, the others still cache. Pages cache on-demand.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache each asset individually so one failure doesn't break all
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

// Fetch — different strategies for different request types
self.addEventListener('fetch', e => {
  const request = e.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin
  if (url.origin !== location.origin) return;

  // Don't intercept API or auth calls — always let them hit the network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return;
  }

  // Don't intercept Cloudflare analytics beacon
  if (url.hostname.includes('cloudflareinsights.com')) return;

  // Determine request type
  const isNavigation = request.mode === 'navigate';
  const isStaticAsset = url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|html)$/i);

  if (isNavigation) {
    // ===== NETWORK-FIRST for page navigations =====
    // Always try network first so the user gets fresh content.
    // Only fall back to cache when offline.
    e.respondWith(
      fetch(request).then(response => {
        // Cache the page for offline use
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline — try cache
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // Not in cache either — return offline page
          return new Response(
            '<!DOCTYPE html><html><head><title>Offline</title></head><body style="font-family:sans-serif;text-align:center;padding:60px 20px;"><h1>You are offline</h1><p>This page has not been cached yet. Connect to the internet and try again.</p></body></html>',
            { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
    );
  } else if (isStaticAsset) {
    // ===== CACHE-FIRST for static assets (CSS, JS, images) =====
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          // Serve from cache, update in background
          fetch(request).then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE).then(c => c.put(request, clone));
            }
          }).catch(() => {});
          return cached;
        }
        // Not in cache — fetch from network
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return response;
        }).catch(() => {
          return new Response('', { status: 404 });
        });
      })
    );
  }
  // For anything else, don't intercept — let the browser handle it
});

// Listen for messages from the page
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
