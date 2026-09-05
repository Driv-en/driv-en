// =========================================================================
// OWNER DASHBOARD LOGIC
// =========================================================================
// This page does NOT use dashboard-common.js or auth-check.js.
// It performs its own auth check by fetching /auth/session directly.
// Only users with role=DRIV-EN Founder can access this dashboard.
// The header, theme toggle, and footer are self-contained (like the
// referrer dashboard) to avoid loading customer-specific data.
//
// NOTE: The theme toggle has been moved from the header to the Settings tab.
//       The DSI logo is loaded from localStorage (base64) and displayed in
//       the header. Logo upload is handled in the Settings tab.
//       When other dashboards are updated, replicate this pattern.
// =========================================================================

var allPartners = [];
var currentApprovePartnerId = null;
var currentRejectPartnerId = null;
var sortColumn = 'created_at';
var sortDirection = 'desc';

// ---- Theme Toggle ----
function dashToggleTheme() {
  var current = document.documentElement.getAttribute("data-theme");
  var newTheme = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("driven-theme", newTheme);
  updateThemeSwitch();
}

function updateThemeSwitch() {
  var current = document.documentElement.getAttribute("data-theme");
  var checkbox = document.getElementById("dashThemeCheckbox");
  var labelLight = document.getElementById("dashThemeLabelLight");
  var labelDark = document.getElementById("dashThemeLabelDark");
  if (checkbox) checkbox.checked = (current === "dark");
  if (labelLight) labelLight.classList.toggle("active", current === "light");
  if (labelDark) labelDark.classList.toggle("active", current === "dark");
}

