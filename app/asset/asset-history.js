/**
 * DRIV-EN | Complete Asset History & Audit Log (v1)
 * File: /app/asset/asset-history.js
 * Extracted from asset-history.html for CSP compliance.
 *
 * Fixes applied during extraction:
 *   - loadAssetHistory: tbody.innerHTML replaced with DOM-safe row building.
 *   - formatAuditDetails: XSS risk fixed — item.details/description now escaped
 *     before insertion; before/after change values escaped; JSON.stringify
 *     output placed via textContent not innerHTML.
 *   - All onclick-referenced functions exposed on window.
 */

var activeOrgId = "";
var currentAssetId = "";
var humanAssetNumber = "";

// ===== DOM-SAFE HELPERS =====
function clearChildren(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

// Storage Listener to sync theme toggles in real-time across tabs/headers
window.addEventListener('storage', function(e) {
  if (e.key === 'driven-theme' && e.newValue) {
    document.documentElement.setAttribute('data-theme', e.newValue);
  }
});

// Header Height Adjustment Logic matching asset-detail.html
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
  var r3 = h.querySelector('.dash-header-row3');
  var h1 = r2 ? r2.querySelector('h1') : null;
  if (!r1 || !h1) return false;
  if (h1.parentNode === r1) return true;
  var dl = r1.querySelector('.dash-driven-logo');
  r1.insertBefore(h1, dl);
  r1.style.cssText = 'display:flex !important; justify-content:space-between !important; align-items:center !important; padding:8px 20px !important; gap:16px !important; width:100% !important; box-sizing:border-box !important;';
  h1.style.cssText = 'margin:0; font-size:20px; font-weight:600; text-align:center; flex:1;';
  if (r2) r2.style.display = 'none';
  if (r3) r3.style.display = 'none';
  return true;
}

function displayMessage(msg, type) {
  var el = document.getElementById("ahMessage");
  if (!el) return;
  el.textContent = msg;
  el.className = "ah-message " + type;
  el.style.display = "block";
}

function reportClientError(msg, context, err) {
  if (window.DRIVENErrorHandler) {
    window.DRIVENErrorHandler.report("asset-history.html: " + msg, context, err ? err.stack : null);
  }
}

// High-Frequency Co-Worker Polling & Fast Beacon Unload
function sendPresenceUnload() {
  if (!activeOrgId) return;
  var payload = JSON.stringify({ page: "Asset History", action: "leave" });
  if (navigator.sendBeacon) {
    var blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/onboarding/presence", blob);
  } else {
    fetch("/api/onboarding/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-org-id": activeOrgId },
      body: payload,
      keepalive: true
    }).catch(function() {});
  }
}

async function checkActivePresence() {
  if (!activeOrgId || activeOrgId === "default_org") return;
  try {
    var resp = await fetch("/api/onboarding/presence", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-org-id": activeOrgId
      },
      body: JSON.stringify({ page: "Asset History" })
    });
    if (resp.ok) {
      var data = await resp.json();
      var banner = document.getElementById("presenceBanner");
      var textEl = document.getElementById("presenceText");
      if (data.activeUsers && data.activeUsers.length > 0) {
        var fullNames = data.activeUsers.map(function(u) {
          if (typeof u === "object") {
            return ((u.firstName || u.first_name || "") + " " + (u.lastName || u.last_name || "")).trim() || u.name || u.email;
          }
          return String(u);
        });
        textEl.textContent = "🟢 " + fullNames.join(", ") + " active";
        banner.style.display = "inline-flex";
      } else {
        banner.style.display = "none";
      }
    }
  } catch (e) {
    reportClientError("Presence check failed", "checkActivePresence", e);
  }
}

window.addEventListener("pagehide", sendPresenceUnload);
window.addEventListener("beforeunload", sendPresenceUnload);

// URL Query Parameter Parsing
var urlParams = new URLSearchParams(window.location.search);
currentAssetId = urlParams.get('id') || urlParams.get('asset_id');

