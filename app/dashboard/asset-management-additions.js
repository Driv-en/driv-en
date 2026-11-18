// ═══════════════════════════════════════════════════════════════
// ADDITIONS TO asset-management.js
// Append this block to the END of the existing asset-management.js
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// STREET VIEW — opens modal with Google Street View iframe + adjust map
// ═══════════════════════════════════════════════════════════════
var _svAdjustMap = null;
var _svAdjustMarker = null;

function openStreetView(lat, lng, label) {
  var modal = document.getElementById('amStreetViewModal');
  if (!modal) { console.warn('[AM] Street View modal not found in DOM'); return; }

  var titleEl = document.getElementById('streetViewAssetTitle');
  var coordEl = document.getElementById('streetViewCoordDisplay');
  var frame = document.getElementById('streetViewFrame');

  if (titleEl) titleEl.textContent = label || 'Street View';
  if (coordEl) coordEl.textContent = lat.toFixed(6) + ', ' + lng.toFixed(6);

  // Load Street View in iframe (no API key needed — uses Google Maps embed)
  if (frame) {
    frame.src = 'https://maps.google.com/maps?q=&layer=c&cbll=' + lat + ',' + lng + '&cbp=0,0,0,0,0&output=svembed';
  }

  // Open modal
  modal.classList.add('active', 'show');
  modal.style.display = 'flex';

  // Set up adjust map with draggable pin
  var adjustDiv = document.getElementById('streetViewAdjustMap');
  if (adjustDiv) {
    if (_svAdjustMap) { try { _svAdjustMap.remove(); } catch(e) {} _svAdjustMap = null; }
    setTimeout(function() {
      _svAdjustMap = L.map('streetViewAdjustMap').setView([lat, lng], 17);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19
      }).addTo(_svAdjustMap);

      _svAdjustMarker = L.marker([lat, lng], { draggable: true }).addTo(_svAdjustMap);
      _svAdjustMarker.on('dragend', function(e) {
        var pos = e.target.getLatLng();
        if (coordEl) coordEl.textContent = pos.lat.toFixed(6) + ', ' + pos.lng.toFixed(6);
        if (frame) {
          frame.src = 'https://maps.google.com/maps?q=&layer=c&cbll=' + pos.lat + ',' + pos.lng + '&cbp=0,0,0,0,0&output=svembed';
        }
      });
      setTimeout(function() { _svAdjustMap.invalidateSize(); }, 200);
    }, 150);
  }
}

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
  'location': { title: 'Location Map — Purpose', body: 'View all assets on a single map. Use the asset filter dropdown to switch between viewing all assets at once or a single asset\'s location history trail. The instructions below are specific to the current view and will change when you switch — check back as needed.' },
  'location-instructions': { title: 'Location Map — Instructions', body: '<p style="margin-bottom:8px;">Use the <strong>asset filter dropdown</strong> above the map to choose what to view. Instructions below change based on your selection.</p><ol><li><strong>All Assets (default):</strong> Shows every asset at its last reported GPS location, color-coded by activity type.</li><li><strong>Specific Asset:</strong> Shows the location history trail for the selected asset. Time filter controls (year, date range, form entry locations) appear when an asset is selected.</li><li>Click any pin for details and Street View.</li></ol>' },
  'location-forms': { title: 'Location Map — All Assets View — Purpose', body: 'Shows every asset at its last reported GPS location from fuel transactions and form submissions. Pins are color-coded by activity type.' },
  'location-forms-instructions': { title: 'Location Map — All Assets View — Instructions', body: '<ol><li>Pins show each asset at its last reported location.</li><li>Pin colors indicate activity type (fuel purchase, form entry, inspection, work order, PM/maintenance).</li><li>Click any pin to see asset details, Street View, and a link to the full asset record.</li><li>Select a specific asset from the dropdown to see its location history trail.</li></ol>' },
  'location-breadcrumb': { title: 'Location Map — Single Asset Trail — Purpose', body: 'Shows the GPS location history for a selected asset over a chosen time period. A colored line connects the trail points, and the legend shows which activity types are displayed.' },
  'location-breadcrumb-instructions': { title: 'Location Map — Single Asset Trail — Instructions', body: '<ol><li><strong>Select Asset:</strong> Choose an asset from the dropdown above the map.</li><li><strong>Select Year:</strong> Choose the year to view.</li><li><strong>Select Range:</strong> For the current year, choose Today, Last 7/30/90 Days, or Year to Date.</li><li><strong>Form Entry Locations:</strong> Check the box to also show where fuel form entries were submitted (the GPS location when the form was filled out, which may differ from the fuel stop location).</li><li>The legend in the bottom-right corner shows which activity types are color-coded on the trail.</li><li>Click any trail point for details and Street View.</li><li>Select "All Assets" from the dropdown to return to the overview map.</li></ol>' },
  'inspections': { title: 'Inspections — Purpose', body: 'Track and manage equipment inspections. Inspection records will appear here.' },
  'inspections-instructions': { title: 'Inspections — Instructions', body: '<ol><li>Inspection tracking will appear here once configured.</li></ol>' },
  'workorders': { title: 'Work Orders — Purpose', body: 'Track and manage work orders for asset maintenance and repairs.' },
  'workorders-instructions': { title: 'Work Orders — Instructions', body: '<ol><li>Work order tracking will appear here once configured.</li></ol>' },
  'transfers': { title: 'Transfers — Purpose', body: 'Track asset transfers between locations, projects, or operators.' },
  'transfers-instructions': { title: 'Transfers — Instructions', body: '<ol><li>Asset transfer tracking will appear here once configured.</li></ol>' },
  'manuals': { title: 'Manuals — Purpose', body: 'Store and access equipment manuals and documentation.' },
  'manuals-instructions': { title: 'Manuals — Instructions', body: '<ol><li>Equipment manuals will appear here once configured.</li></ol>' }
};