// ---- Logo Management ----
function loadOwnerLogo() {
  var logoData = localStorage.getItem('driven-owner-logo');
  var container = document.getElementById('ownerLogoContainer');
  var preview = document.getElementById('settingsLogoPreview');
  var removeBtn = document.getElementById('logoRemoveBtn');

  if (logoData) {
    container.innerHTML = '<img src="' + logoData + '" class="dash-customer-logo" alt="DSI Logo">';
    preview.innerHTML = '<img src="' + logoData + '" style="max-height:56px;max-width:180px;border:1px solid var(--border);border-radius:6px;padding:4px;background:var(--bg-card);" alt="Logo preview">';
    if (removeBtn) removeBtn.style.display = 'inline-block';
  } else {
    container.innerHTML = '<div class="dash-customer-logo-placeholder">DSI Logo</div>';
    preview.innerHTML = '<div class="settings-logo-placeholder">No logo uploaded</div>';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function handleLogoUpload(event) {
  var file = event.target.files[0];
  if (!file) return;

  if (file.size > 500 * 1024) {
    showError('Logo file is too large. Maximum size is 500KB.');
    event.target.value = '';
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    var logoData = e.target.result;
    localStorage.setItem('driven-owner-logo', logoData);
    loadOwnerLogo();
    showError('');
  };
  reader.onerror = function() {
    showError('Failed to read the logo file. Please try again.');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function removeLogo() {
  localStorage.removeItem('driven-owner-logo');
  loadOwnerLogo();
}

// =========================================================================
// SITE VISITORS TAB LOGIC
// =========================================================================

// Load visitor data with optional date range
// presetDays: '7', '30', '90' for quick filters, or null for custom date range
async function loadVisitors(presetDays) {
  try {
    var startEl = document.getElementById('visitorDateStart');
    var endEl = document.getElementById('visitorDateEnd');
    var startDate, endDate;

    if (presetDays) {
      // Quick filter — last N days
      var end = new Date();
      var start = new Date();
      start.setDate(start.getDate() - parseInt(presetDays));
      startDate = start.toISOString();
      endDate = end.toISOString();
      // Update the date inputs to reflect the selected range
      startEl.value = start.toISOString().split('T')[0];
      endEl.value = end.toISOString().split('T')[0];
    } else {
      // Custom date range from inputs
      var startVal = startEl.value;
      var endVal = endEl.value;
      if (startVal && endVal) {
        startDate = new Date(startVal + 'T00:00:00Z').toISOString();
        endDate = new Date(endVal + 'T23:59:59Z').toISOString();
      } else {
        // Default to last 30 days
        var end = new Date();
        var start = new Date();
        start.setDate(start.getDate() - 30);
        startDate = start.toISOString();
        endDate = end.toISOString();
        startEl.value = start.toISOString().split('T')[0];
        endEl.value = end.toISOString().split('T')[0];
      }
    }

    // Show loading state
    document.getElementById('visitorsTableBody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px;">Loading...</td></tr>';

    // Fetch summary stats
    var summaryResp = await fetch('/api/admin/site-visitors?summary=true&start=' + encodeURIComponent(startDate) + '&end=' + encodeURIComponent(endDate));
    var summaryData = await summaryResp.json();

    if (summaryData.success) {
      var s = summaryData.summary;
      document.getElementById('visitorTotalVisits').textContent = s.totalVisits || 0;
      document.getElementById('visitorUniqueCountries').textContent = s.uniqueCountries || 0;
      document.getElementById('visitorReferralVisits').textContent = s.referralVisits || 0;
      document.getElementById('visitorTopDevice').textContent = (s.deviceBreakdown && s.deviceBreakdown[0]) ? s.deviceBreakdown[0].device_type : '—';

      // Top pages
      var pagesHtml = (s.topPages || []).map(function(p) {
        return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">' +
               '<span style="color:var(--text);">' + (p.page_path || '/') + '</span>' +
               '<span style="color:var(--text-muted);">' + p.count + '</span></div>';
      }).join('');
      document.getElementById('visitorTopPages').innerHTML = pagesHtml || '<span style="color:var(--text-muted);font-size:13px;">No data</span>';

      // Top countries
      var countriesHtml = (s.topCountries || []).map(function(c) {
        return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">' +
               '<span style="color:var(--text);">' + (c.country || 'Unknown') + '</span>' +
               '<span style="color:var(--text-muted);">' + c.count + '</span></div>';
      }).join('');
      document.getElementById('visitorTopCountries').innerHTML = countriesHtml || '<span style="color:var(--text-muted);font-size:13px;">No data</span>';

      // Browsers
      var browsersHtml = (s.browserBreakdown || []).map(function(b) {
        return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">' +
               '<span style="color:var(--text);text-transform:capitalize;">' + b.browser + '</span>' +
               '<span style="color:var(--text-muted);">' + b.count + '</span></div>';
      }).join('');
      document.getElementById('visitorBrowsers').innerHTML = browsersHtml || '<span style="color:var(--text-muted);font-size:13px;">No data</span>';

      // OS
      var osHtml = (s.osBreakdown || []).map(function(o) {
        return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">' +
               '<span style="color:var(--text);text-transform:capitalize;">' + o.os + '</span>' +
               '<span style="color:var(--text-muted);">' + o.count + '</span></div>';
      }).join('');
      document.getElementById('visitorOS').innerHTML = osHtml || '<span style="color:var(--text-muted);font-size:13px;">No data</span>';
    }

    // Fetch visitor list
    var listResp = await fetch('/api/admin/site-visitors?start=' + encodeURIComponent(startDate) + '&end=' + encodeURIComponent(endDate));
    var listData = await listResp.json();

    if (listData.success && listData.visitors && listData.visitors.length > 0) {
      var rows = listData.visitors.map(function(v) {
        var date = new Date(v.created_at).toLocaleString();
        return '<tr>' +
          '<td style="white-space:nowrap;">' + date + '</td>' +
          '<td>' + (v.page_path || '/') + '</td>' +
          '<td>' + (v.country || '—') + '</td>' +
          '<td style="text-transform:capitalize;">' + (v.device_type || '—') + '</td>' +
          '<td style="text-transform:capitalize;">' + (v.browser || '—') + '</td>' +
          '<td style="text-transform:capitalize;">' + (v.os || '—') + '</td>' +
          '<td>' + (v.referral_code || '—') + '</td>' +
          '<td>' + (v.external_referrer || '—') + '</td>' +
        '</tr>';
      }).join('');
      document.getElementById('visitorsTableBody').innerHTML = rows;
    } else {
      document.getElementById('visitorsTableBody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px;">No visitor data for this date range.</td></tr>';
    }

  } catch (e) {
    console.error('loadVisitors error:', e);
    document.getElementById('visitorsTableBody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--error);padding:24px;">Failed to load visitor data.</td></tr>';
  }
}

// ---- Auth Check ----
(async function() {
  try {
    var resp = await fetch('/auth/session');
    var data = await resp.json();

    if (!data.authenticated) {
      window.location.href = '/app/auth/founder-login.html';
      return;
    }

    var role = (data.user && data.user.role) ? String(data.user.role) : '';
    // Only DRIV-EN Founder role can access the Owner Dashboard.
    if (role !== 'DRIV-EN Founder') {
      window.location.href = '/app/auth/no-access.html';
      return;
    }

    window.ownerUser = data.user;
    initOwnerDashboard();
  } catch (e) {
    console.error('Auth check failed:', e);
    window.location.href = '/app/auth/founder-login.html';
  }
})();

// ---- Init ----
function initOwnerDashboard() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('dashFooterYear').textContent = new Date().getFullYear();
  updateThemeSwitch();
  loadOwnerLogo();

  // Fill account info in Settings
  var emailEl = document.getElementById('settingsAccountEmail');
  if (emailEl && window.ownerUser) {
    emailEl.textContent = window.ownerUser.email || '—';
  }

  loadPartners();
}

// ---- Tab Switching ----
function switchTab(tabName) {
  document.querySelectorAll('.owner-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.owner-tab-content').forEach(function(c) { c.classList.remove('active'); });
  var tabBtn = document.querySelector('[data-tab="' + tabName + '"]');
  var tabContent = document.getElementById('tab-' + tabName);
  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');

  // Load data when specific tabs are opened
  if (tabName === 'visitors') {
    loadVisitors('30');
  } else if (tabName === 'customers') {
    loadCustomers();
  } else if (tabName === 'system') {
    loadSystemStatus();
  } else if (tabName === 'issues') {
    loadIssues();
  }
}

// ---- Load Partners ----
async function loadPartners() {
  var tbody = document.getElementById('partnersTableBody');
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:40px 0;">Loading…</td></tr>';

  // Clear the search input on refresh
  var searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  try {
    var resp = await fetch('/api/admin/referral-partners');
    var data = await resp.json();

    if (data.success && data.partners) {
      allPartners = data.partners;
      renderStats(data.partners);
      updateSortIndicators();
      renderTable(data.partners);
    } else {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:40px 0;">No referral partners found.</td></tr>';
      if (data.error) showError(data.error);
    }
  } catch (e) {
    console.error('Load partners failed:', e);
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:40px 0;">Failed to load partners.</td></tr>';
    showError('Failed to load partners. Please try refreshing.');
  }
}

// ---- Render Stats ----
function renderStats(partners) {
  var total = partners.length;
  var pending = partners.filter(function(p) { return p.status === 'Pending'; }).length;
  var approved = partners.filter(function(p) { return p.status === 'Approved'; }).length;
  var rejected = partners.filter(function(p) { return p.status === 'Rejected'; }).length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statApproved').textContent = approved;
  document.getElementById('statRejected').textContent = rejected;
}

// ---- Render Table ----
function renderTable(partners) {
  var tbody = document.getElementById('partnersTableBody');
  tbody.innerHTML = '';

  if (partners.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:40px 0;">No referral partners yet.</td></tr>';
    return;
  }

  // Sort using the selected column and direction
  partners = sortPartners(partners);

  partners.forEach(function(p) {
    var row = document.createElement('tr');
    row.dataset.name = (p.partner_name || '').toLowerCase();
    row.dataset.email = (p.partner_email || '').toLowerCase();

    // If partner is Approved but inactive, gray out the row
    if (p.status === 'Approved' && p.active === 0) {
      row.classList.add('partner-row-inactive');
    }

    // Status badge — includes "Inactive" sub-badge for deactivated approved partners
    var statusBadge = '';
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

    // W-9 download
    var w9Cell = '';
    if (p.w9_attachment && !String(p.w9_attachment).startsWith('DEBUG:')) {
      w9Cell = '<button class="owner-action-btn owner-btn-w9" onclick="viewW9(\'' + p.id + '\')">View W-9</button>';
    } else {
      w9Cell = '<span style="color:var(--text-muted);font-size:13px;">No W-9</span>';
    }

    // W-9 status (Current / Expired / None)
    var w9StatusCell = '';
    if (!p.w9_attachment || String(p.w9_attachment).startsWith('DEBUG:')) {
      w9StatusCell = '<span class="dash-badge dash-badge-muted">None</span>';
    } else if (p.w9_expiration_date) {
      var expDate = new Date(p.w9_expiration_date + 'T23:59:59');
      var now = new Date();
      if (expDate < now) {
        w9StatusCell = '<span class="dash-badge dash-badge-danger">Expired</span>';
      } else {
        w9StatusCell = '<span class="dash-badge dash-badge-success">Current</span>';
      }
    } else {
      w9StatusCell = '<span class="dash-badge dash-badge-warning">No Expiry Set</span>';
    }

    // Referral code
    var codeCell = p.referral_code ? '<span style="font-family:monospace;font-weight:600;color:var(--primary);">' + escapeHtml(p.referral_code) + '</span>' : '<span style="color:var(--text-muted);">—</span>';

    // Last referred date — from referral_activity subquery
    var lastReferredCell = '—';
    if (p.last_referred) {
      var lrDate = new Date(p.last_referred);
      lastReferredCell = lrDate.toLocaleDateString();
    }

    // Clickable email link (mailto:)
    var emailCell = p.partner_email
      ? '<a href="mailto:' + escapeHtml(p.partner_email) + '" class="partner-email-link">' + escapeHtml(p.partner_email) + '</a>'
      : '—';

    // Actions — Approve/Reject for Pending, Re-approve for W-9 Review, Activate/Deactivate for Approved
    var actions = '';
    if (p.status === 'Pending') {
      actions = '<button class="owner-action-btn owner-btn-approve" onclick="openApproveModal(\'' + p.id + '\',\'' + escapeJs(p.partner_name) + '\')">Approve</button>';
      actions += '<button class="owner-action-btn owner-btn-reject" onclick="openRejectModal(\'' + p.id + '\',\'' + escapeJs(p.partner_name) + '\')">Reject</button>';
    } else if (p.status === 'Pending W-9 Review') {
      // Owner can re-approve (the partner already has a referral code, so we just set status back to Approved)
      actions = '<button class="owner-action-btn owner-btn-approve" onclick="reapproveW9(\'' + p.id + '\',\'' + escapeJs(p.partner_name) + '\')">Re-Approve</button>';
    } else if (p.status === 'Approved') {
      // Show Activate or Deactivate button depending on current state
      if (p.active === 1) {
        actions = '<button class="owner-action-btn owner-btn-deactivate" onclick="toggleActive(\'' + p.id + '\',\'' + escapeJs(p.partner_name) + '\')">Deactivate</button>';
      } else {
        actions = '<button class="owner-action-btn owner-btn-activate" onclick="toggleActive(\'' + p.id + '\',\'' + escapeJs(p.partner_name) + '\')">Activate</button>';
      }
    } else {
      actions = '<span style="color:var(--text-muted);">—</span>';
    }

    // Date
    var date = p.created_at ? new Date(p.created_at).toLocaleDateString() : '—';

    row.innerHTML =
      '<td>' + escapeHtml(p.partner_name || '—') + '</td>' +
      '<td>' + emailCell + '</td>' +
      '<td>' + escapeHtml(p.partner_phone || '—') + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td>' + codeCell + '</td>' +
      '<td>' + w9Cell + '</td>' +
      '<td>' + w9StatusCell + '</td>' +
      '<td>' + lastReferredCell + '</td>' +
      '<td>' + date + '</td>' +
      '<td>' + actions + '</td>';

    tbody.appendChild(row);
  });
}

// ---- Filter Partners ----
function filterPartners() {
  var query = document.getElementById('searchInput').value.toLowerCase();
  var rows = document.querySelectorAll('#partnersTableBody tr');
  rows.forEach(function(row) {
    var name = row.dataset.name || '';
    var email = row.dataset.email || '';
    if (name.indexOf(query) !== -1 || email.indexOf(query) !== -1) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// ---- Sort By Column ----
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
  document.querySelectorAll('.sortable').forEach(function(th) {
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
    var expDate = new Date(p.w9_expiration_date + 'T23:59:59');
    if (expDate < new Date()) return 1; // Expired
    return 2; // Current
  }
  return 3; // No expiry set
}

function sortPartners(partners) {
  var col = sortColumn;
  var dir = sortDirection === 'asc' ? 1 : -1;
  return partners.slice().sort(function(a, b) {
    var aVal, bVal;
    if (col === 'w9_status') {
      aVal = getW9SortValue(a);
      bVal = getW9SortValue(b);
    } else if (col === 'created_at' || col === 'last_referred') {
      // Both created_at and last_referred are date strings (ISO).
      // Null/empty values sort to the bottom.
      aVal = (a[col] || '');
      bVal = (b[col] || '');
      // When sorting dates, empty values should always be last regardless of direction
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

// ---- W-9 View (opens in new tab) ----
function viewW9(partnerId) {
  window.open('/api/admin/w9-download?partnerId=' + encodeURIComponent(partnerId), '_blank');
}

// ---- Approve Modal ----
function openApproveModal(partnerId, partnerName) {
  currentApprovePartnerId = partnerId;
  document.getElementById('approvePartnerName').textContent = partnerName || '—';
  document.getElementById('approveReferralCode').value = generateReferralCode();
  document.getElementById('approveW9Expiration').value = defaultW9Expiration();
  document.getElementById('approveModal').classList.add('active');
}

function closeApproveModal() {
  document.getElementById('approveModal').classList.remove('active');
  currentApprovePartnerId = null;
}

async function confirmApprove() {
  var partnerId = currentApprovePartnerId;
  var referralCode = document.getElementById('approveReferralCode').value.trim();
  var w9Expiration = document.getElementById('approveW9Expiration').value;

  if (!partnerId) return;
  if (!referralCode) {
    showError('Referral code is required.');
    return;
  }

  var confirmBtn = document.querySelector('#approveModal .owner-modal-confirm');
  confirmBtn.textContent = 'Approving…';
  confirmBtn.disabled = true;

  try {
    var resp = await fetch('/api/admin/referral-partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        partnerId: partnerId,
        referralCode: referralCode,
        w9ExpirationDate: w9Expiration
      })
    });
    var data = await resp.json();

    if (data.success) {
      closeApproveModal();
      loadPartners();
      if (data.emailSent === false) {
        showError('Partner approved, but email failed to send: ' + (data.emailError || 'Unknown error') + '. Temp password: ' + (data.tempPassword || 'N/A'));
      } else {
        showError('');
      }
    } else {
      showError(data.error || 'Failed to approve partner.');
    }
  } catch (e) {
    showError('Network error. Please try again.');
  } finally {
    confirmBtn.textContent = 'Approve Partner';
    confirmBtn.disabled = false;
  }
}

// ---- Reject Modal ----
function openRejectModal(partnerId, partnerName) {
  currentRejectPartnerId = partnerId;
  document.getElementById('rejectPartnerName').textContent = partnerName || '—';
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectModal').classList.add('active');
}

function closeRejectModal() {
  document.getElementById('rejectModal').classList.remove('active');
  currentRejectPartnerId = null;
}

async function confirmReject() {
  var partnerId = currentRejectPartnerId;
  var reason = document.getElementById('rejectReason').value.trim();

  if (!partnerId) return;

  var confirmBtn = document.querySelector('#rejectModal .owner-modal-confirm');
  confirmBtn.textContent = 'Rejecting…';
  confirmBtn.disabled = true;

  try {
    var resp = await fetch('/api/admin/referral-partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reject',
        partnerId: partnerId,
        reason: reason
      })
    });
    var data = await resp.json();

    if (data.success) {
      closeRejectModal();
      loadPartners();
    } else {
      showError(data.error || 'Failed to reject partner.');
    }
  } catch (e) {
    showError('Network error. Please try again.');
  } finally {
    confirmBtn.textContent = 'Reject Partner';
    confirmBtn.disabled = false;
  }
}

// ---- Change Password (Owner Dashboard uses /auth/change-password) ----
function toggleChangePassword() {
  var section = document.getElementById('changePwdSection');
  section.style.display = section.style.display === 'block' ? 'none' : 'block';
}

async function submitChangePassword() {
  var currentPwd = document.getElementById('currentPwd').value;
  var newPwd = document.getElementById('newPwd').value;
  var confirmNewPwd = document.getElementById('confirmNewPwd').value;
  var msgEl = document.getElementById('changePwdMsg');

  if (!currentPwd || !newPwd || !confirmNewPwd) {
    msgEl.innerHTML = '<span style="color:#fca5a5;">All fields are required.</span>';
    return;
  }
  if (newPwd !== confirmNewPwd) {
    msgEl.innerHTML = '<span style="color:#fca5a5;">New passwords do not match.</span>';
    return;
  }
  if (newPwd.length < 8) {
    msgEl.innerHTML = '<span style="color:#fca5a5;">Password must be at least 8 characters.</span>';
    return;
  }

  try {
    var resp = await fetch('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPwd, new_password: newPwd })
    });
    var data = await resp.json();

    if (data.success) {
      msgEl.innerHTML = '<span style="color:#166534;">Password changed successfully!</span>';
      document.getElementById('currentPwd').value = '';
      document.getElementById('newPwd').value = '';
      document.getElementById('confirmNewPwd').value = '';
    } else {
      msgEl.innerHTML = '<span style="color:#fca5a5;">' + (data.error || 'Failed to change password.') + '</span>';
    }
  } catch (e) {
    msgEl.innerHTML = '<span style="color:#fca5a5;">Network error. Please try again.</span>';
  }
}

// ---- Re-Approve W-9 (for Pending W-9 Review partners) ----
// Sets the partner back to Approved with active=1.
// The partner keeps their existing referral code — only the W-9 was renewed.
async function reapproveW9(partnerId, partnerName) {
  if (!confirm('Re-approve ' + partnerName + '? Their referral link will be reactivated.')) return;
  try {
    var resp = await fetch('/api/admin/referral-partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reapprove_w9', partnerId: partnerId })
    });
    var data = await resp.json();
    if (data.success) {
      showError(data.message || 'Partner re-approved');
      loadPartners();
    } else {
      showError(data.error || 'Failed to re-approve');
    }
  } catch (e) {
    showError('Network error. Please try again.');
  }
}

// ---- Activate/Deactivate Toggle (for Approved partners) ----
// Silently toggles the active state of an Approved partner.
// No email is sent. The referrer can still log in when deactivated,
// but their referral link stops working (tracking checks active=1).
async function toggleActive(partnerId, partnerName) {
  if (!confirm('Toggle active state for ' + partnerName + '?')) return;
  try {
    var resp = await fetch('/api/admin/referral-partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_active', partnerId: partnerId })
    });
    var data = await resp.json();
    if (data.success) {
      showError(data.message || 'State toggled');
      loadPartners();
    } else {
      showError(data.error || 'Failed to toggle state');
    }
  } catch (e) {
    showError('Network error. Please try again.');
  }
}

