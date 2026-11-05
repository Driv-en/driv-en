/**
 * DRIV-EN | Log Fuel Transfer Engine
 * Full multi-tenant, PWA-enabled, theme-aware form controller with automated photo compression.
 */

// Core State Management
var allTanks = [];
var allAssets = [];
var deviceLocation = null;
var formDirty = false;
var managerReviewFlags = [];
var fuelPhotoSettings = { meter: false, asset: false };
var fuelPhotos = { meter: null, asset: null };
var fuelPhotoData = { meter: null, asset: null };
var isSubmitting = false;

// ===== THEME & MULTI-TENANT INITIALIZATION =====
(function initTenantAndTheme() {
  // Theme Sync
  var savedTheme = localStorage.getItem("driven-theme") || sessionStorage.getItem("driven-theme");
  var systemTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  var theme = savedTheme || systemTheme;
  document.documentElement.setAttribute("data-theme", theme);

  // Multi-Tenant Isolation Sync
  var params = new URLSearchParams(window.location.search);
  var orgId = params.get('org_id') || params.get('orgId') || params.get('customerId') || localStorage.getItem('driven_org_id') || sessionStorage.getItem('driven_org_id');

  if (orgId) {
    localStorage.setItem('driven_org_id', orgId);
    localStorage.setItem('driven_customer_id', orgId);
    sessionStorage.setItem('driven_org_id', orgId);
  }

  var cachedUserStr = localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user");
  var cachedUser = null;
  try { if (cachedUserStr) cachedUser = JSON.parse(cachedUserStr); } catch(e) {}

  if (cachedUser && orgId) {
    cachedUser.org_id = orgId;
    localStorage.setItem("driven_user", JSON.stringify(cachedUser));
    sessionStorage.setItem("driven_user", JSON.stringify(cachedUser));
  }
})();

// ===== PWA SERVICE WORKER REGISTRATION =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function(err) {
      console.warn('[PWA] ServiceWorker registration skipped or failed:', err);
    });
  });
}

// ===== MULTI-TENANT & API UTILITIES =====
function getUrlContextParams() {
  var params = new URLSearchParams(window.location.search);
  var context = {};
  var orgId = params.get('org_id') || params.get('orgId') || params.get('customerId') || localStorage.getItem('driven_org_id') || sessionStorage.getItem('driven_org_id');
  if (orgId) context.org_id = orgId;
  return context;
}

function buildApiUrl(endpoint) {
  var ctx = getUrlContextParams();
  var url = new URL(endpoint, window.location.origin);
  if (ctx.org_id) url.searchParams.set('org_id', ctx.org_id);
  return url.pathname + url.search;
}

function getFetchHeaders() {
  var headers = { 'Content-Type': 'application/json' };
  var token = localStorage.getItem('driven_token') || sessionStorage.getItem('driven_token');
  var ctx = getUrlContextParams();
  
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (ctx.org_id) headers['X-Organization-ID'] = ctx.org_id;
  
  return headers;
}

/**
 * FIX 2: Strict Domain Protection against Org ID leakage to external URLs
 */
function preserveUrlParams(targetUrl) {
  try {
    var ctx = getUrlContextParams();
    var url = new URL(targetUrl, window.location.origin);

    // Only append parameters if the URL is on the exact same origin
    if (url.origin === window.location.origin) {
      if (ctx.org_id && !url.searchParams.has('org_id')) {
        url.searchParams.set('org_id', ctx.org_id);
      }
      return url.pathname + url.search + url.hash;
    }
  } catch(e) {
    console.warn('URL preservation skipped for external/invalid target:', targetUrl);
  }
  return targetUrl;
}

function isMobileDevice() {
  var ua = navigator.userAgent || '';
  var isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  var isSmallScreen = window.innerWidth <= 768;
  return isMobileUA || (isSmallScreen && navigator.maxTouchPoints > 0);
}

function markFormDirty() { formDirty = true; }
function clearFormDirty() { formDirty = false; }

window.addEventListener('beforeunload', function(e) {
  if (formDirty) { e.preventDefault(); e.returnValue = ''; }
});

function reportError(source, err) {
  var msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : 'Unknown error');
  var stack = (err && err.stack) ? err.stack : 'No stack trace';
  try {
    fetch(buildApiUrl('/api/log-error'), {
      method: 'POST',
      headers: getFetchHeaders(),
      body: JSON.stringify({
        source: 'Fuel Transfer Form (' + source + ')',
        message: msg,
        stack: stack,
        url: window.location.href,
        userAgent: navigator.userAgent
      })
    }).catch(function() {});
  } catch (e) { console.error('Failed to report error:', e); }
  console.error('[' + source + ']', msg, stack);
}

