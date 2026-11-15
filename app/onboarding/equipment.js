/* ==========================================================================
   DRIV-EN Platform — Onboarding: Assets/Equipment JavaScript (v1)
   File: /app/onboarding/equipment.js
   Extracted from equipment.html for CSP compliance (no inline scripts).
   Fixed: missing `if` guard in dashSessionLoaded title creation.
   ========================================================================== */

var equipment = [];
var existingEquipment = [];
var eqDirty = false;
var editingEqIndex = null;
var isEditingExistingEq = false;
var activeOrgId = null;
var customerOrgName = "DRIV-EN Org";

var sessionPageSize = 10, sessionPage = 1, sessionSortCol = 'unitNo', sessionSortAsc = true;
var existingPageSize = 10, existingPage = 1, existingSortCol = 'unitNo', existingSortAsc = true;

var eqError = document.getElementById("eqError");
var eqSuccess = document.getElementById("eqSuccess");
var eqTableContainer = document.getElementById("eqTableContainer");
var existingEqTableContainer = document.getElementById("existingEqTableContainer");
var eqStepStatus = document.getElementById("eqStepStatus");
var eqCountEl = document.getElementById("eqCount");
var existingEqCountEl = document.getElementById("existingEqCount");
var statusBulk = document.getElementById("statusBulk");
var bulkPreview = document.getElementById("bulkPreview");

function toggleAllowedCategoryField() {
  var isAtt = document.getElementById("eqIsAttachment").value;
  document.getElementById("allowedCategoryGroup").style.display = (isAtt === "1") ? "flex" : "none";
}
window.toggleAllowedCategoryField = toggleAllowedCategoryField;

function normalizeName(str) { 
  if (typeof str === 'object' && str !== null) {
    str = str.name || str.asset_type_name || str.location_name || str.division_name || str.description || str.asset_name || "";
  }
  return String(str || "").trim().replace(/\s+/g, " "); 
}

function validateOrgContext() {
  if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "null") {
    eqError.textContent = "Security Alert: Invalid Organization Context. Action rejected.";
    return false;
  }
  return true;
}

