/**
 * DRIV-EN | Work Order Detail (v1)
 * File: /app/work-orders/workorder-detail.js
 *
 * Modernized from legacy stub. Replaces old app-header pattern with
 * dashHeader + sticky tab bar, auth-check, translate.js, diamond-plate.
 * All innerHTML replaced with DOM-safe node building.
 */

var activeOrgId = null;
var currentWoId = null;
var woRecord = null;
var isBootstrapped = false;

// ===== DOM-SAFE HELPERS =====
function clearChildren(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

function displayMessage(msg, type) {
  var el = document.getElementById("wodMessage");
  if (!el) return;
  el.textContent = msg;
  el.className = "wod-message " + type;
  el.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function reportClientError(msg, context, err) {
  if (window.DRIVENErrorHandler) {
    window.DRIVENErrorHandler.report("workorder-detail.html: " + msg, context, err ? err.stack : null);
  }
  console.error("[workorder-detail.html:" + context + "]", msg, err);
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

function formatDate(raw) {
  if (!raw) return "—";
  try {
    var dt = new Date(typeof raw === "string" ? raw.replace(" ", "T") : raw);
    if (!isNaN(dt.getTime())) return dt.toLocaleDateString();
  } catch(e) {}
  return String(raw);
}

function formatStatusBadge(status) {
  var span = document.createElement("span");
  var s = (status || "").toLowerCase();
  if (s === "urgent" || s === "critical") {
    span.className = "wod-status-badge wod-status-urgent";
  } else if (s === "completed" || s === "done" || s === "closed" || s === "approved") {
    span.className = "wod-status-badge wod-status-completed";
  } else {
    span.className = "wod-status-badge wod-status-open";
  }
  span.textContent = status || "Open";
  return span;
}

async function loadWorkOrderDetail(woId) {
  try {
    var resp = await fetch("/api/work-orders/" + encodeURIComponent(woId), { headers: getAuthHeaders() });
    if (!resp.ok) throw new Error("HTTP " + resp.status);

    var data = await resp.json();
    woRecord = data.record || data.work_order || data.data || data;

    // Populate info grid
    document.getElementById("valWoNumber").textContent = woRecord.wo_number || woRecord.work_order_number || woRecord.id || "—";
    document.getElementById("valEquipment").textContent = woRecord.asset_name || woRecord.equipment_name || woRecord.asset_number || "—";
    document.getElementById("valTitle").textContent = woRecord.title || woRecord.issue || "—";
    document.getElementById("valPriority").textContent = woRecord.priority || "—";
    document.getElementById("valCategory").textContent = woRecord.category || "—";
    document.getElementById("valAssigned").textContent = woRecord.assigned_to || woRecord.assigned_user || woRecord.technician || "—";
    document.getElementById("valCreated").textContent = formatDate(woRecord.created_at || woRecord.created_date);
    document.getElementById("valDescription").textContent = woRecord.description || woRecord.issue_description || "—";

    // Status badge
    var statusEl = document.getElementById("valStatus");
    clearChildren(statusEl);
    statusEl.appendChild(formatStatusBadge(woRecord.status || "Open"));

    // Hide completion/review forms based on status
    var status = (woRecord.status || "").toLowerCase();
    if (status === "completed" || status === "done" || status === "closed") {
      document.getElementById("completionCard").style.display = "none";
    }
    if (status === "approved" || (woRecord.review_status && woRecord.review_status === "approved")) {
      document.getElementById("reviewCard").style.display = "none";
    }

    // Pre-fill completion date with today
    var today = new Date().toISOString().split("T")[0];
    document.getElementById("woCompletedDate").value = today;

  } catch (e) {
    reportClientError("Failed loading work order detail", "loadWorkOrderDetail", e);
    displayMessage("Unable to load work order details.", "error");
  }
}

async function submitCompletion(e) {
  e.preventDefault();
  if (!currentWoId) return;

  var btn = document.getElementById("btnComplete");
  btn.disabled = true;
  btn.textContent = "Submitting…";

  var payload = {
    work_order_id: currentWoId,
    completed_date: document.getElementById("woCompletedDate").value,
    completion_notes: document.getElementById("woCompletionNotes").value.trim() || null,
    org_id: activeOrgId
  };

  try {
    var resp = await fetch("/api/work-orders/" + encodeURIComponent(currentWoId) + "/complete", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      var errData = {};
      try { errData = await resp.json(); } catch(e) {}
      throw new Error(errData.error || errData.message || "HTTP " + resp.status);
    }

    displayMessage("Work order completed successfully!", "success");
    document.getElementById("completionCard").style.display = "none";

    // Refresh status
    await loadWorkOrderDetail(currentWoId);

  } catch (e) {
    reportClientError("Failed submitting WO completion", "submitCompletion", e);
    displayMessage("Failed to complete work order: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Complete Work Order";
  }
}

async function submitReview(e) {
  e.preventDefault();
  if (!currentWoId) return;

  var reviewStatus = document.getElementById("woReviewStatus").value;
  if (!reviewStatus) {
    displayMessage("Please select a review status.", "error");
    return;
  }

  var btn = document.getElementById("btnReview");
  btn.disabled = true;
  btn.textContent = "Submitting…";

  var payload = {
    work_order_id: currentWoId,
    review_status: reviewStatus,
    review_notes: document.getElementById("woReviewNotes").value.trim() || null,
    org_id: activeOrgId
  };

  try {
    var resp = await fetch("/api/work-orders/" + encodeURIComponent(currentWoId) + "/review", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      var errData = {};
      try { errData = await resp.json(); } catch(e) {}
      throw new Error(errData.error || errData.message || "HTTP " + resp.status);
    }

    displayMessage("Review submitted successfully!", "success");
    document.getElementById("reviewCard").style.display = "none";

    // Refresh status
    await loadWorkOrderDetail(currentWoId);

  } catch (e) {
    reportClientError("Failed submitting WO review", "submitReview", e);
    displayMessage("Failed to submit review: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Review";
  }
}

function confirmLogout() {
  if (confirm("Are you sure you want to log out?")) dashLogout();
}

// ===== EXPOSE FUNCTIONS =====
window.submitCompletion = submitCompletion;
window.submitReview = submitReview;
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

  var params = new URLSearchParams(window.location.search);
  currentWoId = params.get('id') || params.get('wo_id') || params.get('work_order_id');

  if (!currentWoId) {
    displayMessage("No Work Order ID specified.", "error");
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

  await loadWorkOrderDetail(currentWoId);
  updateHeaderOffset();
}

document.addEventListener("dashSessionLoaded", initPage);
if (window.dashUser || window.drivenUser) initPage();
