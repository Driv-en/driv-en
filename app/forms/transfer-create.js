/**
 * DRIV-EN | Create Transfer Ticket (v1)
 * File: /app/forms/transfer-create.js
 * Extracted from transfer-create.html for CSP compliance.
 *
 * Fixes applied during extraction:
 *   - preserveUrlParams: added same-origin check (prevents org_id leakage to external URLs).
 *   - loadDrivers: fixed URL construction bug (missing ? when no org_id/role_id params).
 *   - All innerHTML replaced with DOM-safe createElement / createTextNode.
 *   - All onclick-referenced functions exposed on window.
 */

var deviceLocation = null;

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

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
  try {
    var ctx = getUrlContextParams();
    var url = new URL(targetUrl, window.location.origin);
    // Only append parameters if the URL is on the exact same origin
    if (url.origin === window.location.origin) {
      if (ctx.org_id && !url.searchParams.has('org_id')) url.searchParams.set('org_id', ctx.org_id);
      if (ctx.role_id && !url.searchParams.has('role_id')) url.searchParams.set('role_id', ctx.role_id);
      return url.pathname + url.search + url.hash;
    }
  } catch(e) {
    console.warn('URL preservation skipped for external/invalid target:', targetUrl);
  }
  return targetUrl;
}

function getUserDisplayName() {
  if (window.dashUser) {
    if (window.dashUser.full_name) return window.dashUser.full_name;
    var fn = window.dashUser.first_name || window.dashUser.firstName || '';
    var ln = window.dashUser.last_name || window.dashUser.lastName || '';
    if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
    if (window.dashUser.name) return window.dashUser.name;
  }
  return window.dashUser && window.dashUser.email ? window.dashUser.email : '';
}

function reportError(source, err) {
  var msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : 'Unknown error');
  var stack = (err && err.stack) ? err.stack : 'No stack trace';
  try {
    fetch(buildApiUrl('/api/log-error'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Transfer Create Form (' + source + ')',
        message: msg,
        stack: stack,
        url: window.location.href,
        userAgent: navigator.userAgent
      })
    }).catch(function() {});
  } catch(e) { console.error('Failed to report error:', e); }
  console.error('[' + source + ']', msg, stack);
}

