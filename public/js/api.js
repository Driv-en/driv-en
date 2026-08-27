/**
 * api.js — Offline-aware API helper for DRIV-EN
 * 
 * All pages should use this instead of calling fetch() directly.
 * It saves to IndexedDB first, then attempts to sync with the server.
 * 
 * Usage:
 *   import { apiPost, apiGet, apiPut, apiDelete } from '/js/api.js';
 *   
 *   // Create a record (offline-aware)
 *   const result = await apiPost('/api/employees', { name: 'John', ... });
 *   
 *   // Get records (always from server when online)
 *   const data = await apiGet('/api/employees');
 *   
 *   // Update a record (offline-aware)
 *   await apiPut('/api/employees/123', { name: 'John Updated' });
 *   
 *   // Delete a record (offline-aware)
 *   await apiDelete('/api/employees/123');
 */

import { saveRecord, getPendingRecords, syncPending, getPendingCount, cleanupSyncedRecords, markSynced, deleteSyncedRecord } from '/js/offline-db.js';

/**
 * POST — Create a record (offline-aware)
 * Saves to IndexedDB first, then tries to send to server.
 * 
 * @param {string} endpoint - API endpoint (e.g., '/api/employees')
 * @param {object} data - Record data to send
 * @param {string} storeName - Data type for offline storage (e.g., 'employees')
 * @returns {object} { success, data, syncStatus, localId }
 */
export async function apiPost(endpoint, data, storeName) {
  if (!storeName) storeName = endpoint.replace('/api/', '').replace(/\//g, '_');
  
  // If offline, save to IndexedDB and return pending status
  if (!navigator.onLine) {
    const result = await saveRecord(storeName, data, {
      apiEndpoint: endpoint,
      method: 'POST'
    });
    return {
      success: true,
      data: { ...data, localId: result.localId },
      syncStatus: 'pending',
      localId: result.localId,
      message: 'Saved offline. Will sync when connection returns.'
    };
  }
  
  // Online — try to send to server
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      return {
        success: true,
        data: result,
        syncStatus: 'synced'
      };
    } else {
      // Server returned error — save locally as pending for retry
      const localResult = await saveRecord(storeName, data, {
        apiEndpoint: endpoint,
        method: 'POST'
      });
      return {
        success: false,
        data: result,
        syncStatus: 'pending',
        localId: localResult.localId,
        error: result.error || 'Server error'
      };
    }
  } catch (e) {
    // Network error — save locally as pending
    const localResult = await saveRecord(storeName, data, {
      apiEndpoint: endpoint,
      method: 'POST'
    });
    return {
      success: false,
      data: null,
      syncStatus: 'pending',
      localId: localResult.localId,
      error: e.message
    };
  }
}

/**
 * GET — Fetch records from server (always live when online)
 * Does NOT use offline storage — reads are always from server.
 * 
 * @param {string} endpoint - API endpoint (e.g., '/api/employees?customerId=xxx')
 * @returns {object} { success, data }
 */
export async function apiGet(endpoint) {
  // If offline, return empty result (v2.0 will read from IndexedDB)
  if (!navigator.onLine) {
    return {
      success: false,
      data: null,
      error: 'You are offline. Data viewing will be available in a future update.',
      offline: true
    };
  }
  
  try {
    const response = await fetch(endpoint);
    const result = await response.json();
    
    return {
      success: response.ok && (result.success !== false),
      data: result
    };
  } catch (e) {
    return {
      success: false,
      data: null,
      error: e.message
    };
  }
}

/**
 * PUT — Update a record (offline-aware)
 * 
 * @param {string} endpoint - API endpoint (e.g., '/api/employees/123')
 * @param {object} data - Updated record data
 * @param {string} storeName - Data type for offline storage
 * @returns {object} { success, data, syncStatus }
 */
