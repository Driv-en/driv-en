/**
 * DRIV-EN | Create Work Order (v1)
 * File: /app/forms/work-order-create.js
 * Extracted from work-order-create.html for CSP compliance.
 *
 * Fixes applied during extraction:
 *   - preserveUrlParams: added same-origin check (prevents org_id leakage to external URLs).
 *   - loadUsers: fixed URL construction bug (missing ? when no org_id/role_id params).
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
        source: 'Work Order Form (' + source + ')',
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

  var p = document.createElement('p');
  p.style.cssText = 'font-size:15px;margin:0 0 16px;';
  p.textContent = message;
  msgEl.appendChild(p);

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

function insertHeaderTitle() {
  var row1 = document.querySelector('.dash-header-row1');
  if (row1 && !document.querySelector('.tc-header-title')) {
    var title = document.createElement('div');
    title.className = 'tc-header-title';
    title.textContent = 'Create Work Order';
    var logoArea = document.getElementById('dashCustomerLogoArea');
    var drivenLogo = row1.querySelector('.dash-driven-logo');
    if (logoArea && drivenLogo) row1.insertBefore(title, drivenLogo);
  }
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

/* ===== LOAD ASSETS ===== */
async function loadAssets() {
  try {
    var resp = await fetch(buildApiUrl('/api/equipment'));
    var data = await resp.json();
    var rawList = data.equipment || data.assets || [];

    var seenIds = new Set();
    var assetSelect = document.getElementById('assetId');
    clearChildren(assetSelect);
    addOption(assetSelect, '', 'Select equipment…', true);

    rawList.forEach(function(a) {
      if (!a.id || seenIds.has(a.id)) return;
      seenIds.add(a.id);

      var label = (a.asset_number || a.id.slice(0,8)) + ' — ' + (a.name || 'Unnamed');
      addOption(assetSelect, a.id, label);
    });
  } catch(e) {
    console.error('Failed to load equipment:', e);
    reportError('loadAssets', e);
  }
}

/* ===== LOAD USERS FOR ASSIGNMENT ===== */
async function loadUsers() {
  var select = document.getElementById('assignedUser');
  if (!select) return;

  var seen = new Set();
  clearChildren(select);
  addOption(select, '', 'Unassigned', true);

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
      if (name && !seen.has(name)) {
        seen.add(name);
        addOption(select, name, name);
      }
    });
  } catch(e) {
    console.error('Failed to load users for assignment:', e);
  }
}

/* ===== SUBMIT WORK ORDER ===== */
async function submitWorkOrder() {
  if (!requireLocationOrPopup()) return;
  showError('');

  var assetId = document.getElementById('assetId').value;
  var priority = document.getElementById('priority').value;
  var category = document.getElementById('category').value;
  var assignedUser = document.getElementById('assignedUser').value;
  var targetDate = document.getElementById('targetDate').value;
  var title = document.getElementById('title').value.trim();
  var description = document.getElementById('description').value.trim();

  if (!assetId) { showError('Please select equipment.'); return; }
  if (!title) { showError('Please enter a work order title.'); return; }

  var submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating…';

  try {
    var body = {
      asset_id: assetId,
      priority: priority,
      category: category,
      assigned_to: assignedUser || null,
      target_date: targetDate || null,
      title: title,
      description: description || null,
      device_location: hasDeviceLocation() ? deviceLocation : null
    };

    var ctx = getUrlContextParams();
    if (ctx.org_id) body.org_id = ctx.org_id;
    if (ctx.role_id) body.role_id = ctx.role_id;

    var resp = await fetch(buildApiUrl('/api/work-orders'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var data = await resp.json();

    if (data.success && (data.work_order || data.id)) {
      document.getElementById('formView').style.display = 'none';
      document.getElementById('successView').style.display = 'block';
      document.getElementById('ticketNum').textContent = data.work_order ? (data.work_order.wo_number || data.work_order.id) : data.id;
      var assetName = document.getElementById('assetId').selectedOptions[0].textContent;
      document.getElementById('successMsg').textContent = assetName + ' — ' + title;
    } else {
      showError(data.error || 'Failed to create work order.');
    }
  } catch(e) {
    showError('Network error: ' + e.message);
    reportError('submitWorkOrder', e);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Work Order';
  }
}

function resetForm() {
  document.getElementById('formView').style.display = 'block';
  document.getElementById('successView').style.display = 'none';
  document.getElementById('assetId').value = '';
  document.getElementById('priority').value = 'medium';
  document.getElementById('category').value = 'mechanical';
  document.getElementById('assignedUser').value = '';
  document.getElementById('targetDate').value = '';
  document.getElementById('title').value = '';
  document.getElementById('description').value = '';
  loadUsers();
  showError('');
}

// ===== EXPOSE FUNCTIONS FOR INLINE ONCLICK HANDLERS =====
window.checkDeviceLocation = checkDeviceLocation;
window.closeLocationPopup = closeLocationPopup;
window.goBack = goBack;
window.submitWorkOrder = submitWorkOrder;
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

  insertHeaderTitle();

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
  await loadUsers();
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
