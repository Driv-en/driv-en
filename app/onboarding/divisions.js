/* ==========================================================================
   DRIV-EN Platform — Onboarding: Divisions JavaScript (v1)
   File: /app/onboarding/divisions.js
   Extracted from divisions.html for CSP compliance (no inline scripts).
   Fixed: missing `if` guard in dashSessionLoaded title creation.
   ========================================================================== */

var divisions = [];
var existingDivisions = [];
var divDirty = false;
var activeOrgId = null;
var customerOrgName = "DRIV-EN Org";

var sessionPageSize = 10, sessionPage = 1, sessionSortCol = 'name', sessionSortAsc = true;
var existingPageSize = 10, existingPage = 1, existingSortCol = 'name', existingSortAsc = true;

var divError = document.getElementById("divError");
var divSuccess = document.getElementById("divSuccess");
var divTableContainer = document.getElementById("divTableContainer");
var existingDivTableContainer = document.getElementById("existingDivTableContainer");
var divStepStatus = document.getElementById("divStepStatus");
var divCountEl = document.getElementById("divCount");
var existingDivCountEl = document.getElementById("existingDivCount");
var statusBulk = document.getElementById("statusBulk");
var bulkPreview = document.getElementById("bulkPreview");

function normalizeName(str) { 
  if (typeof str === 'object' && str !== null) {
    str = str.name || str.division_name || str.divisionName || "";
  }
  return String(str || "").trim().replace(/\s+/g, " "); 
}

function validateOrgContext() {
  if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "null") {
    if (divError) divError.textContent = "Security Alert: Invalid Organization Context. Action rejected.";
    return false;
  }
  return true;
}

function sendPresenceUnload() {
  if (!activeOrgId) return;
  var payload = JSON.stringify({ page: "Divisions", action: "leave" });
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
  if (!navigator.onLine) return;
  try {
    var resp = await fetch("/api/onboarding/presence", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-org-id": activeOrgId || ""
      },
      body: JSON.stringify({ page: "Divisions" })
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
        textEl.textContent = "🟢 " + fullNames.join(", ") + " is also active on this page";
        banner.style.display = "inline-flex";
      } else {
        banner.style.display = "none";
      }
    }
  } catch (e) {}
}

window.addEventListener("pagehide", sendPresenceUnload);
window.addEventListener("beforeunload", function(e) {
  sendPresenceUnload();
  if (divDirty) {
    e.preventDefault();
    e.returnValue = "You have unsaved divisions.";
  }
});
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") {
    sendPresenceUnload();
  } else if (document.visibilityState === "visible") {
    checkActivePresence();
  }
});

function updateCount() {
  var totalCount = existingDivisions.length + divisions.length;
  if (divCountEl) divCountEl.textContent = totalCount;
  if (existingDivCountEl) existingDivCountEl.textContent = existingDivisions.length;
  try {
    localStorage.setItem("driven_division_count", String(totalCount));
  } catch (e) {}
}

function doPrintDivisions(defaultSelection) {
  var selId = defaultSelection === 'session' ? 'printTableSelectSession' : 'printTableSelectExisting';
  var mode = document.getElementById(selId).value;
  
  document.body.classList.remove('print-session-only', 'print-existing-only', 'print-both');
  
  if (mode === 'session') {
    document.body.classList.add('print-session-only');
  } else if (mode === 'existing') {
    document.body.classList.add('print-existing-only');
  } else {
    document.body.classList.add('print-both');
  }

  var origSessionSize = sessionPageSize;
  var origExistingSize = existingPageSize;
  sessionPageSize = 9999;
  existingPageSize = 9999;
  renderTable();
  renderExistingTable();

  var origTitle = document.title;
  document.title = customerOrgName + " | Division Directory";

  window.print();

  document.title = origTitle;
  document.body.classList.remove('print-session-only', 'print-existing-only', 'print-both');
  sessionPageSize = origSessionSize;
  existingPageSize = origExistingSize;
  renderTable();
  renderExistingTable();
}
window.doPrintDivisions = doPrintDivisions;

