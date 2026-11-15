/* ==========================================================================
   DRIV-EN Platform — Onboarding: Locations JavaScript (v1)
   File: /app/onboarding/locations.js
   Extracted from locations.html for CSP compliance (no inline scripts).
   Fixed: missing `if` guard in dashSessionLoaded title creation.
   ========================================================================== */

var locations = [];
var existingLocations = [];
var locDirty = false;
var editingLocationIndex = null;
var isEditingExisting = false;
var validTypes = ["Yard", "Shop", "Office", "Job Site", "Warehouse", "Other"];
var validStatuses = ["Active", "Inactive"];
var lastDivisionVal = "";
var activeOrgId = null;
var customerOrgName = "DRIV-EN Org";

var sessionPageSize = 10, sessionPage = 1, sessionSortCol = 'name', sessionSortAsc = true;
var existingPageSize = 10, existingPage = 1, existingSortCol = 'name', existingSortAsc = true;

var locError = document.getElementById("locError");
var locSuccess = document.getElementById("locSuccess");
var locTableContainer = document.getElementById("locTableContainer");
var existingLocTableContainer = document.getElementById("existingLocTableContainer");
var locStepStatus = document.getElementById("locStepStatus");
var locCountEl = document.getElementById("locCount");
var existingLocCountEl = document.getElementById("existingLocCount");
var statusBulk = document.getElementById("statusBulk");
var bulkPreview = document.getElementById("bulkPreview");

function normalizeName(str) { 
  if (typeof str === 'object' && str !== null) {
    str = str.name || str.location_name || str.division_name || str.division || "";
  }
  return String(str || "").trim().replace(/\s+/g, " "); 
}

function validateOrgContext() {
  if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "null") {
    if (locError) locError.textContent = "Security Alert: Invalid Organization Context. Action rejected.";
    return false;
  }
  return true;
}

function sendPresenceUnload() {
  if (!activeOrgId) return;
  var payload = JSON.stringify({ page: "Locations", action: "leave" });
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
      body: JSON.stringify({ page: "Locations" })
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
  if (locDirty) {
    e.preventDefault();
    e.returnValue = "You have unsaved locations.";
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
  var totalCount = existingLocations.length + locations.length;
  if (locCountEl) locCountEl.textContent = totalCount;
  if (existingLocCountEl) existingLocCountEl.textContent = existingLocations.length;
  try {
    localStorage.setItem("driven_location_count", String(totalCount));
  } catch (e) {}
}

function checkQuickAddDivision(selectEl) {
  if (selectEl.value === "__ADD_NEW__") {
    document.getElementById("modalDivError").textContent = "";
    document.getElementById("newDivisionName").value = "";
    document.getElementById("modalDivision").style.display = "flex";
    document.getElementById("newDivisionName").focus();
  } else {
    lastDivisionVal = selectEl.value;
  }
}
window.checkQuickAddDivision = checkQuickAddDivision;

function closeQuickModal(modalId, selectId) {
  document.getElementById(modalId).style.display = "none";
  document.getElementById(selectId).value = lastDivisionVal;
}
window.closeQuickModal = closeQuickModal;

function editLocation(index, isExisting) {
  var list = isExisting ? existingLocations : locations;
  var loc = list[index];
  if (!loc) return;
  editingLocationIndex = index;
  isEditingExisting = isExisting;
  document.getElementById("locNumber").value = loc.number || "";
  document.getElementById("locName").value = loc.name || "";
  document.getElementById("locType").value = loc.type || "";
  document.getElementById("locAddress").value = loc.address || "";
  document.getElementById("locCity").value = loc.city || "";
  document.getElementById("locState").value = loc.state || "";
  document.getElementById("locZip").value = loc.zip || "";
  document.getElementById("locDivision").value = loc.division || "";
  document.getElementById("locStatus").value = loc.status || "Active";
  var btnAdd = document.getElementById("btnAddLoc");
  btnAdd.textContent = "Update Location";
  btnAdd.style.background = "#2563eb";
  document.getElementById("formCard").scrollIntoView({ behavior: "smooth" });
}

async function submitQuickDivision() {
  if (!validateOrgContext()) return;
  var name = normalizeName(document.getElementById("newDivisionName").value);
  var errEl = document.getElementById("modalDivError");
  errEl.textContent = "";
  if (!name) { errEl.textContent = "Please enter a division name."; return; }
  try {
    if (navigator.onLine) {
      await fetch("/api/divisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-org-id": activeOrgId || ""
        },
        body: JSON.stringify({ name: name, customer_id: localStorage.getItem("driven_customer_id") || "" })
      });
    }
    var divisions = JSON.parse(localStorage.getItem("driven_divisions") || "[]");
    if (!divisions.some(function(d) { return normalizeName(d).toLowerCase() === name.toLowerCase(); })) {
      divisions.push({ name: name });
      localStorage.setItem("driven_divisions", JSON.stringify(divisions));
    }
    await loadDivisionDropdown(name);
    document.getElementById("modalDivision").style.display = "none";
  } catch (e) {
    errEl.textContent = "Error saving division: " + e.message;
  }
}
window.submitQuickDivision = submitQuickDivision;

