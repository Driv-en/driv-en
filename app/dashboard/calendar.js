/**
 * calendar.js -- DRIV-EN Calendar View
 *
 * Shows work orders, recurring PM tasks, and inspections on a visual calendar.
 * Supports Month / Week / Day views with color-coded items and filtering.
 *
 * Data sources:
 *   - GET /api/work-orders          -> work orders (by created_at, completed_at)
 *   - GET /api/work-orders/templates -> recurring PM templates (by next_due_date)
 *   - GET /api/inspections          -> inspections (by created_at)
 *
 * Color coding:
 *   - Work orders: blue (#3b82f6)
 *   - Recurring PM: green (#16a34a)
 *   - Inspections: orange (#f97316)
 *   - Overdue: red (#ef4444)
 *
 * @requires auth-check.js, dashboard-common.js
 */

(function() {
  'use strict';

  // ===== STATE =====
  var currentDate = new Date();
  var viewMode = 'month'; // 'month' | 'week' | 'day'
  var allItems = [];       // merged calendar items
  var filterType = 'all';
  var filterStatus = 'all';
  var isLoading = false;

  // ===== HELPERS =====
  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function reportError(source, err) {
    var msg = (err && err.message) ? err.message : String(err);
    var stack = (err && err.stack) ? err.stack : '';
    try {
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'Calendar (' + source + ')',
          error_message: msg,
          stack_trace: stack + '\n--- CONTEXT ---\nURL: ' + window.location.href +
            '\nTime: ' + new Date().toISOString(),
          severity: 'error'
        })
      });
    } catch (e) {}
    console.error('[Calendar:' + source + ']', err);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function dateKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseDate(str) {
    if (!str) return null;
    var d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function isOverdue(item) {
    if (item.status === 'completed' || item.status === 'closed' || item.status === 'cancelled') return false;
    var itemDate = parseDate(item.date);
    if (!itemDate) return false;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return itemDate < today;
  }

  function formatTime(str) {
    var d = parseDate(str);
    if (!d) return '';
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + pad2(m) + ' ' + ampm;
  }

  // ===== DATA FETCHING =====
  async function fetchWorkOrders() {
    try {
      var resp = await fetch('/api/work-orders', { credentials: 'include' });
      if (!resp.ok) return [];
      var data = await resp.json();
      var wos = data.work_orders || data.result || [];
      return wos.map(function(w) {
        var dateStr = w.assigned_at || w.started_at || w.created_at;
        var completedDate = w.completed_at || w.closed_at;
        // If completed, show on completion date; otherwise show on assigned/created date
        var displayDate = (w.status === 'completed' || w.status === 'closed') ? completedDate : dateStr;
        return {
          id: w.id,
          type: 'wo',
          title: w.wo_number ? 'WO-' + w.wo_number : 'Work Order',
          subtitle: w.description || w.wo_type || '',
          date: displayDate,
          status: w.status || 'open',
          priority: w.priority || 'medium',
          assignedTo: w.assigned_to || '',
          detailUrl: '/app/dashboard/work-orders.html?id=' + encodeURIComponent(w.id),
          woType: w.wo_type || ''
        };
      });
    } catch (e) {
      reportError('fetchWorkOrders', e);
      return [];
    }
  }

  async function fetchPMTemplates() {
    try {
      var resp = await fetch('/api/work-orders/templates', { credentials: 'include' });
      if (!resp.ok) return [];
      var data = await resp.json();
      var templates = data.templates || data.result || [];
      return templates.filter(function(t) {
        return t.next_due_date && t.status === 'active';
      }).map(function(t) {
        return {
          id: t.id,
          type: 'pm',
          title: t.name || 'Recurring PM',
          subtitle: t.recurrence_type ? (t.recurrence_type + ' / ' + (t.recurrence_interval || '') + ' ' + (t.recurrence_unit || '')) : '',
          date: t.next_due_date,
          status: 'open',
          priority: 'medium',
          assignedTo: '',
          detailUrl: '/app/dashboard/work-orders.html',
          woType: 'pm'
        };
      });
    } catch (e) {
      // Templates endpoint may not exist yet -- silently skip
      return [];
    }
  }

  async function fetchInspections() {
    try {
      var resp = await fetch('/api/inspections', { credentials: 'include' });
      if (!resp.ok) return [];
      var data = await resp.json();
      var insps = data.inspections || data.result || [];
      return insps.map(function(i) {
        return {
          id: i.id,
          type: 'insp',
          title: 'Inspection',
          subtitle: i.asset_name || i.asset_id || '',
          date: i.completed_at || i.created_at,
          status: i.status || 'completed',
          priority: 'medium',
          assignedTo: i.inspector || '',
          detailUrl: '/app/inspections/inspection-detail.html?id=' + encodeURIComponent(i.id),
          woType: 'inspection'
        };
      });
    } catch (e) {
      // Inspections endpoint may not exist yet -- silently skip
      return [];
    }
  }

  async function loadAllItems() {
    isLoading = true;
    document.getElementById('calGridContainer').innerHTML = '<div class="cal-loading">Loading calendar...</div>';

    try {
      var results = await Promise.all([
        fetchWorkOrders(),
        fetchPMTemplates(),
        fetchInspections()
      ]);
      allItems = results[0].concat(results[1]).concat(results[2]);
    } catch (e) {
      reportError('loadAllItems', e);
      allItems = [];
    }

    isLoading = false;
    render();
  }

  // ===== FILTERING =====
  function getFilteredItems() {
    return allItems.filter(function(item) {
      // Type filter
      if (filterType !== 'all' && item.type !== filterType) return false;
      // Status filter
      if (filterStatus !== 'all') {
        if (filterStatus === 'overdue') {
          if (!isOverdue(item)) return false;
        } else {
          if (item.status !== filterStatus) return false;
        }
      }
      return true;
    });
  }

  function getItemsForDate(date) {
    var key = dateKey(date);
    return getFilteredItems().filter(function(item) {
      var itemDate = parseDate(item.date);
      if (!itemDate) return false;
      return dateKey(itemDate) === key;
    });
  }

  function getItemClass(item) {
    if (isOverdue(item)) return 'overdue';
    return item.type; // 'wo', 'pm', 'insp'
  }

  // ===== MONTH VIEW =====
  function renderMonthView() {
    var year = currentDate.getFullYear();
    var month = currentDate.getMonth();
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    var startWeekday = firstDay.getDay(); // 0=Sun
    var daysInMonth = lastDay.getDate();
    var prevMonthDays = new Date(year, month, 0).getDate();

    var html = '<div class="cal-month-grid">';
    // Day headers
    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (var d = 0; d < 7; d++) {
      html += '<div class="cal-day-header">' + dayNames[d] + '</div>';
    }

    var today = new Date();
    var todayKey = dateKey(today);
    var cellCount = 0;

    // Previous month overflow days
    for (var p = startWeekday - 1; p >= 0; p--) {
      var prevDate = new Date(year, month - 1, prevMonthDays - p);
      html += renderMonthCell(prevDate, true, todayKey);
      cellCount++;
    }

    // Current month days
    for (var day = 1; day <= daysInMonth; day++) {
      var cellDate = new Date(year, month, day);
      html += renderMonthCell(cellDate, false, todayKey);
      cellCount++;
    }

    // Next month overflow to fill the grid (6 rows = 42 cells)
    var nextDay = 1;
    while (cellCount < 42) {
      var nextDate = new Date(year, month + 1, nextDay);
      html += renderMonthCell(nextDate, true, todayKey);
      nextDay++;
      cellCount++;
    }

    html += '</div>';
    return html;
  }

  function renderMonthCell(date, otherMonth, todayKey) {
    var key = dateKey(date);
    var isToday = key === todayKey;
    var items = getItemsForDate(date);
    var cls = 'cal-day-cell';
    if (otherMonth) cls += ' other-month';
    if (isToday) cls += ' today';

    var html = '<div class="' + cls + '">';
    html += '<div class="cal-day-num">' + date.getDate() + '</div>';
    html += '<div class="cal-items">';

    var maxShow = 3;
    for (var i = 0; i < Math.min(items.length, maxShow); i++) {
      var item = items[i];
      html += '<div class="cal-item ' + getItemClass(item) + '" data-url="' + esc(item.detailUrl) + '" title="' + esc(item.title + ': ' + item.subtitle) + '">' + esc(item.title) + '</div>';
    }
    if (items.length > maxShow) {
      html += '<div class="cal-overflow" data-date="' + key + '">+' + (items.length - maxShow) + ' more</div>';
    }

    html += '</div></div>';
    return html;
  }

  // ===== WEEK VIEW =====
  function renderWeekView() {
    var weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    var today = new Date();
    var todayKey = dateKey(today);

    var html = '<div class="cal-week-grid">';
    for (var d = 0; d < 7; d++) {
      var dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + d);
      var key = dateKey(dayDate);
      var isToday = key === todayKey;
      var items = getItemsForDate(dayDate);
      var dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayDate.getDay()];

      html += '<div class="cal-week-day' + (isToday ? ' today' : '') + '">';
      html += '<div class="cal-week-day-header">' + dayName + '<span class="cal-week-date">' + dayDate.getDate() + '</span></div>';
      html += '<div class="cal-week-items">';

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        html += '<div class="cal-week-item ' + getItemClass(item) + '" data-url="' + esc(item.detailUrl) + '">';
        html += '<span class="cal-week-item-title">' + esc(item.title) + '</span>';
        html += '<span class="cal-week-item-meta">' + esc(item.subtitle || item.status || '') + '</span>';
        html += '</div>';
      }

      if (items.length === 0) {
        html += '<div style="font-size:12px;color:var(--text-muted,#94a3b8);padding:4px;">No items</div>';
      }

      html += '</div></div>';
    }

    html += '</div>';
    return html;
  }

  // ===== DAY VIEW =====
  function renderDayView() {
    var key = dateKey(currentDate);
    var items = getItemsForDate(currentDate);

    var html = '<div class="cal-day-view">';
    var dateLabel = currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    html += '<div class="cal-day-view-header">' + esc(dateLabel) + ' (' + items.length + ' item' + (items.length === 1 ? '' : 's') + ')</div>';
    html += '<div class="cal-day-view-body">';

    if (items.length === 0) {
      html += '<div class="cal-empty">No items scheduled for this day.</div>';
    } else {
      // Sort by time
      items.sort(function(a, b) {
        var da = parseDate(a.date) || new Date(0);
        var db = parseDate(b.date) || new Date(0);
        return da.getTime() - db.getTime();
      });

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var timeStr = formatTime(item.date);
        html += '<div class="cal-day-item ' + getItemClass(item) + '" data-url="' + esc(item.detailUrl) + '">';
        html += '<div class="cal-day-item-time">' + esc(timeStr || 'All day') + '</div>';
        html += '<div class="cal-day-item-body">';
        html += '<div class="cal-day-item-title">' + esc(item.title) + '</div>';
        var metaParts = [];
        if (item.subtitle) metaParts.push(item.subtitle);
        if (item.assignedTo) metaParts.push('Assigned: ' + item.assignedTo);
        if (item.status) metaParts.push('Status: ' + item.status);
        if (metaParts.length) html += '<div class="cal-day-item-meta">' + esc(metaParts.join(' | ')) + '</div>';
        html += '</div></div>';
      }
    }

    html += '</div></div>';
    return html;
  }

  // ===== MAIN RENDER =====
  function render() {
    var container = document.getElementById('calGridContainer');
    var label = document.getElementById('calPeriodLabel');

    // Update period label
    if (viewMode === 'month') {
      label.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      var weekStart = new Date(currentDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      var weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      label.textContent = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' - ' + weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      label.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    // Render the appropriate view
    if (viewMode === 'month') {
      container.innerHTML = renderMonthView();
    } else if (viewMode === 'week') {
      container.innerHTML = renderWeekView();
    } else {
      container.innerHTML = renderDayView();
    }

    // Check for empty calendar
    var filtered = getFilteredItems();
    if (filtered.length === 0 && !isLoading) {
      var existingEmpty = container.querySelector('.cal-empty');
      if (!existingEmpty) {
        container.innerHTML += '<div class="cal-empty">No items match your filters. Try changing the filter or navigating to a different date range.</div>';
      }
    }

    // Wire up item clicks
    attachItemClicks(container);
  }

  function attachItemClicks(container) {
    var items = container.querySelectorAll('[data-url]');
    for (var i = 0; i < items.length; i++) {
      (function(el) {
        el.addEventListener('click', function() {
          var url = el.getAttribute('data-url');
          if (url) window.location.href = url;
        });
      })(items[i]);
    }

    // Wire up "+N more" overflow clicks -> switch to day view
    var overflows = container.querySelectorAll('.cal-overflow[data-date]');
    for (var j = 0; j < overflows.length; j++) {
      (function(el) {
        el.addEventListener('click', function() {
          var dateStr = el.getAttribute('data-date');
          if (dateStr) {
            currentDate = new Date(dateStr + 'T00:00:00');
            switchView('day');
          }
        });
      })(overflows[j]);
    }
  }

  // ===== NAVIGATION =====
  function navigatePrev() {
    if (viewMode === 'month') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      currentDate.setDate(currentDate.getDate() - 7);
    } else {
      currentDate.setDate(currentDate.getDate() - 1);
    }
    render();
  }

  function navigateNext() {
    if (viewMode === 'month') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    render();
  }

  function navigateToday() {
    currentDate = new Date();
    render();
  }

  function switchView(mode) {
    viewMode = mode;
    // Update active button
    var buttons = ['calViewMonth', 'calViewWeek', 'calViewDay'];
    var modes = ['month', 'week', 'day'];
    for (var i = 0; i < buttons.length; i++) {
      var btn = document.getElementById(buttons[i]);
      if (btn) {
        if (modes[i] === mode) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    }
    render();
  }

  // ===== EVENT HANDLERS =====
  function attachEventHandlers() {
    document.getElementById('calPrev').addEventListener('click', navigatePrev);
    document.getElementById('calNext').addEventListener('click', navigateNext);
    document.getElementById('calToday').addEventListener('click', navigateToday);
    document.getElementById('calViewMonth').addEventListener('click', function() { switchView('month'); });
    document.getElementById('calViewWeek').addEventListener('click', function() { switchView('week'); });
    document.getElementById('calViewDay').addEventListener('click', function() { switchView('day'); });

    document.getElementById('calFilterType').addEventListener('change', function() {
      filterType = this.value;
      render();
    });
    document.getElementById('calFilterStatus').addEventListener('change', function() {
      filterStatus = this.value;
      render();
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      // Don't intercept if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') navigatePrev();
      else if (e.key === 'ArrowRight') navigateNext();
      else if (e.key === 't' || e.key === 'T') navigateToday();
      else if (e.key === 'm' || e.key === 'M') switchView('month');
      else if (e.key === 'w' || e.key === 'W') switchView('week');
      else if (e.key === 'd' || e.key === 'D') switchView('day');
    });
  }

  // ===== SESSION LOADING =====
  function handleSessionLoaded() {
    var user = window.dashUser;
    // Don't redirect — auth-check.js handles unauthenticated redirects.
    // Just populate the welcome card if user data is available.
    if (!user) return;

    // Populate welcome card
    var firstName = user.first_name || user.fullName || user.name || 'User';
    var orgName = user.org_name || user.organization || '';
    var nameEl = document.getElementById('calWelcomeName');
    if (orgName) {
      nameEl.textContent = 'Welcome back, ' + firstName + ' - ' + orgName;
    } else {
      nameEl.textContent = 'Welcome back, ' + firstName;
    }

    document.getElementById('calWelcomeRole').textContent = user.role || user.role_id || '-';
    document.getElementById('calWelcomeEmail').textContent = user.email || '-';

    // Dashboard tab returns to user's main dashboard
    var roleId = (user.role_id || user.role || '').toLowerCase();
    var dashUrl = '/app/dashboard/employee-dashboard.html';
    if (roleId === 'ro-founder') dashUrl = '/app/dashboard/owner-dashboard.html';
    else if (roleId === 'ro-admin') dashUrl = '/app/dashboard/admin.html';
    var homeLink = document.getElementById('calHomeLink');
    if (homeLink) homeLink.href = dashUrl;

    // Load calendar data
    loadAllItems();
  }

  // Logout
  window.dashLogout = function() {
    try { fetch('/auth/logout', { method: 'POST' }); } catch (e) {}
    window.location.href = '/public/login.html';
  };

  // ===== INIT =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      attachEventHandlers();
      document.addEventListener('dashSessionLoaded', handleSessionLoaded);
    });
  } else {
    attachEventHandlers();
    document.addEventListener('dashSessionLoaded', handleSessionLoaded);
  }

  // Global error handler
  window.addEventListener('error', function(e) {
    reportError('window.onerror', e.error || new Error(e.message));
  });
  window.addEventListener('unhandledrejection', function(e) {
    reportError('unhandledrejection', e.reason || new Error('Unhandled promise rejection'));
  });

})();
