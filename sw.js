/**
 * sw.js — DRIV‑EN Service Worker
 * v13 — October 1, 2026: Force cache purge — old SW was serving stale dashboard-common.js.
 */

const CACHE = 'driv-en-v13';
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
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  if (url.hostname.includes('cloudflareinsights.com')) return;

  const isNavigation = request.mode === 'navigate';
  const isStaticAsset = url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|html)$/i);

  if (isNavigation) {
    e.respondWith(
      fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(request).then(cached => {
          if (cached) return cached;
          return new Response(
            '<!DOCTYPE html><html><head><title>Offline</title></head><body style="font-family:sans-serif;text-align:center;padding:60px 20px;"><h1>You are offline</h1><p>This page has not been cached yet. Connect to the internet and try again.</p></body></html>',
            { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
    );
  } else if (isStaticAsset) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          fetch(request).then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE).then(c => c.put(request, clone));
            }
          }).catch(() => {});
          return cached;
        }
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
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