async function loadExistingDivisions() {
  existingDivTableContainer.textContent = "";
  
  if (navigator.onLine) {
    try {
      var resp = await fetch("/api/divisions", {
        headers: { "x-org-id": activeOrgId || "" }
      });
      if (resp.ok) {
        var data = await resp.json();
        var rawList = data.divisions || data.records || (Array.isArray(data) ? data : []);
        existingDivisions = rawList.map(function(item) {
          var cleanName = normalizeName(item);
          return {
            name: cleanName,
            status: (item && item.status) || "Active"
          };
        });
        localStorage.setItem("driven_divisions", JSON.stringify(existingDivisions));
        renderExistingTable();
        updateCount();
        return;
      }
    } catch (e) {
      console.warn("API load for existing divisions failed, falling back to local cache:", e.message);
    }
  }

  var cached = JSON.parse(localStorage.getItem("driven_divisions") || "[]");
  existingDivisions = cached.map(function(item) {
    return {
      name: normalizeName(item),
      status: (item && item.status) || "Active"
    };
  });
  renderExistingTable();
  updateCount();
}

function renderExistingTable() {
  existingDivTableContainer.textContent = "";
  if (existingDivisions.length === 0) {
    var empty = document.createElement("p");
    empty.className = "div-empty";
    empty.textContent = "No existing divisions in the system yet.";
    existingDivTableContainer.appendChild(empty);
    return;
  }

  var sorted = existingDivisions.slice().sort(function(a, b) {
    var va = (a[existingSortCol] || '').toString().toLowerCase();
    var vb = (b[existingSortCol] || '').toString().toLowerCase();
    if (va < vb) return existingSortAsc ? -1 : 1;
    if (va > vb) return existingSortAsc ? 1 : -1;
    return 0;
  });

  var totalPages = Math.ceil(sorted.length / existingPageSize) || 1;
  if (existingPage > totalPages) existingPage = totalPages;
  var start = (existingPage - 1) * existingPageSize;
  var paged = sorted.slice(start, start + existingPageSize);

  var wrap = document.createElement("div"); wrap.className = "div-table-wrap";
  var table = document.createElement("table"); table.className = "div-table";
  var thead = document.createElement("thead"); var headRow = document.createElement("tr");

  var cols = [
    { label: "Division Name " + (existingSortCol === 'name' ? (existingSortAsc ? '▲' : '▼') : ''), key: "name" },
    { label: "Status", key: "status" }
  ];

  cols.forEach(function(c) {
    var th = document.createElement("th");
    th.textContent = c.label;
    if (c.key) {
      th.onclick = function() {
        if (existingSortCol === c.key) existingSortAsc = !existingSortAsc;
        else { existingSortCol = c.key; existingSortAsc = true; }
        renderExistingTable();
      };
    }
    headRow.appendChild(th);
  });
  thead.appendChild(headRow); table.appendChild(thead);

  var tbody = document.createElement("tbody");
  paged.forEach(function(div) {
    var row = document.createElement("tr");
    var cell = document.createElement("td");
    cell.textContent = (div.name && div.name !== "undefined" && div.name !== "null") ? div.name : "—";
    row.appendChild(cell);

    var cellStatus = document.createElement("td");
    cellStatus.textContent = div.status || "Active";
    row.appendChild(cellStatus);

    tbody.appendChild(row);
  });
  table.appendChild(tbody); wrap.appendChild(table);

  var pBar = document.createElement("div"); pBar.className = "um-pagination-bar";
  var pInfo = document.createElement("div");
  pInfo.textContent = "Showing " + (start + 1) + " - " + Math.min(start + existingPageSize, sorted.length) + " of " + sorted.length;
  
  var pCtrl = document.createElement("div"); pCtrl.className = "um-pagination-controls";
  var pSelect = document.createElement("select");
  [10, 25, 50].forEach(function(sz) {
    var opt = document.createElement("option"); opt.value = sz; opt.textContent = sz + " per page";
    if (sz === existingPageSize) opt.selected = true;
    pSelect.appendChild(opt);
  });
  pSelect.onchange = function() { existingPageSize = parseInt(this.value); existingPage = 1; renderExistingTable(); };

  var btnPrev = document.createElement("button"); btnPrev.className = "um-pagination-btn"; btnPrev.textContent = "◄ Prev";
  btnPrev.disabled = existingPage === 1;
  btnPrev.onclick = function() { existingPage--; renderExistingTable(); };

  var btnNext = document.createElement("button"); btnNext.className = "um-pagination-btn"; btnNext.textContent = "Next ►";
  btnNext.disabled = existingPage === totalPages;
  btnNext.onclick = function() { existingPage++; renderExistingTable(); };

  pCtrl.appendChild(pSelect); pCtrl.appendChild(btnPrev); pCtrl.appendChild(btnNext);
  pBar.appendChild(pInfo); pBar.appendChild(pCtrl);

  existingDivTableContainer.appendChild(wrap);
  existingDivTableContainer.appendChild(pBar);

  if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
}

