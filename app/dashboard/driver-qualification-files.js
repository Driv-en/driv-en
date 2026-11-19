/**
 * driver-qualification-files.js — DRIV-EN Driver Qualification Files (v1)
 *
 * Manages DOT compliance for commercial drivers: DL photos, CDL, driving record,
 * DOT medical card, background check, drug test, and employee-owned assets with
 * insurance/registration expiration tracking.
 */

var allDrivers = [];
var currentDriverId = null;
var currentDriver = null;
var dnaSettings = { model: 'driven', tpa_name: '', tpa_contact: '', tpa_account: '', clearinghouse_tracking: false };
var currentUserOrgId = '';
var step2AssetCounter = 0;

var DQF_MODAL_MAP = {
  overview: {
    purpose: 'The <strong>Driver Qualification Files</strong> page is the landing page for DOT compliance management. It displays key metrics (Total Drivers, Pending, Expired, Current) and provides navigation to the driver list.',
    instructions: '<ol><li><strong>KPI Cards:</strong> Click any KPI card to jump to the Driver List.</li><li><strong>Driver List:</strong> Click the Driver List tab to see all commercial drivers with their compliance status badges.</li><li><strong>Migrate from Previous Provider:</strong> Click the green <strong>&#128230; Migrate from Previous Provider</strong> button in the pill bar to bulk-import driver DQF data from J.J. Keller, Tenstreet, Motive/Samsara, or any generic CSV. The wizard auto-detects competitor column headers, maps them to DRIV-EN fields, validates dates and CDL classes, shows a preview, and lets you commit or undo.</li><li><strong>Driver Profile:</strong> Click any driver to open their full qualification file — DL photos, CDL, driving record, medical card, background check, drug test, and employee-owned assets.</li><li><strong>Personalization:</strong> The Light/Dark toggle, Units of Measure, and Language selectors are in the welcome bar above.</li></ol>'
  },
  list: {
    purpose: 'The <strong>Driver List</strong> shows all commercial drivers and their current compliance status for each required item. Status badges are color-coded: green (current), yellow (30 days), orange (7 days), red (expired), gray (not set). Use the <strong>Migrate from Previous Provider</strong> button to bulk-import drivers from J.J. Keller, Tenstreet, Motive/Samsara, or any CSV.',
    instructions: '<ol><li><strong>Review Status:</strong> Each row shows the driver name, CDL class, and status badges for DL, Medical Card, Drug Test, Background Check, and Auto Policy.</li><li><strong>Docs Column:</strong> Shows how many of the 12 required documents are uploaded (e.g., 5/12). Hover to see which documents are present or missing. Green = all uploaded, orange = some missing, red = none uploaded.</li><li><strong>File Status:</strong> The File Status column shows one of three statuses:<br>&bull; <strong>Complete</strong> (green) — all data fields filled AND all 12 required documents uploaded<br>&bull; <strong>Docs Required</strong> (yellow) — all data fields filled but documents still need to be uploaded<br>&bull; <strong>Incomplete</strong> (orange) — data fields are still missing (dates, statuses, etc.)<br>The system automatically determines the status when you save. A file imported from a competitor starts as "Docs Required" since the CSV provides data but not document files.</li><li><strong>Migrate from Previous Provider:</strong> Click the green <strong>&#128230; Migrate from Previous Provider</strong> button to upload a CSV from J.J. Keller, Tenstreet, Motive/Samsara, or any generic format.</li><li><strong>Open Profile:</strong> Click <strong>Open File</strong> on any row to view and edit the full compliance profile.</li><li><strong>Back:</strong> Click <strong>&#8592; Back to Driver List</strong> in the pill bar to return.</li></ol>'
  },
  profile: {
    purpose: 'The <strong>Driver Profile</strong> is the full Driver Qualification File for a single commercial driver. It contains all DOT-required compliance documents and tracking, plus employee-owned assets with insurance and registration expiration tracking.',
    instructions: '<ol><li><strong>Driver Compliance:</strong> Enter authorized company vehicle status, CDL class and endorsements, and upload DL front/back photos.</li><li><strong>Driving Record:</strong> Enter verified date, recheck date, and upload the driving record document. Status auto-calculates.</li><li><strong>DOT Medical Card:</strong> Enter expiration date and upload the document. Status auto-calculates.</li><li><strong>Background Check:</strong> Enter check date and recheck date. Status auto-calculates.</li><li><strong>Drug Test:</strong> Enter test date, reason (Pre-Employment, Post-Accident, Random, Reasonable Suspicion, Return-to-Duty, Follow-Up), and result. Upload the test document. <em>Note: there is no per-driver annual drug test requirement — random testing is pool-based (382.305). The Drug Test badge therefore shows <strong>On File</strong> or <strong>Missing</strong>, not a date-based current/expired.</em></li><li><strong>Alcohol Test:</strong> Enter test date, reason, and result. Upload the test document.</li><li><strong>Drug &amp; Alcohol model (from Carrier Dashboard):</strong> The drug/alcohol fields shown here depend on how your company maintains those records. If set to <strong>DRIV-EN holds the records</strong>, you\'ll see the test entry fields above. If set to <strong>TPA</strong>, <strong>Clearinghouse</strong>, or <strong>Physical file</strong>, you\'ll see a reference block instead (with your TPA\'s contact info where applicable) — test entry fields are hidden. If <strong>Clearinghouse query tracking</strong> is enabled, a Clearinghouse Query section (date, type, result) appears so you can record each pre-employment/annual query.</li><li><strong>Prior Employers (49 CFR 391.23):</strong> You must investigate employment history for the <strong>past 3 years</strong>. Click <strong>+ Add Employer</strong> for each prior employer and record: employer name, from/to dates, inquiry sent date, response received date, and the safety-performance results — <strong>accidents reported</strong>, <strong>drug/alcohol violations</strong>, and <strong>refusal to test</strong> (each Yes/No/Pending, with details). Contact name, phone, fax, email, and address are optional (the address is on the attached form).</li><li><strong>Employer Contact Directory:</strong> Use the <strong>Search known employers</strong> box above the prior-employer list to look up contact info for a former carrier. Selecting a result auto-fills a new employer block with the saved contact details. The directory grows automatically as you save prior employers that have contact info, so the next hire can find that carrier\'s contact quickly.</li><li><strong>FMCSA Compliance:</strong> Fill in all applicable sections — Application (391.21), Employment Verification (391.23), Annual MVR Review (391.25), Road Test (391.31), CDLIS Verification (384.226), Safety Performance History (391.23(h)), Hazmat Background (TSA 1572), TWIC Card (49 CFR 1592). Each section has a document upload field.</li><li><strong>Additional Documents:</strong> Use the additional documents upload at the bottom of the FMCSA section for accident reports, citations, training certificates, or any other relevant documents.</li><li><strong>Document Viewer:</strong> Click the <strong>&#128065; View</strong> button next to any uploaded document to view it. The viewer supports images and PDFs with a print option.</li><li><strong>Employee-Owned Assets:</strong> Toggle \"Will this driver provide personal assets?\" If yes, click <strong>+ Add Asset</strong> for each asset (truck, welding machine, etc.). For vehicles, enter insurance carrier, policy number, expiration, and upload the insurance document. Insurance status auto-calculates with 30-day and 7-day warnings.</li><li><strong>Status badges (computed from actual data):</strong> The DL, Med Card, Background, and Auto Policy badges are calculated from their dates (recheck/expiration), so they are always accurate — even for imported drivers. Drug Test shows On File/Missing.</li><li><strong>File Status (computed from actual data):</strong><br>&bull; <strong>Complete</strong> (green) — core data present AND all 12 required documents uploaded<br>&bull; <strong>Docs Required</strong> (yellow) — core data present but documents still need to be uploaded<br>&bull; <strong>Incomplete</strong> (orange) — core data still missing (CDL, med card, driving record, drug test, background)<br><em>Imported drivers start as Docs Required (data from the CSV, no documents yet) — they are never shown as Complete until documents are uploaded.</em></li><li><strong>Save:</strong> Click <strong>Save &amp; Complete</strong> to mark the file as complete (only works if all data AND all 12 documents are uploaded), or <strong>Save &amp; Come Back Later</strong> to save progress. The system automatically sets the file status based on the criteria above.</li><li><strong>Print / PDF:</strong> Click <strong>&#128424; Print / PDF</strong> to generate a printable DQF summary with carrier info and all compliance data. Use your browser\'s print dialog to print or save as PDF.</li><li><strong>Back:</strong> Click <strong>&#8592; Back to Driver List</strong> to return to the list.</li></ol>'
  }
};

