/* ==========================================================================
   REFERRER DASHBOARD — OVERVIEW TAB ENHANCEMENT
   ==========================================================================
   PURPOSE: Makes the Overview tab the single place for a referrer to see
   everything happening at a glance:
     - Commission summary (total earned, payable, pending, paid)
     - Referral activity summary (total, converted, pending)
     - W-9 status (current, expiring, expired)
     - Payment info status (ACH on file or not)
     - Action items (what needs attention)

   This file provides the JavaScript that loads and renders the commission
   data into the Overview tab. It calls the existing /referral/commissions
   and /referral/activity endpoints.

   USAGE: Add this to referrer-dashboard.html, inside the Overview tab panel:
     <script src="/assets/js/referrer-overview.js"></script>

   The Overview tab should have these placeholder divs:
     <div id="overview-commissions"></div>
     <div id="overview-activity"></div>
     <div id="overview-w9-status"></div>
     <div id="overview-payment-status"></div>
     <div id="overview-action-items"></div>
   ========================================================================== */

(function () {
  'use strict';

  async function loadOverviewData() {
    try {
      var [commRes, actRes, profRes] = await Promise.all([
        fetch('/referral/commissions', { credentials: 'include' }),
        fetch('/referral/activity', { credentials: 'include' }),
        fetch('/referral/profile', { credentials: 'include' })
      ]);

      var commissions = commRes.ok ? await commRes.json() : { success: false };
      var activity = actRes.ok ? await actRes.json() : { success: false };
      var profile = profRes.ok ? await profRes.json() : { success: false };

      renderCommissionSummary(commissions);
      renderActivitySummary(activity);
      renderW9Status(profile);
      renderActionItems(commissions, activity, profile);
    } catch (err) {
      console.error('Overview load error:', err);
      if (window.DRIVENErrorHandler) {
        DRIVENErrorHandler.report('Failed to load overview data', 'referrer-overview', err.stack);
      }
    }
  }

  function fmtMoney(n) {
    return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderCommissionSummary(data) {
    var container = document.getElementById('overview-commissions');
    if (!container) return;
    if (!data.success) {
      container.innerHTML = '<p style="color:#999;">Unable to load commission data.</p>';
      return;
    }

    var c = data.commissions || {};
    container.innerHTML = '\n      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">\n        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;">\n          <div style="font-size:12px;color:#666;text-transform:uppercase;font-weight:600;">Lifetime Earned</div>\n          <div style="font-size:22px;font-weight:700;color:#00b140;margin-top:4px;">' + fmtMoney(c.lifetime_earned) + '</div>\n        </div>\n        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px;">\n          <div style="font-size:12px;color:#666;text-transform:uppercase;font-weight:600;">Payable Now</div>\n          <div style="font-size:22px;font-weight:700;color:#ca8a04;margin-top:4px;">' + fmtMoney(c.total_payable) + '</div>\n        </div>\n        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;">\n          <div style="font-size:12px;color:#666;text-transform:uppercase;font-weight:600;">Pending</div>\n          <div style="font-size:22px;font-weight:700;color:#2563eb;margin-top:4px;">' + fmtMoney(c.total_pending) + '</div>\n        </div>\n        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;">\n          <div style="font-size:12px;color:#666;text-transform:uppercase;font-weight:600;">Total Paid</div>\n          <div style="font-size:22px;font-weight:700;color:#00b140;margin-top:4px;">' + fmtMoney(c.total_paid) + '</div>\n        </div>\n      </div>\n    ';
  }

  function renderActivitySummary(data) {
    var container = document.getElementById('overview-activity');
    if (!container) return;
    if (!data.success) {
      container.innerHTML = '<p style="color:#999;">Unable to load activity data.</p>';
      return;
    }

    var activities = data.activity || [];
    var total = activities.length;
    var converted = activities.filter(function (a) { return a.referral_status === 'Converted'; }).length;
    var pending = activities.filter(function (a) { return a.referral_status && a.referral_status !== 'Converted' && a.referral_status !== 'Lost'; }).length;

    var recent = activities.slice(0, 3);
    var recentHtml = recent.map(function (a) {
      var statusColor = a.referral_status === 'Converted' ? '#00b140' : '#ca8a04';
      return '\n        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee;">\n          <div>\n            <div style="font-weight:600;font-size:14px;">' + (a.customer_contact_name || 'Unknown') + '</div>\n            <div style="font-size:12px;color:#999;">' + (a.referral_date || '') + '</div>\n          </div>\n          <div style="text-align:right;">\n            <span style="font-size:12px;font-weight:600;color:' + statusColor + ';padding:2px 8px;border-radius:4px;background:' + statusColor + '15;">' + (a.referral_status || 'Pending') + '</span>\n            ' + (a.commission_amount ? '<div style="font-size:13px;font-weight:600;margin-top:2px;">' + fmtMoney(a.commission_amount) + '</div>' : '') + '\n          </div>\n        </div>\n      ';
    }).join('');

    container.innerHTML = '\n      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">\n        <div style="text-align:center;padding:10px;background:#f8fafc;border-radius:8px;">\n          <div style="font-size:24px;font-weight:700;color:#333;">' + total + '</div>\n          <div style="font-size:12px;color:#666;">Total Referrals</div>\n        </div>\n        <div style="text-align:center;padding:10px;background:#f0fdf4;border-radius:8px;">\n          <div style="font-size:24px;font-weight:700;color:#00b140;">' + converted + '</div>\n          <div style="font-size:12px;color:#666;">Converted</div>\n        </div>\n        <div style="text-align:center;padding:10px;background:#fefce8;border-radius:8px;">\n          <div style="font-size:24px;font-weight:700;color:#ca8a04;">' + pending + '</div>\n          <div style="font-size:12px;color:#666;">In Progress</div>\n        </div>\n      </div>\n      ' + (recentHtml ? '<div style="margin-top:12px;"><div style="font-size:13px;font-weight:600;color:#666;margin-bottom:8px;">Recent Activity</div>' + recentHtml + '</div>' : '<p style="color:#999;font-size:13px;">No referrals yet.</p>') + '\n      ' + (total > 3 ? '<div style="text-align:center;margin-top:8px;"><button class="tab-btn" data-tab="activity" style="color:#00b140;font-size:13px;background:none;border:none;cursor:pointer;">View All Activity →</button></div>' : '') + '\n    ';
  }

  function renderW9Status(profile) {
    var container = document.getElementById('overview-w9-status');
    if (!container) return;
    if (!profile.success) {
      container.innerHTML = '<p style="color:#999;">Unable to load W-9 status.</p>';
      return;
    }

    var p = profile.profile || {};
    var hasW9 = p.w9_attachment ? true : false;
    var expDate = p.w9_expiration_date ? new Date(p.w9_expiration_date) : null;
    var now = new Date();
    var daysUntilExp = expDate ? Math.floor((expDate - now) / (1000 * 60 * 60 * 24)) : null;
    var status = 'none';
    var statusColor = '#cc0000';
    var statusText = 'No W-9 on file';

    if (hasW9 && expDate) {
      if (daysUntilExp < 0) {
        status = 'expired';
        statusColor = '#cc0000';
        statusText = 'Expired ' + expDate.toLocaleDateString();
      } else if (daysUntilExp <= 30) {
        status = 'expiring';
        statusColor = '#ca8a04';
        statusText = 'Expires in ' + daysUntilExp + ' days';
      } else {
        status = 'valid';
        statusColor = '#00b140';
        statusText = 'Valid until ' + expDate.toLocaleDateString();
      }
    } else if (hasW9) {
      status = 'valid';
      statusColor = '#00b140';
      statusText = 'On file (no expiration)';
    }

    container.innerHTML = '\n      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#f8fafc;border-radius:8px;">\n        <div>\n          <div style="font-weight:600;font-size:14px;">W-9 Status</div>\n          <div style="font-size:13px;color:' + statusColor + ';margin-top:2px;">' + statusText + '</div>\n        </div>\n        <div style="font-size:28px;">' + (status === 'valid' ? '✅' : status === 'expiring' ? '⚠️' : status === 'expired' ? '❌' : '📄') + '</div>\n      </div>\n    ';
  }

  function renderActionItems(commData, actData, profData) {
    var container = document.getElementById('overview-action-items');
    if (!container) return;

    var items = [];

    if (profData.success) {
      var p = profData.profile || {};
      if (!p.w9_attachment) {
        items.push({ priority: 'high', text: 'Upload your W-9 form to become eligible for commission payments', tab: 'w9' });
      } else if (p.w9_expiration_date) {
        var expDate = new Date(p.w9_expiration_date);
        var daysUntilExp = Math.floor((expDate - new Date()) / (1000 * 60 * 60 * 24));
        if (daysUntilExp < 0) {
          items.push({ priority: 'high', text: 'Your W-9 has expired — please upload a renewed W-9', tab: 'w9' });
        } else if (daysUntilExp <= 30) {
          items.push({ priority: 'medium', text: 'Your W-9 expires in ' + daysUntilExp + ' days — renew soon', tab: 'w9' });
        }
      }
    }

    if (commData.success) {
      var c = commData.commissions || {};
      if (c.total_payable > 0) {
        items.push({ priority: 'medium', text: 'You have ' + fmtMoney(c.total_payable) + ' in payable commissions', tab: 'commissions' });
      }
      if (c.total_pending > 0) {
        items.push({ priority: 'low', text: c.total_pending + ' in pending commissions (awaiting qualification period)', tab: 'commissions' });
      }
    }

    if (actData.success) {
      var activities = actData.activity || [];
      if (activities.length === 0) {
        items.push({ priority: 'low', text: 'No referrals yet — start sharing DRIV-EN with potential customers', tab: 'activity' });
      }
    }

    if (items.length === 0) {
      container.innerHTML = '<div style="padding:12px;background:#f0fdf4;border-radius:8px;color:#00b140;font-size:14px;">✅ Everything is up to date — no action needed.</div>';
      return;
    }

    var priorityOrder = { high: 0, medium: 1, low: 2 };
    items.sort(function (a, b) { return priorityOrder[a.priority] - priorityOrder[b.priority]; });

    var html = items.map(function (item) {
      var color = item.priority === 'high' ? '#cc0000' : item.priority === 'medium' ? '#ca8a04' : '#666';
      var bg = item.priority === 'high' ? '#fef2f2' : item.priority === 'medium' ? '#fefce8' : '#f8fafc';
      var icon = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🔵';
      return '\n        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:' + bg + ';border-radius:8px;margin-bottom:8px;cursor:pointer;"\n             onclick="document.querySelector(\'.tab-btn[data-tab=' + item.tab + ']\')?.click()">\n          <span style="font-size:14px;flex-shrink:0;">' + icon + '</span>\n          <span style="font-size:13px;color:' + color + ';">' + item.text + '</span>\n        </div>\n      ';
    }).join('');

    container.innerHTML = '<div style="font-size:13px;font-weight:600;color:#666;margin-bottom:8px;">Action Items</div>' + html;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadOverviewData);
  } else {
    loadOverviewData();
  }
})();
