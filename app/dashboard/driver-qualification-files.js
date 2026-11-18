/**
 * driver-qualification-files.js — DRIV-EN Driver Qualification Files (v1)
 *
 * Manages DOT compliance for commercial drivers: DL photos, CDL, driving record,
 * DOT medical card, background check, drug test, and employee-owned assets with
 * insurance/registration expiration tracking.
 */

var allDrivers = [];
var currentDriverId = null;
var currentUserOrgId = '';
var step2AssetCounter = 0;

var DQF_MODAL_MAP = {
  overview: {
    purpose: 'The <strong>Driver Qualification Files</strong> page is the landing page for DOT compliance management. It displays key metrics (Total Drivers, Pending, Expired, Current) and provides navigation to the driver list.',
    instructions: '<ol><li><strong>KPI Cards:</strong> Click any KPI card to jump to the Driver List.</li><li><strong>Driver List:</strong> Click the Driver List tab to see all commercial drivers with their compliance status badges.</li><li><strong>Driver Profile:</strong> Click any driver to open their full qualification file — DL photos, CDL, driving record, medical card, background check, drug test, and employee-owned assets.</li><li><strong>Personalization:</strong> The Light/Dark toggle, Units of Measure, and Language selectors are in the welcome bar above.</li></ol>'
  },
  list: {
    purpose: 'The <strong>Driver List</strong> shows all commercial drivers and their current compliance status for each required item. Status badges are color-coded: green (current), yellow (30 days), orange (7 days), red (expired), gray (not set).',
    instructions: '<ol><li><strong>Review Status:</strong> Each row shows the driver name, CDL class, and status badges for DL, Medical Card, Drug Test, Background Check, and Auto Policy.</li><li><strong>Open Profile:</strong> Click <strong>Open File</strong> on any row to view and edit the full compliance profile.</li><li><strong>File Status:</strong> The File Status column shows whether the DQF is Pending, Incomplete, or Complete.</li><li><strong>Back:</strong> Click <strong>&#8592; Back to Driver List</strong> in the pill bar to return.</li></ol>'
  },
  profile: {
    purpose: 'The <strong>Driver Profile</strong> is the full Driver Qualification File for a single commercial driver. It contains all DOT-required compliance documents and tracking, plus employee-owned assets with insurance and registration expiration tracking.',
    instructions: '<ol><li><strong>Driver Compliance:</strong> Enter authorized company vehicle status, CDL class and endorsements, and upload DL front/back photos.</li><li><strong>Driving Record:</strong> Enter verified date, recheck date, and upload the driving record document. Status auto-calculates.</li><li><strong>DOT Medical Card:</strong> Enter expiration date and upload the document. Status auto-calculates.</li><li><strong>Background Check:</strong> Enter check date and recheck date. Status auto-calculates.</li><li><strong>Drug Test:</strong> Enter test date and recheck date. Status auto-calculates.</li><li><strong>Employee-Owned Assets:</strong> Toggle "Will this driver provide personal assets?" If yes, click <strong>+ Add Asset</strong> for each asset (truck, welding machine, etc.). For vehicles, enter insurance carrier, policy number, expiration, and upload the insurance document. Insurance status auto-calculates with 30-day and 7-day warnings.</li><li><strong>Save:</strong> Click <strong>Save &amp; Complete</strong> to mark the file as complete, or <strong>Save &amp; Come Back Later</strong> if documents are still being collected.</li><li><strong>Back:</strong> Click <strong>&#8592; Back to Driver List</strong> to return to the list.</li></ol>'
  }
};

// ============================================================
// INITIALIZATION
// ============================================================
(async function() {
  try {
    var u = getAuthUser ? getAuthUser() : null;
    if (!u) { window.location.href = '/app/auth/login.html'; return; }
    currentUserOrgId = u.org_id || localStorage.getItem('driv-en-org-id') || '';

    // Build header
    if (typeof buildDashHeader === 'function') buildDashHeader();
    if (typeof makeStickyHeader === 'function') makeStickyHeader();

    // Wire theme toggle, UOM, language (shared header elements)
    wirePersonalization();

    // Wire pill bar buttons
    document.getElementById('btnPurpose').addEventListener('click', function() { dqfShowModal('purpose'); });
    document.getElementById('btnInstructions').addEventListener('click', function() { dqfShowModal('instructions'); });

    // Load drivers
    await loadDrivers();
    renderDriverTable();
    updateKpis();
    checkReminders();
  } catch (e) {
    console.error('DQF init error:', e);
  }
})();

