/* ============================================================
   DRIV-EN — Employee Import (user-management-import.js v=1)
   Import employees from ADP, QuickBooks, Gusto, Paychex, Sage,
   BambooHR, Rippling, or any generic CSV. Provider presets are
   mirrored client-side for the mapping UI; the worker applies
   the authoritative mapping during preview/commit.
   ============================================================ */
(function () {
  'use strict';

  // Canonical employee fields the import supports
  var CANONICAL_FIELDS = [
    { key: 'full_name',  label: 'Full Name', required: true },
    { key: 'email',      label: 'Email',     required: true },
    { key: 'employee_number', label: 'Employee Number' },
    { key: 'phone',      label: 'Phone' },
    { key: 'role_id',    label: 'Role' },
    { key: 'is_active',  label: 'Active (yes/no)' },
    { key: 'is_commercial_driver', label: 'Commercial Driver (yes/no)' },
    { key: 'hire_date',  label: 'Hire Date' },
    { key: 'division',   label: 'Division' },
    { key: 'job_title',  label: 'Job Title' },
    { key: '__ignore__', label: '— Do not import —' }
  ];

  // Client-side mirror of provider header aliases (for the mapping dropdowns)
  var PROVIDER_MAP = {
    adp:       { 'first name':'full_name','last name':'full_name_last','legal first name':'full_name','legal last name':'full_name_last','work email':'email','email':'email','email address':'email','employee id':'employee_number','associate id':'employee_number','worker id':'employee_number','home phone':'phone','phone':'phone','mobile phone':'phone','work phone':'phone','status':'is_active','hire date':'hire_date','department':'division','job title':'job_title' },
    quickbooks:{ 'first name':'full_name','last name':'full_name_last','name':'full_name','email':'email','email address':'email','employee number':'employee_number','employee no':'employee_number','phone':'phone','primary phone':'phone','mobile':'phone','active':'is_active','hire date':'hire_date','department':'division','job title':'job_title' },
    gusto:     { 'first name':'full_name','last name':'full_name_last','legal first name':'full_name','legal last name':'full_name_last','work email':'email','email':'email','employee id':'employee_number','worker id':'employee_number','home phone':'phone','mobile phone':'phone','phone':'phone','start date':'hire_date','department':'division','job title':'job_title','active':'is_active','status':'is_active' },
    paychex:   { 'employee first name':'full_name','employee last name':'full_name_last','first name':'full_name','last name':'full_name_last','email address':'email','email':'email','work email':'email','employee id':'employee_number','ee id':'employee_number','phone':'phone','home phone':'phone','mobile phone':'phone','hire date':'hire_date','department':'division','job title':'job_title','status':'is_active','active':'is_active' },
    sage:      { 'forename':'full_name','surname':'full_name_last','first name':'full_name','last name':'full_name_last','name':'full_name','email':'email','e-mail':'email','email address':'email','employee number':'employee_number','employee no':'employee_number','personnel number':'employee_number','telephone':'phone','phone':'phone','mobile':'phone','start date':'hire_date','hire date':'hire_date','department':'division','job title':'job_title','active':'is_active','status':'is_active' },
    bamboohr:  { 'first name':'full_name','last name':'full_name_last','preferred name':'full_name','work email':'email','email':'email','home email':'email','employee id':'employee_number','id':'employee_number','home phone':'phone','work phone':'phone','mobile phone':'phone','phone':'phone','hire date':'hire_date','date of hire':'hire_date','department':'division','job title':'job_title','status':'is_active','active':'is_active' },
    rippling:  { 'first name':'full_name','last name':'full_name_last','legal first name':'full_name','legal last name':'full_name_last','work email':'email','email':'email','employee id':'employee_number','worker id':'employee_number','id':'employee_number','work phone':'phone','mobile phone':'phone','phone':'phone','start date':'hire_date','hire date':'hire_date','department':'division','job title':'job_title','active':'is_active','status':'is_active' },
    generic:   { 'full name':'full_name','name':'full_name','employee name':'full_name','first name':'full_name','last name':'full_name_last','email':'email','e-mail':'email','email address':'email','work email':'email','employee number':'employee_number','employee id':'employee_number','employee no':'employee_number','id':'employee_number','phone':'phone','phone number':'phone','mobile':'phone','mobile phone':'phone','telephone':'phone','cell':'phone','role':'role_id','title':'job_title','job title':'job_title','position':'job_title','active':'is_active','status':'is_active','hire date':'hire_date','start date':'hire_date','hired':'hire_date','department':'division','division':'division','commercial driver':'is_commercial_driver','cdl':'is_commercial_driver' }
  };

  var state = {
    csvText: '',
    headers: [],
    mapping: {},   // original header (lowercase) -> canonical field
    previewData: null,
    detectedProvider: null
  };

  // ---------- CSV parsing (handles quoted fields) ----------
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
      if (key === 'generic') return;
      var score = 0;
      headers.forEach(function (h) { if (PROVIDER_MAP[key][h]) score++; });
      if (score > bestScore) { bestScore = score; best = key; }
    });
    return (best && bestScore >= 2) ? best : 'generic';
  }

  // ---------- Status banner ----------
  function setStatus(msg, kind) {
    var el = document.getElementById('umImportStatus');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = msg;
    el.style.background = kind === 'error' ? '#fee2e2' : kind === 'warn' ? '#fef3c7' : '#dcfce7';
    el.style.color = kind === 'error' ? '#991b1b' : kind === 'warn' ? '#92400e' : '#166534';
  }

  // ---------- File load ----------
  window.umImportRunPreview = async function () {
    var fileInput = document.getElementById('umImportFile');
    var providerSel = document.getElementById('umImportProvider');
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

    // Resolve provider: auto-detect or user-selected
    var requested = providerSel ? providerSel.value : 'auto';
    state.detectedProvider = (requested === 'auto') ? detectProvider(state.headers) : requested;

    // Build mapping from provider preset, fall back to generic aliases, then ignore
    var preset = PROVIDER_MAP[state.detectedProvider] || PROVIDER_MAP.generic;
    state.mapping = {};
    state.headers.forEach(function (h) {
      state.mapping[h] = preset[h] || PROVIDER_MAP.generic[h] || '__ignore__';
    });

    renderMappingUI();
    await sendPreview();
  };

  // ---------- Mapping UI ----------
  function renderMappingUI() {
    var wrap = document.getElementById('umImportMapping');
    var grid = document.getElementById('umImportMappingGrid');
    if (!wrap || !grid) return;
    grid.innerHTML = '';
    state.headers.forEach(function (h) {
      var cell = document.createElement('div');
      cell.style.cssText = 'padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:12px;';
      var lbl = document.createElement('div');
      lbl.textContent = '“' + h + '”';
      lbl.style.cssText = 'font-weight:600; margin-bottom:4px; word-break:break-all;';
      var sel = document.createElement('select');
      sel.style.cssText = 'width:100%; padding:5px; border-radius:4px; background:var(--card-bg,#fff); color:inherit;';
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
      if (!target || target === '__ignore__') return '__um_ignore_' + h.replace(/[^a-z0-9]/g, '_');
      return target;
    });
    // Merge first/last name columns client-side too
    var fnIdx = mappedHeader.indexOf('full_name');
    var lnIdx = mappedHeader.indexOf('full_name_last');
    if (lnIdx !== -1) {
      var out = [mappedHeader];
      for (var r = 1; r < rows.length; r++) {
        var row = rows[r].slice();
        if (fnIdx !== -1) {
          row[fnIdx] = ((row[fnIdx] || '') + ' ' + (row[lnIdx] || '')).trim();
          row.splice(lnIdx, 1);
        } else {
          row.push((row[lnIdx] || '').trim());
          mappedHeader.push('full_name');
        }
        out.push(row);
      }
      if (fnIdx !== -1) mappedHeader.splice(lnIdx, 1);
      rows = out;
    }
    // Drop ignored columns
    var keepIdx = [];
    mappedHeader.forEach(function (h, i) { if (h.indexOf('__um_ignore_') !== 0) keepIdx.push(i); });
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
    var dupSel = document.getElementById('umImportDupMode');
    setStatus('Validating…', 'info');
    try {
      var resp = await fetch('/api/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: buildMappedCSV(),
          entity_type: 'employees',
          provider: state.detectedProvider,
          duplicate_mode: dupSel ? dupSel.value : 'skip'
        })
      });
      var data = await resp.json();
      if (!resp.ok || !data.success) { setStatus(data.error || 'Preview failed.', 'error'); return; }
      state.previewData = data;
      renderResults(data);
    } catch (e) {
      setStatus('Preview request failed: ' + e.message, 'error');
    }
  }

  window.umImportRepreview = function () { if (state.csvText) sendPreview(); };

  // ---------- Results ----------
  function renderResults(data) {
    var el = document.getElementById('umImportResults');
    if (!el) return;
    el.style.display = 'block';

    var provLabel = { adp:'ADP', quickbooks:'QuickBooks', gusto:'Gusto', paychex:'Paychex', sage:'Sage', bamboohr:'BambooHR', rippling:'Rippling', generic:'generic CSV' }[data.detected_provider] || data.detected_provider;

    var html = '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">';
    html += '<div style="padding:10px 14px; border-radius:6px; background:#dcfce7; color:#166534; font-size:13px;"><b>' + data.valid_count + '</b> ready to import</div>';
    html += '<div style="padding:10px 14px; border-radius:6px; background:' + (data.invalid_count ? '#fee2e2' : '#f3f4f6') + '; color:' + (data.invalid_count ? '#991b1b' : '#555') + '; font-size:13px;"><b>' + data.invalid_count + '</b> will be skipped</div>';
    html += '<div style="padding:10px 14px; border-radius:6px; background:#dbeafe; color:#1e40af; font-size:13px;">Detected: <b>' + provLabel + '</b></div>';
    html += '</div>';

    if (data.valid_rows && data.valid_rows.length) {
      html += '<h4 style="margin:12px 0 6px 0; font-size:13px;">Ready to Import</h4>';
      html += '<div style="max-height:260px; overflow:auto; border:1px solid #d1d5db; border-radius:6px;">';
      html += '<table class="um-table" style="width:100%; font-size:12px; border-collapse:collapse;"><thead><tr>';
      ['Row', 'Name', 'Email', 'Employee #', 'Phone', 'Action'].forEach(function (h) {
        html += '<th style="padding:6px 8px; text-align:left; border-bottom:2px solid #d1d5db; position:sticky; top:0; background:var(--card-bg,#fff);">' + h + '</th>';
      });
      html += '</tr></thead><tbody>';
      data.valid_rows.forEach(function (r) {
        html += '<tr><td style="padding:5px 8px;">' + r.row + '</td><td style="padding:5px 8px;">' + esc(r.data.full_name) +
          '</td><td style="padding:5px 8px;">' + esc(r.data.email) + '</td><td style="padding:5px 8px;">' + esc(r.data.employee_number) +
          '</td><td style="padding:5px 8px;">' + esc(r.data.phone) + '</td><td style="padding:5px 8px;">' +
          (r.action === 'update' ? '🔄 Update existing' : '➕ New employee') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    if (data.invalid_rows && data.invalid_rows.length) {
      html += '<h4 style="margin:12px 0 6px 0; font-size:13px;">Skipped Rows</h4>';
      html += '<div style="max-height:200px; overflow:auto; border:1px solid #fca5a5; border-radius:6px;">';
      html += '<table class="um-table" style="width:100%; font-size:12px; border-collapse:collapse;"><thead><tr>' +
        '<th style="padding:6px 8px; text-align:left;">Row</th><th style="padding:6px 8px; text-align:left;">Name</th><th style="padding:6px 8px; text-align:left;">Reason</th></tr></thead><tbody>';
      data.invalid_rows.forEach(function (r) {
        html += '<tr><td style="padding:5px 8px;">' + r.row + '</td><td style="padding:5px 8px;">' + esc(r.data.full_name || r.data.email || '') +
          '</td><td style="padding:5px 8px; color:#991b1b;">' + esc((r.errors || []).join('; ')) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    if (data.valid_count > 0) {
      html += '<div style="margin-top:14px; display:flex; gap:10px;">';
      html += '<button onclick="umImportCommit()" style="padding:10px 22px; background:#16a34a; color:#fff; border:none; border-radius:6px; font-weight:700; font-size:14px; cursor:pointer;">✅ Import ' + data.valid_count + ' Employee' + (data.valid_count === 1 ? '' : 's') + '</button>';
      html += '<button onclick="umImportRepreview()" style="padding:10px 16px; background:transparent; border:2px solid #16a34a; border-radius:6px; color:#16a34a; cursor:pointer;">Re-check with current mapping</button>';
      html += '</div>';
    }
    el.innerHTML = html;
    setStatus(data.valid_count + ' rows ready, ' + data.invalid_count + ' skipped. Review below, then import.', 'info');
  }

  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

  // ---------- Commit ----------
  window.umImportCommit = async function () {
    if (!state.previewData || !state.previewData.valid_rows || !state.previewData.valid_rows.length) return;
    if (!confirm('Import ' + state.previewData.valid_count + ' employee(s)? Existing employees will be ' +
      ((document.getElementById('umImportDupMode') || {}).value === 'update' ? 'updated' : 'skipped') + '.')) return;
    setStatus('Importing…', 'info');
    try {
      var resp = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'employees', rows: state.previewData.valid_rows })
      });
      var data = await resp.json();
      if (!resp.ok || !data.success) { setStatus(data.error || 'Import failed.', 'error'); return; }
      var msg = '✅ Imported ' + data.imported + ' new employee(s)';
      if (data.updated) msg += ', updated ' + data.updated + ' existing';
      if (data.failed) msg += '. ' + data.failed + ' failed — see Import History.';
      setStatus(msg + '. Batch ID: ' + data.batch_id + ' (undo available in Import History)', 'info');
      document.getElementById('umImportResults').style.display = 'none';
      loadImportHistory();
      // Refresh employee table if the page exposes it
      if (typeof window.loadEmployees === 'function') { try { window.loadEmployees(); } catch (e) {} }
    } catch (e) {
      setStatus('Import request failed: ' + e.message, 'error');
    }
  };

  // ---------- History + Undo ----------
  async function loadImportHistory() {
    var el = document.getElementById('umImportHistory');
    if (!el) return;
    try {
      var resp = await fetch('/api/import/history');
      var data = await resp.json();
      if (!resp.ok || !data.success) { el.innerHTML = '<em style="font-size:12px;">History unavailable.</em>'; return; }
      var imports = (data.imports || []).filter(function (b) { return b.entity_type === 'employees'; });
      if (!imports.length) { el.innerHTML = '<em style="font-size:12px;">No employee imports yet.</em>'; return; }
      var html = '<table class="um-table" style="width:100%; font-size:12px; border-collapse:collapse;"><thead><tr>' +
        '<th style="padding:6px 8px; text-align:left;">Date</th><th style="padding:6px 8px; text-align:left;">Imported</th>' +
        '<th style="padding:6px 8px; text-align:left;">Failed</th><th style="padding:6px 8px; text-align:left;">By</th><th style="padding:6px 8px; text-align:left;"></th></tr></thead><tbody>';
      imports.forEach(function (b) {
        html += '<tr><td style="padding:5px 8px;">' + new Date(b.created_at).toLocaleString() + '</td>' +
          '<td style="padding:5px 8px;">' + (b.imported_rows || 0) + '</td>' +
          '<td style="padding:5px 8px;">' + (b.failed_rows || 0) + '</td>' +
          '<td style="padding:5px 8px;">' + esc(b.created_by || '') + '</td>' +
          '<td style="padding:5px 8px;"><button onclick="umImportUndo(\'' + b.id + '\')" style="padding:4px 10px; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; border-radius:4px; cursor:pointer; font-size:11px;">Undo</button></td></tr>';
      });
      html += '</tbody></table>';
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = '<em style="font-size:12px;">Could not load history: ' + esc(e.message) + '</em>';
    }
  }

  window.umImportUndo = async function (batchId) {
    if (!confirm('Undo this import? All employees added by this batch will be removed.')) return;
    try {
      var resp = await fetch('/api/import/' + batchId + '/undo', { method: 'POST' });
      var data = await resp.json();
      if (!resp.ok || !data.success) { setStatus(data.error || 'Undo failed.', 'error'); return; }
      setStatus('✅ Undone: ' + (data.deleted || 0) + ' employee(s) removed.', 'info');
      loadImportHistory();
      if (typeof window.loadEmployees === 'function') { try { window.loadEmployees(); } catch (e) {} }
    } catch (e) {
      setStatus('Undo request failed: ' + e.message, 'error');
    }
  };

  // Load history when the import tab is opened
  document.addEventListener('DOMContentLoaded', function () { loadImportHistory(); });
  if (document.readyState !== 'loading') { loadImportHistory(); }
})();
