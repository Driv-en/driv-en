/* ==========================================================================
   OWNER DASHBOARD — CUSTOMERS TAB
   ==========================================================================
   PURPOSE: Fetches customer data from /api/admin/customers and renders it
   in the Customers tab of the Owner Dashboard.

   USAGE: Add this to owner-dashboard.html:
     1. <script src="/assets/js/owner-customers.js"></script> in <head>
     2. Add a container in the Customers tab panel:
        <div id="customers-content"></div>
   ========================================================================== */

(function () {
  'use strict';

  var allCustomers = [];
  var filteredCustomers = [];
  var currentSort = { column: 'created_at', dir: 'desc' };
  var searchQuery = '';

  function fmtMoney(n) {
    return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      var date = new Date(d);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return d;
    }
  }

  function statusBadge(status) {
    if (!status) return '<span style="color:#999;">—</span>';
    var colors = {
      'Active': '#00b140',
      'active': '#00b140',
      'Inactive': '#cc0000',
      'inactive': '#cc0000',
      'Pending': '#ca8a04',
      'pending': '#ca8a04',
      'Suspended': '#cc0000',
      'suspended': '#cc0000'
    };
    var color = colors[status] || '#666';
    return '<span style="font-size:12px;font-weight:600;color:' + color + ';padding:2px 8px;border-radius:4px;background:' + color + '15;">' + status + '</span>';
  }

  function subBadge(status) {
    if (!status) return '<span style="color:#999;">—</span>';
    var colors = {
      'paid': '#00b140',
      'free': '#2563eb',
      'trial': '#ca8a04',
      'expired': '#cc0000'
    };
    var color = colors[status] || '#666';
    return '<span style="font-size:12px;font-weight:600;color:' + color + ';padding:2px 8px;border-radius:4px;background:' + color + '15;">' + status + '</span>';
  }

  async function loadCustomers() {
    var container = document.getElementById('customers-content');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Loading customers...</div>';

    try {
      var res = await fetch('/api/admin/customers', { credentials: 'include' });
      var data = await res.json();

      if (!data.success) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">' +
          (data.error || 'Failed to load customers') + '</div>';
        return;
      }

      allCustomers = data.customers || [];
      filteredCustomers = allCustomers.slice();
      renderCustomers();
    } catch (err) {
      console.error('Load customers error:', err);
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#cc0000;">' +
        'Failed to load customers. The DRIV-EN team has been notified.</div>';
      if (window.DRIVENErrorHandler) {
        DRIVENErrorHandler.report('Failed to load customers', 'owner-customers', err.stack);
      }
    }
  }

  function renderCustomers() {
    var container = document.getElementById('customers-content');
    if (!container) return;

    if (filteredCustomers.length === 0) {
      container.innerHTML = renderToolbar() +
        '<div style="text-align:center;padding:40px;color:#999;">No customers found.</div>';
      return;
    }

    var rowsHtml = filteredCustomers.map(function (c, i) {
      return '<tr style="border-bottom:1px solid #eee;cursor:pointer;" onclick="window.OWNER_CUSTOMERS.toggleRow(' + i + ')">' +
        '<td style="padding:10px 12px;font-weight:600;color:#333;">' + (c.company_name || '—') + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;">' + (c.admin_email || '—') + '</td>' +
        '<td style="padding:10px 12px;">' + (c.admin_phone || '—') + '</td>' +
        '<td style="padding:10px 12px;">' + (c.city ? c.city + ', ' + (c.state || '') : '—') + '</td>' +
        '<td style="padding:10px 12px;">' + (c.subscription_type || '—') + '</td>' +
        '<td style="padding:10px 12px;">' + statusBadge(c.customer_status) + '</td>' +
        '<td style="padding:10px 12px;">' + subBadge(c.subscription_status) + '</td>' +
        '<td style="padding:10px 12px;text-align:center;">' + (c.order_count || 0) + '</td>' +
        '<td style="padding:10px 12px;text-align:right;font-weight:600;">' + fmtMoney(c.total_spent) + '</td>' +
        '<td style="padding:10px 12px;font-size:12px;color:#999;">' + fmtDate(c.created_at) + '</td>' +
      '</tr>';
    }).join('');

    container.innerHTML = renderToolbar() +
      '<div style="overflow-x:auto;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
          '<thead>' +
            '<tr style="background:#f8fafc;border-bottom:2px solid #e0e0e0;">' +
              '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Company</th>' +
              '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Admin Email</th>' +
              '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Phone</th>' +
              '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Location</th>' +
              '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Plan</th>' +
              '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Status</th>' +
              '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Sub</th>' +
              '<th style="padding:10px 12px;text-align:center;font-size:12px;color:#666;text-transform:uppercase;">Orders</th>' +
              '<th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;text-transform:uppercase;">Total Spent</th>' +
              '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Joined</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>' +
      '<div id="customer-detail" style="display:none;margin-top:16px;padding:16px;background:#f8fafc;border-radius:8px;"></div>'
    ;
  }

  function renderToolbar() {
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">' +
      '<div style="font-size:16px;font-weight:600;">Customers (' + filteredCustomers.length + ')</div>' +
      '<div style="display:flex;gap:8px;align-items:center;">' +
        '<input type="text" id="customer-search" placeholder="Search by company, email, city..." ' +
          'value="' + searchQuery + '" ' +
          'oninput="window.OWNER_CUSTOMERS.search(this.value)" ' +
          'style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:260px;" />' +
        '<button onclick="window.OWNER_CUSTOMERS.refresh()" ' +
          'style="padding:8px 16px;background:#00b140;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;">Refresh</button>' +
      '</div>' +
    '</div>';
  }

  function toggleRow(index) {
    var detail = document.getElementById('customer-detail');
    if (!detail) return;
    var c = filteredCustomers[index];
    if (!c) return;

    detail.style.display = 'block';
    detail.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">' +
        '<div><div style="font-size:11px;color:#999;text-transform:uppercase;font-weight:600;">Customer ID</div><div style="font-size:13px;margin-top:2px;">' + (c.customer_id || '—') + '</div></div>' +
        '<div><div style="font-size:11px;color:#999;text-transform:uppercase;font-weight:600;">Activation Code</div><div style="font-size:13px;margin-top:2px;">' + (c.activation_code || '—') + '</div></div>' +
        '<div><div style="font-size:11px;color:#999;text-transform:uppercase;font-weight:600;">Activation Date</div><div style="font-size:13px;margin-top:2px;">' + fmtDate(c.activation_date) + '</div></div>' +
        '<div><div style="font-size:11px;color:#999;text-transform:uppercase;font-weight:600;">Expiration Date</div><div style="font-size:13px;margin-top:2px;">' + fmtDate(c.expiration_date) + '</div></div>' +
        '<div><div style="font-size:11px;color:#999;text-transform:uppercase;font-weight:600;">Free Until</div><div style="font-size:13px;margin-top:2px;">' + fmtDate(c.free_until) + '</div></div>' +
        '<div><div style="font-size:11px;color:#999;text-transform:uppercase;font-weight:600;">Paid Until</div><div style="font-size:13px;margin-top:2px;">' + fmtDate(c.paid_until) + '</div></div>' +
        '<div><div style="font-size:11px;color:#999;text-transform:uppercase;font-weight:600;">Billing Address</div><div style="font-size:13px;margin-top:2px;">' + (c.billing_address || '—') + '</div></div>' +
        '<div><div style="font-size:11px;color:#999;text-transform:uppercase;font-weight:600;">ZIP</div><div style="font-size:13px;margin-top:2px;">' + (c.zip || '—') + '</div></div>' +
        '<div><div style="font-size:11px;color:#999;text-transform:uppercase;font-weight:600;">Activated Modules</div><div style="font-size:13px;margin-top:2px;">' + (c.activated_modules || '—') + '</div></div>' +
        '<div><div style="font-size:11px;color:#999;text-transform:uppercase;font-weight:600;">Activation Complete</div><div style="font-size:13px;margin-top:2px;">' + (c.activation_complete ? '✅ Yes' : '⏳ Pending') + '</div></div>' +
      '</div>'
    ;
  }

  function search(query) {
    searchQuery = query;
    if (!query || query.trim() === '') {
      filteredCustomers = allCustomers.slice();
    } else {
      var q = query.toLowerCase().trim();
      filteredCustomers = allCustomers.filter(function (c) {
        return (
          (c.company_name && c.company_name.toLowerCase().includes(q)) ||
          (c.admin_email && c.admin_email.toLowerCase().includes(q)) ||
          (c.city && c.city.toLowerCase().includes(q)) ||
          (c.state && c.state.toLowerCase().includes(q)) ||
          (c.customer_id && c.customer_id.toLowerCase().includes(q)) ||
          (c.activation_code && c.activation_code.toLowerCase().includes(q))
        );
      });
    }
    renderCustomers();
    // Restore focus to search box
    var input = document.getElementById('customer-search');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function refresh() {
    loadCustomers();
  }

  // Expose API
  window.OWNER_CUSTOMERS = {
    load: loadCustomers,
    toggleRow: toggleRow,
    search: search,
    refresh: refresh
  };

  // Auto-load when the Customers tab becomes active
  function checkAndLoad() {
    var container = document.getElementById('customers-content');
    if (!container) return;

    // If using sticky-tabs.js, listen for tab activation
    var customersTabBtn = document.querySelector('.tab-btn[data-tab="customers"]');
    if (customersTabBtn) {
      customersTabBtn.addEventListener('click', function () {
        if (allCustomers.length === 0) loadCustomers();
      });
    }

    // Also load if the Customers tab is already visible on page load
    var customersPanel = document.getElementById('tab-customers');
    if (customersPanel && customersPanel.style.display !== 'none') {
      loadCustomers();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndLoad);
  } else {
    checkAndLoad();
  }
})();