function doPrintLocations(defaultSelection) {
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
  document.title = customerOrgName + " | Location Directory";
  window.print();
  document.title = origTitle;
  document.body.classList.remove('print-session-only', 'print-existing-only', 'print-both');
  sessionPageSize = origSessionSize;
  existingPageSize = origExistingSize;
  renderTable();
  renderExistingTable();
}
window.doPrintLocations = doPrintLocations;

async function loadExistingLocations() {
  existingLocTableContainer.textContent = "";

  if (navigator.onLine) {
    try {
      var resp = await fetch("/api/locations", {
        headers: { "x-org-id": activeOrgId || "" }
      });
      if (resp.ok) {
        var data = await resp.json();
        var rawList = data.locations || data.records || data.data || (Array.isArray(data) ? data : []);
        existingLocations = rawList.map(function(item) {
          var rec = item.fields ? Object.assign({ id: item.id }, item.fields) : item;
          return {
            number: normalizeName(rec.code || rec.number || rec.locNumber || rec.location_number || rec["Location Code"] || ""),
            name: normalizeName(rec.name || rec.locName || rec.location_name || rec["Location Name"] || rec),
            type: normalizeName(rec.type || rec.locType || rec["Type"] || ""),
            address: normalizeName(rec.address || rec["Address"] || ""),
            city: normalizeName(rec.city || rec["City"] || ""),
            state: normalizeName(rec.state || rec["State"] || ""),
            zip: normalizeName(rec.zip_code || rec.zip || rec.postal_code || rec["Zip"] || ""),
            division: normalizeName(rec.division || rec.division_name || rec["Division"] || ""),
            status: normalizeName(rec.status || rec["Status"] || "Active")
          };
        });
        localStorage.setItem("driven_locations", JSON.stringify(existingLocations));
        renderExistingTable();
        updateCount();
        return;
      }
    } catch (e) {
      console.warn("API load for existing locations failed, fallback to local storage:", e.message);
    }
  }

  var cached = JSON.parse(localStorage.getItem("driven_locations") || "[]");
  existingLocations = cached.map(function(item) {
    var rec = item.fields ? Object.assign({ id: item.id }, item.fields) : item;
    return {
      number: normalizeName(rec.number || rec.code || rec.locNumber || rec.location_number || rec["Location Code"] || ""),
      name: normalizeName(rec.name || rec.locName || rec.location_name || rec["Location Name"] || rec),
      type: normalizeName(rec.type || rec.locType || rec["Type"] || ""),
      address: normalizeName(rec.address || rec["Address"] || ""),
      city: normalizeName(rec.city || rec["City"] || ""),
      state: normalizeName(rec.state || rec["State"] || ""),
      zip: normalizeName(rec.zip || rec.zip_code || rec.postal_code || rec["Zip"] || ""),
      division: normalizeName(rec.division || rec.division_name || rec["Division"] || ""),
      status: normalizeName(rec.status || rec["Status"] || "Active")
    };
  });
  renderExistingTable();
  updateCount();
}

