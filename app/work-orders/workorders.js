/**
 * DRIV-EN | Work Orders Listing (v1)
 * File: /app/work-orders/workorders.js
 *
 * Modernized from legacy stub. Replaces old app-header pattern with
 * dashHeader + sticky tab bar, auth-check, translate.js, diamond-plate.
 * All innerHTML replaced with DOM-safe node building.
 */

var activeOrgId = null;
var isBootstrapped = false;

// ===== DOM-SAFE HELPERS =====
function clearChildren(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

function displayMessage(msg, type) {
  var el = document.getElementById("woMessage");
  if (!el) return;
  el.textContent = msg;
  el.className = "wo-message " + type;
  el.style.display = "block";
}

function reportClientError(msg, context, err) {
  if (window.DRIVENErrorHandler) {
    window.DRIVENErrorHandler.report("workorders.html: " + msg, context, err ? err.stack : null);
  }
  console.error("[workorders.html:" + context + "]", msg, err);
}

function updateHeaderOffset() {
  var h = document.getElementById('dashHeader') || document.querySelector('.dash-header');
  if (h) {
    var hh = h.getBoundingClientRect().height || 60;
    document.documentElement.style.setProperty('--header-height', hh + 'px');
  }
}
window.addEventListener('resize', updateHeaderOffset);

function fixHeaderLayout() {
  var h = document.querySelector('.dash-header');
  if (!h) return false;
  var r1 = h.querySelector('.dash-header-row1');
  var r2 = h.querySelector('.dash-header-row2');
  var h1 = r2 ? r2.querySelector('h1') : null;
  if (!r1 || !h1) return false;
  if (h1.parentNode === r1) return true;
  var dl = r1.querySelector('.dash-driven-logo');
  r1.insertBefore(h1, dl);
  r1.style.cssText = 'display:flex !important; justify-content:space-between !important; align-items:center !important; padding:8px 20px !important; gap:16px !important; width:100% !important; box-sizing:border-box !important;';
  h1.style.cssText = 'margin:0; font-size:20px; font-weight:600; text-align:center; flex:1;';
  if (r2) r2.style.display = 'none';
  return true;
}

function getAuthHeaders() {
  var headers = { "Content-Type": "application/json", "x-org-id": activeOrgId || "" };
  var token = localStorage.getItem("driven_token") || sessionStorage.getItem("driven_token");
  if (token) headers["Authorization"] = "Bearer " + token;
  return headers;
}

function resolveActiveOrgId(u) {
  var params = new URLSearchParams(window.location.search);
  var urlOrg = params.get('org_id') || params.get('orgId') || params.get('customerId');
  if (urlOrg && urlOrg !== "default_org") return urlOrg;
  if (u && u.org_id && u.org_id !== "default_org") return u.org_id;
  if (u && u.customer_id && u.customer_id !== "default_org") return u.customer_id;
  var lsOrg = localStorage.getItem("driven_org_id") || localStorage.getItem("driven_customer_id");
  if (lsOrg && lsOrg !== "default_org") return lsOrg;
  var ssOrg = sessionStorage.getItem("driven_org_id");
  if (ssOrg && ssOrg !== "default_org") return ssOrg;
  return null;
}

function extractRecords(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  return data.records || data.work_orders || data.workOrders || data.data || data.results || [];
}

function formatStatusBadge(status) {
  var span = document.createElement("span");
  var s = (status || "").toLowerCase();
  if (s === "urgent" || s === "critical") {
    span.className = "wo-status-badge wo-status-urgent";
  } else if (s === "completed" || s === "done" || s === "closed") {
    span.className = "wo-status-badge wo-status-completed";
  } else {
    span.className = "wo-status-badge wo-status-open";
  }
  span.textContent = status || "Open";
  return span;
}

function formatPriority(priority) {
  var span = document.createElement("span");
  var p = (priority || "").toLowerCase();
  if (p === "urgent" || p === "high") {
    span.className = "wo-severity-high";
  } else if (p === "medium") {
    span.className = "wo-severity-medium";
  } else {
    span.className = "wo-severity-low";
  }
  span.textContent = priority || "Low";
  return span;
}

async function loadWorkOrders() {
  var tbody = document.getElementById("woTableBody");

  try {
    var resp = await fetch("/api/work-orders", { headers: getAuthHeaders() });
    if (!resp.ok) throw new Error("HTTP " + resp.status);

    var data = await resp.json();
    var records = extractRecords(data);

    // Update dashboard counts
    var openCount = 0, urgentCount = 0, completedCount = 0;
    var now = new Date();
    var monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    records.forEach(function(r) {
      var status = (r.status || "").toLowerCase();
      var priority = (r.priority || "").toLowerCase();
      if (status === "completed" || status === "done" || status === "closed") {
        var completedDate = r.completed_date || r.updated_at;
        if (completedDate && new Date(completedDate) >= monthAgo) completedCount++;
      } else {
        openCount++;
        if (priority === "urgent" || priority === "high") urgentCount++;
      }
    });

    document.getElementById("cardWOOpen").textContent = openCount;
    document.getElementById("cardWOUrgent").textContent = urgentCount;
    document.getElementById("cardWOCompleted").textContent = completedCount;

    // Render table
    clearChildren(tbody);

    if (records.length === 0) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 6;
      td.style.cssText = "text-align:center;color:var(--text-muted,#64748b);padding:20px;";
      td.setAttribute("data-i18n", "");
      td.textContent = "No work orders found.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    records.forEach(function(item) {
      var tr = document.createElement("tr");

      var td1 = document.createElement("td");
      var link = document.createElement("a");
      link.href = "/app/work-orders/workorder-detail.html?id=" + encodeURIComponent(item.id || item.wo_id || item.work_order_id || "");
      link.style.color = "#2563eb";
      link.style.fontWeight = "600";
      link.textContent = item.wo_number || item.work_order_number || item.id || "—";
      td1.appendChild(link);
      tr.appendChild(td1);

      var td2 = document.createElement("td");
      td2.textContent = item.asset_name || item.equipment_name || item.asset_number || "—";
      tr.appendChild(td2);

      var td3 = document.createElement("td");
      td3.textContent = item.title || item.issue || item.description || "—";
      tr.appendChild(td3);

      var td4 = document.createElement("td");
      td4.appendChild(formatPriority(item.priority || "Low"));
      tr.appendChild(td4);

      var td5 = document.createElement("td");
      td5.textContent = item.assigned_to || item.assigned_user || item.technician || "—";
      tr.appendChild(td5);

      var td6 = document.createElement("td");
      td6.appendChild(formatStatusBadge(item.status || "Open"));
      tr.appendChild(td6);

      tbody.appendChild(tr);
    });

  } catch (e) {
    reportClientError("Failed loading work orders", "loadWorkOrders", e);
    clearChildren(tbody);
    var errTr = document.createElement("tr");
    var errTd = document.createElement("td");
    errTd.colSpan = 6;
    errTd.style.cssText = "text-align:center;color:#ef4444;padding:20px;";
    errTd.textContent = "⚠️ Error loading work orders. Please refresh.";
    errTr.appendChild(errTd);
    tbody.appendChild(errTr);
    displayMessage("Unable to load work orders.", "error");
  }
}