// Strict Multi-Tenant Execution Guardrail & Boot via Platform Session Event
document.addEventListener("dashSessionLoaded", async function(e) {
  var u = window.dashUser;
  
  // Multi-Tenant Isolation Verification
  activeOrgId = (u && u.org_id && u.org_id !== "default_org") ? u.org_id : null;

  if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "") {
    var errMsg = "Invalid multi-tenant session context. Execution halted to prevent data leaks.";
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report(
        "asset-history.html: " + errMsg,
        "tenant-security-guardrail",
        new Error().stack
      );
    }
    displayMessage(errMsg, "error");
    document.querySelector(".history-container").style.opacity = "0.3";
    return;
  }

  // Fix Header Layout & Adjust Height Offset
  var ha = 0, hi = setInterval(function() {
    ha++;
    if (fixHeaderLayout() || ha > 50) {
      clearInterval(hi);
      updateHeaderOffset();
    }
  }, 100);

  // Configure sub-navigation links with asset context
  if (currentAssetId) {
    document.getElementById("lnkOverview").href = "/app/asset/asset-detail.html?id=" + encodeURIComponent(currentAssetId);
    document.getElementById("lnkConfig").href = "/app/dashboard/asset-config.html?id=" + encodeURIComponent(currentAssetId);
  }

  // Initialize presence tracking
  checkActivePresence();
  setInterval(checkActivePresence, 5000);

  if (currentAssetId) {
    await loadAssetInfo(currentAssetId);
    await loadAssetHistory(currentAssetId);
  } else {
    displayMessage("No Asset ID specified in navigation request.", "error");
  }

  updateHeaderOffset();
});

async function loadAssetInfo(assetId) {
  try {
    var resp = await fetch("/api/equipment/" + encodeURIComponent(assetId), {
      headers: { "x-org-id": activeOrgId }
    });
    if (resp.ok) {
      var data = await resp.json();
      var rec = data.record || data.equipment || data.data || data;
      humanAssetNumber = rec.asset_number || rec.assetNumber || "Asset #" + assetId;
      document.getElementById("txtAssetTitle").textContent = humanAssetNumber;
    }
  } catch (e) {
    reportClientError("Failed loading asset header info", "loadAssetInfo", e);
  }
}

// Normalized extraction helper across all worker payload standards
function extractRecords(resData) {
  if (Array.isArray(resData)) return resData;
  if (!resData || typeof resData !== "object") return [];
  if (Array.isArray(resData.records)) return resData.records;
  if (Array.isArray(resData.history)) return resData.history;
  if (Array.isArray(resData.audit_log)) return resData.audit_log;
  if (Array.isArray(resData.logs)) return resData.logs;
  if (Array.isArray(resData.data)) return resData.data;
  if (resData.results && Array.isArray(resData.results)) return resData.results;
  return [];
}

// Formatter for timestamp values (ISO, SQL string, or epoch)
function formatTimestamp(rawTime) {
  if (!rawTime) return "N/A";
  try {
    var dt;
    if (typeof rawTime === "number") {
      dt = new Date(rawTime);
    } else if (typeof rawTime === "string") {
      dt = new Date(rawTime.replace(' ', 'T'));
    }
    if (dt && !isNaN(dt.getTime())) {
      return dt.toLocaleString();
    }
  } catch(e) {}
  return String(rawTime);
}

/**
 * Formatter for audit event details & notes.
 * Returns a DOM node (not an HTML string) for XSS-safe insertion.
 */
function buildAuditDetailsNode(item) {
  var td = document.createElement("td");

  // Case 1: plain details/description string
  var detailsStr = "";
  if (item.details && typeof item.details === "string" && item.details.trim().length > 0) {
    detailsStr = item.details;
  } else if (item.description && typeof item.description === "string" && item.description.trim().length > 0) {
    detailsStr = item.description;
  }

  if (detailsStr) {
    td.textContent = detailsStr;
    return td;
  }

  // Case 2: before/after diff
  var beforeObj = parseJsonIfNeeded(item.before_data);
  var afterObj = parseJsonIfNeeded(item.after_data);

  if (beforeObj || afterObj) {
    if (beforeObj && afterObj && typeof beforeObj === "object" && typeof afterObj === "object") {
      var changes = [];
      var allKeys = Object.keys(Object.assign({}, beforeObj, afterObj));
      allKeys.forEach(function(k) {
        if (k === "updated_at" || k === "created_at" || k === "id" || k === "org_id" || k === "user_id") return;
        var valBefore = beforeObj[k];
        var valAfter = afterObj[k];
        if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
          var row = document.createElement("div");
          var strong = document.createElement("strong");
          strong.textContent = k + ":";
          row.appendChild(strong);
          row.appendChild(document.createTextNode(" " + (valBefore !== undefined ? String(valBefore) : "null") + " \u2192 " + (valAfter !== undefined ? String(valAfter) : "null")));
          changes.push(row);
        }
      });
      if (changes.length > 0) {
        changes.forEach(function(row) { td.appendChild(row); });
        return td;
      }
    }
    if (afterObj) {
      var pre = document.createElement("pre");
      pre.style.cssText = "margin:0; font-size:11px; white-space:pre-wrap;";
      try {
        pre.textContent = JSON.stringify(afterObj, null, 2);
      } catch(e) {
        pre.textContent = String(afterObj);
      }
      td.appendChild(pre);
      return td;
    }
  }

  // Case 3: fallback
  td.textContent = item.action
    ? item.action + ' event recorded for ' + (item.table_name || item.module || 'equipment')
    : 'Audit event logged';
  return td;
}