// ===== LOCATION SERVICES =====
function checkDeviceLocation() {
  if (!isMobileDevice()) {
    var banner = document.getElementById('locationStatusBanner');
    if (banner) banner.style.display = 'none';
    return;
  }

  if (!navigator.geolocation) {
    showLocationPopup('Your device does not support GPS location.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      deviceLocation = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: new Date().toISOString()
      };
      updateLocationStatus(true);
    },
    function(err) {
      deviceLocation = null;
      updateLocationStatus(false);
      var msg = 'Location is required to submit forms. ';
      if (err.code === 1) msg += 'You denied location access. Please enable it in device settings.';
      else if (err.code === 2) msg += 'Location is unavailable. Check GPS connection.';
      else if (err.code === 3) msg += 'Location request timed out. Please try again.';
      else msg += 'Error: ' + err.message;
      showLocationPopup(msg);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function updateLocationStatus(hasLocation) {
  var banner = document.getElementById('locationStatusBanner');
  if (!banner) return;

  if (!isMobileDevice()) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'block';
  if (hasLocation) {
    banner.className = 'location-banner ok';
    banner.innerHTML = '<strong>📍 Location:</strong> ' + deviceLocation.latitude.toFixed(6) + ', ' + deviceLocation.longitude.toFixed(6) + ' (±' + Math.round(deviceLocation.accuracy) + 'm)';
  } else {
    banner.className = 'location-banner warn';
    banner.innerHTML = '<strong>⚠️ Location is OFF</strong> — Click to retry <button onclick="checkDeviceLocation()" style="margin-left:8px;padding:4px 12px;border:1px solid #b45309;border-radius:4px;background:#fef3c7;color:#78350f;cursor:pointer;font-size:12px;">Retry</button>';
  }
}

function showLocationPopup(message) {
  var overlay = document.getElementById('locationPopupOverlay');
  var msgEl = document.getElementById('locationPopupMessage');
  if (!overlay || !msgEl) return;
  msgEl.innerHTML = '<p style="font-size:15px;margin:0 0 16px;">' + esc(message) + '</p>';
  overlay.style.display = 'flex';
}

function closeLocationPopup() {
  var overlay = document.getElementById('locationPopupOverlay');
  if (overlay) overlay.style.display = 'none';
}

function hasDeviceLocation() {
  return deviceLocation !== null && deviceLocation.latitude !== undefined && deviceLocation.longitude !== undefined;
}

function requireLocationOrPopup() {
  if (!isMobileDevice()) return true;
  if (hasDeviceLocation()) return true;
  showLocationPopup('Location is required to submit this form. Please enable location on your device and retry.');
  return false;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function insertHeaderTitle() {
  var row1 = document.querySelector('.dash-header-row1');
  if (row1 && !document.querySelector('.ft-header-title')) {
    var title = document.createElement('div');
    title.className = 'ft-header-title';
    title.textContent = 'Log Fuel Transfer';
    var logoArea = document.getElementById('dashCustomerLogoArea');
    var drivenLogo = row1.querySelector('.dash-driven-logo');
    if (logoArea && drivenLogo) row1.insertBefore(title, drivenLogo);
  }
}

function makeTabsSticky() {
  var header = document.getElementById('dashHeader');
  var tabBar = document.querySelector('.ft-tab-bar');
  if (header && tabBar) {
    var headerHeight = header.getBoundingClientRect().height || header.offsetHeight || 0;
    tabBar.style.top = headerHeight + 'px';
  }
}

window.dashLogout = function() {
  try { fetch(buildApiUrl('/auth/logout'), { method: 'POST', headers: getFetchHeaders() }); } catch (e) {}
  window.location.href = '/public/login.html';
};

function goBack() {
  var role = (window.dashUser && window.dashUser.role || '').toLowerCase();
  var dashUrl = (role === 'admin' || role === 'ro-admin') ? '/app/dashboard/admin.html' : '/app/dashboard/employee-dashboard.html';
  window.location.href = preserveUrlParams(dashUrl);
}

function showError(msg) {
  var el = document.getElementById('errorBanner');
  if (!msg) { el.style.display = 'none'; return; }
  el.textContent = msg;
  el.style.display = 'block';
}

// ===== DATA LOADERS =====
async function loadTanks() {
  try {
    var resp = await fetch(buildApiUrl('/api/fuel-tanks'), { headers: getFetchHeaders() });
    if (!resp.ok) return;
    var data = await resp.json();
    var list = Array.isArray(data) ? data : (data && (data.records || data.tanks || data.data) ? (data.records || data.tanks || data.data) : []);
    
    allTanks = list.map(function(item) {
      var f = item.fields || item;
      return {
        id: item.id || f.id,
        name: f.name || f['Tank Name'] || f.tank_name || 'Tank',
        tank_type: f.tank_type || f['Tank Type'] || f.type || 'bulk',
        current_quantity: f.current_quantity || f['Current Quantity'] || 0,
        capacity: f.capacity || f.Capacity || 0,
        fuel_type: f.fuel_type || f['Fuel Type'] || ''
      };
    });
    updateToOptions();
  } catch (e) {
    console.error('Failed to load tanks:', e);
    reportError('loadTanks', e);
  }
}

async function loadAssets() {
  try {
    var resp = await fetch(buildApiUrl('/api/assets'), { headers: getFetchHeaders() });
    if (!resp.ok) resp = await fetch(buildApiUrl('/api/equipment'), { headers: getFetchHeaders() });
    if (!resp.ok) return;
    
    var data = await resp.json();
    var list = Array.isArray(data) ? data : (data && (data.records || data.assets || data.equipment || data.data) ? (data.records || data.assets || data.equipment || data.data) : []);

    allAssets = list.map(function(item) {
      var f = item.fields || item;
      var rawStatus = f['Status'] || f.status || item.status || 'active';
      var assetId = item.id || f.id || f.asset_number || f['Equipment ID'] || f.code;
      var assetNum = f['Equipment ID'] || f.asset_number || f.code || item.id || '';
      var assetName = f['Equipment Name'] || f.name || f.equipment_name || 'Unnamed Asset';
      
      return {
        id: assetId,
        asset_number: assetNum,
        name: assetName,
        category: f['Category'] || f.category || '',
        status: String(rawStatus).toLowerCase().trim(),
        fuel_type: f['Fuel Type'] || f.fuel_type || ''
      };
    }).filter(function(a) {
      return a.status !== 'inactive' && a.status !== 'retired' && a.status !== 'archived';
    });

    updateToOptions();
    if (document.getElementById('fromSource').value === 'asset') {
      onFromChange();
    }
  } catch (e) {
    console.error('Failed to load assets:', e);
    reportError('loadAssets', e);
  }
}

async function loadFuelTypes() {
  var select = document.getElementById('fuelType');
  select.innerHTML = '<option value="">Select fuel type…</option>';
  try {
    var resp = await fetch(buildApiUrl('/api/fuel-types'), { headers: getFetchHeaders() });
    if (!resp.ok) throw new Error('API returned HTTP status ' + resp.status);
    
    var data = await resp.json();
    var types = Array.isArray(data) ? data : (data && (data.records || data.fuelTypes || data.fuel_types || data.data) ? (data.records || data.fuelTypes || data.fuel_types || data.data) : []);

    if (types && types.length > 0) {
      types.forEach(function(item) {
        var f = item.fields || item;
        var val = f.fuel_code || f.code || f.id || f['Fuel Code'] || f['Fuel Name'] || f.fuel_name;
        var label = f.fuel_name || f['Fuel Name'] || f.name || val;
        
        var opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        select.appendChild(opt);
      });
    } else {
      select.innerHTML = '<option value="">No fuel types configured in system</option>';
    }
  } catch (e) {
    console.error('Failed to load fuel types:', e);
    select.innerHTML = '<option value="">Error loading fuel types</option>';
    reportError('loadFuelTypes', e);
  }
}

async function loadProjects() {
  try {
    var resp = await fetch(buildApiUrl('/api/projects'), { headers: getFetchHeaders() });
    if (!resp.ok) return;
    var data = await resp.json();
    var projectsList = Array.isArray(data) ? data : (data && (data.records || data.projects || data.data) ? (data.records || data.projects || data.data) : []);
    var select = document.getElementById('project');
    select.innerHTML = '<option value="">Select project (optional)…</option>';
    var seenProjects = new Set();
    
    projectsList.forEach(function(p) {
      var f = p.fields || p;
      var id = p.id || f.id || f.project_id;
      var name = f['Project Name'] || f.name || f.project_name || id;
      if (id && !seenProjects.has(id)) {
        seenProjects.add(id);
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = name;
        select.appendChild(opt);
      }
    });
  } catch (e) {
    console.error('Failed to load projects:', e);
  }
}

async function loadLocations() {
  try {
    var resp = await fetch(buildApiUrl('/api/locations'), { headers: getFetchHeaders() });
    if (!resp.ok) return;
    var data = await resp.json();
    var select = document.getElementById('location');
    select.innerHTML = '<option value="">Select location…</option>';
    var locList = Array.isArray(data) ? data : (data && (data.records || data.locations || data.data) ? (data.records || data.locations || data.data) : []);
    var seenLocations = new Set();

    locList.forEach(function(loc) {
      var f = loc.fields || loc;
      var val = typeof loc === 'string' ? loc : (f['Location Name'] || f.name || f.id);
      if (val && !seenLocations.has(val)) {
        seenLocations.add(val);
        var opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        select.appendChild(opt);
      }
    });
  } catch (e) {
    console.error('Failed to load locations:', e);
  }
}

// ===== FORM INTERACTION CONTROLLERS =====
function onFromChange() {
  markFormDirty();
  var fromType = document.getElementById('fromSource').value;
  var fromTankRow = document.getElementById('fromTankRow');
  var fromAssetRow = document.getElementById('fromAssetRow');
  var fromTank = document.getElementById('fromTank');
  var fromAsset = document.getElementById('fromAsset');

  fromTank.innerHTML = '';
  fromAsset.innerHTML = '';
  document.getElementById('fromTankInfo').textContent = '';
  var fromAssetInfo = document.getElementById('fromAssetInfo');
  if (fromAssetInfo) fromAssetInfo.textContent = '';

  fromTankRow.style.display = 'none';
  fromAssetRow.style.display = 'none';

  if (fromType === 'asset') {
    fromAssetRow.style.display = 'block';
    if (!allAssets || allAssets.length === 0) {
      fromAsset.innerHTML = '<option value="">No equipment available in assets table</option>';
    } else {
      fromAsset.innerHTML = '<option value="">Select equipment…</option>';
      allAssets.forEach(function(a) {
        var opt = document.createElement('option');
        var assetId = a.id || a.asset_number;
        opt.value = assetId;
        var nameStr = a.name || 'Unnamed Asset';
        var numStr = a.asset_number || (a.id ? String(a.id).slice(0,8) : '');
        opt.textContent = (numStr && numStr !== nameStr ? numStr + ' — ' : '') + nameStr + (a.category ? ' [' + a.category + ']' : '');
        opt.dataset.fuelType = a.fuel_type || '';
        fromAsset.appendChild(opt);
      });
    }
  } else if (fromType) {
    fromTankRow.style.display = 'block';
    var tankType = fromType.replace('_tank', '').replace('_can', '');
    var matching = allTanks.filter(function(t) {
      if (tankType === 'portable') return t.tank_type === 'portable';
      if (tankType === 'bulk') return t.tank_type === 'bulk';
      if (tankType === 'dragup') return t.tank_type === 'dragup';
      return false;
    });
    if (!matching || matching.length === 0) {
      fromTank.innerHTML = '<option value="">No tanks of this type available</option>';
    } else {
      fromTank.innerHTML = '<option value="">Select tank…</option>';
      matching.forEach(function(t) {
        var opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = (t.name || 'Tank') + ' — ' + (t.current_quantity||0) + '/' + (t.capacity||0) + ' gal (' + (t.fuel_type||'?') + ')';
        opt.dataset.fuelType = t.fuel_type || '';
        fromTank.appendChild(opt);
      });
    }
  }

  updateToOptions();
}

function onFromAssetChange() {
  var fromAsset = document.getElementById('fromAsset');
  var selected = fromAsset.selectedOptions[0];
  var info = document.getElementById('fromAssetInfo');
  if (selected && selected.value) {
    var fuelType = selected.dataset.fuelType;
    if (fuelType) {
      info.textContent = 'Fuel type: ' + fuelType;
      var fuelSelect = document.getElementById('fuelType');
      for (var i = 0; i < fuelSelect.options.length; i++) {
        if (fuelSelect.options[i].value === fuelType) {
          fuelSelect.selectedIndex = i;
          break;
        }
      }
    }
  } else {
    info.textContent = '';
  }
  updateToOptions();
}

function onFromTankChange() {
  var fromTank = document.getElementById('fromTank');
  var selected = fromTank.selectedOptions[0];
  var info = document.getElementById('fromTankInfo');
  if (selected && selected.value) {
    var fuelType = selected.dataset.fuelType;
    if (fuelType) {
      info.textContent = 'Fuel type: ' + fuelType;
      var fuelSelect = document.getElementById('fuelType');
      for (var i = 0; i < fuelSelect.options.length; i++) {
        if (fuelSelect.options[i].value === fuelType) {
          fuelSelect.selectedIndex = i;
          break;
        }
      }
    }
  } else {
    info.textContent = '';
  }
}

function updateToOptions() {
  var fromType = document.getElementById('fromSource').value;
  var fromAssetId = document.getElementById('fromAsset').value;
  var toSelect = document.getElementById('toDest');

  toSelect.innerHTML = '<option value="">Select destination…</option>';

  if (allAssets && allAssets.length > 0) {
    var assetGroup = document.createElement('optgroup');
    assetGroup.label = 'Equipment / Assets';
    var addedAssets = 0;

    allAssets.forEach(function(a) {
      var assetId = a.id || a.asset_number;
      if (fromType === 'asset' && fromAssetId && String(assetId) === String(fromAssetId)) {
        return;
      }
      var opt = document.createElement('option');
      opt.value = 'asset|' + assetId;
      var nameStr = a.name || 'Unnamed Asset';
      var numStr = a.asset_number || (a.id ? String(a.id).slice(0,8) : '');
      opt.textContent = (numStr && numStr !== nameStr ? numStr + ' — ' : '') + nameStr + (a.category ? ' [' + a.category + ']' : '');
      opt.dataset.destType = 'asset';
      opt.dataset.destId = assetId;
      assetGroup.appendChild(opt);
      addedAssets++;
    });

    if (addedAssets > 0) {
      toSelect.appendChild(assetGroup);
    }
  }

  var tankDestTypes = [];
  if (fromType === 'bulk_tank') tankDestTypes = ['dragup_tank', 'portable_can'];
  else if (fromType === 'dragup_tank') tankDestTypes = ['portable_can'];
  else if (fromType === 'asset') tankDestTypes = ['bulk_tank', 'dragup_tank', 'portable_can'];

  if (tankDestTypes.length > 0 && allTanks && allTanks.length > 0) {
    var tankGroup = document.createElement('optgroup');
    tankGroup.label = 'Tanks';
    tankDestTypes.forEach(function(destType) {
      var tankType = destType === 'bulk_tank' ? 'bulk' : (destType === 'dragup_tank' ? 'dragup' : 'portable');
      var matching = allTanks.filter(function(t) { return t.tank_type === tankType; });
      matching.forEach(function(t) {
        var opt = document.createElement('option');
        var tankId = t.id;
        opt.value = destType + '|' + tankId;
        opt.textContent = (t.name || 'Tank') + ' — ' + (t.current_quantity||0) + '/' + (t.capacity||0) + ' gal (' + (t.fuel_type||'?') + ')';
        opt.dataset.destType = destType;
        opt.dataset.destId = tankId;
        tankGroup.appendChild(opt);
      });
    });
    if (tankGroup.children.length > 0) {
      toSelect.appendChild(tankGroup);
    }
  }

  onToChange();
}

function onToChange() {
  markFormDirty();
  var toSelect = document.getElementById('toDest');
  var selected = toSelect.selectedOptions[0];
  var destType = selected ? (selected.dataset.destType || '') : '';
  
  var meterReadingRow = document.getElementById('meterReadingRow');
  var meterReadingInput = document.getElementById('meterReading');

  if (destType === 'asset') {
    meterReadingRow.style.display = 'block';
    meterReadingInput.required = true;
    meterReadingInput.setAttribute('aria-required', 'true');
  } else {
    meterReadingRow.style.display = 'none';
    meterReadingInput.required = false;
    meterReadingInput.removeAttribute('aria-required');
    meterReadingInput.value = '';
  }
}

function getTransactionType(fromType, toType) {
  if (fromType === 'bulk_tank' && toType === 'asset') return 'bulk_issue';
  if (fromType === 'bulk_tank' && toType === 'dragup_tank') return 'dragup_fill';
  if (fromType === 'bulk_tank' && toType === 'portable_can') return 'portable_fill';
  if (fromType === 'dragup_tank' && toType === 'asset') return 'dragup_issue';
  if (fromType === 'dragup_tank' && toType === 'portable_can') return 'portable_fill';
  if (fromType === 'portable_can' && toType === 'asset') return 'portable_issue';
  if (fromType === 'asset' && toType === 'bulk_tank') return 'return';
  if (fromType === 'asset' && toType === 'dragup_tank') return 'dragup_fill';
  if (fromType === 'asset' && toType === 'portable_can') return 'portable_fill';
  if (fromType === 'asset' && toType === 'asset') return 'asset_transfer';
  return null;
}

// ===== MEDIA / PHOTO PROCESSING =====
async function loadFuelPhotoSettings() {
  try {
    var res = await fetch(buildApiUrl('/auth/get-settings'), { headers: getFetchHeaders() });
    var data = await res.json();
    if (data.success && data.settings) {
      fuelPhotoSettings.meter = !!data.settings.fuel_meter_photo;
      fuelPhotoSettings.asset = !!data.settings.fuel_asset_photo;
      var section = document.getElementById('fuelPhotoSection');
      var banner = document.getElementById('fuelPhotoBanner');
      var meterBox = document.getElementById('meterPhotoBox');
      var assetBox = document.getElementById('assetPhotoBox');
      if (fuelPhotoSettings.meter || fuelPhotoSettings.asset) {
        if (section) section.style.display = 'block';
        if (banner) banner.style.display = 'block';
        if (meterBox) meterBox.style.display = fuelPhotoSettings.meter ? 'block' : 'none';
        if (assetBox) assetBox.style.display = fuelPhotoSettings.asset ? 'block' : 'none';
      }
    }
  } catch (e) { console.error('Fuel photo settings load error:', e.message); }
}

function getExifDate(file) {
  return new Promise(function(resolve) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var bytes = new Uint8Array(e.target.result);
        if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) { resolve(null); return; }
        var i = 2;
        while (i < bytes.length) {
          if (bytes[i] !== 0xFF) { i++; continue; }
          var marker = bytes[i + 1];
          var size = (bytes[i + 2] << 8) | bytes[i + 3];
          if (marker === 0xE1) {
            var exifData = bytes.subarray(i + 4, i + 2 + size);
            var str = '';
            for (var j = 0; j < exifData.length && j < 65536; j++) { str += String.fromCharCode(exifData[j]); }
            var dateMatch = str.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
            if (dateMatch) { resolve(dateMatch[1] + '-' + dateMatch[2] + '-' + dateMatch[3]); } else { resolve(null); }
            return;
          }
          i += 2 + size;
        }
        resolve(null);
      } catch (e) { resolve(null); }
    };
    reader.onerror = function() { resolve(null); };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * FIX 3: Client-side Image Resizing & Compression via Canvas
 * Reduces 5MB raw camera captures to ~150-400KB base64 payloads
 */
function compressImage(dataUrl, maxWidth, maxHeight, quality) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.src = dataUrl;
    img.onload = function() {
      var width = img.width;
      var height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', quality || 0.85));
    };
    img.onerror = function() { resolve(dataUrl); };
  });
}