function renderTable() {
  divTableContainer.textContent = "";
  if (divisions.length === 0) { 
    var empty = document.createElement("p"); 
    empty.className = "div-empty"; 
    empty.textContent = "No new divisions added in this session yet."; 
    divTableContainer.appendChild(empty); 
    return; 
  }

  var sorted = divisions.slice().sort(function(a, b) {
    var va = (a[sessionSortCol] || '').toString().toLowerCase();
    var vb = (b[sessionSortCol] || '').toString().toLowerCase();
    if (va < vb) return sessionSortAsc ? -1 : 1;
    if (va > vb) return sessionSortAsc ? 1 : -1;
    return 0;
  });

  var totalPages = Math.ceil(sorted.length / sessionPageSize) || 1;
  if (sessionPage > totalPages) sessionPage = totalPages;
  var start = (sessionPage - 1) * sessionPageSize;
  var paged = sorted.slice(start, start + sessionPageSize);

  var wrap = document.createElement("div"); wrap.className = "div-table-wrap";
  var table = document.createElement("table"); table.className = "div-table";
  var thead = document.createElement("thead"); var headRow = document.createElement("tr");

  var cols = [
    { label: "Division Name " + (sessionSortCol === 'name' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "name" },
    { label: "Status", key: "status" },
    { label: "Action", key: "" }
  ];

  cols.forEach(function(c) {
    var th = document.createElement("th");
    th.textContent = c.label;
    if (c.label === "Action") th.className = "div-actions-col";
    if (c.key) {
      th.onclick = function() {
        if (sessionSortCol === c.key) sessionSortAsc = !sessionSortAsc;
        else { sessionSortCol = c.key; sessionSortAsc = true; }
        renderTable();
      };
    }
    headRow.appendChild(th);
  });
  thead.appendChild(headRow); table.appendChild(thead);

  var tbody = document.createElement("tbody");
  paged.forEach(function(div, index) {
    var row = document.createElement("tr");
    var cellName = document.createElement("td"); 
    cellName.textContent = div.name || "—"; 
    row.appendChild(cellName);

    var cellStatus = document.createElement("td");
    cellStatus.textContent = div.status || "Active";
    row.appendChild(cellStatus);

    var cellAction = document.createElement("td"); 
    cellAction.className = "div-actions-col"; 
    var btn = document.createElement("button");
    btn.className = "div-btn-secondary"; 
    btn.style.cssText = "padding:4px 10px;font-size:12px;height:auto;"; 
    btn.textContent = "Remove";
    btn.addEventListener("click", function() { removeDivision(start + index); }); 
    cellAction.appendChild(btn); 
    row.appendChild(cellAction); 
    tbody.appendChild(row);
  });
  table.appendChild(tbody); wrap.appendChild(table);

  var pBar = document.createElement("div"); pBar.className = "um-pagination-bar";
  var pInfo = document.createElement("div");
  pInfo.textContent = "Showing " + (start + 1) + " - " + Math.min(start + sessionPageSize, sorted.length) + " of " + sorted.length;
  
  var pCtrl = document.createElement("div"); pCtrl.className = "um-pagination-controls";
  var pSelect = document.createElement("select");
  [10, 25, 50].forEach(function(sz) {
    var opt = document.createElement("option"); opt.value = sz; opt.textContent = sz + " per page";
    if (sz === sessionPageSize) opt.selected = true;
    pSelect.appendChild(opt);
  });
  pSelect.onchange = function() { sessionPageSize = parseInt(this.value); sessionPage = 1; renderTable(); };

  var btnPrev = document.createElement("button"); btnPrev.className = "um-pagination-btn"; btnPrev.textContent = "◄ Prev";
  btnPrev.disabled = sessionPage === 1;
  btnPrev.onclick = function() { sessionPage--; renderTable(); };

  var btnNext = document.createElement("button"); btnNext.className = "um-pagination-btn"; btnNext.textContent = "Next ►";
  btnNext.disabled = sessionPage === totalPages;
  btnNext.onclick = function() { sessionPage++; renderTable(); };

  pCtrl.appendChild(pSelect); pCtrl.appendChild(btnPrev); pCtrl.appendChild(btnNext);
  pBar.appendChild(pInfo); pBar.appendChild(pCtrl);

  divTableContainer.appendChild(wrap);
  divTableContainer.appendChild(pBar);

  if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
}

function removeDivision(index) { divisions.splice(index, 1); renderTable(); updateCount(); divSuccess.textContent = ""; divError.textContent = ""; divDirty = true; }

window.switchTab = function(tab) {
  var tabSingle = document.getElementById("tabSingle"); var tabBulk = document.getElementById("tabBulk");
  var contentSingle = document.getElementById("tabContentSingle"); var contentBulk = document.getElementById("tabContentBulk");
  if (tab === "single") { tabSingle.classList.add("active"); tabBulk.classList.remove("active"); contentSingle.style.display = "block"; contentBulk.style.display = "none"; }
  else { tabBulk.classList.add("active"); tabSingle.classList.remove("active"); contentBulk.style.display = "block"; contentSingle.style.display = "none"; }
};

window.confirmLeave = function() { if (divDirty) { return confirm("You have unsaved divisions. Click OK to leave without saving, or Cancel to stay and save them."); } return true; };
window.confirmLogout = function() { if (divDirty) { if (!confirm("You have unsaved divisions. Click OK to log out without saving, or Cancel to stay and save them.")) return; } dashLogout(); };

document.getElementById("btnAddDiv").addEventListener("click", function() {
  if (!validateOrgContext()) return;
  divError.textContent = ""; divSuccess.textContent = "";
  var name = normalizeName(document.getElementById("divName").value);

  if (!name) { divError.textContent = "Division Name is required."; return; }

  var checkName = name.toLowerCase().trim();
  var nameMatch = existingDivisions.some(function(div) { 
    return (div.name || "").toLowerCase().trim() === checkName; 
  }) || divisions.some(function(div) { 
    return (div.name || "").toLowerCase().trim() === checkName; 
  });

  if (nameMatch) {
    var confirmAdd = confirm("⚠️ A division named '" + name + "' already exists in the system or current batch.\n\nWould you like to add region or region code details to differentiate it, or proceed anyway?");
    if (!confirmAdd) return;
  }

  divisions.push({ 
    name: name,
    division_name: name,
    status: "Active" 
  });
  renderTable(); updateCount();
  document.getElementById("divName").value = ""; 
  document.getElementById("divName").focus();
  divSuccess.textContent = "Division added to current batch. Click Save & Continue when finished.";
  divDirty = true;
});

document.getElementById("divName").addEventListener("keydown", function(e) { 
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("btnAddDiv").click(); } 
});