function sendPresenceUnload() {
  if (!activeOrgId) return;
  var payload = JSON.stringify({ page: "Assets", action: "leave" });
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
      body: JSON.stringify({ page: "Assets" })
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
  if (eqDirty) {
    e.preventDefault();
    e.returnValue = "You have unsaved assets.";
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
  eqCountEl.textContent = equipment.length;
  if (existingEqCountEl) existingEqCountEl.textContent = existingEquipment.length;
}

async function loadDropdowns() {
  var orgHeaders = { "x-org-id": activeOrgId || "" };

  // Asset Types
  var catSel = document.getElementById("eqCategory");
  if (catSel) {
    catSel.innerHTML = '<option value="" data-i18n>— Select Asset Type —</option>';
    try {
      if (navigator.onLine) {
        var resAt = await fetch("/api/asset-types", { headers: orgHeaders });
        if (resAt.ok) {
          var dataAt = await resAt.json();
          var listAt = dataAt.assetTypes || dataAt.records || dataAt.data || [];
          listAt.forEach(function(item) {
            var val = normalizeName(item);
            if (val) {
              var opt = document.createElement("option");
              opt.value = val;
              opt.textContent = val;
              catSel.appendChild(opt);
            }
          });
        }
      }
    } catch(e) {}
    if (catSel.options.length <= 1) {
      var cats = JSON.parse(localStorage.getItem("driven_asset_types") || "[]");
      cats.forEach(function(c) {
        var opt = document.createElement("option");
        var val = normalizeName(c);
        if (val) { opt.value = val; opt.textContent = val; catSel.appendChild(opt); }
      });
    }
  }

  // Divisions
  var divSel = document.getElementById("eqDivision");
  if (divSel) {
    divSel.innerHTML = '<option value="" data-i18n>— Select Division —</option>';
    try {
      if (navigator.onLine) {
        var resDiv = await fetch("/api/divisions", { headers: orgHeaders });
        if (resDiv.ok) {
          var dataDiv = await resDiv.json();
          var listDiv = dataDiv.divisions || dataDiv.records || dataDiv.data || [];
          listDiv.forEach(function(item) {
            var val = normalizeName(item);
            if (val) {
              var opt = document.createElement("option");
              opt.value = val;
              opt.textContent = val;
              divSel.appendChild(opt);
            }
          });
        }
      }
    } catch(e) {}
    if (divSel.options.length <= 1) {
      var divs = JSON.parse(localStorage.getItem("driven_divisions") || "[]");
      divs.forEach(function(d) {
        var opt = document.createElement("option");
        var val = normalizeName(d);
        if (val) { opt.value = val; opt.textContent = val; divSel.appendChild(opt); }
      });
    }
  }

  // Projects
  var projSel = document.getElementById("eqProject");
  if (projSel) {
    projSel.innerHTML = '<option value="" data-i18n>— Select Project —</option>';
    try {
      if (navigator.onLine) {
        var resProj = await fetch("/api/projects", { headers: orgHeaders });
        if (resProj.ok) {
          var dataProj = await resProj.json();
          var listProj = dataProj.projects || dataProj.records || dataProj.data || [];
          listProj.forEach(function(item) {
            var val = normalizeName(item);
            if (val) {
              var opt = document.createElement("option");
              opt.value = val;
              opt.textContent = val;
              projSel.appendChild(opt);
            }
          });
        }
      }
    } catch(e) {}
    if (projSel.options.length <= 1) {
      var projs = JSON.parse(localStorage.getItem("driven_projects") || "[]");
      projs.forEach(function(p) {
        var opt = document.createElement("option");
        var val = normalizeName(p);
        if (val) { opt.value = val; opt.textContent = val; projSel.appendChild(opt); }
      });
    }
  }

  // Locations
  var locSel = document.getElementById("eqLocation");
  if (locSel) {
    locSel.innerHTML = '<option value="" data-i18n>— Select Location —</option>';
    try {
      if (navigator.onLine) {
        var resLoc = await fetch("/api/locations", { headers: orgHeaders });
        if (resLoc.ok) {
          var dataLoc = await resLoc.json();
          var listLoc = dataLoc.locations || dataLoc.records || dataLoc.data || [];
          listLoc.forEach(function(item) {
            var val = normalizeName(item);
            if (val) {
              var opt = document.createElement("option");
              opt.value = val;
              opt.textContent = val;
              locSel.appendChild(opt);
            }
          });
        }
      }
    } catch(e) {}
    if (locSel.options.length <= 1) {
      var locs = JSON.parse(localStorage.getItem("driven_locations") || "[]");
      locs.forEach(function(l) {
        var opt = document.createElement("option");
        var val = normalizeName(l);
        if (val) { opt.value = val; opt.textContent = val; locSel.appendChild(opt); }
      });
    }
  }
}

function editEquipment(index, isExisting) {
  var list = isExisting ? existingEquipment : equipment;
  var item = list[index];
  if (!item) return;

  editingEqIndex = index;
  isEditingExistingEq = isExisting;

  document.getElementById("eqUnitNo").value = item.unitNo || "";
  document.getElementById("eqName").value = item.name || "";
  document.getElementById("eqCategory").value = item.category || "";
  document.getElementById("eqIsAttachment").value = (item.isAttachment === 1 || item.isAttachment === "1") ? "1" : "0";
  document.getElementById("eqAllowedCategory").value = item.allowedCategory || "all";
  toggleAllowedCategoryField();

  document.getElementById("eqMake").value = item.make || "";
  document.getElementById("eqModel").value = item.model || "";
  document.getElementById("eqYear").value = item.year || "";
  document.getElementById("eqSerial").value = item.serial || "";
  document.getElementById("eqMeter").value = item.meter || "";
  document.getElementById("eqDivision").value = item.division || "";
  document.getElementById("eqProject").value = item.project || "";
  document.getElementById("eqLocation").value = item.location || "";

  var btnAdd = document.getElementById("btnAddEq");
  btnAdd.textContent = "Update Asset";
  btnAdd.style.background = "#2563eb";

  document.getElementById("formCard").scrollIntoView({ behavior: "smooth" });
}

function doPrintEquipment(defaultSelection) {
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
  document.title = customerOrgName + " | Asset Directory";

  window.print();

  document.title = origTitle;
  document.body.classList.remove('print-session-only', 'print-existing-only', 'print-both');
  sessionPageSize = origSessionSize;
  existingPageSize = origExistingSize;
  renderTable();
  renderExistingTable();
}
window.doPrintEquipment = doPrintEquipment;

async function loadExistingEquipment() {
  existingEqTableContainer.textContent = "";

  if (navigator.onLine) {
    try {
      var resp = await fetch("/api/assets", {
        headers: { "x-org-id": activeOrgId || "" }
      });
      if (resp.ok) {
        var data = await resp.json();
        var rawList = data.records || data.assets || data.equipment || data.data || (Array.isArray(data) ? data : []);
        existingEquipment = rawList.map(function(item) {
          var rec = item.fields ? Object.assign({ id: item.id }, item.fields) : item;
          return {
            id: rec.id || "",
            unitNo: normalizeName(rec.asset_number || rec.unitNo || rec.unit_no || rec.asset_id),
            name: normalizeName(rec.name || rec.description || rec.asset_name),
            category: normalizeName(rec.category || rec.category_name || rec.asset_type),
            isAttachment: Number(rec.is_attachment || 0),
            allowedCategory: normalizeName(rec.allowed_category || "all"),
            make: normalizeName(rec.make),
            model: normalizeName(rec.model),
            year: normalizeName(rec.year),
            serial: normalizeName(rec.serial_number || rec.serial || rec.vin),
            meter: normalizeName(rec.meter || rec.odometer),
            division: normalizeName(rec.division || rec.division_name),
            project: normalizeName(rec.project || rec.project_name),
            location: normalizeName(rec.current_location || rec.location)
          };
        });
        localStorage.setItem("driven_equipment", JSON.stringify(existingEquipment));
        renderExistingTable();
        updateCount();
        return;
      }
    } catch (e) {
      console.warn("API load for existing equipment failed, falling back to local storage:", e.message);
    }
  }

  var cached = JSON.parse(localStorage.getItem("driven_equipment") || "[]");
  existingEquipment = cached.map(function(rec) {
    return {
      id: rec.id || "",
      unitNo: normalizeName(rec.unitNo || rec.asset_number || rec.unit_no || rec.asset_id),
      name: normalizeName(rec.name || rec.description || rec.asset_name),
      category: normalizeName(rec.category || rec.category_name || rec.asset_type),
      isAttachment: Number(rec.isAttachment || rec.is_attachment || 0),
      allowedCategory: normalizeName(rec.allowedCategory || rec.allowed_category || "all"),
      make: normalizeName(rec.make),
      model: normalizeName(rec.model),
      year: normalizeName(rec.year),
      serial: normalizeName(rec.serial || rec.serial_number || rec.vin),
      meter: normalizeName(rec.meter || rec.odometer),
      division: normalizeName(rec.division || rec.division_name),
      project: normalizeName(rec.project || rec.project_name),
      location: normalizeName(rec.location || rec.current_location)
    };
  });
  renderExistingTable();
  updateCount();
}

function renderExistingTable() {
  existingEqTableContainer.textContent = "";
  if (existingEquipment.length === 0) {
    var empty = document.createElement("p");
    empty.className = "eq-empty";
    empty.textContent = "No existing assets in the system yet.";
    existingEqTableContainer.appendChild(empty);
    return;
  }

  var sorted = existingEquipment.slice().sort(function(a, b) {
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

  var wrap = document.createElement("div"); wrap.className = "eq-table-wrap";
  var table = document.createElement("table"); table.className = "eq-table";
  var thead = document.createElement("thead"); var headRow = document.createElement("tr");

  var cols = [
    { label: "Asset ID " + (existingSortCol === 'unitNo' ? (existingSortAsc ? '▲' : '▼') : ''), key: "unitNo" },
    { label: "Description " + (existingSortCol === 'name' ? (existingSortAsc ? '▲' : '▼') : ''), key: "name" },
    { label: "Asset Type " + (existingSortCol === 'category' ? (existingSortAsc ? '▲' : '▼') : ''), key: "category" },
    { label: "Attachment?", key: "isAttachment" },
    { label: "Make " + (existingSortCol === 'make' ? (existingSortAsc ? '▲' : '▼') : ''), key: "make" },
    { label: "Model " + (existingSortCol === 'model' ? (existingSortAsc ? '▲' : '▼') : ''), key: "model" },
    { label: "Year " + (existingSortCol === 'year' ? (existingSortAsc ? '▲' : '▼') : ''), key: "year" },
    { label: "Current Location " + (existingSortCol === 'location' ? (existingSortAsc ? '▲' : '▼') : ''), key: "location" },
    { label: "Action", key: "" }
  ];

  cols.forEach(function(c) {
    var th = document.createElement("th");
    th.textContent = c.label;
    if (c.label === "Action") th.className = "eq-actions-col";
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
  paged.forEach(function(item, index) {
    var row = document.createElement("tr");
    var attLabel = item.isAttachment === 1 ? ("Yes (" + item.allowedCategory + ")") : "No";

    [item.unitNo, item.name, item.category, attLabel, item.make, item.model, item.year, item.location].forEach(function(val) {
      var cell = document.createElement("td");
      cell.textContent = (val && val !== "undefined" && val !== "null") ? val : "—";
      row.appendChild(cell);
    });

    var cellAction = document.createElement("td"); cellAction.className = "eq-actions-col";
    
    if (item.id) {
      var btnDetail = document.createElement("a");
      btnDetail.className = "eq-btn-secondary"; 
      btnDetail.style.cssText = "padding:4px 10px;font-size:12px;height:auto;margin-right:6px;text-decoration:none;"; 
      btnDetail.textContent = "View Detail";
      btnDetail.href = "/app/equipment/asset-detail.html?id=" + encodeURIComponent(item.id);
      cellAction.appendChild(btnDetail);
    }

    var btnEdit = document.createElement("button");
    btnEdit.className = "eq-btn-secondary"; btnEdit.style.cssText = "padding:4px 10px;font-size:12px;height:auto;"; btnEdit.textContent = "Edit";
    btnEdit.addEventListener("click", function() { editEquipment(start + index, true); });
    cellAction.appendChild(btnEdit);
    row.appendChild(cellAction);

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

  existingEqTableContainer.appendChild(wrap);
  existingEqTableContainer.appendChild(pBar);

  if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
}

function renderTable() {
  eqTableContainer.textContent = "";
  if (equipment.length === 0) { 
    var empty = document.createElement("p"); 
    empty.className = "eq-empty"; 
    empty.textContent = "No new assets added in this session yet."; 
    eqTableContainer.appendChild(empty); 
    return; 
  }

  var sorted = equipment.slice().sort(function(a, b) {
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

  var wrap = document.createElement("div"); wrap.className = "eq-table-wrap";
  var table = document.createElement("table"); table.className = "eq-table";
  var thead = document.createElement("thead"); var headRow = document.createElement("tr");

  var cols = [
    { label: "Asset ID " + (sessionSortCol === 'unitNo' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "unitNo" },
    { label: "Description " + (sessionSortCol === 'name' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "name" },
    { label: "Asset Type " + (sessionSortCol === 'category' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "category" },
    { label: "Attachment?", key: "isAttachment" },
    { label: "Make " + (sessionSortCol === 'make' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "make" },
    { label: "Model " + (sessionSortCol === 'model' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "model" },
    { label: "Year " + (sessionSortCol === 'year' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "year" },
    { label: "Action", key: "" }
  ];

  cols.forEach(function(c) {
    var th = document.createElement("th");
    th.textContent = c.label;
    if (c.label === "Action") th.className = "eq-actions-col";
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
  paged.forEach(function(item, index) {
    var row = document.createElement("tr");
    var attLabel = item.isAttachment === 1 ? ("Yes (" + item.allowedCategory + ")") : "No";

    [item.unitNo, item.name, item.category, attLabel, item.make, item.model, item.year].forEach(function(val) { 
      var cell = document.createElement("td"); 
      cell.textContent = val || "—"; 
      row.appendChild(cell); 
    });

    var cellAction = document.createElement("td"); 
    cellAction.className = "eq-actions-col"; 

    var btnEdit = document.createElement("button");
    btnEdit.className = "eq-btn-secondary"; 
    btnEdit.style.cssText = "padding:4px 10px;font-size:12px;height:auto;margin-right:6px;"; 
    btnEdit.textContent = "Edit";
    btnEdit.addEventListener("click", function() { editEquipment(start + index, false); }); 
    cellAction.appendChild(btnEdit);

    var btnRemove = document.createElement("button");
    btnRemove.className = "eq-btn-secondary"; 
    btnRemove.style.cssText = "padding:4px 10px;font-size:12px;height:auto;"; 
    btnRemove.textContent = "Remove";
    btnRemove.addEventListener("click", function() { removeEquipment(start + index); }); 
    cellAction.appendChild(btnRemove); 

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

  eqTableContainer.appendChild(wrap);
  eqTableContainer.appendChild(pBar);

  if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
}

function removeEquipment(index) { equipment.splice(index, 1); renderTable(); updateCount(); eqSuccess.textContent = ""; eqError.textContent = ""; eqDirty = true; }

window.switchTab = function(tab) {
  var tabSingle = document.getElementById("tabSingle"); var tabBulk = document.getElementById("tabBulk");
  var contentSingle = document.getElementById("tabContentSingle"); var contentBulk = document.getElementById("tabContentBulk");
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

window.confirmLeave = function() { if (eqDirty) { return confirm("You have unsaved assets. Click OK to leave without saving, or Cancel to stay and save them."); } return true; };
window.confirmLogout = function() { if (eqDirty) { if (!confirm("You have unsaved assets. Click OK to log out without saving, or Cancel to stay and save them.")) return; } dashLogout(); };

document.getElementById("btnAddEq").addEventListener("click", function() {
  if (!validateOrgContext()) return;
  eqError.textContent = ""; eqSuccess.textContent = "";
  var unitNo = normalizeName(document.getElementById("eqUnitNo").value);
  var name = normalizeName(document.getElementById("eqName").value);
  var category = normalizeName(document.getElementById("eqCategory").value);
  var isAttachment = Number(document.getElementById("eqIsAttachment").value || 0);
  var allowedCategory = document.getElementById("eqAllowedCategory").value || "all";

  var make = normalizeName(document.getElementById("eqMake").value);
  var model = normalizeName(document.getElementById("eqModel").value);
  var year = normalizeName(document.getElementById("eqYear").value);
  var serial = normalizeName(document.getElementById("eqSerial").value);
  var meter = normalizeName(document.getElementById("eqMeter").value);
  var division = normalizeName(document.getElementById("eqDivision").value);
  var project = normalizeName(document.getElementById("eqProject").value);
  var location = normalizeName(document.getElementById("eqLocation").value);

  if (!unitNo || !name || !category) { eqError.textContent = "Asset ID, Asset Name, and Asset Type are required."; return; }

  var checkUnit = unitNo.toLowerCase().trim();
  var unitMatch = existingEquipment.some(function(item) { 
    return (item.unitNo || "").toLowerCase().trim() === checkUnit; 
  }) || equipment.some(function(item) { 
    return (item.unitNo || "").toLowerCase().trim() === checkUnit; 
  });

  if (unitMatch && editingEqIndex === null) {
    var confirmAdd = confirm("⚠️ An asset with ID '" + unitNo + "' already exists in the system or current batch.\n\nWould you like to differentiate the ID or proceed anyway?");
    if (!confirmAdd) return;
  }

  var eqObj = { 
    unitNo: unitNo, name: name, category: category, isAttachment: isAttachment, allowedCategory: allowedCategory,
    make: make, model: model, year: year, serial: serial, meter: meter, division: division, project: project, location: location, 
    customerId: localStorage.getItem("driven_customer_id") || "" 
  };

  if (editingEqIndex !== null) {
    if (isEditingExistingEq) {
      existingEquipment[editingEqIndex] = eqObj;
      renderExistingTable();
    } else {
      equipment[editingEqIndex] = eqObj;
      renderTable();
    }
    editingEqIndex = null;
    isEditingExistingEq = false;
    var btnAdd = document.getElementById("btnAddEq");
    btnAdd.textContent = "Add Asset";
    btnAdd.style.background = "";
    eqSuccess.textContent = "Asset updated successfully.";
  } else {
    equipment.push(eqObj);
    renderTable();
    eqSuccess.textContent = "Asset added to current batch. Click Save & Continue when finished.";
  }
  
  updateCount();
  eqDirty = true;
  document.getElementById("eqUnitNo").value = ""; 
  document.getElementById("eqName").value = ""; 
  document.getElementById("eqCategory").value = ""; 
  document.getElementById("eqIsAttachment").value = "0";
  document.getElementById("eqAllowedCategory").value = "all";
  toggleAllowedCategoryField();

  document.getElementById("eqMake").value = ""; 
  document.getElementById("eqModel").value = ""; 
  document.getElementById("eqYear").value = ""; 
  document.getElementById("eqSerial").value = ""; 
  document.getElementById("eqMeter").value = ""; 
  document.getElementById("eqDivision").value = ""; 
  document.getElementById("eqProject").value = ""; 
  document.getElementById("eqLocation").value = ""; 
  document.getElementById("eqUnitNo").focus();
});

document.getElementById("btnProcessBulk").addEventListener("click", function() {
  if (!validateOrgContext()) return;
  statusBulk.textContent = ""; statusBulk.className = "eq-error";
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

      var reqId = "Asset ID"; var reqName = "Name"; var reqCat = "Asset Type";
      var header = Object.keys(rows[0]);
      if (header.indexOf(reqId) === -1 && header.indexOf("Unit #") !== -1) reqId = "Unit #";
      if (header.indexOf(reqName) === -1 && header.indexOf("Description") !== -1) reqName = "Description";
      if (header.indexOf(reqCat) === -1 && header.indexOf("Category") !== -1) reqCat = "Category";

      if (header.indexOf(reqId) === -1 || header.indexOf(reqName) === -1 || header.indexOf(reqCat) === -1) { 
        statusBulk.textContent = "Missing required columns: Asset ID, Name/Description, and Asset Type."; return; 
      }

      for (var r = 0; r < rows.length; r++) {
        if (!rows[r][reqId] || String(rows[r][reqId]).trim() === "" || !rows[r][reqName] || String(rows[r][reqName]).trim() === "" || !rows[r][reqCat] || String(rows[r][reqCat]).trim() === "") { 
          statusBulk.textContent = "Row " + (r + 2) + ": Asset ID, Name, and Asset Type are required."; return; 
        }
      }

      var seenIds = {};
      for (var d = 0; d < rows.length; d++) {
        var idVal = normalizeName(rows[d][reqId]).toLowerCase();
        if (seenIds[idVal]) { statusBulk.textContent = "Duplicate Asset ID: " + idVal + " (rows " + seenIds[idVal] + " and " + (d + 2) + ")."; return; }
        seenIds[idVal] = (d + 2);
      }

      var bulkEq = rows.map(function(row) {
        return { 
          unitNo: normalizeName(row[reqId]), 
          name: normalizeName(row[reqName]), 
          category: normalizeName(row[reqCat] || ""), 
          isAttachment: Number(row["Is Attachment"] || row["is_attachment"] || 0),
          allowedCategory: normalizeName(row["Compatible Category"] || row["allowed_category"] || "all"),
          make: normalizeName(row["Make"] || ""), 
          model: normalizeName(row["Model"] || ""), 
          year: normalizeName(row["Year"] || ""), 
          serial: normalizeName(row["Serial #"] || row["VIN"] || ""), 
          meter: normalizeName(row["Meter"] || row["Odometer"] || ""), 
          division: normalizeName(row["Division"] || ""), 
          project: normalizeName(row["Project"] || ""), 
          location: normalizeName(row["Location"] || ""), 
          customerId: localStorage.getItem("driven_customer_id") || "" 
        };
      });

      bulkPreview.textContent = ""; 
      var pTable = document.createElement("table"); 
      var pThead = document.createElement("thead"); 
      var pHeadRow = document.createElement("tr");
      ["Asset ID", "Description", "Asset Type", "Attachment?", "Make", "Model"].forEach(function(h) { var pTh = document.createElement("th"); pTh.textContent = h; pHeadRow.appendChild(pTh); });
      pThead.appendChild(pHeadRow); pTable.appendChild(pThead); 

      var pTbody = document.createElement("tbody");
      bulkEq.forEach(function(item) { 
        var pRow = document.createElement("tr"); 
        var pC1 = document.createElement("td"); pC1.textContent = item.unitNo; pRow.appendChild(pC1); 
        var pC2 = document.createElement("td"); pC2.textContent = item.name; pRow.appendChild(pC2); 
        var pC3 = document.createElement("td"); pC3.textContent = item.category || "—"; pRow.appendChild(pC3); 
        var pC4 = document.createElement("td"); pC4.textContent = item.isAttachment === 1 ? "Yes" : "No"; pRow.appendChild(pC4); 
        var pC5 = document.createElement("td"); pC5.textContent = item.make || "—"; pRow.appendChild(pC5); 
        var pC6 = document.createElement("td"); pC6.textContent = item.model || "—"; pRow.appendChild(pC6); 
        pTbody.appendChild(pRow); 
      });
      pTable.appendChild(pTbody); bulkPreview.appendChild(pTable);

      equipment = equipment.concat(bulkEq); 
      renderTable(); updateCount();
      statusBulk.textContent = "Uploaded " + bulkEq.length + " assets. Review above and click Save & Continue."; 
      statusBulk.className = "eq-success"; 
      eqDirty = true;
    } catch(parseErr) {
      statusBulk.textContent = "Could not parse the file. Make sure it is a valid Excel (.xlsx) or CSV file with required columns.";
      statusBulk.className = "eq-error";
      if (window.DRIVENErrorHandler) { window.DRIVENErrorHandler.report("equipment.html: bulk upload parse failed — " + (parseErr.message || parseErr), "bulk-upload-parse", parseErr && parseErr.stack ? parseErr.stack : null); }
    }
  };
  if (file.name.toLowerCase().endsWith(".csv")) { reader.readAsText(file); } else { reader.readAsArrayBuffer(file); }
});

document.getElementById("btnSaveEq").addEventListener("click", async function() {
  if (!validateOrgContext()) return;
  eqStepStatus.textContent = ""; eqStepStatus.style.color = "var(--error)";

  if (!navigator.onLine) {
    eqStepStatus.textContent = "Network Error: You must be connected to the internet to save asset data to Cloudflare D1.";
    return;
  }

  if (equipment.length === 0 && existingEquipment.length === 0) { eqStepStatus.textContent = "You must add at least one asset."; return; }
  
  var btnSave = document.getElementById("btnSaveEq");
  btnSave.disabled = true; btnSave.textContent = "Saving...";

  try {
    var saveErrors = [];
    for (var i = 0; i < equipment.length; i++) {
      var eq = equipment[i];
      var payload = {
        "asset_number": eq.unitNo,
        "name": eq.name,
        "category": eq.category,
        "is_attachment": eq.isAttachment,
        "allowed_category": eq.allowedCategory,
        "make": eq.make,
        "model": eq.model,
        "year": eq.year,
        "serial_number": eq.serial,
        "meter": eq.meter,
        "division": eq.division,
        "project": eq.project,
        "location": eq.location,
        "status": "active"
      };
      var res = await fetch("/api/assets", { 
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          "x-org-id": activeOrgId || ""
        }, 
        body: JSON.stringify(payload) 
      });
      if (!res.ok) {
        var errData = await res.json().catch(function() { return {}; });
        saveErrors.push(eq.unitNo + ": " + (errData.error || errData.message || "Save failed"));
      }
    }

    if (saveErrors.length > 0) {
      throw new Error("Some assets failed to save: " + saveErrors.join("; "));
    }

    var allEquipment = existingEquipment.concat(equipment);
    localStorage.setItem("driven_equipment", JSON.stringify(allEquipment));
    localStorage.setItem("driven_equipment_count", allEquipment.length);

    eqStepStatus.style.color = "var(--success)";
    eqStepStatus.textContent = equipment.length + " asset(s) saved directly to system. Redirecting to onboarding dashboard…";
    btnSave.textContent = "Saved ✓"; eqDirty = false;
    equipment = [];
    await loadExistingEquipment();
    renderTable(); updateCount();
    setTimeout(function() { btnSave.disabled = false; btnSave.textContent = "Save & Continue"; window.location.href = "/app/dashboard/onboarding-dashboard.html"; }, 1500);
  } catch(err) {
    eqStepStatus.style.color = "var(--error)";
    eqStepStatus.textContent = "Save failed: " + err.message;
    btnSave.disabled = false; btnSave.textContent = "Save & Continue";
    if (window.DRIVENErrorHandler) { window.DRIVENErrorHandler.report("equipment.html: save failed — " + (err.message || err), "save-equipment-catch", err && err.stack ? err.stack : null); }
  }
});

function downloadEquipmentTemplate() {
  var ws = XLSX.utils.aoa_to_sheet([["Asset ID", "Name", "Asset Type", "Is Attachment", "Compatible Category", "Make", "Model", "Year", "Serial #", "Meter", "Division", "Project", "Location"]]);
  ws["!cols"] = [{ wch: 16 }, { wch: 35 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 25 }, { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];
  downloadXlsxWithFrozenHeader(ws, "Assets", "Asset-Mass-Upload-v1.0.xlsx");
}
window.downloadEquipmentTemplate = downloadEquipmentTemplate;

function parseCsvLine(line) {
  var result = []; var current = ""; var inQuotes = false;
  for (var i = 0; i < line.length; i++) { var ch = line[i]; if (inQuotes) { if (ch === '"') { if (line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; } } else { current += ch; } } else { if (ch === '"') { inQuotes = true; } else if (ch === ",") { result.push(current.trim()); current = ""; } else { current += ch; } } }
  result.push(current.trim()); return result;
}

document.addEventListener("dashSessionLoaded", async function(e) {
  var userObj = JSON.parse(localStorage.getItem("driven_user") || "{}");
  activeOrgId = (e.detail && e.detail.org_id) || userObj.org_id || localStorage.getItem("driven_org_id") || "";
  customerOrgName = (e.detail && e.detail.org_name) || localStorage.getItem("driven_org_name") || "DRIV-EN Org";

  var row1 = document.querySelector(".dash-header-row1");
  if (row1 && !document.querySelector(".eq-header-title")) {
    var title = document.createElement("div"); 
    title.className = "eq-header-title";
    title.textContent = "Onboarding — Assets"; 
    var logoArea = document.getElementById("dashCustomerLogoArea"); 
    var drivenLogo = row1.querySelector(".dash-driven-logo"); 
    if (logoArea && drivenLogo) { row1.insertBefore(title, drivenLogo); } 
  }

  await loadDropdowns();
  await loadExistingEquipment(); 
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