// ---- Helpers ----
function generateReferralCode() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var code = 'DRV-';
  for (var i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function regenerateCode() {
  document.getElementById('approveReferralCode').value = generateReferralCode();
}

function defaultW9Expiration() {
  // W-9 expires on December 31 of the year it was uploaded.
  // A new W-9 is required each calendar year.
  return new Date().getFullYear() + '-12-31';
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeJs(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function showError(msg) {
  var el = document.getElementById('errorBanner');
  if (!msg) { el.style.display = 'none'; return; }
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 6000);
}

// =========================================================================
// CUSTOMERS TAB LOGIC
// =========================================================================

var allCustomers = [];

// ---- Load Customers ----
async function loadCustomers() {
  var listEl = document.getElementById('customerList');
  listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">Loading customers…</div>';

  try {
    var resp = await fetch('/api/admin/customers');
    var data = await resp.json();

    if (data.success && data.customers) {
      allCustomers = data.customers;
      renderCustomerStats(data.customers);
      renderCustomers(data.customers);
    } else {
      listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><p>' + (data.error || 'No customers found.') + '</p></div>';
    }
  } catch (e) {
    listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><p>Failed to load customers. The /api/admin/customers endpoint may not be deployed yet.</p></div>';
  }
}

function renderCustomerStats(customers) {
  var total = customers.length;
  var active = customers.filter(function(c) { return c.subscription_status === 'active'; }).length;
  var trial = customers.filter(function(c) { return c.subscription_status === 'trial' || c.subscription_status === 'trialing'; }).length;
  var pending = customers.filter(function(c) { return !c.subscription_status || c.subscription_status === 'pending' || c.subscription_status === 'inactive'; }).length;

  document.getElementById('custStatTotal').textContent = total;
  document.getElementById('custStatActive').textContent = active;
  document.getElementById('custStatTrial').textContent = trial;
  document.getElementById('custStatPending').textContent = pending;
}

function renderCustomers(customers) {
  var listEl = document.getElementById('customerList');

  if (customers.length === 0) {
    listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><p>No customers yet. When organizations sign up, they will appear here.</p></div>';
    return;
  }

  var html = customers.map(function(c) {
    var status = c.subscription_status || 'none';
    var badgeClass = 'sub-none';
    var badgeText = 'None';
    if (status === 'active') { badgeClass = 'sub-active'; badgeText = 'Active'; }
    else if (status === 'trial' || status === 'trialing') { badgeClass = 'sub-trial'; badgeText = 'Trial'; }
    else if (status === 'pending') { badgeClass = 'sub-pending'; badgeText = 'Pending'; }
    else if (status === 'cancelled' || status === 'canceled') { badgeClass = 'sub-cancelled'; badgeText = 'Cancelled'; }

    var date = c.created_at ? new Date(c.created_at).toLocaleDateString() : '—';

    return '<div class="customer-card" data-name="' + escapeHtml((c.company_name || c.organization_name || c.name || '').toLowerCase()) + '" data-email="' + escapeHtml((c.contact_email || c.email || '').toLowerCase()) + '">' +
      '<div class="customer-card-info">' +
        '<h4>' + escapeHtml(c.company_name || c.organization_name || c.name || 'Unknown') + '</h4>' +
        '<p>' + escapeHtml(c.contact_email || c.email || '—') + (c.contact_name ? ' · ' + escapeHtml(c.contact_name) : '') + '</p>' +
      '</div>' +
      '<div class="customer-card-meta">' +
        '<span class="customer-sub-badge ' + badgeClass + '">' + badgeText + '</span>' +
        (c.subscription_amount ? '<span style="font-size:13px;color:var(--text-muted);">$' + escapeHtml(String(c.subscription_amount)) + '/mo</span>' : '') +
        '<span style="font-size:13px;color:var(--text-muted);">Joined: ' + date + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  listEl.innerHTML = html;
}

function filterCustomers() {
  var query = document.getElementById('customerSearchInput').value.toLowerCase();
  var cards = document.querySelectorAll('#customerList .customer-card');
  cards.forEach(function(card) {
    var name = card.dataset.name || '';
    var email = card.dataset.email || '';
    card.style.display = (name.indexOf(query) !== -1 || email.indexOf(query) !== -1) ? '' : 'none';
  });
}

// =========================================================================
// SYSTEM STATUS TAB LOGIC
// =========================================================================

// ---- Load System Status ----
async function loadSystemStatus() {
  document.getElementById('sysLastCheck').textContent = new Date().toLocaleString();

  var endpoints = [
    { id: 'sysWorkerAuth', url: '/auth/session', label: 'Auth Worker' },
    { id: 'sysWorkerReferral', url: '/referral/session', label: 'Referral API' },
    { id: 'sysWorkerCheckout', url: '/api/health', label: 'Checkout' },
    { id: 'sysPagesFunctions', url: '/api/admin/referral-partners', label: 'Pages Functions' }
  ];

  for (var i = 0; i < endpoints.length; i++) {
    var ep = endpoints[i];
    var el = document.getElementById(ep.id);
    if (!el) continue;

    el.textContent = 'Checking...';
    try {
      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 5000);
      var resp = await fetch(ep.url, { signal: controller.signal });
      clearTimeout(timeout);
      el.textContent = 'OK (' + resp.status + ')';
      el.parentElement.querySelector('.sys-status-dot').className = 'sys-status-dot sys-dot-ok';
    } catch (e) {
      el.textContent = 'Unreachable';
      el.parentElement.querySelector('.sys-status-dot').className = 'sys-status-dot sys-dot-warn';
    }
  }

  // D1 — referral_partners count
  try {
    var resp = await fetch('/api/admin/referral-partners');
    var data = await resp.json();
    if (data.success && data.partners) {
      document.getElementById('sysD1Partners').textContent = data.partners.length + ' rows';
    }
  } catch (e) {
    document.getElementById('sysD1Partners').textContent = 'Unable to count';
  }

  // D1 — site_visitors count
  try {
    var vResp = await fetch('/api/admin/site-visitors?summary=true');
    var vData = await vResp.json();
    if (vData.success && vData.summary) {
      document.getElementById('sysD1Visitors').textContent = (vData.summary.totalVisits || 0) + ' rows';
    }
  } catch (e) {
    document.getElementById('sysD1Visitors').textContent = 'Unable to count';
  }

  // D1 — referral_activity count
  try {
    var pResp = await fetch('/api/admin/referral-partners');
    var pData = await pResp.json();
    if (pData.success && pData.partners) {
      var withActivity = pData.partners.filter(function(p) { return p.last_referred; }).length;
      document.getElementById('sysD1Activity').textContent = withActivity + ' partners with activity';
    }
  } catch (e) {
    document.getElementById('sysD1Activity').textContent = 'Unable to count';
  }

  document.getElementById('sysD1Users').textContent = '— (not yet queried)';
  document.getElementById('sysR2W9').textContent = '— (not yet queried)';
}

// =========================================================================
// ISSUES TAB LOGIC
// =========================================================================

var allIssues = [];

// ---- Load Issues ----
async function loadIssues() {
  var listEl = document.getElementById('issueList');
  listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">Loading issues...</div>';

  try {
    var resp = await fetch('/api/admin/issues');
    var data = await resp.json();

    if (data.success && data.issues && data.issues.length > 0) {
      allIssues = data.issues;
      renderIssueStats(data.issues);
      renderIssues(data.issues);
    } else if (data.success && data.issues && data.issues.length === 0) {
      allIssues = [];
      renderIssueStats([]);
      listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><h3>No Issues</h3><p>No errors have been logged. Everything looks good.</p></div>';
    } else {
      allIssues = [];
      renderIssueStats([]);
      listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><h3>Issues Log Not Yet Available</h3><p>The error log table needs to be created in D1. Run this SQL in D1 -> driv-en-db -> Query:</p>' +
        '<pre style="text-align:left;background:var(--bg-input);padding:16px;border-radius:8px;font-size:13px;overflow-x:auto;margin-top:12px;">CREATE TABLE IF NOT EXISTS error_log (\n  id TEXT PRIMARY KEY,\n  source TEXT,\n  error_message TEXT,\n  stack_trace TEXT,\n  severity TEXT DEFAULT \'error\',\n  resolved INTEGER DEFAULT 0,\n  created_at TEXT\n);</pre>' +
        '<p style="margin-top:12px;">Then create the /api/admin/issues Pages Function to query it.</p></div>';
    }
  } catch (e) {
    allIssues = [];
    renderIssueStats([]);
    listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><h3>Issues Log Not Yet Available</h3><p>The /api/admin/issues endpoint is not deployed yet. Once the error_log table and API are created, errors from all Workers and Pages Functions will appear here.</p></div>';
  }
}

function renderIssueStats(issues) {
  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  var weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  document.getElementById('issueStatTotal').textContent = issues.length;
  document.getElementById('issueStatToday').textContent = issues.filter(function(i) { return i.created_at >= todayStart; }).length;
  document.getElementById('issueStatWeek').textContent = issues.filter(function(i) { return i.created_at >= weekStart; }).length;
  document.getElementById('issueStatResolved').textContent = issues.filter(function(i) { return i.resolved === 1; }).length;
}

function renderIssues(issues) {
  var listEl = document.getElementById('issueList');

  if (issues.length === 0) {
    listEl.innerHTML = '<div class="owner-coming-soon" style="padding:40px 0;"><h3>No Issues</h3><p>No errors have been logged. Everything looks good.</p></div>';
    return;
  }

  var html = issues.map(function(i) {
    var time = i.created_at ? new Date(i.created_at).toLocaleString() : '—';
    var severity = i.severity || 'error';
    var borderColor = severity === 'warning' ? '#f59e0b' : '#ef4444';

    return '<div class="issue-card" style="border-left-color:' + borderColor + ';" data-search="' + escapeHtml((i.error_message || '').toLowerCase() + ' ' + (i.source || '').toLowerCase()) + '">' +
      '<div class="issue-card-header">' +
        '<div class="issue-card-title">' + escapeHtml(i.error_message || 'Unknown error') + '</div>' +
        '<div class="issue-card-time">' + time + '</div>' +
      '</div>' +
      '<span class="issue-card-source">' + escapeHtml(i.source || 'unknown') + '</span>' +
      (i.stack_trace ? '<div class="issue-card-body">' + escapeHtml(i.stack_trace) + '</div>' : '') +
    '</div>';
  }).join('');

  listEl.innerHTML = html;
}

function filterIssues() {
  var query = document.getElementById('issueSearchInput').value.toLowerCase();
  var cards = document.querySelectorAll('#issueList .issue-card');
  cards.forEach(function(card) {
    var searchText = card.dataset.search || '';
    card.style.display = searchText.indexOf(query) !== -1 ? '' : 'none';
  });
}

// =========================================================================
// LOGOUT
// =========================================================================

// ---- Logout ----
async function ownerLogout() {
  try {
    await fetch('/auth/logout', { method: 'POST' });
  } catch (e) { /* ignore */ }
  window.location.href = '/app/auth/founder-login.html';
}

// ---- Close modals on overlay click ----
document.getElementById('approveModal').addEventListener('click', function(e) {
  if (e.target === this) closeApproveModal();
});
document.getElementById('rejectModal').addEventListener('click', function(e) {
  if (e.target === this) closeRejectModal();
});