// ============================================================
// INITIALIZATION
// ============================================================
(async function() {
  try {
    var u = window.dashUser || window.drivenUser;
    if (!u) {
      try { u = JSON.parse(localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user") || 'null'); } catch(e) {}
    }
    if (!u) { window.location.href = '/app/auth/login.html'; return; }
    window.dashUser = u;
    currentUserOrgId = u.org_id || localStorage.getItem('driven_org_id') || localStorage.getItem('driv-en-org-id') || '';

    // Build header
    if (typeof buildDashHeader === 'function') buildDashHeader();
    if (typeof makeStickyHeader === 'function') makeStickyHeader();

    // Wire theme toggle, UOM, language (shared header elements)
    wirePersonalization();

    // Auto-translate if non-English
    if (window.DRIVEN_TRANSLATE && DRIVEN_TRANSLATE.getUILang && DRIVEN_TRANSLATE.getUILang() !== 'en') {
      DRIVEN_TRANSLATE.autoTranslateUI();
    }

    // Wire pill bar buttons
    document.getElementById('btnPurpose').addEventListener('click', function() { dqfShowModal('purpose'); });
    document.getElementById('btnInstructions').addEventListener('click', function() { dqfShowModal('instructions'); });

    // Load drivers
    await loadDrivers();
    loadCarrierInfo();
    populateDqfWelcome();
    // Apply saved column order
    if (dqfColOrder && dqfColOrder.length) {
      var ordered = [];
      dqfColOrder.forEach(function(k) { var c = DQF_COL_DEFS.find(function(d) { return d.key === k; }); if (c) ordered.push(c); });
      DQF_COL_DEFS.forEach(function(c) { if (dqfColOrder.indexOf(c.key) === -1) ordered.push(c); });
      DQF_COL_DEFS = ordered;
    }
    dqfRenderTableHead();
    renderDriverTable();
    dqfInitTableFeatures();
    updateKpis();
    checkReminders();
  } catch (e) {
    console.error('DQF init error:', e);
  }
})();

function wirePersonalization() {
  var themeCheckbox = document.getElementById('dqfThemeCheckbox') || document.getElementById('dashThemeCheckbox');
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
// Load carrier info from company settings into localStorage (used by print/audit)
async function loadCarrierInfo() {
  try {
    var res = await fetch('/auth/get-settings', { credentials: 'include' });
    var data = await res.json();
    if (data && data.success && data.settings) {
      var s = data.settings;
      if (s.carrier_name) localStorage.setItem('driv_en_carrier_name', s.carrier_name);
      if (s.carrier_dot) localStorage.setItem('driv_en_dot_number', s.carrier_dot);
      if (s.carrier_mc) localStorage.setItem('driv_en_mc_number', s.carrier_mc);
      if (s.carrier_address) localStorage.setItem('driv_en_carrier_address', s.carrier_address);
      if (s.carrier_phone) localStorage.setItem('driv_en_carrier_phone', s.carrier_phone);
      if (s.carrier_scac) localStorage.setItem('driv_en_carrier_scac', s.carrier_scac);
      if (s.dna_model) localStorage.setItem('driv_en_dna_model', s.dna_model);
      // Drug & alcohol record-keeping model + reference info (drives conditional profile fields)
      dnaSettings.model = s.dna_model || 'driven';
      dnaSettings.tpa_name = s.dna_tpa_name || '';
      dnaSettings.tpa_contact = s.dna_tpa_contact || '';
      dnaSettings.tpa_account = s.dna_tpa_account || '';
      dnaSettings.clearinghouse_tracking = Boolean(s.clearinghouse_tracking);
    }
  } catch (e) { /* settings unavailable — print shows placeholder */ }
}

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
    var cs = computeDriverStatuses(d);
    return ['driving_record_status','medical_card_status','background_check_status','auto_policy_status'].some(function(k) { return cs[k] === 'expired'; });
  }).length;
  document.getElementById('kpiCurrent').textContent = allDrivers.filter(function(d) {
    var cs = computeDriverStatuses(d);
    return computeFileStatus(d) === 'complete' && !['driving_record_status','medical_card_status','background_check_status','auto_policy_status'].some(function(k) { return cs[k] === 'expired' || cs[k] === '7day' || cs[k] === '30day'; });
  }).length;
  // Documents Needed: drivers missing one or more required documents
  var docsNeeded = allDrivers.filter(function(d) {
    return DQF_REQUIRED_DOCS.some(function(doc) { return !d[doc.field]; });
  }).length;
  var docsEl = document.getElementById('kpiDocsNeeded');
  if (docsEl) docsEl.textContent = docsNeeded;
  // Docs Required status count
  var docsReqEl = document.getElementById('kpiDocsRequired');
  if (docsReqEl) docsReqEl.textContent = allDrivers.filter(function(d) { return computeFileStatus(d) === 'docs_required'; }).length;
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
// ===== TABLE STATE (persisted to localStorage) =====
var dqfSortCol = localStorage.getItem('dqf_sort_col') || 'name';
var dqfSortDir = localStorage.getItem('dqf_sort_dir') || 'asc';
var dqfPage = 1;
var dqfPageSize = parseInt(localStorage.getItem('dqf_page_size')) || 25;
var dqfSearch = '';

function dqfGetSortVal(d, col) {
  if (col === 'name') return ((d.first_name || '') + ' ' + (d.last_name || '')).toLowerCase();
  if (col === 'actions') return '';
  return String(d[col] || '').toLowerCase();
}

function dqfSort(col) {
  if (col === 'actions') return;
  if (dqfSortCol === col) { dqfSortDir = dqfSortDir === 'asc' ? 'desc' : 'asc'; }
  else { dqfSortCol = col; dqfSortDir = 'asc'; }
  localStorage.setItem('dqf_sort_col', dqfSortCol);
  localStorage.setItem('dqf_sort_dir', dqfSortDir);
  dqfPage = 1;
  renderDriverTable();
}

function dqfFilterDrivers() {
  var s = (dqfSearch || '').toLowerCase();
  if (!s) return allDrivers.slice();
  return allDrivers.filter(function(d) {
    var name = ((d.first_name || '') + ' ' + (d.last_name || '')).toLowerCase();
    return name.indexOf(s) >= 0 || String(d.cdl_class || '').toLowerCase().indexOf(s) >= 0 || String(d.email || '').toLowerCase().indexOf(s) >= 0;
  });
}

function renderDriverTable() {
  var tbody = document.getElementById('dqfDriverBody');
  if (!tbody) return;
  var filtered = dqfFilterDrivers();
  filtered.sort(function(a, b) {
    var av = dqfGetSortVal(a, dqfSortCol), bv = dqfGetSortVal(b, dqfSortCol);
    if (av < bv) return dqfSortDir === 'asc' ? -1 : 1;
    if (av > bv) return dqfSortDir === 'asc' ? 1 : -1;
    return 0;
  });
  var totalPages = Math.max(1, Math.ceil(filtered.length / dqfPageSize));
  if (dqfPage > totalPages) dqfPage = totalPages;
  var start = (dqfPage - 1) * dqfPageSize;
  var pageData = filtered.slice(start, start + dqfPageSize);
  tbody.innerHTML = '';
  pageData.forEach(function(d) {
    var name = (d.first_name || '') + ' ' + (d.last_name || '');
    if (!name.trim()) name = d.full_name || d.email || 'Unknown';
    var tr = document.createElement('tr');
    var cells = '';
    var cs = computeDriverStatuses(d);
    var fs = computeFileStatus(d);
    DQF_COL_DEFS.forEach(function(col) {
      if (col.key === 'name') cells += '<td>' + esc(name) + '</td>';
      else if (col.key === 'cdl_class') cells += '<td>' + esc(d.cdl_class && d.cdl_class !== 'none' ? d.cdl_class : '\u2014') + '</td>';
      else if (col.key === 'actions') cells += '<td><button class="dqf-row-action" onclick="openDriverProfile(\'' + esc(d.id) + '\')">Open File</button></td>';
      else if (col.key === 'step2_status') cells += '<td>' + fileStatusBadge(fs) + '</td>';
      else if (col.key === 'drug_test_status') cells += '<td>' + drugTestBadge(cs.drug_test_status) + '</td>';
      else if (col.key === 'driving_record_status' || col.key === 'medical_card_status' || col.key === 'background_check_status' || col.key === 'auto_policy_status') cells += '<td>' + badge(cs[col.key]) + '</td>';
      else if (col.key === 'documents') {
        var docCount = 0;
        DQF_REQUIRED_DOCS.forEach(function(doc) { if (d[doc.field]) docCount++; });
        var docColor = docCount === DQF_DOC_COUNT ? '#16a34a' : docCount === 0 ? '#dc2626' : '#d97706';
        var docBg = docCount === DQF_DOC_COUNT ? '#dcfce7' : docCount === 0 ? '#fee2e2' : '#fef3c7';
        var docTitle = DQF_REQUIRED_DOCS.map(function(doc) { return (d[doc.field] ? '✅' : '❌') + ' ' + doc.label; }).join('\n');
        cells += '<td style="text-align:center;"><span style="background:' + docBg + '; color:' + docColor + '; padding:2px 8px; border-radius:10px; font-size:12px; font-weight:600; white-space:nowrap;" title="' + esc(docTitle) + '">' + docCount + '/' + DQF_DOC_COUNT + '</span></td>';
      }
      else cells += '<td>' + badge(d[col.key]) + '</td>';
    });
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('.dqf-table th').forEach(function(th) {
    th.classList.remove('sort-asc', 'sort-desc');
    var col = th.getAttribute('data-col');
    if (col === dqfSortCol) th.classList.add(dqfSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
  });
  var pgInfo = document.getElementById('dqfPageInfo');
  if (pgInfo) pgInfo.textContent = 'Page ' + dqfPage + ' of ' + totalPages + ' (' + filtered.length + ' drivers)';
  var pgPrev = document.getElementById('dqfPrevPage');
  if (pgPrev) pgPrev.disabled = (dqfPage <= 1);
  var pgNext = document.getElementById('dqfNextPage');
  if (pgNext) pgNext.disabled = (dqfPage >= totalPages);
}

function dqfPrevPage() { if (dqfPage > 1) { dqfPage--; renderDriverTable(); } }
function dqfNextPage() { dqfPage++; renderDriverTable(); }
function dqfSearchInput(val) { dqfSearch = val; dqfPage = 1; renderDriverTable(); }
function dqfChangePageSize(val) { dqfPageSize = parseInt(val) || 25; localStorage.setItem('dqf_page_size', dqfPageSize); dqfPage = 1; renderDriverTable(); }
function dqfPrintTable() { window.print(); }

function populateDqfWelcome() {
  var u = window.dashUser || window.drivenUser;
  if (!u) {
    try { u = JSON.parse(localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user") || '{}'); } catch(e) { u = {}; }
  }
  window.dashUser = u;
  var orgName = u.org_name || u.company_name || localStorage.getItem('driven_org_name') || '';
  var nameEl = document.getElementById('dqf-welcome-name');
  if (nameEl) {
    var fn = u.first_name || u.firstName || '';
    var ln = u.last_name || u.lastName || '';
    var full = u.full_name || u.name || '';
    var name = full || ((fn + ' ' + ln).trim()) || '';
    nameEl.textContent = name ? ('Welcome back, ' + name + (orgName ? ' \u2014 ' + orgName : '')) : 'Welcome back';
  }
  var roleEl = document.getElementById('dqf-welcome-role');
  if (roleEl) roleEl.textContent = u.role || u.role_name || u.role_id || '';
  var emailEl = document.getElementById('dqf-welcome-email');
  if (emailEl) emailEl.textContent = u.email || '';
}

// ===== COLUMN RESIZE & DRAG-AND-DROP (ported from user-management) =====
var DQF_COL_DEFS = [
  { key: 'name', label: 'Driver Name', w: 180 },
  { key: 'cdl_class', label: 'CDL Class', w: 90 },
  { key: 'driving_record_status', label: 'DL Status', w: 120 },
  { key: 'medical_card_status', label: 'Med Card', w: 110 },
  { key: 'drug_test_status', label: 'Drug Test', w: 100 },
  { key: 'background_check_status', label: 'Background', w: 130 },
  { key: 'auto_policy_status', label: 'Auto Policy', w: 100 },
  { key: 'documents', label: 'Docs', w: 70 },
  { key: 'step2_status', label: 'File Status', w: 100 },
  { key: 'actions', label: 'Actions', w: 100 }
];
var dqfColWidths = {};
var dqfColOrder = [];
try { dqfColWidths = JSON.parse(localStorage.getItem('dqf_col_widths') || '{}'); } catch(e) {}
try { dqfColOrder = JSON.parse(localStorage.getItem('dqf_col_order') || '[]'); } catch(e) {}

function dqfApplyColWidths() {
  var table = document.getElementById('dqfDriverTable');
  if (!table) return;
  table.style.tableLayout = 'fixed';
  table.style.width = 'max-content';
  DQF_COL_DEFS.forEach(function(col) {
    var w = dqfColWidths[col.key] || (col.w + 'px');
    var th = table.querySelector('th[data-col-key="' + col.key + '"]');
    if (th) { th.style.width = w; th.style.minWidth = w; th.style.maxWidth = w; }
    var idx = Array.from(th ? th.parentNode.children : []).indexOf(th);
    if (idx >= 0) {
      table.querySelectorAll('tbody tr').forEach(function(row) {
        if (row.children[idx]) { row.children[idx].style.width = w; row.children[idx].style.minWidth = w; row.children[idx].style.maxWidth = w; }
      });
    }
  });
}

function dqfInitColResize() {
  var resizers = document.querySelectorAll('.dqf-resizer');
  resizers.forEach(function(resizer) {
    resizer.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      e.preventDefault();
      var th = resizer.parentNode;
      var table = th.closest('table');
      var startX = e.pageX;
      var startWidth = th.offsetWidth;
      var colKey = th.getAttribute('data-col-key');
      var colIndex = Array.from(th.parentNode.children).indexOf(th);

      function onMove(me) {
        var newWidth = Math.max(60, startWidth + (me.pageX - startX)) + 'px';
        th.style.width = newWidth;
        th.style.minWidth = newWidth;
        th.style.maxWidth = newWidth;
        if (table) {
          table.querySelectorAll('tbody tr').forEach(function(row) {
            if (row.children[colIndex]) { row.children[colIndex].style.width = newWidth; row.children[colIndex].style.minWidth = newWidth; row.children[colIndex].style.maxWidth = newWidth; }
          });
        }
        dqfColWidths[colKey] = newWidth;
      }
      function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        localStorage.setItem('dqf_col_widths', JSON.stringify(dqfColWidths));
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
    });
  });
}

function dqfAttachDragDrop() {
  var draggedKey = null;
  var headers = document.querySelectorAll('#dqfDriverTable th.draggable-th');
  headers.forEach(function(th) {
    th.addEventListener('dragstart', function(e) {
      draggedKey = th.getAttribute('data-col-key');
      e.dataTransfer.effectAllowed = 'move';
    });
    th.addEventListener('dragenter', function(e) {
      if (!draggedKey || draggedKey === th.getAttribute('data-col-key')) return;
      th.classList.add('drag-over-left');
    });
    th.addEventListener('dragover', function(e) { e.preventDefault(); });
    th.addEventListener('dragleave', function(e) { th.classList.remove('drag-over-left'); });
    th.addEventListener('drop', function(e) {
      e.preventDefault();
      th.classList.remove('drag-over-left');
      var targetKey = th.getAttribute('data-col-key');
      if (!draggedKey || draggedKey === targetKey) return;
      var fromIdx = DQF_COL_DEFS.findIndex(function(c) { return c.key === draggedKey; });
      var toIdx = DQF_COL_DEFS.findIndex(function(c) { return c.key === targetKey; });
      if (fromIdx !== -1 && toIdx !== -1) {
        var moved = DQF_COL_DEFS.splice(fromIdx, 1)[0];
        DQF_COL_DEFS.splice(toIdx, 0, moved);
        localStorage.setItem('dqf_col_order', JSON.stringify(DQF_COL_DEFS.map(function(c) { return c.key; })));
        dqfRenderTableHead();
        renderDriverTable();
      }
    });
  });
}

function dqfRenderTableHead() {
  var thead = document.querySelector('#dqfDriverTable thead tr');
  if (!thead) return;
  thead.innerHTML = '';
  DQF_COL_DEFS.forEach(function(col) {
    var th = document.createElement('th');
    th.setAttribute('data-col', col.key);
    th.setAttribute('data-col-key', col.key);
    if (col.key !== 'actions') {
      th.className = 'draggable-th';
      th.setAttribute('draggable', 'true');
      th.setAttribute('onclick', 'dqfSort(\'' + col.key + '\')');
    }
    th.innerHTML = col.label + (col.key !== 'actions' ? '<span class="dqf-resizer"></span>' : '');
    thead.appendChild(th);
  });
}

function dqfInitTableFeatures() {
  dqfApplyColWidths();
  dqfInitColResize();
  dqfAttachDragDrop();
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
  if (s === 'docs_required') return '<span class="um-status-badge um-status-30day">Docs Required</span>';
  if (s === 'complete') return '<span class="um-status-badge um-status-current">Complete</span>';
  if (s === 'not_needed') return '<span class="um-status-badge um-status-none">N/A</span>';
  return '<span class="um-status-badge um-status-none">—</span>';
}

// Derive a due/recheck date by adding months to a base date
function addMonths(dateStr, months) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Compute display statuses from ACTUAL data (not the stored status columns),
// so imported drivers and edited drivers are always accurate.
function computeDriverStatuses(d) {
  var medCard = calcStatus(d.medical_card_expiration);
  var drivingRecord = calcStatus(d.driving_record_recheck_date || addMonths(d.driving_record_verified, 12));
  var background = calcStatus(d.background_check_recheck || addMonths(d.background_check_date, 12));
  // Drug tests have no per-driver annual requirement (random is pool-based).
  // When records are held elsewhere (TPA/Clearinghouse/physical), show 'external'.
  var drugTest;
  if (dnaSettings.model === 'driven') {
    drugTest = (d.drug_test_date || d.dqf_preemp_drug_date) ? 'on_file' : 'missing';
  } else {
    drugTest = 'external';
  }
  var autoPolicy = d.auto_policy_status || 'none';
  return {
    medical_card_status: medCard,
    driving_record_status: drivingRecord,
    background_check_status: background,
    drug_test_status: drugTest,
    auto_policy_status: autoPolicy
  };
}

function drugTestBadge(status) {
  if (status === 'on_file') return '<span class="um-status-badge um-status-current">On File</span>';
  if (status === 'external') return '<span class="um-status-badge um-status-pending">External</span>';
  return '<span class="um-status-badge um-status-none">Missing</span>';
}

// Compute File Status dynamically: complete / docs_required / incomplete
function computeFileStatus(d) {
  var missingDocs = checkMissingDocuments(d);
  if (missingDocs.length === 0) return 'complete';
  var core = ['cdl_class','medical_card_expiration','driving_record_verified','drug_test_date','background_check_date'];
  var missingCore = core.filter(function (f) { var v = d[f]; return !v || v === '' || v === 'none' || v === 'pending'; });
  return missingCore.length > 0 ? 'incomplete' : 'docs_required';
}

// ============================================================
// PRIOR EMPLOYERS (49 CFR 391.23) + EMPLOYER CONTACT DIRECTORY
// ============================================================
var priorEmployers = [];

function parsePriorEmployers(raw) {
  if (!raw) return [];
  try { var arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
}

function ynOpts(val) {
  var opts = [['', '—'], ['yes', 'Yes'], ['no', 'No'], ['pending', 'Pending']];
  return opts.map(function (o) { return '<option value="' + o[0] + '"' + (val === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
}

function renderPriorEmployers() {
  var container = document.getElementById('p_prior_employers_container');
  if (!container) return;
  if (!priorEmployers.length) {
    container.innerHTML = '<div style="font-size:12px; color:var(--text-muted,#64748b); padding:8px;">No prior employers added yet. Click "+ Add Employer" to add one (required for the past 3 years).</div>';
    return;
  }
  var html = '';
  priorEmployers.forEach(function (e, i) {
    html += '<div class="pe-block" data-idx="' + i + '" style="border:1px solid var(--border,#cbd5e1); border-radius:8px; padding:12px; margin-bottom:12px; background:var(--bg-card,#fff);">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><strong style="font-size:13px;">Employer #' + (i + 1) + '</strong><button type="button" onclick="removePriorEmployer(' + i + ')" style="padding:4px 10px; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; border-radius:4px; cursor:pointer; font-size:12px;">Remove</button></div>';
    html += '<div class="dqf-grid">';
    html += '<div class="dqf-field dqf-field-full"><label>Employer Name</label><input type="text" id="pe_' + i + '_name" value="' + esc(e.name || '') + '"></div>';
    html += '<div class="dqf-field"><label>From (date)</label><input type="date" id="pe_' + i + '_from" value="' + esc(e.from || '') + '"></div>';
    html += '<div class="dqf-field"><label>To (date)</label><input type="date" id="pe_' + i + '_to" value="' + esc(e.to || '') + '"></div>';
    html += '<div class="dqf-field"><label>Inquiry Sent</label><input type="date" id="pe_' + i + '_inquiry" value="' + esc(e.inquiry_date || '') + '"></div>';
    html += '<div class="dqf-field"><label>Response Received</label><input type="date" id="pe_' + i + '_response" value="' + esc(e.response_date || '') + '"></div>';
    html += '<div class="dqf-field"><label>Accidents Reported</label><select id="pe_' + i + '_accidents">' + ynOpts(e.accidents) + '</select></div>';
    html += '<div class="dqf-field"><label>Drug/Alcohol Violations</label><select id="pe_' + i + '_drug">' + ynOpts(e.drug_alcohol) + '</select></div>';
    html += '<div class="dqf-field"><label>Refusal to Test</label><select id="pe_' + i + '_refusal">' + ynOpts(e.refusal) + '</select></div>';
    html += '<div class="dqf-field dqf-field-full"><label>Accident Details (if any)</label><input type="text" id="pe_' + i + '_accidents_details" value="' + esc(e.accidents_details || '') + '"></div>';
    html += '<div class="dqf-field dqf-field-full"><label>Drug/Alcohol Details (if any)</label><input type="text" id="pe_' + i + '_drug_details" value="' + esc(e.drug_alcohol_details || '') + '"></div>';
    html += '<div class="dqf-field"><label>Contact Name</label><input type="text" id="pe_' + i + '_contact_name" value="' + esc(e.contact_name || '') + '"></div>';
    html += '<div class="dqf-field"><label>Phone</label><input type="text" id="pe_' + i + '_phone" value="' + esc(e.phone || '') + '"></div>';
    html += '<div class="dqf-field"><label>Fax</label><input type="text" id="pe_' + i + '_fax" value="' + esc(e.fax || '') + '"></div>';
    html += '<div class="dqf-field"><label>Email</label><input type="text" id="pe_' + i + '_email" value="' + esc(e.email || '') + '"></div>';
    html += '<div class="dqf-field dqf-field-full"><label>Address (optional)</label><input type="text" id="pe_' + i + '_address" value="' + esc(e.address || '') + '"></div>';
    html += '</div></div>';
  });
  container.innerHTML = html;
}

function addPriorEmployer(prefill) {
  collectPriorEmployers();
  priorEmployers.push(prefill || { name: '', from: '', to: '', inquiry_date: '', response_date: '', accidents: '', drug_alcohol: '', refusal: '', accidents_details: '', drug_alcohol_details: '', contact_name: '', phone: '', fax: '', email: '', address: '' });
  renderPriorEmployers();
}

function removePriorEmployer(idx) {
  collectPriorEmployers();
  priorEmployers.splice(idx, 1);
  renderPriorEmployers();
}

function collectPriorEmployers() {
  var blocks = document.querySelectorAll('#p_prior_employers_container .pe-block');
  if (!blocks.length) return priorEmployers;
  var arr = [];
  blocks.forEach(function (b) {
    var i = b.getAttribute('data-idx');
    function v(f) { var el = document.getElementById('pe_' + i + '_' + f); return el ? el.value : ''; }
    arr.push({
      name: v('name'), from: v('from'), to: v('to'),
      inquiry_date: v('inquiry'), response_date: v('response'),
      accidents: v('accidents'), drug_alcohol: v('drug'), refusal: v('refusal'),
      accidents_details: v('accidents_details'), drug_alcohol_details: v('drug_details'),
      contact_name: v('contact_name'), phone: v('phone'), fax: v('fax'), email: v('email'), address: v('address')
    });
  });
  priorEmployers = arr;
  return arr;
}

var _empSearchTimer = null;
function searchEmployerDirectory(q) {
  var resultsEl = document.getElementById('p_employer_search_results');
  if (!resultsEl) return;
  q = (q || '').trim();
  if (q.length < 2) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
  clearTimeout(_empSearchTimer);
  _empSearchTimer = setTimeout(function () {
    fetch('/api/employer-contacts?search=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var contacts = (data && data.contacts) || [];
        if (!contacts.length) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
        var h = '<div style="border:1px solid var(--border,#cbd5e1); border-radius:6px; background:var(--bg-card,#fff); max-height:220px; overflow:auto;">';
        contacts.forEach(function (c) {
          var payload = JSON.stringify(c).replace(/'/g, '&#39;');
          h += '<div onclick=\'useEmployerContact(' + payload + ')\' style="padding:8px 12px; border-bottom:1px solid var(--border,#e2e8f0); cursor:pointer; font-size:13px;">';
          h += '<strong>' + esc(c.employer_name) + '</strong>';
          var bits = [c.contact_name, c.phone, c.email].filter(Boolean).join(' · ');
          if (bits) h += '<div style="font-size:12px; color:var(--text-muted,#64748b);">' + esc(bits) + '</div>';
          h += '</div>';
        });
        h += '</div>';
        resultsEl.innerHTML = h;
        resultsEl.style.display = 'block';
      }).catch(function () {});
  }, 250);
}

function useEmployerContact(c) {
  addPriorEmployer({
    name: c.employer_name || '', from: '', to: '', inquiry_date: '', response_date: '',
    accidents: '', drug_alcohol: '', refusal: '', accidents_details: '', drug_alcohol_details: '',
    contact_name: c.contact_name || '', phone: c.phone || '', fax: c.fax || '', email: c.email || '', address: c.address || ''
  });
  var resultsEl = document.getElementById('p_employer_search_results');
  if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
  var searchEl = document.getElementById('p_employer_search');
  if (searchEl) searchEl.value = '';
}

// ============================================================
// TAB SWITCHING
// ============================================================
function dqfSwitchTab(tab) {
  document.querySelectorAll('.dqf-tab-content').forEach(function(c) { c.classList.remove('active'); });
  var target = document.getElementById('dqf-tab-' + tab);
  if (target) target.classList.add('active');
  var backBtn = document.getElementById('dqfBackBtn');
  if (backBtn) {
    if (tab === 'list') {
      backBtn.style.display = 'inline-flex';
      backBtn.innerHTML = '&#8592; Back to Overview';
      backBtn.onclick = function() { dqfSwitchTab('overview'); };
    } else if (tab === 'profile') {
      backBtn.style.display = 'inline-flex';
      backBtn.innerHTML = '&#8592; Back to Driver List';
      backBtn.onclick = function() { dqfSwitchTab('list'); };
    } else {
      backBtn.style.display = 'none';
    }
  }
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
  currentDriver = driver;
  var name = (driver.first_name || '') + ' ' + (driver.last_name || '');
  if (!name.trim()) name = driver.full_name || 'Driver';
  dqfSwitchTab('profile');
  renderProfile(driver);
  loadDriverAssets(driverId);
}

function renderProfile(d) {
  currentDriver = d;
  var name = (d.first_name || '') + ' ' + (d.last_name || '');
  if (!name.trim()) name = d.full_name || 'Driver';
  var endorsements = (d.cdl_endorsements || '').split(',').filter(Boolean);
  var endoHtml = ['air_brakes','hazmat','tanker','passenger','doubles','school_bus'].map(function(v) {
    var label = CDL_ENDORS_LABELS[v] || v.replace('_',' ').replace(/\b\w/g,function(c){return c.toUpperCase()});
    return '<label><input type="checkbox" id="p_cdl_' + v + '" value="' + v + '"' + (endorsements.includes(v) ? ' checked' : '') + '> ' + label + '</label>';
  }).join(' ');

  var html = '<div class="dqf-section" style="padding:12px 16px; margin-bottom:16px;"><div class="dqf-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">' +
    '<div class="dqf-field"><label style="font-size:11px;color:var(--text-muted,#64748b);">Employee Name</label><div style="font-weight:600;font-size:15px;color:var(--text,#0f172a);">' + esc(name) + '</div></div>' +
    '<div class="dqf-field"><label style="font-size:11px;color:var(--text-muted,#64748b);">Employee #</label><div style="font-size:14px;color:var(--text,#0f172a);">' + esc(d.employee_number || d.user_id || '—') + '</div></div>' +
    '<div class="dqf-field"><label style="font-size:11px;color:var(--text-muted,#64748b);">CDL Class</label><div style="font-size:14px;color:var(--text,#0f172a);">' + esc(d.cdl_class || '—') + '</div></div>' +
    '<div class="dqf-field"><label style="font-size:11px;color:var(--text-muted,#64748b);">Email</label><div style="font-size:14px;color:var(--text,#0f172a);word-break:break-all;">' + esc(d.email || '—') + '</div></div>' +
    '</div></div>';

  // Missing documents banner
  var missingDocs = checkMissingDocuments(d);
  if (missingDocs.length > 0) {
    html += '<div style="margin-bottom:16px; padding:10px 14px; background:#fef3c7; border:1px solid #fbbf24; border-radius:8px; font-size:13px; color:#92400e;">' +
      '<strong>⚠️ Missing Documents:</strong> ' + missingDocs.join(', ') + '. The file cannot be marked complete until these are uploaded.<br>' +
      '<span style="font-size:11px; color:#b45309;">Fields highlighted in yellow need information. Upload documents using the file inputs below.</span></div>';
  }

  // Driver Compliance
  html += '<div class="dqf-section"><div class="dqf-section-title">&#128663; Driver Compliance</div>';
  html += '<div class="dqf-grid">';
  html += '<div class="dqf-field"><label>Authorized to Drive Company Vehicle?</label><select id="p_auth"><option value="">-- Select --</option><option value="yes"' + (d.authorized_company_vehicle === 'yes' ? ' selected' : '') + '>Yes</option><option value="no"' + (d.authorized_company_vehicle === 'no' ? ' selected' : '') + '>No</option></select></div>';
  html += '<div class="dqf-field"><label>CDL Class</label><select id="p_cdl_class" onchange="updateCdlEndorsements()"><option value=""' + (!d.cdl_class || d.cdl_class === 'none' ? ' selected' : '') + '>-- Select --</option><option value="A"' + (d.cdl_class === 'A' ? ' selected' : '') + '>Class A</option><option value="B"' + (d.cdl_class === 'B' ? ' selected' : '') + '>Class B</option></select></div>';
  html += '</div>';
  html += '<div class="dqf-field dqf-field-full" style="margin-top:12px;"><label>CDL Endorsements</label><div id="p_cdl_endorsements_container" style="display:flex;flex-wrap:wrap;gap:10px;font-size:13px;">' + endoHtml + '</div></div>';
  html += '<div class="dqf-grid" style="margin-top:12px;">';
  html += '<div class="dqf-field"><label>DL Front Photo</label><div class="dqf-file-row"><input type="file" id="p_dl_front" accept="image/*" capture="environment" style="flex:1;min-width:0;">' + (d.dl_photo_front ? ' <button type="button" onclick="dqfOpenDocViewer(\'DL Front Photo\',\'' + esc(d.dl_photo_front) + '\')" style="padding:4px 10px; background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-size:12px; white-space:nowrap;">👁 View</button>' : '') + '</div></div>';
  html += '<div class="dqf-field"><label>DL Back Photo</label><div class="dqf-file-row"><input type="file" id="p_dl_back" accept="image/*" capture="environment" style="flex:1;min-width:0;">' + (d.dl_photo_back ? ' <button type="button" onclick="dqfOpenDocViewer(\'DL Back Photo\',\'' + esc(d.dl_photo_back) + '\')" style="padding:4px 10px; background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-size:12px; white-space:nowrap;">👁 View</button>' : '') + '</div></div>';
  html += '</div></div>';

  // Driving Record
  html += '<div class="dqf-section"><div class="dqf-section-title">&#128202; Driving Record ' + badge(d.driving_record_status) + '</div>';
  html += '<div class="dqf-grid">';
  html += '<div class="dqf-field"><label>Verified Date</label><input type="date" id="p_dr_verified" value="' + esc(d.driving_record_verified || '') + '"></div>';
  html += '<div class="dqf-field"><label>Recheck Date</label><input type="date" id="p_dr_recheck" value="' + esc(d.driving_record_recheck_date || '') + '"></div>';
  html += '</div>';
  html += '<div class="dqf-field dqf-field-full" style="margin-top:12px;"><label>Driving Record Document</label><div class="dqf-file-row"><input type="file" id="p_dr_doc" accept="image/*,application/pdf" capture="environment" style="flex:1;min-width:0;">' + (d.driving_record_doc ? ' <button type="button" onclick="dqfOpenDocViewer(\'Driving Record\',\'' + esc(d.driving_record_doc) + '\')" style="padding:4px 10px; background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-size:12px; white-space:nowrap;">👁 View</button>' : '') + '</div></div>';
  html += '</div>';

  // Medical Card
  html += '<div class="dqf-section"><div class="dqf-section-title">&#127973; DOT Medical Card ' + badge(d.medical_card_status) + '</div>';
  html += '<div class="dqf-grid">';
  html += '<div class="dqf-field"><label>Expiration Date</label><input type="date" id="p_med_exp" value="' + esc(d.medical_card_expiration || '') + '"></div>';
  html += '</div>';
  html += '<div class="dqf-field dqf-field-full" style="margin-top:12px;"><label>Medical Card Document</label><div class="dqf-file-row"><input type="file" id="p_med_doc" accept="image/*,application/pdf" capture="environment" style="flex:1;min-width:0;">' + (d.medical_card_doc ? ' <button type="button" onclick="dqfOpenDocViewer(\'Medical Card\',\'' + esc(d.medical_card_doc) + '\')" style="padding:4px 10px; background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-size:12px; white-space:nowrap;">👁 View</button>' : '') + '</div></div>';
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
  html += '<label class="dqf-toggle"><input type="checkbox" id="p_has_assets" onchange="toggleDqfAssets()"><span class="dqf-toggle-slider"></span></label></div>';
  html += '<div id="p_assets_container" style="display:none;">';
  html += '<button class="dqf-btn dqf-btn-save" style="margin-bottom:12px;" onclick="addDqfAssetCard()">&#43; Add Asset</button>';
  html += '<div id="p_assets_list"></div>';
  html += '</div></div>';

  // ===== FMCSA / DOT COMPLIANCE SECTIONS =====
  // Helper: generate a document upload field with View button
  function docUpload(id, label, docKey, accept) {
    var h = '<div class="dqf-field"><label>' + label + '</label><div class="dqf-file-row"><input type="file" id="' + id + '" accept="' + (accept||'image/*,application/pdf') + '" capture="environment" style="flex:1;min-width:0;">';
    if (docKey) h += ' <button type="button" onclick="dqfOpenDocViewer(\'' + label.replace(/'/g,'') + '\',\'' + esc(docKey) + '\')" style="padding:4px 10px; background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-size:12px; white-space:nowrap;">👁 View</button>';
    h += '<span class="um-status-badge ' + (docKey?'um-status-current':'um-status-none') + '">' + (docKey?'On File':'Missing') + '</span></div></div>';
    return h;
  }

  html += '<div class="dqf-section">';
  html += '<div class="dqf-section-title">📋 FMCSA / DOT Compliance — 49 CFR Part 391</div>';

  // 391.21 — Application for Employment
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>Application for Employment — Date Signed (391.21)</label><input type="date" id="p_dqf_application_date" value="' + esc(d.dqf_application_date||'') + '"></div>';
  html += docUpload('p_dqf_application_doc', 'Application Document', d.dqf_application_doc);
  html += '</div>';

  // 391.23 — Previous Employment Verification
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>Previous Employment Verification — Date Initiated (391.23)</label><input type="date" id="p_dqf_emp_verification_date" value="' + esc(d.dqf_emp_verification_date||'') + '"></div>';
  html += '<div class="dqf-field"><label>Verification Status</label><select id="p_dqf_emp_verification_status"><option value="">—</option><option value="pending"'+(d.dqf_emp_verification_status==='pending'?' selected':'')+'>Pending</option><option value="complete"'+(d.dqf_emp_verification_status==='complete'?' selected':'')+'>Complete</option><option value="incomplete"'+(d.dqf_emp_verification_status==='incomplete'?' selected':'')+'>Incomplete</option></select></div>';
  html += docUpload('p_dqf_emp_verification_doc', 'Verification Document', d.dqf_emp_verification_doc);
  html += '<div class="dqf-field dqf-field-full"><label>Prior Employers (3-year history — 49 CFR 391.23)</label>';
  html += '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;"><input type="text" id="p_employer_search" placeholder="Search known employers to auto-fill contact info…" oninput="searchEmployerDirectory(this.value)" style="flex:1; min-width:200px;"><button type="button" onclick="addPriorEmployer()" style="padding:8px 14px; background:#16a34a; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600; white-space:nowrap;">+ Add Employer</button></div>';
  html += '<div id="p_employer_search_results" style="display:none; margin-bottom:8px;"></div>';
  html += '<div id="p_prior_employers_container"></div>';
  html += '</div>';
  html += '</div>';

  // 391.25 — Annual MVR Review
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>Annual MVR Review — Date (391.25)</label><input type="date" id="p_dqf_annual_mvr_date" value="' + esc(d.dqf_annual_mvr_date||'') + '"></div>';
  html += '<div class="dqf-field"><label>Reviewer Name</label><input type="text" id="p_dqf_annual_mvr_reviewer" value="' + esc(d.dqf_annual_mvr_reviewer||'') + '"></div>';
  html += '<div class="dqf-field dqf-field-full"><label>Review Notes</label><textarea id="p_dqf_annual_mvr_notes" rows="2">' + esc(d.dqf_annual_mvr_notes||'') + '</textarea></div>';
  html += docUpload('p_dqf_annual_mvr_doc', 'Annual MVR Document', d.dqf_annual_mvr_doc);
  html += '</div>';

  // 391.27 — Annual List of Violations
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>Annual List of Violations — Certification Date (391.27)</label><input type="date" id="p_dqf_annual_violations_date" value="' + esc(d.dqf_annual_violations_date||'') + '"></div>';
  html += '<div class="dqf-field"><label>Certification</label><select id="p_dqf_annual_violations_cert"><option value="">—</option><option value="none"'+(d.dqf_annual_violations_cert==='none'?' selected':'')+'>No Violations</option><option value="reported"'+(d.dqf_annual_violations_cert==='reported'?' selected':'')+'>Violations Reported</option></select></div>';
  html += '<div class="dqf-field dqf-field-full"><label>Violation Details (if any)</label><textarea id="p_dqf_annual_violations_details" rows="2">' + esc(d.dqf_annual_violations_details||'') + '</textarea></div>';
  html += '</div>';

  // 391.31 — Road Test Certificate
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>Road Test — Date (391.31)</label><input type="date" id="p_dqf_road_test_date" value="' + esc(d.dqf_road_test_date||'') + '"></div>';
  html += '<div class="dqf-field"><label>Examiner Name</label><input type="text" id="p_dqf_road_test_examiner" value="' + esc(d.dqf_road_test_examiner||'') + '"></div>';
  html += '<div class="dqf-field"><label>Vehicle Type</label><input type="text" id="p_dqf_road_test_vehicle" value="' + esc(d.dqf_road_test_vehicle||'') + '"></div>';
  html += '<div class="dqf-field"><label>OR Equivalent Experience</label><select id="p_dqf_road_test_equiv"><option value="">—</option><option value="yes"'+(d.dqf_road_test_equiv==='yes'?' selected':'')+'>Documented</option><option value="no"'+(d.dqf_road_test_equiv==='no'?' selected':'')+'>N/A</option></select></div>';
  html += docUpload('p_dqf_road_test_doc', 'Road Test Certificate', d.dqf_road_test_doc);
  html += '</div>';

  // 382 — Drug & Alcohol Testing (conditional on record-keeping model)
  if (dnaSettings.model === 'driven') {
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>Drug Test — Date</label><input type="date" id="p_drug_test_date" value="' + esc(d.drug_test_date||'') + '"></div>';
  html += '<div class="dqf-field"><label>Drug Test Reason (382)</label><select id="p_dqf_drug_test_reason"><option value="">—</option><option value="preemployment"'+(d.dqf_drug_test_reason==='preemployment'?' selected':'')+'>Pre-Employment (382.301)</option><option value="post_accident"'+(d.dqf_drug_test_reason==='post_accident'?' selected':'')+'>Post-Accident (382.303)</option><option value="random"'+(d.dqf_drug_test_reason==='random'?' selected':'')+'>Random (382.305)</option><option value="reasonable_suspicion"'+(d.dqf_drug_test_reason==='reasonable_suspicion'?' selected':'')+'>Reasonable Suspicion (382.307)</option><option value="return_to_duty"'+(d.dqf_drug_test_reason==='return_to_duty'?' selected':'')+'>Return-to-Duty (382.309)</option><option value="follow_up"'+(d.dqf_drug_test_reason==='follow_up'?' selected':'')+'>Follow-Up (382.311)</option></select></div>';
  html += '<div class="dqf-field"><label>Drug Test Result</label><select id="p_drug_test_result"><option value="">—</option><option value="negative"'+(d.drug_test_status==='negative'||d.drug_test_status==='current'?' selected':'')+'>Negative</option><option value="positive"'+(d.drug_test_status==='positive'?' selected':'')+'>Positive</option><option value="refused"'+(d.drug_test_status==='refused'?' selected':'')+'>Refused</option><option value="dilute"'+(d.drug_test_status==='dilute'?' selected':'')+'>Dilute / Invalid</option><option value="pending"'+(d.drug_test_status==='pending'?' selected':'')+'>Pending</option></select></div>';
  html += docUpload('p_dqf_preemp_drug_doc', 'Drug Test Document', d.dqf_preemp_drug_doc);
  html += '</div>';

  // 382 — Alcohol Testing
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>Alcohol Test — Date</label><input type="date" id="p_dqf_alcohol_test_date" value="' + esc(d.dqf_alcohol_test_date||'') + '"></div>';
  html += '<div class="dqf-field"><label>Alcohol Test Reason (382)</label><select id="p_dqf_alcohol_test_reason"><option value="">—</option><option value="preemployment"'+(d.dqf_alcohol_test_reason==='preemployment'?' selected':'')+'>Pre-Employment (382.301)</option><option value="post_accident"'+(d.dqf_alcohol_test_reason==='post_accident'?' selected':'')+'>Post-Accident (382.303)</option><option value="random"'+(d.dqf_alcohol_test_reason==='random'?' selected':'')+'>Random (382.305)</option><option value="reasonable_suspicion"'+(d.dqf_alcohol_test_reason==='reasonable_suspicion'?' selected':'')+'>Reasonable Suspicion (382.307)</option><option value="return_to_duty"'+(d.dqf_alcohol_test_reason==='return_to_duty'?' selected':'')+'>Return-to-Duty (382.309)</option><option value="follow_up"'+(d.dqf_alcohol_test_reason==='follow_up'?' selected':'')+'>Follow-Up (382.311)</option></select></div>';
  html += '<div class="dqf-field"><label>Alcohol Test Result</label><select id="p_dqf_alcohol_test_result"><option value="">—</option><option value="negative"'+(d.dqf_alcohol_test_result==='negative'?' selected':'')+'>Negative (&lt;0.02 BAC)</option><option value="positive"'+(d.dqf_alcohol_test_result==='positive'?' selected':'')+'>Positive (&ge;0.04 BAC)</option><option value="refused"'+(d.dqf_alcohol_test_result==='refused'?' selected':'')+'>Refused</option><option value="pending"'+(d.dqf_alcohol_test_result==='pending'?' selected':'')+'>Pending</option></select></div>';
  html += docUpload('p_dqf_alcohol_test_doc', 'Alcohol Test Document', d.dqf_alcohol_test_doc);
  html += '</div>';
  } else if (dnaSettings.model === 'tpa') {
    html += '<div style="margin-bottom:16px; padding:12px 14px; background:#eff6ff; border:1px solid #93c5fd; border-radius:8px; font-size:13px; color:#1e40af;">';
    html += '<strong>Drug &amp; Alcohol Records — Maintained by TPA</strong><br>';
    html += 'Per your Carrier Dashboard settings, drug &amp; alcohol testing records are maintained by your Third-Party Administrator, not in DRIV-EN.';
    if (dnaSettings.tpa_name) html += '<br><strong>TPA:</strong> ' + esc(dnaSettings.tpa_name);
    if (dnaSettings.tpa_contact) html += '<br><strong>Contact:</strong> ' + esc(dnaSettings.tpa_contact);
    if (dnaSettings.tpa_account) html += '<br><strong>Account #:</strong> ' + esc(dnaSettings.tpa_account);
    html += '<br><em style="font-size:12px;">Audit packets will include a page stating records are held by your TPA.</em>';
    html += '</div>';
  } else if (dnaSettings.model === 'clearinghouse') {
    html += '<div style="margin-bottom:16px; padding:12px 14px; background:#eff6ff; border:1px solid #93c5fd; border-radius:8px; font-size:13px; color:#1e40af;">';
    html += '<strong>Drug &amp; Alcohol Records — FMCSA Clearinghouse</strong><br>';
    html += 'Per your Carrier Dashboard settings, drug &amp; alcohol records are maintained in the FMCSA Clearinghouse. Use the Clearinghouse query tracking below.';
    html += '</div>';
  } else {
    html += '<div style="margin-bottom:16px; padding:12px 14px; background:#eff6ff; border:1px solid #93c5fd; border-radius:8px; font-size:13px; color:#1e40af;">';
    html += '<strong>Drug &amp; Alcohol Records — Physical Secure File</strong><br>';
    html += 'Per your Carrier Dashboard settings, drug &amp; alcohol testing records are maintained in a physical secure file. Audit packets will include a reference page.';
    html += '</div>';
  }

  // FMCSA Clearinghouse query tracking (shown when enabled, regardless of model)
  if (dnaSettings.clearinghouse_tracking) {
    html += '<div class="dqf-grid" style="margin-bottom:16px;">';
    html += '<div class="dqf-field"><label>Clearinghouse Query — Date</label><input type="date" id="p_ch_query_date" value="' + esc(d.ch_query_date||'') + '"></div>';
    html += '<div class="dqf-field"><label>Query Type</label><select id="p_ch_query_type"><option value="">—</option><option value="preemployment"'+(d.ch_query_type==='preemployment'?' selected':'')+'>Pre-Employment (Full)</option><option value="annual"'+(d.ch_query_type==='annual'?' selected':'')+'>Annual (Limited)</option></select></div>';
    html += '<div class="dqf-field"><label>Query Result</label><select id="p_ch_query_result"><option value="">—</option><option value="clear"'+(d.ch_query_result==='clear'?' selected':'')+'>Clear</option><option value="not_clear"'+(d.ch_query_result==='not_clear'?' selected':'')+'>Not Clear / Prohibited</option><option value="pending"'+(d.ch_query_result==='pending'?' selected':'')+'>Pending</option></select></div>';
    html += '</div>';
  }

  // 391.43 — Medical Examiner Information
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>Medical Examiner — Name (391.43)</label><input type="text" id="p_dqf_medex_name" value="' + esc(d.dqf_medex_name||'') + '"></div>';
  html += '<div class="dqf-field"><label>National Registry Number</label><input type="text" id="p_dqf_medex_registry" value="' + esc(d.dqf_medex_registry||'') + '"></div>';
  html += '<div class="dqf-field"><label>Examiner Phone</label><input type="text" id="p_dqf_medex_phone" value="' + esc(d.dqf_medex_phone||'') + '"></div>';
  html += '<div class="dqf-field dqf-field-full"><label>Examiner Address</label><input type="text" id="p_dqf_medex_address" value="' + esc(d.dqf_medex_address||'') + '"></div>';
  html += '</div>';

  // 391.64 — Medical Variance
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>Medical Variance — FMCSA (391.64)</label><select id="p_dqf_med_variance"><option value="no"'+(d.dqf_med_variance!=='yes'?' selected':'')+'>No Variance</option><option value="yes"'+(d.dqf_med_variance==='yes'?' selected':'')+'>Variance Issued</option></select></div>';
  html += '<div class="dqf-field"><label>Variance Number (if applicable)</label><input type="text" id="p_dqf_med_variance_num" value="' + esc(d.dqf_med_variance_num||'') + '"></div>';
  html += '</div>';

  // 384.226 — CDLIS Verification
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>CDLIS Verification — Date (384.226)</label><input type="date" id="p_dqf_cdlis_date" value="' + esc(d.dqf_cdlis_date||'') + '"></div>';
  html += '<div class="dqf-field"><label>Verification Result</label><select id="p_dqf_cdlis_result"><option value="">—</option><option value="verified_valid"'+(d.dqf_cdlis_result==='verified_valid'?' selected':'')+'>Verified — Valid CDL</option><option value="verified_suspended"'+(d.dqf_cdlis_result==='verified_suspended'?' selected':'')+'>Verified — Suspended/Revoked</option><option value="mismatch"'+(d.dqf_cdlis_result==='mismatch'?' selected':'')+'>Mismatch — Info Does Not Match</option><option value="not_verified"'+(d.dqf_cdlis_result==='not_verified'?' selected':'')+'>Not Verified</option><option value="pending"'+(d.dqf_cdlis_result==='pending'?' selected':'')+'>Pending</option></select></div>';
  html += docUpload('p_dqf_cdlis_doc', 'CDLIS Verification Report', d.dqf_cdlis_doc);
  html += '</div>';

  // 391.23(h) — Safety Performance History
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>Safety Performance History — Date (391.23(h))</label><input type="date" id="p_dqf_safety_perf_date" value="' + esc(d.dqf_safety_perf_date||'') + '"></div>';
  html += '<div class="dqf-field"><label>Drug/Alcohol Test Results from Prior Employers</label><select id="p_dqf_safety_perf_result"><option value="">—</option><option value="none"'+(d.dqf_safety_perf_result==='none'?' selected':'')+'>No Violations</option><option value="positive"'+(d.dqf_safety_perf_result==='positive'?' selected':'')+'>Positive Test(s) on Record</option><option value="refused"'+(d.dqf_safety_perf_result==='refused'?' selected':'')+'>Refusal(s) on Record</option><option value="positive_refused"'+(d.dqf_safety_perf_result==='positive_refused'?' selected':'')+'>Positive & Refusal(s) on Record</option><option value="pending"'+(d.dqf_safety_perf_result==='pending'?' selected':'')+'>Pending Inquiry</option></select></div>';
  html += docUpload('p_dqf_safety_perf_doc', 'Safety Performance Document', d.dqf_safety_perf_doc);
  html += '</div>';

  // TSA 1572 — Hazmat Background
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>Hazmat / TSA Background — Date (TSA 49 CFR 1572)</label><input type="date" id="p_dqf_hazmat_date" value="' + esc(d.dqf_hazmat_date||'') + '"></div>';
  html += '<div class="dqf-field"><label>Result</label><select id="p_dqf_hazmat_result"><option value="">—</option><option value="cleared"'+(d.dqf_hazmat_result==='cleared'?' selected':'')+'>Cleared</option><option value="denied"'+(d.dqf_hazmat_result==='denied'?' selected':'')+'>Denied</option><option value="pending"'+(d.dqf_hazmat_result==='pending'?' selected':'')+'>Pending</option><option value="na"'+(d.dqf_hazmat_result==='na'?' selected':'')+'>N/A (No Hazmat)</option></select></div>';
  html += docUpload('p_dqf_hazmat_doc', 'Hazmat Background Document', d.dqf_hazmat_doc);
  html += '</div>';

  // 49 CFR 1592 — TWIC Card
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field"><label>TWIC Card Number (49 CFR 1592)</label><input type="text" id="p_dqf_twic_num" value="' + esc(d.dqf_twic_num||'') + '"></div>';
  html += '<div class="dqf-field"><label>TWIC Expiration</label><input type="date" id="p_dqf_twic_exp" value="' + esc(d.dqf_twic_exp||'') + '"></div>';
  html += docUpload('p_dqf_twic_doc', 'TWIC Card Image', d.dqf_twic_doc, 'image/*');
  html += '</div>';

  // Additional Documents (accident reports, citations, etc.)
  html += '<div class="dqf-grid" style="margin-bottom:16px;">';
  html += '<div class="dqf-field dqf-field-full"><label>📎 Additional Documents (accident reports, citations, training certs, etc.)</label><div class="dqf-file-row"><input type="file" id="p_dqf_additional_docs" accept="image/*,application/pdf" multiple capture="environment" style="flex:1;min-width:0;"></div></div>';
  if (d.dqf_additional_docs) {
    try {
      var addlDocs = JSON.parse(d.dqf_additional_docs);
      if (addlDocs && addlDocs.length) {
        html += '<div class="dqf-field dqf-field-full"><label style="font-size:12px; color:var(--text-muted,#64748b);">Uploaded Additional Documents:</label><div style="display:flex; flex-wrap:wrap; gap:6px;">';
        addlDocs.forEach(function(ad, i) {
          html += '<button type="button" onclick="dqfOpenDocViewer(\'' + esc(ad.label||('Doc '+(i+1))) + '\',\'' + esc(ad.key) + '\')" style="padding:4px 10px; background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-size:12px;">👁 ' + esc(ad.label||('Doc '+(i+1))) + '</button>';
        });
        html += '</div></div>';
      }
    } catch(e) {}
  }
  html += '</div>';

  html += '</div>'; // end FMCSA section

  // Save bar with Print/PDF button
  html += '<div class="dqf-save-bar">';
  html += '<button class="dqf-btn dqf-btn-later" onclick="saveDqfProfile(false)">Save &amp; Come Back Later</button>';
  html += '<button class="dqf-btn dqf-btn-save" onclick="saveDqfProfile(true)">Save &amp; Complete</button>';
  html += '<button class="dqf-btn" style="background:#475569; color:#fff; border:none;" onclick="printDqfProfile()">🖨 Print / PDF</button>';
  html += '</div>';

  document.getElementById('dqfProfileContent').innerHTML = html;
  // Initialize prior employers list
  priorEmployers = parsePriorEmployers(d.dqf_prior_employers);
  renderPriorEmployers();
  // Filter endorsements based on current CDL class
  setTimeout(function() { updateCdlEndorsements(); }, 0);
  // Highlight empty fields with yellow background (needs attention)
  setTimeout(function() {
    var inputs = document.querySelectorAll('#dqfProfileContent input[type=date], #dqfProfileContent input[type=text], #dqfProfileContent select, #dqfProfileContent textarea');
    inputs.forEach(function(el) {
      if (!el.value || el.value === '' || el.value === 'none') {
        el.style.backgroundColor = '#fef3c7';
        el.style.borderColor = '#f59e0b';
      } else {
        el.style.backgroundColor = '';
        el.style.borderColor = '';
      }
    });
    // Highlight document upload rows with "Missing" badge
    var missingBadges = document.querySelectorAll('#dqfProfileContent .um-status-none');
    missingBadges.forEach(function(badge) {
      var row = badge.closest('.dqf-file-row');
      if (row) row.style.backgroundColor = '#fef3c7';
    });
  }, 50);
}

// ============================================================
// DOCUMENT VIEWER & UPLOAD
// ============================================================
function dqfOpenDocViewer(title, key) {
  var modal = document.getElementById('dqfDocViewerModal');
  var titleEl = document.getElementById('dqfDocViewerTitle');
  var body = document.getElementById('dqfDocViewerBody');
  if (!modal || !body) return;
  titleEl.textContent = title || 'Document';
  body.innerHTML = '<p style="padding:40px; color:var(--text-muted,#64748b);">Loading document…</p>';
  modal.classList.add('active');
  var url = '/api/employee-documents/' + encodeURIComponent(key);
  fetch(url).then(function(resp) {
    if (!resp.ok) throw new Error('Document not found');
    var ct = resp.headers.get('Content-Type') || '';
    if (ct.indexOf('image/') === 0) {
      return resp.blob().then(function(blob) {
        var imgUrl = URL.createObjectURL(blob);
        body.innerHTML = '<img src="' + imgUrl + '" style="max-width:100%; max-height:60vh; border-radius:8px;" onload="this.parentElement.style.textAlign=\'center\'"><div style="margin-top:12px;"><button onclick="window.open(\'' + imgUrl + '\',\'_blank\').print()" style="padding:6px 16px; background:#475569; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px;">🖨 Print</button></div>';
      });
    } else if (ct.indexOf('pdf') !== -1) {
      return resp.blob().then(function(blob) {
        var pdfUrl = URL.createObjectURL(blob);
        body.innerHTML = '<iframe src="' + pdfUrl + '" style="width:100%; height:60vh; border:1px solid var(--border,#e2e8f0); border-radius:8px;"></iframe><div style="margin-top:12px;"><a href="' + pdfUrl + '" target="_blank" style="padding:6px 16px; background:#475569; color:#fff; text-decoration:none; border-radius:6px; font-size:13px;">🖨 Print / Open</a></div>';
      });
    } else {
      return resp.blob().then(function(blob) {
        var dlUrl = URL.createObjectURL(blob);
        body.innerHTML = '<p>Unsupported preview. <a href="' + dlUrl + '" download="' + (title||'document') + '" style="color:#2563eb;">Download file</a></p>';
      });
    }
  }).catch(function(e) {
    body.innerHTML = '<p style="padding:40px; color:#dc2626;">Error: ' + esc(e.message) + '</p>';
  });
}

function dqfCloseDocViewer() {
  var modal = document.getElementById('dqfDocViewerModal');
  if (modal) modal.classList.remove('active');
  var body = document.getElementById('dqfDocViewerBody');
  if (body) body.innerHTML = '';
}

// Upload a single document to R2, return the R2 key
async function uploadDocToR2(file, docType, empId) {
  if (!file || !file.size) return null;
  var formData = new FormData();
  formData.append('file', file);
  formData.append('docType', docType);
  formData.append('empId', empId);
  var resp = await fetch('/api/employee-documents/upload', { method: 'POST', body: formData });
  var data = await resp.json();
  if (!resp.ok || !data.success) throw new Error(data.error || 'Upload failed');
  return data.key;
}

// Check if required documents are present, return list of missing ones
var DQF_REQUIRED_DOCS = [
  { field: 'dl_photo_front', label: 'DL Front Photo' },
  { field: 'dl_photo_back', label: 'DL Back Photo' },
  { field: 'driving_record_doc', label: 'Driving Record' },
  { field: 'medical_card_doc', label: 'Medical Card' },
  { field: 'dqf_application_doc', label: 'Application' },
  { field: 'dqf_cdlis_doc', label: 'CDLIS Verification' },
  { field: 'dqf_preemp_drug_doc', label: 'Pre-Emp Drug Test' },
  { field: 'dqf_road_test_doc', label: 'Road Test' },
  { field: 'dqf_emp_verification_doc', label: 'Emp Verification' },
  { field: 'dqf_safety_perf_doc', label: 'Safety Performance' },
  { field: 'dqf_annual_mvr_doc', label: 'Annual MVR Review' },
  { field: 'dqf_twic_doc', label: 'TWIC Card' }
];
var DQF_DOC_COUNT = DQF_REQUIRED_DOCS.length;

function checkMissingDocuments(d) {
  var missing = [];
  DQF_REQUIRED_DOCS.forEach(function(doc) {
    if (!d[doc.field]) missing.push(doc.label);
  });
  return missing;
}


// ============================================================
// Print / Save DQF as PDF
function printDqfProfile() {
  var content = document.getElementById('dqfProfileContent');
  if (!content) return;
  var name = (currentDriver && currentDriver.full_name) || 'Driver';
  var printWin = window.open('', '_blank', 'width=800,height=900');
  printWin.document.write('<!DOCTYPE html><html><head><title>DQF — ' + esc(name) + '</title>');
  printWin.document.write('<style>');
  printWin.document.write('body { font-family: Arial, sans-serif; padding:20px; color:#0f172a; max-width:800px; margin:0 auto; }');
  printWin.document.write('h2 { font-size:18px; border-bottom:2px solid #16a34a; padding-bottom:6px; margin-top:20px; }');
  printWin.document.write('table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:12px; }');
  printWin.document.write('td { padding:6px 8px; border-bottom:1px solid #e2e8f0; }');
  printWin.document.write('td:first-child { font-weight:600; width:40%; color:#475569; }');
  printWin.document.write('.dqf-section { border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px; }');
  printWin.document.write('.print-header { text-align:center; margin-bottom:20px; }');
  printWin.document.write('.print-header h1 { font-size:22px; margin:0; }');
  printWin.document.write('.print-header p { font-size:13px; color:#64748b; margin:4px 0; }');
  printWin.document.write('@media print { body { padding:0; } }');
  printWin.document.write('</style></head><body>');
  printWin.document.write('<div class="print-header"><h1>Driver Qualification File</h1>');
  // Carrier info (will be populated from Admin Settings when available)
  var carrierName = localStorage.getItem('driv_en_carrier_name') || '';
  var carrierDOT = localStorage.getItem('driv_en_dot_number') || '';
  var carrierMC = localStorage.getItem('driv_en_mc_number') || '';
  var carrierAddr = localStorage.getItem('driv_en_carrier_address') || '';
  var carrierPhone = localStorage.getItem('driv_en_carrier_phone') || '';
  var carrierScac = localStorage.getItem('driv_en_carrier_scac') || '';
  if (carrierName || carrierDOT || carrierMC) {
    printWin.document.write('<p style="font-size:14px; font-weight:600;">' + esc(carrierName || '') + '</p>');
    printWin.document.write('<p style="font-size:12px; color:#64748b;">');
    if (carrierDOT) printWin.document.write('DOT: ' + esc(carrierDOT) + ' &nbsp; ');
    if (carrierMC) printWin.document.write('MC: ' + esc(carrierMC) + ' &nbsp; ');
    if (carrierScac) printWin.document.write('SCAC: ' + esc(carrierScac) + ' &nbsp; ');
    if (carrierPhone) printWin.document.write('<br>Phone: ' + esc(carrierPhone));
    if (carrierAddr) printWin.document.write('<br>' + esc(carrierAddr));
    printWin.document.write('</p>');
  } else {
    printWin.document.write('<p style="font-size:12px; color:#94a3b8;">Carrier info not configured — add in Carrier Dashboard</p>');
  }
  printWin.document.write('<p style="margin-top:8px;">' + esc(name) + ' — Generated ' + new Date().toLocaleString() + '</p></div>');
  var clone = content.cloneNode(true);
  clone.querySelectorAll('input[type=file], button, .um-status-badge').forEach(function(el) { el.remove(); });
  clone.querySelectorAll('input, select, textarea').forEach(function(el) {
    var val = el.value || el.textContent || '';
    var label = el.closest('.dqf-field') ? el.closest('.dqf-field').querySelector('label') : null;
    var labelTxt = label ? label.textContent : '';
    var replacement = document.createElement('div');
    replacement.style.cssText = 'padding:6px 8px; border-bottom:1px solid #e2e8f0;';
    replacement.innerHTML = '<span style="font-weight:600;color:#475569;">' + esc(labelTxt) + ':</span> ' + esc(val || '—');
    el.parentNode.replaceChild(replacement, el);
  });
  printWin.document.write(clone.innerHTML);
  printWin.document.write('<div style="margin-top:40px; padding-top:12px; border-top:1px solid #e2e8f0; text-align:center; font-size:11px; color:#94a3b8;">');
  printWin.document.write('Generated by <strong>DRIV-EN</strong> — ' + new Date().toLocaleString() + '<br>');
  printWin.document.write('Driver Qualification File Management — <a href="https://driv-en.com">driv-en.com</a>');
  printWin.document.write('</div>');
  printWin.document.write('</body></html>');
  printWin.document.close();
  setTimeout(function() { printWin.print(); }, 500);
}

function toggleDqfAssets() {
  var cb = document.getElementById('p_has_assets');
  var container = document.getElementById('p_assets_container');
  if (cb && container) container.style.display = cb.checked ? 'block' : 'none';
}

// CDL endorsements available per class
var CDL_ENDORSEMENTS = {
  A: ['air_brakes','hazmat','tanker','passenger','doubles','school_bus'],
  B: ['air_brakes','hazmat','tanker','passenger','school_bus']
};
var CDL_ENDORS_LABELS = {
  air_brakes: 'Air Brakes', hazmat: 'Hazmat (H)', tanker: 'Tanker (N)',
  passenger: 'Passenger (P)', doubles: 'Doubles/Triples (T)', school_bus: 'School Bus (S)'
};

function updateCdlEndorsements() {
  var cdlClass = (document.getElementById('p_cdl_class') || {}).value;
  var container = document.getElementById('p_cdl_endorsements_container');
  if (!container) return;
  var allowed = CDL_ENDORSEMENTS[cdlClass] || [];
  var checkboxes = container.querySelectorAll('input[type=checkbox]');
  checkboxes.forEach(function(cb) {
    var label = cb.parentElement;
    if (allowed.includes(cb.value)) {
      label.style.display = '';
    } else {
      label.style.display = 'none';
      cb.checked = false;
    }
  });
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
       '<div class="dqf-field dqf-field-full" style="margin-top:8px;"><label>Insurance Document</label><div class="dqf-file-row"><input type="file" id="' + cid + '_ins_doc" accept="image/*,application/pdf" capture="environment" style="flex:1;min-width:0;"></div></div>' +
       '<div class="dqf-field dqf-field-full" style="margin-top:8px;"><label>Registration Document</label><div class="dqf-file-row"><input type="file" id="' + cid + '_reg_doc" accept="image/*,application/pdf" capture="environment" style="flex:1;min-width:0;"></div></div>' +
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
    step2_status: complete ? 'complete' : 'incomplete',
    // FMCSA / DOT Compliance fields
    dqf_application_date: getV('p_dqf_application_date'),
    dqf_emp_verification_date: getV('p_dqf_emp_verification_date'),
    dqf_emp_verification_status: getV('p_dqf_emp_verification_status'),
    dqf_emp_verification_notes: getV('p_dqf_emp_verification_notes'),
    dqf_annual_mvr_date: getV('p_dqf_annual_mvr_date'),
    dqf_annual_mvr_reviewer: getV('p_dqf_annual_mvr_reviewer'),
    dqf_annual_mvr_notes: getV('p_dqf_annual_mvr_notes'),
    dqf_annual_violations_date: getV('p_dqf_annual_violations_date'),
    dqf_annual_violations_cert: getV('p_dqf_annual_violations_cert'),
    dqf_annual_violations_details: getV('p_dqf_annual_violations_details'),
    dqf_road_test_date: getV('p_dqf_road_test_date'),
    dqf_road_test_examiner: getV('p_dqf_road_test_examiner'),
    dqf_road_test_vehicle: getV('p_dqf_road_test_vehicle'),
    dqf_road_test_equiv: getV('p_dqf_road_test_equiv'),
    dqf_preemp_drug_date: getV('p_dqf_preemp_drug_date'),
    dqf_preemp_drug_result: getV('p_dqf_preemp_drug_result'),
    dqf_medex_name: getV('p_dqf_medex_name'),
    dqf_medex_registry: getV('p_dqf_medex_registry'),
    dqf_medex_phone: getV('p_dqf_medex_phone'),
    dqf_medex_address: getV('p_dqf_medex_address'),
    dqf_med_variance: getV('p_dqf_med_variance'),
    dqf_med_variance_num: getV('p_dqf_med_variance_num'),
    dqf_cdlis_date: getV('p_dqf_cdlis_date'),
    dqf_cdlis_result: getV('p_dqf_cdlis_result'),
    dqf_drug_test_reason: getV('p_dqf_drug_test_reason'),
    dqf_alcohol_test_date: getV('p_dqf_alcohol_test_date'),
    dqf_alcohol_test_reason: getV('p_dqf_alcohol_test_reason'),
    dqf_alcohol_test_result: getV('p_dqf_alcohol_test_result'),
    ch_query_date: getV('p_ch_query_date'),
    ch_query_type: getV('p_ch_query_type'),
    ch_query_result: getV('p_ch_query_result'),
    dqf_safety_perf_date: getV('p_dqf_safety_perf_date'),
    dqf_safety_perf_result: getV('p_dqf_safety_perf_result'),
    dqf_hazmat_date: getV('p_dqf_hazmat_date'),
    dqf_hazmat_result: getV('p_dqf_hazmat_result'),
    dqf_twic_num: getV('p_dqf_twic_num'),
    dqf_twic_exp: getV('p_dqf_twic_exp')
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

  // Upload documents to R2 (if new files selected)
  var docFields = [
    { inputId: 'p_dl_front', fieldName: 'dl_photo_front', docType: 'dl_front' },
    { inputId: 'p_dl_back', fieldName: 'dl_photo_back', docType: 'dl_back' },
    { inputId: 'p_dr_doc', fieldName: 'driving_record_doc', docType: 'driving_record' },
    { inputId: 'p_med_doc', fieldName: 'medical_card_doc', docType: 'medical_card' },
    { inputId: 'p_dqf_application_doc', fieldName: 'dqf_application_doc', docType: 'application' },
    { inputId: 'p_dqf_cdlis_doc', fieldName: 'dqf_cdlis_doc', docType: 'cdlis' },
    { inputId: 'p_dqf_preemp_drug_doc', fieldName: 'dqf_preemp_drug_doc', docType: 'preemp_drug' },
    { inputId: 'p_dqf_road_test_doc', fieldName: 'dqf_road_test_doc', docType: 'road_test' },
    { inputId: 'p_dqf_emp_verification_doc', fieldName: 'dqf_emp_verification_doc', docType: 'emp_verification' },
    { inputId: 'p_dqf_safety_perf_doc', fieldName: 'dqf_safety_perf_doc', docType: 'safety_perf' },
    { inputId: 'p_dqf_annual_mvr_doc', fieldName: 'dqf_annual_mvr_doc', docType: 'annual_mvr' },
    { inputId: 'p_dqf_hazmat_doc', fieldName: 'dqf_hazmat_doc', docType: 'hazmat' },
    { inputId: 'p_dqf_twic_doc', fieldName: 'dqf_twic_doc', docType: 'twic' },
    { inputId: 'p_dqf_alcohol_test_doc', fieldName: 'dqf_alcohol_test_doc', docType: 'alcohol_test' }
  ];
  for (var di = 0; di < docFields.length; di++) {
    var df = docFields[di];
    var fileInput = document.getElementById(df.inputId);
    if (fileInput && fileInput.files && fileInput.files[0]) {
      try {
        var key = await uploadDocToR2(fileInput.files[0], df.docType, currentDriverId);
        if (key) payload[df.fieldName] = key;
      } catch(e) { console.warn('Doc upload failed (' + df.docType + '):', e); }
    } else if (currentDriver && currentDriver[df.fieldName]) {
      // Keep existing document key
      payload[df.fieldName] = currentDriver[df.fieldName];
    }
  }

  // Document status logic: three-tier status
  // Complete = all data + all documents
  // Docs Required = all data filled but documents missing
  // Incomplete = data fields still missing
  var docCheckDriver = Object.assign({}, currentDriver || {}, payload);
  var missingDocs = checkMissingDocuments(docCheckDriver);
  if (missingDocs.length > 0) {
    // Core compliance data fields (the essentials every DQF must have)
    var coreDataFields = [
      'cdl_class','medical_card_expiration','driving_record_verified',
      'drug_test_date','background_check_date'
    ];
    var missingData = coreDataFields.filter(function(f) {
      var val = docCheckDriver[f];
      return !val || val === '' || val === 'none' || val === 'pending';
    });
    if (missingData.length > 0) {
      payload.step2_status = 'incomplete';   // core data missing
    } else {
      payload.step2_status = 'docs_required'; // core data present, just need documents
    }
    complete = false; // Can't mark as complete if documents are missing
  } else if (complete) {
    payload.step2_status = 'complete'; // all data + all documents present
  }

  // If drug/alcohol records are maintained elsewhere (TPA/Clearinghouse/physical),
  // don't overwrite any stored test data with blanks from the hidden fields.
  if (dnaSettings.model !== 'driven') {
    ['drug_test_date','drug_test_recheck','drug_test_status','dqf_drug_test_reason','dqf_preemp_drug_date','dqf_preemp_drug_result','dqf_alcohol_test_date','dqf_alcohol_test_reason','dqf_alcohol_test_result'].forEach(function (k) { delete payload[k]; });
  }
  // Only persist Clearinghouse query fields when tracking is enabled
  if (!dnaSettings.clearinghouse_tracking) {
    ['ch_query_date','ch_query_type','ch_query_result'].forEach(function (k) { delete payload[k]; });
  }

  // Prior employers (49 CFR 391.23) — collect from the dynamic list
  var peList = collectPriorEmployers();
  payload.dqf_prior_employers = JSON.stringify(peList);
  // Auto-populate the per-org employer contact directory from any employer that has contact info
  peList.forEach(function (pe) {
    if (pe && pe.name && (pe.phone || pe.email || pe.fax || pe.contact_name)) {
      fetch('/api/employer-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_name: pe.name, contact_name: pe.contact_name, phone: pe.phone,
          fax: pe.fax, email: pe.email, address: pe.address, source: 'prior_employer'
        })
      }).catch(function () {});
    }
  });

  console.log('DQF save payload:', payload);
  try {
    var saveResp = await fetch('/api/dqf/' + encodeURIComponent(currentDriverId), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    var saveData = await saveResp.json();
    if (!saveResp.ok) {
      showToast('Save failed: ' + (saveData.error || saveData.message || 'HTTP ' + saveResp.status), 'error');
      console.error('DQF save error:', saveData);
      return;
    }
    console.log('DQF save success:', saveData);
    showToast('Saved successfully', 'success');
  } catch(e) {
    showToast('Save failed: ' + e.message, 'error');
    console.warn('Save failed:', e);
    return;
  }

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