function wirePersonalization() {
  var themeCheckbox = document.getElementById('dashThemeCheckbox');
  if (themeCheckbox) {
    var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    themeCheckbox.checked = (currentTheme === 'dark');
    themeCheckbox.addEventListener('change', function() {
      var newTheme = themeCheckbox.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('driven-theme', newTheme);
    });
  }
  var uomSelect = document.getElementById('welcomeUomSelect') || document.getElementById('umUomSelect');
  if (uomSelect && window.DRIVEN_UNITS && DRIVEN_UNITS.getUserUnitPreference) {
    DRIVEN_UNITS.getUserUnitPreference().then(function(info) {
      if (!info) return;
      uomSelect.value = info.user_preference || 'org_default';
      var hint = document.getElementById('welcomeUomHint') || document.getElementById('umUomHint');
      if (hint && info.org_default && info.user_preference === 'org_default') {
        hint.textContent = 'Org default: ' + (info.org_default === 'metric' ? 'Metric' : 'Imperial');
      }
    });
  }
  var langSelect = document.getElementById('welcomeLangSelect') || document.getElementById('umLangSelect');
  if (langSelect) {
    langSelect.value = localStorage.getItem('driven_lang') || 'en';
    langSelect.addEventListener('change', function() {
      localStorage.setItem('driven_lang', langSelect.value);
      if (window.DRIVEN_TRANSLATE) { try { DRIVEN_TRANSLATE.setLanguage(langSelect.value); } catch(e){} }
    });
  }
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadDrivers() {
  try {
    var resp = await fetch('/api/employees');
    if (!resp.ok) throw new Error('API error');
    var data = await resp.json();
    var all = data.records || data.data || data.employees || (Array.isArray(data) ? data : []);
    allDrivers = all.filter(function(e) { return e.is_commercial_driver === 'yes' || e.is_commercial_driver === true; });
  } catch (e) {
    console.warn('Failed to load drivers:', e);
    allDrivers = [];
  }
}

// ============================================================
// KPI + REMINDERS
// ============================================================
function updateKpis() {
  document.getElementById('kpiTotal').textContent = allDrivers.length;
  document.getElementById('kpiPending').textContent = allDrivers.filter(function(d) { return d.step2_status === 'pending' || !d.step2_status; }).length;
  document.getElementById('kpiExpired').textContent = allDrivers.filter(function(d) {
    return ['driving_record_status','medical_card_status','background_check_status','drug_test_status','auto_policy_status'].some(function(k) { return d[k] === 'expired'; });
  }).length;
  document.getElementById('kpiCurrent').textContent = allDrivers.filter(function(d) {
    return d.step2_status === 'complete' && !['driving_record_status','medical_card_status','background_check_status','drug_test_status','auto_policy_status'].some(function(k) { return d[k] === 'expired' || d[k] === '7day' || d[k] === '30day'; });
  }).length;
}

function checkReminders() {
  var pending = allDrivers.filter(function(d) { return d.step2_status === 'pending' || !d.step2_status; });
  var expired = allDrivers.filter(function(d) {
    return ['driving_record_status','medical_card_status','background_check_status','drug_test_status','auto_policy_status'].some(function(k) { return d[k] === 'expired'; });
  });
  var count = pending.length + expired.length;
  var banner = document.getElementById('dqfReminder');
  var text = document.getElementById('dqfReminderText');
  if (count > 0 && banner && text) {
    var msgs = [];
    if (pending.length) msgs.push(pending.length + ' driver file' + (pending.length > 1 ? 's' : '') + ' pending setup');
    if (expired.length) msgs.push(expired.length + ' expired item' + (expired.length > 1 ? 's' : ''));
    text.textContent = msgs.join(' — ') + '. Click Driver List to review.';
    banner.style.display = 'flex';
  } else if (banner) {
    banner.style.display = 'none';
  }
}

// ============================================================
// DRIVER TABLE
// ============================================================
function renderDriverTable() {
  var tbody = document.getElementById('dqfDriverBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  allDrivers.forEach(function(d) {
    var name = (d.first_name || '') + ' ' + (d.last_name || '');
    if (!name.trim()) name = d.full_name || d.email || 'Unknown';
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(name) + '</td>' +
      '<td>' + esc(d.cdl_class && d.cdl_class !== 'none' ? d.cdl_class : '—') + '</td>' +
      '<td>' + badge(d.driving_record_status) + '</td>' +
      '<td>' + badge(d.medical_card_status) + '</td>' +
      '<td>' + badge(d.drug_test_status) + '</td>' +
      '<td>' + badge(d.background_check_status) + '</td>' +
      '<td>' + badge(d.auto_policy_status) + '</td>' +
      '<td>' + fileStatusBadge(d.step2_status) + '</td>' +
      '<td><button class="dqf-row-action" onclick="openDriverProfile(\'' + esc(d.id) + '\')">Open File</button></td>';
    tbody.appendChild(tr);
  });
}