/**
 * FIX 1: Dynamic EXIF Re-validation on Form Date Change
 */
function revalidateExifDates() {
  markFormDirty();
  var formDate = document.getElementById('txDate').value;
  ['meter', 'asset'].forEach(function(type) {
    managerReviewFlags = managerReviewFlags.filter(function(f) { return f.field !== type + '_photo'; });
    if (fuelPhotos[type] && fuelPhotos[type].exifDate) {
      var photoDate = fuelPhotos[type].exifDate;
      if (photoDate !== formDate) {
        managerReviewFlags.push({
          field: type + '_photo',
          value: 'Photo date (' + photoDate + ') does not match form date (' + formDate + ')',
          reason: 'Photo date (' + photoDate + ') does not match form date (' + formDate + ') — possible old photo. Manager should review.'
        });
      }
    } else if (fuelPhotos[type] && !fuelPhotos[type].exifDate) {
      managerReviewFlags.push({
        field: type + '_photo',
        value: 'EXIF date could not be verified',
        reason: 'Photo date could not be verified (EXIF metadata missing). Manager should review.'
      });
    }
  });
}

async function handleFuelPhotoUpload(input, type) {
  var file = input.files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png'].some(function(t) { return file.type === t; })) { alert('Please upload a JPEG or PNG image.'); return; }
  if (file.size > 10000000) { alert('Photo is too large. Max 10MB.'); return; }

  managerReviewFlags = managerReviewFlags.filter(function(f) { return f.field !== type + '_photo'; });

  var reader = new FileReader();
  reader.onload = async function(e) {
    var rawDataUrl = e.target.result;
    // Compress photo to maximum 1200x1200 resolution at 85% quality
    var compressedDataUrl = await compressImage(rawDataUrl, 1200, 1200, 0.85);
    
    fuelPhotoData[type] = compressedDataUrl;
    var preview = document.getElementById(type + 'PhotoPreview');
    preview.innerHTML = '<img src="' + compressedDataUrl + '" alt="' + type + ' photo">';
    var removeBtn = document.getElementById(type + 'PhotoRemove');
    if (removeBtn) removeBtn.style.display = 'inline-block';
    markFormDirty();
  };
  reader.readAsDataURL(file);

  var photoDate = await getExifDate(file);
  var formDate = document.getElementById('txDate').value;
  fuelPhotos[type] = { file: file, exifDate: photoDate };
  
  if (photoDate && formDate) {
    if (photoDate !== formDate) {
      managerReviewFlags.push({ field: type + '_photo', value: 'Photo date (' + photoDate + ') does not match form date (' + formDate + ')', reason: 'Photo date (' + photoDate + ') does not match form date (' + formDate + ') — possible old photo. Manager should review.' });
    }
  } else if (!photoDate) {
    managerReviewFlags.push({ field: type + '_photo', value: 'EXIF date could not be verified', reason: 'Photo date could not be verified (EXIF metadata missing). Manager should review.' });
  }
}