export async function apiPut(endpoint, data, storeName) {
  if (!storeName) storeName = endpoint.replace('/api/', '').split('/')[0];
  
  if (!navigator.onLine) {
    const result = await saveRecord(storeName, data, {
      apiEndpoint: endpoint,
      method: 'PUT'
    });
    return {
      success: true,
      data: { ...data, localId: result.localId },
      syncStatus: 'pending',
      localId: result.localId,
      message: 'Saved offline. Will sync when connection returns.'
    };
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      return {
        success: true,
        data: result,
        syncStatus: 'synced'
      };
    } else {
      const localResult = await saveRecord(storeName, data, {
        apiEndpoint: endpoint,
        method: 'PUT'
      });
      return {
        success: false,
        data: result,
        syncStatus: 'pending',
        localId: localResult.localId,
        error: result.error || 'Server error'
      };
    }
  } catch (e) {
    const localResult = await saveRecord(storeName, data, {
      apiEndpoint: endpoint,
      method: 'PUT'
    });
    return {
      success: false,
      data: null,
      syncStatus: 'pending',
      localId: localResult.localId,
      error: e.message
    };
  }
}

/**
 * DELETE — Delete a record (offline-aware)
 * 
 * @param {string} endpoint - API endpoint (e.g., '/api/employees/123')
 * @param {string} storeName - Data type for offline storage
 * @returns {object} { success, syncStatus }
 */
export async function apiDelete(endpoint, storeName) {
  if (!storeName) storeName = endpoint.replace('/api/', '').split('/')[0];
  
  if (!navigator.onLine) {
    // Save delete intent for sync later
    const result = await saveRecord(storeName, { _action: 'delete', endpoint: endpoint }, {
      apiEndpoint: endpoint,
      method: 'DELETE'
    });
    return {
      success: true,
      syncStatus: 'pending',
      localId: result.localId,
      message: 'Delete queued. Will sync when connection returns.'
    };
  }
  
  try {
    const response = await fetch(endpoint, { method: 'DELETE' });
    const result = await response.json();
    
    return {
      success: response.ok && result.success,
      data: result,
      syncStatus: 'synced'
    };
  } catch (e) {
    const localResult = await saveRecord(storeName, { _action: 'delete', endpoint: endpoint }, {
      apiEndpoint: endpoint,
      method: 'DELETE'
    });
    return {
      success: false,
      syncStatus: 'pending',
      localId: localResult.localId,
      error: e.message
    };
  }
}

/**
 * Check how many records are pending sync (for UI badge/indicator)
 * 
 * @returns {number} count of pending records
 */
export async function getPendingSyncCount() {
  return await getPendingCount();
}

/**
 * Manually trigger sync of all pending records
 * Useful for a "Sync Now" button in the UI
 * 
 * @returns {object} { synced, failed }
 */
export async function syncNow() {
  return await syncPending();
}

/**
 * Clean up synced records to free device storage
 * Call after successful sync or periodically
 * 
 * @param {string} storeName - Data type to clean up
 * @returns {number} records deleted
 */
export async function cleanupSynced(storeName) {
  return await cleanupSyncedRecords(storeName);
}

/**
 * Initialize offline sync — call on every page load
 * Sets up online/offline event listeners and triggers sync when connection returns
 */
export function initOfflineSync() {
  // Sync when coming back online
  window.addEventListener('online', async () => {
    const result = await syncPending();
    if (result.synced > 0) {
      console.log('DRIV-EN: Synced ' + result.synced + ' pending records');
      // Dispatch event for UI to update
      window.dispatchEvent(new CustomEvent('driven-sync-complete', { detail: result }));
    }
  });
  
  // Try syncing on page load if online
  if (navigator.onLine) {
    syncPending().then(result => {
      if (result.synced > 0) {
        console.log('DRIV-EN: Synced ' + result.synced + ' pending records on load');
        window.dispatchEvent(new CustomEvent('driven-sync-complete', { detail: result }));
      }
    });
  }
}
