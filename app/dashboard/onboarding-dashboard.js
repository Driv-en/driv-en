/* ==========================================================================
   DRIV-EN Platform — Onboarding Dashboard JavaScript Module
   File: /app/dashboard/onboarding-dashboard.js
   ========================================================================== */

(function () {
  'use strict';

  // Module State
  let currentUser = null;
  let isAdmin = false;
  let assignedTasks = [];
  let stepCompletion = {};
  let stepVisibility = {};
  let onboardingComplete = false;
  let taskCompletions = {};
  let allKP = [];
  let activeOrgId = "";
  let isProcessingSession = false;

  const STEP_DEFS = {
    1:  { name: "roles-permissions", task: "Roles & Permissions", prereqs: [],   url: "/app/onboarding/roles-permissions.html" },
    2:  { name: "employees",         task: "Employees",           prereqs: [1],  url: "/app/onboarding/employees.html" },
    3:  { name: "locations",         task: "Locations",           prereqs: [],   url: "/app/onboarding/locations.html" },
    4:  { name: "clients",           task: "Clients",             prereqs: [],   url: "/app/onboarding/clients.html" },
    5:  { name: "divisions",         task: "Divisions",           prereqs: [],   url: "/app/onboarding/divisions.html" },
    6:  { name: "project-types",     task: "Project Types",       prereqs: [],   url: "/app/onboarding/project-types.html" },
    7:  { name: "projects",          task: "Projects",            prereqs: [4],  url: "/app/onboarding/projects.html" },
    8:  { name: "fuel-types",        task: "Fuels, Fluids & Energy", prereqs: [],url: "/app/onboarding/fuel-types.html" },
    9:  { name: "units-of-measure",  task: "Units of Measure",    prereqs: [],   url: "/app/onboarding/units-of-measure.html" },
    10: { name: "asset-types",       task: "Asset Types",         prereqs: [],   url: "/app/onboarding/asset-types.html" },
    11: { name: "assets",            task: "Assets",              prereqs: [10], url: "/app/onboarding/equipment.html" }
  };

  /* ===== SESSION & HEADERS ===== */

  function getAuthHeaders(additionalHeaders = {}) {
    const userObj = JSON.parse(localStorage.getItem("driven_user") || "{}");
    const orgId = activeOrgId || userObj.org_id || localStorage.getItem("driven_org_id") || "";
    const userId = userObj.id || localStorage.getItem("driven_user_id") || "";

    const headers = { ...additionalHeaders };
    if (orgId) headers["x-org-id"] = orgId;
    if (userId) headers["x-user-id"] = String(userId);
    return headers;
  }

  /* ===== NAVIGATION & HEADER ===== */

  function switchTab(tabName) {
    document.querySelectorAll('.ob-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ob-tab-content').forEach(c => c.classList.remove('active'));
    const tabBtn = document.querySelector(`.ob-tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabContent) tabContent.classList.add('active');
  }

  function dashLogout() {
    fetch('/auth/logout', { method: 'POST', credentials: 'include', headers: getAuthHeaders() })
      .catch(() => {})
      .finally(() => {
        window.location.href = '/public/login.html';
      });
  }

  function makeTabsSticky() {
    const header = document.getElementById("dashHeader");
    const tabBar = document.getElementById("obTabBar");
    if (header && tabBar) {
      const headerRect = header.getBoundingClientRect();
      const headerBottom = headerRect.bottom > 0 ? headerRect.bottom : (header.offsetHeight || 0);
      tabBar.style.top = headerBottom + "px";
    }
  }

  function insertHeaderTitle() {
    const row1 = document.querySelector(".dash-header-row1");
    if (row1 && !document.querySelector(".ob-header-title")) {
      const title = document.createElement("div");
      title.className = "ob-header-title";
      title.textContent = "Onboarding Dashboard";
      const logoArea = document.getElementById("dashCustomerLogoArea");
      const drivenLogo = row1.querySelector(".dash-driven-logo");
      if (logoArea && drivenLogo) {
        row1.insertBefore(title, drivenLogo);
      } else {
        row1.appendChild(title);
      }
    }
  }

  /* ===== THEME MANAGEMENT ===== */

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const newTheme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("driven-theme", newTheme);
    updateThemeSwitch();
  }

  function updateThemeSwitch() {
    const current = document.documentElement.getAttribute("data-theme");
    const checkbox = document.getElementById("theme-checkbox");
    const labelLight = document.getElementById("theme-label-light");
    const labelDark = document.getElementById("theme-label-dark");
    if (checkbox) checkbox.checked = (current === "dark");
    if (labelLight) labelLight.classList.toggle('active', current === 'light');
    if (labelDark) labelDark.classList.toggle('active', current === 'dark');
  }

  /* ===== POPUPS & INFO DIALOGS ===== */

  function togglePopup(id) {
    const popup = document.getElementById(id);
    const overlay = document.getElementById("popupOverlay");
    const isActive = popup ? popup.classList.contains("active") : false;
    closeAllPopups();
    if (!isActive && popup && overlay) {
      popup.classList.add("active");
      overlay.classList.add("active");
    }
  }

  function closeAllPopups() {
    document.querySelectorAll(".ob-info-popup").forEach(p => p.classList.remove("active"));
    const overlay = document.getElementById("popupOverlay");
    if (overlay) overlay.classList.remove("active");
  }

  /* ===== STEP STATUS & BUTTON STATE MANAGEMENT ===== */

  function setStatus(id, statusClass, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = "ob-step-status " + statusClass;
    el.textContent = text;
  }

  function setButton(stepNum, enabled, url) {
    const btn = document.getElementById("btn-step" + stepNum);
    if (!btn) return;
    if (enabled && url) {
      btn.disabled = false;
      btn.onclick = function() { window.location.href = url; };
    } else {
      btn.disabled = true;
      btn.onclick = null;
    }
  }

  function loadTaskCompletions() {
    try {
      taskCompletions = JSON.parse(localStorage.getItem("driven_task_completions") || "{}");
    } catch (e) {
      taskCompletions = {};
    }
  }

  function saveTaskCompletions() {
    localStorage.setItem("driven_task_completions", JSON.stringify(taskCompletions));
  }

  function getAssignedEmails(taskName) {
    const emails = [];
    allKP.forEach(kp => {
      if (kp.roles) {
        for (let i = 0; i < kp.roles.length; i++) {
          if (kp.roles[i].role === taskName || kp.roles[i].task_name === taskName) {
            emails.push(kp.email.toLowerCase());
            break;
          }
        }
      }
    });
    return emails;
  }

  function getAssignedNames(taskName) {
    const names = [];
    allKP.forEach(kp => {
      if (kp.roles) {
        for (let i = 0; i < kp.roles.length; i++) {
          if (kp.roles[i].role === taskName || kp.roles[i].task_name === taskName) {
            names.push(kp.name || kp.email);
            break;
          }
        }
      }
    });
    return names;
  }

  function isTaskFullyComplete(stepNum) {
    const def = STEP_DEFS[stepNum];
    const taskName = def.task;

    if (localStorage.getItem("driven_step_" + def.name + "_complete") === "true") {
      return true;
    }

    const assignedEmails = getAssignedEmails(taskName);
    if (assignedEmails.length === 0) {
      const completions = taskCompletions[taskName] || [];
      return completions.length > 0;
    }
    const completions = taskCompletions[taskName] || [];
    for (let i = 0; i < assignedEmails.length; i++) {
      if (completions.indexOf(assignedEmails[i]) === -1) return false;
    }
    return true;
  }

  function markTaskComplete(stepNum) {
    const def = STEP_DEFS[stepNum];
    const taskName = def.task;
    const myEmail = (currentUser && currentUser.email) ? currentUser.email.toLowerCase() : "";
    if (!taskCompletions[taskName]) taskCompletions[taskName] = [];
    if (taskCompletions[taskName].indexOf(myEmail) === -1) {
      taskCompletions[taskName].push(myEmail);
    }
    localStorage.setItem("driven_step_" + def.name + "_complete", "true");
    saveTaskCompletions();
    updateStepStatus(stepNum);
    checkAllComplete();
  }

  function updateCompleteButton(stepNum) {
    const btn = document.getElementById("btn-complete-step" + stepNum);
    if (!btn) return;
    const def = STEP_DEFS[stepNum];
    const taskName = def.task;
    const myEmail = (currentUser && currentUser.email) ? currentUser.email.toLowerCase() : "";

    const completions = taskCompletions[taskName] || [];
    const isAlreadyComplete = completions.indexOf(myEmail) !== -1 || localStorage.getItem("driven_step_" + def.name + "_complete") === "true";

    if (isAlreadyComplete) {
      btn.style.display = "inline-block";
      btn.classList.add("done");
      btn.textContent = "✓ You marked complete";
      btn.disabled = true;
      return;
    }
    if (def.prereqs.length > 0 && !checkPrereqs(stepNum)) {
      btn.style.display = "inline-block";
      btn.classList.remove("done");
      btn.disabled = true;
      const prereqNames = getVisiblePrereqNames(stepNum).join(", ");
      btn.textContent = "🔒 Mark Complete — Requires " + prereqNames;
      return;
    }
    btn.style.display = "inline-block";
    btn.classList.remove("done");
    btn.disabled = false;
    const assignedEmails = getAssignedEmails(taskName);
    if (assignedEmails.length > 1) {
      const doneCount = assignedEmails.filter(e => completions.indexOf(e) !== -1).length;
      btn.textContent = "✓ Mark Complete (" + doneCount + "/" + assignedEmails.length + " done)";
    } else {
      btn.textContent = "✓ Mark Complete";
    }
  }

  function checkAllComplete() {
    let allDone = true;
    for (let i = 1; i <= 11; i++) {
      if (!isStepVisible(STEP_DEFS[i].name)) continue;
      if (!isTaskFullyComplete(i)) { allDone = false; break; }
    }
    return allDone;
  }

  function getVisiblePrereqNames(stepNum) {
    const prereqs = STEP_DEFS[stepNum].prereqs;
    const names = [];
    prereqs.forEach(p => {
      const pDef = STEP_DEFS[p];
      if (isStepVisible(pDef.name)) { names.push(pDef.task); }
    });
    return names;
  }

  function checkPrereqs(stepNum) {
    const prereqs = STEP_DEFS[stepNum].prereqs;
    return prereqs.every(p => {
      if (!isStepVisible(STEP_DEFS[p].name)) return true;
      return stepCompletion[p] === true;
    });
  }

  function isStepVisible(stepKey) {
    if (Object.keys(stepVisibility).length === 0) return true;
    return stepVisibility[stepKey] !== false;
  }

  function updateAssignedLabels() {
    for (let i = 1; i <= 11; i++) {
      const def = STEP_DEFS[i];
      const el = document.getElementById("assigned-step" + i);
      if (!el) continue;
      if (!isStepVisible(def.name)) { el.style.display = "none"; continue; }
      el.style.display = "flex";
      const nameEl = el.querySelector(".ob-assigned-to-name");
      if (nameEl) {
        const names = getAssignedNames(def.task);
        if (names.length > 0) {
          nameEl.textContent = names.join(", ");
          nameEl.classList.remove("unassigned");
        } else {
          nameEl.textContent = "Not assigned";
          nameEl.classList.add("unassigned");
        }
      }
    }
  }

  function updateStepStatus(stepNum) {
    const def = STEP_DEFS[stepNum];
    const statusId = "status-step" + stepNum;
    const completeBtn = document.getElementById("btn-complete-step" + stepNum);
    const reqBanner = document.getElementById("banner-step" + stepNum);

    if (!isStepVisible(def.name)) {
      const card = document.querySelector('[data-step-key="' + def.name + '"]');
      if (card) card.classList.add("hidden");
      return;
    }
    const fullyComplete = isTaskFullyComplete(stepNum);

    if (reqBanner) {
      reqBanner.style.display = fullyComplete ? "none" : "block";
    }

    if (isAdmin) {
      if (fullyComplete) {
        setStatus(statusId, "ob-completed", "Completed");
        setButton(stepNum, true, def.url);
      } else if (def.prereqs.length > 0 && !checkPrereqs(stepNum)) {
        setStatus(statusId, "ob-locked-prereq", "Locked");
        setButton(stepNum, true, def.url);
      } else {
        setStatus(statusId, "ob-ready", "Ready");
        setButton(stepNum, true, def.url);
      }
      updateCompleteButton(stepNum);
      return;
    }
    const hasTask = assignedTasks.indexOf(def.task) !== -1;
    if (!hasTask) {
      setStatus(statusId, "ob-not-assigned", "Not Assigned");
      setButton(stepNum, false);
      if (completeBtn) completeBtn.style.display = "none";
      return;
    }
    if (fullyComplete) {
      setStatus(statusId, "ob-completed", "Completed");
      setButton(stepNum, true, def.url);
    } else if (def.prereqs.length > 0 && !checkPrereqs(stepNum)) {
      setStatus(statusId, "ob-locked-prereq", "Locked");
      setButton(stepNum, true, def.url);
    } else {
      setStatus(statusId, "ob-ready", "Ready");
      setButton(stepNum, true, def.url);
    }
    updateCompleteButton(stepNum);
  }

  function updateAllSteps() {
    for (let i = 1; i <= 11; i++) { stepCompletion[i] = isTaskFullyComplete(i); }
    for (let i = 1; i <= 11; i++) { updateStepStatus(i); }
    updateAssignedLabels();
    updatePrereqPopups();
  }

  function updatePrereqPopups() {
    const popupEmp = document.getElementById("popup-emp-prereq");
    if (popupEmp) {
      const names2p = getVisiblePrereqNames(2);
      popupEmp.textContent = names2p.length > 0 ? "Requires: " + names2p.join(", ") + " must be completed first." : "";
    }
    const popup7 = document.getElementById("popup-proj-prereq");
    if (popup7) {
      const names7 = getVisiblePrereqNames(7);
      popup7.textContent = names7.length > 0 ? "Requires: " + names7.join(", ") + " must be completed first." : "";
    }
    const popupAssets = document.getElementById("popup-assets-prereq");
    if (popupAssets) {
      const names11 = getVisiblePrereqNames(11);
      popupAssets.textContent = names11.length > 0 ? "Requires: " + names11.join(", ") + " must be completed first." : "";
    }
  }

  /* ===== DATA & KPIS ===== */

  async function loadOnboardingKPIs() {
    const userObj = JSON.parse(localStorage.getItem("driven_user") || "{}");
    const orgId = activeOrgId || userObj.org_id || localStorage.getItem("driven_org_id");
    const customerId = localStorage.getItem("driven_customer_id") || "";

    if (!orgId || orgId === "default_org") return;

    const headers = getAuthHeaders();

    function setCardKpi(stepNum, text) {
      const row = document.getElementById("kpiRow" + stepNum);
      const val = document.getElementById("kpiVal" + stepNum);
      if (row && val) {
        val.textContent = text;
        row.style.cssText = "display: flex !important; visibility: visible !important; opacity: 1 !important;";
      }
    }

    function getLocalCount(localKeys) {
      if (!localKeys) return 0;
      for (let i = 0; i < localKeys.length; i++) {
        const raw = localStorage.getItem(localKeys[i]);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.length;
          } catch(e) {
            const num = parseInt(raw, 10);
            if (!isNaN(num) && num > 0) return num;
          }
        }
      }
      return 0;
    }

    function parseListCount(res, localKeys) {
      let count = getLocalCount(localKeys);
      if (count > 0) return count;

      if (res && res.status === "fulfilled" && res.value && res.value.ok) {
        try {
          const data = res.value._data;
          if (data) {
            const list = data.records || data.data || data.users || data.employees || data.projectTypes || data.units || data.unitsOfMeasure || data.assetTypes || data.fuelTypes || data.roles || data.locations || data.clients || data.divisions || data.projects || data.equipment || (Array.isArray(data) ? data : []);
            if (Array.isArray(list)) count = list.length;
            else if (typeof list === "object") count = Object.keys(list).length;
          }
        } catch(e) {}
      }
      return count;
    }

    const requests = [
      fetch("/api/roles" + (customerId ? "?customerId=" + encodeURIComponent(customerId) : ""), { headers }),
      fetch("/api/users", { headers }),
      fetch("/api/locations", { headers }),
      fetch("/api/clients", { headers }),
      fetch("/api/divisions", { headers }),
      fetch("/api/project-types", { headers }),
      fetch("/api/projects", { headers }),
      fetch("/api/fuel-types", { headers }),
      fetch("/api/units-of-measure", { headers }),
      fetch("/api/asset-types", { headers }),
      fetch("/api/equipment", { headers })
    ];

    const responses = await Promise.allSettled(requests);

    for (let i = 0; i < responses.length; i++) {
      if (responses[i].status === "fulfilled" && responses[i].value.ok) {
        try {
          responses[i].value._data = await responses[i].value.json();
        } catch(e) {}
      }
    }

    let c1 = parseListCount(responses[0], ["driven_roles", "driven_role_count"]);
    if (c1 === 0 && (isAdmin || allKP.length > 0)) c1 = 5;
    if (c1 > 0) setCardKpi(1, c1 + " Roles Configured");

    let c2 = getLocalCount(["driven_employee_count", "driven_employees", "driven_employees_count"]);
    if (c2 === 0 && responses[1].status === "fulfilled" && responses[1].value && responses[1].value.ok) {
      try {
        const uData = responses[1].value._data;
        const uList = uData.records || uData.users || uData.employees || uData.data || (Array.isArray(uData) ? uData : []);
        if (Array.isArray(uList)) {
          const activeEmps = uList.filter(u => {
            const uOrg = u.org_id || u.orgId;
            const isActive = u.is_active !== undefined ? (u.is_active == 1 || u.is_active === true) : true;
            return isActive && (!uOrg || uOrg === orgId);
          });
          c2 = activeEmps.length;
        }
      } catch(e) {}
    }
    if (c2 > 0) setCardKpi(2, c2 + " Employees Active");

    let c3 = parseListCount(responses[2], ["driven_locations", "driven_location_count"]);
    if (c3 > 0) setCardKpi(3, c3 + " Locations Registered");

    let c4 = parseListCount(responses[3], ["driven_clients", "driven_client_count"]);
    if (c4 > 0) setCardKpi(4, c4 + " Clients Registered");

    let c5 = parseListCount(responses[4], ["driven_divisions", "driven_division_count"]);
    if (c5 > 0) setCardKpi(5, c5 + " Divisions Configured");

    let c6 = parseListCount(responses[5], ["driven_project_types", "driven_project_type_count"]);
    if (c6 > 0) setCardKpi(6, c6 + " Project Types Configured");

    let c7 = parseListCount(responses[6], ["driven_projects", "driven_project_count"]);
    if (c7 > 0) setCardKpi(7, c7 + " Active Projects");

    let c8 = parseListCount(responses[7], ["driven_fuel_types", "driven_fuel_count", "driven_fuel_type_count"]);
    if (c8 > 0) setCardKpi(8, c8 + " Fuel Types Selected");

    let c9 = parseListCount(responses[8], ["driven_units_of_measure", "driven_units_count", "driven_uom_count", "driven_unit_count"]);
    if (c9 > 0) setCardKpi(9, c9 + " Units Configured");

    let c10 = parseListCount(responses[9], ["driven_asset_types", "driven_asset_type_count"]);
    if (c10 > 0) setCardKpi(10, c10 + " Categories Configured");

    let c11 = parseListCount(responses[10], ["driven_equipment", "driven_equipment_count"]);
    if (c11 > 0) setCardKpi(11, c11 + " Assets Registered");
  }

  async function loadSettings() {
    try {
      const res = await fetch("/auth/get-settings", { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success && data.settings) {
        if (data.settings.step_visibility) { stepVisibility = data.settings.step_visibility; }
        if (data.settings.onboarding_complete) {
          onboardingComplete = true;
          if (!isAdmin) {
            const completeNotice = document.getElementById("completeNotice");
            const tabOverview = document.getElementById("tab-overview");
            if (completeNotice) completeNotice.style.display = "block";
            if (tabOverview) tabOverview.style.display = "none";
            setTimeout(() => { window.location.href = "/app/dashboard/owner-dashboard.html"; }, 3000);
          }
        }
        const bt = data.settings.business_type;
        const naics = data.settings.naics_code;
        if (bt || naics) {
          const elBt = document.getElementById("obCompanyType");
          const elNaics = document.getElementById("obCompanyNaics");
          const infoBar = document.getElementById("companyInfoBar");
          if (elBt) elBt.textContent = bt || "Not set";
          if (elNaics) elNaics.textContent = naics || "Not set";
          if (infoBar) infoBar.style.display = "block";
        }
      }
    } catch (e) { console.error("Settings load error:", e.message); }
    updateAllSteps();
  }

  async function loadKeyPersonnel() {
    const roleLower = (currentUser && currentUser.role) ? currentUser.role.toLowerCase() : "";
    if (currentUser && (roleLower === "admin" || roleLower === "administrator" || roleLower.indexOf("founder") !== -1)) {
      isAdmin = true;
      const adminTab0 = document.querySelector('.ob-tab-bar [data-tab="admin"]');
      if (adminTab0) adminTab0.style.display = "inline-block";
    }
    const customerId = localStorage.getItem("driven_customer_id");
    if (!customerId) { updateAllSteps(); return; }
    try {
      const response = await fetch("/api/onboarding/key-personnel/list?customerId=" + encodeURIComponent(customerId), { headers: getAuthHeaders() });
      const data = await response.json();
      if (data.success && data.keyPersonnel) {
        allKP = data.keyPersonnel;
        const myEmail = (currentUser && currentUser.email) ? currentUser.email.toLowerCase() : "";
        const myRecord = data.keyPersonnel.find(kp => kp.email && kp.email.toLowerCase() === myEmail);
        if (myRecord) {
          if (!isAdmin) {
            isAdmin = false;
            assignedTasks = myRecord.roles.map(r => r.role || r.task_name);
            const adminTabHide = document.querySelector('.ob-tab-bar [data-tab="admin"]');
            if (adminTabHide) adminTabHide.style.display = "none";
          } else {
            assignedTasks = myRecord.roles.map(r => r.role || r.task_name);
          }
        }
      }
    } catch (e) { console.error("Key personnel load error:", e.message); }
    updateAllSteps();
  }

  /* ===== ARIA MODAL BINDINGS ===== */

  function setupHelpModals() {
    const setupModal = (modalId, triggerBtnId, closeClass) => {
      const modal = document.getElementById(modalId);
      const trigger = document.getElementById(triggerBtnId);
      if (!modal) return;

      const openModal = () => {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus();
      };

      const closeModal = () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        if (trigger) trigger.focus();
      };

      if (trigger) trigger.addEventListener('click', openModal);

      modal.querySelectorAll(`.${closeClass}`).forEach(btn => {
        btn.addEventListener('click', closeModal);
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'Tab') {
          const focusables = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            last.focus();
            e.preventDefault();
          } else if (!e.shiftKey && document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      });
    };

    setupModal('purposeModal', 'btnPurposeModal', 'purpose-close');
    setupModal('instructionsModal', 'btnInstructionsModal', 'instructions-close');
  }

  /* ===== STATIC EVENT BINDINGS ===== */

  function bindStaticEvents() {
    // Navigation Tabs
    document.querySelectorAll('.ob-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    const adminTab = document.querySelector('.ob-tab-admin');
    if (adminTab) {
      adminTab.addEventListener('click', () => { window.location.href = '/app/dashboard/admin.html'; });
    }

    const logoutBtn = document.querySelector('.ob-tab-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', dashLogout);
    }

    // Theme Switch
    const themeCheckbox = document.getElementById('theme-checkbox');
    if (themeCheckbox) {
      themeCheckbox.addEventListener('change', toggleTheme);
    }

    // Change Password
    const changePwdBtn = document.getElementById('btnChangePassword');
    if (changePwdBtn) {
      changePwdBtn.addEventListener('click', () => { window.location.href = '/app/auth/change-password.html'; });
    }

    // Popup overlay close
    const popupOverlay = document.getElementById('popupOverlay');
    if (popupOverlay) {
      popupOverlay.addEventListener('click', closeAllPopups);
    }

    // Step Complete Buttons
    for (let i = 1; i <= 11; i++) {
      const completeBtn = document.getElementById("btn-complete-step" + i);
      if (completeBtn) {
        completeBtn.addEventListener('click', () => markTaskComplete(i));
      }
    }

    // Info Popup Buttons
    const popupMap = {
      'btn-info-rp': 'popup-rp',
      'btn-info-emp': 'popup-emp',
      'btn-info-loc': 'popup-loc',
      'btn-info-client': 'popup-client',
      'btn-info-div': 'popup-div',
      'btn-info-pt': 'popup-pt',
      'btn-info-proj': 'popup-proj',
      'btn-info-ft': 'popup-ft',
      'btn-info-um': 'popup-um',
      'btn-info-at': 'popup-at',
      'btn-info-assets': 'popup-assets'
    };

    Object.keys(popupMap).forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => togglePopup(popupMap[btnId]));
      }
    });

    // Close buttons inside popups
    document.querySelectorAll('.ob-info-popup-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        const popup = e.target.closest('.ob-info-popup');
        if (popup) togglePopup(popup.id);
      });
    });

    window.addEventListener("resize", makeTabsSticky);
    window.addEventListener("scroll", makeTabsSticky);
  }

  /* ===== SESSION PROCESSING ===== */

  async function processSessionUser(user, orgIdDetail) {
    if (isProcessingSession) return;
    isProcessingSession = true;

    try {
      if (!user) {
        window.location.href = "/public/login.html";
        return;
      }
      currentUser = user;
      activeOrgId = user.org_id || orgIdDetail || localStorage.getItem("driven_org_id") || "";

      localStorage.setItem("driven_user", JSON.stringify(user));
      if (user.id) localStorage.setItem("driven_user_id", String(user.id));
      if (activeOrgId) localStorage.setItem("driven_org_id", activeOrgId);
      if (user.customer_id) localStorage.setItem("driven_customer_id", user.customer_id);

      const firstName = user.first_name || "";
      const greeting = document.getElementById("greetingText");
      if (greeting && firstName) { greeting.innerHTML = "Welcome, <strong>" + firstName + "</strong>"; }

      const fullName = (user.first_name || "") + (user.last_name ? " " + user.last_name : "");
      const accName = document.getElementById("account-name");
      const accEmail = document.getElementById("account-email");
      const accRole = document.getElementById("account-role");
      if (accName) accName.textContent = fullName || user.email || "";
      if (accEmail) accEmail.textContent = user.email || "";
      if (accRole) accRole.textContent = user.role || "User";

      insertHeaderTitle();
      makeTabsSticky();
      updateThemeSwitch();

      const roleLower = (user.role) ? user.role.toLowerCase() : "";
      if (roleLower === "admin" || roleLower === "administrator" || roleLower.indexOf("founder") !== -1) {
        isAdmin = true;
        const adminTabInit = document.querySelector('.ob-tab-bar [data-tab="admin"]');
        if (adminTabInit) adminTabInit.style.display = "inline-block";
        const kpBanner = document.getElementById("kpMarkCompleteBanner");
        if (kpBanner) kpBanner.style.display = "none";
      }
      await loadSettings();
      loadTaskCompletions();
      await loadKeyPersonnel();
      loadOnboardingKPIs();
    } finally {
      const loadingEl = document.getElementById("loading");
      const dashEl = document.getElementById("dashboard");
      if (loadingEl) loadingEl.style.display = "none";
      if (dashEl) dashEl.style.display = "block";
    }
  }

  async function fetchUserSession() {
    try {
      const res = await fetch("/auth/get-user", { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.user || data.success)) {
          return data.user || data;
        }
      }
    } catch(e) {
      console.error("Session lookup error:", e);
    }
    return null;
  }

  async function init() {
    bindStaticEvents();
    setupHelpModals();

    let user = window.dashUser;

    if (!user) {
      const savedUser = localStorage.getItem("driven_user");
      if (savedUser && savedUser !== "undefined" && savedUser !== "null") {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.email) {
            user = parsed;
          }
        } catch(e) {}
      }
    }

    if (!user) {
      user = await fetchUserSession();
    }

    if (user) {
      window.dashUser = user;
      await processSessionUser(user, user.org_id);
    } else {
      window.location.href = "/public/login.html";
    }
  }

  document.addEventListener("dashSessionLoaded", async function(e) {
    if (window.dashUser && !isProcessingSession) {
      await processSessionUser(window.dashUser, e.detail ? e.detail.org_id : "");
    }
  });

  // Self Start Initialization
  init();

})();