function removeFuelPhoto(type) {
  fuelPhotoData[type] = null;
  fuelPhotos[type] = null;
  var preview = document.getElementById(type + 'PhotoPreview');
  if (preview) preview.innerHTML = '';
  var removeBtn = document.getElementById(type + 'PhotoRemove');
  if (removeBtn) removeBtn.style.display = 'none';
  var input = document.getElementById(type + 'PhotoInput');
  if (input) input.value = '';
  managerReviewFlags = managerReviewFlags.filter(function(f) { return f.field !== type + '_photo'; });
}

function validateFuelPhotos() {
  if (fuelPhotoSettings.meter && !fuelPhotoData.meter) { alert('A meter photo is required. Please take a photo of the meter/gauge before submitting.'); return false; }
  if (fuelPhotoSettings.asset && !fuelPhotoData.asset) { alert('An asset photo is required. Please take a photo of the asset/equipment before submitting.'); return false; }
  return true;
}

// ===== FORM SUBMISSION & RESET =====
async function submitTransfer(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (isSubmitting) return;

  if (!requireLocationOrPopup()) return;
  if (!validateFuelPhotos()) return;
  showError('');

  var fromType = document.getElementById('fromSource').value;
  var fromTankId = document.getElementById('fromTank').value;
  var fromAssetId = document.getElementById('fromAsset').value;

  var toSelect = document.getElementById('toDest');
  var toSelected = toSelect.selectedOptions[0];
  var toType = toSelected ? (toSelected.dataset.destType || '') : '';
  var toEntityId = toSelected ? (toSelected.dataset.destId || '') : '';

  var quantity = parseFloat(document.getElementById('quantity').value);
  var txDate = document.getElementById('txDate').value;
  var fuelType = document.getElementById('fuelType').value;
  var projectId = document.getElementById('project').value;
  var location = document.getElementById('location').value.trim();
  var notes = document.getElementById('notes').value.trim();
  var meterReading = document.getElementById('meterReading').value ? parseFloat(document.getElementById('meterReading').value) : null;

  if (!fromType) { showError('Please select a source.'); return; }
  if (fromType === 'asset') {
    if (!fromAssetId) { showError('Please select which equipment the fuel is coming from.'); return; }
  } else {
    if (!fromTankId) { showError('Please select which tank the fuel is coming from.'); return; }
  }
  if (!toType || !toEntityId) { showError('Please select a destination (asset or tank).'); return; }
  if (toType === 'asset' && (meterReading === null || isNaN(meterReading))) {
    showError('Please enter the current meter reading for the asset being fueled.'); return;
  }
  if (!quantity || quantity <= 0) { showError('Please enter a valid quantity (must be greater than 0).'); return; }
  if (!txDate) { showError('Please select a date.'); return; }
  if (!fuelType) { showError('Please select a valid fuel type.'); return; }

  var txType = getTransactionType(fromType, toType);
  if (!txType) {
    showError('Invalid transfer combination. Please check your selections.'); return;
  }

  isSubmitting = true;
  var submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  try {
    var fromEntityId = fromType === 'asset' ? fromAssetId : fromTankId;
    var body = {
      transaction_type: txType,
      fuel_type: fuelType,
      quantity: quantity,
      transaction_date: txDate,
      submission_timestamp: new Date().toISOString(),
      from_entity_type: fromType,
      from_entity_id: fromEntityId,
      to_entity_type: toType,
      to_entity_id: toEntityId,
      meter_reading: meterReading,
      project_id: projectId || null,
      location: location || null,
      notes: notes || null,
      device_location: hasDeviceLocation() ? deviceLocation : null,
      manager_review_flags: managerReviewFlags,
      fuel_photos: {
        meter: fuelPhotoData.meter || null,
        asset: fuelPhotoData.asset || null
      }
    };
    if (fromType === 'asset') body.asset_id = fromAssetId;
    if (toType === 'asset') body.asset_id = toEntityId;

    var ctx = getUrlContextParams();
    if (ctx.org_id) body.org_id = ctx.org_id;

    var resp = await fetch(buildApiUrl('/api/fuel-transactions'), {
      method: 'POST',
      headers: getFetchHeaders(),
      body: JSON.stringify(body)
    });

    var data = await resp.json();

    if (data.success) {
      clearFormDirty();
      document.getElementById('formView').style.display = 'none';
      document.getElementById('successView').style.display = 'block';
      var fromName = '';
      if (fromType === 'asset') {
        fromName = document.getElementById('fromAsset').selectedOptions[0].textContent;
      } else {
        fromName = document.getElementById('fromTank').selectedOptions[0].textContent.split(' —')[0];
      }
      var toName = toSelected ? toSelected.textContent : '';
      document.getElementById('successMsg').textContent =
        quantity + ' gallons of ' + fuelType + ' transferred from ' + fromName + ' to ' + toName;
    } else {
      showError(data.error || 'Failed to log transfer. Please try again.');
    }
  } catch (e) {
    showError('Network error: ' + e.message);
    reportError('submitTransfer', e);
  } finally {
    isSubmitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log Transfer';
  }
}

