/**
 * DRIV-EN — Operational Forms Page Logic
 * File: /app/dashboard/forms.js
 */

var allTanks = [];
var allAssets = [];
var tankTypes = [];
var receiptR2Key = null;
var lineItemCount = 0;
var _formsInitDone = false;
var _objectUrl = null;
var deviceLocation = null;

document.addEventListener('DOMContentLoaded', function () {
  initFormsPage();
});

function initFormsPage() {
  // Bind Tab Controls
  var tabButtons = document.querySelectorAll('.forms-tab[data-tab]');
  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tabName = this.getAttribute('data-tab');
      if (tabName) switchTab(tabName);
    });
  });

  // Bind Header Controls
  var btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', dashLogout);

  var btnCloseLocation = document.getElementById('btnCloseLocationPopup');
  if (btnCloseLocation) btnCloseLocation.addEventListener('click', closeLocationPopup);

  var btnRetryLocationPopup = document.getElementById('btnRetryLocationPopup');
  if (btnRetryLocationPopup) {
    btnRetryLocationPopup.addEventListener('click', function () {
      closeLocationPopup();
      checkDeviceLocation();
    });
  }

  var btnRetryLocationBanner = document.getElementById('btnRetryLocationBanner');
  if (btnRetryLocationBanner) {
    btnRetryLocationBanner.addEventListener('click', checkDeviceLocation);
  }

  // Bind File Upload Controls
  var cameraBtn = document.getElementById('btnCameraUpload');
  var cameraInput = document.getElementById('receiptCameraInput');
  if (cameraBtn && cameraInput) {
    cameraBtn.addEventListener('click', function () { cameraInput.click(); });
    cameraInput.addEventListener('change', function () { handleReceiptUpload(this); });
  }

  var fileBtn = document.getElementById('btnFileUpload');
  var fileInput = document.getElementById('receiptFileInput');
  if (fileBtn && fileInput) {
    fileBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { handleReceiptUpload(this); });
  }

  // Bind Form Action Buttons
  var btnAddLine = document.getElementById('btnAddLineItem');
  if (btnAddLine) btnAddLine.addEventListener('click', function () { addLineItem(); });

  var btnSubmitPurchase = document.getElementById('btnSubmitPurchase');
  if (btnSubmitPurchase) btnSubmitPurchase.addEventListener('click', submitPurchase);

  var btnClearPurchase = document.getElementById('btnClearPurchase');
  if (btnClearPurchase) btnClearPurchase.addEventListener('click', clearPurchaseForm);

  var btnSubmitAdjustment = document.getElementById('btnSubmitAdjustment');
  if (btnSubmitAdjustment) btnSubmitAdjustment.addEventListener('click', submitAdjustment);

  var btnClearAdjustment = document.getElementById('btnClearAdjustment');
  if (btnClearAdjustment) btnClearAdjustment.addEventListener('click', clearAdjustForm);

  var adjustAmountInput = document.getElementById('adjustAmount');
  if (adjustAmountInput) adjustAmountInput.addEventListener('input', previewAdjustment);

  // Bind Standardized Modals (Purpose & Instructions)
  initStandardModals();

  // Listen for Session Load
  if (window.dashUser) {
    startApp();
  } else {
    document.addEventListener('dashSessionLoaded', startApp);
  }
}

async function startApp() {
  if (_formsInitDone) return;
  _formsInitDone = true;

  var user = window.dashUser;
  if (!user) {
    window.location.href = '/public/login.html';
    return;
  }

  var role = (user.role || '').toLowerCase();
  var dashUrl = role === 'admin' ? '/app/dashboard/admin.html' : '/app/dashboard/employee-dashboard.html';
  var homeLink = document.getElementById('dashHomeLink');
  if (homeLink) homeLink.href = dashUrl;

  insertHeaderTitle();
  makeTabsSticky();

  var loadingEl = document.getElementById('loading');
  var dashboardEl = document.getElementById('dashboard');
  if (loadingEl) loadingEl.style.display = 'none';
  if (dashboardEl) dashboardEl.style.display = 'block';

  await loadTankTypes();
  await loadTanks();
  initPurchaseForm();
}

