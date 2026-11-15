/* ==========================================================================
   DRIV-EN Platform — Onboarding: Clients JavaScript (v1)
   File: /app/onboarding/clients.js
   Extracted from clients.html for CSP compliance (no inline scripts).
   Fixed: missing `if` guard in dashSessionLoaded title creation.
   ========================================================================== */

var clients = [];
var existingClients = [];
var cliDirty = false;
var activeOrgId = null;
var customerOrgName = "DRIV-EN Org";

var sessionPageSize = 10, sessionPage = 1, sessionSortCol = 'name', sessionSortAsc = true;
var existingPageSize = 10, existingPage = 1, existingSortCol = 'name', existingSortAsc = true;

var cliError = document.getElementById("cliError");
var cliSuccess = document.getElementById("cliSuccess");
var cliTableContainer = document.getElementById("cliTableContainer");
var existingCliTableContainer = document.getElementById("existingCliTableContainer");
var cliStepStatus = document.getElementById("cliStepStatus");
var cliCountEl = document.getElementById("cliCount");
var existingCliCountEl = document.getElementById("existingCliCount");
var statusBulk = document.getElementById("statusBulk");
var bulkPreview = document.getElementById("bulkPreview");

function normalizeName(str) { 
  if (typeof str === "object" && str !== null) {
    str = str.client_name || str.name || str.clientName || "";
  }
  return String(str || "").trim().replace(/\s+/g, " "); 
}

function validateOrgContext() {
  if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "null") {
    if (cliError) cliError.textContent = "Security Alert: Invalid Organization Context. Action rejected.";
    return false;
  }
  return true;
}

function checkOfflineGuard(targetErrorElement) {
  if (!navigator.onLine) {
    var msg = "Internet connection required. Offline data entry is disabled for onboarding master data.";
    if (targetErrorElement) {
      targetErrorElement.textContent = msg;
      if (targetErrorElement.classList.contains("cli-step-status")) {
        targetErrorElement.style.color = "var(--error)";
      }
    }
    return true;
  }
  return false;
}

