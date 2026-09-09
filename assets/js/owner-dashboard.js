/* ==========================================================================
   OWNER DASHBOARD — ALL TABS DATA LOADER
   ==========================================================================
   PURPOSE: Fetches data from /api/admin/* endpoints and renders all tabs:
     - System Status (stats)
     - Referrers (referrers)
     - Error Logs (error-logs)
     - Site Visitors (visitors)
     - Customers (customers — uses owner-customers.js separately)
     - Settings (team members — uses auth worker /auth/team-members)

   USAGE: Add to owner-dashboard.html:
     <script src="/assets/js/owner-dashboard.js"></script>
   ========================================================================== */

(function () {
  'use strict';

  function fmtMoney(n) {
    return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return d; }
  }

  function fmtDateTime(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return d; }
  }

  async function loadStats() {
    var container = document.getElementById('stats-content');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Loading system status...</div>';
    try {
      var res = await fetch('/api/admin/stats', { credentials: 'include' });
      var data = await res.json();
      if (!data.success) { container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">' + (data.error || 'Failed to load stats') + '</div>'; return; }
      renderStats(data.stats);
    } catch (err) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">Failed to load. The DRIV-EN team has been notified.</div>';
      if (window.DRIVENErrorHandler) DRIVENErrorHandler.report('Failed to load stats', 'owner-dashboard-stats', err.stack);
    }
  }

  function renderStats(s) {
    var container = document.getElementById('stats-content');
    if (!container) return;
    var healthColor = s.system_status === 'operational' ? '#00b140' : '#ca8a04';
    container.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">' +
        '<div style="font-size:32px;">✅</div>' +
        '<div><div style="font-size:18px;font-weight:700;color:' + healthColor + ';">System Status: Operational</div>' +
        '<div style="font-size:13px;color:#666;">Last updated: ' + fmtDateTime(s.last_updated) + '</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px;">' +
        statCard('Customers', s.customers, '#2563eb', s.active_customers + ' active') +
        statCard('Organizations', s.organizations, '#7c3aed') +
        statCard('Referral Partners', s.referral_partners, '#00b140', s.active_partners + ' active') +
        statCard('Site Visitors', s.site_visitors, '#ea580c', s.visitors_last_24h + ' today') +
        statCard('Orders', s.orders, '#0891b2', s.orders_last_30d + ' last 30d') +
        statCard('Subscriptions', s.subscriptions, '#4f46e5') +
        statCard('Total Revenue', fmtMoney(s.total_revenue), '#00b140') +
        statCard('Error Logs', s.error_logs, '#cc0000', s.unresolved_errors + ' unresolved') +
        statCard('Users', s.users, '#64748b') +
      '</div>';
  }

  function statCard(title, value, color, subtitle) {
    return '<div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:16px;">' +
      '<div style="font-size:12px;color:#666;text-transform:uppercase;font-weight:600;">' + title + '</div>' +
      '<div style="font-size:24px;font-weight:700;color:' + (color || '#333') + ';margin-top:4px;">' + value + '</div>' +
      (subtitle ? '<div style="font-size:11px;color:#999;margin-top:2px;">' + subtitle + '</div>' : '') +
    '</div>';
  }

  async function loadReferrers() {
    var container = document.getElementById('referrers-content');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Loading referrers...</div>';
    try {
      var res = await fetch('/api/admin/referrers', { credentials: 'include' });
      var data = await res.json();
      if (!data.success) { container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">' + (data.error || 'Failed to load referrers') + '</div>'; return; }
      renderReferrers(data.referrers);
    } catch (err) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">Failed to load. The DRIV-EN team has been notified.</div>';
      if (window.DRIVENErrorHandler) DRIVENErrorHandler.report('Failed to load referrers', 'owner-dashboard-referrers', err.stack);
    }
  }

  function renderReferrers(referrers) {
    var container = document.getElementById('referrers-content');
    if (!container) return;
    if (!referrers || referrers.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">No referral partners found.</div>';
      return;
    }
    var rows = referrers.map(function (r) {
      var isActive = r.active === 1 || r.partner_status === 'Active';
      var w9Status = !r.w9_attachment ? '<span style="color:#cc0000;">Missing</span>' :
        (r.w9_expiration_date && new Date(r.w9_expiration_date) < new Date()) ? '<span style="color:#cc0000;">Expired</span>' :
        '<span style="color:#00b140;">Valid</span>';
      return '<tr style="border-bottom:1px solid #eee;">' +
        '<td style="padding:10px 12px;font-weight:600;">' + (r.partner_name || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (r.partner_email || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (r.partner_phone || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (r.company_referred || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (r.referral_code || '—') + '</td>' +
        '<td style="padding:10px 12px;">' + (isActive ? '<span style="color:#00b140;font-weight:600;">Active</span>' : '<span style="color:#cc0000;font-weight:600;">Inactive</span>') + '</td>' +
        '<td style="padding:10px 12px;">' + w9Status + '</td>' +
        '<td style="padding:10px 12px;text-align:center;">' + (r.referral_count || 0) + '</td>' +
        '<td style="padding:10px 12px;text-align:center;">' + (r.converted_count || 0) + '</td>' +
        '<td style="padding:10px 12px;text-align:right;font-weight:600;">' + fmtMoney(r.total_commission_earned) + '</td>' +
        '<td style="padding:10px 12px;text-align:right;font-weight:600;">' + fmtMoney(r.total_commission_payable) + '</td>' +
        '<td style="padding:10px 12px;font-size:12px;color:#999;">' + fmtDate(r.created_at) + '</td>' +
      '</tr>';
    }).join('');
    container.innerHTML =
      '<div style="font-size:16px;font-weight:600;margin-bottom:16px;">Referral Partners (' + referrers.length + ')</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="background:#f8fafc;border-bottom:2px solid #e0e0e0;">' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Name</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Email</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Phone</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Company Referred</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Code</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Status</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">W-9</th>' +
          '<th style="padding:10px 12px;text-align:center;font-size:12px;color:#666;text-transform:uppercase;">Referrals</th>' +
          '<th style="padding:10px 12px;text-align:center;font-size:12px;color:#666;text-transform:uppercase;">Converted</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;text-transform:uppercase;">Total Earned</th>' +
          '<th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;text-transform:uppercase;">Payable</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Joined</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  async function loadErrorLogs() {
    var container = document.getElementById('error-logs-content');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Loading error logs...</div>';
    try {
      var res = await fetch('/api/admin/error-logs?limit=50', { credentials: 'include' });
      var data = await res.json();
      if (!data.success) { container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">' + (data.error || 'Failed to load error logs') + '</div>'; return; }
      renderErrorLogs(data.error_logs);
    } catch (err) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">Failed to load. The DRIV-EN team has been notified.</div>';
      if (window.DRIVENErrorHandler) DRIVENErrorHandler.report('Failed to load error logs', 'owner-dashboard-errors', err.stack);
    }
  }

  function renderErrorLogs(logs) {
    var container = document.getElementById('error-logs-content');
    if (!container) return;
    if (!logs || logs.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#00b140;">✅ No errors logged.</div>';
      return;
    }
    var rows = logs.map(function (log) {
      var severityColor = log.severity === 'critical' ? '#cc0000' : log.severity === 'warning' ? '#ca8a04' : '#666';
      var resolvedBadge = log.resolved ? '<span style="color:#00b140;font-weight:600;">Resolved</span>' : '<span style="color:#cc0000;font-weight:600;">Unresolved</span>';
      return '<tr style="border-bottom:1px solid #eee;cursor:pointer;" onclick="window.OWNER_DASH.toggleErrorDetail(\'' + log.id + '\')">' +
        '<td style="padding:10px 12px;font-size:12px;color:#999;">' + fmtDateTime(log.created_at) + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;font-weight:600;color:' + severityColor + ';">' + (log.severity || 'error') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (log.source || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (log.error_message || '—') + '</td>' +
        '<td style="padding:10px 12px;">' + resolvedBadge + '</td>' +
      '</tr>' +
      '<tr id="error-detail-' + log.id + '" style="display:none;">' +
        '<td colspan="5" style="padding:16px;background:#f8fafc;"><pre style="font-size:12px;white-space:pre-wrap;max-height:300px;overflow-y:auto;background:#fff;padding:12px;border-radius:6px;border:1px solid #e0e0e0;">' + (log.stack_trace || 'No stack trace') + '</pre></td>' +
      '</tr>';
    }).join('');
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<div style="font-size:16px;font-weight:600;">Error Logs (' + logs.length + ')</div>' +
        '<button onclick="window.OWNER_DASH.refreshErrorLogs()" style="padding:8px 16px;background:#00b140;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;">Refresh</button>' +
      '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="background:#f8fafc;border-bottom:2px solid #e0e0e0;">' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Time</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Severity</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Source</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Message</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Status</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  async function loadVisitors() {
    var container = document.getElementById('visitors-content');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Loading visitors...</div>';
    try {
      var res = await fetch('/api/admin/visitors?limit=50', { credentials: 'include' });
      var data = await res.json();
      if (!data.success) { container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">' + (data.error || 'Failed to load visitors') + '</div>'; return; }
      renderVisitors(data.visitors);
    } catch (err) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">Failed to load. The DRIV-EN team has been notified.</div>';
      if (window.DRIVENErrorHandler) DRIVENErrorHandler.report('Failed to load visitors', 'owner-dashboard-visitors', err.stack);
    }
  }

  function renderVisitors(visitors) {
    var container = document.getElementById('visitors-content');
    if (!container) return;
    if (!visitors || visitors.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">No visitor data found.</div>';
      return;
    }
    var rows = visitors.map(function (v) {
      return '<tr style="border-bottom:1px solid #eee;">' +
        '<td style="padding:10px 12px;font-size:12px;color:#999;">' + fmtDateTime(v.created_at) + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (v.page_path || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (v.country || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (v.device_type || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (v.browser || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (v.os || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (v.referral_code || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (v.utm_source || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (v.time_on_page || '—') + '</td>' +
      '</tr>';
    }).join('');
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<div style="font-size:16px;font-weight:600;">Site Visitors (' + visitors.length + ')</div>' +
        '<button onclick="window.OWNER_DASH.refreshVisitors()" style="padding:8px 16px;background:#00b140;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;">Refresh</button>' +
      '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="background:#f8fafc;border-bottom:2px solid #e0e0e0;">' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Time</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Page</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Country</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Device</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Browser</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">OS</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Ref Code</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">UTM Source</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Time on Page</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  async function loadLogo() {
    try {
      var res = await fetch('/auth/get-logo', { credentials: 'include' });
      var data = await res.json();
      if (data.success && data.logo) {
        var logoImg = document.getElementById('dsi-logo') || document.getElementById('logo-img') || document.getElementById('company-logo');
        if (logoImg) { logoImg.src = data.logo; logoImg.style.display = 'block'; }
      }
    } catch (err) { console.error('Logo load error:', err); }
  }

  async function loadTeamMembers() {
    var container = document.getElementById('team-members-content') || document.getElementById('settings-content');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Loading team members...</div>';
    try {
      var res = await fetch('/auth/team-members', { credentials: 'include' });
      var data = await res.json();
      if (!data.success) { container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">' + (data.error || 'Failed to load team members') + '</div>'; return; }
      renderTeamMembers(data.members || data.team_members || []);
    } catch (err) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">Failed to load. The DRIV-EN team has been notified.</div>';
      if (window.DRIVENErrorHandler) DRIVENErrorHandler.report('Failed to load team members', 'owner-dashboard-settings', err.stack);
    }
  }

  function renderTeamMembers(members) {
    var container = document.getElementById('team-members-content') || document.getElementById('settings-content');
    if (!container) return;
    if (!members || members.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">No team members found.</div>';
      return;
    }
    var rows = members.map(function (m) {
      var isActive = m.is_active === 1 || m.is_active === true;
      var fullName = m.full_name || ((m.first_name || '') + ' ' + (m.last_name || '')).trim() || m.email;
      return '<tr style="border-bottom:1px solid #eee;">' +
        '<td style="padding:10px 12px;font-weight:600;">' + fullName + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (m.email || '—') + '</td>' +
        '<td style="padding:10px 12px;">' + (isActive ? '<span style="color:#00b140;font-weight:600;">Active</span>' : '<span style="color:#cc0000;font-weight:600;">Inactive</span>') + '</td>' +
        '<td style="padding:10px 12px;font-size:12px;color:#999;">' + fmtDate(m.last_login) + '</td>' +
        '<td style="padding:10px 12px;font-size:12px;color:#999;">' + fmtDate(m.created_at) + '</td>' +
        '<td style="padding:10px 12px;"><button onclick="window.OWNER_DASH.toggleMember(\'' + m.id + '\')" style="padding:6px 12px;font-size:12px;border:1px solid #ddd;border-radius:4px;cursor:pointer;background:' + (isActive ? '#fef2f2' : '#f0fdf4') + ';color:' + (isActive ? '#cc0000' : '#00b140') + ';">' + (isActive ? 'Deactivate' : 'Activate') + '</button></td>' +
      '</tr>';
    }).join('');
    container.innerHTML =
      '<div style="font-size:16px;font-weight:600;margin-bottom:8px;">Team Members</div>' +
      '<div style="font-size:13px;color:#666;margin-bottom:16px;">Only Jackie Blood can add or manage team members. Members can be deactivated but not deleted.</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="background:#f8fafc;border-bottom:2px solid #e0e0e0;">' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Name</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Email</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Status</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Last Login</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Joined</th>' +
          '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Actions</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  async function toggleMember(memberId) {
    try {
      var res = await fetch('/auth/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active', memberId: memberId }),
        credentials: 'include'
      });
      var data = await res.json();
      if (data.success) { loadTeamMembers(); } else { alert(data.error || 'Failed to update team member'); }
    } catch (err) { alert('Failed to update team member'); }
  }

  function toggleErrorDetail(errorId) {
    var row = document.getElementById('error-detail-' + errorId);
    if (row) { row.style.display = row.style.display === 'none' ? 'table-row' : 'none'; }
  }

  function init() {
    loadLogo();
    loadStats();
    var tabButtons = document.querySelectorAll('.tab-btn');
    var loaded = { stats: false, referrers: false, 'error-logs': false, visitors: false, customers: false, settings: false };
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        if (!tab) return;
        if (tab === 'stats' && !loaded.stats) { loaded.stats = true; loadStats(); }
        if (tab === 'referrers' && !loaded.referrers) { loaded.referrers = true; loadReferrers(); }
        if (tab === 'error-logs' && !loaded['error-logs']) { loaded['error-logs'] = true; loadErrorLogs(); }
        if (tab === 'visitors' && !loaded.visitors) { loaded.visitors = true; loadVisitors(); }
        if (tab === 'customers' && !loaded.customers) { loaded.customers = true; if (window.OWNER_CUSTOMERS) OWNER_CUSTOMERS.load(); }
        if (tab === 'settings' && !loaded.settings) { loaded.settings = true; loadTeamMembers(); }
      });
    });
  }

  window.OWNER_DASH = {
    toggleErrorDetail: toggleErrorDetail,
    refreshErrorLogs: loadErrorLogs,
    refreshVisitors: loadVisitors,
    toggleMember: toggleMember,
    loadTeamMembers: loadTeamMembers
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