/* ===== GEOLOCATION FUNCTIONS ===== */
function checkDeviceLocation() {
  if (!navigator.geolocation) {
    showLocationPopup('Your device does not support GPS location.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      deviceLocation = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: new Date().toISOString()
      };
      updateLocationStatus(true);
    },
    function (err) {
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
  var textEl = document.getElementById('locationStatusText');
  if (!banner || !textEl) return;

  if (hasLocation) {
    banner.className = 'location-banner ok';
    textEl.innerHTML = '<strong>📍 Location:</strong> ' + deviceLocation.latitude.toFixed(6) + ', ' + deviceLocation.longitude.toFixed(6) + ' (±' + Math.round(deviceLocation.accuracy) + 'm)';
  } else {
    banner.className = 'location-banner warn';
    textEl.innerHTML = '<strong>⚠️ Location is OFF</strong> — Click Retry to connect';
  }
}

function showLocationPopup(message) {
  var overlay = document.getElementById('locationPopupOverlay');
  var msgEl = document.getElementById('locationPopupMessage');
  if (!overlay || !msgEl) return;

  msgEl.innerHTML =
    '<p style="font-size:15px;margin:0 0 16px;">' + esc(message) + '</p>' +
    '<div style="background:#f4f4f4;border-radius:8px;padding:14px;margin-bottom:12px;">' +
    '<p style="font-weight:600;margin:0 0 8px;">How to enable location:</p>' +
    '<p style="margin:0 0 6px;"><strong>iPhone/iPad (iOS):</strong> Settings → Privacy & Security → Location Services → ON → Find browser → set to "While Using"</p>' +
    '<p style="margin:0 0 6px;"><strong>Android:</strong> Settings → Location → ON → App permissions → browser → Allow while using app</p>' +
    '<p style="margin:0 0 6px;"><strong>Chrome (Desktop):</strong> Click location icon in address bar → Site settings → Location → Allow → Reload</p>' +
    '<p style="margin:0 0 6px;"><strong>Edge (Desktop):</strong> Settings → Cookies and site permissions → Location → Allow</p>' +
    '<p style="margin:0;"><strong>Firefox (Desktop):</strong> Settings → Privacy & Security → Permissions → Location → Settings → Allow</p>' +
    '</div><p style="font-size:13px;color:#666;margin:0;">After enabling, click "Retry" to capture location. Forms cannot be submitted without location.</p>';
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
  showLocationPopup('Location is required to submit this form. Please enable location on your device and retry.');
  return false;
}

/* ===== TAB SWITCHING & HELPERS ===== */
function switchTab(tabName) {
  document.querySelectorAll('.forms-tab').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.forms-tab-content').forEach(function (c) { c.classList.remove('active'); });

  var activeTab = document.querySelector('.forms-tab[data-tab="' + tabName + '"]');
  var activeContent = document.getElementById('tab-' + tabName);

  if (activeTab) activeTab.classList.add('active');
  if (activeContent) activeContent.classList.add('active');

  if (tabName === 'fuel-purchase') initPurchaseForm();
  if (tabName === 'tank-adjust') initAdjustForm();
}

function getTankTypeDisplayName(systemKey) {
  var t = tankTypes.find(function (tt) { return tt.system_key === systemKey; });
  return t ? t.display_name : systemKey;
}

function makeTabsSticky() {
  var header = document.getElementById('dashHeader');
  var tabBar = document.getElementById('formsTabBar');
  if (header && tabBar && !header.contains(tabBar)) {
    header.appendChild(tabBar);
  }
}

function insertHeaderTitle() {
  var row1 = document.querySelector('.dash-header-row1');
  if (row1 && !document.querySelector('.forms-header-title')) {
    var title = document.createElement('div');
    title.className = 'forms-header-title';
    title.textContent = 'Forms';
    var drivenLogo = row1.querySelector('.dash-driven-logo');
    if (drivenLogo) row1.insertBefore(title, drivenLogo);
  }
}

function dashLogout() {
  try { fetch('/auth/logout', { method: 'POST' }); } catch (e) {}
  window.location.href = '/public/login.html';
}
window.dashLogout = dashLogout;

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function reportError(source, err) {
  var msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : 'Unknown error');
  var stack = (err && err.stack) ? err.stack : 'No stack trace';
  try {
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'Forms Page (' + source + ')', message: msg, stack: stack, url: window.location.href, userAgent: navigator.userAgent })
    }).catch(function () {});
  } catch (e) {}
  console.error('[' + source + ']', msg, stack);
}

