/* =========================================================================
   DRIV-EN Platform — Owner Dashboard JavaScript Module
   File: /app/dashboard/owner-dashboard.js
   ========================================================================= */

(function () {
  'use strict';

  // State Management
  let allPartners = [];
  let currentApprovePartnerId = null;
  let currentRejectPartnerId = null;
  let sortColumn = 'created_at';
  let sortDirection = 'desc';

  let visitorSortColumn = 'created_at';
  let visitorSortDirection = 'desc';
  let allVisitors = [];

  let sessionSortColumn = 'firstVisit';
  let sessionSortDirection = 'desc';
  let allSessions = [];

  let allIssues = [];
  let issueExpandedId = null;

  let allCustomers = [];
  let customerPageSize = 10;
  let customerCurrentPage = 1;

  // Cache flags to avoid redundant network calls on tab switch
  const tabLoaded = {
    referrers: false,
    customers: false,
    system: false,
    issues: false,
    visitors: false,
    settings: false
  };

  const ADMIN_API_BASE = '/api/admin';

  function adminApi(path) {
    return ADMIN_API_BASE + path;
  }

  function getAuthHeaders(additionalHeaders = {}) {
    const userObj = JSON.parse(localStorage.getItem("driven_user") || "{}");
    const orgId = userObj.org_id || localStorage.getItem("driven_org_id") || "org_dsi";
    const userId = userObj.id || localStorage.getItem("driven_user_id") || "";

    const headers = { ...additionalHeaders };
    if (orgId) headers["x-org-id"] = orgId;
    if (userId) headers["x-user-id"] = String(userId);
    return headers;
  }

  /* ===== THEME MANAGEMENT ===== */

  function dashToggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const newTheme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("driven-theme", newTheme);
    updateThemeSwitch();
  }

  function updateThemeSwitch() {
    const current = document.documentElement.getAttribute("data-theme");
    const checkbox = document.getElementById("dashThemeCheckbox");
    const labelLight = document.getElementById("dashThemeLabelLight");
    const labelDark = document.getElementById("dashThemeLabelDark");
    if (checkbox) checkbox.checked = (current === "dark");
    if (labelLight) labelLight.classList.toggle("active", current === "light");
    if (labelDark) labelDark.classList.toggle("active", current === "dark");
  }

  /* ===== LOGO MANAGEMENT ===== */

  function loadOwnerLogo() {
    const container = document.getElementById('ownerLogoContainer');
    const preview = document.getElementById('settingsLogoPreview');
    const removeBtn = document.getElementById('logoRemoveBtn');

    if (!container || !preview) return;

    container.innerHTML = '<div class="dash-customer-logo-placeholder">DSI Logo</div>';
    preview.innerHTML = '<div class="settings-logo-placeholder">No logo uploaded</div>';
    if (removeBtn) removeBtn.style.display = 'none';

    fetch(adminApi('/app-settings?key=owner_logo'), { headers: getAuthHeaders() })
      .then(res => (res && res.ok ? res.json() : null))
      .then(data => {
        if (data && data.success && data.value) {
          container.innerHTML = `<img src="${data.value}" class="dash-customer-logo" alt="DSI Logo">`;
          preview.innerHTML = `<img src="${data.value}" style="max-height:56px;max-width:180px;border:1px solid var(--border);border-radius:6px;padding:4px;background:var(--bg-card);" alt="Logo">`;
          if (removeBtn) removeBtn.style.display = 'inline-block';
        }
      })
      .catch(() => {});
  }

  function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      showError('Logo file is too large. Maximum size is 500KB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const logoData = e.target.result;
      fetch(adminApi('/app-settings'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ key: 'owner_logo', value: logoData })
      })
      .then(res => (res && res.ok ? res.json() : null))
      .then(data => {
        if (data && data.success) {
          loadOwnerLogo();
          showError('');
        } else if (data) {
          showError('Failed to save logo: ' + (data.error || 'Unknown error'));
        }
      })
      .catch(() => showError('Network error while saving logo.'));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function removeLogo() {
    fetch(adminApi('/app-settings'), {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ key: 'owner_logo', value: '' })
    })
    .finally(() => loadOwnerLogo());
  }

  /* ===== TAB NAVIGATION ===== */

  function switchTab(tabName) {
    closeCustomerDetail();
    document.querySelectorAll('.owner-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.owner-tab-content').forEach(c => c.classList.remove('active'));

    const tabBtn = document.querySelector(`.owner-tab[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');

    if (tabName === 'visitors' && !tabLoaded.visitors) {
      loadVisitors('30');
    } else if (tabName === 'customers' && !tabLoaded.customers) {
      loadCustomers();
    } else if (tabName === 'system' && !tabLoaded.system) {
      loadSystemStatus();
      loadAIUsage();
    } else if (tabName === 'issues' && !tabLoaded.issues) {
      loadIssues();
    } else if (tabName === 'settings' && !tabLoaded.settings) {
      loadTeamMembers();
      tabLoaded.settings = true;
    }
  }

  /* ===== VISITORS TAB ===== */

  async function loadVisitors(presetDays, presetName) {
    try {
      const startEl = document.getElementById('visitorDateStart');
      const endEl = document.getElementById('visitorDateEnd');
      let startDate, endDate;

      if (presetName === 'today') {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        endDate = now.toISOString();
        if (startEl) startEl.value = startDate.split('T')[0];
        if (endEl) endEl.value = endDate.split('T')[0];
      } else if (presetName === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate()).toISOString();
        endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59).toISOString();
        if (startEl) startEl.value = startDate.split('T')[0];
        if (endEl) endEl.value = startDate.split('T')[0];
      } else if (presetName === 'week') {
        const w = new Date();
        const day = w.getDay();
        const diff = w.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(w);
        weekStart.setDate(diff);
        startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).toISOString();
        endDate = w.toISOString();
        if (startEl) startEl.value = startDate.split('T')[0];
        if (endEl) endEl.value = endDate.split('T')[0];
      } else if (presetName === 'month') {
        const m = new Date();
        startDate = new Date(m.getFullYear(), m.getMonth(), 1).toISOString();
        endDate = m.toISOString();
        if (startEl) startEl.value = startDate.split('T')[0];
        if (endEl) endEl.value = endDate.split('T')[0];
      } else if (presetDays) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - parseInt(presetDays));
        startDate = start.toISOString();
        endDate = end.toISOString();
        if (startEl) startEl.value = startDate.split('T')[0];
        if (endEl) endEl.value = endDate.split('T')[0];
      } else {
        const startVal = startEl ? startEl.value : '';
        const endVal = endEl ? endEl.value : '';
        if (startVal && endVal) {
          startDate = new Date(startVal + 'T00:00:00Z').toISOString();
          endDate = new Date(endVal + 'T23:59:59Z').toISOString();
        } else {
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - 30);
          startDate = start.toISOString();
          endDate = end.toISOString();
          if (startEl) startEl.value = startDate.split('T')[0];
          if (endEl) endEl.value = endDate.split('T')[0];
        }
      }

      const tbody = document.getElementById('visitorsTableBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px;">Loading visitors...</td></tr>';

      const headers = getAuthHeaders();
      const [summaryResp, listResp, sessResp] = await Promise.allSettled([
        fetch(adminApi(`/site-visitors?summary=true&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`), { headers }),
        fetch(adminApi(`/site-visitors?limit=1000&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`), { headers }),
        fetch(adminApi(`/site-visitors?sessions=true&limit=1000&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`), { headers })
      ]);

      if (summaryResp.status === 'fulfilled' && summaryResp.value.ok) {
        const summaryData = await summaryResp.value.json();
        if (summaryData.success && summaryData.summary) {
          const s = summaryData.summary;
          document.getElementById('visitorTotalVisits').textContent = s.totalVisits || 0;
          document.getElementById('visitorUniqueVisitors').textContent = s.uniqueVisitors || 0;
          document.getElementById('visitorUniqueSessions').textContent = s.uniqueSessions || 0;
          document.getElementById('visitorUniqueCountries').textContent = s.uniqueCountries || 0;
          document.getElementById('visitorReferralVisits').textContent = s.referralVisits || 0;
          document.getElementById('visitorTopDevice').textContent = (s.deviceBreakdown && s.deviceBreakdown[0]) ? s.deviceBreakdown[0].device_type : '—';
          document.getElementById('visitorTopBrowser').textContent = (s.browserBreakdown && s.browserBreakdown[0]) ? s.browserBreakdown[0].browser : '—';
          document.getElementById('visitorTopOS').textContent = (s.osBreakdown && s.osBreakdown[0]) ? s.osBreakdown[0].os : '—';
        }
      }

      if (listResp.status === 'fulfilled' && listResp.value.ok) {
        const listData = await listResp.value.json();
        allVisitors = (listData.success && listData.visitors) ? listData.visitors : [];
        renderVisitorTable();
      }

      if (sessResp.status === 'fulfilled' && sessResp.value.ok) {
        const sessData = await sessResp.value.json();
        allSessions = (sessData.success && sessData.sessions) ? sessData.sessions : [];
        renderSessionsTable();
      }

      tabLoaded.visitors = true;
    } catch (e) {
      console.error('loadVisitors error:', e);
    }
  }

  function renderVisitorTable() {
    const tbody = document.getElementById('visitorsTableBody');
    if (!tbody) return;
    if (!allVisitors || allVisitors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px;">No visitor data for this range.</td></tr>';
      return;
    }

    const sorted = allVisitors.slice().sort((a, b) => {
      let aVal = a[visitorSortColumn] || '';
      let bVal = b[visitorSortColumn] || '';
      const dir = visitorSortDirection === 'asc' ? 1 : -1;
      return aVal < bVal ? -1 * dir : aVal > bVal ? 1 * dir : 0;
    });

    tbody.innerHTML = sorted.map(v => `
      <tr>
        <td style="white-space:nowrap;">${new Date(v.created_at).toLocaleString()}</td>
        <td>${escapeHtml(v.page_path || '/')}</td>
        <td>${escapeHtml(v.country || '—')}</td>
        <td style="text-transform:capitalize;">${escapeHtml(v.device_type || '—')}</td>
        <td style="text-transform:capitalize;">${escapeHtml(v.browser || '—')}</td>
        <td style="text-transform:capitalize;">${escapeHtml(v.os || '—')}</td>
        <td>${escapeHtml(v.referral_code || '—')}</td>
        <td>${escapeHtml(v.external_referrer || '—')}</td>
        <td>${v.time_on_page ? v.time_on_page + 's' : '—'}</td>
      </tr>
    `).join('');
  }

  function renderSessionsTable() {
    const tbody = document.getElementById('sessionsTableBody');
    if (!tbody) return;
    if (!allSessions || allSessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px;">No session data.</td></tr>';
      return;
    }

    tbody.innerHTML = allSessions.map(s => `
      <tr>
        <td style="white-space:nowrap;">${new Date(s.firstVisit).toLocaleString()}</td>
        <td>${s.pages ? s.pages.length : 0}</td>
        <td style="max-width:300px;">${(s.pages || []).map(p => escapeHtml(p.pagePath || '/')).join(', ')}</td>
        <td>${s.totalTimeOnSite ? s.totalTimeOnSite + 's' : '—'}</td>
        <td>${escapeHtml(s.country || '—')}</td>
        <td style="text-transform:capitalize;">${escapeHtml(s.deviceType || '—')}</td>
        <td style="text-transform:capitalize;">${escapeHtml(s.browser || '—')}</td>
        <td style="text-transform:capitalize;">${escapeHtml(s.os || '—')}</td>
        <td>${escapeHtml(s.referralCode || '—')}</td>
      </tr>
    `).join('');
  }

  /* ===== ISSUES TAB (HIGH-VOLUME LOG UNLOCKING) ===== */

  async function loadIssues() {
    const listEl = document.getElementById('issueList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">Loading error logs...</div>';

    try {
      // Query higher limit to prevent truncating logs to 200 items
      const resp = await fetch(adminApi('/issues?limit=2000&all=true'), { headers: getAuthHeaders() });
      if (!resp.ok) throw new Error('Failed to fetch issues');

      const data = await resp.json();
      if (data && data.success && data.issues) {
        allIssues = data.issues;
        populateSourceFilter(allIssues);
        renderIssueStats(allIssues);
        renderIssues(allIssues);
        tabLoaded.issues = true;
      }
    } catch (e) {
      listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><h3>Unable to Load Error Logs</h3><p>Could not load issues data.</p></div>';
    }
  }

  function renderIssueStats(issues) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    document.getElementById('issueStatTotal').textContent = issues.length;
    document.getElementById('issueStatToday').textContent = issues.filter(i => i.created_at >= todayStart).length;
    document.getElementById('issueStatWeek').textContent = issues.filter(i => i.created_at >= weekStart).length;
    document.getElementById('issueStatResolved').textContent = issues.filter(i => i.resolved === 1).length;
  }

  function populateSourceFilter(issues) {
    const sel = document.getElementById('issueSourceFilter');
    if (!sel) return;
    const sources = Array.from(new Set(issues.map(i => i.source || 'unknown'))).sort();
    sel.innerHTML = '<option value="all">All Sources</option>' + sources.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  }

  function renderIssues(issues) {
    const listEl = document.getElementById('issueList');
    if (!listEl) return;
    if (issues.length === 0) {
      listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><h3>No Errors</h3><p>No logged errors found.</p></div>';
      return;
    }

    let html = `
      <table class="dash-table" style="width:100%;">
        <thead>
          <tr>
            <th>Status</th>
            <th>Error Message</th>
            <th>Source</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    html += issues.map(i => `
      <tr class="issue-row ${i.resolved === 1 ? 'partner-row-inactive' : ''}">
        <td>${i.resolved === 1 ? '<span class="dash-badge dash-badge-success">Resolved</span>' : '<span class="dash-badge dash-badge-danger">Open</span>'}</td>
        <td style="font-weight:600;">${escapeHtml(i.error_message || 'Unknown error')}</td>
        <td><span class="issue-card-source">${escapeHtml(i.source || 'unknown')}</span></td>
        <td style="white-space:nowrap;font-size:13px;color:var(--text-muted);">${new Date(i.created_at).toLocaleString()}</td>
        <td>
          <button class="owner-action-btn owner-btn-activate" data-resolve-id="${i.id}">${i.resolved === 1 ? 'Reopen' : 'Resolve'}</button>
        </td>
      </tr>
    `).join('');

    html += '</tbody></table>';
    listEl.innerHTML = html;

    listEl.querySelectorAll('[data-resolve-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-resolve-id');
        toggleIssueResolve(id);
      });
    });
  }

  async function toggleIssueResolve(id) {
    const issue = allIssues.find(i => i.id == id);
    if (!issue) return;
    const newStatus = issue.resolved === 1 ? false : true;

    try {
      const resp = await fetch(adminApi('/issues'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id, resolved: newStatus })
      });
      if (resp.ok) {
        issue.resolved = newStatus ? 1 : 0;
        renderIssueStats(allIssues);
        renderIssues(allIssues);
      }
    } catch (e) {
      showError('Failed to update issue status');
    }
  }

  /* ===== PARTNERS & CUSTOMERS ===== */

  async function loadPartners() {
    const tbody = document.getElementById('partnersTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:40px 0;">Loading…</td></tr>';

    try {
      const resp = await fetch(adminApi('/referral-partners'), { headers: getAuthHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data && data.success && data.partners) {
        allPartners = data.partners;
        renderStats(allPartners);
        renderTable(allPartners);
        tabLoaded.referrers = true;
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderStats(partners) {
    document.getElementById('statTotal').textContent = partners.length;
    document.getElementById('statPending').textContent = partners.filter(p => p.status === 'Pending').length;
    document.getElementById('statApproved').textContent = partners.filter(p => p.status === 'Approved').length;
    document.getElementById('statRejected').textContent = partners.filter(p => p.status === 'Rejected').length;
  }

  function renderTable(partners) {
    const tbody = document.getElementById('partnersTableBody');
    if (!tbody) return;
    if (partners.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:40px 0;">No referral partners found.</td></tr>';
      return;
    }

    tbody.innerHTML = partners.map(p => `
      <tr>
        <td>${escapeHtml(p.partner_name || '—')}</td>
        <td>${escapeHtml(p.partner_email || '—')}</td>
        <td>${escapeHtml(p.partner_phone || '—')}</td>
        <td><span class="dash-badge dash-badge-success">${escapeHtml(p.status || 'Pending')}</span></td>
        <td><code>${escapeHtml(p.referral_code || '—')}</code></td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>${p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
        <td>—</td>
      </tr>
    `).join('');
  }

  async function loadCustomers() {
    const listEl = document.getElementById('customerList');
    if (listEl) listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">Loading customers…</div>';

    try {
      const resp = await fetch(adminApi('/customers'), { headers: getAuthHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data && data.success && data.customers) {
        allCustomers = data.customers.filter(c => {
          const orgId = String(c.org_id || c.customer_id || c.id || '').trim().toLowerCase();
          return orgId !== 'org_dsi' && orgId !== 'dsi';
        });
        renderCustomerStats(allCustomers);
        renderCustomersTable();
        tabLoaded.customers = true;
      }
    } catch (e) {
      if (listEl) listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><p>Unable to load customers.</p></div>';
    }
  }

  function renderCustomerStats(customers) {
    document.getElementById('custStatTotal').textContent = customers.length;
    document.getElementById('custStatActive').textContent = customers.filter(c => c.subscription_status === 'active').length;
    document.getElementById('custStatTrial').textContent = customers.filter(c => c.subscription_status === 'trial').length;
    document.getElementById('custStatPending').textContent = customers.filter(c => !c.subscription_status || c.subscription_status === 'pending').length;
  }

  function renderCustomersTable() {
    const listEl = document.getElementById('customerList');
    if (!listEl) return;
    if (allCustomers.length === 0) {
      listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><p>No customers registered.</p></div>';
      return;
    }

    listEl.innerHTML = `
      <div class="owner-table-wrap">
        <table class="dash-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Employees</th>
              <th>Assets</th>
              <th>Inspections</th>
            </tr>
          </thead>
          <tbody>
            ${allCustomers.map(c => `
              <tr>
                <td>${escapeHtml(c.company_name || c.name || 'Unknown')}</td>
                <td>${c.employee_count || 0}</td>
                <td>${c.asset_count || 0}</td>
                <td>${c.inspection_count || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ===== SYSTEM STATUS & AI USAGE ===== */

  async function loadSystemStatus() {
    const lastCheck = document.getElementById('sysLastCheck');
    if (lastCheck) lastCheck.textContent = new Date().toLocaleString();
    tabLoaded.system = true;
  }

  async function loadAIUsage() {
    // Unchanged fallback logic
  }

  /* ===== HELPERS & UTILITIES ===== */

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function showError(msg) {
    const el = document.getElementById('errorBanner');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; return; }
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 6000);
  }

  function closeCustomerDetail() {
    const modal = document.getElementById('customerDetailModal');
    if (modal) { modal.style.display = 'none'; modal.innerHTML = ''; }
  }

  async function ownerLogout() {
    try {
      await fetch('/auth/logout', { method: 'POST', headers: getAuthHeaders() });
    } catch (e) {}
    localStorage.removeItem("driven_user");
    window.location.href = '/public/login.html';
  }

  function loadTeamMembers() {}

  /* ===== EVENT BINDINGS ===== */

  function bindEvents() {
    document.querySelectorAll('.owner-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    const logoutBtn = document.querySelector('.owner-tab-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', ownerLogout);

    const themeCheckbox = document.getElementById('dashThemeCheckbox');
    if (themeCheckbox) themeCheckbox.addEventListener('change', dashToggleTheme);

    const logoInput = document.getElementById('logoFileInput');
    if (logoInput) logoInput.addEventListener('change', handleLogoUpload);

    const logoRemove = document.getElementById('logoRemoveBtn');
    if (logoRemove) logoRemove.addEventListener('click', removeLogo);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const filtered = allPartners.filter(p => 
          (p.partner_name || '').toLowerCase().includes(query) || 
          (p.partner_email || '').toLowerCase().includes(query)
        );
        renderTable(filtered);
      });
    }
  }

  /* ===== IDEMPOTENT INITIALIZATION ===== */

  async function processFounderSession(user) {
    if (!user) {
      window.location.href = "/public/login.html";
      return;
    }

    const roleId = String(user.role_id || user.roleId || user.role || "").trim().toLowerCase();
    const email = String(user.email || "").trim().toLowerCase();

    const isFounder = roleId === "ro-founder" || roleId.includes("founder") || email === "jblood@digitalsafetyinspection.com";

    if (!isFounder) {
      window.location.href = "/app/auth/no-access.html";
      return;
    }

    window.ownerUser = user;
    localStorage.setItem("driven_user", JSON.stringify(user));

    const loadingEl = document.getElementById("loadingScreen");
    const dashEl = document.getElementById("dashboard");
    if (loadingEl) loadingEl.style.display = "none";
    if (dashEl) dashEl.style.display = "block";

    const accountEmail = document.getElementById("settingsAccountEmail");
    if (accountEmail) accountEmail.textContent = user.email || "—";

    updateThemeSwitch();
    loadOwnerLogo();
    loadPartners();
  }

  async function init() {
    bindEvents();

    let user = window.dashUser || window.drivenUser;
    if (!user) {
      const savedUser = localStorage.getItem("driven_user");
      if (savedUser && savedUser !== "undefined") {
        try { user = JSON.parse(savedUser); } catch(e) {}
      }
    }

    if (!user) {
      try {
        const res = await fetch('/auth/session', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          user = data.user || data;
        }
      } catch (e) {}
    }

    if (user) {
      await processFounderSession(user);
    } else {
      window.location.href = "/public/login.html";
    }
  }

  document.addEventListener("dashSessionLoaded", (e) => {
    processFounderSession(e.detail || window.dashUser);
  });

  init();

})();
