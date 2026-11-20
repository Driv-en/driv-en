/* Employee form page — Add / Edit / View an employee record */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var editId = params.get("id") || "";
  var isView = params.get("view") === "1";
  var currentOrgId = null;
  var allRoles = [];
  var docKeys = { dl_front: "", dl_back: "" };
  var inited = false;

  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? el.value : ""; }
  function setVal(id, v) { var el = $(id); if (el) el.value = (v === undefined || v === null) ? "" : v; }

  function setStatus(msg, ok) {
    var el = $("efStatusMsg");
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? "#16a34a" : "#dc2626";
  }

  function getUser() {
    var u = window.dashUser || window.drivenUser;
    if (!u) { try { u = JSON.parse(localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user") || "{}"); } catch (e) { u = {}; } }
    return u;
  }

  window.efGoDashboard = function () {
    var u = getUser();
    var role = String(u.role || u.role_name || u.role_id || "").toLowerCase();
    var isAdmin = u.is_admin === true || u.isAdmin === true || /admin|owner|super/.test(role);
    window.location.href = isAdmin ? "/app/dashboard/admin.html" : "/app/dashboard/employee-dashboard.html";
  };
  window.efLogout = function () {
    fetch("/auth/logout", { method: "POST", credentials: "include" }).catch(function () {}).finally(function () { window.location.href = "/public/login.html"; });
  };
  window.efCancel = function () { window.location.href = "/app/dashboard/user-management.html"; };

  window.efOpenModal = function (id) { var m = $(id); if (m) m.classList.add("active"); };
  window.efCloseModal = function (id) { var m = $(id); if (m) m.classList.remove("active"); };

  function populateWelcome() {
    var u = getUser();
    var orgName = u.org_name || localStorage.getItem("driven_org_name") || "";
    var nameEl = $("ef-welcome-name");
    if (nameEl) {
      var name = u.full_name || u.name || ((u.first_name || "") + " " + (u.last_name || "")).trim();
      nameEl.textContent = name ? ("Welcome back, " + name + (orgName ? " — " + orgName : "")) : "Welcome back";
    }
    var roleEl = $("ef-welcome-role"); if (roleEl) roleEl.textContent = u.role || u.role_name || "";
    var emailEl = $("ef-welcome-email"); if (emailEl) emailEl.textContent = u.email || "";
  }

  function wireTheme() {
    var cb = $("efThemeCheckbox");
    if (!cb) return;
    var current = document.documentElement.getAttribute("data-theme") || "light";
    cb.checked = (current === "dark");
    cb.addEventListener("change", function () {
      var t = cb.checked ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", t);
      localStorage.setItem("driven-theme", t);
    });
  }

  function loadRoles() {
    return fetch("/api/roles?org_id=" + encodeURIComponent(currentOrgId || ""))
      .then(function (r) { return r.ok ? r.json() : { roles: [] }; })
      .then(function (data) {
        allRoles = data.roles || data.records || data.data || (Array.isArray(data) ? data : []);
        var sel = $("efRole");
        if (!sel) return;
        sel.innerHTML = "";
        if (!allRoles.length) allRoles = [{ id: "Employee", name: "Employee" }, { id: "Fleet Manager", name: "Fleet Manager" }, { id: "Admin", name: "Admin" }];
        allRoles.forEach(function (r) {
          var opt = document.createElement("option");
          opt.value = r.name || r.id;
          opt.textContent = r.name || r.id;
          sel.appendChild(opt);
        });
      })
      .catch(function () {});
  }

  function resolveRoleName(v) {
    if (!v) return "";
    var s = String(v);
    var byId = allRoles.find(function (r) { return String(r.id) === s; });
    if (byId) return byId.name || s;
    return s;
  }

  window.efToggleIdType = function () {
    var hasDl = val("efHasDl") === "yes";
    var dl = $("efDlFields"); var sid = $("efStateIdFields");
    if (dl) dl.style.display = hasDl ? "block" : "none";
    if (sid) sid.style.display = hasDl ? "none" : "block";
  };

  function toggleTermDate() {
    var wrap = $("efTermDateWrap");
    if (wrap) wrap.style.display = (val("efStatus") === "Terminated") ? "flex" : "none";
  }

  function showDocButtons() {
    var vf = $("efViewDlFront"); if (vf) vf.style.display = docKeys.dl_front ? "inline-block" : "none";
    var vb = $("efViewDlBack"); if (vb) vb.style.display = docKeys.dl_back ? "inline-block" : "none";
  }

  window.efViewDoc = function (which) {
    var key = docKeys[which];
    if (!key) { setStatus("No document on file.", false); return; }
    window.open("/api/employee-documents/" + encodeURIComponent(key), "_blank");
  };

  function loadEmployee() {
    return fetch("/api/onboarding/employees/list")
      .then(function (r) { return r.ok ? r.json() : { employees: [] }; })
      .then(function (data) {
        var list = data.employees || (Array.isArray(data) ? data : []);
        var emp = list.find(function (e) { return String(e.id) === String(editId); });
        if (!emp) { setStatus("Employee not found.", false); return; }
        setVal("efFn", emp.first_name || emp.firstName);
        setVal("efMn", emp.middle_name || emp.middleName);
        setVal("efLn", emp.last_name || emp.lastName);
        setVal("efSuffix", emp.suffix);
        setVal("efDob", emp.dob);
        setVal("efEmail", emp.email);
        setVal("efPhone", emp.phone);
        setVal("efAddress", emp.address);
        setVal("efCity", emp.city);
        setVal("efState", emp.state);
        setVal("efZip", emp.zip);
        setVal("efNum", emp.employee_number || emp.employeeNumber);
        setVal("efHireDate", emp.hire_date);
        setVal("efTermDate", emp.termination_date);
        var roleVal = resolveRoleName(emp.role || emp.role_name || emp.role_id);
        var roleSel = $("efRole");
        if (roleSel && roleVal) {
          var found = false;
          for (var i = 0; i < roleSel.options.length; i++) { if (roleSel.options[i].value === roleVal) { roleSel.selectedIndex = i; found = true; break; } }
          if (!found) { var o = document.createElement("option"); o.value = roleVal; o.textContent = roleVal; roleSel.appendChild(o); roleSel.value = roleVal; }
        }
        setVal("efStatus", emp.status || "Active");
        setVal("efCommercialDriver", (emp.is_commercial_driver === "yes" || emp.is_commercial_driver === true) ? "yes" : "no");
        setVal("efDrivesCoVehicle", (emp.drives_company_vehicle === "yes" || emp.drives_company_vehicle === true) ? "yes" : "no");
        setVal("efUsesEmpAssets", (emp.uses_employee_assets === "yes" || emp.uses_employee_assets === true) ? "yes" : "no");
        // Identification
        var idType = emp.id_type || "dl";
        var hasDl = idType !== "state_id";
        setVal("efHasDl", hasDl ? "yes" : "no");
        if (hasDl) {
          setVal("efDl", emp.drivers_license || emp.driversLicense);
          setVal("efDlState", emp.dl_state || emp.dlState);
          setVal("efDlExp", emp.dl_expiration || emp.dlExpiration);
        } else {
          setVal("efStateId", emp.drivers_license || emp.driversLicense);
          setVal("efStateIdState", emp.dl_state || emp.dlState);
          setVal("efStateIdExp", emp.dl_expiration || emp.dlExpiration);
        }
        docKeys.dl_front = emp.dl_photo_front || "";
        docKeys.dl_back = emp.dl_photo_back || "";
        showDocButtons();
        efToggleIdType();
        toggleTermDate();
      })
      .catch(function (e) { setStatus("Could not load employee: " + e.message, false); });
  }

  function setViewMode() {
    var badge = $("efModeBadge"); if (badge) badge.style.display = "inline-block";
    var title = $("efTitle"); if (title) title.textContent = "View Employee";
    document.querySelectorAll(".ef-main input, .ef-main select").forEach(function (el) { if (el.type !== "file") el.disabled = true; });
    var saveBtn = $("efSaveBtn"); if (saveBtn) saveBtn.style.display = "none";
    var editBtn = $("efEditBtn"); if (editBtn) editBtn.style.display = "inline-flex";
  }

  window.efEnableEdit = function () {
    document.querySelectorAll(".ef-main input, .ef-main select").forEach(function (el) { if (el.type !== "file") el.disabled = false; });
    var saveBtn = $("efSaveBtn"); if (saveBtn) saveBtn.style.display = "inline-block";
    var editBtn = $("efEditBtn"); if (editBtn) editBtn.style.display = "none";
    var badge = $("efModeBadge"); if (badge) badge.style.display = "none";
    var title = $("efTitle"); if (title) title.textContent = "Edit Employee";
    toggleTermDate();
  };

  async function uploadDoc(file, docType, empId) {
    var fd = new FormData();
    fd.append("file", file);
    fd.append("doc_type", docType);
    fd.append("employee_id", empId);
    fd.append("org_id", currentOrgId || "");
    var resp = await fetch("/api/employee-documents/upload", { method: "POST", body: fd });
    if (!resp.ok) throw new Error("Upload failed");
    var data = await resp.json();
    return data.key || data.r2_key || (data.result && data.result.key) || "";
  }

  window.efSave = async function () {
    var hasDl = val("efHasDl") === "yes";
    var required = [
      ["efFn", "First Name"], ["efLn", "Last Name"], ["efEmail", "Email"],
      ["efAddress", "Street Address"], ["efCity", "City"], ["efState", "State"], ["efZip", "Zip Code"],
      ["efRole", "Role"], ["efStatus", "Status"], ["efHireDate", "Hire Date"]
    ];
    if (hasDl) { required.push(["efDl", "Driver's License #"], ["efDlState", "DL State"], ["efDlExp", "DL Expiration"]); }
    else { required.push(["efStateId", "State ID #"], ["efStateIdState", "State ID State"], ["efStateIdExp", "State ID Expiration"]); }
    for (var i = 0; i < required.length; i++) {
      if (!val(required[i][0]).trim()) { setStatus(required[i][1] + " is required.", false); $(required[i][0]).focus(); return; }
    }

    var saveBtn = $("efSaveBtn"); if (saveBtn) saveBtn.disabled = true;
    setStatus("Saving…", true);

    var dlFrontFile = $("efDlFront"); var dlBackFile = $("efDlBack");
    try {
      if (dlFrontFile && dlFrontFile.files && dlFrontFile.files[0]) docKeys.dl_front = await uploadDoc(dlFrontFile.files[0], "dl_front", editId || "new");
      if (dlBackFile && dlBackFile.files && dlBackFile.files[0]) docKeys.dl_back = await uploadDoc(dlBackFile.files[0], "dl_back", editId || "new");
    } catch (e) { console.warn("DL upload failed:", e); }

    var fn = val("efFn").trim(); var ln = val("efLn").trim();
    var fullStr = [fn, val("efMn").trim(), ln].filter(Boolean).join(" ") + (val("efSuffix").trim() ? " " + val("efSuffix").trim() : "");
    var idNumber = hasDl ? val("efDl").trim() : val("efStateId").trim();
    var idState = hasDl ? val("efDlState").trim() : val("efStateIdState").trim();
    var idExp = hasDl ? val("efDlExp") : val("efStateIdExp");

    var payload = {
      org_id: currentOrgId,
      first_name: fn, middle_name: val("efMn").trim(), last_name: ln, suffix: val("efSuffix").trim(),
      full_name: fullStr, name: fullStr,
      email: val("efEmail").trim(), employee_number: val("efNum").trim(), role: val("efRole"),
      phone: val("efPhone").trim(), dob: val("efDob"),
      address: val("efAddress").trim(), city: val("efCity").trim(), state: val("efState").trim(), zip: val("efZip").trim(),
      status: val("efStatus"), hire_date: val("efHireDate") || undefined,
      termination_date: val("efStatus") === "Terminated" ? (val("efTermDate") || undefined) : undefined,
      drivers_license: idNumber, dl_state: idState, dl_expiration: idExp || undefined, id_type: hasDl ? "dl" : "state_id",
      is_commercial_driver: val("efCommercialDriver"),
      drives_company_vehicle: val("efDrivesCoVehicle"),
      uses_employee_assets: val("efUsesEmpAssets"),
      dl_photo_front: docKeys.dl_front || undefined,
      dl_photo_back: docKeys.dl_back || undefined
    };

    try {
      var endpoint = editId ? "/api/onboarding/employees/" + encodeURIComponent(editId) : "/api/onboarding/employees/create";
      var method = editId ? "PUT" : "POST";
      var resp = await fetch(endpoint, { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!resp.ok) throw new Error("HTTP " + resp.status);

      if (payload.is_commercial_driver === "yes") {
        try {
          await fetch("/api/notifications", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              org_id: currentOrgId, type: "new_driver", title: "New Driver Hired — Action Required",
              message: fullStr + " has been hired as a commercial driver. Complete their Driver Qualification File.",
              link: "/app/dashboard/driver-qualification-files.html", created_at: new Date().toISOString()
            })
          });
        } catch (e) { console.warn("Notification failed:", e); }
      }

      setStatus("Saved.", true);
      setTimeout(function () { window.location.href = "/app/dashboard/user-management.html"; }, 700);
    } catch (e) {
      setStatus("Save failed: " + e.message, false);
      if (saveBtn) saveBtn.disabled = false;
    }
  };

  function syncHeaderHeight() {
    var el = document.getElementById("dashStickyHeader");
    if (el) { var h = el.offsetHeight || el.getBoundingClientRect().height; if (h > 0) document.documentElement.style.setProperty("--header-height", Math.round(h) + "px"); }
  }

  function init() {
    if (inited) return; inited = true;
    var u = getUser();
    currentOrgId = u.org_id || localStorage.getItem("driven_org_id") || u.customerId;

    populateWelcome();
    wireTheme();

    var title = $("efTitle");
    if (editId && !isView && title) title.textContent = "Edit Employee";

    var statusSel = $("efStatus"); if (statusSel) statusSel.addEventListener("change", toggleTermDate);
    var bp = $("efBtnPurpose"); if (bp) bp.addEventListener("click", function () { efOpenModal("efPurposeModal"); });
    var bi = $("efBtnInstructions"); if (bi) bi.addEventListener("click", function () { efOpenModal("efInstructionsModal"); });

    loadRoles().then(function () {
      if (editId) loadEmployee().then(function () { if (isView) setViewMode(); });
    });
    if (isView) setViewMode();
    efToggleIdType();

    if (window.DRIVEN_VOICE) { try { DRIVEN_VOICE.init(); } catch (e) {} }
    [100, 300, 500, 1000].forEach(function (d) { setTimeout(syncHeaderHeight, d); });
    window.addEventListener("resize", syncHeaderHeight);
  }

  document.addEventListener("dashSessionLoaded", init);
  window.addEventListener("load", function () { setTimeout(init, 400); });
  if (document.readyState !== "loading") { setTimeout(init, 600); }
})();