function dedupTanks(tanks) {
  var seen = {};
  return tanks.filter(function (t) {
    var key = (t.name || '') + '|' + (t.tank_type || '');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function getUserDisplayName() {
  if (window.dashUser) {
    if (window.dashUser.name) return window.dashUser.name;
    if (window.dashUser.firstName || window.dashUser.lastName) return [window.dashUser.firstName, window.dashUser.lastName].filter(Boolean).join(' ');
  }
  return window.dashUser && window.dashUser.email ? window.dashUser.email : '';
}

function localDate() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/* ===== FUEL PURCHASE FORM FUNCTIONS ===== */
function initPurchaseForm() {
  var today = localDate();
  var dateField = document.getElementById('purchaseDate');
  if (dateField) dateField.value = today;

  var userField = document.getElementById('purchasePerson');
  if (userField) userField.value = getUserDisplayName();

  if (!hasDeviceLocation()) checkDeviceLocation();

  var banner = document.getElementById('locationStatusBanner');
  if (banner) banner.style.display = 'block';

  var container = document.getElementById('lineItemsContainer');
  if (container) container.innerHTML = '';
  lineItemCount = 0;
  addLineItem();
  recalcGrandTotal();
}

function addLineItem(data) {
  lineItemCount++;
  var lineId = 'line-' + lineItemCount;
  var container = document.getElementById('lineItemsContainer');
  if (!container) return;

  var div = document.createElement('div');
  div.className = 'line-item-row';
  div.id = lineId;

  var bulkTanks = dedupTanks(allTanks.filter(function (t) { return t.tank_type === 'bulk' && t.status === 'active'; }));
  var dragupTanks = dedupTanks(allTanks.filter(function (t) { return t.tank_type === 'dragup' && t.status === 'active'; }));
  var portableTanks = dedupTanks(allTanks.filter(function (t) { return t.tank_type === 'portable' && t.status === 'active'; }));

  var tankOptions = '<option value="">Select destination…</option>';
  if (bulkTanks.length > 0) {
    tankOptions += '<optgroup label="' + esc(getTankTypeDisplayName('bulk_tank')) + '">';
    bulkTanks.forEach(function (t) {
      var label = esc(t.name) + (t.fuel_type ? ' (' + esc(t.fuel_type) + ')' : '') + (t.location ? ' — ' + esc(t.location) : '');
      tankOptions += '<option value="bulk_tank|' + esc(t.id) + '">' + label + '</option>';
    });
    tankOptions += '</optgroup>';
  }
  if (dragupTanks.length > 0) {
    tankOptions += '<optgroup label="' + esc(getTankTypeDisplayName('dragup_tank')) + '">';
    dragupTanks.forEach(function (t) {
      var label = esc(t.name) + (t.fuel_type ? ' (' + esc(t.fuel_type) + ')' : '') + (t.location ? ' — ' + esc(t.location) : '');
      tankOptions += '<option value="dragup_tank|' + esc(t.id) + '">' + label + '</option>';
    });
    tankOptions += '</optgroup>';
  }
  if (portableTanks.length > 0) {
    tankOptions += '<optgroup label="' + esc(getTankTypeDisplayName('portable_can')) + '">';
    portableTanks.forEach(function (t) {
      var label = esc(t.name) + (t.fuel_type ? ' (' + esc(t.fuel_type) + ')' : '') + (t.location ? ' — ' + esc(t.location) : '');
      tankOptions += '<option value="portable_can|' + esc(t.id) + '">' + label + '</option>';
    });
    tankOptions += '</optgroup>';
  }

  var fuelType = (data && data.fuel_type) || 'diesel';
  var qty = (data && data.gallons) || '';
  var unitPrice = (data && data.unit_price) || '';

  div.innerHTML =
    '<div class="line-item-grid">' +
    '<div class="purchase-field"><label class="purchase-label">Fuel Type</label><select class="purchase-input line-fuel-type"><option value="diesel"' + (fuelType === 'diesel' ? ' selected' : '') + '>Diesel</option><option value="gasoline"' + (fuelType === 'gasoline' ? ' selected' : '') + '>Gasoline</option><option value="DEF"' + (fuelType === 'DEF' ? ' selected' : '') + '>DEF</option><option value="propane"' + (fuelType === 'propane' ? ' selected' : '') + '>Propane</option><option value="other"' + (fuelType === 'other' ? ' selected' : '') + '>Other</option></select></div>' +
    '<div class="purchase-field"><label class="purchase-label">Destination <span style="color:#cc0000;">*</span></label><select class="purchase-input line-destination">' + tankOptions + '</select></div>' +
    '<div class="purchase-field"><label class="purchase-label">Qty (gal) <span style="color:#cc0000;">*</span></label><input type="number" class="purchase-input line-qty" placeholder="0" min="0" step="0.01" value="' + qty + '"></div>' +
    '<div class="purchase-field"><label class="purchase-label">Cost/Gal</label><input type="number" class="purchase-input line-cpg" placeholder="$0.00" min="0" step="0.001" value="' + unitPrice + '"></div>' +
    '<button type="button" class="line-item-remove" data-remove-line="' + lineId + '">✕</button>' +
    '</div>';

  container.appendChild(div);

  // Bind internal line events
  div.querySelector('.line-fuel-type').addEventListener('change', recalcGrandTotal);
  div.querySelector('.line-qty').addEventListener('input', recalcGrandTotal);
  div.querySelector('.line-cpg').addEventListener('input', recalcGrandTotal);
  div.querySelector('[data-remove-line]').addEventListener('click', function () {
    removeLineItem(lineId);
  });

  recalcGrandTotal();
}

function removeLineItem(lineId) {
  var el = document.getElementById(lineId);
  if (el) el.remove();
  recalcGrandTotal();
  if (document.querySelectorAll('.line-item-row').length === 0) {
    addLineItem();
  }
}

function recalcGrandTotal() {
  var total = 0;
  document.querySelectorAll('.line-item-row').forEach(function (row) {
    var qtyInput = row.querySelector('.line-qty');
    var cpgInput = row.querySelector('.line-cpg');
    var qty = qtyInput ? parseFloat(qtyInput.value) || 0 : 0;
    var cpg = cpgInput ? parseFloat(cpgInput.value) || 0 : 0;
    if (qty > 0 && cpg > 0) total += qty * cpg;
  });
  var totalEl = document.getElementById('grandTotal');
  if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
}

async function handleReceiptUpload(input) {
  var file = input.files[0];
  if (!file) return;

  var preview = document.getElementById('receiptPreview');
  var previewContent = document.getElementById('receiptPreviewContent');
  var status = document.getElementById('receiptExtractStatus');
  if (preview) preview.style.display = 'block';

  var isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    previewContent.innerHTML = '<div class="receipt-pdf-icon">📄</div><p style="font-size:14px;font-weight:600;margin:8px 0 0;">' + esc(file.name) + '</p><p style="font-size:12px;color:var(--text-muted);">PDF document</p>';
  } else {
    if (_objectUrl) {
      URL.revokeObjectURL(_objectUrl);
      _objectUrl = null;
    }
    _objectUrl = URL.createObjectURL(file);
    previewContent.innerHTML = '<img class="receipt-preview-img" src="' + _objectUrl + '">';
  }

  status.className = 'receipt-extract-status loading';
  status.textContent = 'Uploading & extracting receipt data with AI…';
  document.getElementById('aiConfidenceBanner').style.display = 'none';

  try {
    var formData = new FormData();
    formData.append('file', file);
    var resp = await fetch('/api/fuel-receipts/extract', { method: 'POST', body: formData });
    if (!resp.ok) throw new Error('Server returned ' + resp.status);
    var data = await resp.json();

    if (data.success && data.extracted) {
      status.className = 'receipt-extract-status success';
      var conf = data.extracted.confidence || 0;
      var confPct = Math.round(conf * 100);
      var fileTypeLabel = data.receipt && data.receipt.file_type === 'pdf' ? 'PDF' : 'Image';
      status.textContent = '✓ Extraction complete (' + confPct + '% confidence, ' + fileTypeLabel + ', ' + (data.processing_time_ms || 0) + 'ms)';

      if (data.extracted.vendor) document.getElementById('purchaseVendor').value = data.extracted.vendor;
      if (data.extracted.receipt_date) document.getElementById('purchaseDate').value = data.extracted.receipt_date;

      if (data.extracted.line_items && data.extracted.line_items.length > 0) {
        document.getElementById('lineItemsContainer').innerHTML = '';
        lineItemCount = 0;
        data.extracted.line_items.forEach(function (li) {
          addLineItem({
            fuel_type: li.fuel_type || 'diesel',
            gallons: li.gallons || li.quantity || '',
            unit_price: li.unit_price || '',
            amount: li.amount || ''
          });
        });
      }
      showConfidenceBanner(data.extracted);
      recalcGrandTotal();
    } else {
      status.className = 'receipt-extract-status error';
      status.textContent = '✗ Extraction failed: ' + (data.error || 'Unknown error');
    }
  } catch (e) {
    status.className = 'receipt-extract-status error';
    status.textContent = '✗ Error: ' + e.message;
    reportError('extractReceipt', e);
  }
}

function showConfidenceBanner(extracted) {
  var banner = document.getElementById('aiConfidenceBanner');
  var conf = extracted.confidence || 0;
  var confPct = Math.round(conf * 100);
  var lowFields = extracted.low_confidence_fields || [];

  var html = '<strong>AI Extraction: ' + confPct + '% confidence</strong>';
  if (lowFields.length > 0) {
    banner.className = 'ai-confidence-banner low';
    html += '<br><span style="font-size:12px;">Low confidence fields:</span> ';
    html += lowFields.map(function (f) { return '<span class="field-flag">' + esc(f) + '</span>'; }).join('');
  } else {
    banner.className = 'ai-confidence-banner';
    html += '<br><span style="font-size:12px;">All fields extracted with good confidence. Please review before submitting.</span>';
  }
  banner.innerHTML = html;
  banner.style.display = 'block';
}

async function submitPurchase() {
  if (!requireLocationOrPopup()) return;

  var date = document.getElementById('purchaseDate').value;
  var location = document.getElementById('purchaseLocation').value;
  var person = document.getElementById('purchasePerson').value;
  var vendor = document.getElementById('purchaseVendor').value;
  var notes = document.getElementById('purchaseNotes').value;

  if (!date) {
    showPurchaseError('Date is required');
    return;
  }

  var lineItems = [];
  var rows = document.querySelectorAll('.line-item-row');
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var dest = row.querySelector('.line-destination').value;
    var qty = parseFloat(row.querySelector('.line-qty').value);
    var fuelType = row.querySelector('.line-fuel-type').value;
    var cpg = parseFloat(row.querySelector('.line-cpg').value) || null;

    if (!dest) {
      showPurchaseError('Line ' + (i + 1) + ': destination is required');
      return;
    }
    if (!qty || qty <= 0) {
      showPurchaseError('Line ' + (i + 1) + ': quantity must be > 0');
      return;
    }

    var parts = dest.split('|');
    lineItems.push({
      fuel_type: fuelType,
      quantity: qty,
      to_entity_type: parts[0],
      to_entity_id: parts[1],
      cost_per_gallon: cpg
    });
  }

  if (lineItems.length === 0) {
    showPurchaseError('At least one line item is required');
    return;
  }

  var user = window.dashUser || {};
  var body = {
    vendor: vendor || null,
    purchase_date: date + 'T08:00:00Z',
    location: location || null,
    person: person || null,
    notes: notes || null,
    receipt_r2_key: receiptR2Key,
    line_items: lineItems,
    device_location: hasDeviceLocation() ? deviceLocation : null
  };

  var submitBtn = document.getElementById('btnSubmitPurchase');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Recording…';

  try {
    var resp = await fetch('/api/fuel-purchases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': user.org_id || '',
        'x-user-id': user.id || ''
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) throw new Error('Server returned ' + resp.status);
    var data = await resp.json();

    if (data.success) {
      showPurchaseSuccess(data.purchase);
      setTimeout(clearPurchaseForm, 3000);
    } else {
      showPurchaseError(data.error || 'Failed to record purchase');
    }
  } catch (e) {
    showPurchaseError('Error: ' + e.message);
    reportError('submitPurchase', e);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Record Purchase';
  }
}

function showPurchaseSuccess(purchase) {
  var result = document.getElementById('purchaseResult');
  result.className = 'purchase-result-success';
  var lineCount = purchase.line_items ? purchase.line_items.length : 0;
  var msg = 'Purchase recorded: ' + lineCount + ' line item' + (lineCount !== 1 ? 's' : '');
  if (purchase.total_cost) msg += ' — $' + parseFloat(purchase.total_cost).toFixed(2);
  if (purchase.vendor) msg += ' from ' + purchase.vendor;
  result.textContent = msg;
  result.style.display = 'block';
  setTimeout(function () { result.style.display = 'none'; }, 5000);
}

function showPurchaseError(msg) {
  var result = document.getElementById('purchaseResult');
  result.className = 'purchase-result-error';
  result.textContent = '✗ ' + msg;
  result.style.display = 'block';
  setTimeout(function () { result.style.display = 'none'; }, 5000);
}

function clearPurchaseForm() {
  document.getElementById('purchaseDate').value = localDate();
  document.getElementById('purchaseLocation').value = '';
  document.getElementById('purchasePerson').value = getUserDisplayName();
  document.getElementById('purchaseVendor').value = '';
  document.getElementById('purchaseNotes').value = '';
  document.getElementById('receiptPreview').style.display = 'none';
  document.getElementById('receiptPreviewContent').innerHTML = '';
  document.getElementById('receiptExtractStatus').textContent = '';
  document.getElementById('receiptExtractStatus').className = 'receipt-extract-status';
  document.getElementById('receiptCameraInput').value = '';
  document.getElementById('receiptFileInput').value = '';
  document.getElementById('aiConfidenceBanner').style.display = 'none';
  document.getElementById('aiConfidenceBanner').innerHTML = '';
  document.getElementById('purchaseResult').style.display = 'none';

  if (_objectUrl) {
    URL.revokeObjectURL(_objectUrl);
    _objectUrl = null;
  }
  receiptR2Key = null;

  document.getElementById('lineItemsContainer').innerHTML = '';
  lineItemCount = 0;
  addLineItem();
  recalcGrandTotal();
}

/* ===== TANK ADJUSTMENT FORM FUNCTIONS ===== */
function initAdjustForm() {
  var userField = document.getElementById('adjustPerson');
  if (userField) userField.value = getUserDisplayName();

  if (!hasDeviceLocation()) checkDeviceLocation();

  var banner = document.getElementById('locationStatusBanner');
  if (banner) banner.style.display = 'block';

  var heading = document.getElementById('tankAdjustHeading');
  if (heading && tankTypes.length > 0) {
    heading.innerHTML = esc(getTankTypeDisplayName('bulk_tank')) + ' Adjustment <span class="section-heading-count">Manual quantity correction</span>';
  }

  var tankSelect = document.getElementById('adjustTank');
  if (tankSelect) {
    var bulkTanks = dedupTanks(allTanks.filter(function (t) { return t.tank_type === 'bulk' && t.status === 'active'; }));
    tankSelect.innerHTML = '<option value="">Select tank…</option>' + bulkTanks.map(function (t) {
      var label = esc(t.name) + (t.fuel_type ? ' (' + esc(t.fuel_type) + ')' : '') + (t.location ? ' — ' + esc(t.location) : '');
      return '<option value="' + esc(t.id) + '" data-qty="' + (t.current_quantity || 0) + '" data-cap="' + (t.capacity || 0) + '">' + label + '</option>';
    }).join('');

    tankSelect.addEventListener('change', function () {
      var opt = tankSelect.options[tankSelect.selectedIndex];
      var qty = opt ? opt.getAttribute('data-qty') : '';
      document.getElementById('adjustCurrentQty').value = qty ? (qty + ' gal') : '';
      previewAdjustment();
    });
  }
}

function previewAdjustment() {
  var tankSelect = document.getElementById('adjustTank');
  var opt = tankSelect ? tankSelect.options[tankSelect.selectedIndex] : null;
  var currentQty = opt ? parseFloat(opt.getAttribute('data-qty')) || 0 : 0;
  var capacity = opt ? parseFloat(opt.getAttribute('data-cap')) || 0 : 0;
  var adjAmt = parseFloat(document.getElementById('adjustAmount').value) || 0;
  var newQty = currentQty + adjAmt;

  var newQtyEl = document.getElementById('adjustNewQty');
  var previewEl = document.getElementById('adjustPreview');

  if (adjAmt === 0 || !opt || !opt.value) {
    newQtyEl.value = '';
    previewEl.style.display = 'none';
    return;
  }

  newQtyEl.value = newQty + ' gal';
  var cls = adjAmt < 0 ? 'shortage' : 'overage';
  var label = adjAmt < 0 ? 'Shortage' : 'Overage';
  var html = label + ': <span class="' + cls + '">' + (adjAmt > 0 ? '+' : '') + adjAmt + ' gal</span> → New quantity: ' + newQty + ' gal';

  if (newQty < 0) html += ' <span style="color:#cc0000;">⚠️ Cannot go below zero</span>';
  if (capacity > 0 && newQty > capacity) html += ' <span style="color:#cc0000;">⚠️ Exceeds capacity (' + capacity + ' gal)</span>';

  previewEl.innerHTML = html;
  previewEl.style.display = 'block';
}

async function submitAdjustment() {
  if (!requireLocationOrPopup()) return;

  var tankId = document.getElementById('adjustTank').value;
  var adjAmt = parseFloat(document.getElementById('adjustAmount').value);
  var reason = document.getElementById('adjustReason').value;
  var person = document.getElementById('adjustPerson').value;

  if (!tankId) {
    showAdjustError('Please select a tank');
    return;
  }
  if (isNaN(adjAmt) || adjAmt === 0) {
    showAdjustError('Adjustment amount must be a non-zero number');
    return;
  }
  if (!reason || !reason.trim()) {
    showAdjustError('Reason is required for all adjustments');
    return;
  }

  var user = window.dashUser || {};
  var body = {
    adjustment_amount: adjAmt,
    reason: reason.trim(),
    person: person || null,
    device_location: hasDeviceLocation() ? deviceLocation : null
  };

  var submitBtn = document.getElementById('btnSubmitAdjustment');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  try {
    var resp = await fetch('/api/fuel-tanks/' + tankId + '/adjust', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': user.org_id || '',
        'x-user-id': user.id || ''
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) throw new Error('Server returned ' + resp.status);
    var data = await resp.json();

    if (data.success) {
      showAdjustSuccess(data.adjustment);
      await loadTanks();
      clearAdjustForm();
    } else {
      showAdjustError(data.error || 'Failed to submit adjustment');
    }
  } catch (e) {
    showAdjustError('Error: ' + e.message);
    reportError('submitAdjustment', e);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Adjustment';
  }
}

function showAdjustSuccess(adj) {
  var result = document.getElementById('adjustResult');
  result.className = 'purchase-result-success';
  result.textContent = 'Adjustment recorded: ' + adj.tank_name + ' ' + (adj.adjustment_amount > 0 ? '+' : '') + adj.adjustment_amount + ' gal (prev: ' + adj.previous_quantity + ' → new: ' + adj.new_quantity + ')';
  result.style.display = 'block';
  setTimeout(function () { result.style.display = 'none'; }, 5000);
}

function showAdjustError(msg) {
  var result = document.getElementById('adjustResult');
  result.className = 'purchase-result-error';
  result.textContent = '✗ ' + msg;
  result.style.display = 'block';
  setTimeout(function () { result.style.display = 'none'; }, 5000);
}

function clearAdjustForm() {
  document.getElementById('adjustTank').value = '';
  document.getElementById('adjustCurrentQty').value = '';
  document.getElementById('adjustAmount').value = '';
  document.getElementById('adjustReason').value = '';
  document.getElementById('adjustPerson').value = getUserDisplayName();
  document.getElementById('adjustNewQty').value = '';
  document.getElementById('adjustPreview').style.display = 'none';
  document.getElementById('adjustResult').style.display = 'none';
}

/* ===== API DATA FETCHERS ===== */
async function loadTanks() {
  try {
    var user = window.dashUser || {};
    var tanksResp = await fetch('/api/fuel-tanks', {
      headers: {
        'x-org-id': user.org_id || '',
        'x-user-id': user.id || ''
      }
    });
    if (!tanksResp.ok) throw new Error('Failed to load tanks: ' + tanksResp.status);
    var tanksData = await tanksResp.json();
    if (tanksData.success && tanksData.tanks) allTanks = tanksData.tanks;
  } catch (e) {
    console.error('Error loading tanks:', e.message);
    reportError('loadTanks', e);
  }
}

async function loadTankTypes() {
  try {
    var user = window.dashUser || {};
    var resp = await fetch('/api/fuel-tank-types', {
      headers: {
        'x-org-id': user.org_id || '',
        'x-user-id': user.id || ''
      }
    });
    if (!resp.ok) throw new Error('Failed to load tank types: ' + resp.status);
    var data = await resp.json();
    if (data.success && data.tank_types) tankTypes = data.tank_types;
  } catch (e) {
    console.error('Error loading tank types:', e.message);
    reportError('loadTankTypes', e);
  }
}

/* ===== STANDARDIZED MODAL HANDLERS ===== */
function initStandardModals() {
  var btnPurpose = document.getElementById('btnPurposeHelp');
  var btnInstructions = document.getElementById('btnInstructionsHelp');
  var purposeModal = document.getElementById('purposeModal');
  var instructionsModal = document.getElementById('instructionsModal');

  if (btnPurpose && purposeModal) {
    btnPurpose.addEventListener('click', function () { openModal(purposeModal); });
  }

  if (btnInstructions && instructionsModal) {
    btnInstructions.addEventListener('click', function () { openModal(instructionsModal); });
  }

  document.querySelectorAll('.modal-backdrop').forEach(function (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal(modal);
    });

    var closeBtns = modal.querySelectorAll('[data-dismiss="modal"]');
    closeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { closeModal(modal); });
    });
  });

  document.addEventListener('keydown', function (e) {
    var activeModal = document.querySelector('.modal-backdrop.active');
    if (!activeModal) return;

    if (e.key === 'Escape') {
      closeModal(activeModal);
      return;
    }

    if (e.key === 'Tab') {
      trapFocus(activeModal, e);
    }
  });
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');

  var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length > 0) focusable[0].focus();
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

function trapFocus(modal, event) {
  var focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusables.length === 0) return;

  var first = focusables[0];
  var last = focusables[focusables.length - 1];

  if (event.shiftKey) {
    if (document.activeElement === first) {
      last.focus();
      event.preventDefault();
    }
  } else {
    if (document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }
}