function parseJsonIfNeeded(val) {
  if (!val) return null;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch(e) { return null; }
  }
  return null;
}

async function loadAssetHistory(assetId) {
  if (!assetId) return;
  
  // Endpoints to try sequentially for audit log fetching
  var endpoints = [
    "/api/audit-log?record_id=" + encodeURIComponent(assetId) + "&module=equipment",
    "/api/equipment/history?id=" + encodeURIComponent(assetId),
    "/api/equipment/" + encodeURIComponent(assetId) + "/history"
  ];

  var records = null;
  var lastError = null;

  for (var i = 0; i < endpoints.length; i++) {
    try {
      var resp = await fetch(endpoints[i], {
        headers: { "x-org-id": activeOrgId }
      });

      if (resp.ok) {
        var resData = await resp.json();
        records = extractRecords(resData);
        break; // Successfully loaded and parsed
      }
    } catch (e) {
      lastError = e;
    }
  }

  var tbody = document.getElementById("historyTableBody");

  if (records !== null) {
    document.getElementById("recordCountBadge").textContent = records.length + " Events";

    if (records.length > 0) {
      clearChildren(tbody);
      records.forEach(function(item) {
        var rawTime = item.created_at || item.timestamp || item.created || item.date;
        var localTime = formatTimestamp(rawTime);
        var mod = item.module || item.table_name || 'Equipment';
        var usr = item.user_email || item.user_name || item.user_id || item.user || 'System';
        var act = item.action || item.event_type || item.event || 'Log';

        var tr = document.createElement("tr");

        var td1 = document.createElement("td");
        td1.textContent = localTime;
        tr.appendChild(td1);

        var td2 = document.createElement("td");
        var strong = document.createElement("strong");
        strong.textContent = mod;
        td2.appendChild(strong);
        tr.appendChild(td2);

        var td3 = document.createElement("td");
        td3.textContent = usr;
        tr.appendChild(td3);

        var td4 = document.createElement("td");
        td4.textContent = act;
        tr.appendChild(td4);

        // Details column — DOM-safe node builder
        var td5 = buildAuditDetailsNode(item);
        tr.appendChild(td5);

        tbody.appendChild(tr);
      });
    } else {
      clearChildren(tbody);
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 5;
      td.style.cssText = "text-align: center; color: var(--text-muted, #64748b); padding: 20px;";
      td.setAttribute("data-i18n", "");
      td.textContent = "No historical audit events recorded for this asset.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  } else {
    reportClientError("Failed loading asset audit log across endpoints", "loadAssetHistory", lastError || new Error("All endpoints failed"));
    displayMessage("Unable to retrieve historical audit log. Please check connection and try again.", "error");
    clearChildren(tbody);
    var errTr = document.createElement("tr");
    var errTd = document.createElement("td");
    errTd.colSpan = 5;
    errTd.style.cssText = "text-align: center; color: #ef4444; padding: 20px;";
    errTd.textContent = "\u26A0\uFE0F Error loading audit logs. Please refresh the page.";
    errTr.appendChild(errTd);
    tbody.appendChild(errTr);
  }
}

// Dynamic Customer Title Print Handler
function doPrintHistory() {
  var u = window.dashUser || {};
  var customerName = u.org_name || u.tenant_name || u.company_name || u.organization_name || "Organization";
  var assetIdentifier = humanAssetNumber || currentAssetId || "Log";

  // Set print document title dynamically excluding DRIV-EN branding
  document.title = customerName + " Audit History | Asset #" + assetIdentifier;
  
  window.print();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function confirmLogout() {
  if (confirm("Are you sure you want to log out?")) {
    dashLogout();
  }
}

// ===== EXPOSE FUNCTIONS FOR INLINE ONCLICK HANDLERS =====
window.doPrintHistory = doPrintHistory;
window.confirmLogout = confirmLogout;