function renderExistingTable() {
  existingLocTableContainer.textContent = "";
  if (existingLocations.length === 0) {
    var empty = document.createElement("p");
    empty.className = "loc-empty";
    empty.textContent = "No existing locations in the system yet.";
    existingLocTableContainer.appendChild(empty);
    return;
  }
  var sorted = existingLocations.slice().sort(function(a, b) {
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

  var wrap = document.createElement("div"); wrap.className = "loc-table-wrap";
  var table = document.createElement("table"); table.className = "loc-table";
  var thead = document.createElement("thead"); var headRow = document.createElement("tr");

  var cols = [
    { label: "Loc # " + (existingSortCol === 'number' ? (existingSortAsc ? '▲' : '▼') : ''), key: "number" },
    { label: "Name " + (existingSortCol === 'name' ? (existingSortAsc ? '▲' : '▼') : ''), key: "name" },
    { label: "Type", key: "type" },
    { label: "Address", key: "address" },
    { label: "City", key: "city" },
    { label: "State", key: "state" },
    { label: "Zip", key: "zip" },
    { label: "Division", key: "division" },
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
  paged.forEach(function(loc) {
    var row = document.createElement("tr");
    var numCell = document.createElement("td");
    numCell.textContent = loc.number ? loc.number : "—";
    row.appendChild(numCell);

    [loc.name, loc.type, loc.address, loc.city, loc.state, loc.zip, loc.division].forEach(function(val) {
      var cell = document.createElement("td");
      cell.textContent = (val && val !== "undefined" && val !== "null") ? val : "—";
      row.appendChild(cell);
    });

    var statusCell = document.createElement("td");
    var statusSelect = document.createElement("select");
    statusSelect.className = "loc-print-select";
    statusSelect.style.cssText = "height:28px !important;padding:2px 6px !important;font-size:12px !important;";
    ["Active", "Inactive"].forEach(function(st) {
      var opt = document.createElement("option");
      opt.value = st;
      opt.textContent = st;
      if (st === loc.status) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusSelect.onchange = function() {
      loc.status = this.value;
      locDirty = true;
      renderExistingTable();
      updateCount();
    };
    statusCell.appendChild(statusSelect);
    row.appendChild(statusCell);
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

  existingLocTableContainer.appendChild(wrap);
  existingLocTableContainer.appendChild(pBar);
  if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
}

function isDuplicateLocationName(name) {
  var checkName = name.toLowerCase().trim();
  var inSession = locations.some(function(loc) { return (loc.name || "").toLowerCase().trim() === checkName; });
  var inSystem = existingLocations.some(function(loc) { return (loc.name || "").toLowerCase().trim() === checkName; });
  return inSession || inSystem;
}

async function loadDivisionDropdown(selectedVal) {
  var sel = document.getElementById("locDivision");
  sel.innerHTML = '<option value="" data-i18n>— None —</option><option value="__ADD_NEW__" data-i18n>➕ Add New Division...</option>';
  var divisions = [];

  if (navigator.onLine) {
    try {
      var resp = await fetch("/api/divisions", {
        headers: { "x-org-id": activeOrgId || "" }
      });
      if (resp.ok) {
        var data = await resp.json();
        var rawList = data.divisions || data.records || data.data || (Array.isArray(data) ? data : []);
        divisions = rawList.map(function(d) { return normalizeName(d.name || d); }).filter(Boolean);
        localStorage.setItem("driven_divisions", JSON.stringify(divisions.map(function(n) { return { name: n }; })));
      }
    } catch (e) {
      console.warn("Could not fetch divisions from API, using fallback:", e.message);
    }
  }

  if (divisions.length === 0) {
    var cached = JSON.parse(localStorage.getItem("driven_divisions") || "[]");
    divisions = cached.map(function(d) { return normalizeName(d); }).filter(Boolean);
  }

  divisions.forEach(function(val) {
    var opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    sel.appendChild(opt);
  });

  if (selectedVal) {
    sel.value = selectedVal;
    lastDivisionVal = selectedVal;
  }
}

function renderTable() {
  locTableContainer.textContent = "";
  if (locations.length === 0) {
    var empty = document.createElement("p");
    empty.className = "loc-empty";
    empty.textContent = "No new locations added in this session yet.";
    locTableContainer.appendChild(empty);
    return;
  }
  var sorted = locations.slice().sort(function(a, b) {
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

  var wrap = document.createElement("div"); wrap.className = "loc-table-wrap";
  var table = document.createElement("table"); table.className = "loc-table";
  var thead = document.createElement("thead"); var headRow = document.createElement("tr");

  var cols = [
    { label: "Loc # " + (sessionSortCol === 'number' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "number" },
    { label: "Name " + (sessionSortCol === 'name' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "name" },
    { label: "Type", key: "type" },
    { label: "Address", key: "address" },
    { label: "City", key: "city" },
    { label: "State", key: "state" },
    { label: "Zip", key: "zip" },
    { label: "Division", key: "division" },
    { label: "Status", key: "status" },
    { label: "Action", key: "" }
  ];

  cols.forEach(function(c) {
    var th = document.createElement("th");
    th.textContent = c.label;
    if (c.label === "Action") th.className = "loc-actions-col";
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
  paged.forEach(function(loc, index) {
    var row = document.createElement("tr");
    var numCell = document.createElement("td");
    numCell.textContent = loc.number ? loc.number : "—";
    row.appendChild(numCell);

    [loc.name, loc.type, loc.address, loc.city, loc.state, loc.zip, loc.division, loc.status].forEach(function(val) {
      var cell = document.createElement("td");
      cell.textContent = val || "—";
      row.appendChild(cell);
    });

    var cellAction = document.createElement("td");
    cellAction.className = "loc-actions-col";
    var btnEdit = document.createElement("button");
    btnEdit.className = "loc-btn-secondary";
    btnEdit.style.cssText = "padding:4px 10px;font-size:12px;height:auto;margin-right:6px;";
    btnEdit.textContent = "Edit";
    btnEdit.addEventListener("click", function() { editLocation(start + index, false); });
    cellAction.appendChild(btnEdit);

    var btn = document.createElement("button");
    btn.className = "loc-btn-secondary";
    btn.style.cssText = "padding:4px 10px;font-size:12px;height:auto;";
    btn.textContent = "Remove";
    btn.addEventListener("click", function() { removeLocation(start + index); });
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

  locTableContainer.appendChild(wrap);
  locTableContainer.appendChild(pBar);
  if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
}

function removeLocation(index) {
  locations.splice(index, 1);
  renderTable();
  updateCount();
  locSuccess.textContent = "";
  locError.textContent = "";
  locDirty = true;
}

window.switchTab = function(tab) {
  var tabSingle = document.getElementById("tabSingle");
  var tabBulk = document.getElementById("tabBulk");
  var contentSingle = document.getElementById("tabContentSingle");
  var contentBulk = document.getElementById("tabContentBulk");

  if (tab === "single") {
    tabSingle.classList.add("active");
    tabBulk.classList.remove("active");
    contentSingle.style.display = "block";
    contentBulk.style.display = "none";
  } else {
    tabBulk.classList.add("active");
    tabSingle.classList.remove("active");
    contentBulk.style.display = "block";
    contentSingle.style.display = "none";
  }
};

window.confirmLeave = function() {
  if (locDirty) {
    return confirm("You have unsaved locations. Click OK to leave without saving, or Cancel to stay and save them.");
  }
  return true;
};

window.confirmLogout = function() {
  if (locDirty) {
    if (!confirm("You have unsaved locations. Click OK to log out without saving, or Cancel to stay and save them.")) return;
  }
  dashLogout();
};

document.getElementById("btnAddLoc").addEventListener("click", function() {
  if (!validateOrgContext()) return;
  locError.textContent = "";
  locSuccess.textContent = "";

  var number = normalizeName(document.getElementById("locNumber").value);
  var name = normalizeName(document.getElementById("locName").value);
  var type = document.getElementById("locType").value;
  var address = normalizeName(document.getElementById("locAddress").value);
  var city = normalizeName(document.getElementById("locCity").value);
  var state = normalizeName(document.getElementById("locState").value);
  var zip = normalizeName(document.getElementById("locZip").value);
  var division = normalizeName(document.getElementById("locDivision").value);
  var status = document.getElementById("locStatus").value;

  if (!name || !type || !status) {
    locError.textContent = "Location Name, Type, and Status are required.";
    return;
  }

  if (division === "__ADD_NEW__") division = "";

  var locObj = {
    number: number,
    code: number,
    name: name,
    type: type,
    address: address,
    city: city,
    state: state,
    zip: zip,
    zip_code: zip,
    division: division,
    status: status,
    customerId: localStorage.getItem("driven_customer_id") || ""
  };

  if (editingLocationIndex !== null) {
    if (isEditingExisting) {
      existingLocations[editingLocationIndex] = locObj;
      renderExistingTable();
    } else {
      locations[editingLocationIndex] = locObj;
      renderTable();
    }
    editingLocationIndex = null;
    isEditingExisting = false;
    var btnAdd = document.getElementById("btnAddLoc");
    btnAdd.textContent = "Add Location";
    btnAdd.style.background = "";
    locSuccess.textContent = "Location updated successfully.";
  } else {
    if (isDuplicateLocationName(name)) {
      locError.textContent = "A location with this name already exists in the system or current batch.";
      return;
    }
    locations.push(locObj);
    renderTable();
    locSuccess.textContent = "Location added to current batch. Click Save & Continue when finished.";
  }

  updateCount();
  locDirty = true;
  document.getElementById("locNumber").value = "";
  document.getElementById("locName").value = "";
  document.getElementById("locType").value = "";
  document.getElementById("locAddress").value = "";
  document.getElementById("locCity").value = "";
  document.getElementById("locState").value = "";
  document.getElementById("locZip").value = "";
  document.getElementById("locDivision").value = "";
  document.getElementById("locStatus").value = "Active";
  document.getElementById("locName").focus();
});

document.getElementById("btnProcessBulk").addEventListener("click", function() {
  if (!validateOrgContext()) return;
  statusBulk.textContent = "";
  statusBulk.className = "loc-error";

  var file = document.getElementById("bulkFile").files[0];
  if (!file) {
    statusBulk.textContent = "Please select an Excel or CSV file.";
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var rows;
      var isCsv = file.name.toLowerCase().endsWith(".csv");
      if (isCsv) {
        var text = e.target.result;
        var lines = text.split(/\r?\n/).filter(function(l) { return l.trim() !== ""; });
        if (lines.length < 2) {
          statusBulk.textContent = "The CSV file is empty or has no data rows.";
          return;
        }
        var headers = parseCsvLine(lines[0]);
        rows = lines.slice(1).map(function(line) {
          var values = parseCsvLine(line);
          var obj = {};
          headers.forEach(function(h, i) { obj[h] = values[i] || ""; });
          return obj;
        });
      } else {
        var workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        var sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet);
      }

      if (rows.length === 0) {
        statusBulk.textContent = "The file is empty.";
        return;
      }

      var requiredFields = ["Location Name", "Type", "Status"];
      var header = Object.keys(rows[0]);

      for (var i = 0; i < requiredFields.length; i++) {
        if (header.indexOf(requiredFields[i]) === -1) {
          statusBulk.textContent = "Missing required column: " + requiredFields[i];
          return;
        }
      }

      var validDivisions = JSON.parse(localStorage.getItem("driven_divisions") || "[]").map(function(d) { return normalizeName(d); });

      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        for (var f = 0; f < requiredFields.length; f++) {
          if (!row[requiredFields[f]] || String(row[requiredFields[f]]).trim() === "") {
            statusBulk.textContent = "Row " + (r + 2) + ": " + requiredFields[f] + " is required.";
            return;
          }
        }
        var rowType = String(row["Type"]).trim();
        if (validTypes.indexOf(rowType) === -1) {
          statusBulk.textContent = "Row " + (r + 2) + ': Invalid Type "' + rowType + '". Must be one of: ' + validTypes.join(", ") + '.';
          return;
        }
        var rowStatus = String(row["Status"]).trim();
        if (validStatuses.indexOf(rowStatus) === -1) {
          statusBulk.textContent = "Row " + (r + 2) + ': Invalid Status "' + rowStatus + '". Must be either "Active" or "Inactive".';
          return;
        }
        if (row["Division"] && String(row["Division"]).trim() !== "") {
          var rowDiv = normalizeName(row["Division"]);
          if (validDivisions.length > 0 && validDivisions.indexOf(rowDiv) === -1) {
            statusBulk.textContent = "Row " + (r + 2) + ': Invalid Division "' + rowDiv + '". Must match a division from the Divisions task, or leave blank.';
            return;
          }
        }
      }

      var seenNames = {};
      for (var d = 0; d < rows.length; d++) {
        var nm = normalizeName(rows[d]["Location Name"]).toLowerCase();
        if (seenNames[nm]) {
          statusBulk.textContent = "Duplicate location name found in the upload file: " + nm + " (rows " + seenNames[nm] + " and " + (d + 2) + ").";
          return;
        }
        seenNames[nm] = (d + 2);
        if (isDuplicateLocationName(nm)) {
          statusBulk.textContent = "Row " + (d + 2) + ': Location "' + nm + '" already exists in the system or current batch.';
          return;
        }
      }

      var bulkLocations = rows.map(function(row) {
        var num = row["Location #"] ? normalizeName(row["Location #"]) : "";
        var zp = row["Zip"] ? normalizeName(row["Zip"]) : "";
        return {
          number: num,
          code: num,
          name: normalizeName(row["Location Name"]),
          type: normalizeName(row["Type"]),
          address: row["Address"] ? normalizeName(row["Address"]) : "",
          city: row["City"] ? normalizeName(row["City"]) : "",
          state: row["State"] ? normalizeName(row["State"]) : "",
          zip: zp,
          zip_code: zp,
          division: row["Division"] ? normalizeName(row["Division"]) : "",
          status: normalizeName(row["Status"]),
          customerId: localStorage.getItem("driven_customer_id") || ""
        };
      });

      var allCols = ["Location #", "Location Name", "Type", "Address", "City", "State", "Zip", "Division", "Status"];
      bulkPreview.textContent = "";
      var pTable = document.createElement("table");
      var pThead = document.createElement("thead");
      var pHeadRow = document.createElement("tr");
      allCols.forEach(function(c) {
        var pTh = document.createElement("th");
        pTh.textContent = c;
        pHeadRow.appendChild(pTh);
      });
      pThead.appendChild(pHeadRow);
      pTable.appendChild(pThead);

      var pTbody = document.createElement("tbody");
      bulkLocations.forEach(function(loc) {
        var pRow = document.createElement("tr");
        [loc.number, loc.name, loc.type, loc.address, loc.city, loc.state, loc.zip, loc.division, loc.status].forEach(function(val) {
          var pCell = document.createElement("td");
          pCell.textContent = val || "";
          pRow.appendChild(pCell);
        });
        pTbody.appendChild(pRow);
      });
      pTable.appendChild(pTbody);
      bulkPreview.appendChild(pTable);

      locations = locations.concat(bulkLocations);
      renderTable();
      updateCount();
      statusBulk.textContent = "Uploaded " + bulkLocations.length + " locations. Review above and click Save & Continue.";
      statusBulk.className = "loc-success";
      locDirty = true;
    } catch(parseErr) {
      statusBulk.textContent = "Could not parse the file. Make sure it is a valid Excel (.xlsx) or CSV file with the required columns (Location Name, Type, Status).";
      statusBulk.className = "loc-error";
      if (window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report("locations.html: bulk upload parse failed — " + (parseErr.message || parseErr), "bulk-upload-parse", parseErr && parseErr.stack ? parseErr.stack : null);
      }
    }
  };

  if (file.name.toLowerCase().endsWith(".csv")) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
});

document.getElementById("btnSaveLoc").addEventListener("click", async function() {
  if (!validateOrgContext()) return;
  locStepStatus.textContent = "";
  locStepStatus.style.color = "var(--error)";

  if (!navigator.onLine) {
    locStepStatus.textContent = "Network Error: You must be connected to the internet to save location data to Cloudflare D1.";
    return;
  }

  if (locations.length === 0 && existingLocations.length === 0) {
    locStepStatus.textContent = "You must add at least one location.";
    return;
  }

  var btnSave = document.getElementById("btnSaveLoc");
  btnSave.disabled = true;
  btnSave.textContent = "Saving to Database...";

  try {
    var saveErrors = [];
    for (var i = 0; i < locations.length; i++) {
      var loc = locations[i];
      var payload = {
        "Location Name": loc.name,
        "Location Code": loc.number || loc.code || "",
        "Type": loc.type,
        "Address": loc.address || "",
        "City": loc.city || "",
        "State": loc.state || "",
        "Zip Code": loc.zip || loc.zip_code || "",
        "Division": loc.division || "",
        "Status": loc.status || "Active"
      };

      var res = await fetch("/api/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-org-id": activeOrgId || ""
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        var errData = await res.json().catch(function() { return {}; });
        var errMsg = (typeof errData.error === "string" ? errData.error : null) || 
                     (typeof errData.message === "string" ? errData.message : null) || 
                     ("HTTP " + res.status);
        saveErrors.push(loc.name + ": " + errMsg);
      }
    }

    if (saveErrors.length > 0) {
      throw new Error("Some locations failed to save: " + saveErrors.join("; "));
    }

    var allLocations = existingLocations.concat(locations);
    localStorage.setItem("driven_locations", JSON.stringify(allLocations));
    localStorage.setItem("driven_location_count", String(allLocations.length));

    locStepStatus.style.color = "var(--success)";
    locStepStatus.textContent = locations.length + " location(s) saved directly to D1. Total locations: " + allLocations.length + ". Redirecting to onboarding dashboard…";
    btnSave.textContent = "Saved ✓";
    locDirty = false;
    locations = [];
    await loadExistingLocations();
    renderTable();
    updateCount();

    setTimeout(function() {
      btnSave.disabled = false;
      btnSave.textContent = "Save & Continue";
      window.location.href = "/app/dashboard/onboarding-dashboard.html";
    }, 1500);

  } catch(err) {
    locStepStatus.style.color = "var(--error)";
    locStepStatus.textContent = "Save failed: " + err.message;
    btnSave.disabled = false;
    btnSave.textContent = "Save & Continue";
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report("locations.html: save failed — " + (err.message || err), "save-location-catch", err && err.stack ? err.stack : null);
    }
  }
});

function downloadLocationTemplate() {
  var ws = XLSX.utils.aoa_to_sheet([["Location #", "Location Name", "Type", "Address", "City", "State", "Zip", "Division", "Status"]]);
  ws["!cols"] = [{ wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 12 }];
  downloadXlsxWithFrozenHeader(ws, "Locations", "Location-Mass-Upload-v1.0.xlsx");
}
window.downloadLocationTemplate = downloadLocationTemplate;

function parseCsvLine(line) {
  var result = [];
  var current = "";
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; }
      } else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; } else if (ch === ",") { result.push(current.trim()); current = ""; } else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

document.addEventListener("dashSessionLoaded", async function(e) {
  var userObj = JSON.parse(localStorage.getItem("driven_user") || "{}");
  activeOrgId = userObj.org_id || (e.detail && e.detail.org_id) || localStorage.getItem("driven_org_id");
  customerOrgName = (e.detail && e.detail.org_name) || localStorage.getItem("driven_org_name") || "DRIV-EN Org";

  var row1 = document.querySelector(".dash-header-row1");
  if (row1 && !document.querySelector(".loc-header-title")) {
    var title = document.createElement("div");
    title.className = "loc-header-title";
    title.textContent = "Onboarding — Locations";
    var logoArea = document.getElementById("dashCustomerLogoArea");
    var drivenLogo = row1.querySelector(".dash-driven-logo");
    if (logoArea && drivenLogo) { row1.insertBefore(title, drivenLogo); }
  }

  await loadDivisionDropdown();
  await loadExistingLocations();
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
