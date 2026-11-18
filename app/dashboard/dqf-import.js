/* ============================================================
   DRIV-EN — DQF Competitor Import (dqf-import.js v=1)
   Import driver DQF data from competitor systems (J.J. Keller,
   Tenstreet, Motive/Samsara) or any generic CSV. Auto-maps
   competitor column headers to DRIV-EN DQF fields, validates,
   previews, and commits via the existing /api/import endpoints.
   ============================================================ */
(function () {
  'use strict';

  // Canonical DQF fields the import supports (for mapping dropdowns)
  var CANONICAL_FIELDS = [
    { key: '__ignore__',  label: '— Do not import —' },
    { key: 'full_name',   label: 'Driver Full Name *', required: true },
    { key: 'first_name',  label: 'First Name' },
    { key: 'last_name',   label: 'Last Name' },
    { key: 'email',       label: 'Email' },
    { key: 'employee_number', label: 'Employee Number' },
    { key: 'phone',       label: 'Phone' },
    { key: 'cdl_class',   label: 'CDL Class (A/B/C/none)' },
    { key: 'cdl_endorsements', label: 'CDL Endorsements' },
    { key: 'medical_card_expiration', label: 'Medical Card Expiration' },
    { key: 'driving_record_verified', label: 'MVR / Driving Record Date' },
    { key: 'drug_test_date',  label: 'Drug Test Date' },
    { key: 'background_check_date', label: 'Background Check Date' },
    { key: 'dqf_application_date', label: 'DQF Application Date' },
    { key: 'dqf_emp_verification_date', label: 'Employment Verification Date' },
    { key: 'dqf_emp_verification_status', label: 'Emp Verification Status' },
    { key: 'dqf_emp_verification_notes', label: 'Emp Verification Notes' },
    { key: 'dqf_road_test_date', label: 'Road Test Date' },
    { key: 'dqf_road_test_examiner', label: 'Road Test Examiner' },
    { key: 'dqf_road_test_vehicle', label: 'Road Test Vehicle' },
    { key: 'dqf_road_test_equiv', label: 'Road Test Equivalent' },
    { key: 'dqf_annual_mvr_date', label: 'Annual MVR Review Date' },
    { key: 'dqf_annual_mvr_reviewer', label: 'Annual MVR Reviewer' },
    { key: 'dqf_annual_mvr_notes', label: 'Annual MVR Notes' },
    { key: 'dqf_annual_violations_date', label: 'Annual Violations Date' },
    { key: 'dqf_annual_violations_cert', label: 'Annual Violations Cert' },
    { key: 'dqf_annual_violations_details', label: 'Annual Violations Details' },
    { key: 'dqf_preemp_drug_date', label: 'Pre-Employment Drug Test Date' },
    { key: 'dqf_preemp_drug_result', label: 'Pre-Emp Drug Test Result' },
    { key: 'dqf_medex_name', label: 'Medical Examiner Name' },
    { key: 'dqf_medex_registry', label: 'Medical Examiner Registry' },
    { key: 'dqf_medex_phone', label: 'Medical Examiner Phone' },
    { key: 'dqf_medex_address', label: 'Medical Examiner Address' },
    { key: 'dqf_med_variance', label: 'Medical Variance' },
    { key: 'dqf_med_variance_num', label: 'Medical Variance Number' },
    { key: 'dqf_cdlis_date', label: 'CDLIS Date' },
    { key: 'dqf_cdlis_result', label: 'CDLIS Result' },
    { key: 'dqf_safety_perf_date', label: 'Safety Performance Date' },
    { key: 'dqf_safety_perf_result', label: 'Safety Performance Result' },
    { key: 'dqf_hazmat_date', label: 'Hazmat Date' },
    { key: 'dqf_hazmat_result', label: 'Hazmat Result' },
    { key: 'dqf_twic_num', label: 'TWIC Number' },
    { key: 'dqf_twic_exp', label: 'TWIC Expiration' },
    { key: 'step2_status', label: 'File Status (complete/incomplete/pending)' },
    { key: 'hire_date', label: 'Hire Date' },
    { key: 'division', label: 'Division' },
    { key: 'job_title', label: 'Job Title' },
    { key: 'is_commercial_driver', label: 'Commercial Driver (yes/no)' }
  ];

  // Client-side mirror of competitor header aliases (for mapping dropdowns)
  var PROVIDER_MAP = {
    jjkeller: {
      label: 'J.J. Keller',
      headers: {
        'drivername':'full_name','cdlnumber':'employee_number','cdlclass':'cdl_class',
        'physicaldate':'medical_card_expiration','physicalexpiration':'medical_card_expiration',
        'mvrdate':'driving_record_verified','drugtestdate':'drug_test_date',
        'backgroundcheckdate':'background_check_date','empverification':'dqf_emp_verification_date',
        'roadtestdate':'dqf_road_test_date','annualmvrreview':'dqf_annual_mvr_date',
        'dqfcomplete':'step2_status','email':'email','email address':'email',
        'phone':'phone','phone number':'phone'
      }
    },
    tenstreet: {
      label: 'Tenstreet',
      headers: {
        'first name':'first_name','last name':'last_name',
        'licensenumber':'employee_number','licenseclass':'cdl_class',
        'dotphysicaldate':'medical_card_expiration','dotphysicalexp':'medical_card_expiration',
        'mvrorderdate':'driving_record_verified','preempdrugtestdate':'dqf_preemp_drug_date',
        'bgcheckdate':'background_check_date','prevempverif':'dqf_emp_verification_date',
        'roadtestdate':'dqf_road_test_date','annualreview':'dqf_annual_mvr_date',
        'dqfstatus':'step2_status','email':'email','email address':'email',
        'phone':'phone','phone number':'phone'
      }
    },
    motive: {
      label: 'Motive / Samsara',
      headers: {
        'driver_name':'full_name','license_number':'employee_number','cdl_class':'cdl_class',
        'medical_cert_date':'medical_card_expiration','medical_cert_exp':'medical_card_expiration',
        'mvr_date':'driving_record_verified','drug_test_date':'drug_test_date',
        'bg_check_date':'background_check_date','compliance_score':'__ignore__',
        'email':'email','email address':'email','phone':'phone','phone number':'phone'
      }
    },
    generic_dqf: {
      label: 'Generic DQF CSV',
      headers: {
        'full name':'full_name','name':'full_name','driver name':'full_name',
        'first name':'first_name','last name':'last_name',
        'email':'email','email address':'email',
        'employee number':'employee_number','employee id':'employee_number','cdl number':'employee_number',
        'phone':'phone','phone number':'phone',
        'cdl class':'cdl_class','cdl_class':'cdl_class',
        'medical card expiration':'medical_card_expiration','medical_card_expiration':'medical_card_expiration',
        'medical card date':'medical_card_expiration',
        'driving record verified':'driving_record_verified','driving_record_verified':'driving_record_verified',
        'mvr date':'driving_record_verified',
        'drug test date':'drug_test_date','drug_test_date':'drug_test_date',
        'background check date':'background_check_date','background_check_date':'background_check_date',
        'emp verification date':'dqf_emp_verification_date','dqf_emp_verification_date':'dqf_emp_verification_date',
        'road test date':'dqf_road_test_date','dqf_road_test_date':'dqf_road_test_date',
        'annual mvr date':'dqf_annual_mvr_date','dqf_annual_mvr_date':'dqf_annual_mvr_date',
        'pre employment drug date':'dqf_preemp_drug_date','dqf_preemp_drug_date':'dqf_preemp_drug_date',
        'application date':'dqf_application_date','dqf_application_date':'dqf_application_date',
        'file status':'step2_status','step2_status':'step2_status','dqf complete':'step2_status'
      }
    }
  };

  var state = {
    csvText: '',
    headers: [],
    mapping: {},
    previewData: null,
    detectedProvider: null
  };

  // ---------- CSV parsing ----------
  function parseCSV(text) {
    var rows = [], row = [], field = '', inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
        else if (c === '\r') { /* skip */ }
        else field += c;
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (f) { return String(f).trim() !== ''; }); });
  }

  function detectProvider(headers) {
    var best = null, bestScore = 0;
    Object.keys(PROVIDER_MAP).forEach(function (key) {
      var score = 0;
      headers.forEach(function (h) { if (PROVIDER_MAP[key].headers[h]) score++; });
      if (score > bestScore) { bestScore = score; best = key; }
    });
    return (best && bestScore >= 2) ? best : 'generic_dqf';
  }

  // ---------- Status banner ----------
  function setStatus(msg, kind) {
    var el = document.getElementById('dqfImportStatus');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = msg;
    el.style.background = kind === 'error' ? '#fee2e2' : kind === 'warn' ? '#fef3c7' : '#dcfce7';
    el.style.color = kind === 'error' ? '#991b1b' : kind === 'warn' ? '#92400e' : '#166534';
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  // ---------- Open / close wizard ----------
  window.dqfOpenImport = function () {
    var modal = document.getElementById('dqfImportModal');
    if (modal) modal.style.display = 'flex';
    // Reset state
    state = { csvText: '', headers: [], mapping: {}, previewData: null, detectedProvider: null };
    var results = document.getElementById('dqfImportResults');
    var mapping = document.getElementById('dqfImportMapping');
    var status = document.getElementById('dqfImportStatus');
    if (results) results.style.display = 'none';
    if (mapping) mapping.style.display = 'none';
    if (status) status.style.display = 'none';
    var fileInput = document.getElementById('dqfImportFile');
    if (fileInput) fileInput.value = '';
    loadDqfImportHistory();
  };

  window.dqfCloseImport = function () {
    var modal = document.getElementById('dqfImportModal');
    if (modal) modal.style.display = 'none';
  };

  // ---------- File load + preview ----------
  window.dqfImportRunPreview = async function () {
    var fileInput = document.getElementById('dqfImportFile');
    var providerSel = document.getElementById('dqfImportProvider');
    if (!fileInput || !fileInput.files || !fileInput.files.length) {
      setStatus('Please choose a CSV file first.', 'warn');
      return;
    }
    try {
      state.csvText = await fileInput.files[0].text();
    } catch (e) {
      setStatus('Could not read the file: ' + e.message, 'error');
      return;
    }
    var rows = parseCSV(state.csvText);
    if (rows.length < 2) { setStatus('CSV must have a header row and at least one data row.', 'error'); return; }

    state.headers = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });

    // Resolve provider
    var requested = providerSel ? providerSel.value : 'auto';
    state.detectedProvider = (requested === 'auto') ? detectProvider(state.headers) : requested;

    // Build mapping
    var preset = (PROVIDER_MAP[state.detectedProvider] || PROVIDER_MAP.generic_dqf).headers;
    state.mapping = {};
    state.headers.forEach(function (h) {
      state.mapping[h] = preset[h] || PROVIDER_MAP.generic_dqf.headers[h] || '__ignore__';
    });

    renderMappingUI();
    await sendPreview();
  };

  // ---------- Mapping UI ----------
  function renderMappingUI() {
    var wrap = document.getElementById('dqfImportMapping');
    var grid = document.getElementById('dqfImportMappingGrid');
    if (!wrap || !grid) return;
    grid.innerHTML = '';
    state.headers.forEach(function (h) {
      var cell = document.createElement('div');
      cell.style.cssText = 'padding:8px; border:1px solid var(--border,#d1d5db); border-radius:6px; font-size:12px;';
      var lbl = document.createElement('div');
      lbl.textContent = '"' + h + '"';
      lbl.style.cssText = 'font-weight:600; margin-bottom:4px; word-break:break-all;';
      var sel = document.createElement('select');
      sel.style.cssText = 'width:100%; padding:5px; border-radius:4px; background:var(--bg-card,#fff); color:inherit;';
      CANONICAL_FIELDS.forEach(function (f) {
        var opt = document.createElement('option');
        opt.value = f.key;
        opt.textContent = f.label + (f.required ? ' *' : '');
        if (state.mapping[h] === f.key) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () { state.mapping[h] = sel.value; });
      cell.appendChild(lbl);
      cell.appendChild(sel);
      grid.appendChild(cell);
    });
    wrap.style.display = 'block';
  }

  // ---------- Rebuild CSV with mapped headers ----------
  function buildMappedCSV() {
    var rows = parseCSV(state.csvText);
    var mappedHeader = state.headers.map(function (h) {
      var target = state.mapping[h];
      if (!target || target === '__ignore__') return '__dqf_ignore_' + h.replace(/[^a-z0-9]/g, '_');
      return target;
    });
    // Merge first/last name into full_name
    var fnIdx = mappedHeader.indexOf('first_name');
    var lnIdx = mappedHeader.indexOf('last_name');
    if (fnIdx !== -1 && lnIdx !== -1 && mappedHeader.indexOf('full_name') === -1) {
      mappedHeader.push('full_name'); // Push header ONCE (outside loop)
      var out = [mappedHeader];
      for (var r = 1; r < rows.length; r++) {
        var row = rows[r].slice();
        row.push(((row[fnIdx] || '') + ' ' + (row[lnIdx] || '')).trim());
        out.push(row);
      }
      rows = out;
    }
    // Drop ignored columns
    var keepIdx = [];
    mappedHeader.forEach(function (h, i) { if (h.indexOf('__dqf_ignore_') !== 0) keepIdx.push(i); });
    var finalRows = rows.map(function (row) {
      return keepIdx.map(function (i) { return row[i] !== undefined ? row[i] : ''; });
    });
    return finalRows.map(function (row) {
      return row.map(function (v) {
        v = String(v === undefined || v === null ? '' : v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\n');
  }

  // ---------- Preview ----------
  async function sendPreview() {
    var dupSel = document.getElementById('dqfImportDupMode');
    setStatus('Validating…', 'info');
    var mappedCSV;
    try { mappedCSV = buildMappedCSV(); }
    catch (e) { setStatus('Error building mapped CSV: ' + e.message, 'error'); return; }
    // Log mapped CSV for debugging
    console.log('DQF Import — mapped CSV being sent to worker:\n', mappedCSV.substring(0, 500));
    console.log('DQF Import — provider:', state.detectedProvider, 'dup mode:', dupSel ? dupSel.value : 'update');
    try {
      var resp = await fetch('/api/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: mappedCSV,
          entity_type: 'employees',
          provider: state.detectedProvider,
          duplicate_mode: dupSel ? dupSel.value : 'update',
          dqf_mode: true
        })
      });
      var data = await resp.json();
      console.log('DQF Import — worker response:', data);
      if (!resp.ok || !data.success) {
        var errMsg = data.error || data.message || 'Preview failed (HTTP ' + resp.status + ')';
        if (data.errors && data.errors.length) errMsg += ' — ' + data.errors.join('; ');
        setStatus(errMsg, 'error');
        console.error('DQF Import preview error:', data);
        return;
      }
      state.previewData = data;
      renderResults(data);
    } catch (e) {
      setStatus('Preview request failed: ' + e.message, 'error');
      console.error('DQF Import preview exception:', e);
    }
  }

  window.dqfImportRepreview = function () { if (state.csvText) sendPreview(); };

  // ---------- Results ----------
  function renderResults(data) {
    var el = document.getElementById('dqfImportResults');
    if (!el) return;
    el.style.display = 'block';

    var provLabel = { jjkeller:'J.J. Keller', tenstreet:'Tenstreet', motive:'Motive / Samsara', generic_dqf:'Generic DQF CSV' }[data.detected_provider] || data.detected_provider;

    var html = '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">';
    html += '<div style="padding:10px 14px; border-radius:6px; background:#dcfce7; color:#166534; font-size:13px;"><b>' + data.valid_count + '</b> ready to import</div>';
    html += '<div style="padding:10px 14px; border-radius:6px; background:' + (data.invalid_count ? '#fee2e2' : '#f3f4f6') + '; color:' + (data.invalid_count ? '#991b1b' : '#555') + '; font-size:13px;"><b>' + data.invalid_count + '</b> will be skipped</div>';
    html += '<div style="padding:10px 14px; border-radius:6px; background:#dbeafe; color:#1e40af; font-size:13px;">Detected: <b>' + provLabel + '</b></div>';
    html += '</div>';

    if (data.valid_rows && data.valid_rows.length) {
      html += '<h4 style="margin:12px 0 6px 0; font-size:13px;">Ready to Import</h4>';
      html += '<div style="max-height:260px; overflow:auto; border:1px solid var(--border,#d1d5db); border-radius:6px;">';
      html += '<table style="width:100%; font-size:12px; border-collapse:collapse;"><thead><tr>';
      ['Row','Driver','CDL','Med Card Exp','MVR Date','Drug Test','BG Check','Action'].forEach(function (h) {
        html += '<th style="padding:6px 8px; text-align:left; border-bottom:2px solid var(--border,#d1d5db); position:sticky; top:0; background:var(--bg-card,#fff);">' + h + '</th>';
      });
      html += '</tr></thead><tbody>';
      data.valid_rows.forEach(function (r) {
        html += '<tr><td style="padding:5px 8px;">' + r.row + '</td>' +
          '<td style="padding:5px 8px;">' + esc(r.data.full_name) + '</td>' +
          '<td style="padding:5px 8px;">' + esc(r.data.cdl_class || '—') + '</td>' +
          '<td style="padding:5px 8px;">' + esc(r.data.medical_card_expiration || '—') + '</td>' +
          '<td style="padding:5px 8px;">' + esc(r.data.driving_record_verified || '—') + '</td>' +
          '<td style="padding:5px 8px;">' + esc(r.data.drug_test_date || '—') + '</td>' +
          '<td style="padding:5px 8px;">' + esc(r.data.background_check_date || '—') + '</td>' +
          '<td style="padding:5px 8px;">' + (r.action === 'update' ? '🔄 Update' : '➕ New') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    if (data.invalid_rows && data.invalid_rows.length) {
      html += '<h4 style="margin:12px 0 6px 0; font-size:13px;">Skipped Rows</h4>';
      html += '<div style="max-height:200px; overflow:auto; border:1px solid #fca5a5; border-radius:6px;">';
      html += '<table style="width:100%; font-size:12px; border-collapse:collapse;"><thead><tr>' +
        '<th style="padding:6px 8px; text-align:left;">Row</th><th style="padding:6px 8px; text-align:left;">Driver</th><th style="padding:6px 8px; text-align:left;">Reason</th></tr></thead><tbody>';
      data.invalid_rows.forEach(function (r) {
        html += '<tr><td style="padding:5px 8px;">' + r.row + '</td><td style="padding:5px 8px;">' + esc(r.data.full_name || r.data.email || '') +
          '</td><td style="padding:5px 8px; color:#991b1b;">' + esc((r.errors || []).join('; ')) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    if (data.valid_count > 0) {
      html += '<div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">';
      html += '<button onclick="dqfImportCommit()" style="padding:10px 22px; background:#16a34a; color:#fff; border:none; border-radius:6px; font-weight:700; font-size:14px; cursor:pointer;">✅ Import ' + data.valid_count + ' Driver' + (data.valid_count === 1 ? '' : 's') + '</button>';
      html += '<button onclick="dqfImportRepreview()" style="padding:10px 16px; background:transparent; border:2px solid #16a34a; border-radius:6px; color:#16a34a; cursor:pointer;">Re-check with current mapping</button>';
      html += '</div>';
    }
    el.innerHTML = html;
    setStatus(data.valid_count + ' rows ready, ' + data.invalid_count + ' skipped. Review below, then import.', 'info');
  }

  // ---------- Commit ----------
  window.dqfImportCommit = async function () {
    if (!state.previewData || !state.previewData.valid_rows || !state.previewData.valid_rows.length) return;
    var dupSel = document.getElementById('dqfImportDupMode');
    var mode = dupSel ? dupSel.value : 'update';
    if (!confirm('Import ' + state.previewData.valid_count + ' driver(s)? Existing drivers will be ' +
      (mode === 'update' ? 'updated with DQF data' : 'skipped') + '.')) return;
    setStatus('Importing…', 'info');
    try {
      var resp = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'employees',
          rows: state.previewData.valid_rows,
          dqf_mode: true
        })
      });
      var data = await resp.json();
      console.log('DQF Import — commit response:', data);
      if (!resp.ok || !data.success) {
        var errMsg = data.error || data.message || 'Import failed (HTTP ' + resp.status + ')';
        if (data.errors && data.errors.length) errMsg += ' — ' + data.errors.join('; ');
        setStatus(errMsg, 'error');
        return;
      }
      var msg = '✅ Imported ' + data.imported + ' new driver(s)';
      if (data.updated) msg += ', updated ' + data.updated + ' existing';
      if (data.failed) msg += '. ' + data.failed + ' failed — see Import History.';
      setStatus(msg + '. Batch ID: ' + data.batch_id + ' (undo available in Import History)', 'info');
      document.getElementById('dqfImportResults').style.display = 'none';
      document.getElementById('dqfImportMapping').style.display = 'none';
      loadDqfImportHistory();
      // Show post-import compliance checklist
      showPostImportChecklist(data);
      // Reload the driver table — try multiple approaches
      var tableReloaded = false;
      if (typeof window.loadDrivers === 'function') { try { await window.loadDrivers(); tableReloaded = true; } catch (e) { console.error('loadDrivers failed:', e); } }
      if (typeof window.renderDriverTable === 'function') { try { window.renderDriverTable(); } catch (e) { console.error('renderDriverTable failed:', e); } }
      if (typeof window.updateKpis === 'function') { try { window.updateKpis(); } catch (e) { console.error('updateKpis failed:', e); } }
      // Also try without window. prefix (in case functions are global but not on window)
      if (!tableReloaded && typeof loadDrivers === 'function') { try { await loadDrivers(); tableReloaded = true; } catch (e) { console.error('loadDrivers (global) failed:', e); } }
      if (!tableReloaded && typeof renderDriverTable === 'function') { try { renderDriverTable(); } catch (e) {} }
      // Add a manual refresh button as fallback
      if (!tableReloaded) {
        var results = document.getElementById('dqfImportResults');
        if (results) {
          results.style.display = 'block';
          results.innerHTML = '<div style="padding:12px; background:#fef3c7; border-radius:6px; font-size:13px;">' +
            'Import complete. Click <button onclick="location.reload()" style="padding:4px 12px; background:#2563eb; color:#fff; border:none; border-radius:4px; cursor:pointer;">Refresh Page</button> to see updated driver table.</div>';
        }
      }
    } catch (e) {
      setStatus('Import request failed: ' + e.message, 'error');
    }
  };

  // ---------- Post-import compliance checklist ----------
  function showPostImportChecklist(data) {
    var el = document.getElementById('dqfImportChecklist');
    if (!el || !state.previewData) return;
    el.style.display = 'block';
    var validRows = state.previewData.valid_rows || [];
    var html = '<h4 style="margin:0 0 10px 0; font-size:14px;">📋 Post-Import Compliance Checklist</h4>';
    html += '<p style="font-size:12px; color:var(--text-muted,#64748b); margin:0 0 10px 0;">Review which drivers are missing required DQF items after import:</p>';
    html += '<div style="max-height:300px; overflow:auto; border:1px solid var(--border,#d1d5db); border-radius:6px;">';
    html += '<table style="width:100%; font-size:12px; border-collapse:collapse;"><thead><tr>';
    ['Driver','Med Card','MVR','Drug Test','BG Check','Emp Verif','Road Test','Annual MVR','Status'].forEach(function (h) {
      html += '<th style="padding:6px 8px; text-align:center; border-bottom:2px solid var(--border,#d1d5db); position:sticky; top:0; background:var(--bg-card,#fff);">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';
    validRows.forEach(function (r) {
      var d = r.data;
      function chk(val) { return val && val.trim() ? '✅' : '❌'; }
      html += '<tr>' +
        '<td style="padding:5px 8px; font-weight:600;">' + esc(d.full_name) + '</td>' +
        '<td style="padding:5px 8px; text-align:center;">' + chk(d.medical_card_expiration) + '</td>' +
        '<td style="padding:5px 8px; text-align:center;">' + chk(d.driving_record_verified) + '</td>' +
        '<td style="padding:5px 8px; text-align:center;">' + chk(d.drug_test_date) + '</td>' +
        '<td style="padding:5px 8px; text-align:center;">' + chk(d.background_check_date) + '</td>' +
        '<td style="padding:5px 8px; text-align:center;">' + chk(d.dqf_emp_verification_date) + '</td>' +
        '<td style="padding:5px 8px; text-align:center;">' + chk(d.dqf_road_test_date) + '</td>' +
        '<td style="padding:5px 8px; text-align:center;">' + chk(d.dqf_annual_mvr_date) + '</td>' +
        '<td style="padding:5px 8px; text-align:center;">' + esc(d.step2_status || 'pending') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<p style="font-size:11px; color:var(--text-muted,#64748b); margin:8px 0 0 0;">❌ = missing data — open the driver file to complete. ✅ = data was imported.</p>';
    el.innerHTML = html;
  }

  // ---------- History + Undo ----------
  async function loadDqfImportHistory() {
    var el = document.getElementById('dqfImportHistory');
    if (!el) return;
    try {
      var resp = await fetch('/api/import/history');
      var data = await resp.json();
      if (!resp.ok || !data.success) { el.innerHTML = '<em style="font-size:12px;">History unavailable.</em>'; return; }
      var imports = (data.imports || []).filter(function (b) { return b.entity_type === 'employees'; });
      if (!imports.length) { el.innerHTML = '<em style="font-size:12px;">No DQF imports yet.</em>'; return; }
      var html = '<table style="width:100%; font-size:12px; border-collapse:collapse;"><thead><tr>' +
        '<th style="padding:6px 8px; text-align:left;">Date</th><th style="padding:6px 8px; text-align:left;">Imported</th>' +
        '<th style="padding:6px 8px; text-align:left;">Updated</th><th style="padding:6px 8px; text-align:left;">Failed</th>' +
        '<th style="padding:6px 8px; text-align:left;">By</th><th style="padding:6px 8px;"></th></tr></thead><tbody>';
      imports.forEach(function (b) {
        html += '<tr><td style="padding:5px 8px;">' + new Date(b.created_at).toLocaleString() + '</td>' +
          '<td style="padding:5px 8px;">' + (b.imported_rows || 0) + '</td>' +
          '<td style="padding:5px 8px;">' + ((b.total_rows || 0) - (b.imported_rows || 0) - (b.failed_rows || 0)) + '</td>' +
          '<td style="padding:5px 8px;">' + (b.failed_rows || 0) + '</td>' +
          '<td style="padding:5px 8px;">' + esc(b.created_by || '') + '</td>' +
          '<td style="padding:5px 8px;"><button onclick="dqfImportUndo(\'' + b.id + '\')" style="padding:4px 10px; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; border-radius:4px; cursor:pointer; font-size:11px;">Undo</button></td></tr>';
      });
      html += '</tbody></table>';
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = '<em style="font-size:12px;">Could not load history: ' + esc(e.message) + '</em>';
    }
  }

  window.dqfImportUndo = async function (batchId) {
    if (!confirm('Undo this import? All drivers added by this batch will be removed. Updated drivers will keep their previous data.')) return;
    try {
      var resp = await fetch('/api/import/' + batchId + '/undo', { method: 'POST' });
      var data = await resp.json();
      if (!resp.ok || !data.success) { setStatus(data.error || 'Undo failed.', 'error'); return; }
      setStatus('✅ Undone: ' + (data.deleted || 0) + ' driver(s) removed.', 'info');
      loadDqfImportHistory();
      if (typeof window.loadDrivers === 'function') { try { await window.loadDrivers(); } catch (e) {} }
      if (typeof window.renderDriverTable === 'function') { try { window.renderDriverTable(); } catch (e) {} }
      if (typeof window.updateKpis === 'function') { try { window.updateKpis(); } catch (e) {} }
    } catch (e) {
      setStatus('Undo request failed: ' + e.message, 'error');
    }
  };

  // ---------- Template download ----------
  window.dqfImportDownloadTemplate = async function () {
    var btn = document.getElementById('dqfImportTemplateBtn');
    var old = btn ? btn.textContent : '';
    if (btn) btn.textContent = 'Downloading…';
    try {
      var resp = await fetch('/api/import/template/dqf', { method: 'GET' });
      if (!resp.ok) {
        setStatus('Template download failed (' + resp.status + '). You can create the file manually — required column: full_name.', 'error');
        return;
      }
      var blob = await resp.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'dqf-import-template.csv';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
    } catch (e) {
      setStatus('Template download failed: ' + e.message, 'error');
    } finally {
      if (btn) btn.textContent = old || '⬇ Download Template';
    }
  };

  // Load history when script loads
  if (document.readyState !== 'loading') { loadDqfImportHistory(); }
  else { document.addEventListener('DOMContentLoaded', function () { loadDqfImportHistory(); }); }
})();
