/* ==========================================================================
   DRIV-EN Platform — Onboarding: Employees JavaScript (v1)
   File: /app/onboarding/employees.js
   Extracted from employees.html for CSP compliance (no inline scripts).
   Fixed: missing `if` guard in dashSessionLoaded title creation.
   ========================================================================== */

var employees = [];
var existingEmployees = [];
var empDirty = false;
var editingEmployeeIndex = null;
var isEditingExisting = false;
var validRoles = [];
var validStatuses = ["Active", "Inactive"];
var lastDivisionVal = "";
var lastRoleVal = "";
var activeOrgId = null;
var customerOrgName = "DRIV-EN Org";

var sessionPageSize = 10, sessionPage = 1, sessionSortCol = 'fullName', sessionSortAsc = true;
var existingPageSize = 10, existingPage = 1, existingSortCol = 'fullName', existingSortAsc = true;

var empError = document.getElementById("empError");
var empSuccess = document.getElementById("empSuccess");
var empTableContainer = document.getElementById("empTableContainer");
var existingEmpTableContainer = document.getElementById("existingEmpTableContainer");
var empStepStatus = document.getElementById("empStepStatus");
var empCountEl = document.getElementById("empCount");
var existingEmpCountEl = document.getElementById("existingEmpCount");
var statusBulk = document.getElementById("statusBulk");
var bulkPreview = document.getElementById("bulkPreview");

function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function normalizeName(str) { 
  if (typeof str === 'object' && str !== null) {
    str = str.name || str.fullName || str.full_name || "";
  }
  return String(str || "").trim().replace(/\s+/g, " "); 
}

function validateOrgContext() {
  if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "null") {
    if (empError) empError.textContent = "Security Alert: Invalid Organization Context. Action rejected.";
    return false;
  }
  return true;
}

function sendPresenceUnload() {
  if (!activeOrgId) return;
  var payload = JSON.stringify({ page: "Employees", action: "leave" });
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
      body: JSON.stringify({ page: "Employees" })
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
  if (empDirty) {
    e.preventDefault();
    e.returnValue = "You have unsaved employees.";
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
  var totalCount = existingEmployees.length + employees.length;
  if (empCountEl) empCountEl.textContent = totalCount;
  if (existingEmpCountEl) existingEmpCountEl.textContent = existingEmployees.length;
  try {
    localStorage.setItem("driven_employee_count", String(totalCount));
  } catch (e) {}
}

function buildFullName(first, middle, last, suffix) {
  var parts = [first, middle, last].map(function(p) { return normalizeName(p); }).filter(Boolean);
  var name = parts.join(" ").trim();
  var suff = normalizeName(suffix);
  if (suff) {
    name += " " + suff;
  }
  return name;
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

function checkQuickAddRole(selectEl) {
  if (selectEl.value === "__ADD_NEW__") {
    document.getElementById("modalRoleError").textContent = "";
    document.getElementById("newRoleName").value = "";
    document.getElementById("modalRole").style.display = "flex";
    document.getElementById("newRoleName").focus();
  } else {
    lastRoleVal = selectEl.value;
  }
}
window.checkQuickAddRole = checkQuickAddRole;

function closeQuickModal(modalId, selectId) {
  document.getElementById(modalId).style.display = "none";
  var sel = document.getElementById(selectId);
  sel.value = selectId === 'empDivision' ? lastDivisionVal : lastRoleVal;
}
window.closeQuickModal = closeQuickModal;

function editEmployee(index, isExisting) {
  var list = isExisting ? existingEmployees : employees;
  var emp = list[index];
  if (!emp) return;
  editingEmployeeIndex = index;
  isEditingExisting = isExisting;
  document.getElementById("empNumber").value = normalizeName(emp.empNumber);
  document.getElementById("empFirstName").value = normalizeName(emp.firstName);
  document.getElementById("empMiddleName").value = normalizeName(emp.middleName);
  document.getElementById("empLastName").value = normalizeName(emp.lastName);
  document.getElementById("empSuffix").value = normalizeName(emp.suffix);
  document.getElementById("empEmail").value = emp.email || "";
  document.getElementById("empPhone").value = normalizeName(emp.phone);
  document.getElementById("empDivision").value = normalizeName(emp.division);
  document.getElementById("empRole").value = normalizeName(emp.role);
  document.getElementById("empStatus").value = emp.status || "Active";
  var btnAdd = document.getElementById("btnAddEmp");
  btnAdd.textContent = "Update Employee";
  btnAdd.style.background = "#2563eb";
  document.getElementById("formCard").scrollIntoView({ behavior: "smooth" });
}

async function submitQuickDivision() {
  if (!validateOrgContext()) return;
  if (!navigator.onLine) {
    document.getElementById("modalDivError").textContent = "Internet connection required to create divisions.";
    return;
  }
  var name = normalizeName(document.getElementById("newDivisionName").value);
  var errEl = document.getElementById("modalDivError");
  errEl.textContent = "";
  if (!name) { errEl.textContent = "Please enter a division name."; return; }
  try {
    var resp = await fetch("/api/divisions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-org-id": activeOrgId || ""
      },
      body: JSON.stringify({ name: name, customer_id: localStorage.getItem("driven_customer_id") || "" })
    });
    var divisions = JSON.parse(localStorage.getItem("driven_divisions") || "[]");
    if (!divisions.some(function(d) { return normalizeName(d).toLowerCase() === name.toLowerCase(); })) {
      divisions.push({ name: name });
      localStorage.setItem("driven_divisions", JSON.stringify(divisions));
    }
    loadDivisionDropdown(name);
    document.getElementById("modalDivision").style.display = "none";
  } catch (e) {
    errEl.textContent = "Error saving division: " + e.message;
  }
}
window.submitQuickDivision = submitQuickDivision;