function resetForm() {
  clearFormDirty();
  managerReviewFlags = [];
  document.getElementById('formView').style.display = 'block';
  document.getElementById('successView').style.display = 'none';
  document.getElementById('fromSource').value = '';
  document.getElementById('fromTank').innerHTML = '';
  document.getElementById('fromTankRow').style.display = 'none';
  document.getElementById('fromAsset').innerHTML = '';
  document.getElementById('fromAssetRow').style.display = 'none';
  document.getElementById('toDest').innerHTML = '<option value="">Select destination…</option>';
  document.getElementById('meterReadingRow').style.display = 'none';
  document.getElementById('meterReading').value = '';
  document.getElementById('quantity').value = '';
  document.getElementById('fuelType').value = '';
  document.getElementById('location').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('project').value = '';
  document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
  removeFuelPhoto('meter');
  removeFuelPhoto('asset');
  showError('');
}

// ===== LIFECYCLE & INITIALIZATION =====
async function initPage() {
  var user = window.dashUser;
  if (!user) {
    try {
      user = JSON.parse(localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user"));
    } catch(e) {}
  }

  if (!user) { 
    window.location.href = '/public/login.html'; 
    return; 
  }

  window.dashUser = user;

  var role = (user.role || '').toLowerCase();
  var dashUrl = (role === 'admin' || role === 'ro-admin') ? '/app/dashboard/admin.html' : '/app/dashboard/employee-dashboard.html';
  var homeLink = document.getElementById('dashHomeLink');
  if (homeLink) homeLink.href = preserveUrlParams(dashUrl);

  var purchaseLink = document.getElementById('fuelPurchaseLink');
  if (purchaseLink) purchaseLink.href = preserveUrlParams(purchaseLink.getAttribute('href'));

  var tabBar = document.querySelector('.ft-tab-bar');
  if (tabBar) tabBar.style.display = 'flex';

  insertHeaderTitle();

  setTimeout(makeTabsSticky, 100);
  setTimeout(makeTabsSticky, 500);

  var txDateEl = document.getElementById('txDate');
  if (txDateEl && !txDateEl.value) {
    txDateEl.value = new Date().toISOString().split('T')[0];
  }

  var loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'none';
  
  var dashEl = document.getElementById('dashboard');
  if (dashEl) dashEl.style.display = 'block';

  var banner = document.getElementById('locationStatusBanner');
  if (banner) {
    banner.style.display = isMobileDevice() ? 'block' : 'none';
  }

  if (isMobileDevice() && !hasDeviceLocation()) {
    checkDeviceLocation();
  }

  await Promise.all([
    loadTanks(),
    loadAssets(),
    loadFuelTypes(),
    loadProjects(),
    loadLocations()
  ]);

  onFromChange();
  loadFuelPhotoSettings();
}

// Attach Event Handlers & Kick Off Page Load
if (window.dashUser || window.drivenUser) {
  initPage();
} else {
  document.addEventListener('dashSessionLoaded', function() {
    initPage();
  });
  setTimeout(function() {
    if (document.getElementById('loading') && document.getElementById('loading').style.display !== 'none') {
      initPage();
    }
  }, 200);
}

window.addEventListener('resize', makeTabsSticky);
window.addEventListener('orientationchange', makeTabsSticky);
