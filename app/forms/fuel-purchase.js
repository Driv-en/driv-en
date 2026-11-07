/**
 * File: fuel-purchase.js
 * Date Revised: March 7, 2026
 *
 * Purpose:
 * Handles client-side logic for logging and submitting fuel purchases across 
 * mobile and desktop devices in a PWA (Progressive Web App) environment. 
 * Features include multi-tenant isolation via URL/auth context parameters, 
 * theme (dark/light) carryover from the main user dashboard, automated AI 
 * receipt OCR data extraction (with fixed viewport modal cropping interface), dynamic multi-line 
 * item tracking, EXIF metadata validation for photo uploads, dynamic option 
 * loading (users, locations, projects, assets), mobile-specific GPS location 
 * verification, payment/PO type management, card vendor selection/extraction,
 * vendor address auto-population, and mandatory Payment Type selection before receipt upload.
 */

var allTanks = [];
var allAssets = [];
var tankTypes = [];
var receiptR2Key = null;
var lineItemCount = 0;
var _objectUrl = null;
var deviceLocation = null;
var formDirty = false;
var managerReviewFlags = [];
var fuelPhotoSettings = { meter: false, asset: false };
var fuelPhotos = { meter: null, asset: null };
var fuelPhotoData = { meter: null, asset: null };
var _extractedVendorLocation = {};

/* ===== DEVICE DETECTION ===== */
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         (navigator.maxTouchPoints > 0 && window.innerWidth <= 800);
}

/* ===== DATE PARSER (FORMATS OCR DATES TO YYYY-MM-DD FOR INPUT TYPE="DATE") ===== */
function parseToIsoDate(str) {
  if (!str) return null;
  var s = String(str).trim();
  
  // Handles MM/DD/YY or MM/DD/YYYY formats (e.g., 8/13/26 or 08/13/2026)
  var slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    var m = String(slashMatch[1]).padStart(2, '0');
    var d = String(slashMatch[2]).padStart(2, '0');
    var y = slashMatch[3];
    if (y.length === 2) y = '20' + y;
    return y + '-' + m + '-' + d;
  }
  
  // Handles already ISO-formatted dates (YYYY-MM-DD)
  var isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  return null;
}

/* ===== URL CONTEXT & MULTI-TENANT AUTH HELPER ===== */
function getUrlContextParams() {
  var params = new URLSearchParams(window.location.search);
  var context = {};
  var orgId = params.get('org_id') || params.get('orgId') || params.get('customerId') || localStorage.getItem('driven_org_id');
  var roleId = params.get('role_id') || params.get('roleId') || params.get('role') || localStorage.getItem('driven_role');
  if (orgId) context.org_id = orgId;
  if (roleId) context.role_id = roleId;
  return context;
}

function buildApiUrl(endpoint) {
  var ctx = getUrlContextParams();
  var url = new URL(endpoint, window.location.origin);
  if (ctx.org_id) url.searchParams.set('org_id', ctx.org_id);
  if (ctx.role_id) url.searchParams.set('role_id', ctx.role_id);
  return url.pathname + url.search;
}

function preserveUrlParams(targetUrl) {
  var ctx = getUrlContextParams();
  var url = new URL(targetUrl, window.location.origin);
  if (ctx.org_id && !url.searchParams.has('org_id')) url.searchParams.set('org_id', ctx.org_id);
  if (ctx.role_id && !url.searchParams.has('role_id')) url.searchParams.set('role_id', ctx.role_id);
  return url.pathname + url.search;
}

function markFormDirty() { formDirty = true; }
function clearFormDirty() { formDirty = false; }

window.addEventListener('beforeunload', function(e) {
  if (formDirty) { e.preventDefault(); e.returnValue = ''; }
});

/* ===== PAYMENT TYPE & CARD VENDOR TOGGLES ===== */
function handlePaymentTypeChange(selectEl) {
  var val = (selectEl ? selectEl.value : '').trim();
  var poWrap = document.getElementById('poNumberWrap');
  var cardWrap = document.getElementById('cardLast4Wrap');
  var vendorWrap = document.getElementById('cardVendorWrap');

  if (poWrap) {
    if (val === 'On Account' || val === 'On Account / PO') {
      poWrap.style.display = 'flex';
    } else {
      poWrap.style.display = 'none';
      var poInp = document.getElementById('purchasePONumber');
      if (poInp) poInp.value = '';
    }
  }

  var isCard = (val === 'Credit Card' || val === 'Fleet Card');

  if (cardWrap) {
    if (isCard) {
      cardWrap.style.display = 'flex';
    } else {
      cardWrap.style.display = 'none';
      var cardInp = document.getElementById('purchaseCardLast4');
      if (cardInp) cardInp.value = '';
    }
  }

  if (vendorWrap) {
    if (isCard) {
      vendorWrap.style.display = 'flex';
    } else {
      vendorWrap.style.display = 'none';
      var vendorInp = document.getElementById('purchaseCardVendor');
      if (vendorInp) vendorInp.value = '';
    }
  }
}

/* ===== REQUIRE PAYMENT TYPE BEFORE UPLOADING RECEIPT ===== */
function triggerReceiptCapture(type) {
  var payEl = document.getElementById('purchasePaymentType');
  var val = payEl ? payEl.value.trim() : '';
  if (!val) {
    alert('Please select a Payment Type before taking or uploading a receipt photo.');
    if (payEl) payEl.focus();
    return;
  }
  if (type === 'camera') {
    var camInput = document.getElementById('receiptCameraInput');
    if (camInput) camInput.click();
  } else if (type === 'file') {
    var fileInput = document.getElementById('receiptFileInput');
    if (fileInput) fileInput.click();
  }
}

/* ===== RECEIPT TOTAL MISMATCH CHECK ===== */
function checkReceiptMismatch() {
  var receiptTotalInput = document.getElementById('receiptTotal');
  var notice = document.getElementById('receiptMismatchNotice');
  if (!receiptTotalInput || !notice) return;
  var rt = parseFloat(receiptTotalInput.value);
  var grandTotalEl = document.getElementById('grandTotal');
  if (!grandTotalEl) return;
  var totalText = grandTotalEl.textContent.replace('$', '').replace(',', '');
  var gt = parseFloat(totalText);
  if (!isNaN(rt) && !isNaN(gt) && Math.abs(rt - gt) > 0.05) {
    notice.style.display = 'block';
    window._receiptMismatch = true;
  } else {
    notice.style.display = 'none';
    window._receiptMismatch = false;
  }
}

/* ===== CLIENT-SIDE ERROR REPORTING ===== */
var _reportErrorInFlight = false;
function reportError(source, err) {
  var msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : 'Unknown error');
  var stack = (err && err.stack) ? err.stack : 'No stack trace';
  console.error('[' + source + ']', msg, stack);
  var lowerMsg = (msg || '').toLowerCase();
  if (lowerMsg.indexOf('not authenticated') !== -1 ||
      lowerMsg.indexOf('session') !== -1 ||
      lowerMsg.indexOf('unauthorized') !== -1 ||
      lowerMsg.indexOf('401') !== -1 ||
      lowerMsg.indexOf('forbidden') !== -1 ||
      lowerMsg.indexOf('403') !== -1) {
    console.warn('[' + source + '] Suppressed error report for auth-related error (no redirect):', msg);
    return;
  }
  if (_reportErrorInFlight) return;
  _reportErrorInFlight = true;
  try {
    fetch(buildApiUrl('/api/log-error'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Fuel Purchase Form (' + source + ')',
        message: msg,
        stack: stack,
        url: window.location.href,
        userAgent: navigator.userAgent
      })
    }).then(function() { _reportErrorInFlight = false; })
      .catch(function() { _reportErrorInFlight = false; });
  } catch (e) { _reportErrorInFlight = false; }
}