async function submitQuickRole() {
  if (!validateOrgContext()) return;
  if (!navigator.onLine) {
    document.getElementById("modalRoleError").textContent = "Internet connection required to create roles.";
    return;
  }
  var name = normalizeName(document.getElementById("newRoleName").value);
  var errEl = document.getElementById("modalRoleError");
  errEl.textContent = "";
  if (!name) { errEl.textContent = "Please enter a role name."; return; }
  try {
    var resp = await fetch("/api/roles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-org-id": activeOrgId || ""
      },
      body: JSON.stringify({ name: name, customer_id: localStorage.getItem("driven_customer_id") || "" })
    });
    await loadRoleDropdown(name);
    document.getElementById("modalRole").style.display = "none";
  } catch (e) {
    errEl.textContent = "Error saving role: " + e.message;
  }
}
window.submitQuickRole = submitQuickRole;

function doPrintEmployees(defaultSelection) {
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
  document.title = customerOrgName + " | Employee Directory";
  window.print();
  document.title = origTitle;
  document.body.classList.remove('print-session-only', 'print-existing-only', 'print-both');
  sessionPageSize = origSessionSize;
  existingPageSize = origExistingSize;
  renderTable();
  renderExistingTable();
}
window.doPrintEmployees = doPrintEmployees;

async function loadExistingEmployees() {
  existingEmpTableContainer.textContent = "";

  if (navigator.onLine) {
    try {
      var resp = await fetch("/api/onboarding/employees/list", {
        headers: { "x-org-id": activeOrgId || "" }
      });
      if (resp.ok) {
        var data = await resp.json();
        var rawList = data.employees || data.keyPersonnel || data.records || data.users || (Array.isArray(data) ? data : []);
        if (Array.isArray(rawList)) {
          existingEmployees = rawList.map(function(item) {
            var fName = buildFullName(
              item.firstName || item.first_name,
              item.middleName || item.middle_name,
              item.lastName || item.last_name,
              item.suffix
            ) || normalizeName(item.fullName || item.full_name || item.name);

            var empNum = normalizeName(item.empNumber || item.emp_number || item.employee_number || item.emp_id || item.employee_id);

            return {
              empNumber: empNum,
              fullName: fName,
              firstName: normalizeName(item.firstName || item.first_name),
              middleName: normalizeName(item.middleName || item.middle_name),
              lastName: normalizeName(item.lastName || item.last_name),
              suffix: normalizeName(item.suffix),
              email: String(item.email || "").trim(),
              phone: normalizeName(item.phone),
              division: normalizeName(item.division || item.division_name),
              role: normalizeName(item.role || item.role_name),
              status: item.status || "Active"
            };
          });
          localStorage.setItem("driven_employees", JSON.stringify(existingEmployees));
          renderExistingTable();
          updateCount();
          return;
        }
      }
    } catch (e) {
      console.warn("API load for existing employees failed, falling back to local storage:", e.message);
    }
  }

  var cached = JSON.parse(localStorage.getItem("driven_employees") || "[]");
  existingEmployees = cached.map(function(item) {
    var fName = buildFullName(
      item.firstName || item.first_name,
      item.middleName || item.middle_name,
      item.lastName || item.last_name,
      item.suffix
    ) || normalizeName(item.fullName || item.full_name || item.name);

    return {
      empNumber: normalizeName(item.empNumber || item.emp_number),
      fullName: fName,
      firstName: normalizeName(item.firstName || item.first_name),
      middleName: normalizeName(item.middleName || item.middle_name),
      lastName: normalizeName(item.lastName || item.last_name),
      suffix: normalizeName(item.suffix),
      email: String(item.email || "").trim(),
      phone: normalizeName(item.phone),
      division: normalizeName(item.division || item.division_name),
      role: normalizeName(item.role || item.role_name),
      status: item.status || "Active"
    };
  });
  renderExistingTable();
  updateCount();
}