function getTabKey() {
  var active = document.querySelector('.am-tab.active');
  return active ? active.getAttribute('data-tab') : 'overview';
}

// Returns the help content key for the current tab + map mode (location tab only)
function getHelpKey(base) {
  var tab = getTabKey();
  if (tab === 'location' && typeof mapMode !== 'undefined' && mapMode) {
    // Try map-mode-specific content first (e.g. 'location-forms')
    var modeKey = 'location-' + mapMode;
    if (helpContent[modeKey + (base === '-instructions' ? '-instructions' : '')]) {
      return modeKey + (base === '-instructions' ? '-instructions' : '');
    }
    // Also try with base appended
    if (base && helpContent[modeKey + base]) {
      return modeKey + base;
    }
  }
  return tab + (base || '');
}

function setupInfoModals() {
  var btnP = document.getElementById('btnTabPurpose');
  var btnI = document.getElementById('btnTabInstructions');
  if (btnP) {
    btnP.addEventListener('click', function() {
      var key = getHelpKey('');
      var c = helpContent[key];
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
      var key = getHelpKey('-instructions');
      var c = helpContent[key];
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
                if (typeof setupMapAssetFilter === 'function') {
                  setupMapAssetFilter();
                } else if (typeof renderAssetMapPins === 'function') {
                  renderAssetMapPins();
                }
              } else {
                console.warn('initAssetMap did not create amMapInstance — creating fallback map');
                createFallbackMap(container);
                if (typeof setupMapAssetFilter === 'function') {
                  setTimeout(setupMapAssetFilter, 100);
                }
              }
            }, 300);
          } else {
            amMapInstance.invalidateSize();
            if (typeof setupMapAssetFilter === 'function') {
              setupMapAssetFilter();
            } else if (typeof renderAssetMapPins === 'function') {
              renderAssetMapPins();
            }
            console.log('Map resized and pins refreshed');
          }
        } else {
          console.warn('initAssetMap not found — creating fallback map');
          createFallbackMap(container);
          if (typeof setupMapAssetFilter === 'function') {
            setTimeout(setupMapAssetFilter, 100);
          }
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
      popup += '<a href="#" onclick="openStreetView(' + lat + ',' + lng + ',\'' + escapeHtml(a.assetNumber || a.type || 'Asset').replace(/'/g, "\\'") + '\'); return false;" style="display:block;margin-top:6px;color:#16a34a;font-size:13px;text-decoration:none;font-weight:600;">Street View &rarr;</a>';
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
// HEADER REBUILD — copy User Management's proven approach
// (clear + rebuild from scratch, observer only fires on actual duplicates)
// ═══════════════════════════════════════════════════════════════
function rebuildHeader() {
  var header = document.getElementById('dashHeader');
  if (!header) return;

  var title = document.body.getAttribute('data-page-title') || 'Asset Management';

  // Grab the customer logo area if it exists (preserve loaded logo)
  var logoArea = header.querySelector('#dashCustomerLogoArea');
  var drivenLogo = header.querySelector('.dash-driven-logo') || header.querySelector('img.dash-driven-logo');

  // Nuke everything
  header.innerHTML = '';

  // Rebuild single-row header
  var dashHeader = document.createElement('div');
  dashHeader.className = 'dash-header';

  var row1 = document.createElement('div');
  row1.className = 'dash-header-row1';

  // Left: customer logo
  var left = document.createElement('div');
  left.className = 'dash-header-logo-left';
  if (logoArea) {
    left.appendChild(logoArea);
  } else {
    var ph = document.createElement('div');
    ph.id = 'dashCustomerLogoArea';
    ph.innerHTML = '<div class="dash-customer-logo-placeholder">No logo uploaded</div>';
    left.appendChild(ph);
  }
  row1.appendChild(left);

  // Center: ONE page title only
  var h1 = document.createElement('h1');
  h1.id = 'dashPageTitle';
  h1.className = 'dash-header-title';
  h1.textContent = title;
  row1.appendChild(h1);

  // Right: DRIV-EN logo
  var right = document.createElement('div');
  right.className = 'dash-header-logo-right';
  if (drivenLogo) {
    right.appendChild(drivenLogo);
  } else {
    var img = document.createElement('img');
    img.src = '/assets/logo.png?v=2026';
    img.className = 'dash-driven-logo';
    img.alt = 'DRIV-EN Logo';
    right.appendChild(img);
  }
  row1.appendChild(right);

  dashHeader.appendChild(row1);
  header.appendChild(dashHeader);
}

function startHeaderObserver() {
  var container = document.getElementById('dashHeader');
  if (!container) return;

  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType === 1) {
          // Check for stale multi-row header injection
          var h1s = container.querySelectorAll('h1');
          var rows = container.querySelectorAll('.dash-header-row2, .dash-header-row3');
          if (h1s.length > 1 || rows.length > 0) {
            rebuildHeader();
            return;
          }
        }
      }
    }
  });

  observer.observe(container, { childList: true, subtree: true });
}