function sendPresenceUnload() {
  if (!activeOrgId) return;
  var payload = JSON.stringify({ page: "Clients", action: "leave" });
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
      body: JSON.stringify({ page: "Clients" })
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
  if (cliDirty) {
    e.preventDefault();
    e.returnValue = "You have unsaved clients.";
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
  var totalCount = existingClients.length + clients.length;
  if (cliCountEl) cliCountEl.textContent = totalCount;
  if (existingCliCountEl) existingCliCountEl.textContent = existingClients.length;
  try {
    localStorage.setItem("driven_client_count", String(totalCount));
  } catch (e) {}
}

function doPrintClients(defaultSelection) {
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
  document.title = customerOrgName + " | Client Directory";

  window.print();

  document.title = origTitle;
  document.body.classList.remove('print-session-only', 'print-existing-only', 'print-both');
  sessionPageSize = origSessionSize;
  existingPageSize = origExistingSize;
  renderTable();
  renderExistingTable();
}
window.doPrintClients = doPrintClients;

async function loadExistingClients() {
  existingCliTableContainer.textContent = "";
  if (navigator.onLine) {
    try {
      var resp = await fetch("/api/clients", {
        headers: { "x-org-id": activeOrgId || "" }
      });
      if (resp.ok) {
        var data = await resp.json();
        var rawList = data.clients || data.records || (Array.isArray(data) ? data : []);
        existingClients = rawList.map(function(item) {
          return {
            name: normalizeName(item),
            status: (typeof item === "object" && item.status) ? item.status : "Active"
          };
        });
        localStorage.setItem("driven_clients", JSON.stringify(existingClients));
        renderExistingTable();
        updateCount();
        return;
      }
    } catch (e) {
      console.warn("API load for existing clients failed, fallback to local storage:", e.message);
    }
  }
  parseCachedClients();
  renderExistingTable();
  updateCount();
}

function parseCachedClients() {
  try {
    var cached = JSON.parse(localStorage.getItem("driven_clients") || "[]");
    existingClients = cached.map(function(item) {
      return {
        name: normalizeName(item),
        status: (typeof item === "object" && item.status) ? item.status : "Active"
      };
    });
  } catch (err) {
    existingClients = [];
  }
}

function renderExistingTable() {
  existingCliTableContainer.textContent = "";
  if (existingClients.length === 0) {
    var empty = document.createElement("p");
    empty.className = "cli-empty";
    empty.textContent = "No existing clients in the system yet.";
    existingCliTableContainer.appendChild(empty);
    return;
  }

  var sorted = existingClients.slice().sort(function(a, b) {
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

  var wrap = document.createElement("div"); wrap.className = "cli-table-wrap";
  var table = document.createElement("table"); table.className = "cli-table";
  var thead = document.createElement("thead"); var headRow = document.createElement("tr");

  var cols = [
    { label: "Client Name " + (existingSortCol === 'name' ? (existingSortAsc ? '▲' : '▼') : ''), key: "name" },
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
  paged.forEach(function(cli) {
    var row = document.createElement("tr");
    var cell = document.createElement("td");
    cell.textContent = (cli.name && cli.name !== "undefined" && cli.name !== "null") ? cli.name : "—";
    row.appendChild(cell);

    var cellStatus = document.createElement("td");
    cellStatus.textContent = cli.status || "Active";
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

  existingCliTableContainer.appendChild(wrap);
  existingCliTableContainer.appendChild(pBar);

  if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
}

function renderTable() {
  cliTableContainer.textContent = "";
  if (clients.length === 0) { 
    var empty = document.createElement("p"); 
    empty.className = "cli-empty"; 
    empty.textContent = "No new clients added in this session yet."; 
    cliTableContainer.appendChild(empty); 
    return; 
  }

  var sorted = clients.slice().sort(function(a, b) {
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

  var wrap = document.createElement("div"); wrap.className = "cli-table-wrap";
  var table = document.createElement("table"); table.className = "cli-table";
  var thead = document.createElement("thead"); var headRow = document.createElement("tr");

  var cols = [
    { label: "Client Name " + (sessionSortCol === 'name' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "name" },
    { label: "Status", key: "status" },
    { label: "Action", key: "" }
  ];

  cols.forEach(function(c) {
    var th = document.createElement("th");
    th.textContent = c.label;
    if (c.label === "Action") th.className = "cli-actions-col";
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
  paged.forEach(function(cli, index) {
    var row = document.createElement("tr");
    var cellName = document.createElement("td"); 
    cellName.textContent = cli.name || "—"; 
    row.appendChild(cellName);

    var cellStatus = document.createElement("td");
    cellStatus.textContent = cli.status || "Active";
    row.appendChild(cellStatus);

    var cellAction = document.createElement("td"); 
    cellAction.className = "cli-actions-col"; 
    var btn = document.createElement("button");
    btn.className = "cli-btn-secondary"; 
    btn.style.cssText = "padding:4px 10px;font-size:12px;height:auto;"; 
    btn.textContent = "Remove";
    btn.addEventListener("click", function() { removeClient(start + index); }); 
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

  cliTableContainer.appendChild(wrap);
  cliTableContainer.appendChild(pBar);

  if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
}

function removeClient(index) { clients.splice(index, 1); renderTable(); updateCount(); cliSuccess.textContent = ""; cliError.textContent = ""; cliDirty = true; }

window.switchTab = function(tab) {
  var tabSingle = document.getElementById("tabSingle"); var tabBulk = document.getElementById("tabBulk");
  var contentSingle = document.getElementById("tabContentSingle"); var contentBulk = document.getElementById("tabContentBulk");
  if (tab === "single") { tabSingle.classList.add("active"); tabBulk.classList.remove("active"); contentSingle.style.display = "block"; contentBulk.style.display = "none"; }
  else { tabBulk.classList.add("active"); tabSingle.classList.remove("active"); contentBulk.style.display = "block"; contentSingle.style.display = "none"; }
};

window.confirmLeave = function() { if (cliDirty) { return confirm("You have unsaved clients. Click OK to leave without saving, or Cancel to stay and save them."); } return true; };
window.confirmLogout = function() { if (cliDirty) { if (!confirm("You have unsaved clients. Click OK to log out without saving, or Cancel to stay and save them.")) return; } dashLogout(); };

document.getElementById("btnAddCli").addEventListener("click", function() {
  if (!validateOrgContext()) return;
  if (checkOfflineGuard(cliError)) return;
  cliError.textContent = ""; cliSuccess.textContent = "";
  var name = normalizeName(document.getElementById("cliName").value);

  if (!name) { cliError.textContent = "Client Name is required."; return; }

  var checkName = name.toLowerCase().trim();
  var nameMatch = existingClients.some(function(cli) { 
    return (cli.name || "").toLowerCase().trim() === checkName; 
  }) || clients.some(function(cli) { 
    return (cli.name || "").toLowerCase().trim() === checkName; 
  });

  if (nameMatch) {
    var confirmAdd = confirm("⚠️ A client named '" + name + "' already exists in the system or current batch.\n\nWould you like to add region or division info to differentiate it, or proceed anyway?");
    if (!confirmAdd) return;
  }

  clients.push({ 
    name: name, 
    client_name: name,
    status: "Active" 
  });
  renderTable(); updateCount();
  document.getElementById("cliName").value = ""; 
  document.getElementById("cliName").focus();
  cliSuccess.textContent = "Client added to current batch. Click Save & Continue when finished.";
  cliDirty = true;
});

document.getElementById("cliName").addEventListener("keydown", function(e) { 
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("btnAddCli").click(); } 
});

document.getElementById("btnProcessBulk").addEventListener("click", function() {
  if (!validateOrgContext()) return;
  if (checkOfflineGuard(statusBulk)) return;
  statusBulk.textContent = ""; statusBulk.className = "cli-error";
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

      var requiredName = "Client Name";
      var header = Object.keys(rows[0]);
      if (header.indexOf(requiredName) === -1) { statusBulk.textContent = "Missing required column: " + requiredName; return; }

      for (var r = 0; r < rows.length; r++) {
        if (!rows[r][requiredName] || String(rows[r][requiredName]).trim() === "") { statusBulk.textContent = "Row " + (r + 2) + ": Client Name is required."; return; }
      }

      var seenNames = {};
      for (var d = 0; d < rows.length; d++) {
        var nm = normalizeName(rows[d][requiredName]).toLowerCase();
        if (seenNames[nm]) { statusBulk.textContent = "Duplicate client name: " + nm + " (rows " + seenNames[nm] + " and " + (d + 2) + ")."; return; }
        seenNames[nm] = (d + 2);
      }

      var bulkClients = rows.map(function(row) {
        var nm = normalizeName(row[requiredName]);
        return { 
          name: nm, 
          client_name: nm, 
          status: "Active" 
        };
      });

      bulkPreview.textContent = ""; 
      var pTable = document.createElement("table"); 
      var pThead = document.createElement("thead"); 
      var pHeadRow = document.createElement("tr");
      var pTh = document.createElement("th"); pTh.textContent = "Client Name"; pHeadRow.appendChild(pTh);
      pThead.appendChild(pHeadRow); pTable.appendChild(pThead); 

      var pTbody = document.createElement("tbody");
      bulkClients.forEach(function(c) { 
        var pRow = document.createElement("tr"); 
        var pCell = document.createElement("td"); pCell.textContent = c.name; pRow.appendChild(pCell); 
        pTbody.appendChild(pRow); 
      });
      pTable.appendChild(pTbody); bulkPreview.appendChild(pTable);

      clients = clients.concat(bulkClients); 
      renderTable(); updateCount();
      statusBulk.textContent = "Uploaded " + bulkClients.length + " clients. Review above and click Save & Continue."; 
      statusBulk.className = "cli-success"; 
      cliDirty = true;
    } catch(parseErr) {
      statusBulk.textContent = "Could not parse the file. Make sure it is a valid Excel (.xlsx) or CSV file with a 'Client Name' column.";
      statusBulk.className = "cli-error";
      if (window.DRIVENErrorHandler) { window.DRIVENErrorHandler.report("clients.html: bulk upload parse failed — " + (parseErr.message || parseErr), "bulk-upload-parse", parseErr && parseErr.stack ? parseErr.stack : null); }
    }
  };
  if (file.name.toLowerCase().endsWith(".csv")) { reader.readAsText(file); } else { reader.readAsArrayBuffer(file); }
});

document.getElementById("btnSaveCli").addEventListener("click", async function() {
  if (!validateOrgContext()) return;
  if (checkOfflineGuard(cliStepStatus)) return;
  cliStepStatus.textContent = ""; cliStepStatus.style.color = "var(--error)";
  if (clients.length === 0 && existingClients.length === 0) { 
    cliStepStatus.textContent = "You must add at least one client."; 
    return; 
  }

  var allClients;
  try {
    allClients = existingClients.concat(clients);
    localStorage.setItem("driven_clients", JSON.stringify(allClients));
    localStorage.setItem("driven_client_count", String(allClients.length));
  } catch(lsErr) {
    console.warn("localStorage save failed:", lsErr.message);
    if (window.DRIVENErrorHandler) { window.DRIVENErrorHandler.report("clients.html: localStorage save failed — " + (lsErr.message || lsErr), "save-localStorage", lsErr && lsErr.stack ? lsErr.stack : null); }
    allClients = clients.slice();
  }

  var btnSave = document.getElementById("btnSaveCli");
  btnSave.disabled = true; 
  btnSave.textContent = "Saving to Database...";

  var saveErrors = [];
  for (var i = 0; i < clients.length; i++) {
    var cli = clients[i];
    try {
      var d1Res = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-org-id": activeOrgId || ""
        },
        body: JSON.stringify({
          client_name: cli.client_name || cli.name,
          status: "Active"
        })
      });
      if (!d1Res.ok) {
        var errJson = await d1Res.json().catch(function() { return {}; });
        saveErrors.push(cli.name + ": " + (errJson.error || "D1 insert failed"));
      }
    } catch (d1Err) {
      saveErrors.push(cli.name + ": " + d1Err.message);
    }
  }

  try {
    var res = await fetch("/auth/save-settings", { 
      method: "POST", 
      headers: { 
        "Content-Type": "application/json",
        "x-org-id": activeOrgId || ""
      }, 
      body: JSON.stringify({ settings: { clients: allClients } }) 
    });
    var data = await res.json();
    if (!res.ok) {
      if (res.status < 500 && window.DRIVENErrorHandler) { 
        window.DRIVENErrorHandler.report("clients.html: save-settings returned " + res.status + " — " + (data.error || "Request failed"), "save-settings-" + res.status, "URL: /auth/save-settings | Clients: " + allClients.length); 
      }
      throw new Error(data.error || "Save settings failed");
    }

    cliStepStatus.style.color = "var(--success)";
    cliStepStatus.textContent = clients.length + " client(s) saved to D1. Total clients: " + allClients.length + ". Redirecting to onboarding dashboard…";
    btnSave.textContent = "Saved ✓"; 
    cliDirty = false;
    clients = [];
    await loadExistingClients();
    renderTable(); 
    updateCount();

    setTimeout(function() { 
      btnSave.disabled = false; 
      btnSave.textContent = "Save & Continue"; 
      window.location.href = "/app/dashboard/onboarding-dashboard.html"; 
    }, 1500);

  } catch(err) {
    cliStepStatus.style.color = "var(--error)";
    cliStepStatus.textContent = "Saved locally, but server save failed: " + (saveErrors.length ? saveErrors.join("; ") : err.message);
    btnSave.disabled = false; 
    btnSave.textContent = "Save & Continue";
    if (window.DRIVENErrorHandler) { 
      window.DRIVENErrorHandler.report("clients.html: save failed — " + (err.message || err), "save-settings-catch", err && err.stack ? err.stack : null); 
    }
  }
});

function downloadClientTemplate() {
  var ws = XLSX.utils.aoa_to_sheet([["Client Name"]]);
  ws["!cols"] = [{ wch: 60 }];
  downloadXlsxWithFrozenHeader(ws, "Clients", "Client-Mass-Upload-v1.0.xlsx");
}
window.downloadClientTemplate = downloadClientTemplate;

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
  if (row1 && !document.querySelector(".cli-header-title")) {
    var title = document.createElement("div");
    title.className = "cli-header-title";
    title.textContent = "Onboarding — Clients"; 
    var logoArea = document.getElementById("dashCustomerLogoArea"); 
    var drivenLogo = row1.querySelector(".dash-driven-logo"); 
    if (logoArea && drivenLogo) { row1.insertBefore(title, drivenLogo); } 
  }

  loadExistingClients(); 
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
