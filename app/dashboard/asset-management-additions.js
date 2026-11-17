// ═══════════════════════════════════════════════════════════════
// ADDITIONS TO asset-management.js
// Append this block to the END of the existing asset-management.js
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// COLUMN DRAG-AND-DROP REORDER (resize already exists)
// ═══════════════════════════════════════════════════════════════
var amColOrder = [];

function loadAmColOrder() {
  try {
    var saved = JSON.parse(localStorage.getItem('driven_am_col_order') || '[]');
    if (saved.length > 0) {
      var reordered = [];
      saved.forEach(function(key) {
        var found = COL_DEFS.find(function(c) { return c.key === key; });
        if (found) reordered.push(found);
      });
      COL_DEFS.forEach(function(c) {
        if (saved.indexOf(c.key) === -1) reordered.push(c);
      });
      COL_DEFS = reordered;
    }
  } catch(e) {}
}

function saveAmColOrder() {
  amColOrder = COL_DEFS.map(function(c) { return c.key; });
  try { localStorage.setItem('driven_am_col_order', JSON.stringify(amColOrder)); } catch(e) {}
}

function attachAmDragDrop() {
  var headers = document.querySelectorAll('#amTableHead th');
  var draggedKey = null;
  headers.forEach(function(th) {
    th.setAttribute('draggable', 'true');
    th.setAttribute('data-col-key', th.dataset.key);

    th.addEventListener('dragstart', function(e) {
      draggedKey = th.dataset.key;
      th.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    th.addEventListener('dragend', function() {
      th.classList.remove('dragging');
      document.querySelectorAll('#amTableHead th').forEach(function(h) { h.classList.remove('drag-over'); });
    });
    th.addEventListener('dragover', function(e) { e.preventDefault(); });
    th.addEventListener('dragenter', function() {
      if (!draggedKey || draggedKey === th.dataset.key) return;
      th.classList.add('drag-over');
    });
    th.addEventListener('dragleave', function() { th.classList.remove('drag-over'); });
    th.addEventListener('drop', function(e) {
      e.preventDefault();
      th.classList.remove('drag-over');
      var targetKey = th.dataset.key;
      if (!draggedKey || draggedKey === targetKey) return;
      var fromIdx = COL_DEFS.findIndex(function(c) { return c.key === draggedKey; });
      var toIdx = COL_DEFS.findIndex(function(c) { return c.key === targetKey; });
      if (fromIdx !== -1 && toIdx !== -1) {
        var moved = COL_DEFS.splice(fromIdx, 1)[0];
        COL_DEFS.splice(toIdx, 0, moved);
        saveAmColOrder();
        renderTableHead();
        renderAssetTable();
        attachAmDragDrop();
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// HELP CONTENT + MODAL SETUP
// ═══════════════════════════════════════════════════════════════
var helpContent = {
  'overview': { title: 'Overview — Purpose', body: 'View KPIs and a map of all company-owned assets. Click any status card to filter the asset list.' },
  'overview-instructions': { title: 'Overview — Instructions', body: '<ol><li>Click a KPI card to filter assets by status.</li><li>Use the map to see asset locations.</li><li>Switch to the Assets tab for the full list.</li></ol>' },
  'assets': { title: 'Assets — Purpose', body: 'View and manage all company-owned assets. Search, filter, sort, and edit asset records.' },
  'assets-instructions': { title: 'Assets — Instructions', body: '<ol><li><strong>Search:</strong> Type in the search box to filter.</li><li><strong>Filter:</strong> Use the multi-select dropdowns for Types, Statuses, Projects, Locations.</li><li><strong>Sort:</strong> Click any column header.</li><li><strong>Columns:</strong> Click ☰ to show/hide. Drag headers to reorder. Drag right edge to resize. Saved on this device.</li><li><strong>Edit:</strong> Click Edit to modify an asset.</li></ol>' },
  'addasset': { title: 'Quick Add Asset — Purpose', body: 'Add a single company-owned asset quickly. Enter the VIN to auto-populate specs from NHTSA vPIC.' },
  'addasset-instructions': { title: 'Quick Add Asset — Instructions', body: '<ol><li><strong>VIN Decode:</strong> Enter the 17-character VIN and click "Decode VIN". Specs auto-populate.</li><li><strong>Verify Decoded Data:</strong> Review all extracted information. Confirm make, model, year, fuel type, engine, and other specs are correct before proceeding.</li><li><strong>Company Fields:</strong> Fill in Asset Number, Category, Division, Assigned Operator, Status, Project, Location.</li><li><strong>DOT:</strong> Mark whether the vehicle is DOT-regulated.</li><li><strong>Save:</strong> Click "Add Asset".</li></ol>' },
  'bulkvin': { title: 'Bulk Add by VIN — Purpose', body: 'Add multiple company-owned assets at once by pasting VINs. Each is decoded via NHTSA vPIC.' },
  'bulkvin-instructions': { title: 'Bulk Add by VIN — Instructions', body: '<ol><li><strong>Paste VINs:</strong> Enter up to 500 VINs (one per line).</li><li><strong>Set Defaults:</strong> Choose default Location and Status.</li><li><strong>Decode:</strong> Click "Decode All VINs".</li><li><strong>Verify Decoded Data:</strong> Review the results table. Confirm all decoded information (make, model, year, fuel type) is correct for each vehicle before creating assets.</li><li><strong>Review Failures:</strong> Failed VINs shown in red.</li><li><strong>Create:</strong> Click "Create Assets".</li></ol>' },
  'location': { title: 'Location Map — Purpose', body: 'View all assets on a map. Switch between Forms view, Projects view, and Breadcrumb trails.' },
  'location-instructions': { title: 'Location Map — Instructions', body: '<ol><li><strong>Forms:</strong> Shows assets at their last reported location.</li><li><strong>Projects:</strong> Groups assets by project site.</li><li><strong>Breadcrumbs:</strong> Shows location history trail for a selected asset.</li><li>Click any pin for details, Street View, and asset details link.</li></ol>' }
};

function getTabKey() {
  var active = document.querySelector('.am-tab.active');
  return active ? active.getAttribute('data-tab') : 'overview';
}

function setupInfoModals() {
  var btnP = document.getElementById('btnTabPurpose');
  var btnI = document.getElementById('btnTabInstructions');
  if (btnP) {
    btnP.addEventListener('click', function() {
      var c = helpContent[getTabKey()];
      if (!c) return;
      var t = document.getElementById('amPurposeModalTitle');
      var b = document.getElementById('amPurposeModalBody');
      if (t) t.textContent = c.title;
      if (b) b.innerHTML = c.body;
      openModal('amPurposeModal');
    });
  }
  if (btnI) {
    btnI.addEventListener('click', function() {
      var c = helpContent[getTabKey() + '-instructions'];
      if (!c) return;
      var t = document.getElementById('amInstructionsModalTitle');
      var b = document.getElementById('amInstructionsModalBody');
      if (t) t.textContent = c.title;
      if (b) b.innerHTML = c.body;
      openModal('amInstructionsModal');
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// VIN DECODE (Single)
// ═══════════════════════════════════════════════════════════════
var decodedVinData = null;
var decodedRecalls = [];

async function decodeVin() {
  var vin = document.getElementById('amVinInput').value.trim();
  if (!vin) { showAddMessage('Please enter a VIN.', 'error'); return; }
  if (vin.length !== 17) { showAddMessage('VIN must be exactly 17 characters.', 'error'); return; }

  // ── Duplicate check: is this VIN already in the assets table? ──
  var existing = allAssets.find(function(a) {
    return a.serialNumber && a.serialNumber.toUpperCase() === vin;
  });
  if (existing) {
    showAddMessage('⚠ This VIN is already registered as asset "' + (existing.assetNumber || existing.type || 'unknown') + '". Duplicate entry prevented.', 'error');
    return;
  }

  var btn = document.getElementById('btnDecodeVin');
  if (btn) { btn.disabled = true; btn.textContent = 'Decoding...'; }
  try {
    // ── Correct endpoint: POST /api/vin-decode with JSON body ──
    var resp = await fetch('/api/vin-decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vin: vin })
    });
    var data = await resp.json();
    if (!resp.ok || !data.success) {
      showAddMessage(data.error || 'VIN decode failed. The NHTSA vPIC API may not recognize this VIN.', 'error');
      return;
    }
    decodedVinData = data.vehicle || {};
    decodedRecalls = data.recalls || [];
    var v = decodedVinData;
    if (v.make) document.getElementById('amMakeOem').value = v.make;
    if (v.model) document.getElementById('amModel').value = v.model;
    if (v.modelYear) document.getElementById('amYear').value = v.modelYear;
    if (v.fuelTypePrimary) document.getElementById('amFuelType').value = v.fuelTypePrimary;
    if (v.engineMake || v.engineModel) document.getElementById('amEngineMakeModel').value = [v.engineMake, v.engineModel].filter(Boolean).join(' ');
    if (v.transmissionStyle) document.getElementById('amTransType').value = v.transmissionStyle;
    if (v.driveType) document.getElementById('amDriveConfig').value = v.driveType;
    if (v.fuelTankCapacity) document.getElementById('amFuelTankCap').value = v.fuelTankCapacity;
    // Always set serial number to the VIN itself (uppercase)
    document.getElementById('amSerialNumber').value = vin.toUpperCase();
    var result = document.getElementById('vinDecodeResult');
    if (result) {
      result.style.display = 'block';
      result.innerHTML = '✓ VIN decoded — fields auto-populated. <strong>Please verify all extracted information is correct before saving.</strong>';
    }
    var recallResult = document.getElementById('vinRecallsResult');
    if (recallResult) {
      if (decodedRecalls.length > 0) {
        recallResult.style.display = 'block';
        var html = '<strong>⚠ ' + decodedRecalls.length + ' open recall' + (decodedRecalls.length === 1 ? '' : 's') + ' found for this VIN:</strong>';
        html += '<ul style="margin:6px 0 0 18px;font-size:12px;">';
        decodedRecalls.forEach(function(r) {
          html += '<li>' + escapeHtml(r.component || 'Unknown component') + ' — NHTSA #' + escapeHtml(r.nhtsaRecallNumber || 'N/A') + '</li>';
        });
        html += '</ul>';
        recallResult.innerHTML = html;
      } else {
        recallResult.style.display = 'none';
      }
    }
    showAddMessage('VIN decoded successfully. Please verify all extracted information is correct.', 'success');
  } catch(e) {
    showAddMessage('VIN decode error: ' + e.message, 'error');
    if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report('asset-management: VIN decode failed — ' + e.message, 'decodeVin', e.stack);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Decode VIN'; }
  }
}

function showAddMessage(msg, type) {
  var el = document.getElementById('amAddMessage');
  if (!el) el = document.getElementById('amMessage');
  if (!el) return;
  el.textContent = msg;
  el.className = 'am-message ' + type;
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 6000);
}

// ═══════════════════════════════════════════════════════════════
// BULK VIN DECODE + ASSET CREATION
// ═══════════════════════════════════════════════════════════════
var bulkDecodeResults = [];

async function bulkDecodeVINs() {
  var input = document.getElementById('bulkVinInput').value.trim();
  if (!input) { showAddMessage('Please paste at least one VIN.', 'error'); return; }
  var vins = input.split(/[\n,;]/).map(function(v) { return v.trim(); }).filter(function(v) { return v.length > 0; });
  if (vins.length === 0) { showAddMessage('No VINs found.', 'error'); return; }
  if (vins.length > 500) { showAddMessage('Maximum 500 VINs per batch.', 'error'); return; }
  var btn = document.getElementById('btnBulkDecode');
  if (btn) { btn.disabled = true; btn.textContent = 'Decoding ' + vins.length + ' VINs...'; }
  try {
    var resp = await fetch('/api/vin-decode/batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vins: vins, createAssets: false })
    });
    var data = await resp.json();
    if (!data.success) { showAddMessage(data.error || 'Batch decode failed.', 'error'); return; }
    bulkDecodeResults = data.results || [];
    var tbody = document.getElementById('bulkResultsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var sc = 0, fc = 0, rc = 0;
    bulkDecodeResults.forEach(function(r) {
      var tr = document.createElement('tr');
      if (!r.success) {
        fc++;
        tr.innerHTML = '<td style="font-family:monospace;">' + escapeHtml(r.vin) + '</td><td colspan="5" style="color:#dc2626;">' + escapeHtml(r.error || 'Failed') + '</td><td style="color:#dc2626;font-weight:600;">✗ Failed</td>';
      } else {
        sc++;
        if (r.recallCount > 0) rc++;
        var v = r.vehicle;
        tr.innerHTML = '<td style="font-family:monospace;">' + escapeHtml(r.vin) + '</td><td>' + escapeHtml(v.make || '') + '</td><td>' + escapeHtml(v.model || '') + '</td><td>' + escapeHtml(v.modelYear || '') + '</td><td>' + escapeHtml(v.fuelTypePrimary || '') + '</td><td>' + (r.recallCount > 0 ? '<span style="color:#dc2626;font-weight:600;">' + r.recallCount + ' open</span>' : 'None') + '</td><td style="color:#16a34a;font-weight:600;">✓ Decoded</td>';
      }
      tbody.appendChild(tr);
    });
    var summary = document.getElementById('bulkSummary');
    if (summary) summary.innerHTML = '<span style="color:#16a34a;">' + sc + ' decoded</span> · <span style="color:#dc2626;">' + fc + ' failed</span>' + (rc > 0 ? ' · <span style="color:#dc2626;">' + rc + ' with recalls</span>' : '');
    var section = document.getElementById('bulkResultsSection');
    if (section) section.style.display = 'block';
    var countEl = document.getElementById('bulkCreateCount');
    if (countEl) countEl.textContent = sc;
    bulkDecodeResults._defaultLocation = document.getElementById('bulkLocation') ? document.getElementById('bulkLocation').value : '';
    bulkDecodeResults._defaultStatus = document.getElementById('bulkStatus') ? document.getElementById('bulkStatus').value : 'Active';
  } catch(e) {
    showAddMessage('Batch decode error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Decode All VINs'; }
  }
}

async function createBulkAssets() {
  var successResults = bulkDecodeResults.filter(function(r) { return r.success; });
  if (successResults.length === 0) { showAddMessage('No decoded VINs to create.', 'error'); return; }
  var btn = document.getElementById('btnBulkCreate');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating ' + successResults.length + ' assets...'; }
  try {
    var resp = await fetch('/api/vin-decode/batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vins: successResults.map(function(r) { return r.vin; }),
        createAssets: true,
        defaults: { location: bulkDecodeResults._defaultLocation || null, status: bulkDecodeResults._defaultStatus || 'Active' }
      })
    });
    var data = await resp.json();
    if (!data.success) { showAddMessage('Asset creation failed: ' + (data.error || 'Unknown error'), 'error'); return; }
    showAddMessage(data.assetsCreated + ' assets created successfully. ' + (successResults.length - data.assetsCreated) + ' failed.', 'success');
    var input = document.getElementById('bulkVinInput');
    if (input) input.value = '';
    var section = document.getElementById('bulkResultsSection');
    if (section) section.style.display = 'none';
    bulkDecodeResults = [];
    await loadAssets();
    switchTab('assets');
  } catch(e) {
    showAddMessage('Asset creation error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create ' + successResults.length + ' Assets'; }
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCHES TO EXISTING FUNCTIONS
// ═══════════════════════════════════════════════════════════════
// The following overrides should be placed AFTER the original
// function definitions. JavaScript allows redefining functions.

console.log('[AM-Additions] Loading asset-management-additions.js...');

// Patch addAsset to include D1 default overrides + dot_regulated
if (typeof addAsset === 'function') {
var _originalAddAsset = addAsset;
addAsset = async function() {
  // Call the original function but intercept the payload
  // We need to add D1 default overrides before the fetch call
  // Since we can't easily intercept, we'll add a pre-send hook
  var originalFetch = window.fetch;
  window.fetch = async function(url, opts) {
    if (url === '/api/Equipment' && opts && opts.method === 'POST') {
      try {
        var body = JSON.parse(opts.body);
        // Add D1 default overrides
        body.tire_psi_steer = null;
        body.tire_psi_drive = null;
        body.handrails_steps = null;
        // Add dot_regulated
        var dotEl = document.getElementById('amDotRegulated');
        if (dotEl) body.dot_regulated = dotEl.value === '1' ? '1' : '0';
        // Add VIN-decoded fields if available
        if (decodedVinData) {
          var v = decodedVinData;
          if (v.make && !body.make_oem) body.make_oem = v.make;
          if (v.model && !body.model) body.model = v.model;
          if (v.modelYear && !body.year) body.year = v.modelYear;
          if (v.fuelTypePrimary && !body.fuel_type) body.fuel_type = v.fuelTypePrimary;
          if (v.engineMake && !body.engine_make_model) body.engine_make_model = (v.engineMake || '') + (v.engineModel ? ' ' + v.engineModel : '');
          if (v.transmissionStyle && !body.trans_type) body.trans_type = v.transmissionStyle;
          if (v.driveType && !body.drive_configuration) body.drive_configuration = v.driveType;
          if (v.fuelTankCapacity && !body.fuel_tank_capacity) body.fuel_tank_capacity = v.fuelTankCapacity;
        }
        var snEl = document.getElementById('amSerialNumber');
        if (snEl && snEl.value.trim()) body.serial_number = snEl.value.trim();
        opts.body = JSON.stringify(body);
      } catch(e) {}
    }
    var result = await originalFetch.apply(this, arguments);
    window.fetch = originalFetch;
    return result;
  };
  return _originalAddAsset.apply(this, arguments);
};
} // end if typeof addAsset

// Patch renderTableHead to call attachAmDragDrop after rendering
if (typeof renderTableHead === 'function') {
var _originalRenderTableHead = renderTableHead;
renderTableHead = function() {
  _originalRenderTableHead.apply(this, arguments);
  attachAmDragDrop();
};
} // end if

// ═══════════════════════════════════════════════════════════════
// KPI FIX — robust updater that works regardless of element IDs
// Scans allAssets and updates any element whose ID contains "Kpi" + status name
// ═══════════════════════════════════════════════════════════════
function updateKpiFix() {
  if (!allAssets || allAssets.length === 0) return;
  var counts = { total: allAssets.length };
  allAssets.forEach(function(a) {
    var s = (a.status || 'Unknown').toLowerCase();
    counts[s] = (counts[s] || 0) + 1;
  });
  // Convert status key to camelCase: "in use" → "InUse"
  function toCamel(s) {
    return s.split(/\s+/).map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join('');
  }
  // Try every possible KPI element ID pattern
  var patterns = [
    function(s) { return 'amKpi' + toCamel(s); },
    function(s) { return 'kpi' + toCamel(s); },
    function(s) { return 'am-kpi-' + s.replace(/\s+/g, '-'); },
    function(s) { return 'kpi-' + s.replace(/\s+/g, '-'); }
  ];
  Object.keys(counts).forEach(function(key) {
    for (var p = 0; p < patterns.length; p++) {
      var el = document.getElementById(patterns[p](key));
      if (el) { el.textContent = counts[key]; break; }
    }
  });
}

// Patch renderAssetTable to also update KPIs
if (typeof renderAssetTable === 'function') {
var _originalRenderAssetTable = renderAssetTable;
renderAssetTable = function() {
  _originalRenderAssetTable.apply(this, arguments);
  updateKpiFix();
};
} // end if

// ═══════════════════════════════════════════════════════════════
// MAP FIX — ensure Leaflet loads and map initializes
// ═══════════════════════════════════════════════════════════════
function ensureLeaflet(callback) {
  if (typeof L !== 'undefined') { callback(); return; }
  // Try loading from unpkg
  var script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = callback;
  script.onerror = function() {
    // Fallback: try cdnjs
    var alt = document.createElement('script');
    alt.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
    alt.onload = callback;
    alt.onerror = function() {
      console.error('Could not load Leaflet from any CDN');
    };
    document.head.appendChild(alt);
  };
  document.head.appendChild(script);
}

// Patch switchTab to ensure Leaflet + map init for location tab
if (typeof switchTab === 'function') {
var _originalSwitchTab = switchTab;
switchTab = function(tab) {
  // Close any open modals when switching tabs
  var modals = document.querySelectorAll('.info-modal-backdrop.active, .am-modal-backdrop.active');
  modals.forEach(function(m) { m.classList.remove('active'); });
  _originalSwitchTab.apply(this, arguments);
  if (tab === 'location' || tab === 'overview') {
    ensureLeaflet(function() {
      setTimeout(function() {
        var container = document.getElementById('amAssetMap');
        if (!container) {
          console.error('Map container #amAssetMap not found');
          return;
        }
        // Ensure container has height
        if (container.offsetHeight === 0) {
          container.style.height = '500px';
        }
        if (typeof initAssetMap === 'function') {
          if (!amMapInstance) {
            console.log('Initializing asset map...');
            initAssetMap();
            setTimeout(function() {
              if (amMapInstance) {
                amMapInstance.invalidateSize();
                console.log('Map initialized and sized');
                // Try to render pins
                if (typeof renderAssetMapPins === 'function') {
                  renderAssetMapPins();
                }
              } else {
                console.warn('initAssetMap did not create amMapInstance — creating fallback map');
                createFallbackMap(container);
              }
            }, 300);
          } else {
            amMapInstance.invalidateSize();
            if (typeof renderAssetMapPins === 'function') renderAssetMapPins();
            console.log('Map resized and pins refreshed');
          }
        } else {
          console.warn('initAssetMap not found — creating fallback map');
          createFallbackMap(container);
        }
      }, 300);
    });
  }
};
} // end if typeof switchTab

// Fallback map: creates a basic Leaflet map with markers from allAssets
function createFallbackMap(container) {
  if (typeof L === 'undefined') {
    console.error('Leaflet not loaded — cannot create map');
    return;
  }
  if (amMapInstance) {
    amMapInstance.remove();
    amMapInstance = null;
  }
  amMapInstance = L.map(container).setView([39.5, -98.35], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  }).addTo(amMapInstance);
  if (typeof L.markerClusterGroup === 'function') {
    amClusterGroup = L.markerClusterGroup();
    amMapInstance.addLayer(amClusterGroup);
  } else {
    amClusterGroup = L.layerGroup();
    amMapInstance.addLayer(amClusterGroup);
  }
  // Add markers for assets with GPS
  var bounds = [];
  allAssets.forEach(function(a) {
    var lat = parseFloat(a.latitude || a.gpsLat || a.lat);
    var lng = parseFloat(a.longitude || a.gpsLng || a.lng || a.lon);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      var marker = L.marker([lat, lng]);
      var popup = '<div class="am-map-popup"><h4>' + escapeHtml(a.assetNumber || a.type || 'Asset') + '</h4>';
      if (a.status) popup += '<p>' + escapeHtml(a.status) + '</p>';
      if (a.location) popup += '<p class="popup-meta">' + escapeHtml(a.location) + '</p>';
      popup += '</div>';
      marker.bindPopup(popup);
      if (amClusterGroup) amClusterGroup.addLayer(marker);
      bounds.push([lat, lng]);
    }
  });
  if (bounds.length > 0) {
    amMapInstance.fitBounds(bounds, { padding: [50, 50] });
  }
  setTimeout(function() { amMapInstance.invalidateSize(); }, 200);
  console.log('Fallback map created with', bounds.length, 'markers');
}

// ═══════════════════════════════════════════════════════════════
// CLEAR ADD FORM
// ═══════════════════════════════════════════════════════════════
function clearAddForm() {
  var fields = ['amAssetNumber','amAssetType','amIsAttachment','amAllowedCategory','amVinInput',
    'amSerialNumber','amMakeOem','amModel','amYear','amFuelType','amEngineMakeModel',
    'amTransType','amDriveConfig','amFuelTankCap','amMeter','amStatus','amProject',
    'amLocation','amDivision','amAssignedOperator','amDotRegulated'];
  fields.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
  var result = document.getElementById('vinDecodeResult');
  if (result) result.style.display = 'none';
  var recalls = document.getElementById('vinRecallsResult');
  if (recalls) recalls.style.display = 'none';
  decodedVinData = null;
  decodedRecalls = [];
  showAddMessage('Form cleared.', 'success');
  setTimeout(function() {
    var m = document.getElementById('amAddMessage');
    if (m) m.style.display = 'none';
  }, 2000);
}

// ═══════════════════════════════════════════════════════════════
// HEADER CLEANUP — remove duplicate header rows (row2/row3/utility)
// ═══════════════════════════════════════════════════════════════
function cleanDuplicateHeader() {
  var header = document.getElementById('dashHeader');
  if (!header) return;
  // Log the header structure for debugging
  var children = header.children;
  console.log('[AM-Additions] Header has', children.length, 'children');
  for (var i = 0; i < children.length; i++) {
    console.log('[AM-Additions] Header child', i, ':', children[i].tagName, children[i].className || '(no class)', '"' + children[i].textContent.substring(0, 60).trim() + '"');
  }
  // Remove known duplicate row classes
  var toRemove = header.querySelectorAll('.dash-header-row2, .dash-header-row3, .dash-utility-bar');
  toRemove.forEach(function(el) { el.remove(); });
  // Also remove any child divs after the first one that contain a heading
  children = header.children;
  if (children.length > 1) {
    for (var i = 1; i < children.length; i++) {
      var child = children[i];
      if (child.className && (child.className.indexOf('logo') !== -1 || child.className.indexOf('nav') !== -1)) continue;
      var heading = child.querySelector('h1, h2, h3, .dash-title, .page-title, .dash-header-title, .dash-page-title');
      if (heading || (child.className && child.className.indexOf('row') !== -1)) {
        console.log('[AM-Additions] Removing duplicate header child:', child.className || '(no class)');
        child.remove();
        i--;
      }
    }
  }
  console.log('[AM-Additions] Header cleanup complete, children remaining:', header.children.length);
}

// Watch for service worker injecting stale header rows
if (typeof MutationObserver !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    var header = document.getElementById('dashHeader');
    if (header) {
      var observer = new MutationObserver(function() {
        cleanDuplicateHeader();
      });
      observer.observe(header, { childList: true, subtree: true });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// SET MAP MODE — always override with our enhanced version
// (main JS version may exist but doesn't handle projects/breadcrumb)
// ═══════════════════════════════════════════════════════════════
var _originalSetMapMode = (typeof setMapMode === 'function') ? setMapMode : null;
window.setMapMode = function(mode) {
  console.log('[AM-Additions] setMapMode:', mode);
  mapMode = mode;
    var formsBtn = document.getElementById('amMapModeForms');
    var projBtn = document.getElementById('amMapModeProjects');
    var bcBtn = document.getElementById('amMapModeBreadcrumb');
    var bcSelect = document.getElementById('amBreadcrumbAssetSelect');
    var bcRange = document.getElementById('amBreadcrumbDateRange');
    if (formsBtn) formsBtn.classList.remove('active');
    if (projBtn) projBtn.classList.remove('active');
    if (bcBtn) bcBtn.classList.remove('active');
    if (bcSelect) bcSelect.style.display = 'none';
    if (bcRange) bcRange.style.display = 'none';

    if (mode === 'forms' && formsBtn) {
      formsBtn.classList.add('active');
      renderFormsView();
    } else if (mode === 'projects' && projBtn) {
      projBtn.classList.add('active');
      renderProjectsView();
    } else if (mode === 'breadcrumb' && bcBtn) {
      bcBtn.classList.add('active');
      var bcYear = document.getElementById('amBreadcrumbYear');
      if (bcSelect) {
        bcSelect.style.display = 'inline-block';
        bcSelect.innerHTML = '<option value="">— Select Asset —</option>';
        allAssets.forEach(function(a) {
          var opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = a.assetNumber || a.type || 'Asset ' + a.id;
          bcSelect.appendChild(opt);
        });
        bcSelect.onchange = function() { renderBreadcrumbTrail(); };
      }
      if (bcYear) {
        bcYear.style.display = 'inline-block';
        // Populate years dynamically from current year back to 2020
        var currentYear = new Date().getFullYear();
        bcYear.innerHTML = '';
        for (var y = currentYear; y >= 2020; y--) {
          var opt = document.createElement('option');
          opt.value = String(y);
          opt.textContent = String(y);
          bcYear.appendChild(opt);
        }
        bcYear.value = String(currentYear);
        bcYear.onchange = function() {
          updateDaysFilterVisibility();
          renderBreadcrumbTrail();
        };
      }
      if (bcRange) {
        bcRange.onchange = function() { renderBreadcrumbTrail(); };
      }
      updateDaysFilterVisibility();
      if (bcSelect.value) renderBreadcrumbTrail();
    }
  };
  console.log('[AM-Additions] setMapMode override installed');

// ── Geocode helper using Nominatim (free OpenStreetMap geocoder) ──
// No country restriction — customers may operate in US, Canada, Mexico, and US territories
var geocodeCache = {};
function geocodeAddress(address) {
  return new Promise(function(resolve) {
    if (!address || address.trim().length < 5) { resolve(null); return; }
    if (geocodeCache[address]) { resolve(geocodeCache[address]); return; }
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(address) + '&limit=1', {
      headers: { 'Accept': 'application/json' }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.length > 0) {
        var coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        geocodeCache[address] = coords;
        resolve(coords);
      } else {
        resolve(null);
      }
    })
    .catch(function() { resolve(null); });
  });
}

// ── Forms View: show assets at their GPS coordinates ──
function renderFormsView() {
  if (!amMapInstance) return;
  if (amClusterGroup) amClusterGroup.clearLayers();
  var bounds = [];
  allAssets.forEach(function(a) {
    var lat = parseFloat(a.formLat || a.baseLat || a.lat || a.latitude);
    var lng = parseFloat(a.formLng || a.baseLng || a.lng || a.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      var marker = L.marker([lat, lng]);
      marker.bindPopup('<div class="am-map-popup"><h4>' + escapeHtml(a.assetNumber || a.type || 'Asset') + '</h4><p>' + escapeHtml(a.status || '') + '</p><p class="popup-meta">' + escapeHtml(a.formLocation || a.baseLocation || a.location || '') + '</p></div>');
      amClusterGroup.addLayer(marker);
      bounds.push([lat, lng]);
    }
  });
  if (bounds.length > 0) amMapInstance.fitBounds(bounds, { padding: [50, 50] });
  else amMapInstance.setView([39.5, -98.35], 4);
}

// ── Projects View: fetch projects, geocode addresses, place markers ──
function renderProjectsView() {
  if (!amMapInstance) return;
  if (amClusterGroup) amClusterGroup.clearLayers();
  amMapInstance.setView([39.5, -98.35], 4);

  fetch('/api/projects')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var projects = data.projects || data.records || data || [];
      if (!Array.isArray(projects)) projects = [];
      console.log('[AM-Additions] Projects fetched:', projects.length);
      if (projects.length === 0) {
        var note = L.popup().setLatLng([39.5, -98.35]).setContent('<div class="am-map-popup"><p>No projects found.</p></div>').openOn(amMapInstance);
        return;
      }
      var bounds = [];
      var pending = 0;
      projects.forEach(function(p) {
        var addr = p.location || p.address || p.city || '';
        if (!addr) return;
        pending++;
        geocodeAddress(addr).then(function(coords) {
          pending--;
          if (coords) {
            var marker = L.marker([coords.lat, coords.lng]);
            marker.bindPopup('<div class="am-map-popup"><h4>' + escapeHtml(p.name || 'Project') + '</h4><p class="popup-meta">' + escapeHtml(p.code || '') + '</p><p>' + escapeHtml(addr) + '</p></div>');
            amClusterGroup.addLayer(marker);
            bounds.push([coords.lat, coords.lng]);
          }
          if (pending === 0 && bounds.length > 0) {
            amMapInstance.fitBounds(bounds, { padding: [50, 50] });
          }
        });
      });
    })
    .catch(function(e) { console.error('[AM-Additions] Projects fetch error:', e); });
}

// Show/hide the days filter based on selected year (only current year shows days)
function updateDaysFilterVisibility() {
  var bcYear = document.getElementById('amBreadcrumbYear');
  var bcRange = document.getElementById('amBreadcrumbDateRange');
  if (!bcYear || !bcRange) return;
  var currentYear = new Date().getFullYear();
  if (parseInt(bcYear.value) === currentYear) {
    bcRange.style.display = 'inline-block';
  } else {
    bcRange.style.display = 'none';
  }
}

// ── Breadcrumb Trail: fetch ALL activity for asset, show color-coded pins ──
// Pin types: fuel (green), form entry (blue), inspection (orange), work order (red), PM (purple)
var PIN_COLORS = {
  fuel: '#16a34a',
  form: '#2563eb',
  inspection: '#ea580c',
  workorder: '#dc2626',
  pm: '#7c3aed'
};

function createPinIcon(color) {
  return L.divIcon({
    className: 'am-bc-pin',
    html: '<div style="width:16px;height:16px;background:' + color + ';border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function addMapLegend() {
  if (!amMapInstance) return;
  if (window._bcLegend) { amMapInstance.removeControl(window._bcLegend); }
  var legend = L.control({ position: 'bottomright' });
  legend.onAdd = function() {
    var div = L.DomUtil.create('div', 'am-map-legend');
    div.style.cssText = 'background:rgba(255,255,255,0.95);padding:10px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-size:12px;line-height:1.8;';
    var types = [
      ['fuel', 'Fuel Purchase'],
      ['form', 'Form Entry'],
      ['inspection', 'Inspection'],
      ['workorder', 'Work Order'],
      ['pm', 'PM / Maintenance']
    ];
    var html = '<div style="font-weight:700;margin-bottom:4px;font-size:13px;">Activity Types</div>';
    types.forEach(function(t) {
      html += '<div style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;background:' + PIN_COLORS[t[0]] + ';border:1px solid #fff;border-radius:50%;display:inline-block;box-shadow:0 1px 2px rgba(0,0,0,0.3);"></span>' + t[1] + '</div>';
    });
    div.innerHTML = html;
    return div;
  };
  legend.addTo(amMapInstance);
  window._bcLegend = legend;
}

function renderBreadcrumbTrail() {
  if (!amMapInstance) return;
  if (amClusterGroup) amClusterGroup.clearLayers();
  if (window._breadcrumbLine) { amMapInstance.removeLayer(window._breadcrumbLine); window._breadcrumbLine = null; }
  if (window._bcLegend) { amMapInstance.removeControl(window._bcLegend); window._bcLegend = null; }

  var bcSelect = document.getElementById('amBreadcrumbAssetSelect');
  var bcRange = document.getElementById('amBreadcrumbDateRange');
  var bcYear = document.getElementById('amBreadcrumbYear');
  var assetId = bcSelect ? bcSelect.value : '';
  if (!assetId) { amMapInstance.setView([39.5, -98.35], 4); return; }

  addMapLegend();

  // Build date filter: year always, days only if current year
  var selectedYear = bcYear ? parseInt(bcYear.value) : new Date().getFullYear();
  var currentYear = new Date().getFullYear();
  var dateFilter = '&year=' + selectedYear;
  if (selectedYear === currentYear && bcRange) {
    if (bcRange.value === 'today') dateFilter += '&days=1';
    else if (bcRange.value === '7days') dateFilter += '&days=7';
    else if (bcRange.value === '30days') dateFilter += '&days=30';
    else if (bcRange.value === '90days') dateFilter += '&days=90';
    // 'ytd' = Year to Date — just pass year, no days filter
  }

  // Collect ALL activity points from multiple sources
  var allPoints = [];
  var sourcesFetched = 0;
  var sourcesTotal = 0;

  // Helper: try an endpoint, extract items, add as pin type
  function fetchActivity(url, pinType, label, addrField) {
    sourcesTotal++;
    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var items = data.records || data.results || data.data || data;
        if (!Array.isArray(items)) items = [];
        console.log('[AM-Additions] ' + label + ' fetched:', items.length);
        items.forEach(function(item) {
          var lat = parseFloat(item.latitude || item.lat || item.gps_lat || item.formLat);
          var lng = parseFloat(item.longitude || item.lng || item.gps_lng || item.lon || item.formLng);
          var date = item.transaction_date || item.purchase_date || item.created_at || item.submitted_at || item.date || '';
          var addr = item[addrField] || item.location || item.vendor_address || item.address || '';
          if (item.vendor_city) addr += (addr ? ', ' : '') + item.vendor_city;
          if (item.vendor_state) addr += ', ' + item.vendor_state;

          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            allPoints.push({ lat: lat, lng: lng, type: pinType, label: label, date: date, addr: addr, hasGPS: true });
          } else if (addr && addr.trim().length >= 5) {
            // Needs geocoding
            geocodeAddress(addr).then(function(coords) {
              if (coords) {
                allPoints.push({ lat: coords.lat, lng: coords.lng, type: pinType, label: label, date: date, addr: addr, hasGPS: false });
                checkAllDone();
              }
            });
          }
        });
        sourcesFetched++;
        checkAllDone();
      })
      .catch(function(e) {
        console.log('[AM-Additions] ' + label + ' endpoint not available:', url);
        sourcesFetched++;
        checkAllDone();
      });
  }

  function checkAllDone() {
    if (sourcesFetched >= sourcesTotal) {
      // Sort chronologically
      allPoints.sort(function(a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      });
      drawActivityPins(allPoints);
    }
  }

  // Fetch from all known endpoints (gracefully skips any that don't exist)
  fetchActivity('/api/fuel-purchases?asset_id=' + encodeURIComponent(assetId) + dateFilter, 'fuel', 'Fuel Purchase', 'vendor_address');
  fetchActivity('/api/fuel-transactions?asset_id=' + encodeURIComponent(assetId) + dateFilter, 'fuel', 'Fuel Transaction', 'location');
  fetchActivity('/api/forms?asset_id=' + encodeURIComponent(assetId) + dateFilter, 'form', 'Form Entry', 'location');
  fetchActivity('/api/inspections?asset_id=' + encodeURIComponent(assetId) + dateFilter, 'inspection', 'Inspection', 'location');
  fetchActivity('/api/work-orders?asset_id=' + encodeURIComponent(assetId) + dateFilter, 'workorder', 'Work Order', 'location');
  fetchActivity('/api/maintenance?asset_id=' + encodeURIComponent(assetId) + dateFilter, 'pm', 'PM', 'location');
}

function drawActivityPins(points) {
  if (!amMapInstance || !amClusterGroup) return;
  if (amClusterGroup) amClusterGroup.clearLayers();
  if (window._breadcrumbLine) { amMapInstance.removeLayer(window._breadcrumbLine); window._breadcrumbLine = null; }

  var trailCoords = [];
  points.forEach(function(p) {
    var icon = createPinIcon(PIN_COLORS[p.type] || '#666');
    var marker = L.marker([p.lat, p.lng], { icon: icon });
    var popupHtml = '<div class="am-map-popup"><h4>' + escapeHtml(p.label) + '</h4>';
    if (p.addr) popupHtml += '<p>' + escapeHtml(p.addr) + '</p>';
    if (!p.hasGPS) popupHtml += '<p class="popup-meta">(geocoded from address)</p>';
    if (p.date) popupHtml += '<p class="popup-meta">' + escapeHtml(p.date) + '</p>';
    popupHtml += '</div>';
    marker.bindPopup(popupHtml);
    amClusterGroup.addLayer(marker);
    trailCoords.push([p.lat, p.lng]);
  });

  // Draw dashed trail line connecting all points chronologically
  if (trailCoords.length > 1) {
    window._breadcrumbLine = L.polyline(trailCoords, { color: '#475569', weight: 2, opacity: 0.6, dashArray: '6,8' }).addTo(amMapInstance);
    amMapInstance.fitBounds(window._breadcrumbLine.getBounds(), { padding: [50, 50] });
  } else if (trailCoords.length === 1) {
    amMapInstance.setView(trailCoords[0], 13);
  } else {
    amMapInstance.setView([39.5, -98.35], 4);
    console.log('[AM-Additions] No activity points found for this asset');
  }
  console.log('[AM-Additions] Drew', points.length, 'activity pins');
}

// Patch the dashSessionLoaded handler to call loadAmColOrder + setupInfoModals + KPI fix + header cleanup
document.addEventListener('dashSessionLoaded', function() {
  setTimeout(function() {
    cleanDuplicateHeader();
    populateWelcomeCard();
    loadAmColOrder();
    setupInfoModals();
    renderTableHead();
    renderAssetTable();
    updateKpiFix();
  }, 500);
  setTimeout(function() {
    cleanDuplicateHeader();
    populateWelcomeCard();
  }, 2000);
}, true);

console.log('[AM-Additions] Fully loaded — all patches and fixes applied');

// ═══════════════════════════════════════════════════════════════
// WELCOME CARD FALLBACK — populate if dashboard-common.js doesn't
// ═══════════════════════════════════════════════════════════════
function populateWelcomeCard() {
  var nameEl = document.getElementById('welcome-name');
  if (!nameEl) return;
  // Check if already populated by dashboard-common.js
  if (nameEl.textContent && nameEl.textContent !== 'Welcome back' && nameEl.textContent.indexOf('Welcome back') === -1) return;
  if (nameEl.textContent && nameEl.textContent.trim().length > 15) return;

  // Try to get user data from localStorage or global variables
  var userData = null;
  try { userData = JSON.parse(localStorage.getItem('driven_user') || '{}'); } catch(e) {}
  if (!userData || !userData.name) {
    try { userData = JSON.parse(localStorage.getItem('driven_session') || '{}'); } catch(e) {}
  }
  if (!userData || !userData.name) {
    try { userData = JSON.parse(localStorage.getItem('driven_auth') || '{}'); } catch(e) {}
  }

  // Try global variables that dashboard-common.js might set
  if (!userData || !userData.name) {
    if (typeof currentUser !== 'undefined' && currentUser) userData = currentUser;
    else if (typeof sessionUser !== 'undefined' && sessionUser) userData = sessionUser;
    else if (typeof userInfo !== 'undefined' && userInfo) userData = userInfo;
  }

  if (userData && userData.name) {
    nameEl.textContent = 'Welcome back, ' + userData.name;
    var roleEl = document.getElementById('welcome-role');
    if (roleEl && userData.role) roleEl.textContent = userData.role;
    var emailEl = document.getElementById('welcome-email');
    if (emailEl && userData.email) emailEl.textContent = userData.email;
    console.log('[AM-Additions] Welcome card populated from fallback:', userData.name);
  } else {
    // Try fetching from auth API
    fetch('/auth/get-session')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.user) {
          var u = data.user;
          nameEl.textContent = 'Welcome back, ' + (u.name || u.displayName || u.email || 'User');
          var roleEl = document.getElementById('welcome-role');
          if (roleEl && u.role) roleEl.textContent = u.role;
          var emailEl = document.getElementById('welcome-email');
          if (emailEl && u.email) emailEl.textContent = u.email;
          console.log('[AM-Additions] Welcome card populated from API:', u.name || u.email);
        }
      })
      .catch(function(e) {
        console.log('[AM-Additions] Could not populate welcome card:', e.message);
      });
  }
}
