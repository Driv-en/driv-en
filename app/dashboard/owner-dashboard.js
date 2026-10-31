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
  let customerSortField = 'company_name';
  let customerSortAsc = true;

  // Tab cache flags to prevent slow re-fetching on tab switches
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

  /* ===== THEME TOGGLE ===== */

  function dashToggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("driven-theme", newTheme);
    updateThemeSwitch();
  }

  function updateThemeSwitch() {
    const current = document.documentElement.getAttribute("data-theme") || localStorage.getItem("driven-theme") || "light";
    document.documentElement.setAttribute("data-theme", current);
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
          showError('Failed to save logo to server: ' + (data.error || 'Unknown error'));
        }
      })
      .catch(() => showError('Network error while saving logo. Please try again.'));
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

  /* ===== REFERRERS TAB LOGIC ===== */

  async function loadPartners() {
    const tbody = document.getElementById('partnersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:40px 0;">Loading…</td></tr>';

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    try {
      const resp = await fetch(adminApi('/referral-partners'), { headers: getAuthHeaders() });
      if (!resp || !resp.ok) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:40px 0;">Referral partner service unavailable.</td></tr>';
        return;
      }
      const data = await resp.json();

      if (data && data.success && data.partners) {
        allPartners = data.partners;
        renderStats(data.partners);
        updateSortIndicators();
        renderTable(data.partners);
        tabLoaded.referrers = true;
      } else {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:40px 0;">No referral partners found.</td></tr>';
        if (data && data.error) showError(data.error);
      }
    } catch (e) {
      console.error('Load partners failed:', e);
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:40px 0;">Failed to load partners.</td></tr>';
    }
  }

  function renderStats(partners) {
    const total = partners.length;
    const pending = partners.filter(p => p.status === 'Pending').length;
    const approved = partners.filter(p => p.status === 'Approved').length;
    const rejected = partners.filter(p => p.status === 'Rejected').length;

    const elTotal = document.getElementById('statTotal');
    const elPending = document.getElementById('statPending');
    const elApproved = document.getElementById('statApproved');
    const elRejected = document.getElementById('statRejected');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elApproved) elApproved.textContent = approved;
    if (elRejected) elRejected.textContent = rejected;
  }

  function renderTable(partners) {
    const tbody = document.getElementById('partnersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (partners.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:40px 0;">No referral partners yet.</td></tr>';
      return;
    }

    partners = sortPartners(partners);

    partners.forEach(p => {
      const row = document.createElement('tr');
      row.dataset.name = (p.partner_name || '').toLowerCase();
      row.dataset.email = (p.partner_email || '').toLowerCase();

      if (p.status === 'Approved' && p.active === 0) {
        row.classList.add('partner-row-inactive');
      }

      let statusBadge = '';
      if (p.status === 'Approved') {
        statusBadge = '<span class="dash-badge dash-badge-success">Approved</span>';
        if (p.active === 0) {
          statusBadge += ' <span class="dash-badge dash-badge-muted">Inactive</span>';
        }
      } else if (p.status === 'Pending') {
        statusBadge = '<span class="dash-badge dash-badge-warning">Pending</span>';
      } else if (p.status === 'Pending W-9 Review') {
        statusBadge = '<span class="dash-badge dash-badge-warning">W-9 Review</span>';
      } else if (p.status === 'Rejected') {
        statusBadge = '<span class="dash-badge dash-badge-danger">Rejected</span>';
      } else {
        statusBadge = '<span class="dash-badge dash-badge-muted">' + escapeHtml(p.status || 'Unknown') + '</span>';
      }

      let w9Cell = '';
      if (p.w9_attachment && !String(p.w9_attachment).startsWith('DEBUG:')) {
        w9Cell = '<button class="owner-action-btn owner-btn-w9" data-action="view-w9" data-id="' + escapeHtml(p.id) + '">View W-9</button>';
      } else {
        w9Cell = '<span style="color:var(--text-muted);font-size:13px;">No W-9</span>';
      }

      let w9StatusCell = '';
      if (!p.w9_attachment || String(p.w9_attachment).startsWith('DEBUG:')) {
        w9StatusCell = '<span class="dash-badge dash-badge-muted">None</span>';
      } else if (p.w9_expiration_date) {
        const expDate = new Date(p.w9_expiration_date + 'T23:59:59');
        if (expDate < new Date()) {
          w9StatusCell = '<span class="dash-badge dash-badge-danger">Expired</span>';
        } else {
          w9StatusCell = '<span class="dash-badge dash-badge-success">Current</span>';
        }
      } else {
        w9StatusCell = '<span class="dash-badge dash-badge-warning">No Expiry Set</span>';
      }

      const codeCell = p.referral_code ? '<span style="font-family:monospace;font-weight:600;color:var(--primary);">' + escapeHtml(p.referral_code) + '</span>' : '<span style="color:var(--text-muted);">—</span>';

      let achCell = '';
      if (p.bank_name && p.account_number_last4) {
        achCell = '<span class="dash-badge dash-badge-success" title="' + escapeHtml(p.bank_name) + ' ••••' + escapeHtml(p.account_number_last4) + '">On File</span>';
      } else if (p.has_voided_check) {
        achCell = '<span class="dash-badge dash-badge-success" title="Voided check uploaded">Check</span>';
      } else {
        achCell = '<span class="dash-badge dash-badge-muted">None</span>';
      }

      let lastReferredCell = '—';
      if (p.last_referred) {
        lastReferredCell = new Date(p.last_referred).toLocaleDateString();
      }

      const emailCell = p.partner_email
        ? '<a href="mailto:' + escapeHtml(p.partner_email) + '" class="partner-email-link">' + escapeHtml(p.partner_email) + '</a>'
        : '—';

      let actions = '';
      if (p.status === 'Pending') {
        actions = '<button class="owner-action-btn owner-btn-approve" data-action="approve" data-id="' + escapeHtml(p.id) + '" data-name="' + escapeHtml(p.partner_name) + '">Approve</button>';
        actions += '<button class="owner-action-btn owner-btn-reject" data-action="reject" data-id="' + escapeHtml(p.id) + '" data-name="' + escapeHtml(p.partner_name) + '">Reject</button>';
      } else if (p.status === 'Pending W-9 Review') {
        actions = '<button class="owner-action-btn owner-btn-approve" data-action="reapprove" data-id="' + escapeHtml(p.id) + '" data-name="' + escapeHtml(p.partner_name) + '">Re-Approve</button>';
      } else if (p.status === 'Approved') {
        if (p.active === 1) {
          actions = '<button class="owner-action-btn owner-btn-deactivate" data-action="toggle-active" data-id="' + escapeHtml(p.id) + '" data-name="' + escapeHtml(p.partner_name) + '">Deactivate</button>';
        } else {
          actions = '<button class="owner-action-btn owner-btn-activate" data-action="toggle-active" data-id="' + escapeHtml(p.id) + '" data-name="' + escapeHtml(p.partner_name) + '">Activate</button>';
        }
      } else {
        actions = '<span style="color:var(--text-muted);">—</span>';
      }

      const date = p.created_at ? new Date(p.created_at).toLocaleDateString() : '—';

      row.innerHTML =
        '<td>' + escapeHtml(p.partner_name || '—') + '</td>' +
        '<td>' + emailCell + '</td>' +
        '<td>' + escapeHtml(p.partner_phone || '—') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + codeCell + '</td>' +
        '<td>' + w9Cell + '</td>' +
        '<td>' + w9StatusCell + '</td>' +
        '<td>' + achCell + '</td>' +
        '<td>' + lastReferredCell + '</td>' +
        '<td>' + date + '</td>' +
        '<td>' + actions + '</td>';

      tbody.appendChild(row);
    });

    const btns = tbody.querySelectorAll('[data-action]');
    for (let b = 0; b < btns.length; b++) {
      btns[b].addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        const id = this.getAttribute('data-id');
        const name = this.getAttribute('data-name') || '';
        if (action === 'approve') openApproveModal(id, name);
        else if (action === 'reject') openRejectModal(id, name);
        else if (action === 'reapprove') reapproveW9(id, name);
        else if (action === 'toggle-active') toggleActive(id, name);
        else if (action === 'view-w9') viewW9(id);
      });
    }
  }

  function filterPartners() {
    const searchEl = document.getElementById('searchInput');
    if (!searchEl) return;
    const query = searchEl.value.toLowerCase();
    const rows = document.querySelectorAll('#partnersTableBody tr');
    rows.forEach(row => {
      const name = row.dataset.name || '';
      const email = row.dataset.email || '';
      row.style.display = (name.indexOf(query) !== -1 || email.indexOf(query) !== -1) ? '' : 'none';
    });
  }

  function sortBy(column) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
    updateSortIndicators();
    renderTable(allPartners);
  }

  function updateSortIndicators() {
    document.querySelectorAll('.sortable').forEach(th => {
      th.classList.remove('active', 'asc');
      if (th.dataset.sort === sortColumn) {
        th.classList.add('active');
        if (sortDirection === 'asc') th.classList.add('asc');
      }
    });
  }

  function getW9SortValue(p) {
    if (!p.w9_attachment || String(p.w9_attachment).startsWith('DEBUG:')) return 0;
    if (p.w9_expiration_date) {
      const expDate = new Date(p.w9_expiration_date + 'T23:59:59');
      if (expDate < new Date()) return 1;
      return 2;
    }
    return 3;
  }

  function sortPartners(partners) {
    const col = sortColumn;
    const dir = sortDirection === 'asc' ? 1 : -1;
    return partners.slice().sort((a, b) => {
      let aVal, bVal;
      if (col === 'w9_status') {
        aVal = getW9SortValue(a);
        bVal = getW9SortValue(b);
      } else if (col === 'created_at' || col === 'last_referred') {
        aVal = (a[col] || '');
        bVal = (b[col] || '');
        if (!aVal && bVal) return 1;
        if (aVal && !bVal) return -1;
        if (!aVal && !bVal) return 0;
      } else {
        aVal = String(a[col] || '').toLowerCase();
        bVal = String(b[col] || '').toLowerCase();
      }
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });
  }

  function viewW9(partnerId) {
    window.open(adminApi('/w9-download?partnerId=' + encodeURIComponent(partnerId)), '_blank');
  }

  /* ===== APPROVE & REJECT MODALS ===== */

  function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'DRV-';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function defaultW9Expiration() {
    return new Date().getFullYear() + '-12-31';
  }

  function openApproveModal(partnerId, partnerName) {
    currentApprovePartnerId = partnerId;
    const nameEl = document.getElementById('approvePartnerName');
    const codeEl = document.getElementById('approveReferralCode');
    const expEl = document.getElementById('approveW9Expiration');
    const modalEl = document.getElementById('approveModal');

    if (nameEl) nameEl.textContent = partnerName || '—';
    if (codeEl) codeEl.value = generateReferralCode();
    if (expEl) expEl.value = defaultW9Expiration();
    if (modalEl) modalEl.classList.add('active');
  }

  function closeApproveModal() {
    const modalEl = document.getElementById('approveModal');
    if (modalEl) modalEl.classList.remove('active');
    currentApprovePartnerId = null;
  }

  async function confirmApprove() {
    const partnerId = currentApprovePartnerId;
    const codeEl = document.getElementById('approveReferralCode');
    const expEl = document.getElementById('approveW9Expiration');
    const referralCode = codeEl ? codeEl.value.trim() : '';
    const w9Expiration = expEl ? expEl.value : '';

    if (!partnerId) return;
    if (!referralCode) {
      showError('Referral code is required.');
      return;
    }

    const confirmBtn = document.querySelector('#approveModal .owner-modal-confirm');
    if (confirmBtn) {
      confirmBtn.textContent = 'Approving…';
      confirmBtn.disabled = true;
    }

    try {
      const resp = await fetch(adminApi('/referral-partners'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'approve',
          partnerId: partnerId,
          referralCode: referralCode,
          w9ExpirationDate: w9Expiration
        })
      });
      if (!resp || !resp.ok) {
        showError('Failed to approve partner.');
        return;
      }
      const data = await resp.json();

      if (data && data.success) {
        closeApproveModal();
        loadPartners();
        if (data.emailSent === false) {
          showError('Partner approved, but email failed: ' + (data.emailError || 'Unknown error'));
        } else {
          showError('');
        }
      } else {
        showError(data ? data.error : 'Failed to approve partner.');
      }
    } catch (e) {
      showError('Network error. Please try again.');
    } finally {
      if (confirmBtn) {
        confirmBtn.textContent = 'Approve Partner';
        confirmBtn.disabled = false;
      }
    }
  }

  function openRejectModal(partnerId, partnerName) {
    currentRejectPartnerId = partnerId;
    const nameEl = document.getElementById('rejectPartnerName');
    const reasonEl = document.getElementById('rejectReason');
    const modalEl = document.getElementById('rejectModal');

    if (nameEl) nameEl.textContent = partnerName || '—';
    if (reasonEl) reasonEl.value = '';
    if (modalEl) modalEl.classList.add('active');
  }

  function closeRejectModal() {
    const modalEl = document.getElementById('rejectModal');
    if (modalEl) modalEl.classList.remove('active');
    currentRejectPartnerId = null;
  }

  async function confirmReject() {
    const partnerId = currentRejectPartnerId;
    const reasonEl = document.getElementById('rejectReason');
    const reason = reasonEl ? reasonEl.value.trim() : '';

    if (!partnerId) return;

    const confirmBtn = document.querySelector('#rejectModal .owner-modal-confirm');
    if (confirmBtn) {
      confirmBtn.textContent = 'Rejecting…';
      confirmBtn.disabled = true;
    }

    try {
      const resp = await fetch(adminApi('/referral-partners'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'reject', partnerId: partnerId, reason: reason })
      });
      if (!resp || !resp.ok) {
        showError('Failed to reject partner.');
        return;
      }
      const data = await resp.json();

      if (data && data.success) {
        closeRejectModal();
        loadPartners();
      } else {
        showError(data ? data.error : 'Failed to reject partner.');
      }
    } catch (e) {
      showError('Network error. Please try again.');
    } finally {
      if (confirmBtn) {
        confirmBtn.textContent = 'Reject Partner';
        confirmBtn.disabled = false;
      }
    }
  }

  async function reapproveW9(partnerId, partnerName) {
    if (!confirm('Re-approve ' + partnerName + '? Their referral link will be reactivated.')) return;
    try {
      const resp = await fetch(adminApi('/referral-partners'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'reapprove_w9', partnerId: partnerId })
      });
      if (!resp || !resp.ok) {
        showError('Failed to re-approve partner.');
        return;
      }
      const data = await resp.json();
      if (data && data.success) {
        showError(data.message || 'Partner re-approved');
        loadPartners();
      } else {
        showError(data ? data.error : 'Failed to re-approve');
      }
    } catch (e) {
      showError('Network error. Please try again.');
    }
  }

  async function toggleActive(partnerId, partnerName) {
    if (!confirm('Toggle active state for ' + partnerName + '?')) return;
    try {
      const resp = await fetch(adminApi('/referral-partners'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'toggle_active', partnerId: partnerId })
      });
      if (!resp || !resp.ok) {
        showError('Failed to toggle active state.');
        return;
      }
      const data = await resp.json();
      if (data && data.success) {
        showError(data.message || 'State toggled');
        loadPartners();
      } else {
        showError(data ? data.error : 'Failed to toggle state');
      }
    } catch (e) {
      showError('Network error. Please try again.');
    }
  }

  /* ===== CUSTOMERS TAB LOGIC ===== */

  async function loadCustomers() {
    const listEl = document.getElementById('customerList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">Loading customers…</div>';

    try {
      const resp = await fetch(adminApi('/customers'), { headers: getAuthHeaders() });
      if (!resp || !resp.ok) {
        listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><p>Customer management service unavailable.</p></div>';
        return;
      }
      const data = await resp.json();

      if (data && data.success && data.customers) {
        allCustomers = data.customers.filter(c => {
          const orgId = String(c.org_id || c.customer_id || c.id || '').trim().toLowerCase();
          return orgId !== 'org_dsi' && orgId !== 'dsi';
        });

        renderCustomerStats(allCustomers);
        customerCurrentPage = 1;
        renderCustomersTable();
        tabLoaded.customers = true;
      } else {
        listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><p>' + (data ? data.error : 'No customers found.') + '</p></div>';
      }
    } catch (e) {
      listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><p>Failed to load customers.</p></div>';
    }
  }

  function renderCustomerStats(customers) {
    const total = customers.length;
    const active = customers.filter(c => c.subscription_status === 'active').length;
    const trial = customers.filter(c => c.subscription_status === 'trial' || c.subscription_status === 'trialing').length;
    const pending = customers.filter(c => !c.subscription_status || c.subscription_status === 'pending' || c.subscription_status === 'inactive').length;

    document.getElementById('custStatTotal').textContent = total;
    document.getElementById('custStatActive').textContent = active;
    document.getElementById('custStatTrial').textContent = trial;
    document.getElementById('custStatPending').textContent = pending;
  }

  function getFilteredCustomers() {
    const queryEl = document.getElementById('customerSearchInput');
    const query = queryEl && queryEl.value ? queryEl.value.toLowerCase().trim() : '';

    const baseList = allCustomers.filter(c => {
      const orgId = String(c.org_id || c.customer_id || c.id || '').trim().toLowerCase();
      return orgId !== 'org_dsi' && orgId !== 'dsi';
    });

    if (!query) return baseList;

    return baseList.filter(c => {
      const name = (c.company_name || c.organization_name || c.name || '').toLowerCase();
      const email = (c.admin_email || c.contact_email || c.email || '').toLowerCase();
      return name.indexOf(query) !== -1 || email.indexOf(query) !== -1;
    });
  }

  function renderCustomersTable() {
    const listEl = document.getElementById('customerList');
    if (!listEl) return;
    const filtered = getFilteredCustomers();
    const totalPages = Math.ceil(filtered.length / customerPageSize);
    if (customerCurrentPage > totalPages) customerCurrentPage = totalPages || 1;
    const startIdx = (customerCurrentPage - 1) * customerPageSize;
    const pageData = filtered.slice(startIdx, startIdx + customerPageSize);

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><p>No customers registered yet.</p></div>';
      return;
    }

    let html = '<div class="owner-table-wrap" style="overflow-x:auto;background:#ffffff;border:1px solid #10b981;border-radius:8px;padding:0 4px;">';
    html += '<table class="owner-data-table" style="width:100%;border-collapse:collapse;font-size:14px;background:#ffffff;">';
    html += '<thead><tr style="border-bottom:2px solid #e2e8f0;text-align:left;background:#f8fafc;">';
    html += '<th style="padding:10px 8px;cursor:pointer;color:#334155;" id="thCustName">Customer Name</th>';
    html += '<th style="padding:10px 8px;text-align:center;color:#334155;">Employees</th>';
    html += '<th style="padding:10px 8px;text-align:center;color:#334155;">Assets</th>';
    html += '<th style="padding:10px 8px;text-align:center;color:#334155;">Inspections</th>';
    html += '<th style="padding:10px 8px;text-align:center;color:#334155;">Completed PMs</th>';
    html += '<th style="padding:10px 8px;text-align:center;color:#334155;">Completed WOs</th>';
    html += '<th style="padding:10px 8px;text-align:center;color:#334155;">Equipment Transfers</th>';
    html += '<th style="padding:10px 8px;text-align:center;color:#334155;">Fuel Purchases</th>';
    html += '<th style="padding:10px 8px;text-align:center;color:#334155;">Receipts (AI)</th>';
    html += '<th style="padding:10px 8px;text-align:center;color:#334155;">Manuals (AI)</th>';
    html += '</tr></thead><tbody>';

    for (let i = 0; i < pageData.length; i++) {
      const c = pageData[i];
      const name = escapeHtml(c.company_name || c.organization_name || c.name || 'Unknown');
      const idx = startIdx + i;
      html += `<tr class="owner-customer-row" data-idx="${idx}" style="cursor:pointer;border-bottom:1px solid #e2e8f0;color:#1e293b;">`;
      html += `<td style="padding:10px 8px;font-weight:500;color:#1e293b;">${name}</td>`;
      html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${c.employee_count || 0}</td>`;
      html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${c.asset_count || 0}</td>`;
      html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${c.inspection_count || 0}</td>`;
      html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${c.pm_count || 0}</td>`;
      html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${c.wo_count || 0}</td>`;
      html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${c.transfer_count || 0}</td>`;
      html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${c.fuel_count || 0}</td>`;
      html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${c.receipt_count || 0}</td>`;
      html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${c.manual_count || 0}</td>`;
      html += `</tr>`;
    }

    let totEmp = 0, totAsset = 0, totInsp = 0, totPM = 0, totWO = 0, totTransfer = 0, totFuel = 0, totReceipt = 0, totManual = 0;
    filtered.forEach(c => {
      totEmp += c.employee_count || 0;
      totAsset += c.asset_count || 0;
      totInsp += c.inspection_count || 0;
      totPM += c.pm_count || 0;
      totWO += c.wo_count || 0;
      totTransfer += c.transfer_count || 0;
      totFuel += c.fuel_count || 0;
      totReceipt += c.receipt_count || 0;
      totManual += c.manual_count || 0;
    });

    html += '<tr style="border-top:2px solid #e2e8f0;font-weight:700;background:#f8fafc;color:#1e293b;">';
    html += `<td style="padding:10px 8px;color:#1e293b;">TOTAL (${filtered.length} customers)</td>`;
    html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${totEmp}</td>`;
    html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${totAsset}</td>`;
    html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${totInsp}</td>`;
    html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${totPM}</td>`;
    html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${totWO}</td>`;
    html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${totTransfer}</td>`;
    html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${totFuel}</td>`;
    html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${totReceipt}</td>`;
    html += `<td style="padding:10px 8px;text-align:center;color:#334155;">${totManual}</td>`;
    html += '</tr>';

    html += '</tbody></table></div>';

    if (totalPages > 1) {
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">';
      html += `<span style="font-size:13px;color:var(--text-muted);">Page ${customerCurrentPage} of ${totalPages} (${filtered.length} customers)</span>`;
      html += '<div>';
      if (customerCurrentPage > 1) {
        html += `<button class="owner-refresh-btn" id="btnCustPrev" style="margin-right:8px;">← Prev</button>`;
      }
      if (customerCurrentPage < totalPages) {
        html += `<button class="owner-refresh-btn" id="btnCustNext">Next →</button>`;
      }
      html += '</div></div>';
    }

    listEl.innerHTML = html;

    listEl.querySelectorAll('.owner-customer-row').forEach(row => {
      row.addEventListener('click', () => {
        showCustomerDetail(parseInt(row.getAttribute('data-idx'), 10));
      });
    });

    const thName = document.getElementById('thCustName');
    if (thName) {
      thName.addEventListener('click', () => sortByCustomerField('company_name'));
    }

    const btnPrev = document.getElementById('btnCustPrev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        customerCurrentPage--;
        renderCustomersTable();
      });
    }

    const btnNext = document.getElementById('btnCustNext');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        customerCurrentPage++;
        renderCustomersTable();
      });
    }
  }

  function sortByCustomerField(field) {
    if (customerSortField === field) { customerSortAsc = !customerSortAsc; }
    else { customerSortField = field; customerSortAsc = true; }
    allCustomers.sort((a, b) => {
      const va = (a[field] || '').toString().toLowerCase();
      const vb = (b[field] || '').toString().toLowerCase();
      if (va < vb) return customerSortAsc ? -1 : 1;
      if (va > vb) return customerSortAsc ? 1 : -1;
      return 0;
    });
    customerCurrentPage = 1;
    renderCustomersTable();
  }

  function showCustomerDetail(idx) {
    const c = getFilteredCustomers()[idx] || allCustomers[idx];
    if (!c) return;

    const modal = document.getElementById('customerDetailModal');
    if (!modal) return;

    let modules = c.activated_modules;
    try { modules = JSON.parse(modules || '[]'); } catch(e) { modules = modules ? [modules] : []; }
    const moduleStr = modules.length ? modules.join(', ') : '—';

    const subDate = c.activation_date ? new Date(c.activation_date).toLocaleDateString() : '—';
    const expDate = c.expiration_date ? new Date(c.expiration_date).toLocaleDateString() : '—';
    const createdDate = c.created_at ? new Date(c.created_at).toLocaleDateString() : '—';

    let html = '<div style="background:#ffffff;color:#1e293b;border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.35);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h3 style="margin:0;color:#1e293b;">' + escapeHtml(c.company_name || c.organization_name || c.name || 'Unknown') + '</h3>';
    html += '<button id="btnCloseCustDetail" style="background:none;border:none;font-size:26px;cursor:pointer;color:#64748b;line-height:1;">×</button>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;font-size:14px;color:#334155;">';
    html += '<div><strong>Customer #/OrgID:</strong><br>' + escapeHtml(c.customer_id || c.org_id || '—') + '</div>';
    html += '<div><strong>Subscription Date:</strong><br>' + subDate + '</div>';
    html += '<div><strong>Expiration Date:</strong><br>' + expDate + '</div>';
    html += '<div><strong>Modules:</strong><br>' + escapeHtml(moduleStr) + '</div>';
    html += '<div><strong>Subscription Status:</strong><br>' + escapeHtml(c.subscription_status || c.customer_status || '—') + '</div>';
    html += '<div><strong>Subscription Type:</strong><br>' + escapeHtml(c.subscription_type || '—') + '</div>';
    html += '<div><strong>Admin Email:</strong><br>' + escapeHtml(c.admin_email || c.contact_email || '—') + '</div>';
    html += '<div><strong>Admin Phone:</strong><br>' + escapeHtml(c.admin_phone || '—') + '</div>';
    html += '<div><strong>Address:</strong><br>' + escapeHtml([c.billing_address, c.city, c.state, c.zip].filter(Boolean).join(', ') || '—') + '</div>';
    html += '<div><strong>Date Added:</strong><br>' + createdDate + '</div>';
    if (c.referrer) {
      html += '<div><strong>Referrer:</strong><br>' + escapeHtml(c.referrer) + '</div>';
    }
    html += '<div><strong>Employees:</strong><br>' + (c.employee_count || 0) + '</div>';
    html += '<div><strong>Assets:</strong><br>' + (c.asset_count || 0) + '</div>';
    html += '<div><strong>Inspections:</strong><br>' + (c.inspection_count || 0) + '</div>';
    html += '<div><strong>Completed PMs:</strong><br>' + (c.pm_count || 0) + '</div>';
    html += '<div><strong>Work Orders:</strong><br>' + (c.wo_count || 0) + '</div>';
    html += '<div><strong>Equipment Transfers:</strong><br>' + (c.transfer_count || 0) + '</div>';
    html += '<div><strong>Fuel Purchases:</strong><br>' + (c.fuel_count || 0) + '</div>';
    html += '<div><strong>Receipts (AI):</strong><br>' + (c.receipt_count || 0) + '</div>';
    html += '<div><strong>Manuals (AI):</strong><br>' + (c.manual_count || 0) + '</div>';
    html += '<div><strong>Orders:</strong><br>' + (c.order_count || 0) + '</div>';
    html += '</div></div>';

    modal.innerHTML = html;
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.55)';
    modal.style.zIndex = '9999';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    const closeBtn = document.getElementById('btnCloseCustDetail');
    if (closeBtn) closeBtn.addEventListener('click', closeCustomerDetail);

    modal.onclick = function(e) {
      if (e.target === modal) closeCustomerDetail();
    };
  }

  function closeCustomerDetail() {
    const modal = document.getElementById('customerDetailModal');
    if (modal) { modal.style.display = 'none'; modal.innerHTML = ''; }
  }

  /* ===== SITE VISITORS TAB LOGIC ===== */

  async function loadVisitors(daysPreset, customFilter) {
    let url = adminApi('/site-visitors');
    const startEl = document.getElementById('visitorDateStart');
    const endEl = document.getElementById('visitorDateEnd');

    if (customFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      url += `?start=${today}&end=${today}`;
    } else if (customFilter === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yest = d.toISOString().split('T')[0];
      url += `?start=${yest}&end=${yest}`;
    } else if (customFilter === 'week') {
      url += `?days=7`;
    } else if (daysPreset) {
      url += `?days=${daysPreset}`;
    } else if (startEl && endEl && startEl.value && endEl.value) {
      url += `?start=${startEl.value}&end=${endEl.value}`;
    }

    try {
      const resp = await fetch(url, { headers: getAuthHeaders() });
      if (!resp || !resp.ok) return;
      const data = await resp.json();

      if (data && data.success) {
        if (data.summary) {
          document.getElementById('visitorTotalVisits').textContent = data.summary.totalVisits || 0;
          document.getElementById('visitorUniqueVisitors').textContent = data.summary.uniqueVisitors || 0;
          document.getElementById('visitorUniqueSessions').textContent = data.summary.uniqueSessions || 0;
          document.getElementById('visitorUniqueCountries').textContent = data.summary.uniqueCountries || 0;
          document.getElementById('visitorReferralVisits').textContent = data.summary.referralVisits || 0;
          document.getElementById('visitorTopDevice').textContent = data.summary.topDevice || '—';
          document.getElementById('visitorTopBrowser').textContent = data.summary.topBrowser || '—';
          document.getElementById('visitorTopOS').textContent = data.summary.topOS || '—';

          renderVisitorBreakdowns(data.summary);
        }
        allVisitors = data.visitors || [];
        allSessions = data.sessions || [];
        renderVisitorsTable();
        renderVisitorSessions();
        tabLoaded.visitors = true;
      }
    } catch (e) {
      console.error('Load visitors failed:', e);
    }
  }

  function renderVisitorBreakdowns(summary) {
    renderSimpleList('visitorTopPages', summary.topPages, 'page_path', 'count');
    renderSimpleList('visitorTopCountries', summary.topCountries, 'country', 'count');
    renderSimpleList('visitorBrowsers', summary.browserBreakdown, 'browser', 'count');
    renderSimpleList('visitorOS', summary.osBreakdown, 'os', 'count');
  }

  function renderSimpleList(elementId, items, keyField, countField) {
    const container = document.getElementById(elementId);
    if (!container) return;
    if (!items || !items.length) {
      container.innerHTML = '<div style="font-size:12px;color:#64748b;margin-top:8px;">No data</div>';
      return;
    }
    let html = '<div style="margin-top:8px;font-size:13px;text-align:left;">';
    items.slice(0, 5).forEach(item => {
      const label = escapeHtml(item[keyField] || 'Direct / Unknown');
      const count = item[countField] || 0;
      html += `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f1f5f9;">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;">${label}</span>
        <strong style="margin-left:auto;">${count}</strong>
      </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function renderVisitorsTable() {
    const tbody = document.getElementById('visitorsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (allVisitors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px 0;">No visitor records found.</td></tr>';
      return;
    }

    allVisitors.forEach(v => {
      const row = document.createElement('tr');
      const dateStr = v.created_at ? new Date(v.created_at).toLocaleString() : '—';
      row.innerHTML = `
        <td>${dateStr}</td>
        <td>${escapeHtml(v.page_path || '/')}</td>
        <td>${escapeHtml(v.country || 'Unknown')}</td>
        <td>${escapeHtml(v.device_type || 'Desktop')}</td>
        <td>${escapeHtml(v.browser || '—')}</td>
        <td>${escapeHtml(v.os || '—')}</td>
        <td>${escapeHtml(v.referral_code || '—')}</td>
        <td>${escapeHtml(v.utm_source || 'Direct')}</td>
        <td>${v.duration_seconds ? v.duration_seconds + 's' : '—'}</td>
      `;
      tbody.appendChild(row);
    });
  }

  function renderVisitorSessions() {
    const tbody = document.getElementById('sessionsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (allSessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px 0;">No visitor session data found.</td></tr>';
      return;
    }

    allSessions.forEach(s => {
      const row = document.createElement('tr');
      const firstVisit = s.firstVisit ? new Date(s.firstVisit).toLocaleString() : '—';
      row.innerHTML = `
        <td>${firstVisit}</td>
        <td>${s.pageCount || (s.pages ? s.pages.length : 1)}</td>
        <td>${escapeHtml(s.entryPage || (s.pages && s.pages[0] ? s.pages[0].pagePath : '/'))}</td>
        <td>${s.durationSeconds || s.totalTimeOnSite ? (s.durationSeconds || s.totalTimeOnSite) + 's' : '—'}</td>
        <td>${escapeHtml(s.country || 'Unknown')}</td>
        <td>${escapeHtml(s.deviceType || 'Desktop')}</td>
        <td>${escapeHtml(s.browser || '—')}</td>
        <td>${escapeHtml(s.os || '—')}</td>
        <td>${escapeHtml(s.referralCode || '—')}</td>
      `;
      tbody.appendChild(row);
    });
  }

  // Make loadVisitors accessible to inline onclick handlers in HTML
  window.loadVisitors = loadVisitors;

  /* ===== SYSTEM STATUS & AI USAGE ===== */

  async function loadSystemStatus() {
    const lastCheckEl = document.getElementById('sysLastCheck');
    if (lastCheckEl) lastCheckEl.textContent = new Date().toLocaleString();

    const endpoints = [
      { id: 'sysWorkerAuth', url: '/auth/session' },
      { id: 'sysWorkerReferral', url: '/referral/session' },
      { id: 'sysWorkerCheckout', url: '/api/health' },
      { id: 'sysPagesFunctions', url: '/api/admin/referral-partners' }
    ];

    for (let i = 0; i < endpoints.length; i++) {
      const ep = endpoints[i];
      const el = document.getElementById(ep.id);
      if (!el) continue;

      el.textContent = 'Checking...';
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(ep.url, { signal: controller.signal, headers: getAuthHeaders() });
        clearTimeout(timeout);
        el.textContent = 'OK (' + resp.status + ')';
        if (el.parentElement && el.parentElement.querySelector('.sys-status-dot')) {
          el.parentElement.querySelector('.sys-status-dot').className = 'sys-status-dot sys-dot-ok';
        }
      } catch (e) {
        el.textContent = 'Unreachable';
        if (el.parentElement && el.parentElement.querySelector('.sys-status-dot')) {
          el.parentElement.querySelector('.sys-status-dot').className = 'sys-status-dot sys-dot-warn';
        }
      }
    }

    try {
      const resp = await fetch(adminApi('/referral-partners'), { headers: getAuthHeaders() });
      if (resp && resp.ok) {
        const data = await resp.json();
        const sysPartnersEl = document.getElementById('sysD1Partners');
        if (data && data.success && data.partners && sysPartnersEl) {
          sysPartnersEl.textContent = data.partners.length + ' rows';
        }
      }
    } catch (e) {}

    try {
      const vResp = await fetch(adminApi('/site-visitors?summary=true'), { headers: getAuthHeaders() });
      if (vResp && vResp.ok) {
        const vData = await vResp.json();
        const sysVisitorsEl = document.getElementById('sysD1Visitors');
        if (vData && vData.success && vData.summary && sysVisitorsEl) {
          sysVisitorsEl.textContent = (vData.summary.totalVisits || 0) + ' rows';
        }
      }
    } catch (e) {}

    tabLoaded.system = true;
  }

  async function loadAIUsage() {
    try {
      const resp = await fetch(adminApi('/customers'), { headers: getAuthHeaders() });
      const detailEl = document.getElementById('ai-usage-detail');
      if (!resp || !resp.ok) {
        if (detailEl) detailEl.textContent = 'No AI usage data available yet.';
        return;
      }
      const data = await resp.json();
      if (!data || !data.success || !data.customers) {
        if (detailEl) detailEl.textContent = 'No AI usage data available yet.';
        return;
      }

      const customers = data.customers;
      let totReceipts = 0, totManuals = 0, totExtractions = 0;
      customers.forEach(c => {
        totReceipts += c.receipt_count || 0;
        totManuals += c.manual_count || 0;
        totExtractions += (c.extraction_receipt_count || 0) + (c.extraction_manual_count || 0);
      });

      const statExtEl = document.getElementById('ai-stat-extractions');
      const statSuccEl = document.getElementById('ai-stat-success');
      const statFailEl = document.getElementById('ai-stat-failed');

      if (statExtEl) statExtEl.textContent = totReceipts + totManuals;
      if (statSuccEl) statSuccEl.textContent = totReceipts;
      if (statFailEl) statFailEl.textContent = totManuals;

      if (detailEl) {
        let html = '<strong>AI Extraction Summary (All Customers)</strong><br>';
        html += 'Receipt uploads (AI): ' + totReceipts + '<br>';
        html += 'Manual uploads (AI): ' + totManuals + '<br>';
        html += 'Total AI extractions: ' + totExtractions + '<br><br>';
        html += '<strong>Per Customer:</strong>';
        html += '<div style="margin-top:8px;max-height:200px;overflow-y:auto;">';
        customers.forEach(c => {
          const name = c.company_name || 'Unknown';
          const rc = c.receipt_count || 0;
          const mc = c.manual_count || 0;
          if (rc > 0 || mc > 0) {
            html += '<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:12px;">';
            html += escapeHtml(name) + ' — Receipts: ' + rc + ' · Manuals: ' + mc;
            html += '</div>';
          }
        });
        html += '</div>';
        detailEl.innerHTML = html;
      }
    } catch (e) {}
  }

  /* ===== ERROR LOGS TAB & BULK SELECTION ===== */

  async function loadIssues() {
    const listEl = document.getElementById('issueList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">Loading error logs...</div>';

    try {
      const resp = await fetch(adminApi('/issues?limit=2000&all=true'), { headers: getAuthHeaders() });
      if (!resp || !resp.ok) {
        listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><h3>Unable to Load Error Logs</h3><p>Could not reach the error endpoint.</p></div>';
        return;
      }
      const data = await resp.json();

      if (data && data.success && data.issues) {
        allIssues = data.issues;
        populateSourceFilter(data.issues);
        renderIssueStats(data.issues);
        renderIssues(data.issues);
        tabLoaded.issues = true;
      }
    } catch (e) {
      listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><h3>Unable to Load Error Logs</h3><p>Network error fetching issues.</p></div>';
    }
  }

  function renderIssueStats(issues) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const totalEl = document.getElementById('issueStatTotal');
    const todayEl = document.getElementById('issueStatToday');
    const weekEl = document.getElementById('issueStatWeek');
    const resEl = document.getElementById('issueStatResolved');

    if (totalEl) totalEl.textContent = issues.length;
    if (todayEl) todayEl.textContent = issues.filter(i => i.created_at >= todayStart).length;
    if (weekEl) weekEl.textContent = issues.filter(i => i.created_at >= weekStart).length;
    if (resEl) resEl.textContent = issues.filter(i => i.resolved === 1).length;
  }

  function populateSourceFilter(issues) {
    const sel = document.getElementById('issueSourceFilter');
    if (!sel) return;
    const current = sel.value;
    const sources = Array.from(new Set(issues.map(i => i.source || 'unknown'))).sort();
    let html = '<option value="all">All Sources</option>';
    sources.forEach(s => {
      html += '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>';
    });
    sel.innerHTML = html;
    if (sources.indexOf(current) !== -1) sel.value = current;
  }

  function getIssueStatusFilter() {
    const sel = document.getElementById('issueStatusFilter');
    return sel ? sel.value : 'all';
  }

  function clearIssueFilters() {
    const statusSel = document.getElementById('issueStatusFilter');
    const sourceSel = document.getElementById('issueSourceFilter');
    const msgInput = document.getElementById('issueMsgFilter');
    const dateFrom = document.getElementById('issueDateFrom');
    const dateTo = document.getElementById('issueDateTo');
    if (statusSel) statusSel.value = 'all';
    if (sourceSel) sourceSel.value = 'all';
    if (msgInput) msgInput.value = '';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    renderIssues(allIssues);
  }

  function renderIssues(issues) {
    const listEl = document.getElementById('issueList');
    if (!listEl) return;

    if (issues.length === 0) {
      listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><h3>No Errors</h3><p>No errors have been logged.</p></div>';
      return;
    }

    const statusFilter = getIssueStatusFilter();
    const sourceFilterEl = document.getElementById('issueSourceFilter');
    const sourceFilter = sourceFilterEl ? sourceFilterEl.value : 'all';
    const msgInput = document.getElementById('issueMsgFilter');
    const msgQuery = msgInput ? msgInput.value.toLowerCase() : '';
    const dateFromEl = document.getElementById('issueDateFrom');
    const dateToEl = document.getElementById('issueDateTo');
    const dateFrom = dateFromEl && dateFromEl.value ? new Date(dateFromEl.value + 'T00:00:00').getTime() : null;
    const dateTo = dateToEl && dateToEl.value ? new Date(dateToEl.value + 'T23:59:59').getTime() : null;

    const filtered = issues.filter(i => {
      if (statusFilter === 'open' && i.resolved === 1) return false;
      if (statusFilter === 'resolved' && i.resolved !== 1) return false;
      if (sourceFilter !== 'all' && (i.source || 'unknown') !== sourceFilter) return false;
      if (msgQuery && ((i.error_message || '').toLowerCase().indexOf(msgQuery) === -1)) return false;
      if (dateFrom || dateTo) {
        const t = i.created_at ? new Date(i.created_at).getTime() : null;
        if (!t) return false;
        if (dateFrom && t < dateFrom) return false;
        if (dateTo && t > dateTo) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><h3>No Errors Match Filters</h3></div>';
      return;
    }

    let html = '<table class="issues-table">';
    html += '<colgroup>';
    html += '<col style="width:4%;">';
    html += '<col style="width:4%;">';
    html += '<col style="width:12%;">';
    html += '<col style="width:40%;">';
    html += '<col style="width:14%;">';
    html += '<col style="width:12%;">';
    html += '<col style="width:14%;">';
    html += '</colgroup>';
    html += '<thead><tr>';
    html += '<th style="text-align:center;"><input type="checkbox" id="selectAllIssues"></th>';
    html += '<th></th><th>Status</th><th>Error Message</th><th>Source</th><th>Date</th><th>Actions</th>';
    html += '</tr></thead><tbody>';

    filtered.forEach(i => {
      const time = i.created_at ? new Date(i.created_at).toLocaleDateString() + ' ' + new Date(i.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—';
      const isResolved = i.resolved === 1;
      const safeId = escapeHtml(i.id);
      const isExpanded = (String(issueExpandedId) === String(i.id));

      const statusBadge = isResolved
        ? '<span class="dash-badge dash-badge-success">Resolved</span>'
        : '<span class="dash-badge dash-badge-danger">Open</span>';

      html += `<tr class="issue-row ${isResolved ? 'partner-row-inactive' : ''}" data-error-id="${safeId}" style="cursor:pointer;">`;
      html += `<td style="text-align:center;" onclick="event.stopPropagation();"><input type="checkbox" class="issue-checkbox" data-id="${safeId}"></td>`;
      html += `<td style="text-align:center;font-size:12px;color:var(--text-muted);">${isExpanded ? '▼' : '▶'}</td>`;
      html += `<td>${statusBadge}</td>`;
      html += `<td class="col-msg" style="font-weight:600;">${escapeHtml(i.error_message || 'Unknown error')}</td>`;
      html += `<td><span class="issue-card-source">${escapeHtml(i.source || 'unknown')}</span></td>`;
      html += `<td style="font-size:12px;color:#475569;">${time}</td>`;
      html += `<td>`;
      html += `<button class="owner-action-btn owner-btn-w9" data-action="copy" data-id="${safeId}">Copy</button>`;
      html += `<button class="owner-action-btn ${isResolved ? 'owner-btn-activate' : 'owner-btn-deactivate'}" data-action="resolve" data-id="${safeId}" data-resolved="${!isResolved}">${isResolved ? 'Reopen' : 'Resolve'}</button>`;
      html += `</td></tr>`;

      if (isExpanded) {
        html += `<tr class="issue-detail-row" style="background:#f8fafc;">`;
        html += `<td colspan="7"><div style="padding:12px 16px;">`;
        html += `<div style="font-size:13px;color:#475569;margin-bottom:8px;"><strong>Error ID:</strong> ${safeId}</div>`;
        if (i.stack_trace) {
          html += `<pre style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:12px;font-size:12px;color:#0f172a;white-space:pre-wrap;word-break:break-all;">${escapeHtml(i.stack_trace)}</pre>`;
        }
        html += `</div></td></tr>`;
      }
    });

    html += '</tbody></table>';
    listEl.innerHTML = html;

    const selectAllCb = document.getElementById('selectAllIssues');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.issue-checkbox').forEach(cb => { cb.checked = checked; });
      });
    }

    listEl.querySelectorAll('.issue-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'INPUT') return;
        const id = row.getAttribute('data-error-id');
        issueExpandedId = (String(issueExpandedId) === String(id)) ? null : id;
        renderIssues(allIssues);
      });
    });

    listEl.querySelectorAll('[data-action="copy"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyIssue(btn.getAttribute('data-id'), btn);
      });
    });

    listEl.querySelectorAll('[data-action="resolve"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        resolveIssue(btn.getAttribute('data-id'), btn.getAttribute('data-resolved') === 'true');
      });
    });
  }

  async function resolveSelectedIssues() {
    const checkedCbs = document.querySelectorAll('.issue-checkbox:checked');
    if (!checkedCbs || checkedCbs.length === 0) {
      alert('Please select at least one error log to resolve.');
      return;
    }

    const ids = Array.from(checkedCbs).map(cb => cb.getAttribute('data-id'));

    // Optimistically update local state & render UI immediately
    ids.forEach(id => {
      const issue = allIssues.find(i => String(i.id) === String(id));
      if (issue) issue.resolved = 1;
    });

    renderIssueStats(allIssues);
    renderIssues(allIssues);

    // Run parallel resolution requests
    await Promise.allSettled(ids.map(id =>
      fetch(adminApi('/issues'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: id, resolved: true })
      })
    ));
  }

  function copyIssue(errorId, btn) {
    const issue = allIssues.find(i => String(i.id) === String(errorId));
    if (!issue) return;

    let text = '=== DRIV-EN ERROR LOG ENTRY ===\n';
    text += 'Error ID: ' + (issue.id || 'N/A') + '\n';
    text += 'Source: ' + (issue.source || 'N/A') + '\n';
    text += 'Timestamp: ' + (issue.created_at || 'N/A') + '\n';
    text += '\n--- ERROR MESSAGE ---\n' + (issue.error_message || 'No message') + '\n';
    text += '\n--- STACK TRACE ---\n' + (issue.stack_trace || 'No stack trace available') + '\n';

    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  }

  async function resolveIssue(id, resolved) {
    // Immediate UI update
    const issue = allIssues.find(i => String(i.id) === String(id));
    if (issue) issue.resolved = resolved ? 1 : 0;
    renderIssueStats(allIssues);
    renderIssues(allIssues);

    try {
      await fetch(adminApi('/issues'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: id, resolved: resolved })
      });
    } catch (e) {}
  }

  /* ===== TEAM MEMBERS & ACCESS LOGIC ===== */

  async function loadTeamMembers() {
    const listEl = document.getElementById('teamAccessList');
    if (!listEl) return;

    try {
      const resp = await fetch('/auth/team-members', { headers: getAuthHeaders() });
      if (!resp || !resp.ok) {
        listEl.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">Team access endpoint unavailable.</p>';
        return;
      }
      const data = await resp.json();

      if (data && data.success && data.members) {
        listEl.innerHTML = data.members.map(m => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border);">
            <div>
              <div style="font-size:15px;font-weight:600;color:var(--text);">${escapeHtml(m.full_name || m.email)}</div>
              <div style="font-size:13px;color:var(--text-muted);">${escapeHtml(m.email)}</div>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {}
  }

  /* ===== UTILITIES & HELPERS ===== */

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

  async function ownerLogout() {
    try {
      await fetch('/auth/logout', { method: 'POST', headers: getAuthHeaders() });
    } catch (e) {}
    localStorage.removeItem("driven_user");
    window.location.href = '/public/login.html';
  }

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
    if (searchInput) searchInput.addEventListener('input', filterPartners);

    const btnRefreshPartners = document.getElementById('btnRefreshPartners');
    if (btnRefreshPartners) btnRefreshPartners.addEventListener('click', loadPartners);

    const btnRefreshCust = document.getElementById('btnRefreshCust');
    if (btnRefreshCust) btnRefreshCust.addEventListener('click', loadCustomers);

    const btnRefreshIssues = document.getElementById('btnRefreshIssues');
    if (btnRefreshIssues) btnRefreshIssues.addEventListener('click', loadIssues);

    const btnClearIssues = document.getElementById('btnClearIssues');
    if (btnClearIssues) btnClearIssues.addEventListener('click', clearIssueFilters);

    const btnResolveSelected = document.getElementById('btnResolveSelectedIssues');
    if (btnResolveSelected) btnResolveSelected.addEventListener('click', resolveSelectedIssues);

    const approveModal = document.getElementById('approveModal');
    if (approveModal) {
      approveModal.addEventListener('click', (e) => { if (e.target === approveModal) closeApproveModal(); });
    }

    const btnCancelApprove = document.getElementById('btnCancelApprove');
    if (btnCancelApprove) btnCancelApprove.addEventListener('click', closeApproveModal);

    const btnConfirmApprove = document.getElementById('btnConfirmApprove');
    if (btnConfirmApprove) btnConfirmApprove.addEventListener('click', confirmApprove);

    const rejectModal = document.getElementById('rejectModal');
    if (rejectModal) {
      rejectModal.addEventListener('click', (e) => { if (e.target === rejectModal) closeRejectModal(); });
    }

    const btnCancelReject = document.getElementById('btnCancelReject');
    if (btnCancelReject) btnCancelReject.addEventListener('click', closeRejectModal);

    const btnConfirmReject = document.getElementById('btnConfirmReject');
    if (btnConfirmReject) btnConfirmReject.addEventListener('click', confirmReject);

    const btnRegenCode = document.getElementById('btnRegenCode');
    if (btnRegenCode) {
      btnRegenCode.addEventListener('click', () => {
        const codeEl = document.getElementById('approveReferralCode');
        if (codeEl) codeEl.value = generateReferralCode();
      });
    }

    // Sortable Headers
    document.querySelectorAll('.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (col) sortBy(col);
      });
    });
  }

  /* ===== SESSION INITIALIZATION ===== */

  async function processFounderSession(user) {
    if (!user) {
      window.location.href = "/public/login.html";
      return;
    }

    const roleId = String(user.role_id || user.roleId || user.role || "").trim();
    const orgId = String(user.org_id || user.orgId || "").trim();

    // Strict Founder authorization: role_id must equal 'RO-Founder' and org_id must equal 'org_dsi'
    const isFounder = (roleId.toUpperCase() === "RO-FOUNDER") && (orgId.toLowerCase() === "org_dsi");

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
