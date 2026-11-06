/* ==========================================================================
   DRIV-EN Platform — Fuel Management Dashboard JavaScript Module
   File: /app/dashboard/fuel.js
   ========================================================================== */

(function () {
  'use strict';

  // State Variables
  let allTanks = [];
  let allAssets = [];
  let allTransactions = [];
  let tankTypes = [];
  let allFlags = [];
  let allNotifications = [];
  let _flagsLoaded = false;
  let _initDone = false;

  let txSearchText = '';
  let txLocationFilter = '';
  let txFromDate = '';
  let txToDate = '';

  /* ===== HELPER & UTILITY FUNCTIONS ===== */

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // Volume unit pulled from customer units_of_measure
  let UOM = { plural: 'Gallons', singular: 'Gallon', abbr: 'gal', lower: 'gallons' };

  function uomFromName(name) {
    const n = String(name || '').toLowerCase();
    if (/imperial/.test(n)) return { plural: 'Imperial Gallons', singular: 'Imperial Gallon', abbr: 'imp gal', lower: 'imperial gallons' };
    if (/liter|litre/.test(n) && !/per\s|\/|lph|lpm/.test(n)) return { plural: 'Liters', singular: 'Liter', abbr: 'L', lower: 'liters' };
    if (/gallon/.test(n) && !/per\s|gph|gpm/.test(n)) return { plural: 'Gallons', singular: 'Gallon', abbr: 'gal', lower: 'gallons' };
    return null;
  }

  async function loadUnitOfMeasure() {
    try {
      const resp = await fetch('/api/units-of-measure', { headers: getAuthHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();
      const list = data.records || data.unitsOfMeasure || data.data || (Array.isArray(data) ? data : []);
      for (const item of list) {
        const u = uomFromName(typeof item === 'string' ? item : (item.name || item.unit_name || item.unit));
        if (u) { UOM = u; return; }
      }
    } catch (e) {
      console.warn('Unit of measure load failed, defaulting to gallons:', e.message);
    }
  }

  function applyUomToStaticText() {
    document.querySelectorAll('.uom-lower').forEach(el => { el.textContent = UOM.lower; });
  }

  function reportError(source, err) {
    const msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : 'Unknown error');
    const stack = (err && err.stack) ? err.stack : 'No stack trace';
    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          source: 'Fuel Dashboard (' + source + ')',
          message: msg,
          stack: stack,
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      }).catch(() => {});
    } catch (e) {
      console.error('Failed to report error:', e);
    }
    console.error('[' + source + ']', msg, stack);
  }

  function getUserSession() {
    let user = window.dashUser || window.drivenUser;
    if (!user) {
      try {
        user = JSON.parse(localStorage.getItem('driven_user') || sessionStorage.getItem('driven_user'));
      } catch (e) {}
    }
    return user;
  }

  function getAuthHeaders(additionalHeaders = {}) {
    let user = getUserSession();
    const headers = { ...additionalHeaders };
    
    if (!user && window.dashUser) user = window.dashUser;
    if (!user && window.drivenUser) user = window.drivenUser;

    if (user) {
      const orgId = user.org_id || user.orgId || user.organization_id;
      const userId = user.id || user.userId || user.user_id;

      if (orgId) headers['x-org-id'] = String(orgId);
      if (userId) headers['x-user-id'] = String(userId);
    }
    
    return headers;
  }

  function iconSvg(id) {
    return `<svg><use href="#${id}"/></svg>`;
  }

  function tankLevelHtml(currentQty, capacity) {
    const cq = Math.max(0, safeNum(currentQty));
    const cap = Math.max(0, safeNum(capacity));
    const pct = cap > 0 ? Math.max(0, Math.min(100, (cq / cap) * 100)) : 0;
    const lowClass = pct < 20 ? ' low' : '';
    return `<div class="tank-level-mini"><div class="tank-level-bar"><div class="tank-level-fill${lowClass}" style="width:${pct}%"></div></div><span class="tank-level-text">${cq}/${cap}</span></div>`;
  }

  const ALLOWED_OWNERSHIP = ['company', 'employee', 'rental'];

  function ownershipBadge(t) {
    const otRaw = (t.ownership_type || '').toLowerCase();
    if (!otRaw || otRaw === 'company') return '';
    const ot = ALLOWED_OWNERSHIP.indexOf(otRaw) !== -1 ? otRaw : 'company';
    if (ot === 'company') return '';
    return `<span class="ownership-badge ${ot}">${esc(ot)}${t.owner_name ? ': ' + esc(t.owner_name) : ''}</span>`;
  }

  function statusBadge(t) {
    const rawStatus = String(t.status || '').trim().toLowerCase();
    const isInactive = /inactive|out of service|retired|archived/.test(rawStatus);
    const statusText = isInactive ? 'inactive' : 'active';
    return `<span class="status-badge ${statusText}">${esc(statusText)}</span>`;
  }

  function parseDate(s) {
    if (!s) return NaN;
    const d = new Date(s);
    return isNaN(d.getTime()) ? NaN : d.getTime();
  }

  function txInDateRange(tx, fromDate, toDate) {
    const d = parseDate(tx.transaction_date);
    if (isNaN(d)) return true;
    const f = parseDate(fromDate);
    if (!isNaN(f) && d < f) return false;
    const t = parseDate(toDate);
    if (!isNaN(t) && d > t + 86399999) return false;
    return true;
  }

  function txMatchesLocation(tx, locFilter) {
    if (!locFilter) return true;
    return (tx.location || '').trim() === locFilter;
  }

  function formatPersonName(tx) {
    const raw = (typeof tx === 'object' && tx !== null)
      ? (tx.person || tx.person_name || tx.created_by_name || tx.submitted_by || tx.user || '')
      : (tx || '');
    if (!raw) return '—';
    if (raw.indexOf('@') !== -1) {
      const parts = raw.split('@')[0].split('.');
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return raw;
  }

  function getTxAssetTarget(t) {
    if (t.asset_name) return t.asset_name;
    if (t.asset_number) return t.asset_number;
    if (t.to_entity_name) return t.to_entity_name;
    
    if (t.to_entity_id) {
      const targetAsset = allAssets.find(x => x.id === t.to_entity_id);
      if (targetAsset) return (targetAsset.asset_number ? targetAsset.asset_number + ' — ' : '') + targetAsset.name;

      const targetTank = allTanks.find(x => x.id === t.to_entity_id);
      if (targetTank) return targetTank.name || targetTank.asset_number || t.to_entity_id;
    }

    if (t.transaction_type === 'portable_fill') {
      return t.project_name ? `Gas Can – ${t.project_name}` : 'Gas Can';
    }
    if (t.transaction_type === 'dragup_fill') {
      return 'Mobile / Drag-up Tank';
    }

    return '—';
  }

  function getTransferredFrom(t) {
    if (t.transaction_type === 'purchase') return t.vendor || 'Vendor';
    if (t.from_entity_type === 'vendor') return t.from_entity_name || t.vendor || 'Vendor';
    if (t.from_entity_name) return t.from_entity_name;
    const tank = allTanks.find(x => x.id === t.from_entity_id);
    if (tank) return tank.name || tank.asset_number || t.from_entity_id || '—';
    return t.from_entity_id || '—';
  }

  /* ===== DRILL-DOWN / HISTORY MODAL ===== */

  function showEntityHistoryModal(entityType, entityId, entityName) {
    const f = getOverviewFilters();
    let relevantTxs = allTransactions.filter(tx => {
      if (!txMatchesLocation(tx, f.location)) return false;
      if (!txInDateRange(tx, f.fromDate, f.toDate)) return false;

      if (entityType === 'asset' || entityType === 'equipment') {
        return tx.asset_id === entityId || tx.to_entity_id === entityId;
      } else if (entityType === 'tank' || entityType === 'bulk' || entityType === 'dragup') {
        return tx.from_entity_id === entityId || tx.to_entity_id === entityId;
      } else if (entityType === 'portable') {
        return (tx.transaction_type === 'portable_fill' || tx.transaction_type === 'portable_issue') &&
               (tx.project_name === entityId || (entityId === 'Unassigned' && !tx.project_name) || tx.to_entity_id === entityId);
      }
      return false;
    });

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--fuel-card-bg,#ffffff);border-radius:12px;padding:24px;max-width:850px;width:92%;max-height:85vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.5);border:2px solid #64748b;box-sizing:border-box;';

    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border,#cbd5e1);padding-bottom:12px;">`;
    html += `<h3 style="margin:0;font-size:18px;font-weight:700;color:var(--text,#0f172a);">Transaction History: ${esc(entityName)}</h3>`;
    html += `<button class="modal-close-btn" style="background:none;border:none;font-size:24px;font-weight:700;cursor:pointer;color:var(--text-muted,#64748b);">×</button></div>`;

    if (relevantTxs.length === 0) {
      html += `<div style="padding:20px;text-align:center;color:var(--text-muted,#64748b);">No transactions found for this record matching current filters.</div>`;
    } else {
      html += `<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>Date</th><th>Type</th><th>Fuel</th><th>Qty (${UOM.abbr})</th><th>From</th><th>To/Asset</th><th>Person</th><th>Project</th><th>Location</th></tr></thead><tbody>`;
      relevantTxs.forEach(t => {
        const date = t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : '—';
        html += `<tr><td>${date}</td><td>${esc(txTypeLabel(t.transaction_type))}</td><td>${esc(t.fuel_type || '—')}</td><td style="font-weight:700;color:var(--primary);">${safeNum(t.quantity).toFixed(2)}</td><td>${esc(getTransferredFrom(t))}</td><td style="font-weight:600;">${esc(getTxAssetTarget(t))}</td><td>${esc(formatPersonName(t))}</td><td style="font-weight:600;color:var(--primary);">${esc(t.project_name || 'Unassigned')}</td><td>${esc(t.location || '—')}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    }

    html += `<div style="margin-top:20px;display:flex;justify-content:flex-end;"><button class="modal-close-btn print-btn" style="padding:8px 16px;font-size:13px;">Close</button></div>`;

    modal.innerHTML = html;
    overlay.appendChild(modal);

    modal.querySelectorAll('.modal-close-btn').forEach(btn => btn.addEventListener('click', () => overlay.remove()));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  /* ===== HEADER & NAVIGATION ===== */

  function makeTabsSticky() {
    const h = document.getElementById('dashHeader');
    const tb = document.getElementById('fuelTabBar');
    if (h && tb && h.nextElementSibling !== tb) {
      h.parentNode.insertBefore(tb, h.nextSibling);
    }
  }

  function insertHeaderTitle() {
    const row1 = document.querySelector('.dash-header-row1');
    if (!row1) return;

    let title = row1.querySelector('.fuel-header-title');
    if (!title) {
      title = document.createElement('div');
      title.className = 'fuel-header-title';
      
      const drivenLogo = row1.querySelector('.dash-driven-logo');
      if (drivenLogo) {
        row1.insertBefore(title, drivenLogo);
      } else {
        row1.appendChild(title);
      }
    }
    title.textContent = 'Fuel Management';
  }

  function goToMainDashboard() {
    const user = getUserSession();
    if (!user) {
      window.location.href = '/public/login.html';
      return;
    }
    const r = (user.role || '').toLowerCase();
    if (r === 'driv-en founder' || r === 'owner') window.location.href = '/app/dashboard/owner-dashboard.html';
    else if (r === 'admin') window.location.href = '/app/dashboard/admin.html';
    else window.location.href = '/app/dashboard/employee-dashboard.html';
  }

  async function dashLogout() {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include', headers: getAuthHeaders() });
    } catch (e) {}
    window.location.href = '/public/login.html';
  }

  function switchTab(tabName) {
    document.querySelectorAll('.fuel-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.fuel-tab-content').forEach(c => c.classList.remove('active'));

    const btn = document.querySelector(`.fuel-tab[data-tab="${tabName}"]`);
    const content = document.getElementById(`tab-${tabName}`);
    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');

    const tanksBar = document.getElementById('tanksSubtabBar');
    const txBar = document.getElementById('txSubtabBar');
    if (tanksBar) tanksBar.classList.toggle('visible', tabName === 'tanks');
    if (txBar) txBar.classList.toggle('visible', tabName === 'transactions');

    if (tabName === 'transactions') {
      window._txLoaded = true;
      const activeSubtabBtn = document.querySelector('#txSubtabBar .fuel-subtab.active');
      const activeSubtab = activeSubtabBtn ? activeSubtabBtn.getAttribute('data-subtab') : 'all';
      renderTxForSubtab(activeSubtab);
    }
    if (tabName === 'alerts') {
      renderAlerts();
    }
  }

  function switchTankSubtab(subtabName) {
    document.querySelectorAll('#tanksSubtabBar .fuel-subtab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.fuel-subtab-content[id^="tanks-subtab-"]').forEach(c => c.classList.remove('active'));
    const btn = document.querySelector(`#tanksSubtabBar [data-subtab="${subtabName}"]`);
    if (btn) btn.classList.add('active');
    const content = document.getElementById(`tanks-subtab-${subtabName}`);
    if (content) content.classList.add('active');

    if (subtabName === 'overview') {
      renderOverview();
    } else {
      renderTanksForSubtab(subtabName);
    }
  }

  function switchTxSubtab(subtabName) {
    document.querySelectorAll('#txSubtabBar .fuel-subtab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.fuel-subtab-content[id^="tx-subtab-"]').forEach(c => c.classList.remove('active'));
    const btn = document.querySelector(`#txSubtabBar [data-subtab="${subtabName}"]`);
    if (btn) btn.classList.add('active');
    const content = document.getElementById(`tx-subtab-${subtabName}`);
    if (content) content.classList.add('active');
    renderTxForSubtab(subtabName);
  }

  /* ===== TANK TYPE & DYNAMIC SUBTABS ===== */

  function getTankTypeDisplayName(systemKey) {
    if (systemKey === 'portable_can' || systemKey === 'portable') return 'Portable Cans';
    const t = tankTypes.find(tt => tt.system_key === systemKey);
    return t ? t.display_name : systemKey;
  }

  function getTankTypeShortName(systemKey) {
    if (systemKey === 'portable_can' || systemKey === 'portable') return 'Portable Cans';
    const name = getTankTypeDisplayName(systemKey);
    if (name.length > 15) return name.split(' ')[0];
    return name;
  }

  async function loadTankTypes() {
    try {
      const resp = await fetch('/api/fuel-tank-types', { headers: getAuthHeaders() });
      const data = await resp.json();
      if (data.success && data.tank_types) tankTypes = data.tank_types;
    } catch (e) {
      console.error('Error loading tank types:', e.message);
      reportError('loadTankTypes', e);
    }
  }

  function generateDynamicSubtabs() {
    const bar = document.getElementById('tanksSubtabBar');
    if (!bar) return;
    const overviewBtn = bar.querySelector('[data-subtab="overview"]');
    while (bar.firstChild) bar.removeChild(bar.firstChild);
    if (overviewBtn) bar.appendChild(overviewBtn);

    const dynamicContainer = document.getElementById('dynamicTankSubtabs');
    if (!dynamicContainer) return;
    dynamicContainer.innerHTML = '';

    tankTypes.forEach(tt => {
      const subtabKey = tt.system_key.replace('_tank', '').replace('portable_can', 'portable');
      const btn = document.createElement('button');
      btn.className = 'fuel-subtab';
      btn.setAttribute('data-subtab', subtabKey);
      btn.textContent = getTankTypeShortName(tt.system_key);
      bar.appendChild(btn);

      const content = document.createElement('div');
      content.className = 'fuel-subtab-content';
      content.id = `tanks-subtab-${subtabKey}`;
      const inner = document.createElement('div');
      inner.id = `${subtabKey}TanksContainer`;
      content.appendChild(inner);
      dynamicContainer.appendChild(content);
    });
  }

  /* ===== TANK OVERVIEW & FILTERING ===== */

  function dedupTanks(tanks) {
    const seen = {};
    return tanks.filter(t => {
      const key = t.id || (t.name || '') + '|' + (t.tank_type || '') + '|' + (t.location || '');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function filterTanks(tanks, search) {
    if (!search) return tanks;
    const s = search.toLowerCase();
    return tanks.filter(t => {
      const hay = [t.name, t.tank_type, t.fuel_type, t.location, t.status, t.owner_name, t.ownership_type, t.project_name].filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(s) !== -1;
    });
  }

  function getTanksForSubtab(subtab) {
    if (subtab === 'equipment') return allAssets;
    if (subtab === 'portable') {
      const portableTanks = allTanks.filter(t => t.tank_type === 'portable' || t.tank_type === 'portable_can');
      if (portableTanks.length > 0) return dedupTanks(portableTanks);

      const projectMap = {};
      allTransactions.forEach(tx => {
        if (tx.transaction_type === 'portable_fill' || tx.transaction_type === 'portable_issue') {
          const proj = tx.project_name || 'Unassigned';
          if (!projectMap[proj]) {
            projectMap[proj] = {
              id: proj,
              name: 'Gas Can – ' + proj,
              project_name: proj,
              status: 'active'
            };
          }
        }
      });
      return Object.values(projectMap);
    }
    return dedupTanks(allTanks.filter(t => t.tank_type === subtab));
  }

  function renderTankRows(tanks, subtab) {
    if (subtab === 'portable') {
      return tanks.map(t => {
        const canName = t.name || (t.project_name ? 'Gas Can – ' + t.project_name : 'Gas Can');
        const projName = t.project_name || t.id || 'Unassigned';
        return `<tr class="subtab-drilldown-row" data-subtab="portable" data-id="${esc(projName)}" data-name="${esc(canName)}" style="cursor:pointer;">
          <td style="font-weight:600;">${esc(canName)}</td>
          <td style="font-weight:600;color:var(--primary);">${esc(projName)} 🔍</td>
          <td>${statusBadge(t)}</td>
        </tr>`;
      }).join('');
    }

    return tanks.map(t => {
      const id = t.id || t.asset_number || t.name;
      const name = t.name || t.asset_number || '—';
      return `<tr class="subtab-drilldown-row" data-subtab="${subtab}" data-id="${id}" data-name="${esc(name)}" style="cursor:pointer;">
        <td style="font-weight:600;color:var(--primary);">${esc(name)} 🔍</td>
        <td>${esc(t.fuel_type || '—')}</td>
        <td>${tankLevelHtml(t.current_quantity || 0, t.capacity || t.fuel_tank_capacity || 0)}</td>
        <td>${safeNum(t.capacity || t.fuel_tank_capacity)} ${UOM.abbr}</td>
        <td>${esc(t.location || t.current_location || '—')}</td>
        <td>${ownershipBadge(t)}</td>
        <td>${statusBadge(t)}</td>
      </tr>`;
    }).join('');
  }

  function renderTankTable(tanks, containerId, subtab) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (tanks.length === 0) {
      container.innerHTML = '<div class="empty-state">No tanks found.</div>';
      return;
    }
    const filterBarId = `${containerId}-filter`;
    const tableId = `${containerId}-table`;

    const tableHeaders = subtab === 'portable'
      ? `<thead><tr><th>Portable Can</th><th>Project</th><th>Status</th></tr></thead>`
      : `<thead><tr><th>Tank / Asset</th><th>Fuel Type</th><th>Level</th><th>Capacity</th><th>Location</th><th>Ownership</th><th>Status</th></tr></thead>`;

    container.innerHTML = `<div class="fuel-filter-bar"><span class="fuel-filter-label">Search:</span><input type="text" id="${filterBarId}" placeholder="Name, project, location…" style="flex:1;min-width:180px;"></div><div class="fuel-table-wrap"><table class="fuel-table" id="${tableId}">${tableHeaders}<tbody id="${tableId}-body">${renderTankRows(tanks, subtab)}</tbody></table></div>`;

    container._tankSortCol = 'name';
    container._tankSortDir = 'asc';
    container._tankSearch = '';

    const filterInput = document.getElementById(filterBarId);
    if (filterInput) {
      filterInput.addEventListener('input', (e) => onTankFilter(containerId, e.target.value));
    }

    container.querySelectorAll('.subtab-drilldown-row').forEach(row => {
      row.addEventListener('click', () => {
        const s = row.getAttribute('data-subtab');
        const id = row.getAttribute('data-id');
        const name = row.getAttribute('data-name');
        showEntityHistoryModal(s, id, name);
      });
    });
  }

  function onTankFilter(containerId, searchText) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container._tankSearch = searchText;
    const subtab = container.getAttribute('data-subtab') || 'all';
    const tanks = getTanksForSubtab(subtab);
    const filtered = filterTanks(tanks, searchText);
    const tbody = container.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = renderTankRows(filtered, subtab);
      container.querySelectorAll('.subtab-drilldown-row').forEach(row => {
        row.addEventListener('click', () => {
          const s = row.getAttribute('data-subtab');
          const id = row.getAttribute('data-id');
          const name = row.getAttribute('data-name');
          showEntityHistoryModal(s, id, name);
        });
      });
    }
  }

  function renderTanksForSubtab(subtab) {
    const tanks = getTanksForSubtab(subtab);
    const containerId = `${subtab}TanksContainer`;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.setAttribute('data-subtab', subtab);

    let headingText = subtab === 'portable' ? 'Portable Cans' : (subtab === 'equipment' ? 'Equipment' : getTankTypeDisplayName(`${subtab}_tank`));
    if (subtab !== 'portable' && subtab !== 'equipment') headingText += ' Tanks';

    container.innerHTML = `<div class="fuel-stat-card" style="text-align:left;margin-bottom:16px;padding:16px 20px;border:1px solid #16a34a;border-radius:10px;"><div style="font-size:18px;font-weight:700;color:var(--text,#0f172a);display:flex;align-items:center;justify-content:space-between;"><span>${esc(headingText)}</span><span style="font-size:13px;font-weight:600;color:var(--text-muted,#64748b);">${tanks.length} record${tanks.length !== 1 ? 's' : ''}</span></div></div>`;
    
    const innerDiv = document.createElement('div');
    innerDiv.id = `${containerId}-inner`;
    container.appendChild(innerDiv);
    renderTankTable(tanks, innerDiv.id, subtab);
  }

  function getAllLocations() {
    const locs = {};
    allTanks.forEach(t => { if (t.location && t.location.trim()) locs[t.location.trim()] = true; });
    allAssets.forEach(a => { if (a.current_location && a.current_location.trim()) locs[a.current_location.trim()] = true; });
    allTransactions.forEach(t => { if (t.location && t.location.trim()) locs[t.location.trim()] = true; });
    return Object.keys(locs).sort();
  }

  function populateLocationFilter() {
    const select = document.getElementById('overviewLocationFilter');
    if (!select) return;
    const currentVal = select.value;
    const locations = getAllLocations();
    select.innerHTML = '<option value="">All Locations</option>' + locations.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
    select.value = currentVal;
  }

  function getOverviewFilters() {
    return {
      location: (document.getElementById('overviewLocationFilter') || {}).value || '',
      fromDate: (document.getElementById('overviewFromDate') || {}).value || '',
      toDate: (document.getElementById('overviewToDate') || {}).value || ''
    };
  }

  function clearOverviewFilters() {
    if (document.getElementById('overviewLocationFilter')) document.getElementById('overviewLocationFilter').value = '';
    if (document.getElementById('overviewFromDate')) document.getElementById('overviewFromDate').value = '';
    if (document.getElementById('overviewToDate')) document.getElementById('overviewToDate').value = '';
    renderOverview();
  }

  function printOverview() {
    const container = document.getElementById('overviewContainer');
    if (!container || !container.innerHTML.trim()) {
      alert('Nothing to print.');
      return;
    }
    const w = window.open('', '_blank', 'width=900,height=700');
    const css = '<style>body{font-family:Arial,Helvetica,sans-serif;margin:20px;color:#1e293b;}h2{margin:0 0 4px;font-size:18px;}.print-meta{font-size:12px;color:#64748b;margin-bottom:16px;}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;}th{background:#f1f5f9;padding:8px 10px;text-align:left;font-weight:600;border-bottom:2px solid #cbd5e1;white-space:nowrap;}td{padding:6px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap;}tr:nth-child(even){background:#f8fafc;}h3{font-size:14px;margin:16px 0 4px;}@media print{body{margin:0;}}</style>';
    const meta = '<div class="print-meta">Generated: ' + new Date().toLocaleString() + ' | DRIV-EN Fuel Management — Tank Overview</div>';
    w.document.write('<html><head><title>Tank Overview</title>' + css + '</head><body><h2>Tank Overview</h2>' + meta + container.innerHTML + '</body></html>');
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
  }

  function computeBulkTankTotals(tankId, locFilter, fromDate, toDate) {
    let purchased = 0, dispensed = 0;
    allTransactions.forEach(tx => {
      if (tx.transaction_type === 'purchase' && tx.to_entity_id === tankId) {
        if (!txMatchesLocation(tx, locFilter)) return;
        if (!txInDateRange(tx, fromDate, toDate)) return;
        purchased += (tx.quantity || 0);
      }
      if (tx.transaction_type === 'bulk_issue' && tx.from_entity_id === tankId) {
        if (!txMatchesLocation(tx, locFilter)) return;
        if (!txInDateRange(tx, fromDate, toDate)) return;
        dispensed += (tx.quantity || 0);
      }
    });
    return { purchased, dispensed };
  }

  function computeDragupTankTotals(tankId, locFilter, fromDate, toDate) {
    let filled = 0, dispensed = 0;
    allTransactions.forEach(tx => {
      if (tx.transaction_type === 'dragup_fill' && tx.to_entity_id === tankId) {
        if (!txMatchesLocation(tx, locFilter)) return;
        if (!txInDateRange(tx, fromDate, toDate)) return;
        filled += (tx.quantity || 0);
      }
      if (tx.transaction_type === 'dragup_issue' && tx.from_entity_id === tankId) {
        if (!txMatchesLocation(tx, locFilter)) return;
        if (!txInDateRange(tx, fromDate, toDate)) return;
        dispensed += (tx.quantity || 0);
      }
    });
    return { filled, dispensed };
  }

  function computeAssetFuelTotal(assetId, locFilter, fromDate, toDate) {
    let total = 0;
    allTransactions.forEach(tx => {
      const isTargetAsset = (tx.asset_id === assetId || tx.to_entity_id === assetId);
      if (!isTargetAsset) return;

      const type = tx.transaction_type;
      if (!type) return;

      if (type === 'bulk_issue' || type === 'dragup_issue' || type === 'portable_issue' || type === 'purchase') {
        if (!txMatchesLocation(tx, locFilter)) return;
        if (!txInDateRange(tx, fromDate, toDate)) return;
        total += safeNum(tx.quantity);
      } else if (type === 'return') {
        if (!txMatchesLocation(tx, locFilter)) return;
        if (!txInDateRange(tx, fromDate, toDate)) return;
        total -= safeNum(tx.quantity);
      }
    });
    return total;
  }

  function computePortableProjectTotals(locFilter, fromDate, toDate) {
    const byProject = {};
    allTransactions.forEach(tx => {
      if (tx.transaction_type !== 'portable_fill' && tx.transaction_type !== 'portable_issue') return;
      if (!txMatchesLocation(tx, locFilter)) return;
      if (!txInDateRange(tx, fromDate, toDate)) return;
      const projName = tx.project_name || 'Unassigned';
      if (!byProject[projName]) byProject[projName] = { project_name: projName, total_filled: 0, total_issued: 0, tx_count: 0 };
      if (tx.transaction_type === 'portable_fill') byProject[projName].total_filled += (tx.quantity || 0);
      if (tx.transaction_type === 'portable_issue') byProject[projName].total_issued += (tx.quantity || 0);
      byProject[projName].tx_count += 1;
    });
    return Object.values(byProject).sort((a, b) => b.total_filled - a.total_filled);
  }

  function renderOverview() {
    const container = document.getElementById('overviewContainer');
    if (!container) return;
    const f = getOverviewFilters();
    const filteredTanks = dedupTanks(allTanks.filter(t => {
      if (t.status === 'inactive') return false;
      if (!f.location) return true;
      return (t.location || '').trim() === f.location;
    }));
    const filteredAssets = allAssets.filter(a => {
      if (a.status === 'inactive') return false;
      if (!f.location) return true;
      return (a.current_location || '').trim() === f.location;
    });
    const bulkTanks = filteredTanks.filter(t => t.tank_type === 'bulk');
    const dragupTanks = filteredTanks.filter(t => t.tank_type === 'dragup');

    const equipmentTanks = filteredAssets;

    const fuelTypeTotals = {};
    bulkTanks.forEach(t => {
      const ft = (t.fuel_type || 'Unknown').trim();
      if (!fuelTypeTotals[ft]) fuelTypeTotals[ft] = { gallons: 0, tankCount: 0, type: 'Bulk' };
      fuelTypeTotals[ft].gallons += (t.current_quantity || 0);
      fuelTypeTotals[ft].tankCount++;
    });

    const statsContainer = document.getElementById('ov-fuel-stats');
    if (statsContainer) {
      const fuelKeys = Object.keys(fuelTypeTotals).sort();
      if (fuelKeys.length === 0) {
        statsContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);font-size:14px;">No bulk fuel on hand.</div>';
      } else {
        statsContainer.innerHTML = fuelKeys.map(ft => {
          const d = fuelTypeTotals[ft];
          return `<div class="fuel-stat-card"><div class="fuel-stat-number">${d.gallons.toLocaleString()} ${UOM.abbr}</div><div class="fuel-stat-label">${esc(ft)} (${d.tankCount} bulk tank${d.tankCount !== 1 ? 's' : ''})</div></div>`;
        }).join('');
      }
    }

    let html = '';

    if (bulkTanks.length > 0) {
      html += `<div class="overview-section"><div class="overview-section-title">${iconSvg('icon-barrel')} Bulk Storage Tanks <span class="count">(${bulkTanks.length})</span></div>`;
      html += `<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>Tank Name</th><th>Fuel Type</th><th>Capacity</th><th>Fuel Purchased</th><th>Fuel Dispensed</th><th>Current Qty</th><th>Level</th><th>Location</th><th>Action</th></tr></thead><tbody>`;
      bulkTanks.forEach(t => {
        const totals = computeBulkTankTotals(t.id, f.location, f.fromDate, f.toDate);
        html += `<tr><td style="font-weight:600;">${esc(t.name || '')}</td><td>${esc(t.fuel_type || '—')}</td><td>${safeNum(t.capacity)} ${UOM.abbr}</td><td style="font-weight:600;">${totals.purchased.toLocaleString()} ${UOM.abbr}</td><td style="font-weight:600;">${totals.dispensed.toLocaleString()} ${UOM.abbr}</td><td style="font-weight:700;color:var(--primary);">${safeNum(t.current_quantity)} ${UOM.abbr}</td><td>${tankLevelHtml(t.current_quantity || 0, t.capacity || 0)}</td><td>${esc(t.location || '—')}</td><td><button class="adjust-btn" data-id="${t.id}" data-name="${esc(t.name || '')}" data-qty="${safeNum(t.current_quantity)}" data-cap="${safeNum(t.capacity)}" style="padding:4px 10px;font-size:12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-step);color:var(--text);cursor:pointer;">Adjust</button></td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }

    if (dragupTanks.length > 0) {
      html += `<div class="overview-section"><div class="overview-section-title">${iconSvg('icon-dragup-tank')} Mobile / Drag-up Tanks <span class="count">(${dragupTanks.length})</span></div>`;
      html += `<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>Tank Name</th><th>Fuel Type</th><th>Capacity</th><th>${UOM.plural} Filled</th><th>${UOM.plural} Dispensed</th><th>Current Qty</th><th>Level</th><th>Location</th></tr></thead><tbody>`;
      dragupTanks.forEach(t => {
        const totals = computeDragupTankTotals(t.id, f.location, f.fromDate, f.toDate);
        html += `<tr><td style="font-weight:600;">${esc(t.name || '')}</td><td>${esc(t.fuel_type || '—')}</td><td>${safeNum(t.capacity)} ${UOM.abbr}</td><td style="font-weight:600;">${totals.filled.toLocaleString()} ${UOM.abbr}</td><td style="font-weight:600;">${totals.dispensed.toLocaleString()} ${UOM.abbr}</td><td style="font-weight:700;color:var(--primary);">${safeNum(t.current_quantity)} ${UOM.abbr}</td><td>${tankLevelHtml(t.current_quantity || 0, t.capacity || 0)}</td><td>${esc(t.location || '—')}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }

    if (equipmentTanks.length > 0) {
      html += `<div class="overview-section"><div class="overview-section-title">${iconSvg('icon-equipment')} Equipment Assets <span class="count">(${equipmentTanks.length})</span></div>`;
      html += `<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>Asset #</th><th>Name</th><th>Fuel Type</th><th>Total ${UOM.plural} Fueled</th><th>Location</th></tr></thead><tbody>`;
      equipmentTanks.forEach(a => {
        const totalFueled = computeAssetFuelTotal(a.id, f.location, f.fromDate, f.toDate);
        html += `<tr><td style="font-weight:600;">${esc(a.asset_number || '')}</td><td>${esc(a.name || '—')}</td><td>${esc(a.fuel_type || '—')}</td><td style="font-weight:700;color:var(--primary);">${totalFueled.toLocaleString()} ${UOM.abbr}</td><td>${esc(a.current_location || '—')}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }

    const projectTotals = computePortableProjectTotals(f.location, f.fromDate, f.toDate);
    if (projectTotals.length > 0) {
      html += `<div class="overview-section"><div class="overview-section-title">${iconSvg('icon-jerrycan')} Portable Cans <span class="count">(per project)</span></div>`;
      html += `<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>Gas Can (Project)</th><th>${UOM.plural} Put In Cans</th><th>${UOM.plural} Dispensed</th><th># Transactions</th></tr></thead><tbody>`;
      projectTotals.forEach(p => {
        const canLabel = 'Gas Can – ' + esc(p.project_name || 'Unassigned');
        html += `<tr><td style="font-weight:600;">${canLabel}</td><td style="font-weight:700;color:var(--primary);">${p.total_filled.toLocaleString()} ${UOM.abbr}</td><td style="font-weight:600;">${p.total_issued.toLocaleString()} ${UOM.abbr}</td><td>${p.tx_count}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }

    if (bulkTanks.length === 0 && dragupTanks.length === 0 && equipmentTanks.length === 0 && projectTotals.length === 0) {
      html = '<div class="empty-state">No fuel tanks or transactions found. Set up tanks in the Fuel Management dashboard to get started.</div>';
    }

    container.innerHTML = html;

    // Bind Adjust Buttons
    container.querySelectorAll('.adjust-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.target.getAttribute('data-id');
        const name = e.target.getAttribute('data-name');
        const qty = parseFloat(e.target.getAttribute('data-qty'));
        const cap = parseFloat(e.target.getAttribute('data-cap'));
        showAdjustModal(id, name, qty, cap);
      });
    });
  }

  async function loadTanks() {
    try {
      const headers = getAuthHeaders();
      const results = await Promise.allSettled([
        fetch('/api/fuel-tanks', { headers }),
        fetch('/api/Equipment', { headers }),
        fetch('/api/fuel-transactions', { headers })
      ]);

      if (results[0].status === 'fulfilled' && results[0].value.ok) {
        const tanksData = await results[0].value.json();
        allTanks = tanksData.tanks || tanksData.records || tanksData.data || [];
      }
      
      if (results[1].status === 'fulfilled' && results[1].value.ok) {
        const assetsData = await results[1].value.json();
        const rawList = assetsData.records || assetsData.equipment || assetsData.assets || assetsData.data || (Array.isArray(assetsData) ? assetsData : []);
        
        allAssets = rawList.map(r => {
          const item = r.fields || r;
          
          const rawStatus = String(item.status || item.state || 'active').trim().toLowerCase();
          const isInactive = /inactive|out of service|retired|archived/.test(rawStatus);
          const computedStatus = isInactive ? 'inactive' : 'active';

          return {
            id: item.id || r.id,
            name: item.name || item.equipment_name || item.asset_name || 'Equipment Unit',
            asset_number: item.asset_number || item.equipment_id || item.asset_num || '',
            capacity: safeNum(item.fuel_tank_capacity || item.capacity || 0),
            fuel_tank_capacity: safeNum(item.fuel_tank_capacity || item.capacity || 0),
            current_quantity: safeNum(item.current_quantity || item.current_qty || 0),
            fuel_type: item.fuel_type || 'Diesel',
            status: computedStatus,
            current_location: item.location || item.current_location || item.jobsite || '',
            location: item.location || item.current_location || item.jobsite || '',
            ownership_type: item.ownership_type || item.ownership || 'company',
            owner_name: item.owner_name || item.assigned_to || item.operator || ''
          };
        });
      }

      if (results[2].status === 'fulfilled' && results[2].value.ok) {
        const txData = await results[2].value.json();
        allTransactions = txData.transactions || txData.records || txData.data || [];
      }

      populateLocationFilter();
      generateDynamicSubtabs();
      renderOverview();
      loadFlags();
      loadNotifications();
    } catch (e) {
      console.error('loadTanks error:', e.message);
      reportError('loadTanks', e);
      const container = document.getElementById('overviewContainer');
      if (container) {
        container.innerHTML = '<div class="empty-state" style="color:#cc0000;">⚠️ Error loading fuel data: ' + esc(e.message) + '<br><br>Please refresh the page or try again later.</div>';
      }
    }
  }

  /* ===== TRANSACTIONS TAB ===== */

  function txTypeLabel(type) {
    const labels = {
      purchase: 'Purchase',
      bulk_issue: 'Fuel Transfer',
      dragup_fill: 'Tank Fill',
      dragup_issue: 'Fuel Transfer',
      portable_fill: 'Can Fill',
      portable_issue: 'Fuel Transfer',
      return: 'Return',
      adjustment: 'Adjustment'
    };
    return labels[type] || (type || '').replace(/_/g, ' ');
  }

  function getTxForSubtab(subtab) {
    if (subtab === 'all') return allTransactions;
    if (subtab === 'purchase') return allTransactions.filter(t => t.transaction_type === 'purchase');
    if (subtab === 'issue') return allTransactions.filter(t => 
      t.transaction_type === 'bulk_issue' || 
      t.transaction_type === 'dragup_issue' || 
      t.transaction_type === 'portable_issue' || 
      (t.transaction_type === 'purchase' && (t.to_entity_type === 'asset' || t.asset_id || t.to_entity_id))
    );
    if (subtab === 'transfer') return allTransactions.filter(t => 
      t.transaction_type === 'return' || 
      t.transaction_type === 'dragup_fill' || 
      t.transaction_type === 'portable_fill' || 
      t.transaction_type === 'bulk_issue' || 
      t.transaction_type === 'dragup_issue' || 
      t.transaction_type === 'portable_issue' || 
      t.transaction_type === 'purchase'
    );
    return allTransactions;
  }

  function getTxLocations() {
    const locs = {};
    allTransactions.forEach(t => { if (t.location && t.location.trim()) locs[t.location.trim()] = true; });
    return Object.keys(locs).sort();
  }

  function applyTxFilters(txs) {
    const s = (txSearchText || '').toLowerCase();
    const loc = txLocationFilter || '';
    const fromD = txFromDate || '';
    const toD = txToDate || '';
    return txs.filter(t => {
      if (loc && (t.location || '').trim() !== loc) return false;
      if (fromD && (t.transaction_date || '') < fromD) return false;
      if (toD && (t.transaction_date || '') > toD + 'T23:59:59') return false;
      if (s) {
        const personName = formatPersonName(t);
        const assetTarget = getTxAssetTarget(t);
        const hay = [t.transaction_type, t.fuel_type, assetTarget, personName, t.project_name, t.location, t.vendor].filter(Boolean).join(' ').toLowerCase();
        if (hay.indexOf(s) === -1) return false;
      }
      return true;
    });
  }

  function computeTxTotals(txs) {
    let totalGal = 0, totalPurchases = 0, totalIssues = 0;
    txs.forEach(t => {
      const q = safeNum(t.quantity);
      const type = t.transaction_type;
      if (type === 'purchase') totalPurchases += q;
      else if (type === 'bulk_issue' || type === 'dragup_issue' || type === 'portable_issue') totalIssues += q;
      totalGal += q;
    });
    return { totalGal, totalPurchases, totalIssues, txCount: txs.length };
  }

  function renderTxRows(txs, subtab) {
    return txs.map(t => {
      const date = t.transaction_date ? esc(new Date(t.transaction_date).toLocaleDateString()) : '—';
      const qty = safeNum(t.quantity).toFixed(2);
      const from = getTransferredFrom(t);
      const assetTarget = getTxAssetTarget(t);
      const personName = formatPersonName(t);
      
      let fromTd = `<td>${esc(from)}</td>`;
      let assetTd = `<td style="font-weight:600;color:var(--primary);">${esc(assetTarget)} 🔍</td>`;

      return `<tr class="tx-row-clickable" data-tx-id="${t.id}" title="Click for details"><td>${date}</td><td>${esc(txTypeLabel(t.transaction_type))}</td><td>${esc(t.fuel_type || '—')}</td><td style="font-weight:600;color:var(--primary);">${qty}</td>${fromTd}${assetTd}<td>${esc(personName)}</td><td>${esc(t.project_name || '—')}</td><td>${esc(t.location || '—')}</td></tr>`;
    }).join('');
  }

  function renderTxTable(txs, containerId, subtab) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (txs.length === 0 && !txSearchText && !txLocationFilter && !txFromDate && !txToDate) {
      container.innerHTML = '<div class="empty-state">No transactions found.</div>';
      return;
    }
    const filterId = `${containerId}-filter`;
    const tableId = `${containerId}-table`;
    const locFilterId = `${containerId}-locfilter`;
    const fromId = `${containerId}-from`;
    const toId = `${containerId}-to`;
    const printBtnId = `${containerId}-print-btn`;

    const txLocs = getTxLocations();
    const locOptions = '<option value="">All Locations</option>' + txLocs.map(l => `<option value="${esc(l)}"${txLocationFilter === l ? ' selected' : ''}>${esc(l)}</option>`).join('');

    container.innerHTML = `<div class="fuel-filter-bar"><span class="fuel-filter-label">Search:</span><input type="text" id="${filterId}" placeholder="Type, fuel, asset, person, project…" style="flex:1;min-width:140px;" value="${esc(txSearchText)}"><span class="fuel-filter-label">Location:</span><select id="${locFilterId}">${locOptions}</select><span class="fuel-filter-label">From:</span><input type="date" id="${fromId}" value="${esc(txFromDate)}"><span class="fuel-filter-label">To:</span><input type="date" id="${toId}" value="${esc(txToDate)}"><button class="print-btn" id="${printBtnId}">🖨 Print Table</button></div><div id="${containerId}-totals"></div><div class="fuel-table-wrap"><table class="fuel-table" id="${tableId}"><thead><tr><th data-col="transaction_date">Date <span class="sort-indicator"></span></th><th data-col="transaction_type">Type <span class="sort-indicator"></span></th><th data-col="fuel_type">Fuel <span class="sort-indicator"></span></th><th data-col="quantity">Qty <span class="sort-indicator"></span></th><th data-col="transferred_from">From <span class="sort-indicator"></span></th><th data-col="asset">Asset / Target <span class="sort-indicator"></span></th><th data-col="person">Person <span class="sort-indicator"></span></th><th data-col="project">Project <span class="sort-indicator"></span></th><th data-col="location">Location <span class="sort-indicator"></span></th></tr></thead><tbody>${renderTxRows(txs, subtab)}</tbody></table></div>`;

    container._txSortCol = 'transaction_date';
    container._txSortDir = 'desc';

    document.getElementById(filterId).addEventListener('input', (e) => onTxFilter(containerId, e.target.value));
    document.getElementById(locFilterId).addEventListener('change', (e) => onTxLocationFilter(containerId, e.target.value));
    document.getElementById(fromId).addEventListener('change', (e) => onTxDateFilter(containerId, 'from', e.target.value));
    document.getElementById(toId).addEventListener('change', (e) => onTxDateFilter(containerId, 'to', e.target.value));
    document.getElementById(printBtnId).addEventListener('click', () => printTable(tableId, 'Fuel Transactions'));

    const thead = container.querySelector('thead');
    if (thead) {
      thead.querySelectorAll('th').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.getAttribute('data-col');
          if (col) onTxSort(containerId, col);
        });
      });
    }

    bindTxRowClicks(container);
  }

  function bindTxRowClicks(container) {
    container.querySelectorAll('.tx-row-clickable').forEach(row => {
      row.addEventListener('click', () => {
        const txId = row.getAttribute('data-tx-id');
        if (txId) showTxDetail(txId);
      });
    });
  }

  function onTxFilter(containerId, searchText) {
    txSearchText = searchText;
    reRenderTxTable(containerId);
  }

  function onTxLocationFilter(containerId, val) {
    txLocationFilter = val;
    reRenderTxTable(containerId);
  }

  function onTxDateFilter(containerId, which, val) {
    if (which === 'from') txFromDate = val;
    else txToDate = val;
    reRenderTxTable(containerId);
  }

  function sortTransactions(txs, col, dir) {
    return txs.slice().sort((a, b) => {
      let av, bv;
      if (col === 'transaction_type') { av = (a.transaction_type || '').toLowerCase(); bv = (b.transaction_type || '').toLowerCase(); }
      else if (col === 'fuel_type') { av = (a.fuel_type || '').toLowerCase(); bv = (b.fuel_type || '').toLowerCase(); }
      else if (col === 'quantity') { av = a.quantity || 0; bv = b.quantity || 0; }
      else if (col === 'transferred_from') { av = (getTransferredFrom(a) || '').toLowerCase(); bv = (getTransferredFrom(b) || '').toLowerCase(); }
      else if (col === 'asset') { av = (getTxAssetTarget(a) || '').toLowerCase(); bv = (getTxAssetTarget(b) || '').toLowerCase(); }
      else if (col === 'project') { av = (a.project_name || '').toLowerCase(); bv = (b.project_name || '').toLowerCase(); }
      else if (col === 'person') { av = (formatPersonName(a) || '').toLowerCase(); bv = (formatPersonName(b) || '').toLowerCase(); }
      else if (col === 'location') { av = (a.location || '').toLowerCase(); bv = (b.location || '').toLowerCase(); }
      else { av = a.transaction_date || ''; bv = b.transaction_date || ''; }

      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function onTxSort(containerId, col) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container._txSortCol === col) {
      container._txSortDir = container._txSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      container._txSortDir = 'asc';
    }
    reRenderTxTable(containerId);
  }

  function reRenderTxTable(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const subtab = container.getAttribute('data-subtab') || 'all';
    const txs = getTxForSubtab(subtab);
    const filtered = applyTxFilters(txs);
    const sorted = sortTransactions(filtered, container._txSortCol || 'transaction_date', container._txSortDir || 'desc');
    const tbody = container.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = renderTxRows(sorted, subtab);
      bindTxRowClicks(container);
    }
    const totalsDiv = document.getElementById(`${containerId}-totals`);
    if (totalsDiv) {
      const totals = computeTxTotals(filtered);
      totalsDiv.innerHTML = `<div class="tx-totals-bar"><div class="total-item"><span class="total-label">Records</span><span class="total-value">${totals.txCount}</span></div><div class="total-item"><span class="total-label">Total (${UOM.plural})</span><span class="total-value gal">${totals.totalGal.toFixed(2)}</span></div><div class="total-item"><span class="total-label">Purchased (${UOM.plural})</span><span class="total-value gal">${totals.totalPurchases.toFixed(2)}</span></div><div class="total-item"><span class="total-label">Transferred (${UOM.plural})</span><span class="total-value gal">${totals.totalIssues.toFixed(2)}</span></div></div>`;
    }
    const thead = container.querySelector('thead');
    if (thead) {
      thead.querySelectorAll('th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        const ind = th.querySelector('.sort-indicator');
        if (ind) ind.textContent = '';
      });
      const col = container._txSortCol || 'transaction_date';
      const dir = container._txSortDir || 'desc';
      const thMap = ['transaction_date', 'transaction_type', 'fuel_type', 'quantity', 'transferred_from', 'asset', 'person', 'project', 'location'];
      const idx = thMap.indexOf(col);
      if (idx >= 0) {
        const ths = thead.querySelectorAll('th');
        if (ths[idx]) {
          ths[idx].classList.add(dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
          const ind = ths[idx].querySelector('.sort-indicator');
          if (ind) ind.textContent = dir === 'asc' ? '▲' : '▼';
        }
      }
    }
  }

  function renderTxForSubtab(subtab) {
    const txs = getTxForSubtab(subtab);
    const containerId = subtab === 'all' ? 'allTxContainer' : subtab === 'purchase' ? 'purchaseTxContainer' : subtab === 'issue' ? 'issueTxContainer' : 'transferTxContainer';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.setAttribute('data-subtab', subtab);
    const headingText = subtab === 'all' ? 'All Fuel Transactions' : subtab === 'purchase' ? 'Fuel Purchases' : subtab === 'issue' ? 'Issues to Assets' : 'Tank Transfers & Fills';

    const innerId = `${containerId}-inner`;
    let innerDiv = document.getElementById(innerId);

    // Build the structural header shell ONLY once to avoid DOM churn
    if (!innerDiv) {
      container.innerHTML = `
        <div class="fuel-stat-card" style="text-align:left;margin-bottom:16px;padding:16px 20px;border:1px solid #16a34a;border-radius:10px;">
          <div style="font-size:18px;font-weight:700;color:var(--text,#0f172a);display:flex;align-items:center;justify-content:space-between;">
            <span>${esc(headingText)}</span>
            <span class="subtab-record-count" style="font-size:13px;font-weight:600;color:var(--text-muted,#64748b);"></span>
          </div>
        </div>
        <div id="${innerId}" data-subtab="${subtab}"></div>
      `;
      innerDiv = document.getElementById(innerId);
    }

    // Update count in place without replacing the header node
    const countEl = container.querySelector('.subtab-record-count');
    if (countEl) {
      countEl.textContent = `${txs.length} record${txs.length !== 1 ? 's' : ''}`;
    }

    // Render/update only the inner data table & controls
    renderTxTable(txs, innerId, subtab);
  }

  /* ===== FUEL ALERTS TAB ===== */

  async function loadFlags() {
    try {
      const resp = await fetch('/api/fuel-flags?status=open', { headers: getAuthHeaders() });
      const data = await resp.json();
      const flagList = data.flags || data.records || data.data;
      if (Array.isArray(flagList)) { allFlags = flagList; }
    } catch (e) {
      console.error('loadFlags error:', e.message);
      reportError('loadFlags', e);
    }
    updateAlertBanner();
  }

  function updateAlertBanner() {
    const openCount = allFlags.filter(f => f.status === 'open').length;
    const banner = document.getElementById('fuelAlertBanner');
    const countEl = document.getElementById('fuelAlertBannerCount');
    if (banner && countEl) {
      countEl.textContent = openCount;
      banner.style.display = openCount > 0 ? 'block' : 'none';
    }
  }

  function flagTypeLabel(type) {
    const labels = {
      manager_review: 'Manager Review',
      capacity_exceeded: 'Capacity Exceeded',
      consumption_anomaly: 'Consumption Anomaly',
      employee_tank_fill: 'Employee Tank Fill',
      tank_adjustment: 'Tank Adjustment',
      non_fuel_receipt: 'Non-Fuel Items on Receipt'
    };
    return labels[type] || (type || '').replace(/_/g, ' ');
  }

  function flagSeverityClass(sev) {
    if (sev === 'critical') return 'background:#fee2e2;border-color:#cc0000;color:#cc0000;';
    if (sev === 'warning') return 'background:#fef3c7;border-color:#fcd34d;color:#78350f;';
    return 'background:#eff6ff;border-color:#93c5fd;color:#1e3a5f;';
  }

  function renderAlerts() {
    const container = document.getElementById('alertsContainer');
    if (!container) return;
    const flagTypeFilter = (document.getElementById('alertsFlagTypeFilter') || {}).value || '';
    const statusFilter = (document.getElementById('alertsStatusFilter') || {}).value || 'open';

    if (!_flagsLoaded) {
      container.innerHTML = '<div class="empty-state">Loading alerts…</div>';
      fetch('/api/fuel-flags' + (statusFilter ? '?status=' + statusFilter : ''), { headers: getAuthHeaders() })
        .then(r => { if (!r.ok) throw new Error('Alerts service returned ' + r.status); return r.json(); })
        .then(data => {
          const list = data.flags || data.records || data.data;
          if (Array.isArray(list)) allFlags = list;
          _flagsLoaded = true;
          renderAlerts();
        })
        .catch(e => {
          container.innerHTML = `<div class="empty-state" style="color:#cc0000;">Error loading alerts: ${esc(e.message)}</div>`;
        });
      return;
    }

    let flags = allFlags;
    if (flagTypeFilter) flags = flags.filter(f => f.flag_type === flagTypeFilter);
    if (statusFilter) flags = flags.filter(f => f.status === statusFilter);

    const countEl = document.getElementById('alertsCount');
    if (countEl) countEl.textContent = `${flags.length} alert${flags.length !== 1 ? 's' : ''}`;

    let html = `
      <div class="fuel-stat-card" style="text-align:left;margin-bottom:16px;padding:16px 20px;border:1px solid #16a34a;border-radius:10px;">
        <div style="font-size:18px;font-weight:700;color:var(--text,#0f172a);display:flex;align-items:center;justify-content:space-between;">
          <span>Fuel Alerts</span>
          <span style="font-size:13px;font-weight:600;color:var(--text-muted,#64748b);">${flags.length} alert${flags.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    `;

    if (flags.length === 0) {
      container.innerHTML = html + '<div class="empty-state">✅ No fuel alerts. All clear.</div>';
      return;
    }

    const user = getUserSession();
    const canEdit = user && (user.role === 'admin' || user.role === 'manager');

    html += flags.map(f => {
      let details = {};
      try { 
        details = typeof f.details === 'string' ? JSON.parse(f.details) : (f.details || {}); 
      } catch (e) {}

      const sevStyle = flagSeverityClass(f.severity);
      const isManagerReview = f.flag_type === 'manager_review';

      const personDisplay = formatPersonName({ 
        person: f.person || f.person_name || f.created_by_name || details.person || details.submitted_by || details.user || details.submittedBy || details.payload?.person_name
      });

      const rawAsset = f.asset_name || f.asset_number || details.asset_name || details.custom_asset_name || details.asset || details.asset_number ||
                       details.payload?.custom_asset_name || details.payload?.asset_name || details.payload?.asset_number || details.payload?.asset ||
                       details.transaction_payload?.asset_name || details.transaction_payload?.custom_asset_name ||
                       (details.field === 'asset' ? details.value : null);

      const assetDisplay = rawAsset ? String(rawAsset).trim() : '—';

      const rawProject = f.project_name || details.project_name || details.custom_project_name || details.project ||
                         details.payload?.custom_project_name || details.payload?.project_name || details.payload?.project ||
                         details.transaction_payload?.project_name || (details.field === 'project' ? details.value : null);

      const projectDisplay = rawProject ? String(rawProject).trim() : '—';

      const rawLocation = f.location || details.location || details.custom_location_name ||
                          details.payload?.custom_location_name || details.payload?.location ||
                          details.transaction_payload?.location || (details.field === 'location' ? details.value : null);

      const locationDisplay = rawLocation ? String(rawLocation).trim() : '—';

      let cardHtml = '<div class="fuel-stat-card" style="text-align:left;margin-bottom:16px;padding:20px;border:1px solid #16a34a;border-radius:10px;background:var(--bg-card);">';
      cardHtml += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:8px;">';
      cardHtml += `<div><span style="font-size:12px;padding:2px 8px;border-radius:4px;font-weight:600;${sevStyle}">${esc(flagTypeLabel(f.flag_type))}</span>`;
      if (f.status === 'resolved') { cardHtml += ' <span style="font-size:12px;padding:2px 8px;border-radius:4px;background:#dcfce7;color:#15803d;font-weight:600;">RESOLVED</span>'; }
      cardHtml += '</div>';
      cardHtml += `<div style="font-size:12px;color:var(--text-muted);">${esc(new Date(f.created_at).toLocaleString())}</div>`;
      cardHtml += '</div>';
      cardHtml += `<div style="font-size:14px;margin-bottom:8px;">${esc(f.message || 'No message')}</div>`;

      cardHtml += '<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:4px 12px;background:var(--bg-step);padding:8px 12px;border-radius:6px;">';
      cardHtml += `<div><strong>Submitted By:</strong> ${esc(personDisplay)}</div>`;
      cardHtml += `<div><strong>Asset:</strong> ${esc(assetDisplay)}</div>`;
      cardHtml += `<div><strong>Project:</strong> ${esc(projectDisplay)}</div>`;
      cardHtml += `<div><strong>Location:</strong> ${esc(locationDisplay)}</div>`;
      if (f.tank_name) cardHtml += `<div><strong>Tank:</strong> ${esc(f.tank_name)}</div>`;
      cardHtml += '</div>';

      if (details.field) {
        cardHtml += `<div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;"><strong>Flagged Field:</strong> ${esc(details.field)}`;
        if (details.value) cardHtml += ` | <strong>Value:</strong> ${esc(details.value)}`;
        if (details.reason) cardHtml += ` | <strong>Reason:</strong> ${esc(details.reason)}`;
        if (details.line) cardHtml += ` | <strong>Line:</strong> ${details.line}`;
        cardHtml += '</div>';
      }

      if (f.status === 'open') {
        cardHtml += '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">';
        if (isManagerReview && canEdit) {
          if (details.field === 'project' || details.field === 'location') {
            cardHtml += `<button class="btn-resolve-add" data-id="${f.id}" data-field="${esc(details.field || '')}" data-value="${esc(details.value || '')}" style="padding:8px 16px;border:none;border-radius:6px;background:#16a34a;color:#fff;cursor:pointer;font-size:13px;font-weight:600;">Add & Resolve</button>`;
          } else if (details.field === 'asset') {
            cardHtml += `<button class="btn-resolve-add" data-id="${f.id}" data-field="${esc(details.field || '')}" data-value="${esc(details.value || '')}" style="padding:8px 16px;border:none;border-radius:6px;background:#16a34a;color:#fff;cursor:pointer;font-size:13px;font-weight:600;">Add Asset & Resolve</button>`;
          }
        }
        cardHtml += `<button class="btn-resolve-flag" data-id="${f.id}" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--bg-step);color:var(--text);cursor:pointer;font-size:13px;font-weight:600;">Resolve</button>`;
        if (!canEdit) {
          cardHtml += `<button class="btn-forward-flag" data-id="${f.id}" data-type="${esc(f.flag_type || '')}" style="padding:8px 16px;border:1px solid #93c5fd;border-radius:6px;background:#eff6ff;color:#1e3a5f;cursor:pointer;font-size:13px;font-weight:600;">Forward</button>`;
        }
        cardHtml += '</div>';
      }
      if (f.status === 'resolved') {
        cardHtml += `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">Resolved by ${esc(f.resolved_by || '—')} on ${esc(f.resolved_at ? new Date(f.resolved_at).toLocaleString() : '—')}`;
        if (f.resolution_notes) cardHtml += ` — ${esc(f.resolution_notes)}`;
        cardHtml += '</div>';
      }
      cardHtml += '</div>';
      return cardHtml;
    }).join('');

    container.innerHTML = html;

    container.querySelectorAll('.btn-resolve-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        resolveWithAdd(e.target.getAttribute('data-id'), e.target.getAttribute('data-field'), e.target.getAttribute('data-value'));
      });
    });
    container.querySelectorAll('.btn-resolve-flag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        resolveFlag(e.target.getAttribute('data-id'));
      });
    });
    container.querySelectorAll('.btn-forward-flag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        forwardFlag(e.target.getAttribute('data-id'), e.target.getAttribute('data-type'));
      });
    });
  }

  async function resolveFlag(flagId) {
    const notes = prompt('Resolution notes (optional):');
    if (notes === null) return;
    try {
      const resp = await fetch(`/api/fuel-flags/${flagId}/resolve`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ resolution_notes: notes || 'Resolved from Fuel Management dashboard' })
      });
      const data = await resp.json();
      if (data.success) {
        const user = getUserSession();
        allFlags = allFlags.map(f => {
          if (f.id === flagId) {
            f.status = 'resolved';
            f.resolved_at = new Date().toISOString();
            f.resolved_by = user ? user.email : '';
            f.resolution_notes = notes;
          }
          return f;
        });
        renderAlerts();
        updateAlertBanner();
      } else {
        alert('Failed to resolve: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  async function resolveWithAdd(flagId, field, value) {
    const payload = { field: field, value: value };
    if (field === 'project') {
      const projName = prompt(`Add new project:\n\nProject name: ${value}\n\nClick OK to add this project to the system, resolve the alert, and notify the user who entered it.`, value);
      if (projName === null) return;
      payload.value = projName;
    } else if (field === 'asset') {
      const assetName = prompt(`Add new asset/equipment:\n\nAsset name: ${value}\n\nClick OK to add this asset to the system, resolve the alert, and notify the user who entered it.`, value);
      if (assetName === null) return;
      payload.value = assetName;
      const assetNum = prompt('Asset number (optional — auto-generated if left blank):');
      if (assetNum !== null && assetNum.trim()) payload.asset_number = assetNum.trim();
    } else if (field === 'location') {
      if (!confirm(`Mark location "${value}" as added and resolve this alert?`)) return;
    }

    try {
      const resp = await fetch(`/api/fuel-flags/${flagId}/add-and-resolve`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.success) {
        const user = getUserSession();
        allFlags = allFlags.map(f => {
          if (f.id === flagId) {
            f.status = 'resolved';
            f.resolved_at = new Date().toISOString();
            f.resolved_by = user ? user.email : '';
            f.resolution_notes = 'Added ' + field + ' "' + (data.created && data.created.entity_name || value) + '"';
          }
          return f;
        });
        renderAlerts();
        updateAlertBanner();
        alert(`✅ ${field.charAt(0).toUpperCase() + field.slice(1)} "${data.created && data.created.entity_name || value}" added` + (data.notified ? ' and the user who entered it has been notified.' : ' (no submitter email on record).'));
      } else {
        alert('Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  async function forwardFlag(flagId, flagType) {
    const email = prompt('Forward this alert to:\n\nEnter the email of the employee who has permission to add projects, locations, or assets:');
    if (!email || !email.trim()) return;
    const note = prompt('Add a note for the recipient (optional):');
    try {
      const resp = await fetch('/api/notifications/forward', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ flag_id: flagId, recipient_email: email.trim(), note: note || '' })
      });
      const data = await resp.json();
      if (data.success) {
        alert(`✅ Alert forwarded to ${email}. They will see it in their notifications when they log in.`);
      } else {
        alert('Failed to forward: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  /* ===== NOTIFICATIONS ===== */

  async function loadNotifications() {
    try {
      const resp = await fetch('/api/notifications?unread=1', { headers: getAuthHeaders() });
      const data = await resp.json();
      if (data.success && data.notifications) { allNotifications = data.notifications; }
    } catch (e) {
      console.error('loadNotifications error:', e.message);
    }
    renderNotificationBell();
  }

  function renderNotificationBell() {
    const bell = document.getElementById('fuelNotifBell');
    if (!bell) return;
    const unread = allNotifications.filter(n => !n.read_at).length;
    bell.style.display = unread > 0 ? 'inline-flex' : 'none';
    const count = bell.querySelector('.fuel-notif-count');
    if (count) count.textContent = unread;
  }

  function toggleNotifications() {
    const panel = document.getElementById('fuelNotifPanel');
    if (!panel) return;
    if (panel.style.display === 'block') {
      panel.style.display = 'none';
      return;
    }
    fetch('/api/notifications', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.notifications) {
          panel.innerHTML = data.notifications.map(n => {
            return `<div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;"><div style="font-weight:600;color:var(--text);">${esc(n.title || '')}</div><div style="color:var(--text-muted);margin-top:2px;">${esc(n.message || '')}</div><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${esc(new Date(n.created_at).toLocaleString())}</div>${n.read_at ? '' : ` <button class="btn-mark-read" data-id="${n.id}" style="margin-top:6px;padding:4px 10px;border:1px solid var(--border);border-radius:4px;background:var(--bg-step);color:var(--text);cursor:pointer;font-size:12px;">Mark read</button>`}</div>`;
          }).join('') || '<div style="padding:16px;color:var(--text-muted);font-size:13px;">No notifications.</div>';

          panel.querySelectorAll('.btn-mark-read').forEach(btn => {
            btn.addEventListener('click', (e) => markNotifRead(e.target.getAttribute('data-id')));
          });

          panel.style.display = 'block';
        }
      })
      .catch(() => {
        panel.style.display = 'block';
        panel.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;">Error loading notifications.</div>';
      });
  }

  async function markNotifRead(id) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT', headers: getAuthHeaders() });
      allNotifications = allNotifications.filter(n => n.id !== id);
      renderNotificationBell();
      const panel = document.getElementById('fuelNotifPanel');
      if (panel) panel.style.display = 'none';
    } catch (e) {}
  }

  /* ===== PRINT & MODALS ===== */

  function printTable(tableId, title) {
    const table = document.getElementById(tableId);
    if (!table) {
      alert('Table not found.');
      return;
    }
    const w = window.open('', '_blank', 'width=900,height=700');
    const css = '<style>body{font-family:Arial,Helvetica,sans-serif;margin:20px;color:#1e293b;}h2{margin:0 0 4px;font-size:18px;}.print-meta{font-size:12px;color:#64748b;margin-bottom:16px;}table{width:100%;border-collapse:collapse;font-size:12px;}th{background:#f1f5f9;padding:8px 10px;text-align:left;font-weight:600;border-bottom:2px solid #cbd5e1;white-space:nowrap;}td{padding:6px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap;}tr:nth-child(even){background:#f8fafc;}@media print{body{margin:0;}.no-print{display:none;}}</style>';
    const meta = '<div class="print-meta">Generated: ' + new Date().toLocaleString() + ' | DRIV-EN</div>';
    w.document.write('<html><head><title>' + esc(title) + '</title>' + css + '</head><body><h2>' + esc(title) + '</h2>' + meta + table.outerHTML + '</body></html>');
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
  }

  function showTxDetail(txId) {
    const tx = allTransactions.find(t => t.id === txId);
    if (!tx) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--fuel-card-bg,#ffffff);border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:85vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.5);border:2px solid #64748b;box-sizing:border-box;';

    const rows = [
      ['Date', tx.transaction_date ? new Date(tx.transaction_date).toLocaleString() : '—'],
      ['Type', txTypeLabel(tx.transaction_type)],
      ['Fuel Type', tx.fuel_type || '—'],
      ['Quantity', safeNum(tx.quantity).toFixed(2)],
      ['Asset', getTxAssetTarget(tx)],
      ['Person', formatPersonName(tx)],
      ['Project', tx.project_name || '—'],
      ['Location', tx.location || '—'],
      ['From', getTransferredFrom(tx)],
      ['To', tx.to_entity_type ? (tx.to_entity_type.replace(/_/g, ' ') + ' — ' + (tx.to_entity_name || tx.to_entity_id || '')) : '—'],
      ["Cost/" + UOM.singular, tx.cost_per_gallon != null ? "$" + parseFloat(tx.cost_per_gallon).toFixed(3) : "—"],
      ["Receipt Total", tx.receipt_total != null ? "$" + parseFloat(tx.receipt_total).toFixed(2) : "—"],
      ["PO Number", tx.po_number || "—"],
      ["Notes", tx.notes || "—"],
      ["Created", tx.created_at ? new Date(tx.created_at).toLocaleString() : "—"],
    ];

    let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border,#cbd5e1);padding-bottom:12px;"><h3 style="margin:0;font-size:18px;font-weight:700;color:var(--text,#0f172a);">Transaction Details</h3><button class="modal-close-btn" style="background:none;border:none;font-size:24px;font-weight:700;cursor:pointer;color:var(--text-muted,#64748b);">×</button></div>';
    html += '<div style="display:grid;grid-template-columns:140px 1fr;gap:8px 12px;font-size:14px;">';
    rows.forEach(r => {
      html += `<div style="font-weight:600;color:var(--text-muted);">${r[0]}</div><div style="color:var(--text);">${esc(r[1])}</div>`;
    });
    html += '</div>';
    if (tx.receipt_r2_key) {
      html += `<div style="margin-top:16px;"><a href="/api/fuel-receipts/${tx.id}" target="_blank" style="color:var(--primary);font-size:13px;font-weight:600;">View Receipt →</a></div>`;
    }
    html += `<div style="margin-top:20px;display:flex;gap:8px;justify-content:flex-end;"><button class="btn-print-detail print-btn" style="padding:8px 16px;font-size:13px;font-weight:600;">Print</button><button class="modal-close-btn print-btn" style="padding:8px 16px;font-size:13px;">Close</button></div>`;

    modal.innerHTML = html;
    overlay.appendChild(modal);

    modal.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => overlay.remove());
    });
    const printBtn = modal.querySelector('.btn-print-detail');
    if (printBtn) {
      printBtn.addEventListener('click', () => printTable(`${tx.id}-detail-table`, 'Transaction Detail'));
    }

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function showAdjustModal(tankId, tankName, currentQty, capacity) {
    const overlay = document.createElement('div');
    overlay.id = 'adjustModalOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:var(--fuel-card-bg,#ffffff);opacity:1;border:2px solid #64748b;border-radius:12px;padding:24px;max-width:480px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.3);box-sizing:border-box;"><h3 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--text,#0f172a);">Adjust Tank: ${esc(tankName)}</h3><p style="margin:0 0 16px;font-size:13px;color:var(--text-muted,#64748b);">Current: ${currentQty} ${UOM.abbr} / Capacity: ${capacity} ${UOM.abbr}</p><div style="margin-bottom:12px;"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Adjustment Amount (${UOM.abbr}) <span style="color:#cc0000;">*</span></label><input type="number" id="adjustAmount" step="0.01" placeholder="Positive for overage, negative for shortage" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;font-size:14px;box-sizing:border-box;"></div><div style="margin-bottom:12px;"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Reason <span style="color:#cc0000;">*</span></label><select id="adjustReason" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;font-size:14px;box-sizing:border-box;"><option value="">Select reason…</option><option value="Shortage — fuel theft suspected">Shortage — fuel theft suspected</option><option value="Shortage — evaporation/spillage">Shortage — evaporation/spillage</option><option value="Shortage — meter calibration error">Shortage — meter calibration error</option><option value="Overage — delivery overfill">Overage — delivery overfill</option><option value="Overage — meter calibration error">Overage — meter calibration error</option><option value="Overage — fuel returned to tank">Overage — fuel returned to tank</option><option value="Physical inventory count adjustment">Physical inventory count adjustment</option><option value="__custom">+ Other (type manually)</option></select></div><div id="adjustCustomReason" style="display:none;margin-bottom:12px;"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Custom Reason <span style="color:#cc0000;">*</span></label><input type="text" id="adjustCustomReasonText" placeholder="Type reason" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;font-size:14px;box-sizing:border-box;"></div><div style="margin-bottom:16px;"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Notes (optional)</label><textarea id="adjustNotes" rows="2" placeholder="Additional details" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;font-size:14px;box-sizing:border-box;resize:vertical;"></textarea></div><div style="display:flex;gap:12px;justify-content:flex-end;"><button id="adjustCancelBtn" style="padding:10px 20px;border:1px solid var(--border);border-radius:6px;background:var(--bg-step);color:var(--text);cursor:pointer;font-size:14px;">Cancel</button><button id="adjustSubmitBtn" style="padding:10px 24px;border:none;border-radius:6px;background:var(--primary);color:#fff;cursor:pointer;font-size:14px;font-weight:600;">Submit Adjustment</button></div></div>`;

    document.body.appendChild(overlay);

    const reasonSelect = document.getElementById('adjustReason');
    if (reasonSelect) {
      reasonSelect.addEventListener('change', function () {
        const customDiv = document.getElementById('adjustCustomReason');
        if (customDiv) customDiv.style.display = this.value === '__custom' ? 'block' : 'none';
      });
    }

    document.getElementById('adjustCancelBtn').addEventListener('click', closeAdjustModal);
    document.getElementById('adjustSubmitBtn').addEventListener('click', (e) => submitAdjust(e, tankId, currentQty, capacity));
  }

  function closeAdjustModal() {
    const overlay = document.getElementById('adjustModalOverlay');
    if (overlay) overlay.remove();
  }

  async function submitAdjust(event, tankId, currentQty, capacity) {
    const amount = parseFloat(document.getElementById('adjustAmount').value);
    const reasonSelect = document.getElementById('adjustReason');
    let reason = reasonSelect.value;
    if (reason === '__custom') {
      reason = document.getElementById('adjustCustomReasonText').value.trim();
    }
    const notes = document.getElementById('adjustNotes').value.trim();
    if (isNaN(amount) || amount === 0) { alert('Adjustment amount must be a non-zero number.'); return; }
    if (!reason || !reason.trim()) { alert('Reason is required.'); return; }
    const newQty = currentQty + amount;
    if (newQty < 0) { alert('Adjustment would result in negative quantity (' + newQty + ' ' + UOM.abbr + '). Current: ' + currentQty + ', adjustment: ' + amount); return; }
    if (capacity > 0 && newQty > capacity) { alert('Adjustment would exceed tank capacity (' + capacity + ' ' + UOM.abbr + '). New quantity would be: ' + newQty); return; }

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    const user = getUserSession();
    try {
      const resp = await fetch(`/api/fuel-tanks/${tankId}/adjust`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ adjustment_amount: amount, reason: reason, person: (user && user.email) || null, notes: notes })
      });
      const data = await resp.json();
      if (data.success) {
        closeAdjustModal();
        alert('Tank adjusted successfully. New quantity: ' + data.adjustment.new_quantity + ' ' + UOM.abbr + '.');
        loadTanks();
      } else {
        alert('Error: ' + (data.error || 'Unknown error'));
        btn.disabled = false;
        btn.textContent = 'Submit Adjustment';
      }
    } catch (e) {
      alert('Error: ' + e.message);
      btn.disabled = false;
      btn.textContent = 'Submit Adjustment';
    }
  }

  /* ===== DYNAMIC MODALS (PURPOSE & INSTRUCTIONS) ===== */

  const fuelModalContentMap = {
    tanks: {
      title: "Fuel Tanks",
      purpose: "<p>The <strong>Fuel Management Dashboard</strong> provides real-time visibility into bulk fuel storage inventory, tank capacities, fuel grades, and current dip levels across all operational sites.</p>",
      instructions: `
        <h4 style="margin:0 0 8px 0; color:var(--text);">Tank Subtab Drill-Downs:</h4>
        <p>Switch to any individual tank subtab (<strong>Bulk Storage Tanks, Mobile / Drag-up Tanks, Portable Cans, or Equipment</strong>) and click the magnifying glass (🔍) on any row to open the complete transaction history for that item.</p>
        <hr style="margin:16px 0; border:0; border-top:1px solid var(--border,#cbd5e1);">
        <h4 style="margin:0 0 8px 0; color:var(--text);">Using Tank Filters:</h4>
        <ol>
          <li><strong>Location Filter:</strong> Select a specific yard or jobsite from the dropdown to isolate local inventory.</li>
          <li><strong>Date Range Filter:</strong> Set <em>From</em> and <em>To</em> dates to evaluate fuel dispenses and purchases logged over a specific period.</li>
          <li><strong>Clear Filter:</strong> Click <em>Clear</em> to reset all parameters.</li>
        </ol>
        <hr style="margin:16px 0; border:0; border-top:1px solid var(--border,#cbd5e1);">
        <h4 style="margin:0 0 8px 0; color:var(--text);">Tank Adjustment Action Instructions:</h4>
        <ol>
          <li><strong>Locate Tank:</strong> Select the bulk fuel storage unit requiring reconciliation from the <em>Tank Overview</em> table.</li>
          <li><strong>Initiate Adjustment:</strong> Click the blue <strong>Adjust</strong> button next to the relevant tank row.</li>
          <li><strong>Record Reading:</strong> Input the exact adjustment amount (positive for overage, negative for shortage).</li>
          <li><strong>Select Reason & Notes:</strong> Provide a reason and required notes explaining the manual override.</li>
          <li><strong>Submit Adjustment:</strong> Click <strong>Submit Adjustment</strong> to record audit log entries and update balances.</li>
        </ol>
      `
    },
    transactions: {
      title: "Transactions",
      purpose: "<p>The <strong>Transactions Tab</strong> logs every fuel event, including vendor purchases, bulk tank fills, asset dispenses, and project transfers.</p>",
      instructions: `
        <h4 style="margin:0 0 8px 0; color:var(--text);">Transaction Inspection & Drill-Downs:</h4>
        <p>You can click the magnifying glass (🔍) or any row across all transaction subtabs (<strong>All Transactions, Purchases, Issues to Assets, Tank Transfers & Fills</strong>) to inspect detailed receipt records, PO numbers, and cost breakdowns.</p>
        <hr style="margin:16px 0; border:0; border-top:1px solid var(--border,#cbd5e1);">
        <h4 style="margin:0 0 8px 0; color:var(--text);">Filtering & Auditing:</h4>
        <ol>
          <li><strong>Search Bar:</strong> Filter records by asset, driver, project, or fuel type in real time.</li>
          <li><strong>Location & Date Filters:</strong> Isolate fuel logs by specific work location or timeframe.</li>
          <li><strong>Column Sorting:</strong> Click any table column header to sort ascending or descending.</li>
        </ol>
      `
    },
    alerts: {
      title: "Fuel Alerts",
      purpose: "<p>The <strong>Fuel Alerts Tab</strong> captures operational flags, unlisted field entries (missing assets, projects, or locations), capacity overages, and consumption anomalies requiring manager review.</p>",
      instructions: `
        <h4 style="margin:0 0 8px 0; color:var(--text);">Managing & Resolving Alerts:</h4>
        <ol>
          <li><strong>Filter Alerts:</strong> Filter open flags by <em>Type</em> or <em>Status</em>.</li>
          <li><strong>Add & Resolve (Managers/Admins):</strong> Click <strong>Add & Resolve</strong> on missing entity flags. This creates the missing item in the system, resolves the alert, and notifies the submitter.</li>
          <li><strong>Manual Resolve:</strong> Click <strong>Resolve</strong> and provide notes once an anomaly has been verified.</li>
          <li><strong>Forward Flag:</strong> Click <strong>Forward</strong> to route the alert to an authorized manager's notifications.</li>
        </ol>
      `
    }
  };

  function getActiveTabKey() {
    const activeTab = document.querySelector('.fuel-tab.active');
    if (activeTab) {
      const key = activeTab.getAttribute('data-tab');
      if (fuelModalContentMap[key]) return key;
    }
    return 'tanks';
  }

  function showHelpModal(modalType) {
    const tabKey = getActiveTabKey();
    const tabData = fuelModalContentMap[tabKey] || fuelModalContentMap.tanks;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--fuel-card-bg,#ffffff);border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:85vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.5);border:2px solid #64748b;box-sizing:border-box;';

    const titleText = modalType === 'purpose' ? `Purpose: ${tabData.title}` : `Instructions: ${tabData.title}`;
    const bodyContent = modalType === 'purpose' ? tabData.purpose : tabData.instructions;

    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border,#cbd5e1);padding-bottom:12px;">`;
    html += `<h3 style="margin:0;font-size:18px;font-weight:700;color:var(--text,#0f172a);">${esc(titleText)}</h3>`;
    html += `<button class="modal-close-btn" style="background:none;border:none;font-size:24px;font-weight:700;cursor:pointer;color:var(--text-muted,#64748b);">×</button></div>`;

    html += `<div style="font-size:14px;color:var(--text,#0f172a);line-height:1.6;">${bodyContent}</div>`;
    html += `<div style="margin-top:20px;display:flex;justify-content:flex-end;"><button class="modal-close-btn print-btn" style="padding:8px 16px;font-size:13px;">Close</button></div>`;

    modal.innerHTML = html;
    overlay.appendChild(modal);

    const closeModal = () => {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    };

    function escHandler(e) {
      if (e.key === 'Escape') closeModal();
    }

    document.addEventListener('keydown', escHandler);

    modal.querySelectorAll('.modal-close-btn').forEach(btn => btn.addEventListener('click', closeModal));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    document.body.appendChild(overlay);
  }

  function setupHelpModals() {
    document.addEventListener('click', (e) => {
      const purposeBtn = e.target.closest('#purposeBtn');
      if (purposeBtn) {
        showHelpModal('purpose');
        return;
      }
      const instructionsBtn = e.target.closest('#instructionsBtn');
      if (instructionsBtn) {
        showHelpModal('instructions');
      }
    });
  }

  /* ===== INITIALIZATION ===== */

  function bindStaticEvents() {
    document.querySelectorAll('.fuel-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    const homeLink = document.getElementById('dashHomeLink');
    if (homeLink) homeLink.addEventListener('click', goToMainDashboard);

    const logoutBtn = document.querySelector('.fuel-tab-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', dashLogout);

    const alertBanner = document.getElementById('fuelAlertBanner');
    if (alertBanner) alertBanner.addEventListener('click', () => switchTab('alerts'));

    const notifBell = document.getElementById('fuelNotifBell');
    if (notifBell) notifBell.addEventListener('click', toggleNotifications);

    const locFilter = document.getElementById('overviewLocationFilter');
    if (locFilter) locFilter.addEventListener('change', renderOverview);

    const fromDateFilter = document.getElementById('overviewFromDate');
    if (fromDateFilter) fromDateFilter.addEventListener('change', renderOverview);

    const toDateFilter = document.getElementById('overviewToDate');
    if (toDateFilter) toDateFilter.addEventListener('change', renderOverview);

    const clearFiltersBtn = document.getElementById('btnClearOverviewFilters');
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearOverviewFilters);

    const printOverviewBtn = document.getElementById('btnPrintOverview');
    if (printOverviewBtn) printOverviewBtn.addEventListener('click', printOverview);

    // Event Delegation for Tanks Subtabs
    const tanksSubtabBar = document.getElementById('tanksSubtabBar');
    if (tanksSubtabBar) {
      tanksSubtabBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.fuel-subtab');
        if (btn) {
          const subtabKey = btn.getAttribute('data-subtab');
          if (subtabKey) switchTankSubtab(subtabKey);
        }
      });
    }

    // Event Delegation for Transactions Subtabs
    const txSubtabBar = document.getElementById('txSubtabBar');
    if (txSubtabBar) {
      txSubtabBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.fuel-subtab');
        if (btn) {
          const subtabKey = btn.getAttribute('data-subtab');
          if (subtabKey) switchTxSubtab(subtabKey);
        }
      });
    }

    const flagTypeFilter = document.getElementById('alertsFlagTypeFilter');
    if (flagTypeFilter) flagTypeFilter.addEventListener('change', renderAlerts);

    const statusFilter = document.getElementById('alertsStatusFilter');
    if (statusFilter) statusFilter.addEventListener('change', renderAlerts);
  }

  async function init() {
    async function startApp() {
      if (_initDone) return;

      const user = getUserSession();
      if (!user) {
        window.location.href = '/public/login.html';
        return;
      }

      _initDone = true;
      window.dashUser = user;

      const savedTheme = localStorage.getItem('driven-theme') ||
                         localStorage.getItem('driven_theme') ||
                         sessionStorage.getItem('driven-theme') ||
                         sessionStorage.getItem('driven_theme') ||
                         (user && (user.theme || user.driven_theme)) ||
                         'light';

      document.documentElement.setAttribute('data-theme', savedTheme);

      try {
        bindStaticEvents();
        setupHelpModals();
        insertHeaderTitle();
        [300, 1000, 2500].forEach(ms => setTimeout(insertHeaderTitle, ms));
        makeTabsSticky();
        setTimeout(makeTabsSticky, 300);

        await loadUnitOfMeasure();
        applyUomToStaticText();
        await loadTankTypes();
        await loadTanks();

        const urlParams = new URLSearchParams(window.location.search);
        const initialTab = urlParams.get('tab') || 'tanks';
        switchTab(initialTab);

      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
        const dashEl = document.getElementById('dashboard');
        if (dashEl) dashEl.style.display = 'block';
      }
    }

    document.addEventListener('dashSessionLoaded', startApp);
    if (document.readyState !== 'loading' || window.dashUser) {
      startApp();
    }
  }

  // Self Start Initialization
  init();

})();
