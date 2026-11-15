/**
 * DRIV-EN | Preventative Maintenance Listing (v1)
 * File: /app/pm/pm.js
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
  var el = document.getElementById("pmMessage");
  if (!el) return;
  el.textContent = msg;
  el.className = "pm-message " + type;
  el.style.display = "block";
}

function reportClientError(msg, context, err) {
  if (window.DRIVENErrorHandler) {
    window.DRIVENErrorHandler.report("pm.html: " + msg, context, err ? err.stack : null);
  }
  console.error("[pm.html:" + context + "]", msg, err);
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
  return data.records || data.pm_schedules || data.schedules || data.data || data.results || [];
}

function formatStatusBadge(status) {
  var span = document.createElement("span");
  var s = (status || "").toLowerCase();
  if (s === "overdue") {
    span.className = "pm-status-badge pm-status-overdue";
  } else if (s === "completed" || s === "done") {
    span.className = "pm-status-badge pm-status-completed";
  } else {
    span.className = "pm-status-badge pm-status-open";
  }
  span.textContent = status || "Open";
  return span;
}

function formatDate(raw) {
  if (!raw) return "—";
  try {
    var dt = new Date(typeof raw === "string" ? raw.replace(" ", "T") : raw);
    if (!isNaN(dt.getTime())) return dt.toLocaleDateString();
  } catch(e) {}
  return String(raw);
}

async function loadPMSchedules() {
  var tbody = document.getElementById("pmTableBody");

  try {
    var resp = await fetch("/api/pm-schedules", { headers: getAuthHeaders() });
    if (!resp.ok) throw new Error("HTTP " + resp.status);

    var data = await resp.json();
    var records = extractRecords(data);

    // Update dashboard counts
    var openCount = 0, overdueCount = 0, completedCount = 0;
    var now = new Date();

    records.forEach(function(r) {
      var status = (r.status || "").toLowerCase();
      var dueDate = r.next_due_date || r.due_date || r.nextDueDate;
      if (status === "completed" || status === "done") {
        completedCount++;
      } else if (status === "overdue" || (dueDate && new Date(dueDate) < now && status !== "completed")) {
        overdueCount++;
        openCount++;
      } else {
        openCount++;
      }
    });

    document.getElementById("cardPMOpen").textContent = openCount;
    document.getElementById("cardPMOverdue").textContent = overdueCount;
    document.getElementById("cardPMCompleted").textContent = completedCount;

    // Render table
    clearChildren(tbody);

    if (records.length === 0) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 6;
      td.style.cssText = "text-align:center;color:var(--text-muted,#64748b);padding:20px;";
      td.setAttribute("data-i18n", "");
      td.textContent = "No PM schedules configured.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    records.forEach(function(item) {
      var tr = document.createElement("tr");

      var td1 = document.createElement("td");
      td1.textContent = item.asset_name || item.equipment_name || item.asset_number || "—";
      tr.appendChild(td1);

      var td2 = document.createElement("td");
      td2.textContent = item.pm_type || item.task_name || item.pm_template || "—";
      tr.appendChild(td2);

      var td3 = document.createElement("td");
      var intervalVal = item.interval_hours || item.interval_miles || item.interval || "—";
      td3.textContent = intervalVal + (typeof intervalVal === "number" || /^\d+$/.test(String(intervalVal)) ? " hrs" : "");
      tr.appendChild(td3);

      var td4 = document.createElement("td");
      td4.textContent = formatDate(item.next_due_date || item.due_date || item.nextDueDate);
      tr.appendChild(td4);

      var td5 = document.createElement("td");
      td5.appendChild(formatStatusBadge(item.status || "Open"));
      tr.appendChild(td5);

      var td6 = document.createElement("td");
      var btn = document.createElement("a");
      btn.className = "pm-btn";
      btn.href = "/app/pm/pm-detail.html?id=" + encodeURIComponent(item.id || item.pm_id || "");
      btn.textContent = "View";
      td6.appendChild(btn);
      tr.appendChild(td6);

      tbody.appendChild(tr);
    });

  } catch (e) {
    reportClientError("Failed loading PM schedules", "loadPMSchedules", e);
    clearChildren(tbody);
    var errTr = document.createElement("tr");
    var errTd = document.createElement("td");
    errTd.colSpan = 6;
    errTd.style.cssText = "text-align:center;color:#ef4444;padding:20px;";
    errTd.textContent = "⚠️ Error loading PM schedules. Please refresh.";
    errTr.appendChild(errTd);
    tbody.appendChild(errTr);
    displayMessage("Unable to load PM schedules.", "error");
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

  await loadPMSchedules();
  updateHeaderOffset();
}

document.addEventListener("dashSessionLoaded", initPage);
if (window.dashUser || window.drivenUser) initPage();