function scheduleHeaderRebuilds() {
  rebuildHeader();
  setTimeout(rebuildHeader, 50);
  setTimeout(rebuildHeader, 200);
  setTimeout(rebuildHeader, 500);
  setTimeout(rebuildHeader, 1000);
  setTimeout(rebuildHeader, 2000);
  setTimeout(rebuildHeader, 3000);
}

// ═══════════════════════════════════════════════════════════════
// ── Map: Breadcrumb Trail with asset filter ──
// Single map view — breadcrumb trail for all assets or a specific asset
// ═══════════════════════════════════════════════════════════════
window.setupMapAssetFilter = function() {
  var filter = document.getElementById('amMapAssetFilter');
  if (!filter) return;

  // Populate with active assets — "All Active Assets" is the default
  filter.innerHTML = '<option value="all">All Active Assets</option>';
  allAssets.forEach(function(a) {
    var s = (a.status || '').toLowerCase();
    if (s === 'retired' || s === 'sold' || s === 'lost') return;
    var opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.assetNumber || a.type || 'Asset ' + a.id;
    filter.appendChild(opt);
  });

  // Show all filter controls by default
  var bcYear = document.getElementById('amBreadcrumbYear');
  var bcRange = document.getElementById('amBreadcrumbDateRange');
  var bcFormLabel = document.getElementById('amBcFormEntryLabel');

  // Set up year selector
  if (bcYear) {
    bcYear.style.display = 'inline-block';
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

  // Set up date range selector
  if (bcRange) {
    bcRange.style.display = 'inline-block';
    bcRange.onchange = function() { renderBreadcrumbTrail(); };
  }

  // Set up form entry locations checkbox
  if (bcFormLabel) {
    bcFormLabel.style.display = 'inline-flex';
    bcFormLabel.style.alignItems = 'center';
    var bcFormCheck = document.getElementById('amBcFormEntryLocations');
    if (bcFormCheck) {
      bcFormCheck.checked = false;
      bcFormCheck.onchange = function() { renderBreadcrumbTrail(); };
    }
  }

  // Asset filter change — always render breadcrumb trail
  filter.onchange = function() {
    clearGeocodeQueue();
    renderBreadcrumbTrail();
  };

  updateDaysFilterVisibility();

  // Auto-load breadcrumb trail with "All Active Assets" default
  mapMode = 'breadcrumb';
  renderBreadcrumbTrail();
};

// Keep setMapMode as a no-op stub for backward compatibility
window.setMapMode = function(mode) {
  console.log('[AM-Additions] setMapMode is deprecated, using asset filter instead');
};

// ── Geocode helper using Nominatim (free OpenStreetMap geocoder) ──
// No country restriction — customers may operate in US, Canada, Mexico, and US territories
// Tries multiple address formats to disambiguate (e.g. "Houston" → "Houston, TX" if state is known)
//
// Rate limiting: Nominatim allows max 1 request/second. We queue all requests with
// 600ms spacing (respectful but faster for small batches).
// Uses XMLHttpRequest instead of fetch to bypass error-handler.js's fetch wrapper
// (geocode failures are expected/handled and should NOT trigger error emails).
// Results are cached in localStorage so subsequent map switches are instant.
var geocodeCache = {};
var _geocodeQueue = [];
var _geocodeProcessing = false;
var _geocodeGen = 0; // generation counter — incremented on map switch to cancel stale callbacks

// Load cache from localStorage on startup
try {
  var saved = localStorage.getItem('geocodeCache_v1');
  if (saved) geocodeCache = JSON.parse(saved);
} catch(e) {}

function _saveGeocodeCache() {
  try {
    // Only save if cache isn't too large (max 500 entries)
    var keys = Object.keys(geocodeCache);
    if (keys.length > 500) {
      // Keep only the most recent 500
      var toRemove = keys.length - 500;
      for (var i = 0; i < toRemove; i++) delete geocodeCache[keys[i]];
    }
    localStorage.setItem('geocodeCache_v1', JSON.stringify(geocodeCache));
  } catch(e) {}
}

// Clear pending geocode queue (called on map switch to prevent stale callbacks)
function clearGeocodeQueue() {
  _geocodeQueue = [];
  _geocodeProcessing = false;
  _geocodeGen++; // invalidate any in-flight callbacks
}

function _nominatimXHR(url) {
  return new Promise(function(resolve) {
    var xhr = new XMLHttpRequest();
    xhr.timeout = 8000;
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onload = function() {
      if (xhr.status === 200) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch(e) { resolve([]); }
      } else { resolve([]); }
    };
    xhr.ontimeout = xhr.onerror = function() { resolve([]); };
    xhr.send();
  });
}

function _processGeocodeQueue() {
  if (_geocodeQueue.length === 0) { _geocodeProcessing = false; return; }
  _geocodeProcessing = true;
  var item = _geocodeQueue.shift();
  _nominatimXHR(item.url).then(function(data) {
    item.resolve(data);
    setTimeout(_processGeocodeQueue, 600); // 600ms spacing — respectful but fast
  });
}

function _queueNominatim(url) {
  return new Promise(function(resolve) {
    _geocodeQueue.push({ url: url, resolve: resolve });
    if (!_geocodeProcessing) _processGeocodeQueue();
  });
}