/* ===== DEVICE LOCATION CHECK ===== */
function checkDeviceLocation() {
  if (!isMobileDevice()) {
    deviceLocation = null;
    closeLocationPopup();
    updateLocationStatus(false);
    return;
  }
  if (!navigator.geolocation) {
    showLocationPopup('Your device does not support GPS location. Please use a device with location capabilities.');
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
      var msg = 'Location is required to submit forms on mobile. ';
      if (err.code === 1) msg += 'You denied location access. Please enable it in your device settings.';
      else if (err.code === 2) msg += 'Location is unavailable. Check your GPS or network connection.';
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
  if (hasLocation && deviceLocation) {
    banner.className = 'location-banner ok';
    banner.innerHTML = '<strong>📍 Location:</strong> ' + deviceLocation.latitude.toFixed(6) + ', ' + deviceLocation.longitude.toFixed(6) + ' (±' + Math.round(deviceLocation.accuracy) + 'm)';
  } else {
    banner.className = 'location-banner warn';
    banner.innerHTML = '<strong>⚠️ Location is OFF</strong> — Click to retry <button onclick="checkDeviceLocation()" style="margin-left:8px;padding:4px 12px;border:1px solid #b45309;border-radius:4px;background:#fef3c7;color:#78350f;cursor:pointer;font-size:12px;">Retry</button>';
  }
}

function showLocationPopup(message) {
  if (!isMobileDevice()) return;
  
  var overlay = document.getElementById('locationPopupOverlay');
  var msgEl = document.getElementById('locationPopupMessage');
  if (!overlay || !msgEl) return;

  var instructionsHtml = 
    '<p style="margin:0 0 6px;"><strong>iPhone/iPad (iOS):</strong> Settings → Privacy & Security → Location Services → ON → Browser → "While Using"</p>' +
    '<p style="margin:0 0 6px;"><strong>Android:</strong> Settings → Location → ON → App permissions → Browser → "Allow only while using the app"</p>';

  msgEl.innerHTML = 
    '<p style="font-size:15px;margin:0 0 16px;color:var(--text, #ffffff);">' + esc(message) + '</p>' +
    '<div style="background:var(--bg-card, #1e293b);border:1px solid var(--border, #334155);border-radius:8px;padding:14px;margin-bottom:12px;color:var(--text, #f8fafc);">' +
      '<p style="font-weight:600;margin:0 0 8px;color:var(--primary, #38bdf8);">How to enable location:</p>' +
      instructionsHtml +
    '</div>' +
    '<p style="font-size:13px;color:var(--text-muted, #94a3b8);margin:0;">After enabling, click "Retry" to capture your location.</p>';

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
  showLocationPopup('Location is required to submit this form on a mobile device. Please enable location on your device and retry.');
  return false;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ===== DYNAMIC AUTO-FITTING & FLEXIBLE HEADER TITLE ===== */
function fitHeaderTitle(el) {
  if (!el) return;

  // Clear absolute positioning and apply flexible layout rules
  el.style.setProperty('position', 'relative', 'important');
  el.style.setProperty('left', 'auto', 'important');
  el.style.setProperty('transform', 'none', 'important');
  el.style.setProperty('flex', '1 1 auto', 'important');
  el.style.setProperty('width', '0', 'important');
  el.style.setProperty('min-width', '0', 'important');
  
  // Force word wrapping
  el.style.setProperty('white-space', 'normal', 'important');
  el.style.setProperty('word-break', 'break-word', 'important');
  el.style.setProperty('overflow-wrap', 'break-word', 'important');
  el.style.setProperty('overflow', 'visible', 'important');
  el.style.setProperty('text-overflow', 'clip', 'important');
  el.style.setProperty('text-align', 'center', 'important');
  el.style.setProperty('line-height', '1.15', 'important');
}

function insertHeaderTitle() {
  var title = document.getElementById('dashHeaderTitle');
  if (!title) {
    var row1 = document.querySelector('.dash-header-row1');
    if (row1) {
      title = document.createElement('div');
      title.id = 'dashHeaderTitle';
      row1.appendChild(title);
    }
  }
  if (title) {
    title.textContent = 'Fuel Purchase Form';
    fitHeaderTitle(title);
  }
}

/* ===== STICKY HEADER SAFEGUARD ===== */
function makeTabsSticky() {
  var dashHeader = document.getElementById('dashHeader');
  if (dashHeader) {
    dashHeader.style.position = '-webkit-sticky';
    dashHeader.style.position = 'sticky';
    dashHeader.style.top = '0';
    dashHeader.style.zIndex = '100000';
  }
}

window.dashLogout = function() {
  try { fetch(buildApiUrl('/auth/logout'), { method: 'POST' }); } catch (e) {}
  window.location.href = '/public/login.html';
};

function getUserDisplayName() {
  if (window.dashUser) {
    if (window.dashUser.full_name) return window.dashUser.full_name;
    var fn = window.dashUser.first_name || window.dashUser.firstName || '';
    var ln = window.dashUser.last_name || window.dashUser.lastName || '';
    if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
    if (window.dashUser.name) return window.dashUser.name;
    if (window.dashUser.email) {
      var parts = window.dashUser.email.split('@')[0].split('.');
      return parts.map(function(p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ');
    }
  }
  return '';
}

function dedupTanks(tanks) {
  var seen = {};
  return tanks.filter(function(t) {
    var key = (t.name || '') + '|' + (t.tank_type || '');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function localDate() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/* ===== USERS DROPDOWN ===== */
async function loadUsers() {
  var personSelect = document.getElementById('purchasePerson');
  if (!personSelect || personSelect.tagName !== 'SELECT') return;

  var seenUserIds = new Set();
  var activeUser = window.dashUser || {};
  var activeUserId = activeUser.id || activeUser.user_id;
  var activeUserName = getUserDisplayName().trim();

  var html = '<option value="">Select user…</option>';

  if (activeUserId && activeUserName) {
    seenUserIds.add(String(activeUserId));
    html += '<option value="' + esc(activeUserName) + '" selected>' + esc(activeUserName) + ' (You)</option>';
  }

  try {
    var endpoint = buildApiUrl('/api/users') + '&limit=500&all=true';
    var resp = await fetch(endpoint);
    var data = await resp.json();

    var usersList = data.users || data.data || [];

    var nameCounts = {};
    usersList.forEach(function(u) {
      var n = u.full_name || u.name || ((u.first_name || u.firstName || '') + ' ' + (u.last_name || u.lastName || '')).trim();
      if (!n && u.email) {
        var parts = u.email.split('@')[0].split('.');
        n = parts.map(function(p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ');
      }
      if (n) nameCounts[n] = (nameCounts[n] || 0) + 1;
    });

    usersList.forEach(function(u) {
      var uIdStr = String(u.id || u.user_id || '');
      if (!uIdStr || seenUserIds.has(uIdStr)) return;
      seenUserIds.add(uIdStr);

      var name = u.full_name || u.name || ((u.first_name || u.firstName || '') + ' ' + (u.last_name || u.lastName || '')).trim();
      if (!name && u.email) {
        var parts = u.email.split('@')[0].split('.');
        name = parts.map(function(p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ');
      }

      if (nameCounts[name] > 1 && u.email) {
        name = name + ' (' + u.email + ')';
      }

      if (name) {
        html += '<option value="' + esc(name) + '">' + esc(name) + '</option>';
      }
    });
  } catch(e) {
    console.warn('Failed to load users:', e);
  }

  personSelect.innerHTML = html;
}

/* ===== BUILD ASSET SELECT OPTIONS ===== */
function buildAssetOptionsHtml() {
  var bulkTanks = dedupTanks(allTanks.filter(function(t) { return t.tank_type === 'bulk' && (t.status === 'active' || !t.status); }));
  var dragupTanks = dedupTanks(allTanks.filter(function(t) { return t.tank_type === 'dragup' && (t.status === 'active' || !t.status); }));
  var portableTanks = dedupTanks(allTanks.filter(function(t) { return t.tank_type === 'portable' && (t.status === 'active' || !t.status); }));
  var equipmentAssets = allAssets;

  var html = '<option value="">Select asset/tank…</option>';

  if (bulkTanks.length > 0) {
    html += '<optgroup label="Bulk Tanks">';
    bulkTanks.forEach(function(t) {
      var label = t.name + (t.fuel_type ? ' (' + t.fuel_type + ')' : '') + (t.location ? ' — ' + t.location : '');
      html += '<option value="bulk_tank|' + esc(t.id) + '">' + esc(label) + '</option>';
    });
    html += '</optgroup>';
  }

  if (dragupTanks.length > 0) {
    html += '<optgroup label="Drag-Up Tanks">';
    dragupTanks.forEach(function(t) {
      var label = t.name + (t.fuel_type ? ' (' + t.fuel_type + ')' : '') + (t.location ? ' — ' + t.location : '');
      html += '<option value="dragup_tank|' + esc(t.id) + '">' + esc(label) + '</option>';
    });
    html += '</optgroup>';
  }

  if (portableTanks.length > 0) {
    html += '<optgroup label="Portable Cans">';
    portableTanks.forEach(function(t) {
      var label = t.name + (t.fuel_type ? ' (' + t.fuel_type + ')' : '') + (t.location ? ' — ' + t.location : '');
      html += '<option value="portable_can|' + esc(t.id) + '">' + esc(label) + '</option>';
    });
    html += '</optgroup>';
  }

  if (equipmentAssets.length > 0) {
    html += '<optgroup label="Equipment / Machinery">';
    equipmentAssets.forEach(function(a) {
      var assetNum = a.asset_number || a.asset_num || a.asset_id || a.unit_number || a.code || (a.id ? String(a.id).slice(0,8) : '');
      var assetName = a.name || a.asset_name || a.title || a.description || [a.year, a.make, a.model].filter(Boolean).join(' ') || 'Unnamed Asset';
      var assetId = a.id || a.asset_id || a.uuid || assetNum;
      var label = (assetNum ? assetNum + ' — ' : '') + assetName + (a.fuel_type ? ' (' + a.fuel_type + ')' : '');
      html += '<option value="asset|' + esc(assetId) + '|' + esc(assetNum) + '">' + esc(label) + '</option>';
    });
    html += '</optgroup>';
  }

  html += '<option value="__custom">+ Other (type manually)</option>';
  return html;
}

function handleAssetChange(selectEl) {
  if (selectEl.value === '__custom') {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'purchase-input line-destination ai-needed';
    input.placeholder = 'Type asset/vehicle name';
    input.setAttribute('data-custom', 'true');
    input.oninput = function() { markFormDirty(); };
    selectEl.parentNode.replaceChild(input, selectEl);
    input.focus();
  } else {
    markFormDirty();
  }
}

/* ===== LINE ITEMS ===== */
function addLineItem(data) {
  lineItemCount++;
  var lineId = 'line-' + lineItemCount;
  var container = document.getElementById('lineItemsContainer');
  if (!container) return;
  var div = document.createElement('div');
  div.className = 'line-item-row';
  div.id = lineId;

  var fuelType = (data && data.fuel_type) || 'diesel_onroad';
  var qty = (data && data.gallons) || '';
  var unitPrice = (data && data.unit_price) || '';
  var meterReading = (data && data.meter_reading) || '';
  var qtyEsc = esc(qty);
  var unitPriceEsc = esc(unitPrice);
  var meterReadingEsc = esc(meterReading);

  div.innerHTML =
    '<div class="line-item-grid">' +
      '<div class="purchase-field"><label class="purchase-label">Fuel Type <span style="color:#cc0000;">*</span></label>' +
        '<select class="purchase-input line-fuel-type" onchange="recalcLine(\'' + lineId + '\'); markFormDirty()">' +
          '<option value="diesel_onroad"' + (fuelType === 'diesel_onroad' || fuelType === 'diesel' ? ' selected' : '') + '>Diesel (On-Road)</option>' +
          '<option value="diesel_offroad"' + (fuelType === 'diesel_offroad' ? ' selected' : '') + '>Diesel (Off-Road)</option>' +
          '<option value="gasoline"' + (fuelType === 'gasoline' ? ' selected' : '') + '>Gasoline</option>' +
          '<option value="DEF"' + (fuelType === 'DEF' ? ' selected' : '') + '>DEF</option>' +
          '<option value="propane"' + (fuelType === 'propane' ? ' selected' : '') + '>Propane</option>' +
          '<option value="other"' + (fuelType === 'other' ? ' selected' : '') + '>Other</option>' +
          '<option value="__custom_fuel"' + (fuelType === '__custom_fuel' ? ' selected' : '') + '>+ Other (type manually)</option>' +
        '</select>' +
      '</div>' +
      '<div class="purchase-field"><label class="purchase-label">Asset <span style="color:#cc0000;">*</span></label>' +
        '<select class="purchase-input line-destination ai-needed" onchange="handleAssetChange(this)">' +
          buildAssetOptionsHtml() +
        '</select>' +
      '</div>' +
      '<div class="purchase-field"><label class="purchase-label">Qty (gal) <span style="color:#cc0000;">*</span></label>' +
        '<input type="number" class="purchase-input line-qty" placeholder="0" min="0" step="0.01" value="' + qtyEsc + '" oninput="recalcLine(\'' + lineId + '\'); markFormDirty()">' +
      '</div>' +
      '<div class="purchase-field"><label class="purchase-label">Cost/Gal <span style="font-size:11px;font-weight:400;color:var(--text-muted);">(optional)</span></label>' +
        '<input type="number" class="purchase-input line-cpg" placeholder="$0.00" min="0" step="0.001" value="' + unitPriceEsc + '" oninput="recalcLine(\'' + lineId + '\'); markFormDirty()">' +
      '</div>' +
      '<div class="purchase-field"><label class="purchase-label">Meter Reading <span style="font-size:11px;font-weight:400;color:var(--text-muted);">(if machinery)</span></label>' +
        '<input type="number" class="purchase-input line-meter ai-needed" placeholder="hrs/mi" min="0" step="0.1" value="' + meterReadingEsc + '" oninput="markFormDirty()">' +
      '</div>' +
      '<div class="purchase-field remove-action-wrap">' +
        '<button class="btn-delete-line" onclick="removeLineItem(\'' + lineId + '\')">Delete</button>' +
      '</div>' +
    '</div>';

  container.appendChild(div);

  if (data && data.classes) {
    if (data.classes.fuelType) div.querySelector('.line-fuel-type').className = data.classes.fuelType;
    if (data.classes.dest) div.querySelector('.line-destination').className = data.classes.dest;
    if (data.classes.qty) div.querySelector('.line-qty').className = data.classes.qty;
    if (data.classes.cpg) div.querySelector('.line-cpg').className = data.classes.cpg;
    if (data.classes.meter) div.querySelector('.line-meter').className = data.classes.meter;
  }

  recalcGrandTotal();
}

function removeLineItem(lineId) {
  var el = document.getElementById(lineId);
  if (el) el.remove();
  recalcGrandTotal();
  if (document.querySelectorAll('.line-item-row').length === 0) addLineItem();
}

function recalcLine(lineId) {
  var row = document.getElementById(lineId);
  if (!row) { recalcGrandTotal(); return; }
  var fuelSelect = row.querySelector('.line-fuel-type');
  if (fuelSelect && fuelSelect.value === '__custom_fuel') {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'purchase-input line-fuel-type';
    input.placeholder = 'Type fuel name';
    input.style.color = 'var(--text, #ffffff)';
    input.style.backgroundColor = 'var(--bg-step, #0f172a)';
    input.setAttribute('data-custom', 'true');
    input.oninput = function() { markFormDirty(); };
    fuelSelect.parentNode.replaceChild(input, fuelSelect);
    input.focus();
  }
  recalcGrandTotal();
}

function recalcGrandTotal() {
  var total = 0;
  var hasAnyQty = false;
  var hasAnyPrice = false;
  document.querySelectorAll('.line-item-row').forEach(function(row) {
    var qty = parseFloat(row.querySelector('.line-qty').value) || 0;
    var cpg = parseFloat(row.querySelector('.line-cpg').value) || 0;
    if (qty > 0) hasAnyQty = true;
    if (cpg > 0) hasAnyPrice = true;
    if (qty > 0 && cpg > 0) total += qty * cpg;
  });
  var totalEl = document.getElementById('grandTotal');
  if (!totalEl) return;
  if (!hasAnyQty) { totalEl.textContent = '$0.00'; checkReceiptMismatch(); return; }
  if (!hasAnyPrice) { totalEl.textContent = '—'; totalEl.style.color = 'var(--text-muted)'; checkReceiptMismatch(); return; }
  totalEl.style.color = 'var(--primary)';
  totalEl.textContent = '$' + total.toFixed(2);
  checkReceiptMismatch();
}

/* ===== ACCURATE CROP OVERLAY (CORRECTED MAPPING) ===== */
var _cropState = null;

function showCropOverlay(file, callback) {
  var isPdf = file.type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf');
  if (isPdf) { callback(file); return; }
  var imgUrl = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function() { _buildCropUI(file, img, imgUrl, callback); };
  img.onerror = function() { URL.revokeObjectURL(imgUrl); callback(file); };
  img.src = imgUrl;
}

function _buildCropUI(file, img, imgUrl, callback) {
  var existing = document.getElementById('cropOverlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'cropOverlay';
  overlay.className = 'crop-overlay';

  var modal = document.createElement('div');
  modal.className = 'crop-modal';

  var title = document.createElement('h3');
  title.style.margin = '0 0 8px 0';
  title.textContent = 'Crop Receipt';
  modal.appendChild(title);

  var desc = document.createElement('p');
  desc.style.cssText = 'font-size:12px;color:var(--text-muted,#94a3b8);margin:0 0 12px 0;';
  desc.innerHTML = 'Drag the <strong>green corners</strong> to highlight receipt text. Drag inside to move.';
  modal.appendChild(desc);

  var stage = document.createElement('div');
  stage.className = 'crop-stage';

  var imgEl = document.createElement('img');
  imgEl.src = imgUrl;
  stage.appendChild(imgEl);

  var cropBox = document.createElement('div');
  cropBox.className = 'crop-box';
  stage.appendChild(cropBox);

  ['nw', 'ne', 'sw', 'se'].forEach(function(pos) {
    var h = document.createElement('div');
    h.className = 'crop-handle ' + pos;
    h.dataset.pos = pos;
    cropBox.appendChild(h);
  });

  modal.appendChild(stage);

  var actions = document.createElement('div');
  actions.className = 'crop-actions';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'crop-btn crop-btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = function() { 
    document.body.style.overflow = '';
    overlay.remove(); 
    URL.revokeObjectURL(imgUrl); 
    _cropState = null; 
  };

  var fullBtn = document.createElement('button');
  fullBtn.className = 'crop-btn crop-btn-secondary';
  fullBtn.textContent = 'Use Full Image';
  fullBtn.onclick = function() {
    document.body.style.overflow = '';
    overlay.remove(); 
    URL.revokeObjectURL(imgUrl); 
    _cropState = null;
    _resizeImageAsync(file, 1024).then(function(resized) { callback(resized); });
  };

  var cropBtn = document.createElement('button');
  cropBtn.className = 'crop-btn crop-btn-primary';
  cropBtn.textContent = 'Crop & Extract';
  cropBtn.onclick = function() {
    document.body.style.overflow = '';
    if (!_cropState) { 
      overlay.remove(); 
      URL.revokeObjectURL(imgUrl); 
      callback(file); 
      return; 
    }
    var cropped = _performCrop(file, img, imgEl, stage, _cropState);
    overlay.remove(); 
    URL.revokeObjectURL(imgUrl); 
    _cropState = null;
    callback(cropped);
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(fullBtn);
  actions.appendChild(cropBtn);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.body.style.overflow = 'hidden';

  imgEl.onload = function() {
    requestAnimationFrame(function() {
      var dispW = imgEl.offsetWidth;
      var dispH = imgEl.offsetHeight;
      var imgLeft = imgEl.offsetLeft;
      var imgTop = imgEl.offsetTop;

      var boxW = dispW * 0.8;
      var boxH = dispH * 0.8;
      var boxX = imgLeft + (dispW - boxW) / 2;
      var boxY = imgTop + (dispH - boxH) / 2;

      cropBox.style.left = boxX + 'px';
      cropBox.style.top = boxY + 'px';
      cropBox.style.width = boxW + 'px';
      cropBox.style.height = boxH + 'px';

      _cropState = { boxX: boxX, boxY: boxY, boxW: boxW, boxH: boxH, dispW: dispW, dispH: dispH, imgLeft: imgLeft, imgTop: imgTop };
      _attachCropEvents(stage, imgEl, cropBox);
    });
  };
}

function _attachCropEvents(stage, imgEl, cropBox) {
  var dragging = false;
  var resizing = false;
  var resizePos = null;
  var startX, startY, startBoxX, startBoxY, startBoxW, startBoxH;

  function onDown(e) {
    e.preventDefault();
    var touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX; startY = touch.clientY;
    startBoxX = _cropState.boxX; startBoxY = _cropState.boxY;
    startBoxW = _cropState.boxW; startBoxH = _cropState.boxH;
    if (e.target.classList.contains('crop-handle')) { resizing = true; resizePos = e.target.dataset.pos; }
    else if (e.target === cropBox) { dragging = true; }
  }

  function onMove(e) {
    if (!dragging && !resizing) return;
    e.preventDefault();
    var touch = e.touches ? e.touches[0] : e;
    var dx = touch.clientX - startX;
    var dy = touch.clientY - startY;

    var minX = imgEl.offsetLeft;
    var minY = imgEl.offsetTop;
    var maxX = minX + imgEl.offsetWidth;
    var maxY = minY + imgEl.offsetHeight;

    if (dragging) {
      _cropState.boxX = Math.max(minX, Math.min(maxX - _cropState.boxW, startBoxX + dx));
      _cropState.boxY = Math.max(minY, Math.min(maxY - _cropState.boxH, startBoxY + dy));
    } else if (resizing) {
      var newX = startBoxX, newY = startBoxY, newW = startBoxW, newH = startBoxH;
      if (resizePos.indexOf('e') !== -1) newW = Math.max(40, Math.min(maxX - startBoxX, startBoxW + dx));
      if (resizePos.indexOf('s') !== -1) newH = Math.max(40, Math.min(maxY - startBoxY, startBoxH + dy));
      if (resizePos.indexOf('w') !== -1) {
        var maxDx = startBoxW - 40;
        var realDx = Math.max(minX - startBoxX, Math.min(maxDx, dx));
        newX = startBoxX + realDx; newW = startBoxW - realDx;
      }
      if (resizePos.indexOf('n') !== -1) {
        var maxDy = startBoxH - 40;
        var realDy = Math.max(minY - startBoxY, Math.min(maxDy, dy));
        newY = startBoxY + realDy; newH = startBoxH - realDy;
      }
      _cropState.boxX = newX; _cropState.boxY = newY;
      _cropState.boxW = newW; _cropState.boxH = newH;
    }
    cropBox.style.left = _cropState.boxX + 'px';
    cropBox.style.top = _cropState.boxY + 'px';
    cropBox.style.width = _cropState.boxW + 'px';
    cropBox.style.height = _cropState.boxH + 'px';
  }

  function onUp() { dragging = false; resizing = false; }

  cropBox.addEventListener('mousedown', onDown);
  cropBox.addEventListener('touchstart', onDown, { passive: false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchend', onUp);
}

function _resizeImageAsync(file, maxDim) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function() {
      URL.revokeObjectURL(url);
      var sw = img.width, sh = img.height;
      var finalW = sw, finalH = sh;
      if (sw > maxDim || sh > maxDim) {
        var scale = Math.min(maxDim / sw, maxDim / sh);
        finalW = Math.round(sw * scale); finalH = Math.round(sh * scale);
      }
      if (finalW === sw && finalH === sh) { resolve(file); return; }
      var canvas = document.createElement('canvas');
      canvas.width = finalW; canvas.height = finalH;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, sw, sh, 0, 0, finalW, finalH);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      var byteString = atob(dataUrl.split(',')[1]);
      var arr = new Uint8Array(byteString.length);
      for (var i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
      resolve(new File([arr], file.name || 'receipt.jpg', { type: 'image/jpeg' }));
    };
    img.onerror = function() { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function _performCrop(file, img, imgEl, stage, state) {
  var dispW = imgEl.offsetWidth;
  var dispH = imgEl.offsetHeight;
  var imgLeft = imgEl.offsetLeft;
  var imgTop = imgEl.offsetTop;

  var scaleX = img.naturalWidth / dispW;
  var scaleY = img.naturalHeight / dispH;

  var relativeBoxX = state.boxX - imgLeft;
  var relativeBoxY = state.boxY - imgTop;

  var sx = Math.round(relativeBoxX * scaleX);
  var sy = Math.round(relativeBoxY * scaleY);
  var sw = Math.round(state.boxW * scaleX);
  var sh = Math.round(state.boxH * scaleY);

  sx = Math.max(0, Math.min(img.naturalWidth - 1, sx));
  sy = Math.max(0, Math.min(img.naturalHeight - 1, sy));
  sw = Math.max(1, Math.min(img.naturalWidth - sx, sw));
  sh = Math.max(1, Math.min(img.naturalHeight - sy, sh));

  var canvas = document.createElement('canvas');
  canvas.width = sw; canvas.height = sh;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  var maxDim = 1200;
  var finalW = sw, finalH = sh;
  if (sw > maxDim || sh > maxDim) {
    var scale = Math.min(maxDim / sw, maxDim / sh);
    finalW = Math.round(sw * scale); finalH = Math.round(sh * scale);
    var resizeCanvas = document.createElement('canvas');
    resizeCanvas.width = finalW; resizeCanvas.height = finalH;
    var rctx = resizeCanvas.getContext('2d');
    rctx.drawImage(canvas, 0, 0, sw, sh, 0, 0, finalW, finalH);
    canvas = resizeCanvas;
  }

  var dataUrl = canvas.toDataURL('image/jpeg', 0.90);
  var byteString = atob(dataUrl.split(',')[1]);
  var arr = new Uint8Array(byteString.length);
  for (var i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
  return new File([arr], file.name || 'receipt.jpg', { type: 'image/jpeg' });
}

/* ===== RECEIPT UPLOAD & EXTRACTION ===== */
async function handleReceiptUpload(input) {
  var payEl = document.getElementById('purchasePaymentType');
  var payVal = payEl ? payEl.value.trim() : '';
  if (!payVal) {
    alert('Please select a Payment Type before taking or uploading a receipt photo.');
    if (input) input.value = '';
    if (payEl) payEl.focus();
    return;
  }

  var file = input.files[0];
  if (!file) return;
  var preview = document.getElementById('receiptPreview');
  var previewContent = document.getElementById('receiptPreviewContent');
  var status = document.getElementById('receiptExtractStatus');
  if (preview) preview.style.display = 'block';
  var isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    if (previewContent) previewContent.innerHTML = '<div class="receipt-pdf-icon">📄</div><p style="font-size:14px;font-weight:600;margin:8px 0 0;">' + esc(file.name) + '</p><p style="font-size:12px;color:var(--text-muted);">PDF document</p>';
  } else {
    if (status) {
      status.className = 'receipt-extract-status loading';
      status.textContent = 'Crop the receipt area for best results…';
    }
    showCropOverlay(file, function(croppedFile) {
      _doExtraction(croppedFile, previewContent, status, preview);
    });
    return;
  }
  _doExtraction(file, previewContent, status, preview);
}

var _currentExtractionId = 0;
var _currentExtractionController = null;

async function _doExtraction(file, previewContent, status, preview) {
  _currentExtractionId++;
  var thisReqId = _currentExtractionId;
  if (_currentExtractionController) { try { _currentExtractionController.abort(); } catch(e) {} }
  _currentExtractionController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var fetchSignal = _currentExtractionController ? _currentExtractionController.signal : undefined;
  var isPdf = file.type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    if (_objectUrl) { URL.revokeObjectURL(_objectUrl); _objectUrl = null; }
    _objectUrl = URL.createObjectURL(file);
    if (previewContent) previewContent.innerHTML = '<img class="receipt-preview-img" src="' + _objectUrl + '">';
  }
  if (status) {
    status.className = 'receipt-extract-status loading';
    status.textContent = 'Uploading & extracting receipt data with AI…';
  }
  var confBanner = document.getElementById('aiConfidenceBanner');
  if (confBanner) confBanner.style.display = 'none';

  try {
    var base64Data = await new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function() { reject(new Error('Failed to read file')); };
      reader.readAsDataURL(file);
    });

    var resp = await fetch(buildApiUrl('/api/fuel-receipts/extract'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: base64Data, fileName: file.name || 'receipt.jpg', fileType: file.type || 'image/jpeg' }),
      signal: fetchSignal
    }).catch(function(netErr) {
      return { ok: false, status: 503, text: function() { return Promise.resolve(netErr.message || 'Network timeout'); } };
    });

    if (!resp.ok) {
      var errBody = await resp.text().catch(function() { return ''; });
      var errMsg = 'Server returned ' + (resp.status || 'Error');
      var errCode = '';
      try { var errJson = JSON.parse(errBody); if (errJson.error) errMsg = errJson.error; if (errJson.code) errCode = errJson.code; } catch(e) {}
      
      if (status) {
        if (errCode === 'IMAGE_TOO_LARGE' || errMsg.toLowerCase().indexOf('too large') !== -1 || errMsg.toLowerCase().indexOf('max size') !== -1) {
          status.className = 'receipt-extract-status error';
          status.innerHTML = '⚠ Image is too large for AI processing. Please crop the receipt to show only the text area, then try again.';
          return;
        }
        if (resp.status === 401 || resp.status === 403) {
          status.className = 'receipt-extract-status error';
          status.textContent = '✗ Your session has expired. Please save your work, then refresh the page and log in again.';
          return;
        }
        status.className = 'receipt-extract-status error';
        status.textContent = '✗ Something went wrong extracting data. Please fill out the form manually below or try another image.';
      }
      return;
    }

    var data = await resp.json().catch(function() { return null; });
    if (!data) {
      if (status) {
        status.className = 'receipt-extract-status error';
        status.textContent = '✗ Unable to parse server response. Please proceed with manual entry.';
      }
      return;
    }

    if (data.success && data.extracted) {
      if (_currentExtractionId !== thisReqId) { return; }
      if (data.receipt && data.receipt.r2_key) { receiptR2Key = data.receipt.r2_key; }
      if (status) {
        status.className = 'receipt-extract-status success';
        var conf = data.extracted.confidence || 0;
        var confPct = Math.round(conf * 100);
        var fileTypeLabel = data.receipt && data.receipt.file_type === 'pdf' ? 'PDF' : 'Image';
        status.textContent = '✓ Extraction complete (' + confPct + '% confidence, ' + fileTypeLabel + ', ' + (data.processing_time_ms || 0) + 'ms)';
      }
      var fieldLegend = document.getElementById('aiFieldLegend');
      if (fieldLegend) fieldLegend.style.display = 'flex';
      
      if (data.extracted.vendor) {
        var vendorEl = document.getElementById('purchaseVendor');
        if (vendorEl) {
          vendorEl.value = data.extracted.vendor;
          vendorEl.classList.add('ai-extracted');
        }
      }

      _extractedVendorLocation = {
        vendor_address: data.extracted.vendor_address || data.extracted.address || null,
        vendor_city: data.extracted.vendor_city || data.extracted.city || null,
        vendor_state: data.extracted.vendor_state || data.extracted.state || null,
        vendor_zip: data.extracted.vendor_zip || data.extracted.zip || null
      };

      var addrEl = document.getElementById('purchaseVendorAddress');
      if (addrEl && _extractedVendorLocation.vendor_address) {
        addrEl.value = _extractedVendorLocation.vendor_address;
        addrEl.classList.add('ai-extracted');
      }

      var cityEl = document.getElementById('purchaseVendorCity');
      if (cityEl && _extractedVendorLocation.vendor_city) {
        cityEl.value = _extractedVendorLocation.vendor_city;
        cityEl.classList.add('ai-extracted');
      }

      var stateEl = document.getElementById('purchaseVendorState');
      if (stateEl && _extractedVendorLocation.vendor_state) {
        stateEl.value = _extractedVendorLocation.vendor_state;
        stateEl.classList.add('ai-extracted');
      }

      var zipEl = document.getElementById('purchaseVendorZip');
      if (zipEl && _extractedVendorLocation.vendor_zip) {
        zipEl.value = _extractedVendorLocation.vendor_zip;
        zipEl.classList.add('ai-extracted');
      }

      /* Extract date with ISO conversion for HTML date inputs */
      var rawDate = data.extracted.receipt_date || data.extracted.date || data.extracted.transaction_date || data.extracted.purchase_date;
      var isoDate = parseToIsoDate(rawDate);
      if (isoDate) {
        var dateEl = document.getElementById('purchaseDate');
        if (dateEl) {
          dateEl.value = isoDate;
          dateEl.classList.add('ai-extracted');
          dateEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      if (data.extracted.payment_type) {
        var payEl = document.getElementById('purchasePaymentType');
        if (payEl) {
          var normPay = String(data.extracted.payment_type).toLowerCase();
          if (normPay.indexOf('fleet') !== -1) {
            payEl.value = 'Fleet Card';
          } else if (normPay.indexOf('credit') !== -1 || normPay.indexOf('card') !== -1 || normPay.indexOf('visa') !== -1 || normPay.indexOf('mastercard') !== -1 || normPay.indexOf('amex') !== -1) {
            payEl.value = 'Credit Card';
          } else if (normPay.indexOf('account') !== -1 || normPay.indexOf('po') !== -1) {
            payEl.value = 'On Account';
          } else if (normPay.indexOf('cash') !== -1) {
            payEl.value = 'Cash';
          } else if (normPay.indexOf('check') !== -1) {
            payEl.value = 'Check';
          } else {
            payEl.value = data.extracted.payment_type;
          }
          payEl.classList.add('ai-extracted');
          handlePaymentTypeChange(payEl);
        }
      }

      if (data.extracted.card_vendor) {
        var cardVendorEl = document.getElementById('purchaseCardVendor');
        if (cardVendorEl) {
          cardVendorEl.value = data.extracted.card_vendor;
          cardVendorEl.classList.add('ai-extracted');
        }
      }

      if (data.extracted.card_last_4) {
        var cardEl = document.getElementById('purchaseCardLast4');
        if (cardEl) {
          cardEl.value = data.extracted.card_last_4;
          cardEl.classList.add('ai-extracted');
        }
      }

      if (data.extracted.po_number) {
        var poEl = document.getElementById('purchasePONumber');
        if (poEl) {
          poEl.value = data.extracted.po_number;
          poEl.classList.add('ai-extracted');
        }
      }

      var rtExtracted = data.extracted.receipt_total || data.extracted.total_amount;
      if (rtExtracted) {
        var rtEl = document.getElementById('receiptTotal');
        if (rtEl) { rtEl.value = parseFloat(rtExtracted).toFixed(2); rtEl.classList.add('ai-extracted'); }
      }
      window._receiptHasNonFuelItems = false;
      if (data.extracted.has_non_fuel_items || (data.extracted.non_fuel_items && data.extracted.non_fuel_items.length > 0)) {
        window._receiptHasNonFuelItems = true;
        var notice = document.getElementById('receiptNonFuelNotice');
        if (notice) notice.style.display = 'block';
      }
      if (data.extracted.line_items && data.extracted.line_items.length > 0) {
        var lineContainer = document.getElementById('lineItemsContainer');
        if (lineContainer) lineContainer.innerHTML = '';
        lineItemCount = 0;
        data.extracted.line_items.forEach(function(li) {
          addLineItem({ fuel_type: li.fuel_type || 'diesel_onroad', gallons: li.gallons || li.quantity || '', unit_price: li.unit_price || '', amount: li.amount || '', meter_reading: li.meter_reading || '' });
        });
        var lineRows = document.querySelectorAll('.line-item-row');
        data.extracted.line_items.forEach(function(li, idx) {
          if (lineRows[idx]) {
            var row = lineRows[idx];
            if (li.fuel_type) row.querySelector('.line-fuel-type').classList.add('ai-extracted');
            if (li.gallons || li.quantity) row.querySelector('.line-qty').classList.add('ai-extracted');
            if (li.unit_price) row.querySelector('.line-cpg').classList.add('ai-extracted');
            if (li.meter_reading) row.querySelector('.line-meter').classList.add('ai-extracted');
            row.querySelector('.line-destination').classList.add('ai-needed');
          }
        });
      }
      showConfidenceBanner(data.extracted);
      recalcGrandTotal();
    } else {
      if (status) {
        status.className = 'receipt-extract-status error';
        status.textContent = '✗ Extraction completed but no data was recognized. Try cropping the receipt more tightly around the text.';
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') { return; }
    if (thisReqId !== _currentExtractionId) { return; }
    if (status) {
      status.className = 'receipt-extract-status error';
      status.textContent = '✗ Processing encountered a non-critical issue. Please review and enter any missing data manually.';
    }
    console.error('extractReceipt error:', e);
  }
}

function showConfidenceBanner(extracted) {
  var banner = document.getElementById('aiConfidenceBanner');
  if (!banner) return;
  var conf = extracted.confidence || 0;
  var confPct = Math.round(conf * 100);
  var lowFields = extracted.low_confidence_fields || [];
  var html = '<strong>AI Extraction: ' + esc(String(confPct)) + '% confidence</strong>';
  if (lowFields.length > 0) {
    banner.className = 'ai-confidence-banner low';
    html += '<br><span style="font-size:12px;">Low confidence fields:</span> ';
    html += lowFields.map(function(f) { return '<span class="field-flag">' + esc(String(f)) + '</span>'; }).join('');
  } else {
    banner.className = 'ai-confidence-banner';
    html += '<br><span style="font-size:12px;">All fields extracted with good confidence. Please review before submitting.</span>';
  }
  banner.innerHTML = html;
  banner.style.display = 'block';
}

/* ===== SUBMIT PURCHASE ===== */
async function submitPurchase() {
  if (!requireLocationOrPopup()) return;

  var dateEl = document.getElementById('purchaseDate');
  var date = dateEl ? dateEl.value : '';
  var locationEl = document.getElementById('purchaseLocation');
  var location = locationEl ? locationEl.value.trim() : '';
  var personEl = document.getElementById('purchasePerson');
  var person = personEl ? personEl.value.trim() : '';
  var vendorEl = document.getElementById('purchaseVendor');
  var vendor = vendorEl ? vendorEl.value : '';

  var vendorAddrEl = document.getElementById('purchaseVendorAddress');
  var vendorCityEl = document.getElementById('purchaseVendorCity');
  var vendorStateEl = document.getElementById('purchaseVendorState');
  var vendorZipEl = document.getElementById('purchaseVendorZip');

  var vendorAddress = vendorAddrEl ? vendorAddrEl.value.trim() : (_extractedVendorLocation.vendor_address || null);
  var vendorCity = vendorCityEl ? vendorCityEl.value.trim() : (_extractedVendorLocation.vendor_city || null);
  var vendorState = vendorStateEl ? vendorStateEl.value.trim() : (_extractedVendorLocation.vendor_state || null);
  var vendorZip = vendorZipEl ? vendorZipEl.value.trim() : (_extractedVendorLocation.vendor_zip || null);

  var notesEl = document.getElementById('purchaseNotes');
  var notes = notesEl ? notesEl.value : '';
  var paymentTypeEl = document.getElementById('purchasePaymentType');
  var paymentType = paymentTypeEl ? paymentTypeEl.value.trim() : null;
  var cardVendorEl = document.getElementById('purchaseCardVendor');
  var cardVendor = cardVendorEl ? cardVendorEl.value.trim() : null;
  var cardLast4El = document.getElementById('purchaseCardLast4');
  var cardLast4 = cardLast4El ? cardLast4El.value.trim() : null;

  if (!date) { showPurchaseError('Date is required'); return; }
  if (!vendor || !vendor.trim()) { showPurchaseError('Vendor is required'); return; }
  if (!person) { showPurchaseError('User is required'); return; }

  var projectEl = document.getElementById('purchaseProject');
  var projectId = projectEl ? projectEl.value.trim() : '';
  var projectName = null;
  var customProjectName = null;

  if (projectEl) {
    if (projectEl.tagName === 'INPUT' && projectEl.getAttribute('data-custom') === 'true') {
      customProjectName = projectEl.value.trim();
      projectName = customProjectName;
      projectId = null;
    } else if (projectEl.options && projectEl.selectedIndex >= 0) {
      projectName = projectEl.options[projectEl.selectedIndex].text;
      if (projectName === 'Select project…' || projectName === '+ Other (type manually)') {
        projectName = null;
      }
    }
  }

  var lineItems = [];
  var rows = document.querySelectorAll('.line-item-row');
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var destInput = row.querySelector('.line-destination');
    var destVal = destInput ? destInput.value.trim() : '';
    var qty = parseFloat(row.querySelector('.line-qty').value);
    var fuelType = row.querySelector('.line-fuel-type').value;
    var cpg = parseFloat(row.querySelector('.line-cpg').value) || null;
    var meterReadingVal = row.querySelector('.line-meter').value.trim();
    var meterReading = parseFloat(meterReadingVal);

    if (!qty || qty <= 0 || !isFinite(qty)) { showPurchaseError('Line ' + (i + 1) + ': quantity (gallons) is required and must be > 0'); return; }
    if (!fuelType) { showPurchaseError('Line ' + (i + 1) + ': fuel type is required'); return; }

    var dest = '';
    var customAssetName = null;

    if (destInput && destInput.tagName === 'INPUT' && destInput.getAttribute('data-custom') === 'true') {
      customAssetName = destVal;
      if (!customAssetName) {
        showPurchaseError('Line ' + (i + 1) + ': asset name is required'); return;
      }
    } else {
      dest = destVal;
      if (!dest || dest === '__custom') {
        showPurchaseError('Line ' + (i + 1) + ': asset is required'); return;
      }
    }

    var parts = dest.split('|');
    var entityType = parts[0] || 'custom';
    var entityId = parts[1] || null;
    var assetNum = parts[2] || null;

    if (entityType === 'asset') {
      if (!meterReadingVal || isNaN(meterReading) || meterReading < 0) {
        showPurchaseError('Line ' + (i + 1) + ': Meter Reading is required when fueling machinery/equipment.');
        return;
      }
    }

    var li = {
      fuel_type: fuelType,
      quantity: qty,
      to_entity_type: entityType,
      to_entity_id: entityId,
      asset_id: entityType === 'asset' ? entityId : null,
      asset_number: assetNum || (entityType === 'asset' ? entityId : null),
      project_id: projectId || null,
      project: projectName || null,
      fuel_date: date,
      fuel_site: location || null,
      cost_per_gallon: cpg,
      meter_reading: !isNaN(meterReading) ? meterReading : null,
      latitude: (hasDeviceLocation() && deviceLocation.latitude) ? deviceLocation.latitude : null,
      longitude: (hasDeviceLocation() && deviceLocation.longitude) ? deviceLocation.longitude : null
    };
    if (customProjectName) li.project_name = customProjectName;
    if (customAssetName) li.custom_asset_name = customAssetName;
    lineItems.push(li);
  }

  if (lineItems.length === 0) { showPurchaseError('At least one line item is required'); return; }

  var totalQty = 0;
  lineItems.forEach(function(li) { totalQty += li.quantity; });
  if (totalQty <= 0) { showPurchaseError('Total quantity must be greater than zero'); return; }

  managerReviewFlags = [];

  var locEl = document.getElementById('purchaseLocation');
  var baseFlagContext = {
    person: person || null,
    location: (locEl && locEl.value) ? locEl.value.trim() : (location || null),
    project_name: projectName || customProjectName,
    asset_name: lineItems.map(function(li){ return li.custom_asset_name || (li.asset_number ? 'Asset #' + li.asset_number : (li.asset_id ? 'Asset #' + li.asset_id : null)); }).filter(Boolean).join(', ')
  };

  if (locEl && locEl.tagName === 'INPUT') {
    managerReviewFlags.push(Object.assign({}, baseFlagContext, { field: 'location', value: locEl.value, reason: 'Custom location typed manually (not from list)', flag_type: 'manager_review', severity: 'info' }));
  }

  if (customProjectName) {
    managerReviewFlags.push(Object.assign({}, baseFlagContext, { field: 'project', value: customProjectName, reason: 'New project typed manually (not from list) — manager must add project and update record', flag_type: 'manager_review', severity: 'info' }));
  }

  for (var j = 0; j < lineItems.length; j++) {
    var row = rows[j];
    var fuelEl = row.querySelector('.line-fuel-type');
    if (fuelEl && fuelEl.getAttribute('data-custom') === 'true') {
      managerReviewFlags.push(Object.assign({}, baseFlagContext, { field: 'fuel_type', line: j + 1, value: fuelEl.value, reason: 'Custom fuel type typed manually (not from list)', flag_type: 'manager_review', severity: 'info' }));
      lineItems[j].fuel_type = fuelEl.value;
    }
    if (lineItems[j].custom_asset_name) {
      managerReviewFlags.push(Object.assign({}, baseFlagContext, { field: 'asset', line: j + 1, value: lineItems[j].custom_asset_name, reason: 'Custom asset typed manually (not in asset list) — manager must add asset and update record', flag_type: 'manager_review', severity: 'info' }));
    }
  }

  var receiptTotalInput = document.getElementById('receiptTotal');
  var receiptTotal = receiptTotalInput ? parseFloat(parseFloat(receiptTotalInput.value).toFixed(2)) || null : null;

  var receiptItemsInput = document.getElementById('receiptItems');
  var receiptItems = receiptItemsInput ? receiptItemsInput.value.trim() || null : null;

  var poNumberInput = document.getElementById('purchasePONumber');
  var poNumber = poNumberInput ? poNumberInput.value.trim() || null : null;

  if (window._receiptHasNonFuelItems) {
    managerReviewFlags.push(Object.assign({}, baseFlagContext, { field: 'receipt_items', value: 'Receipt includes items besides fuel', reason: 'AI detected non-fuel items on the receipt — manager should review for cost control / project costing', flag_type: 'manager_review', severity: 'info' }));
  }

  if (window._receiptMismatch) {
    managerReviewFlags.push(Object.assign({}, baseFlagContext, { field: 'receipt_mismatch', value: 'Receipt Total does not match Grand Fuel Total', reason: 'Receipt Total ('+(receiptTotal||'?')+') differs from Grand Fuel Total — manager should verify the receipt and line items', flag_type: 'manager_review', severity: 'warning' }));
  }

  var body = {
    vendor: vendor || null,
    vendor_address: vendorAddress,
    vendor_city: vendorCity,
    vendor_state: vendorState,
    vendor_zip: vendorZip,
    purchase_date: date + 'T08:00:00Z',
    fuel_date: date,
    fuel_site: location || null,
    submission_timestamp: new Date().toISOString(),
    location: location || null,
    person: person || null,
    notes: notes || null,
    po_number: poNumber,
    payment_type: paymentType,
    card_vendor: cardVendor,
    card_last_4: cardLast4,
    project_id: projectId || null,
    project: projectName || null,
    receipt_r2_key: receiptR2Key,
    receipt_total: receiptTotal,
    receipt_items: receiptItems,
    line_items: lineItems,
    device_location: hasDeviceLocation() ? deviceLocation : null,
    latitude: (hasDeviceLocation() && deviceLocation.latitude) ? deviceLocation.latitude : null,
    longitude: (hasDeviceLocation() && deviceLocation.longitude) ? deviceLocation.longitude : null,
    manager_review_flags: managerReviewFlags,
    flags: managerReviewFlags
  };

  var ctx = getUrlContextParams();
  if (ctx.org_id) body.org_id = ctx.org_id;
  if (ctx.role_id) body.role_id = ctx.role_id;

  var submitBtn = document.querySelector('.purchase-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Recording…';
  }

  try {
    var resp = await fetch(buildApiUrl('/api/fuel-purchases'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) { throw new Error('Server returned ' + resp.status); }
    var data = await resp.json();
    if (data.success) {
      clearFormDirty();
      showPurchaseSuccess(data.purchase);
      setTimeout(clearPurchaseForm, 3000);
    } else {
      showPurchaseError(data.error || 'Failed to record purchase');
    }
  } catch (e) {
    showPurchaseError('Error: ' + e.message);
    reportError('submitPurchase', e);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Record Purchase';
    }
  }
}

function showPurchaseSuccess(purchase) {
  var result = document.getElementById('purchaseResult');
  if (!result) return;
  result.className = 'purchase-result-success';
  var lineCount = purchase.line_items ? purchase.line_items.length : 0;
  var msg = 'Purchase recorded: ' + lineCount + ' line item' + (lineCount !== 1 ? 's' : '');
  if (purchase.total_cost) msg += ' — $' + parseFloat(purchase.total_cost).toFixed(2);
  if (purchase.vendor) msg += ' from ' + purchase.vendor;
  result.textContent = msg;
  result.style.display = 'block';
  setTimeout(function() { result.style.display = 'none'; }, 5000);
}

function showPurchaseError(msg) {
  var result = document.getElementById('purchaseResult');
  if (!result) return;
  result.className = 'purchase-result-error';
  result.textContent = '✗ ' + msg;
  result.style.display = 'block';
  setTimeout(function() { result.style.display = 'none'; }, 5000);
}

function clearPurchaseForm() {
  clearFormDirty();
  var dateEl = document.getElementById('purchaseDate');
  if (dateEl) dateEl.value = localDate();

  var locEl = document.getElementById('purchaseLocation');
  if (locEl && locEl.tagName === 'INPUT') {
    var select = document.createElement('select');
    select.id = 'purchaseLocation';
    select.className = 'purchase-input ai-needed';
    select.setAttribute('onchange', 'handleLocationChange(this)');
    locEl.parentNode.replaceChild(select, locEl);
  }

  var projEl = document.getElementById('purchaseProject');
  if (projEl && projEl.tagName === 'INPUT') {
    var projSelect = document.createElement('select');
    projSelect.id = 'purchaseProject';
    projSelect.className = 'purchase-input ai-needed';
    projSelect.setAttribute('onchange', 'handleProjectChange(this)');
    projEl.parentNode.replaceChild(projSelect, projEl);
  }

  loadLocations();
  loadProjects();
  loadUsers();

  var setVal = function(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('purchaseVendor', '');
  setVal('purchaseVendorAddress', '');
  setVal('purchaseVendorCity', '');
  setVal('purchaseVendorState', '');
  setVal('purchaseVendorZip', '');
  setVal('purchasePONumber', '');
  setVal('purchasePaymentType', '');
  setVal('purchaseCardVendor', '');
  setVal('purchaseCardLast4', '');
  handlePaymentTypeChange(document.getElementById('purchasePaymentType'));
  setVal('purchaseNotes', '');
  setVal('receiptTotal', '');
  setVal('receiptItems', '');

  var notice = document.getElementById('receiptMismatchNotice');
  if (notice) notice.style.display = 'none';
  var nonFuelNotice = document.getElementById('receiptNonFuelNotice');
  if (nonFuelNotice) nonFuelNotice.style.display = 'none';
  var rPreview = document.getElementById('receiptPreview');
  if (rPreview) rPreview.style.display = 'none';
  var rContent = document.getElementById('receiptPreviewContent');
  if (rContent) rContent.innerHTML = '';

  var status = document.getElementById('receiptExtractStatus');
  if (status) {
    status.textContent = '';
    status.className = 'receipt-extract-status';
  }

  setVal('receiptCameraInput', '');
  setVal('receiptFileInput', '');

  var confBanner = document.getElementById('aiConfidenceBanner');
  if (confBanner) {
    confBanner.style.display = 'none';
    confBanner.innerHTML = '';
  }

  var legend = document.getElementById('aiFieldLegend');
  if (legend) legend.style.display = 'none';

  document.querySelectorAll('.line-item-row .ai-extracted, .line-item-row .ai-needed, .purchase-input.ai-extracted').forEach(function(el) { el.classList.remove('ai-extracted'); });

  var result = document.getElementById('purchaseResult');
  if (result) result.style.display = 'none';

  if (_objectUrl) { URL.revokeObjectURL(_objectUrl); _objectUrl = null; }
  receiptR2Key = null;
  window._receiptMismatch = false;
  window._receiptHasNonFuelItems = false;
  _extractedVendorLocation = {};
  managerReviewFlags = [];

  var lineContainer = document.getElementById('lineItemsContainer');
  if (lineContainer) lineContainer.innerHTML = '';
  lineItemCount = 0;
  addLineItem();
  recalcGrandTotal();
}

/* ===== LOAD DATA ===== */
async function loadTanks() {
  try {
    var resp = await fetch(buildApiUrl('/api/fuel-tanks'));
    if (!resp.ok) throw new Error('Failed to load tanks: ' + resp.status);
    var data = await resp.json();
    if (data.success && data.tanks) allTanks = data.tanks;
  } catch (e) {
    console.warn('Error loading tanks:', e.message);
  }
}

async function loadTankTypes() {
  try {
    var resp = await fetch(buildApiUrl('/api/fuel-tank-types'));
    if (!resp.ok) throw new Error('Failed to load tank types: ' + resp.status);
    var data = await resp.json();
    if (data.success && data.tank_types) tankTypes = data.tank_types;
  } catch (e) {
    console.warn('Error loading tank types:', e.message);
  }
}

async function loadAssets() {
  try {
    var endpoint = buildApiUrl('/api/assets') + '&limit=500&all=true';
    var resp = await fetch(endpoint);
    if (!resp.ok) {
      resp = await fetch('/api/assets');
    }
    if (!resp.ok) throw new Error('Failed to load assets: ' + resp.status);
    var data = await resp.json();
    
    var assetsList = [];
    if (Array.isArray(data)) {
      assetsList = data;
    } else if (data && typeof data === 'object') {
      assetsList = data.assets || data.data || data.items || data.rows || [];
    }
    
    allAssets = assetsList.filter(function(a) { 
      if (!a) return false;
      var st = (a.status !== undefined && a.status !== null) ? String(a.status).toLowerCase().trim() : '';
      return st !== 'inactive' && st !== 'retired' && st !== 'decommissioned' && st !== 'sold' && st !== 'deleted' && st !== '0' && st !== 'false'; 
    });

    var rows = document.querySelectorAll('.line-item-row');
    if (rows.length > 0) {
      var existingRows = [];
      rows.forEach(function(row) {
        var ftEl = row.querySelector('.line-fuel-type');
        var destEl = row.querySelector('.line-destination');
        var qtyEl = row.querySelector('.line-qty');
        var cpgEl = row.querySelector('.line-cpg');
        var meterEl = row.querySelector('.line-meter');

        existingRows.push({
          fuel_type: ftEl ? ftEl.value : 'diesel_onroad',
          dest: destEl ? destEl.value : '',
          gallons: qtyEl ? qtyEl.value : '',
          unit_price: cpgEl ? cpgEl.value : '',
          meter_reading: meterEl ? meterEl.value : '',
          classes: {
            fuelType: ftEl ? ftEl.className : '',
            dest: destEl ? destEl.className : '',
            qty: qtyEl ? qtyEl.className : '',
            cpg: cpgEl ? cpgEl.className : '',
            meter: meterEl ? meterEl.className : ''
          }
        });
      });
      var lineContainer = document.getElementById('lineItemsContainer');
      if (lineContainer) lineContainer.innerHTML = '';
      lineItemCount = 0;
      existingRows.forEach(function(r) {
        addLineItem(r);
        var lastRow = document.querySelector('.line-item-row:last-child');
        if (lastRow && r.dest) {
          var destInput = lastRow.querySelector('.line-destination');
          if (destInput) destInput.value = r.dest;
        }
      });
    }
  } catch (e) {
    console.warn('Error loading assets:', e.message);
  }
}

async function loadLocations() {
  var locSelect = document.getElementById('purchaseLocation');
  if (!locSelect || locSelect.tagName !== 'SELECT') return;

  try {
    var endpoint = buildApiUrl('/api/locations') + '&limit=500&all=true';
    var resp = await fetch(endpoint);
    var data = await resp.json();

    var locationsList = data.locations || data.data || [];
    var currentVal = locSelect.value;
    var html = '<option value="">Select location…</option>';

    locationsList.forEach(function(loc) {
      var name = loc.name || loc.location_name || loc.address || '';
      if (name) {
        html += '<option value="' + esc(name) + '">' + esc(name) + '</option>';
      }
    });

    html += '<option value="__custom">+ Other (type manually)</option>';
    locSelect.innerHTML = html;
    if (currentVal) locSelect.value = currentVal;
  } catch (e) {
    console.warn('Error loading locations:', e.message);
  }
}

function handleLocationChange(sel) {
  if (sel.value === '__custom') {
    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'purchaseLocation';
    input.className = 'purchase-input ai-needed';
    input.style.color = 'var(--text, #ffffff)';
    input.style.backgroundColor = 'var(--bg-step, #0f172a)';
    input.placeholder = 'Type location name';
    sel.parentNode.replaceChild(input, sel);
    input.focus();
  }
}

function handleProjectChange(sel) {
  if (sel.value === '__custom') {
    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'purchaseProject';
    input.className = 'purchase-input ai-needed';
    input.style.color = 'var(--text, #ffffff)';
    input.style.backgroundColor = 'var(--bg-step, #0f172a)';
    input.placeholder = 'Type new project name';
    input.setAttribute('data-custom', 'true');
    sel.parentNode.replaceChild(input, sel);
    input.focus();
  }
}

async function loadProjects() {
  try {
    var resp = await fetch(buildApiUrl('/api/projects'));
    if (!resp.ok) return;
    var data = await resp.json();
    if (data.success && data.projects) {
      var sel = document.getElementById('purchaseProject');
      if (sel) {
        var html = '<option value="">Select project…</option>';
        data.projects.forEach(function(p) {
          html += '<option value="' + esc(p.id) + '">' + esc(p.name || p.project_name || p.id) + '</option>';
        });
        html += '<option value="__custom">+ Other (type manually)</option>';
        sel.innerHTML = html;
      }
      var wrap = document.getElementById('projectFieldWrap');
      if (wrap) {
        if (data.projects.length === 0) {
          wrap.style.display = 'none';
        } else {
          wrap.style.display = '';
        }
      }
    }
  } catch (e) {
    console.warn('Error loading projects:', e.message);
  }
}

/* ===== INIT ===== */
function initPurchaseForm() {
  var today = localDate();
  var dateField = document.getElementById('purchaseDate');
  if (dateField) dateField.value = today;

  loadUsers();

  var lineContainer = document.getElementById('lineItemsContainer');
  if (lineContainer) lineContainer.innerHTML = '';
  lineItemCount = 0;
  addLineItem();
  recalcGrandTotal();
}

var _pageInitialized = false;

async function initPage() {
  if (_pageInitialized) return;
  _pageInitialized = true;

  var loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'none';
  var dashEl = document.getElementById('dashboard');
  if (dashEl) dashEl.style.display = 'block';

  var ctx = getUrlContextParams();
  var user = window.dashUser;
  if (!user) {
    try {
      user = JSON.parse(localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user"));
    } catch(e) {}
  }

  if (!user && (ctx.org_id || ctx.role_id)) {
    user = {
      id: "usr_dynamic_session",
      role: ctx.role_id || "admin",
      org_id: ctx.org_id
    };
  }

  if (user && ctx.org_id) {
    user.org_id = ctx.org_id;
  }

  if (!user) { 
    window.location.href = '/public/login.html'; 
    return; 
  }

  window.dashUser = user;

  var role = ((user && user.role) || ctx.role_id || '').toLowerCase();
  var dashUrl = (role === 'admin' || role === 'ro-admin') ? '/app/dashboard/admin.html' : '/app/dashboard/employee-dashboard.html';
  var homeLink = document.getElementById('dashHomeLink');
  if (homeLink) homeLink.href = preserveUrlParams(dashUrl);

  var transferLink = document.getElementById('fuelTransferLink');
  if (transferLink) transferLink.href = preserveUrlParams(transferLink.getAttribute('href'));

  var tabBar = document.querySelector('.fp-tab-bar');
  if (tabBar) tabBar.style.display = 'flex';

  insertHeaderTitle();
  makeTabsSticky();

  try { await loadTankTypes(); } catch(e) { console.warn('Tank types error:', e); }
  try { await loadTanks(); } catch(e) { console.warn('Tanks error:', e); }
  try { await loadAssets(); } catch(e) { console.warn('Assets error:', e); }
  try { await loadLocations(); } catch(e) { console.warn('Locations error:', e); }
  try { await loadProjects(); } catch(e) { console.warn('Projects error:', e); }

  initPurchaseForm();
  checkDeviceLocation();
}

function setupInitListeners() {
  var initialized = false;
  function triggerInit() {
    if (initialized) return;
    initialized = true;
    initPage();
  }

  if (window.dashUser || window.drivenUser) {
    triggerInit();
  } else {
    document.addEventListener('dashSessionLoaded', triggerInit);
    setTimeout(triggerInit, 300);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupInitListeners);
} else {
  setupInitListeners();
}

window.addEventListener('resize', function() {
  makeTabsSticky();
  insertHeaderTitle();
});
window.addEventListener('orientationchange', function() {
  makeTabsSticky();
  insertHeaderTitle();
});

/* ===== EXPOSE HANDLERS ===== */
window.recalcLine = recalcLine;
window.markFormDirty = markFormDirty;
window.removeLineItem = removeLineItem;
window.handleReceiptUpload = handleReceiptUpload;
window.triggerReceiptCapture = triggerReceiptCapture;
window.submitPurchase = submitPurchase;
window.clearPurchaseForm = clearPurchaseForm;
window.handlePaymentTypeChange = handlePaymentTypeChange;
window.handleLocationChange = handleLocationChange;
window.handleProjectChange = handleProjectChange;
window.handleAssetChange = handleAssetChange;
window.closeLocationPopup = closeLocationPopup;
window.checkDeviceLocation = checkDeviceLocation;
window.addLineItem = addLineItem;