function confirmLogout() {
  if (confirm("Are you sure you want to log out?")) dashLogout();
}

// ===== EXPOSE FUNCTIONS =====
window.confirmLogout = confirmLogout;

// ===== INITIALIZATION =====
async function initPage(e) {
  if (isBootstrapped) return;

  var u = (e && e.detail) ? e.detail : (window.dashUser || window.drivenUser);
  activeOrgId = resolveActiveOrgId(u);

  if (!activeOrgId || activeOrgId === "default_org") {
    displayMessage("Invalid session context. Please log in again.", "error");
    return;
  }

  isBootstrapped = true;

  var role = (u && u.role || "").toLowerCase();
  var dashUrl = (role === "admin" || role === "ro-admin") ? "/app/dashboard/admin.html" : "/app/dashboard/employee-dashboard.html";
  var homeLink = document.getElementById("dashHomeLink");
  if (homeLink) homeLink.href = dashUrl;

  var ha = 0, hi = setInterval(function() {
    ha++;
    if (fixHeaderLayout() || ha > 50) { clearInterval(hi); updateHeaderOffset(); }
  }, 100);

  await loadWorkOrders();
  updateHeaderOffset();
}

document.addEventListener("dashSessionLoaded", initPage);
if (window.dashUser || window.drivenUser) initPage();