document.getElementById("btnProcessBulk").addEventListener("click", function() {
  if (!validateOrgContext()) return;
  statusBulk.textContent = ""; statusBulk.className = "div-error";
  var file = document.getElementById("bulkFile").files[0];
  if (!file) { statusBulk.textContent = "Please select an Excel or CSV file."; return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var rows; var isCsv = file.name.toLowerCase().endsWith(".csv");
      if (isCsv) {
        var text = e.target.result; var lines = text.split(/\r?\n/).filter(function(l) { return l.trim() !== ""; });
        if (lines.length < 2) { statusBulk.textContent = "The CSV file is empty or has no data rows."; return; }
        var headers = parseCsvLine(lines[0]);
        rows = lines.slice(1).map(function(line) { var values = parseCsvLine(line); var obj = {}; headers.forEach(function(h, i) { obj[h] = values[i] || ""; }); return obj; });
      } else {
        var workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        var sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet);
      }
      if (rows.length === 0) { statusBulk.textContent = "The file is empty."; return; }

      var requiredName = "Division Name";
      var header = Object.keys(rows[0]);
      if (header.indexOf(requiredName) === -1) { statusBulk.textContent = "Missing required column: " + requiredName; return; }

      for (var r = 0; r < rows.length; r++) {
        if (!rows[r][requiredName] || String(rows[r][requiredName]).trim() === "") { statusBulk.textContent = "Row " + (r + 2) + ": Division Name is required."; return; }
      }

      var seenNames = {};
      for (var d = 0; d < rows.length; d++) {
        var nm = normalizeName(rows[d][requiredName]).toLowerCase();
        if (seenNames[nm]) { statusBulk.textContent = "Duplicate division name: " + nm + " (rows " + seenNames[nm] + " and " + (d + 2) + ")."; return; }
        seenNames[nm] = (d + 2);
      }

      var bulkDivisions = rows.map(function(row) {
        var nm = normalizeName(row[requiredName]);
        return { 
          name: nm, 
          division_name: nm, 
          status: "Active" 
        };
      });

      bulkPreview.textContent = ""; 
      var pTable = document.createElement("table"); 
      var pThead = document.createElement("thead"); 
      var pHeadRow = document.createElement("tr");
      var pTh = document.createElement("th"); pTh.textContent = "Division Name"; pHeadRow.appendChild(pTh);
      pThead.appendChild(pHeadRow); pTable.appendChild(pThead); 

      var pTbody = document.createElement("tbody");
      bulkDivisions.forEach(function(d) { 
        var pRow = document.createElement("tr"); 
        var pCell = document.createElement("td"); pCell.textContent = d.name; pRow.appendChild(pCell); 
        pTbody.appendChild(pRow); 
      });
      pTable.appendChild(pTbody); bulkPreview.appendChild(pTable);

      divisions = divisions.concat(bulkDivisions); 
      renderTable(); updateCount();
      statusBulk.textContent = "Uploaded " + bulkDivisions.length + " divisions. Review above and click Save & Continue."; 
      statusBulk.className = "div-success"; 
      divDirty = true;
    } catch(parseErr) {
      statusBulk.textContent = "Could not parse the file. Make sure it is a valid Excel (.xlsx) or CSV file with a 'Division Name' column.";
      statusBulk.className = "div-error";
      if (window.DRIVENErrorHandler) { window.DRIVENErrorHandler.report("divisions.html: bulk upload parse failed — " + (parseErr.message || parseErr), "bulk-upload-parse", parseErr && parseErr.stack ? parseErr.stack : null); }
    }
  };
  if (file.name.toLowerCase().endsWith(".csv")) { reader.readAsText(file); } else { reader.readAsArrayBuffer(file); }
});