function renderExistingTable() {
  existingEmpTableContainer.textContent = "";
  if (existingEmployees.length === 0) {
    var empty = document.createElement("p");
    empty.className = "emp-empty";
    empty.textContent = "No existing employees in the system yet.";
    existingEmpTableContainer.appendChild(empty);
    return;
  }
  var sorted = existingEmployees.slice().sort(function(a, b) {
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

  var wrap = document.createElement("div"); wrap.className = "emp-table-wrap";
  var table = document.createElement("table"); table.className = "emp-table";
  var thead = document.createElement("thead"); var headRow = document.createElement("tr");

  var cols = [
    { label: "Emp # " + (existingSortCol === 'empNumber' ? (existingSortAsc ? '▲' : '▼') : ''), key: "empNumber" },
    { label: "Name " + (existingSortCol === 'fullName' ? (existingSortAsc ? '▲' : '▼') : ''), key: "fullName" },
    { label: "Email " + (existingSortCol === 'email' ? (existingSortAsc ? '▲' : '▼') : ''), key: "email" },
    { label: "Phone", key: "phone" },
    { label: "Division", key: "division" },
    { label: "Role", key: "role" },
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
  paged.forEach(function(emp) {
    var row = document.createElement("tr");
    var empNumCell = document.createElement("td");
    var numVal = (emp.empNumber && emp.empNumber !== "undefined" && emp.empNumber !== "null") ? emp.empNumber : "—";
    empNumCell.textContent = numVal;
    row.appendChild(empNumCell);

    var displayName = emp.fullName;
    if (!displayName || displayName === "—" || displayName === "undefined") {
      displayName = buildFullName(emp.firstName, emp.middleName, emp.lastName, emp.suffix);
    }
    if (!displayName) displayName = "—";

    [displayName, emp.email, emp.phone, emp.division, emp.role].forEach(function(val) {
      var cell = document.createElement("td");
      cell.textContent = (val && val !== "undefined" && val !== "null") ? val : "—";
      row.appendChild(cell);
    });

    var statusCell = document.createElement("td");
    var statusSelect = document.createElement("select");
    statusSelect.className = "emp-print-select";
    statusSelect.style.cssText = "height:28px !important;padding:2px 6px !important;font-size:12px !important;";
    ["Active", "Inactive"].forEach(function(st) {
      var opt = document.createElement("option");
      opt.value = st;
      opt.textContent = st;
      if (st === emp.status) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusSelect.onchange = function() {
      emp.status = this.value;
      empDirty = true;
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

  existingEmpTableContainer.appendChild(wrap);
  existingEmpTableContainer.appendChild(pBar);
  if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
}

function isDuplicateEmail(email) {
  var checkEmail = email.toLowerCase().trim();
  var inSession = employees.some(function(emp) { return (emp.email || "").toLowerCase().trim() === checkEmail; });
  var inSystem = existingEmployees.some(function(emp) { return (emp.email || "").toLowerCase().trim() === checkEmail; });
  return inSession || inSystem;
}

function loadDivisionDropdown(selectedVal) {
  var rawDivs = JSON.parse(localStorage.getItem("driven_divisions") || "[]");
  var sel = document.getElementById("empDivision");
  sel.innerHTML = '<option value="" data-i18n>— None —</option><option value="__ADD_NEW__" data-i18n>➕ Add New Division...</option>';
  rawDivs.forEach(function(div) {
    var divName = normalizeName(div);
    if (divName) {
      var opt = document.createElement("option");
      opt.value = divName;
      opt.textContent = divName;
      sel.appendChild(opt);
    }
  });
  if (selectedVal) {
    sel.value = selectedVal;
    lastDivisionVal = selectedVal;
  }
}

async function loadRoleDropdown(selectedVal) {
  var sel = document.getElementById("empRole");
  if (!sel) return;
  sel.innerHTML = '<option value="" data-i18n>— Select Role —</option><option value="__ADD_NEW__" data-i18n>➕ Add New Role...</option>';
  if (navigator.onLine) {
    try {
      var resp = await fetch("/api/roles", {
        headers: { "x-org-id": activeOrgId || "" }
      });
      var data = await resp.json();
      var rawRoles = data.roles || data.records || [];
      if (data.success && rawRoles.length > 0) {
        validRoles = rawRoles.filter(function(r) { 
          var rName = normalizeName(r);
          return rName.toLowerCase() !== "driv-en founder"; 
        }).map(function(r) { return normalizeName(r); });

        validRoles.forEach(function(roleName) {
          var opt = document.createElement("option");
          opt.value = roleName;
          opt.textContent = roleName;
          sel.appendChild(opt);
        });
      }
    } catch (e) {
      console.error("Role dropdown load error:", e.message);
    }
  }
  if (selectedVal) {
    sel.value = selectedVal;
    lastRoleVal = selectedVal;
    if (validRoles.indexOf(selectedVal) === -1) validRoles.push(selectedVal);
  }
}

function renderTable() {
  empTableContainer.textContent = "";
  if (employees.length === 0) {
    var empty = document.createElement("p");
    empty.className = "emp-empty";
    empty.textContent = "No new employees added in this session yet.";
    empTableContainer.appendChild(empty);
    return;
  }
  var sorted = employees.slice().sort(function(a, b) {
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

  var wrap = document.createElement("div"); wrap.className = "emp-table-wrap";
  var table = document.createElement("table"); table.className = "emp-table";
  var thead = document.createElement("thead"); var headRow = document.createElement("tr");

  var cols = [
    { label: "Emp # " + (sessionSortCol === 'empNumber' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "empNumber" },
    { label: "Name " + (sessionSortCol === 'fullName' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "fullName" },
    { label: "Email " + (sessionSortCol === 'email' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "email" },
    { label: "Phone", key: "phone" },
    { label: "Division", key: "division" },
    { label: "Role", key: "role" },
    { label: "Status", key: "status" },
    { label: "Action", key: "" }
  ];

  cols.forEach(function(c) {
    var th = document.createElement("th");
    th.textContent = c.label;
    if (c.label === "Action") th.className = "emp-actions-col";
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
  paged.forEach(function(emp, index) {
    var row = document.createElement("tr");
    var empNumCell = document.createElement("td");
    empNumCell.textContent = emp.empNumber ? emp.empNumber : "—";
    row.appendChild(empNumCell);

    [emp.fullName, emp.email, emp.phone, emp.division, emp.role, emp.status].forEach(function(val) {
      var cell = document.createElement("td");
      cell.textContent = val || "—";
      row.appendChild(cell);
    });

    var cellAction = document.createElement("td");
    cellAction.className = "emp-actions-col";
    var btnEdit = document.createElement("button");
    btnEdit.className = "emp-btn-secondary";
    btnEdit.style.cssText = "padding:4px 10px;font-size:12px;height:auto;margin-right:6px;";
    btnEdit.textContent = "Edit";
    btnEdit.addEventListener("click", function() { editEmployee(start + index, false); });
    cellAction.appendChild(btnEdit);

    var btn = document.createElement("button");
    btn.className = "emp-btn-secondary";
    btn.style.cssText = "padding:4px 10px;font-size:12px;height:auto;";
    btn.textContent = "Remove";
    btn.addEventListener("click", function() { removeEmployee(start + index); });
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

  empTableContainer.appendChild(wrap);
  empTableContainer.appendChild(pBar);
  if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
}

function removeEmployee(index) {
  employees.splice(index, 1);
  renderTable();
  updateCount();
  empSuccess.textContent = "";
  empError.textContent = "";
  empDirty = true;
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
  if (empDirty) {
    return confirm("You have unsaved employees. Click OK to leave without saving, or Cancel to stay and save them.");
  }
  return true;
};

window.confirmLogout = function() {
  if (empDirty) {
    if (!confirm("You have unsaved employees. Click OK to log out without saving, or Cancel to stay and save them.")) return;
  }
  dashLogout();
};

document.getElementById("btnAddEmp").addEventListener("click", function() {
  if (!validateOrgContext()) return;
  empError.textContent = "";
  empSuccess.textContent = "";

  var empNumber = normalizeName(document.getElementById("empNumber").value);
  var first = normalizeName(document.getElementById("empFirstName").value);
  var middle = normalizeName(document.getElementById("empMiddleName").value);
  var last = normalizeName(document.getElementById("empLastName").value);
  var suffix = normalizeName(document.getElementById("empSuffix").value);
  var email = document.getElementById("empEmail").value.trim();
  var phone = normalizeName(document.getElementById("empPhone").value);
  var division = normalizeName(document.getElementById("empDivision").value);
  var role = normalizeName(document.getElementById("empRole").value);
  var status = document.getElementById("empStatus").value;

  if (!first || !last || !email) {
    empError.textContent = "First Name, Last Name, and Email are required.";
    return;
  }
  if (!isValidEmail(email)) {
    empError.textContent = "Please enter a valid email address.";
    return;
  }
  if (!role || role === "__ADD_NEW__") {
    empError.textContent = "Role is required. Please select a role.";
    return;
  }
  if (!status) {
    empError.textContent = "Status is required. Please select a status.";
    return;
  }

  if (division === "__ADD_NEW__") division = "";

  var checkFullName = buildFullName(first, middle, last, suffix).toLowerCase().trim();
  var nameMatch = existingEmployees.some(function(emp) { return (emp.fullName || "").toLowerCase().trim() === checkFullName; }) ||
                  employees.some(function(emp) { return (emp.fullName || "").toLowerCase().trim() === checkFullName; });

  if (nameMatch && editingEmployeeIndex === null) {
    var confirmAdd = confirm("⚠️ An employee named '" + buildFullName(first, middle, last, suffix) + "' already exists in the system.\n\nWould you like to add a middle initial or suffix to differentiate them, or proceed anyway?");
    if (!confirmAdd) return;
  }

  var fullName = buildFullName(first, middle, last, suffix);
  var empObj = {
    empNumber: empNumber,
    firstName: first,
    middleName: middle,
    lastName: last,
    suffix: suffix,
    fullName: fullName,
    email: email,
    phone: phone,
    division: division,
    role: role,
    status: status,
    customerId: localStorage.getItem("driven_customer_id") || ""
  };

  if (editingEmployeeIndex !== null) {
    if (isEditingExisting) {
      existingEmployees[editingEmployeeIndex] = empObj;
      renderExistingTable();
    } else {
      employees[editingEmployeeIndex] = empObj;
      renderTable();
    }
    editingEmployeeIndex = null;
    isEditingExisting = false;
    var btnAdd = document.getElementById("btnAddEmp");
    btnAdd.textContent = "Add Employee";
    btnAdd.style.background = "";
    empSuccess.textContent = "Employee updated successfully.";
  } else {
    if (isDuplicateEmail(email)) {
      empError.textContent = "An employee with this email address already exists in the system or current batch.";
      return;
    }
    employees.push(empObj);
    renderTable();
    empSuccess.textContent = "Employee added to current batch. Click Save & Continue when finished.";
  }

  updateCount();
  empDirty = true;
  document.getElementById("empNumber").value = "";
  document.getElementById("empFirstName").value = "";
  document.getElementById("empMiddleName").value = "";
  document.getElementById("empLastName").value = "";
  document.getElementById("empSuffix").value = "";
  document.getElementById("empEmail").value = "";
  document.getElementById("empPhone").value = "";
  document.getElementById("empDivision").value = "";
  document.getElementById("empRole").value = "";
  document.getElementById("empStatus").value = "Active";
  document.getElementById("empFirstName").focus();
});

document.getElementById("btnProcessBulk").addEventListener("click", function() {
  if (!validateOrgContext()) return;
  statusBulk.textContent = "";
  statusBulk.className = "emp-error";

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

      var requiredFields = ["First Name", "Last Name", "Email", "Role", "Status"];
      var header = Object.keys(rows[0]);

      for (var i = 0; i < requiredFields.length; i++) {
        if (header.indexOf(requiredFields[i]) === -1) {
          statusBulk.textContent = "Missing required column: " + requiredFields[i];
          return;
        }
      }

      var rawDivs = JSON.parse(localStorage.getItem("driven_divisions") || "[]");
      var validDivisions = rawDivs.map(function(d) { return normalizeName(d); }).filter(Boolean);

      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        for (var f = 0; f < requiredFields.length; f++) {
          if (!row[requiredFields[f]] || String(row[requiredFields[f]]).trim() === "") {
            statusBulk.textContent = "Row " + (r + 2) + ": " + requiredFields[f] + " is required.";
            return;
          }
        }
        var rowEmail = String(row["Email"]).trim();
        if (!isValidEmail(rowEmail)) {
          statusBulk.textContent = "Row " + (r + 2) + ': Invalid email address "' + rowEmail + '".';
          return;
        }
        var rowRole = normalizeName(row["Role"]);
        if (validRoles.indexOf(rowRole) === -1) {
          statusBulk.textContent = "Row " + (r + 2) + ': Invalid Role "' + rowRole + '". Must be one of: ' + validRoles.join(", ") + '.';
          return;
        }
        var rowStatus = normalizeName(row["Status"]);
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

      var seenEmails = {};
      for (var d = 0; d < rows.length; d++) {
        var em = String(rows[d]["Email"]).trim().toLowerCase();
        if (seenEmails[em]) {
          statusBulk.textContent = "Duplicate email found in the upload file: " + em + " (rows " + seenEmails[em] + " and " + (d + 2) + ").";
          return;
        }
        seenEmails[em] = (d + 2);
        if (isDuplicateEmail(em)) {
          statusBulk.textContent = "Row " + (d + 2) + ': Email "' + em + '" already exists in the system or current batch.';
          return;
        }
      }

      var bulkEmployees = rows.map(function(row) {
        var empNum = row["Employee #"] ? normalizeName(row["Employee #"]) : "";
        var first = normalizeName(row["First Name"]);
        var middle = row["Middle Name"] ? normalizeName(row["Middle Name"]) : "";
        var last = normalizeName(row["Last Name"]);
        var suffix = row["Suffix"] ? normalizeName(row["Suffix"]) : "";
        var email = String(row["Email"]).trim();
        var phone = row["Phone"] ? normalizeName(row["Phone"]) : "";
        var division = row["Division"] ? normalizeName(row["Division"]) : "";
        var role = normalizeName(row["Role"]);
        var status = normalizeName(row["Status"]);

        return {
          empNumber: empNum,
          firstName: first,
          middleName: middle,
          lastName: last,
          suffix: suffix,
          fullName: buildFullName(first, middle, last, suffix),
          email: email,
          phone: phone,
          division: division,
          role: role,
          status: status,
          customerId: localStorage.getItem("driven_customer_id") || ""
        };
      });

      var allCols = ["Employee #"].concat(requiredFields).concat(["Middle Name", "Suffix", "Phone", "Division"]);
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
      bulkEmployees.forEach(function(emp) {
        var pRow = document.createElement("tr");
        [emp.empNumber, emp.firstName, emp.middleName, emp.lastName, emp.suffix, emp.email, emp.phone, emp.division, emp.role, emp.status].forEach(function(val) {
          var pCell = document.createElement("td");
          pCell.textContent = val || "";
          pRow.appendChild(pCell);
        });
        pTbody.appendChild(pRow);
      });
      pTable.appendChild(pTbody);
      bulkPreview.appendChild(pTable);

      employees = employees.concat(bulkEmployees);
      renderTable();
      updateCount();
      statusBulk.textContent = "Uploaded " + bulkEmployees.length + " employees. Review above and click Save & Continue.";
      statusBulk.className = "emp-success";
      empDirty = true;
    } catch(parseErr) {
      statusBulk.textContent = "Could not parse the file. Make sure it is a valid Excel (.xlsx) or CSV file with the required columns (First Name, Last Name, Email, Role, Status).";
      statusBulk.className = "emp-error";
      if (window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report("employees.html: bulk upload parse failed — " + (parseErr.message || parseErr), "bulk-upload-parse", parseErr && parseErr.stack ? parseErr.stack : null);
      }
    }
  };

  if (file.name.toLowerCase().endsWith(".csv")) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
});

document.getElementById("btnSaveEmp").addEventListener("click", async function() {
  if (!validateOrgContext()) return;
  empStepStatus.textContent = "";
  empStepStatus.style.color = "var(--error)";

  if (!navigator.onLine) {
    empStepStatus.textContent = "Network Error: You must be connected to the internet to save employee data to Cloudflare D1.";
    return;
  }

  if (employees.length === 0 && existingEmployees.length === 0) {
    empStepStatus.textContent = "You must add at least one employee.";
    return;
  }

  var allEmployees;
  try {
    allEmployees = existingEmployees.concat(employees);
    localStorage.setItem("driven_employees", JSON.stringify(allEmployees));
    localStorage.setItem("driven_employee_count", String(allEmployees.length));
  } catch(lsErr) {
    console.warn("localStorage save failed:", lsErr.message);
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report("employees.html: localStorage save failed — " + (lsErr.message || lsErr), "save-localStorage", lsErr && lsErr.stack ? lsErr.stack : null);
    }
    allEmployees = employees.slice();
  }

  var btnSave = document.getElementById("btnSaveEmp");
  btnSave.disabled = true;
  btnSave.textContent = "Saving...";

  try {
    var res = await fetch("/auth/save-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-org-id": activeOrgId || ""
      },
      body: JSON.stringify({ settings: { employees: allEmployees } })
    });
    var data = await res.json();
    if (!res.ok) {
      if (res.status < 500 && window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report("employees.html: save-settings returned " + res.status + " — " + (data.error || "Request failed"), "save-settings-" + res.status, "URL: /auth/save-settings | Employees: " + allEmployees.length);
      }
      throw new Error(data.error || "Save failed");
    }
    empStepStatus.style.color = "var(--success)";
    empStepStatus.textContent = employees.length + " employee(s) saved. Total employees: " + allEmployees.length + ". Redirecting to onboarding dashboard…";
    btnSave.textContent = "Saved ✓";
    empDirty = false;
    employees = [];
    await loadExistingEmployees();
    renderTable();
    updateCount();
    setTimeout(function() {
      btnSave.disabled = false;
      btnSave.textContent = "Save & Continue";
      window.location.href = "/app/dashboard/onboarding-dashboard.html";
    }, 1500);
  } catch(err) {
    empStepStatus.style.color = "var(--error)";
    empStepStatus.textContent = "Server save failed: " + err.message;
    btnSave.disabled = false;
    btnSave.textContent = "Save & Continue";
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report("employees.html: save failed — " + (err.message || err), "save-settings-catch", err && err.stack ? err.stack : null);
    }
  }
});

function downloadEmployeeTemplate() {
  var ws = XLSX.utils.aoa_to_sheet([["Employee #", "First Name", "Middle Name", "Last Name", "Suffix", "Email", "Phone", "Division", "Role", "Status"]]);
  ws["!cols"] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 12 }];
  downloadXlsxWithFrozenHeader(ws, "Employees", "Employee-Mass-Upload-v1.0.xlsx");
}
window.downloadEmployeeTemplate = downloadEmployeeTemplate;

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

document.addEventListener("dashSessionLoaded", function(e) {
  var userObj = JSON.parse(localStorage.getItem("driven_user") || "{}");
  activeOrgId = userObj.org_id || (e.detail && e.detail.org_id) || localStorage.getItem("driven_org_id");
  customerOrgName = (e.detail && e.detail.org_name) || localStorage.getItem("driven_org_name") || "DRIV-EN Org";

  var row1 = document.querySelector(".dash-header-row1");
  if (row1 && !document.querySelector(".emp-header-title")) {
    var title = document.createElement("div");
    title.className = "emp-header-title";
    title.textContent = "Onboarding — Employees";
    var logoArea = document.getElementById("dashCustomerLogoArea");
    var drivenLogo = row1.querySelector(".dash-driven-logo");
    if (logoArea && drivenLogo) { row1.insertBefore(title, drivenLogo); }
  }

  loadDivisionDropdown();
  loadRoleDropdown();
  loadExistingEmployees();
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
