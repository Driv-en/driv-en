/**
 * offline-db.js — Offline-aware IndexedDB storage for DRIV-EN
 * 
 * Every API call goes through this module. It saves to IndexedDB first,
 * attempts to sync with the server, and marks records as synced/pending.
 * 
 * Usage:
 *   import { saveRecord, getPendingRecords, syncPending } from '/js/offline-db.js';
 *   
 *   // Save a record (queues for sync)
 *   await saveRecord('employees', { name: 'John', ... });
 *   
 *   // Get all pending records
 *   const pending = await getPendingRecords('employees');
 *   
 *   // Retry syncing pending records
 *   await syncPending();
 */

const DB_NAME = 'driv-en-offline';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create an object store for each data type
      // Each store has: id, storeName, data, syncStatus, createdAt, updatedAt
      if (!db.objectStoreNames.contains('records')) {
        const store = db.createObjectStore('records', { keyPath: 'localId' });
        store.createIndex('storeName', 'storeName', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('storeName_syncStatus', ['storeName', 'syncStatus'], { unique: false });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate a local ID for offline records
 */
function generateLocalId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Save a record to IndexedDB and attempt to sync with the API.
 * 
 * @param {string} storeName - The data type (e.g., 'employees', 'inspections')
 * @param {object} data - The record data
 * @param {object} options
 * @param {string} options.apiEndpoint - API endpoint to POST/PUT to (e.g., '/api/employees')
 * @param {string} options.method - HTTP method ('POST' for create, 'PUT' for update)
 * @param {string} options.localId - Optional existing local ID (for updates)
 * @returns {object} { success, serverResponse, localId, syncStatus }
 */
export async function saveRecord(storeName, data, options = {}) {
  const db = await openDB();
  const tx = db.transaction('records', 'readwrite');
  const store = tx.objectStore('records');
  
  const localId = options.localId || generateLocalId();
  const now = new Date().toISOString();
  
  const record = {
    localId: localId,
    storeName: storeName,
    data: data,
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
    apiEndpoint: options.apiEndpoint || null,
    method: options.method || 'POST',
    retryCount: 0
  };
  
  // Check if this localId already exists (update)
  const existing = await new Promise((resolve) => {
    const get = store.get(localId);
    get.onsuccess = () => resolve(get.result);
    get.onerror = () => resolve(null);
  });
  
  if (existing) {
    record.createdAt = existing.createdAt;
    record.retryCount = existing.retryCount;
  }
  
  store.put(record);
  
  return new Promise((resolve) => {
    tx.oncomplete = async () => {
      // Try to sync immediately
      if (options.apiEndpoint && navigator.onLine) {
        try {
          const response = await fetch(options.apiEndpoint, {
            method: options.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            const serverData = await response.json();
            
            // Mark as synced
            const tx2 = db.transaction('records', 'readwrite');
            const store2 = tx2.objectStore('records');
            record.syncStatus = 'synced';
            record.updatedAt = new Date().toISOString();
            store2.put(record);
            
            resolve({ success: true, serverResponse: serverData, localId, syncStatus: 'synced' });
            return;
          }
        } catch (e) {
          // Offline or network error — keep as pending
        }
      }
      
      resolve({ success: true, localId, syncStatus: 'pending', note: 'Saved locally, pending sync' });
    };
    
    tx.onerror = () => resolve({ success: false, error: 'Failed to save locally' });
  });
}

/**
 * Get all records for a store, optionally filtered by sync status
 */
export async function getRecords(storeName, syncStatus = null) {
  const db = await openDB();
  const tx = db.transaction('records', 'readonly');
  const store = tx.objectStore('records');
  
  return new Promise((resolve) => {
    let request;
    
    if (syncStatus) {
      const index = store.index('storeName_syncStatus');
      request = index.getAll([storeName, syncStatus]);
    } else {
      const index = store.index('storeName');
      request = index.getAll(storeName);
    }
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

/**
 * Get all pending (unsynced) records for a store
 */
export async function getPendingRecords(storeName) {
  return getRecords(storeName, 'pending');
}

/**
 * Get count of pending records (useful for badge/indicator)
 */
export async function getPendingCount() {
  const db = await openDB();
  const tx = db.transaction('records', 'readonly');
  const store = tx.objectStore('records');
  const index = store.index('syncStatus');
  
  return new Promise((resolve) => {
    const request = index.getAll('pending');
    request.onsuccess = () => resolve(request.result ? request.result.length : 0);
    request.onerror = () => resolve(0);
  });
}

/**
 * Mark a record as synced (after successful server confirmation)
 */
export async function markSynced(localId, serverId = null) {
  const db = await openDB();
  const tx = db.transaction('records', 'readwrite');
  const store = tx.objectStore('records');
  
  const record = await new Promise((resolve) => {
    const get = store.get(localId);
    get.onsuccess = () => resolve(get.result);
    get.onerror = () => resolve(null);
  });
  
  if (record) {
    record.syncStatus = 'synced';
    record.updatedAt = new Date().toISOString();
    if (serverId) record.serverId = serverId;
    store.put(record);
  }
}

/**
 * Delete a synced record from IndexedDB (to free space)
 */
export async function deleteSyncedRecord(localId) {
  const db = await openDB();
  const tx = db.transaction('records', 'readwrite');
  const store = tx.objectStore('records');
  store.delete(localId);
}

/**
 * Delete all synced records for a store (bulk cleanup)
 */
export async function cleanupSyncedRecords(storeName) {
  const db = await openDB();
  const tx = db.transaction('records', 'readwrite');
  const store = tx.objectStore('records');
  const index = store.index('storeName_syncStatus');
  
  const records = await new Promise((resolve) => {
    const request = index.getAll([storeName, 'synced']);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
  
  for (const record of records) {
    store.delete(record.localId);
  }
  
  return records.length;
}

/**
 * Retry syncing all pending records
 * Returns { synced: number, failed: number }
 */
export async function syncPending() {
  const db = await openDB();
  const tx = db.transaction('records', 'readwrite');
  const store = tx.objectStore('records');
  const index = store.index('syncStatus');
  
  const pending = await new Promise((resolve) => {
    const request = index.getAll('pending');
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
  
  let synced = 0;
  let failed = 0;
  
  for (const record of pending) {
    if (!record.apiEndpoint) {
      // No API endpoint — can't sync, just mark as synced
      record.syncStatus = 'synced';
      record.updatedAt = new Date().toISOString();
      store.put(record);
      synced++;
      continue;
    }
    
    try {
      const response = await fetch(record.apiEndpoint, {
        method: record.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record.data)
      });
      
      if (response.ok) {
        record.syncStatus = 'synced';
        record.updatedAt = new Date().toISOString();
        store.put(record);
        synced++;
      } else {
        record.retryCount = (record.retryCount || 0) + 1;
        record.updatedAt = new Date().toISOString();
        store.put(record);
        failed++;
      }
    } catch (e) {
      record.retryCount = (record.retryCount || 0) + 1;
      record.updatedAt = new Date().toISOString();
      store.put(record);
      failed++;
    }
  }
  
  return { synced, failed };
}

/**
 * Check online status and trigger sync if coming back online
 */
export function setupOnlineSync() {
  window.addEventListener('online', async () => {
    const result = await syncPending();
    if (result.synced > 0) {
      console.log(`Synced ${result.synced} pending records`);
    }
  });
}