// ===== DOM-SAFE HELPERS =====
function clearChildren(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
function addOption(select, value, text, i18n) {
  var opt = document.createElement('option');
  opt.value = value;
  opt.textContent = text;
  if (i18n) opt.setAttribute('data-i18n', '');
  select.appendChild(opt);
  return opt;
}

// ===== LOCATION SERVICES =====
function checkDeviceLocation() {
  if (!navigator.geolocation) { showLocationPopup('Your device does not support GPS location.'); return; }
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
  clearChildren(banner);

  if (hasLocation) {
    banner.className = 'location-banner ok';
    var strong = document.createElement('strong');
    strong.textContent = '📍 Location: ';
    banner.appendChild(strong);
    banner.appendChild(document.createTextNode(
      deviceLocation.latitude.toFixed(6) + ', ' + deviceLocation.longitude.toFixed(6) +
      ' (±' + Math.round(deviceLocation.accuracy) + 'm)'
    ));
  } else {
    banner.className = 'location-banner warn';
    var strong2 = document.createElement('strong');
    strong2.textContent = '⚠️ Location is OFF';
    banner.appendChild(strong2);
    banner.appendChild(document.createTextNode(' — Click to retry '));
    var retryBtn = document.createElement('button');
    retryBtn.style.cssText = 'margin-left:8px;padding:4px 12px;border:1px solid #b45309;border-radius:4px;background:#fef3c7;color:#78350f;cursor:pointer;font-size:12px;';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', function() { checkDeviceLocation(); });
    banner.appendChild(retryBtn);
  }
}

function showLocationPopup(message) {
  var overlay = document.getElementById('locationPopupOverlay');
  var msgEl = document.getElementById('locationPopupMessage');
  if (!overlay || !msgEl) return;
  clearChildren(msgEl);

  // Error message paragraph
  var p = document.createElement('p');
  p.style.cssText = 'font-size:15px;margin:0 0 16px;';
  p.textContent = message;
  msgEl.appendChild(p);

  // Help instructions box
  var helpBox = document.createElement('div');
  helpBox.style.cssText = 'background:#f4f4f4;border-radius:8px;padding:14px;margin-bottom:12px;';

  var helpTitle = document.createElement('p');
  helpTitle.style.cssText = 'font-weight:600;margin:0 0 8px;';
  helpTitle.textContent = 'How to enable location:';
  helpBox.appendChild(helpTitle);

  var instructions = [
    ['iPhone/iPad (iOS):', 'Settings → Privacy & Security → Location Services → ON → Find your browser → set to "While Using"'],
    ['Android:', 'Settings → Location → ON → App permissions → your browser → Allow only while using the app'],
    ['Chrome (Desktop):', 'Click the location icon in the address bar → Site settings → Location → Allow → Reload'],
    ['Firefox (Desktop):', 'Settings → Privacy & Security → Permissions → Location → Settings → Allow']
  ];

  instructions.forEach(function(item) {
    var row = document.createElement('p');
    row.style.cssText = 'margin:0 0 6px;';
    var b = document.createElement('strong');
    b.textContent = item[0] + ' ';
    row.appendChild(b);
    row.appendChild(document.createTextNode(item[1]));
    helpBox.appendChild(row);
  });

  msgEl.appendChild(helpBox);

  var footer = document.createElement('p');
  footer.style.cssText = 'font-size:13px;color:#666;margin:0;';
  footer.textContent = 'After enabling, click "Retry" to capture your location.';
  msgEl.appendChild(footer);

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
  if (hasDeviceLocation()) return true;
  if (!isMobileDevice()) return true;
  showLocationPopup('Location is required to submit this form. Please enable location on your device and retry.');
  return false;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function makeTabsSticky() {
  var header = document.getElementById('dashHeader');
  var tabBar = document.querySelector('.tc-tab-bar');
  if (header && tabBar) {
    var headerHeight = header.getBoundingClientRect().height || header.offsetHeight || 0;
    tabBar.style.top = headerHeight + 'px';
  }
}

window.dashLogout = function() {
  try { fetch(buildApiUrl('/auth/logout'), { method: 'POST' }); } catch(e) {}
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

function onCarrierChange() {
  var type = document.getElementById('carrierType').value;
  var internalFields = document.getElementById('internalCarrierFields');
  var thirdPartyFields = document.getElementById('thirdPartyCarrierFields');

  if (type === 'third_party') {
    internalFields.style.display = 'none';
    thirdPartyFields.style.display = 'block';
  } else {
    internalFields.style.display = 'block';
    thirdPartyFields.style.display = 'none';
    document.getElementById('carrierName').value = '';
  }
}

function handleCustomSelectChange(sel, placeholderText) {
  if (sel.value === '__custom') {
    var input = document.createElement('input');
    input.type = 'text';
    input.id = sel.id;
    input.className = 'tc-row input';
    input.placeholder = placeholderText || 'Type text…';
    if (sel.hasAttribute('required')) input.setAttribute('required', '');
    sel.parentNode.replaceChild(input, sel);
    input.focus();
  }
}

/* ===== DEDUPLICATED ASSETS & VEHICLES ===== */
async function loadAssets() {
  try {
    var resp = await fetch(buildApiUrl('/api/equipment'));
    var data = await resp.json();
    var rawList = data.equipment || data.assets || [];

    var seenIds = new Set();
    var assetSelect = document.getElementById('assetId');
    var haulingVehicleSelect = document.getElementById('haulingVehicle');
    var haulingTrailerSelect = document.getElementById('haulingTrailer');

    clearChildren(assetSelect);
    addOption(assetSelect, '', 'Select equipment…', true);
    clearChildren(haulingVehicleSelect);
    addOption(haulingVehicleSelect, '', 'Select vehicle…', true);
    clearChildren(haulingTrailerSelect);
    addOption(haulingTrailerSelect, 'No Trailer', 'No Trailer', true);

    var locationsSet = new Set();

    rawList.forEach(function(a) {
      if (!a.id || seenIds.has(a.id)) return;
      seenIds.add(a.id);

      var label = (a.asset_number || a.id.slice(0,8)) + ' — ' + (a.name || 'Unnamed');
      var type = (a.category || a.type || a.asset_type || '').toLowerCase();

      // Populate Equipment to Transfer
      addOption(assetSelect, a.id, label);

      // Separate haul vehicles / trucks vs trailers vs standard equipment
      if (type.includes('truck') || type.includes('vehicle') || type.includes('pickup') || type.includes('tractor')) {
        addOption(haulingVehicleSelect, a.id, label);
      } else if (type.includes('trailer')) {
        addOption(haulingTrailerSelect, a.id, label);
      }

      // Collect locations
      if (a.current_location && a.current_location.trim()) locationsSet.add(a.current_location.trim());
      if (a.location && a.location.trim()) locationsSet.add(a.location.trim());
    });

    populateLocationDropdowns(Array.from(locationsSet));
  } catch(e) {
    console.error('Failed to load equipment:', e);
    reportError('loadAssets', e);
  }
}

/* ===== LOCATION DROPDOWNS ===== */
function populateLocationDropdowns(locations) {
  var fromLoc = document.getElementById('fromLocation');
  var toLoc = document.getElementById('toLocation');

  [fromLoc, toLoc].forEach(function(sel) {
    if (!sel || sel.tagName !== 'SELECT') return;
    clearChildren(sel);
    addOption(sel, '', 'Select location…', true);
    locations.sort().forEach(function(loc) {
      addOption(sel, loc, loc);
    });
    addOption(sel, '__custom', '+ Other (type manually)', true);
  });
}

/* ===== DEDUPLICATED PROJECTS ===== */
async function loadProjects() {
  try {
    var resp = await fetch(buildApiUrl('/api/projects'));
    var data = await resp.json();
    if (data.success && data.projects) {
      var fromSel = document.getElementById('fromProject');
      var toSel = document.getElementById('toProject');

      clearChildren(fromSel);
      addOption(fromSel, '', 'No project…', true);
      clearChildren(toSel);
      addOption(toSel, '', 'No project…', true);

      var seenProjIds = new Set();

      data.projects.forEach(function(p) {
        if (!p.id || seenProjIds.has(p.id)) return;
        seenProjIds.add(p.id);

        var name = p.name || p.project_name || p.id;
        addOption(fromSel, p.id, name);
        addOption(toSel, p.id, name);
      });
    }
  } catch(e) {}
}

/* ===== DRIVERS / OPERATORS DROPDOWN ===== */
async function loadDrivers() {
  var driverSelect = document.getElementById('carrierDriver');
  if (!driverSelect || driverSelect.tagName !== 'SELECT') return;

  var seenDrivers = new Set();
  var activeUserName = getUserDisplayName().trim();

  clearChildren(driverSelect);
  addOption(driverSelect, '', 'Select driver / operator…', true);
  if (activeUserName) {
    seenDrivers.add(activeUserName);
    var youOpt = addOption(driverSelect, activeUserName, activeUserName + ' (You)');
    youOpt.selected = true;
  }

  try {
    // FIX: build URL properly using URL API instead of string concatenation
    var url = new URL('/api/users', window.location.origin);
    var ctx = getUrlContextParams();
    if (ctx.org_id) url.searchParams.set('org_id', ctx.org_id);
    if (ctx.role_id) url.searchParams.set('role_id', ctx.role_id);
    url.searchParams.set('limit', '500');
    url.searchParams.set('all', 'true');
    var endpoint = url.pathname + url.search;

    var resp = await fetch(endpoint);
    var data = await resp.json();

    var usersList = data.users || data.data || [];

    usersList.forEach(function(u) {
      var name = u.full_name || u.name || ((u.first_name || u.firstName || '') + ' ' + (u.last_name || u.lastName || '')).trim() || u.email;
      if (name && !seenDrivers.has(name)) {
        seenDrivers.add(name);
        addOption(driverSelect, name, name);
      }
    });
  } catch(e) {
    console.error('Failed to load drivers from driv-en-db users table:', e);
  }

  addOption(driverSelect, '__custom', '+ Other (type manually)', true);
}

async function submitTransfer() {
  if (!requireLocationOrPopup()) return;
  showError('');

  var assetId = document.getElementById('assetId').value;
  var fromProjectId = document.getElementById('fromProject').value;

  var fromLocEl = document.getElementById('fromLocation');
  var fromLocation = fromLocEl ? fromLocEl.value.trim() : '';

  var toProjectId = document.getElementById('toProject').value;

  var toLocEl = document.getElementById('toLocation');
  var toLocation = toLocEl ? toLocEl.value.trim() : '';

  var carrierType = document.getElementById('carrierType').value;
  var carrierName = document.getElementById('carrierName').value.trim();

  var driverEl = document.getElementById('carrierDriver');
  var carrierDriver = driverEl ? driverEl.value.trim() : '';

  var haulingVehicle = document.getElementById('haulingVehicle').value;
  var haulingTrailer = document.getElementById('haulingTrailer').value;

  var notes = document.getElementById('notes').value.trim();

  if (!assetId) { showError('Please select the equipment to transfer.'); return; }
  if (!toLocation || toLocation === '__custom') { showError('Please enter or select the destination location.'); return; }

  var submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating…';

  try {
    var body = {
      asset_id: assetId,
      from_project_id: fromProjectId || null,
      from_location: fromLocation || null,
      to_project_id: toProjectId || null,
      to_location: toLocation || null,
      carrier_type: carrierType,
      carrier_name: carrierType === 'third_party' ? (carrierName || null) : null,
      carrier_driver: (carrierDriver && carrierDriver !== '__custom') ? carrierDriver : null,
      hauling_vehicle_id: carrierType === 'internal' ? (haulingVehicle || null) : null,
      hauling_trailer_id: carrierType === 'internal' ? (haulingTrailer || null) : null,
      notes: notes || null,
      device_location: hasDeviceLocation() ? deviceLocation : null
    };

    var ctx = getUrlContextParams();
    if (ctx.org_id) body.org_id = ctx.org_id;
    if (ctx.role_id) body.role_id = ctx.role_id;

    var resp = await fetch(buildApiUrl('/api/transfers'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var data = await resp.json();

    if (data.success && data.transfer) {
      document.getElementById('formView').style.display = 'none';
      document.getElementById('successView').style.display = 'block';
      document.getElementById('ticketNum').textContent = data.transfer.ticket_number;
      var assetName = document.getElementById('assetId').selectedOptions[0].textContent;
      document.getElementById('successMsg').textContent = assetName + ' → ' + toLocation;
    } else {
      showError(data.error || 'Failed to create transfer ticket.');
    }
  } catch(e) {
    showError('Network error: ' + e.message);
    reportError('submitTransfer', e);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Ticket';
  }
}

function resetForm() {
  document.getElementById('formView').style.display = 'block';
  document.getElementById('successView').style.display = 'none';
  document.getElementById('assetId').value = '';
  document.getElementById('fromProject').value = '';
  document.getElementById('fromLocation').value = '';
  document.getElementById('toProject').value = '';
  document.getElementById('toLocation').value = '';
  document.getElementById('carrierType').value = 'internal';
  document.getElementById('carrierName').value = '';
  document.getElementById('haulingVehicle').value = '';
  document.getElementById('haulingTrailer').value = 'No Trailer';
  document.getElementById('notes').value = '';
  onCarrierChange();
  loadDrivers();
  showError('');
}

// ===== EXPOSE FUNCTIONS FOR INLINE ONCLICK HANDLERS =====
window.checkDeviceLocation = checkDeviceLocation;
window.closeLocationPopup = closeLocationPopup;
window.onCarrierChange = onCarrierChange;
window.handleCustomSelectChange = handleCustomSelectChange;
window.goBack = goBack;
window.submitTransfer = submitTransfer;
window.resetForm = resetForm;

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

  var tabBar = document.querySelector('.tc-tab-bar');
  if (tabBar) tabBar.style.display = 'flex';

  setTimeout(makeTabsSticky, 100);
  setTimeout(makeTabsSticky, 500);

  document.getElementById('loading').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  // Request location ONLY on mobile devices
  if (isMobileDevice()) {
    if (!hasDeviceLocation()) checkDeviceLocation();
    var banner = document.getElementById('locationStatusBanner');
    if (banner) banner.style.display = 'block';
  }

  await loadAssets();
  await loadProjects();
  await loadDrivers();
}

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