function geocodeAddress(address, hintState) {
  return new Promise(function(resolve) {
    // ── Structured address object: use Nominatim structured params for precision ──
    if (typeof address === 'object' && address !== null) {
      var cacheKey = JSON.stringify(address);
      if (geocodeCache[cacheKey]) { resolve(geocodeCache[cacheKey]); return; }

      var params = 'format=json&limit=1&addressdetails=1';
      if (address.street) params += '&street=' + encodeURIComponent(address.street);
      if (address.city) params += '&city=' + encodeURIComponent(address.city);
      if (address.state) params += '&state=' + encodeURIComponent(address.state);
      if (address.zip) params += '&postalcode=' + encodeURIComponent(address.zip);
      if (address.country) params += '&country=' + encodeURIComponent(address.country);

      _queueNominatim('https://nominatim.openstreetmap.org/search?' + params)
      .then(function(data) {
        if (data && data.length > 0) {
          var coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          geocodeCache[cacheKey] = coords;
          _saveGeocodeCache();
          resolve(coords);
        } else {
          // Fallback: try free-text query with combined address (no vendor name)
          var fallback = [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ');
          if (fallback.trim().length < 5) { resolve(null); return; }
          _queueNominatim('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(fallback) + '&limit=1&addressdetails=1')
          .then(function(data2) {
            if (data2 && data2.length > 0) {
              var coords2 = { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) };
              geocodeCache[cacheKey] = coords2;
              _saveGeocodeCache();
              resolve(coords2);
            } else { resolve(null); }
          });
        }
      });
      return;
    }

    // ── String address: free-text query (existing behavior for projects etc.) ──
    if (!address || address.trim().length < 5) { resolve(null); return; }
    if (geocodeCache[address]) { resolve(geocodeCache[address]); return; }

    var hasState = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR)\b/i.test(address);
    if (!hasState && hintState) {
      address = address + ', ' + hintState;
    }

    _queueNominatim('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(address) + '&limit=1&addressdetails=1')
    .then(function(data) {
      if (data && data.length > 0) {
        var coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        geocodeCache[address] = coords;
        _saveGeocodeCache();
        resolve(coords);
      } else { resolve(null); }
    });
  });
}

// ── Forms View: show all form submissions with GPS on the map ──
function renderFormsView() {
  if (!amMapInstance) return;
  if (amClusterGroup) amClusterGroup.clearLayers();
  if (window._bcMarkerGroup) { amMapInstance.removeLayer(window._bcMarkerGroup); window._bcMarkerGroup = null; }
  if (window._breadcrumbLine) { amMapInstance.removeLayer(window._breadcrumbLine); window._breadcrumbLine = null; }
  if (window._bcLegend) { amMapInstance.removeControl(window._bcLegend); window._bcLegend = null; }
  amMapInstance.setView([39.5, -98.35], 4);

  var myGen = _geocodeGen; // capture generation so stale callbacks are ignored

  // Fetch fuel transactions (which are form submissions with GPS coordinates)
  var now = new Date();
  var fromStr = now.getFullYear() + '-01-01';
  var toStr = now.toISOString().split('T')[0];

  fetch('/api/fuel-transactions?from=' + fromStr + '&to=' + toStr)
    .then(function(r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function(data) {
      if (myGen !== _geocodeGen) return; // user switched away — abort
      var items = data.transactions || data.records || data || [];
      if (!Array.isArray(items)) items = [];
      console.log('[AM-Additions] Forms View: fetched', items.length, 'form submissions');

      var bounds = [];
      items.forEach(function(item) {
        var lat = parseFloat(item.latitude || item.lat);
        var lng = parseFloat(item.longitude || item.lng || item.lon);
        var date = item.transaction_date || item.purchase_date || item.created_at || '';
        var assetLabel = item.asset_number || item.asset_name || '';
        var vendorAddr = '';
        if (item.vendor) vendorAddr = item.vendor;
        if (item.address) vendorAddr += (vendorAddr ? ' — ' : '') + item.address;
        if (item.city) vendorAddr += ', ' + item.city;
        else if (item.vendor_city) vendorAddr += ', ' + item.vendor_city;
        if (item.state) vendorAddr += ', ' + item.state;
        else if (item.vendor_state) vendorAddr += ', ' + item.vendor_state;

        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          var icon = createPinIcon(PIN_COLORS.form);
          var marker = L.marker([lat, lng], { icon: icon });
          var popupHtml = '<div class="am-map-popup"><h4>Form Entry</h4>';
          if (assetLabel) popupHtml += '<p><strong>' + escapeHtml(assetLabel) + '</strong></p>';
          popupHtml += '<p class="popup-meta">User location: ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</p>';
          if (vendorAddr) popupHtml += '<p>Vendor: ' + escapeHtml(vendorAddr) + '</p>';
          if (date) popupHtml += '<p class="popup-meta">' + escapeHtml(formatDateTime(date)) + '</p>';
          popupHtml += '<a href="#" onclick="openStreetView(' + lat + ',' + lng + ',\'' + escapeHtml(assetLabel || 'Form Entry').replace(/'/g, "\\'") + '\'); return false;" style="display:block;margin-top:6px;color:#16a34a;font-size:13px;text-decoration:none;font-weight:600;">Street View &rarr;</a>';
          popupHtml += '</div>';
          marker.bindPopup(popupHtml);
          amClusterGroup.addLayer(marker);
          bounds.push([lat, lng]);
        }
      });

      if (bounds.length > 0) {
        amMapInstance.fitBounds(bounds, { padding: [50, 50] });
      } else {
        // No GPS data — show message
        var note = L.popup().setLatLng([39.5, -98.35])
          .setContent('<div class="am-map-popup"><h4>No form GPS data</h4><p>No form submissions with GPS coordinates found for this period.</p></div>')
          .openOn(amMapInstance);
      }
    })
    .catch(function(e) {
      console.log('[AM-Additions] Forms View: API not available');
      var note = L.popup().setLatLng([39.5, -98.35])
        .setContent('<div class="am-map-popup"><h4>Unable to load forms</h4><p>Form data API is not available.</p></div>')
        .openOn(amMapInstance);
    });
}

// ── Projects View: fetch projects, geocode addresses, place markers ──
function renderProjectsView() {
  if (!amMapInstance) return;
  if (amClusterGroup) amClusterGroup.clearLayers();
  if (window._bcMarkerGroup) { amMapInstance.removeLayer(window._bcMarkerGroup); window._bcMarkerGroup = null; }
  if (window._breadcrumbLine) { amMapInstance.removeLayer(window._breadcrumbLine); window._breadcrumbLine = null; }
  if (window._bcLegend) { amMapInstance.removeControl(window._bcLegend); window._bcLegend = null; }
  amMapInstance.setView([39.5, -98.35], 4);

  var myGen = _geocodeGen; // capture generation so stale callbacks are ignored

  // Show loading indicator
  var loadingNote = L.popup().setLatLng([39.5, -98.35])
    .setContent('<div class="am-map-popup"><p>Geocoding project addresses...</p></div>')
    .openOn(amMapInstance);

  fetch('/api/projects')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (myGen !== _geocodeGen) return; // user switched away — abort
      amMapInstance.closePopup(); // dismiss loading note

      var projects = data.projects || data.records || data || [];
      if (!Array.isArray(projects)) projects = [];
      console.log('[AM-Additions] Projects fetched:', projects.length);
      if (projects.length === 0) {
        var note = L.popup().setLatLng([39.5, -98.35]).setContent('<div class="am-map-popup"><p>No projects found.</p></div>').openOn(amMapInstance);
        return;
      }
      var bounds = [];
      var pending = 0;
      var totalWithAddr = 0;
      projects.forEach(function(p) {
        var addr = p.location || p.address || p.city || '';
        if (!addr) return;
        totalWithAddr++;
        // Extract state hint from project data if available
        var stateHint = p.state || '';
        if (!stateHint && addr) {
          // Try to extract state from the address itself
          var stateMatch = addr.match(/\b(TX|CA|NY|FL|AZ|NM|OK|LA|AR|CO|WA|OR|NV|UT|ID|MT|WY|ND|SD|NE|KS|MN|IA|MO|WI|IL|IN|MI|OH|KY|TN|MS|AL|GA|SC|NC|VA|WV|PA|NJ|NY|CT|RI|MA|VT|NH|ME|MD|DE|DC|AK|HI|PR)\b/i);
          if (stateMatch) stateHint = stateMatch[0].toUpperCase();
        }
        pending++;
        geocodeAddress(addr, stateHint).then(function(coords) {
          if (myGen !== _geocodeGen) return; // user switched away — don't add markers
          pending--;
          if (coords) {
            var marker = L.marker([coords.lat, coords.lng]);
            marker.bindPopup('<div class="am-map-popup"><h4>' + escapeHtml(p.name || 'Project') + '</h4><p class="popup-meta">' + escapeHtml(p.code || '') + '</p><p>' + escapeHtml(addr) + '</p><a href="#" onclick="openStreetView(' + coords.lat + ',' + coords.lng + ',\'' + escapeHtml(p.name || 'Project').replace(/'/g, "\\'") + '\'); return false;" style="display:block;margin-top:6px;color:#16a34a;font-size:13px;text-decoration:none;font-weight:600;">Street View &rarr;</a></div>');
            amClusterGroup.addLayer(marker);
            bounds.push([coords.lat, coords.lng]);
          } else {
            console.log('[AM-Additions] Geocode failed for project:', p.name, '—', addr);
          }
          if (pending === 0) {
            if (bounds.length > 0) {
              amMapInstance.fitBounds(bounds, { padding: [50, 50] });
            } else if (totalWithAddr > 0) {
              L.popup().setLatLng([39.5, -98.35])
                .setContent('<div class="am-map-popup"><p>Could not geocode any project addresses. Addresses may be incomplete or invalid.</p></div>')
                .openOn(amMapInstance);
            }
          }
        });
      });
      if (totalWithAddr === 0) {
        L.popup().setLatLng([39.5, -98.35])
          .setContent('<div class="am-map-popup"><p>No projects have addresses to display on the map.</p></div>')
          .openOn(amMapInstance);
      }
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
  if (window._bcMarkerGroup) { amMapInstance.removeLayer(window._bcMarkerGroup); window._bcMarkerGroup = null; }
  if (window._breadcrumbLine) { amMapInstance.removeLayer(window._breadcrumbLine); window._breadcrumbLine = null; }
  if (window._bcLegend) { amMapInstance.removeControl(window._bcLegend); window._bcLegend = null; }

  var myGen = _geocodeGen; // capture generation so stale callbacks are ignored

  var bcSelect = document.getElementById('amMapAssetFilter');
  var bcRange = document.getElementById('amBreadcrumbDateRange');
  var bcYear = document.getElementById('amBreadcrumbYear');
  var assetId = bcSelect ? bcSelect.value : 'all';

  addMapLegend();

  // ── Calculate date range from year + days filters ──
  var selectedYear = bcYear ? parseInt(bcYear.value) : new Date().getFullYear();
  var currentYear = new Date().getFullYear();
  var now = new Date();
  var fromStr, toStr;

  if (selectedYear === currentYear && bcRange && bcRange.value !== 'ytd') {
    // Current year with days filter
    var days = 0;
    if (bcRange.value === 'today') days = 0;
    else if (bcRange.value === '7days') days = 7;
    else if (bcRange.value === '30days') days = 30;
    else if (bcRange.value === '90days') days = 90;
    var fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - days);
    fromStr = fromDate.toISOString().split('T')[0];
    toStr = now.toISOString().split('T')[0];
  } else if (selectedYear === currentYear) {
    // Year to Date
    fromStr = selectedYear + '-01-01';
    toStr = now.toISOString().split('T')[0];
  } else {
    // Previous full year
    fromStr = selectedYear + '-01-01';
    toStr = selectedYear + '-12-31';
  }

  console.log('[AM-Additions] Breadcrumb trail: asset=' + assetId, 'from=' + fromStr, 'to=' + toStr);

  var allPoints = [];
  var sourcesFetched = 0;
  var sourcesTotal = 0;
  var pendingGeocodes = 0;

  function checkAllDone() {
    if (myGen !== _geocodeGen) return; // user switched away — abort
    if (sourcesFetched >= sourcesTotal && pendingGeocodes === 0) {
      allPoints.sort(function(a, b) {
        return (a.date || '') < (b.date || '') ? -1 : (a.date || '') > (b.date || '') ? 1 : 0;
      });
      drawActivityPins(allPoints);
    }
  }

  function fetchActivity(url, pinType, label, addrField) {
    sourcesTotal++;
    fetch(url)
      .then(function(r) {
        if (!r.ok) { console.log('[AM-Additions] ' + label + ' API returned ' + r.status); throw new Error(r.status); }
        return r.json();
      })
      .then(function(data) {
        var items = data.transactions || data.purchases || data.records || data.results || data || [];
        if (!Array.isArray(items)) items = [];
        console.log('[AM-Additions] ' + label + ' fetched:', items.length, 'items');

        // Check if user wants to see form entry locations for fuel purchases
        var showFormEntry = false;
        var formCheck = document.getElementById('amBcFormEntryLocations');
        if (formCheck) showFormEntry = formCheck.checked;

        items.forEach(function(item) {
          // User's GPS location (where they were when they submitted the form)
          var userLat = parseFloat(item.latitude || item.lat || item.gps_lat || item.formLat);
          var userLng = parseFloat(item.longitude || item.lng || item.gps_lng || item.lon || item.formLng);

          // Fuel purchase date (when the purchase was made at the store)
          var fuelDate = item.transaction_date || item.purchase_date || item.created_at || '';
          // Form entry date (when the form was actually submitted — may differ from purchase date)
          var formDate = item.created_at || item.submitted_at || item.form_submitted_at || item.date || fuelDate || '';

          // ── Build structured geocoding address (street only, NO vendor name) ──
          // Nominatim structured params give much more precise results than free-text
          var streetAddr = item.address || item.vendor_address || '';
          var cityAddr = item.city || item.vendor_city || '';
          var stateAddr = item.state || item.vendor_state || '';
          var zipAddr = item.zip || item.vendor_zip || '';
          var geocodeAddr = { street: streetAddr, city: cityAddr, state: stateAddr, zip: zipAddr };

          // ── Build display address (includes vendor name for popup display) ──
          var displayAddr = '';
          if (item.vendor) displayAddr = item.vendor;
          if (streetAddr) displayAddr += (displayAddr ? ' — ' : '') + streetAddr;
          if (cityAddr) displayAddr += (displayAddr ? ', ' : '') + cityAddr;
          if (stateAddr) displayAddr += ', ' + stateAddr;
          if (zipAddr) displayAddr += ' ' + zipAddr;

          var assetLabel = item.asset_number || item.asset_name || item.assetNumber || '';
          var stateHint = stateAddr;

          // ── GREEN PIN: at the store/vendor street address (geocoded precisely) ──
          if (streetAddr && streetAddr.trim().length >= 3) {
            pendingGeocodes++;
            geocodeAddress(geocodeAddr, stateHint).then(function(coords) {
              pendingGeocodes--;
              if (coords) {
                allPoints.push({
                  lat: coords.lat, lng: coords.lng,
                  type: 'fuel', label: 'Fuel Purchase',
                  date: fuelDate, addr: displayAddr, asset: assetLabel,
                  hasGPS: false
                });
              }
              checkAllDone();
            });
          }

          // ── BLUE PIN: at the user's GPS location (where they submitted the form) ──
          // Uses form submission date, NOT purchase date
          // Popup includes fuel purchase location and purchase date for context
          if (pinType === 'fuel' && showFormEntry && !isNaN(userLat) && !isNaN(userLng) && userLat !== 0 && userLng !== 0) {
            var fuelLocDesc = '';
            if (item.vendor) fuelLocDesc = item.vendor;
            if (cityAddr) fuelLocDesc += (fuelLocDesc ? ', ' : '') + cityAddr;
            if (stateAddr) fuelLocDesc += ', ' + stateAddr;
            allPoints.push({
              lat: userLat, lng: userLng,
              type: 'form', label: 'Fuel Purchase — Form Entry',
              date: formDate,
              addr: 'Form submitted at: ' + userLat.toFixed(4) + ', ' + userLng.toFixed(4),
              asset: assetLabel, hasGPS: true,
              fuelDate: fuelDate,
              fuelLocation: fuelLocDesc
            });
          }

          // ── For non-fuel activity types: always use user's GPS ──
          if (pinType !== 'fuel' && !isNaN(userLat) && !isNaN(userLng) && userLat !== 0 && userLng !== 0) {
            allPoints.push({
              lat: userLat, lng: userLng,
              type: pinType, label: label,
              date: formDate, addr: displayAddr || '',
              asset: assetLabel, hasGPS: true
            });
          } else if (pinType !== 'fuel' && streetAddr && streetAddr.trim().length >= 3) {
            // Non-fuel with no GPS but has address — geocode it
            pendingGeocodes++;
            geocodeAddress(geocodeAddr, stateHint).then(function(coords) {
              pendingGeocodes--;
              if (coords) {
                allPoints.push({
                  lat: coords.lat, lng: coords.lng,
                  type: pinType, label: label,
                  date: formDate, addr: displayAddr, asset: assetLabel,
                  hasGPS: false
                });
              }
              checkAllDone();
            });
          }
        });
        sourcesFetched++;
        checkAllDone();
      })
      .catch(function(e) {
        console.log('[AM-Additions] ' + label + ' endpoint not available');
        sourcesFetched++;
        checkAllDone();
      });
  }

  // ── If "All Active Assets": only show pins from actual activity data ──
  if (assetId === 'all') {
    // Don't create pins for each asset at their assigned location — only show actual activity
    // Fetch fuel transactions for ALL assets (no asset_id filter)
    var fuelUrl = '/api/fuel-transactions?from=' + fromStr + '&to=' + toStr;
    fetchActivity(fuelUrl, 'fuel', 'Fuel Purchase', 'address');
  } else {
    // ── Specific asset: fetch all activity for that asset ──
    var assetUrl = '/api/fuel-transactions?asset_id=' + encodeURIComponent(assetId) + '&from=' + fromStr + '&to=' + toStr;
    fetchActivity(assetUrl, 'fuel', 'Fuel Purchase', 'address');

    // Also show the asset's own form/base location as a pin
    var asset = allAssets.find(function(a) { return a.id === assetId; });
    if (asset) {
      var lat = parseFloat(asset.formLat || asset.baseLat || asset.lat);
      var lng = parseFloat(asset.formLng || asset.baseLng || asset.lng);
      var addr = asset.formLocation || asset.baseLocation || asset.location || '';
      var date = asset.formTimeDisplay || asset.baseTimeDisplay || '';
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        allPoints.push({ lat: lat, lng: lng, type: 'form', label: 'Last Form Entry', date: date, addr: addr, asset: asset.assetNumber || '', hasGPS: true });
      } else if (addr && addr.trim().length >= 5) {
        pendingGeocodes++;
        geocodeAddress(addr).then(function(coords) {
          pendingGeocodes--;
          if (coords) {
            allPoints.push({ lat: coords.lat, lng: coords.lng, type: 'form', label: 'Last Form Entry', date: date, addr: addr, asset: asset.assetNumber || '', hasGPS: false });
          }
          checkAllDone();
        });
      }
    }
  }

  // If no async sources, draw immediately
  if (sourcesTotal === 0) {
    setTimeout(function() { drawActivityPins(allPoints); }, 500);
  }
}

function drawActivityPins(points) {
  if (!amMapInstance) return;
  // Don't guard with _geocodeGen here — checkAllDone already guards before calling this

  // Use a PLAIN layer group (NOT marker cluster) so each pin shows its actual color
  // MarkerCluster wraps pins in green/yellow/red cluster icons that hide the pin's true color
  if (window._bcMarkerGroup) { amMapInstance.removeLayer(window._bcMarkerGroup); }
  window._bcMarkerGroup = L.layerGroup();
  amMapInstance.addLayer(window._bcMarkerGroup);
  if (window._breadcrumbLine) { amMapInstance.removeLayer(window._breadcrumbLine); window._breadcrumbLine = null; }

  var trailCoords = [];
  points.forEach(function(p) {
    var icon = createPinIcon(PIN_COLORS[p.type] || '#666');
    var marker = L.marker([p.lat, p.lng], { icon: icon });
    var popupHtml = '<div class="am-map-popup"><h4>' + escapeHtml(p.label) + '</h4>';
    if (p.asset) popupHtml += '<p><strong>' + escapeHtml(p.asset) + '</strong></p>';
    if (p.addr) popupHtml += '<p>' + escapeHtml(p.addr) + '</p>';
    // For form entry pins, show where the fuel purchase actually happened
    if (p.fuelLocation) popupHtml += '<p class="popup-meta">Fuel purchase at: ' + escapeHtml(p.fuelLocation) + '</p>';
    if (p.fuelDate && p.fuelDate !== p.date) popupHtml += '<p class="popup-meta">Purchase date: ' + escapeHtml(formatDateTime(p.fuelDate)) + '</p>';
    if (!p.hasGPS) popupHtml += '<p class="popup-meta">(geocoded from address)</p>';
    if (p.date) popupHtml += '<p class="popup-meta">' + escapeHtml(formatDateTime(p.date)) + '</p>';
    popupHtml += '<a href="#" onclick="openStreetView(' + p.lat + ',' + p.lng + ',\'' + escapeHtml((p.asset || p.label || 'Location').replace(/'/g, "\\'")) + '\'); return false;" style="display:block;margin-top:6px;color:#16a34a;font-size:13px;text-decoration:none;font-weight:600;">Street View &rarr;</a>';
    popupHtml += '</div>';
    marker.bindPopup(popupHtml);
    window._bcMarkerGroup.addLayer(marker);
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
    rebuildHeader();
    populateWelcomeCard();
    loadAmColOrder();
    setupInfoModals();
    renderTableHead();
    renderAssetTable();
    updateKpiFix();
  }, 500);
  setTimeout(function() {
    rebuildHeader();
    populateWelcomeCard();
  }, 2000);
}, true);

console.log('[AM-Additions] Fully loaded — all patches and fixes applied');

// ═══════════════════════════════════════════════════════════════
// FORMAT DATE/TIME — converts ISO timestamp to local 12-hour format
// Shows date and time in the user's timezone with AM/PM
// ═══════════════════════════════════════════════════════════════
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  try {
    // Check if the date string has a time component
    // Date-only strings like "2026-01-15" or "01/15/2026" have no time
    var hasTime = dateStr.indexOf('T') !== -1 || /\d{1,2}:\d{2}/.test(dateStr);

    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // return as-is if can't parse

    // Format: MM/DD/YYYY (date always), plus time if available
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var year = d.getFullYear();

    if (!hasTime) {
      return month + '/' + day + '/' + year + ', Unknown Time';
    }

    var hours = d.getHours();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    var minutes = String(d.getMinutes()).padStart(2, '0');
    var seconds = String(d.getSeconds()).padStart(2, '0');

    return month + '/' + day + '/' + year + ', ' + hours + ':' + minutes + ':' + seconds + ' ' + ampm;
  } catch(e) {
    return dateStr; // return as-is on error
  }
}

// ═══════════════════════════════════════════════════════════════
// WELCOME CARD — populate from dashUser (same logic as admin dashboard)
// ═══════════════════════════════════════════════════════════════
function populateWelcomeCard() {
  // Get user data from window.dashUser, event detail, or localStorage
  var user = window.dashUser || window.drivenUser;
  if (!user) {
    try {
      var s = localStorage.getItem('driven_user') || sessionStorage.getItem('driven_user');
      if (s) user = JSON.parse(s);
    } catch(e) {}
  }
  if (!user) {
    console.log('[AM-Additions] No user data found for welcome card');
    return;
  }

  var firstName = user.first_name || user.email || '';
  var orgName = user.org_name || localStorage.getItem('driven_org_name') || '';

  var welcomeEl = document.getElementById('welcome-name');
  if (welcomeEl) {
    welcomeEl.textContent = firstName ? ('Welcome back, ' + firstName + (orgName ? ' - ' + orgName : '')) : 'Welcome back';
  }
  var elRole = document.getElementById('welcome-role');
  if (elRole) elRole.textContent = user.role || user.role_id || '';
  var elMail = document.getElementById('welcome-email');
  if (elMail) elMail.textContent = user.email || '';

  // Initialize UOM dropdown
  var uomSelect = document.getElementById('welcomeUomSelect');
  if (uomSelect && window.DRIVEN_UNITS && DRIVEN_UNITS.getUserUnitPreference) {
    DRIVEN_UNITS.getUserUnitPreference().then(function(info) {
      if (!info) return;
      uomSelect.value = info.user_preference || 'org_default';
      var hint = document.getElementById('welcomeUomHint');
      if (hint && info.org_default && info.user_preference === 'org_default') {
        hint.textContent = 'Org default: ' + (info.org_default === 'metric' ? 'Metric' : 'Imperial');
      }
    });
    uomSelect.onchange = function() {
      if (!window.DRIVEN_UNITS || !DRIVEN_UNITS.setUserUnitPreference) return;
      DRIVEN_UNITS.setUserUnitPreference(uomSelect.value).then(function(result) {
        if (!result) { alert('Failed to update unit preference.'); return; }
        var hint = document.getElementById('welcomeUomHint');
        if (hint) {
          if (uomSelect.value === 'org_default' && result.unit_system) {
            hint.textContent = 'Org default: ' + (result.unit_system === 'metric' ? 'Metric' : 'Imperial');
          } else { hint.textContent = ''; }
        }
        if (window.DRIVEN_APPLY_UNITS) DRIVEN_APPLY_UNITS.refresh();
        try { localStorage.setItem('driv-en-unit-system-changed', Date.now().toString()); localStorage.setItem('driv-en-unit-system', result.unit_system); } catch(e) {}
      });
    };
  }

  // Initialize language dropdown
  var langSelect = document.getElementById('adminLangSelect');
  if (langSelect) {
    var savedLang = localStorage.getItem('driven-lang') || 'en';
    langSelect.value = savedLang;
    langSelect.onchange = function() {
      localStorage.setItem('driven-lang', langSelect.value);
      if (window.location.reload) window.location.reload();
    };
  }

  console.log('[AM-Additions] Welcome card populated:', firstName, orgName);
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION — header rebuild + observer
// ═══════════════════════════════════════════════════════════════
scheduleHeaderRebuilds();
startHeaderObserver();