document.getElementById("btnSaveDiv").addEventListener("click", async function() {
  if (!validateOrgContext()) return;
  divStepStatus.textContent = ""; divStepStatus.style.color = "var(--error)";

  if (!navigator.onLine) {
    divStepStatus.textContent = "Network error: An active internet connection is required to create or save structural master data to Cloudflare D1.";
    return;
  }

  if (divisions.length === 0 && existingDivisions.length === 0) { 
    divStepStatus.textContent = "You must add at least one division."; 
    return; 
  }

  var allDivisions;
  try {
    allDivisions = existingDivisions.concat(divisions);
    localStorage.setItem("driven_divisions", JSON.stringify(allDivisions));
    localStorage.setItem("driven_division_count", String(allDivisions.length));
  } catch(lsErr) {
    console.warn("localStorage save failed:", lsErr.message);
    if (window.DRIVENErrorHandler) { window.DRIVENErrorHandler.report("divisions.html: localStorage save failed — " + (lsErr.message || lsErr), "save-localStorage", lsErr && lsErr.stack ? lsErr.stack : null); }
    allDivisions = divisions.slice();
  }

  var btnSave = document.getElementById("btnSaveDiv");
  btnSave.disabled = true; 
  btnSave.textContent = "Saving to Database...";

  var saveErrors = [];
  for (var i = 0; i < divisions.length; i++) {
    var divItem = divisions[i];
    try {
      var d1Res = await fetch("/api/divisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-org-id": activeOrgId || ""
        },
        body: JSON.stringify({
          name: divItem.name || divItem.division_name,
          status: "Active"
        })
      });
      if (!d1Res.ok) {
        var errJson = await d1Res.json().catch(function() { return {}; });
        saveErrors.push(divItem.name + ": " + (errJson.error || "D1 insert failed"));
      }
    } catch (d1Err) {
      saveErrors.push(divItem.name + ": " + d1Err.message);
    }
  }

  try {
    var res = await fetch("/auth/save-settings", { 
      method: "POST", 
      headers: { 
        "Content-Type": "application/json",
        "x-org-id": activeOrgId || ""
      }, 
      body: JSON.stringify({ settings: { divisions: allDivisions } }) 
    });
    var data = await res.json();
    if (!res.ok) {
      if (res.status < 500 && window.DRIVENErrorHandler) { 
        window.DRIVENErrorHandler.report("divisions.html: save-settings returned " + res.status + " — " + (data.error || "Request failed"), "save-settings-" + res.status, "URL: /auth/save-settings | Divisions: " + allDivisions.length); 
      }
      throw new Error(data.error || "Save settings failed");
    }

    divStepStatus.style.color = "var(--success)";
    divStepStatus.textContent = divisions.length + " division(s) saved to D1. Total divisions: " + allDivisions.length + ". Redirecting to onboarding dashboard…";
    btnSave.textContent = "Saved ✓"; 
    divDirty = false;
    divisions = [];
    await loadExistingDivisions();
    renderTable(); 
    updateCount();

    if (window.BroadcastChannel) {
      try {
        var bc = new BroadcastChannel("driven_onboarding_sync");
        bc.postMessage({ type: "driven_completion_updated" });
      } catch(e){}
    }

    setTimeout(function() { 
      btnSave.disabled = false; 
      btnSave.textContent = "Save & Continue"; 
      window.location.href = "/app/dashboard/onboarding-dashboard.html"; 
    }, 1500);

  } catch(err) {
    divStepStatus.style.color = "var(--error)";
    divStepStatus.textContent = "Server save failed: " + (saveErrors.length ? saveErrors.join("; ") : err.message);
    btnSave.disabled = false; 
    btnSave.textContent = "Save & Continue";
    if (window.DRIVENErrorHandler) { 
      window.DRIVENErrorHandler.report("divisions.html: save failed — " + (err.message || err), "save-settings-catch", err && err.stack ? err.stack : null); 
    }
  }
});

