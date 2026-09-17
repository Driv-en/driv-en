// DRIV-EN OFFLINE QUEUE HELPER — registers SW, wraps fetch to auto-queue writes offline.
(function () {
  "use strict";
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").then((reg) => console.log("[DRIV-EN] SW registered:", reg.scope)).catch((err) => console.warn("[DRIV-EN] SW failed:", err)); });
  }
  async function drivEnFetch(url, options = {}) {
    const method = options.method || "GET";
    if (method !== "GET" && !navigator.onLine) { await queueLocally(url, options); if ("serviceWorker" in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: "SYNC_NOW" }); return { success: true, queued: true, offline: true }; }
    try { const response = await fetch(url, options); return await response.json(); } catch (e) {
      if (method !== "GET") { await queueLocally(url, options); if ("serviceWorker" in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: "SYNC_NOW" }); return { success: true, queued: true, offline: true }; }
      throw e;
    }
  }
  async function queueLocally(url, options) {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) { try { navigator.serviceWorker.controller.postMessage({ type: "QUEUE_WRITE", url, options }); return; } catch (e) { } }
    return new Promise((resolve, reject) => {
      const openRequest = indexedDB.open("driv-en-offline", 1);
      openRequest.onupgradeneeded = () => { const db = openRequest.result; if (!db.objectStoreNames.contains("writes")) db.createObjectStore("writes", { keyPath: "id", autoIncrement: true }); };
      openRequest.onsuccess = () => { const db = openRequest.result; const tx = db.transaction("writes", "readwrite"); tx.objectStore("writes").add({ url, method: options.method || "GET", headers: options.headers || {}, body: options.body || null, queued_at: new Date().toISOString() }); resolve(); };
      openRequest.onerror = () => reject(openRequest.error);
    });
  }
  window.addEventListener("online", () => { if ("serviceWorker" in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: "SYNC_NOW" }); });
  window.drivEnFetch = drivEnFetch;
  window.drivEnQueue = queueLocally;
})();