function badge(status) {
  if (!status || status === 'none') return '<span class="um-status-badge um-status-none">Not Set</span>';
  var cls = { current: 'um-status-current', '30day': 'um-status-30day', '7day': 'um-status-7day', expired: 'um-status-expired' }[status] || 'um-status-none';
  var txt = { current: 'Current', '30day': '30 Days', '7day': '7 Days', expired: 'Expired' }[status] || 'Not Set';
  return '<span class="um-status-badge ' + cls + '">' + txt + '</span>';
}

function fileStatusBadge(s) {
  if (!s || s === 'pending') return '<span class="um-status-badge um-status-pending">Pending</span>';
  if (s === 'incomplete') return '<span class="um-status-badge um-status-7day">Incomplete</span>';
  if (s === 'complete') return '<span class="um-status-badge um-status-current">Complete</span>';
  if (s === 'not_needed') return '<span class="um-status-badge um-status-none">N/A</span>';
  return '<span class="um-status-badge um-status-none">—</span>';
}

// ============================================================
// TAB SWITCHING
// ============================================================
function dqfSwitchTab(tab) {
  document.querySelectorAll('.dqf-tab-content').forEach(function(c) { c.classList.remove('active'); });
  var target = document.getElementById('dqf-tab-' + tab);
  if (target) target.classList.add('active');
  var backBtn = document.getElementById('dqfBackBtn');
  if (backBtn) backBtn.style.display = (tab === 'profile') ? 'inline-flex' : 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function dqfBackToList() { dqfSwitchTab('list'); }

// ============================================================
// DRIVER PROFILE
// ============================================================
function openDriverProfile(driverId) {
  currentDriverId = driverId;
  var driver = allDrivers.find(function(d) { return d.id === driverId; });
  if (!driver) return;
  var name = (driver.first_name || '') + ' ' + (driver.last_name || '');
  if (!name.trim()) name = driver.full_name || 'Driver';
  dqfSwitchTab('profile');
  renderProfile(driver);
  loadDriverAssets(driverId);
}

function renderProfile(d) {
  var name = (d.first_name || '') + ' ' + (d.last_name || '');
  if (!name.trim()) name = d.full_name || 'Driver';
  var endorsements = (d.cdl_endorsements || '').split(',').filter(Boolean);
  var endoHtml = ['air_brakes','hazmat','tanker','passenger','doubles','school_bus'].map(function(v) {
    return '<label><input type="checkbox" id="p_cdl_' + v + '" value="' + v + '"' + (endorsements.includes(v) ? ' checked' : '') + '> ' + v.replace('_',' ').replace(/\b\w/g,function(c){return c.toUpperCase()}) + '</label>';
  }).join(' ');

  var html = '<h2 style="margin:0 0 4px 0;font-size:20px;color:var(--text,#0f172a);">' + esc(name) + '</h2>';
  html += '<p style="margin:0 0 16px 0;font-size:13px;color:var(--text-muted,#64748b);">Employee #: ' + esc(d.employee_number || d.user_id || '—') + ' &nbsp;|&nbsp; CDL: ' + esc(d.cdl_class || 'None') + '</p>';

  // Driver Compliance
  html += '<div class="dqf-section"><div class="dqf-section-title">&#128663; Driver Compliance</div>';
  html += '<div class="dqf-grid">';
  html += '<div class="dqf-field"><label>Authorized to Drive Company Vehicle?</label><select id="p_auth"><option value="">-- Select --</option><option value="yes"' + (d.authorized_company_vehicle === 'yes' ? ' selected' : '') + '>Yes</option><option value="no"' + (d.authorized_company_vehicle === 'no' ? ' selected' : '') + '>No</option></select></div>';
  html += '<div class="dqf-field"><label>CDL Class</label><select id="p_cdl_class"><option value="none"' + (!d.cdl_class || d.cdl_class === 'none' ? ' selected' : '') + '>No CDL</option><option value="A"' + (d.cdl_class === 'A' ? ' selected' : '') + '>Class A</option><option value="B"' + (d.cdl_class === 'B' ? ' selected' : '') + '>Class B</option><option value="C"' + (d.cdl_class === 'C' ? ' selected' : '') + '>Class C</option></select></div>';
  html += '</div>';
  html += '<div class="dqf-field dqf-field-full" style="margin-top:12px;"><label>CDL Endorsements</label><div style="display:flex;flex-wrap:wrap;gap:10px;font-size:13px;">' + endoHtml + '</div></div>';
  html += '<div class="dqf-grid" style="margin-top:12px;">';
  html += '<div class="dqf-field"><label>DL Front Photo</label><div class="dqf-file-row"><input type="file" id="p_dl_front" accept="image/*"><div class="dqf-file-placeholder">&#128247;</div></div></div>';
  html += '<div class="dqf-field"><label>DL Back Photo</label><div class="dqf-file-row"><input type="file" id="p_dl_back" accept="image/*"><div class="dqf-file-placeholder">&#128247;</div></div></div>';
  html += '</div></div>';

  // Driving Record
  html += '<div class="dqf-section"><div class="dqf-section-title">&#128202; Driving Record ' + badge(d.driving_record_status) + '</div>';
  html += '<div class="dqf-grid">';
  html += '<div class="dqf-field"><label>Verified Date</label><input type="date" id="p_dr_verified" value="' + esc(d.driving_record_verified || '') + '"></div>';
  html += '<div class="dqf-field"><label>Recheck Date</label><input type="date" id="p_dr_recheck" value="' + esc(d.driving_record_recheck_date || '') + '"></div>';
  html += '</div>';
  html += '<div class="dqf-field dqf-field-full" style="margin-top:12px;"><label>Driving Record Document</label><div class="dqf-file-row"><input type="file" id="p_dr_doc" accept="image/*,application/pdf"><div class="dqf-file-placeholder">&#128247;</div></div></div>';
  html += '</div>';

  // Medical Card
  html += '<div class="dqf-section"><div class="dqf-section-title">&#127973; DOT Medical Card ' + badge(d.medical_card_status) + '</div>';
  html += '<div class="dqf-grid">';
  html += '<div class="dqf-field"><label>Expiration Date</label><input type="date" id="p_med_exp" value="' + esc(d.medical_card_expiration || '') + '"></div>';
  html += '</div>';
  html += '<div class="dqf-field dqf-field-full" style="margin-top:12px;"><label>Medical Card Document</label><div class="dqf-file-row"><input type="file" id="p_med_doc" accept="image/*,application/pdf"><div class="dqf-file-placeholder">&#128247;</div></div></div>';
  html += '</div>';

  // Background Check
  html += '<div class="dqf-section"><div class="dqf-section-title">&#128270; Background Check ' + badge(d.background_check_status) + '</div>';
  html += '<div class="dqf-grid">';
  html += '<div class="dqf-field"><label>Check Date</label><input type="date" id="p_bg_date" value="' + esc(d.background_check_date || '') + '"></div>';
  html += '<div class="dqf-field"><label>Recheck Date</label><input type="date" id="p_bg_recheck" value="' + esc(d.background_check_recheck || '') + '"></div>';
  html += '</div></div>';

  // Drug Test
  html += '<div class="dqf-section"><div class="dqf-section-title">&#128138; Drug Test ' + badge(d.drug_test_status) + '</div>';
  html += '<div class="dqf-grid">';
  html += '<div class="dqf-field"><label>Test Date</label><input type="date" id="p_dt_date" value="' + esc(d.drug_test_date || '') + '"></div>';
  html += '<div class="dqf-field"><label>Recheck Date</label><input type="date" id="p_dt_recheck" value="' + esc(d.drug_test_recheck || '') + '"></div>';
  html += '</div></div>';

  // Employee-Owned Assets
  html += '<div class="dqf-section"><div class="dqf-section-title">&#128666; Employee-Owned Assets</div>';
  html += '<div class="dqf-toggle-row"><label>Will this driver provide personal assets for business use?</label>';
  html += '<div class="dqf-toggle"><input type="checkbox" id="p_has_assets" onchange="toggleDqfAssets()"><span class="dqf-toggle-slider"></span></div></div>';
  html += '<div id="p_assets_container" style="display:none;">';
  html += '<button class="dqf-btn dqf-btn-save" style="margin-bottom:12px;" onclick="addDqfAssetCard()">&#43; Add Asset</button>';
  html += '<div id="p_assets_list"></div>';
  html += '</div></div>';

  // Save bar
  html += '<div class="dqf-save-bar">';
  html += '<button class="dqf-btn dqf-btn-later" onclick="saveDqfProfile(false)">Save &amp; Come Back Later</button>';
  html += '<button class="dqf-btn dqf-btn-save" onclick="saveDqfProfile(true)">Save &amp; Complete</button>';
  html += '</div>';

  document.getElementById('dqfProfileContent').innerHTML = html;
}

// ============================================================
// ASSETS
// ============================================================
function toggleDqfAssets() {
  var cb = document.getElementById('p_has_assets');
  var container = document.getElementById('p_assets_container');
  if (cb && container) container.style.display = cb.checked ? 'block' : 'none';
}

function loadDriverAssets(driverId) {
  fetch('/api/employee-owned-assets?employee_id=' + encodeURIComponent(driverId))
    .then(function(r) { return r.ok ? r.json() : { records: [] }; })
    .then(function(data) {
      var assets = data.records || data.data || [];
      if (!Array.isArray(assets)) assets = [];
      if (assets.length > 0) {
        document.getElementById('p_has_assets').checked = true;
        toggleDqfAssets();
      }
      assets.forEach(function(a) { addDqfAssetCard(a); });
    })
    .catch(function() {});
}

function addDqfAssetCard(existing) {
  step2AssetCounter++;
  var cid = 'dqf_asset_' + step2AssetCounter;
  var a = existing || {};
  var isVehicle = (a.asset_type === 'vehicle');
  var html = '<div class="dqf-asset-card" id="' + cid + '" data-asset-id="' + (a.id || '') + '">' +
    '<div class="dqf-asset-card-header"><div class="dqf-asset-card-title">Asset #' + step2AssetCounter + (a.asset_type ? ' — ' + a.asset_type : '') + '</div>' +
    '<button class="dqf-asset-remove" onclick="removeDqfAssetCard(\'' + cid + '\')">Remove</button></div>' +
    '<div class="dqf-grid">' +
      '<div class="dqf-field"><label>Asset Type</label><select onchange="onDqfAssetTypeChange(\'' + cid + '\')" id="' + cid + '_type">' +
        '<option value="">-- Select --</option>' +
        '<option value="vehicle"' + (isVehicle ? ' selected' : '') + '>Vehicle</option>' +
        '<option value="welding"' + (a.asset_type === 'welding' ? ' selected' : '') + '>Welding Machine</option>' +
        '<option value="equipment"' + (a.asset_type === 'equipment' ? ' selected' : '') + '>Equipment</option>' +
        '<option value="generator"' + (a.asset_type === 'generator' ? ' selected' : '') + '>Generator</option>' +
        '<option value="other"' + (a.asset_type === 'other' ? ' selected' : '') + '>Other</option>' +
      '</select></div>' +
      '<div class="dqf-field"><label>Description</label><input type="text" id="' + cid + '_desc" value="' + esc(a.asset_description || '') + '"></div>' +
      '<div class="dqf-field"><label>Make</label><input type="text" id="' + cid + '_make" value="' + esc(a.make || '') + '"></div>' +
      '<div class="dqf-field"><label>Model</label><input type="text" id="' + cid + '_model" value="' + esc(a.model || '') + '"></div>' +
      '<div class="dqf-field"><label>Year</label><input type="text" id="' + cid + '_year" value="' + esc(a.year || '') + '"></div>' +
      '<div class="dqf-field"><label>Serial Number</label><input type="text" id="' + cid + '_serial" value="' + esc(a.serial_number || '') + '"></div>' +
      '<div class="dqf-field"><label>Start Date</label><input type="date" id="' + cid + '_start" value="' + esc(a.start_date || '') + '"></div>' +
    '</div>' +
    '<div class="dqf-asset-vehicle-fields' + (isVehicle ? ' show' : '') + '" id="' + cid + '_vehicle">' +
      '<div class="dqf-grid" style="margin-top:8px;">' +
        '<div class="dqf-field"><label>VIN</label><input type="text" id="' + cid + '_vin" value="' + esc(a.vin || '') + '"></div>' +
        '<div class="dqf-field"><label>Insurance Carrier</label><input type="text" id="' + cid + '_ins_carrier" value="' + esc(a.insurance_carrier || '') + '"></div>' +
        '<div class="dqf-field"><label>Insurance Policy #</label><input type="text" id="' + cid + '_ins_policy" value="' + esc(a.insurance_policy_num || '') + '"></div>' +
        '<div class="dqf-field"><label>Insurance Expiration</label><input type="date" id="' + cid + '_ins_exp" value="' + esc(a.insurance_expiration || '') + '"></div>' +
      '</div>' +
      '<div class="dqf-field dqf-field-full" style="margin-top:8px;"><label>Insurance Document</label><div class="dqf-file-row"><input type="file" id="' + cid + '_ins_doc" accept="image/*,application/pdf"><div class="dqf-file-placeholder">&#128247;</div></div></div>' +
      '<div class="dqf-field dqf-field-full" style="margin-top:8px;"><label>Registration Document</label><div class="dqf-file-row"><input type="file" id="' + cid + '_reg_doc" accept="image/*,application/pdf"><div class="dqf-file-placeholder">&#128247;</div></div></div>' +
      '<div class="dqf-field" style="margin-top:8px;"><label>Registration Expiration</label><input type="date" id="' + cid + '_reg_exp" value="' + esc(a.registration_exp || '') + '"></div>' +
    '</div>' +
    '<div class="dqf-field dqf-field-full" style="margin-top:8px;"><label>Notes</label><textarea id="' + cid + '_notes" rows="2">' + esc(a.notes || '') + '</textarea></div>' +
  '</div>';
  var list = document.getElementById('p_assets_list');
  if (list) list.insertAdjacentHTML('beforeend', html);
}

function onDqfAssetTypeChange(cid) {
  var sel = document.getElementById(cid + '_type');
  var veh = document.getElementById(cid + '_vehicle');
  if (sel && veh) veh.classList.toggle('show', sel.value === 'vehicle');
}

function removeDqfAssetCard(cid) {
  var card = document.getElementById(cid);
  if (card) {
    var aid = card.getAttribute('data-asset-id');
    if (aid) { try { fetch('/api/employee-owned-assets/' + encodeURIComponent(aid), { method: 'DELETE' }); } catch(e){} }
    card.remove();
  }
}

// ============================================================
// SAVE
// ============================================================
function calcStatus(expDate) {
  if (!expDate) return 'none';
  var now = new Date(); now.setHours(0,0,0,0);
  var exp = new Date(expDate); exp.setHours(0,0,0,0);
  var diff = Math.floor((exp - now) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 7) return '7day';
  if (diff <= 30) return '30day';
  return 'current';
}

async function saveDqfProfile(complete) {
  var endorsements = [];
  document.querySelectorAll('#dqfProfileContent input[type=checkbox]:checked').forEach(function(cb) {
    if (cb.id && cb.id.startsWith('p_cdl_')) endorsements.push(cb.value);
  });

  var payload = {
    authorized_company_vehicle: getV('p_auth'),
    cdl_class: getV('p_cdl_class'),
    cdl_endorsements: endorsements.join(','),
    driving_record_verified: getV('p_dr_verified'),
    driving_record_recheck_date: getV('p_dr_recheck'),
    driving_record_status: calcStatus(getV('p_dr_recheck')),
    medical_card_expiration: getV('p_med_exp'),
    medical_card_status: calcStatus(getV('p_med_exp')),
    background_check_date: getV('p_bg_date'),
    background_check_recheck: getV('p_bg_recheck'),
    background_check_status: calcStatus(getV('p_bg_recheck')),
    drug_test_date: getV('p_dt_date'),
    drug_test_recheck: getV('p_dt_recheck'),
    drug_test_status: calcStatus(getV('p_dt_recheck')),
    auto_policy_status: 'none',
    step2_status: complete ? 'complete' : 'incomplete'
  };

  // Auto policy from vehicle assets
  var hasVehicle = false;
  var earliestIns = null;
  document.querySelectorAll('.dqf-asset-card').forEach(function(card) {
    var ts = card.querySelector('select[id$="_type"]');
    if (ts && ts.value === 'vehicle') {
      hasVehicle = true;
      var ie = card.querySelector('input[id$="_ins_exp"]');
      if (ie && ie.value && (!earliestIns || ie.value < earliestIns)) earliestIns = ie.value;
    }
  });
  if (hasVehicle) payload.auto_policy_status = calcStatus(earliestIns);

  try {
    await fetch('/api/employees/' + encodeURIComponent(currentDriverId), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
  } catch(e) { console.warn('Save failed:', e); }

  // Save assets
  var cards = document.querySelectorAll('.dqf-asset-card');
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i], cid = card.id;
    var ad = {
      employee_id: currentDriverId, org_id: currentUserOrgId,
      asset_type: getV(cid + '_type'), asset_description: getV(cid + '_desc'),
      make: getV(cid + '_make'), model: getV(cid + '_model'), year: getV(cid + '_year'),
      serial_number: getV(cid + '_serial'), vin: getV(cid + '_vin'),
      insurance_carrier: getV(cid + '_ins_carrier'), insurance_policy_num: getV(cid + '_ins_policy'),
      insurance_expiration: getV(cid + '_ins_exp'), registration_exp: getV(cid + '_reg_exp'),
      start_date: getV(cid + '_start'), notes: getV(cid + '_notes')
    };
    if (ad.asset_type === 'vehicle') ad.insurance_status = calcStatus(ad.insurance_expiration);
    var aid = card.getAttribute('data-asset-id');
    try {
      if (aid) {
        await fetch('/api/employee-owned-assets/' + encodeURIComponent(aid), { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(ad) });
      } else {
        ad.id = 'eoa_' + Date.now() + '_' + i;
        await fetch('/api/employee-owned-assets', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(ad) });
      }
    } catch(e) { console.warn('Asset save failed:', e); }
  }

  // Update local
  var d = allDrivers.find(function(x) { return x.id === currentDriverId; });
  if (d) Object.assign(d, payload);

  showToast(complete ? 'Driver qualification file completed and saved.' : 'Saved. You can complete the file later.');
  await loadDrivers();
  renderDriverTable();
  updateKpis();
  checkReminders();
  dqfSwitchTab('list');
}

// ============================================================
// MODALS
// ============================================================
function dqfShowModal(type) {
  var tab = document.querySelector('.dqf-tab-content.active');
  var key = tab ? tab.id.replace('dqf-tab-','') : 'overview';
  var content = DQF_MODAL_MAP[key] || DQF_MODAL_MAP.overview;
  document.getElementById('dqfModalTitle').textContent = type === 'purpose' ? 'Purpose' : 'Instructions';
  document.getElementById('dqfModalBody').innerHTML = type === 'purpose' ? content.purpose : content.instructions;
  document.getElementById('dqfModal').classList.add('active');
}

function dqfCloseModal() {
  document.getElementById('dqfModal').classList.remove('active');
}

// ============================================================
// UTILS
// ============================================================
function getV(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function showToast(msg) {
  var t = document.getElementById('dqfToast');
  if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(function() { t.classList.remove('show'); }, 3000); }
}
