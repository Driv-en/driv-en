// DRIV-EN SERVICE WORKER — offline-first: caches app shell, queues writes when offline, syncs when online.
const CACHE_NAME = "driv-en-v1";
const APP_SHELL = ["/", "/index.html", "/app.js", "/styles.css", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") {
    event.respondWith(fetch(event.request).catch(() => queueWrite(event.request).then(() => new Response(JSON.stringify({ success: true, queued: true, offline: true }), { status: 202, headers: { "Content-Type": "application/json" } }))));
    return;
  }
  if (url.origin === self.location.origin && APP_SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { const clone = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)); return response; })));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).then((response) => { const clone = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)); return response; }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(fetch(event.request));
});

function queueWrite(request) {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open("driv-en-offline", 1);
    openRequest.onupgradeneeded = () => { const db = openRequest.result; if (!db.objectStoreNames.contains("writes")) db.createObjectStore("writes", { keyPath: "id", autoIncrement: true }); };
    openRequest.onsuccess = () => {
      const db = openRequest.result; const tx = db.transaction("writes", "readwrite"); const store = tx.objectStore("writes");
      request.clone().text().then((body) => { store.add({ url: request.url, method: request.method, headers: Object.fromEntries(request.headers.entries()), body, queued_at: new Date().toISOString() }); resolve(); });
    };
    openRequest.onerror = () => reject(openRequest.error);
  });
}

self.addEventListener("sync", (event) => { if (event.tag === "driv-en-sync") event.waitUntil(replayQueue()); });

async function replayQueue() {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open("driv-en-offline", 1);
    openRequest.onsuccess = () => {
      const db = openRequest.result; const tx = db.transaction("writes", "readwrite"); const store = tx.objectStore("writes"); const getAll = store.getAll();
      getAll.onsuccess = async () => {
        for (const item of getAll.result) { try { const response = await fetch(item.url, { method: item.method, headers: item.headers, body: item.body }); if (response.ok) store.delete(item.id); } catch (e) { } }
        resolve();
      };
      getAll.onerror = () => reject(getAll.error);
    };
    openRequest.onerror = () => reject(openRequest.error);
  });
}

self.addEventListener("message", (event) => { if (event.data && event.data.type === "SYNC_NOW") self.registration.sync.register("driv-en-sync"); });