function downloadDivisionTemplate() {
  var ws = XLSX.utils.aoa_to_sheet([["Division Name"]]);
  ws["!cols"] = [{ wch: 60 }];
  downloadXlsxWithFrozenHeader(ws, "Divisions", "Division-Mass-Upload-v1.0.xlsx");
}
window.downloadDivisionTemplate = downloadDivisionTemplate;

function parseCsvLine(line) {
  var result = []; var current = ""; var inQuotes = false;
  for (var i = 0; i < line.length; i++) { var ch = line[i]; if (inQuotes) { if (ch === '"') { if (line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; } } else { current += ch; } } else { if (ch === '"') { inQuotes = true; } else if (ch === ",") { result.push(current.trim()); current = ""; } else { current += ch; } } }
  result.push(current.trim()); return result;
}

document.addEventListener("dashSessionLoaded", function(e) {
  var userObj = JSON.parse(localStorage.getItem("driven_user") || "{}");
  activeOrgId = userObj.org_id || (e.detail && e.detail.org_id) || localStorage.getItem("driven_org_id");
  customerOrgName = (e.detail && e.detail.org_name) || localStorage.getItem("driven_org_name") || "DRIV-EN Org";

  var row1 = document.querySelector(".dash-header-row1");
  if (row1 && !document.querySelector(".div-header-title")) {
    var title = document.createElement("div");
    title.className = "div-header-title";
    title.textContent = "Onboarding — Divisions"; 
    var logoArea = document.getElementById("dashCustomerLogoArea"); 
    var drivenLogo = row1.querySelector(".dash-driven-logo"); 
    if (logoArea && drivenLogo) { row1.insertBefore(title, drivenLogo); } 
  }

  loadExistingDivisions(); 
  renderTable(); 
  updateCount();

  checkActivePresence();
  setInterval(checkActivePresence, 5000);
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function() {
    var yEl = document.getElementById("dashFooterYear");
    if (yEl) yEl.textContent = new Date().getFullYear();
  });
} else {
  var yEl = document.getElementById("dashFooterYear");
  if (yEl) yEl.textContent = new Date().getFullYear();
}
