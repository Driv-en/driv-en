/**
 * DRIV-EN Platform: Admin Dashboard Controller
 * File: /app/dashboard/admin.js
 */

var orgSettings = {};
var stepVisibility = {};
var keyPersonnel = [];
var pendingKP = [];
var onboardingComplete = false;
var settingsDirty = false;
var togglesDirty = false;
var visibilityDirty = false;
var activeOrgId = null;
var currentUserObj = null;
var taskCompletions = {};
var syncChannel = window.BroadcastChannel ? new BroadcastChannel("driven_onboarding_sync") : null;

var STEP_DEFS = [
  { key:"roles-permissions", label:"Roles & Permissions", desc:"Define roles and access levels", locked:true },
  { key:"employees", label:"Employees", desc:"Add all employees", locked:true },
  { key:"locations", label:"Locations", desc:"Plants, mines, facilities, warehouses, job sites", locked:false },
  { key:"clients", label:"Clients", desc:"Add clients and customer organizations", locked:false },
  { key:"divisions", label:"Divisions", desc:"Internal divisions or business units", locked:false },
  { key:"project-types", label:"Project Types", desc:"Types of work your organization performs", locked:false },
  { key:"projects", label:"Projects", desc:"Active, completed, or upcoming projects", locked:false },
  { key:"fuel-types", label:"Fuels, Fluids & Energy", desc:"Types of fuel and fluids your organization uses", locked:true },
  { key:"units-of-measure", label:"Units of Measure", desc:"Volume, weight, distance, and metric units", locked:true },
  { key:"asset-types", label:"Asset Types", desc:"Primary equipment and machine categories", locked:true },
  { key:"assets", label:"Assets", desc:"Assets and equipment to maintain", locked:true }
];

var FORMS = [
  { key:'dvir_form', label:'Driver Vehicle Inspection (DVIR)', desc:'Complete pre-trip or post-trip statutory road safety inspection', link:'/app/forms/dvir.html' },
  { key:'fuel_log', label:'Log Fuel Purchase', desc:'Record a fuel purchase with receipt AI extraction', link:'/app/forms/fuel-purchase.html' },
  { key:'fuel_transfer', label:'Log Fuel Transfer', desc:'Transfer fuel between tanks or issue to equipment', link:'/app/forms/fuel-transfer.html' },
  { key:'transfer_create', label:'Create Transfer', desc:'Start an equipment transfer ticket', link:'/app/forms/transfer-create.html' },
  { key:'wo_create', label:'Create Work Order', desc:'Submit a maintenance request', link:'/app/forms/work-order-create.html' },
  { key:'inspection_add', label:'Add Inspection', desc:'Record an equipment inspection', link:'/app/forms/inspection.html' },
  { key:'pm_add', label:'Add PM', desc:'Create a preventive maintenance task', link:'/app/forms/pm.html' }
];

function esc(s) { 
  if(!s) return ''; 
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); 
}

function showPageError() { 
  var b = document.getElementById('pageErrorBanner'); 
  if(b) b.classList.add('show'); 
}

function dismissPageError() { 
  var b = document.getElementById('pageErrorBanner'); 
  if(b) b.classList.remove('show'); 
}

/* Explicit Session Preservation with URL Context appending */
function preserveAndNavigate(event, targetUrl) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (targetUrl && !targetUrl.endsWith('.html') && !targetUrl.includes('?')) {
    targetUrl += '.html';
  }

  var userObj = currentUserObj || window.dashUser || window.drivenUser;
  if (!userObj) {
    try {
      userObj = JSON.parse(localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user"));
    } catch(e) {}
  }

  userObj = userObj || {};

  if (!userObj.id && userObj.user_id) {
    userObj.id = userObj.user_id;
  }

  var targetOrg = activeOrgId || userObj.org_id || localStorage.getItem("driven_org_id") || "org_dsi";
  var roleVal = userObj.role_id || localStorage.getItem("driven_role") || userObj.role || "RO-admin";
  var userStr = JSON.stringify(userObj);

  localStorage.setItem("driven_org_id", targetOrg);
  localStorage.setItem("driven_user", userStr);
  localStorage.setItem("driven_role", roleVal);
  if (userObj.id) {
    localStorage.setItem("driven_user_id", userObj.id);
  }

  sessionStorage.setItem("driven_org_id", targetOrg);
  sessionStorage.setItem("driven_user", userStr);
  sessionStorage.setItem("driven_role", roleVal);
  if (userObj.id) {
    sessionStorage.setItem("driven_user_id", userObj.id);
  }

  var querySeparator = targetUrl.includes('?') ? '&' : '?';
  var finalUrl = targetUrl + querySeparator + "org_id=" + encodeURIComponent(targetOrg) + "&role_id=" + encodeURIComponent(roleVal);

  window.location.href = finalUrl;
}

function validateOrgContext() {
  if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "null") {
    activeOrgId = localStorage.getItem("driven_org_id") || sessionStorage.getItem("driven_org_id") || "org_dsi";
  }
  return true;
}

function reportError(source, err) {
  var msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : 'Unknown error');
  var stack = (err && err.stack) ? err.stack : 'No stack trace';
  try {
    fetch('/api/log-error', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-org-id': activeOrgId || ""
      },
      body:JSON.stringify({source:'Admin Dashboard ('+source+')', message:msg, stack:stack, url:window.location.href, userAgent:navigator.userAgent })
    }).catch(function(){});
  } catch(e) {}
  console.error('['+source+']', msg, stack);
}

window.addEventListener('error', function(e) { 
  reportError('window.onerror', e.error || e.message); 
  showPageError(); 
});

/* Dynamic Mobile & Desktop Sticky Offset Calculator */
function adjustStickyOffsets() {
  var header = document.getElementById("dashHeader");
  var stickyContainer = document.getElementById("adminNavStickyContainer");
  var subtabContainer = document.getElementById("onboardingSubtabBar");
  if (header) {
    header.style.backgroundColor = "#ffffff";
  }
  if (header && stickyContainer) {
    var headerHeight = header.getBoundingClientRect().height || header.offsetHeight || 50;
    stickyContainer.style.top = headerHeight + "px";
    if (subtabContainer) {
      var tabHeight = stickyContainer.getBoundingClientRect().height || stickyContainer.offsetHeight || 40;
      subtabContainer.style.top = (headerHeight + tabHeight) + "px";
    }
  }
}

/* ===== Safe Fast API Request Helper ===== */
async function safeFetch(url, options) {
  options = options || {};

  var storedUser = currentUserObj || window.dashUser || window.drivenUser || {};
  var headers = new Headers(options.headers || {});
  headers.set(
    "x-user-id",
    storedUser.id ||
      localStorage.getItem("driven_user_id") ||
      sessionStorage.getItem("driven_user_id") ||
      ""
  );
  headers.set(
    "x-org-id",
    activeOrgId ||
      storedUser.org_id ||
      localStorage.getItem("driven_org_id") ||
      sessionStorage.getItem("driven_org_id") ||
      ""
  );
  headers.set("x-user-role", "RO-admin");

  var controller = new AbortController();
  var timeoutId = setTimeout(function() {
    controller.abort();
  }, 4000);

  var externalSignal = options.signal;
  var abortFromCaller = function() {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromCaller, { once: true });
    }
  }

  try {
    return await fetch(
      url,
      Object.assign({}, options, {
        headers: headers,
        signal: controller.signal
      })
    );
  } catch (err) {
    reportError("safeFetch", err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortFromCaller);
    }
  }
}

/* ===== Global Key Personnel Helper Functions ===== */
function toggleSelectAllKpTasks(checked) {
  document.querySelectorAll('.kp-task-cb').forEach(function(cb) { cb.checked = checked; });
  updateKpTaskCount();
}

function updateKpTaskCount() {
  var cbs = document.querySelectorAll('.kp-task-cb:checked');
  var totalCbs = document.querySelectorAll('.kp-task-cb');
  var selectAll = document.getElementById('kpTaskSelectAll');
  if (selectAll) selectAll.checked = (cbs.length === totalCbs.length && totalCbs.length > 0);
  var counter = document.getElementById('kpTaskCount');
  if (counter) counter.textContent = cbs.length + ' task' + (cbs.length === 1 ? '' : 's') + ' selected';
}

function addKeyPersonnel() {
  if (!validateOrgContext()) return;
  var nameEl = document.getElementById("kpName");
  var emailEl = document.getElementById("kpEmail");
  if (!nameEl || !emailEl) return;

  var name = nameEl.value.trim();
  var email = emailEl.value.trim();
  var selectedCbs = document.querySelectorAll('.kp-task-cb:checked');
  var selectedTasks = Array.from(selectedCbs).map(function(cb) { return cb.value; });

  if(!name || !email) {
    alert("Please enter both Full Name and Email Address.");
    return;
  }
  if(selectedTasks.length === 0) {
    alert("Please select at least one task for this person.");
    return;
  }

  var parts = name.split(' ');
  var fn = parts[0] || '';
  var ln = parts.slice(1).join(' ') || '';

  pendingKP.push({
    firstName: fn,
    lastName: ln,
    name: name,
    email: email,
    tasks: selectedTasks
  });

  nameEl.value = "";
  emailEl.value = "";
  document.querySelectorAll('.kp-task-cb').forEach(function(cb) { cb.checked = false; });
  var selectAll = document.getElementById("kpTaskSelectAll");
  if (selectAll) selectAll.checked = false;
  updateKpTaskCount();
  renderKeyPersonnel();
}

function removeKpTask(personIdx, taskIdx) {
  var target = personIdx < keyPersonnel.length ? keyPersonnel[personIdx] : pendingKP[personIdx - keyPersonnel.length];
  var tasks = target.tasks || (target.roles ? target.roles.map(function(r){return r.role;}) : [target.task]);
  tasks.splice(taskIdx, 1);
  target.tasks = tasks;
  delete target.roles;
  delete target.task;
  renderKeyPersonnel();
}

async function removeKpPerson(personIdx) {
  if (!validateOrgContext()) return;
  if(personIdx < keyPersonnel.length) {
    var kp = keyPersonnel[personIdx];
    if(kp.employeeId || kp.id) {
      try {
        await safeFetch("/api/onboarding/key-personnel/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: kp.employeeId || kp.id, revokeAll: true })
        });
      } catch(e) { reportError("removeKpPerson", e); }
    }
    keyPersonnel.splice(personIdx, 1);
  } else {
    pendingKP.splice(personIdx - keyPersonnel.length, 1);
  }
  renderKeyPersonnel();
}

async function saveKeyPersonnelToDB() {
  if (!validateOrgContext()) return;
  var allKPToSave = keyPersonnel.concat(pendingKP);
  if (allKPToSave.length === 0) {
    alert("No key personnel to save.");
    return;
  }

  var btn = document.getElementById("kpCompleteBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Creating Accounts & Sending Emails…";
  }

  try {
    var resComplete = await safeFetch("/api/onboarding/key-personnel/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyPersonnel: allKPToSave })
    });

    if (!resComplete) return;
    var dComplete = await resComplete.json();

    if (resComplete.ok && dComplete.success) {
      alert("Key personnel accounts created and invitation emails sent successfully!");
      keyPersonnel = allKPToSave;
      pendingKP = [];
      await loadKeyPersonnel();
      notifySync();
    } else {
      var errorDetails = (dComplete.results || [])
        .filter(function(r) { return r.error; })
        .map(function(r) { return (r.email || "Item") + ": " + r.error; })
        .join("\n");

      var errorMsg = dComplete.error || errorDetails || "An unknown error occurred during save.";
      alert("Warning/Error during save:\n\n" + errorMsg);
    }
  } catch(e) {
    reportError("saveKeyPersonnelToDB", e);
    alert("Error sending invitations: " + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Send Invitations & Create Accounts";
    }
  }
}

async function finalizeCompanyOnboarding() {
  if (!validateOrgContext()) return;
  if (!confirm("Are you ready to finalize onboarding? This will activate all regular employees and send them welcome emails.")) return;
  var finalizeBtn = document.getElementById('finalizeOnboardingBtn');
  var originalText = finalizeBtn ? finalizeBtn.innerText : "";
  if (finalizeBtn) {
    finalizeBtn.innerText = "Finalizing & Emailing...";
    finalizeBtn.disabled = true;
  }

  try {
    var res = await safeFetch('/api/onboarding/finalize', { method: 'POST' });
    if (res) {
      var data = await res.json();
      if (data.success) {
        var completePanel = document.getElementById('onboardingCompletePanel');
        if (completePanel) completePanel.classList.add('show');
        if (finalizeBtn) finalizeBtn.style.display = 'none';
        alert(`Onboarding Complete! Welcome emails sent to ${data.totalEmployees} employees.`);
      } else {
        alert("Failed to finalize onboarding: " + data.error);
      }
    }
  } catch (err) {
    console.error("Error finalizing:", err);
    alert("A network error occurred while finalizing.");
  } finally {
    if (finalizeBtn) {
      finalizeBtn.innerText = originalText;
      finalizeBtn.disabled = false;
    }
  }
}

async function loadDashboardStats() {
  var fetchSafe = function(urls) {
    var urlList = Array.isArray(urls) ? urls : [urls];
    var tryFetch = async function(idx) {
      if (idx >= urlList.length) return {};
      try {
        var r = await safeFetch(urlList[idx]);
        if (r && r.ok) return await r.json();
      } catch(e) {}
      return tryFetch(idx + 1);
    };
    return tryFetch(0);
  };

  try {
    var results = await Promise.all([
      fetchSafe(['/api/onboarding/employees/list', '/api/users']),
      fetchSafe(['/api/Project', '/api/projects']),
      fetchSafe(['/api/Equipment', '/api/equipment']),
      fetchSafe(['/api/Clients?active_only=true', '/api/Clients', '/api/clients'])
    ]);

    var empData = results[0] || {};
    var empList = empData.employees || empData.personnel || empData.users || empData.data || empData.records || (Array.isArray(empData) ? empData : []);
    var empCount = empList.filter(function(e) { 
      var st = e.status !== undefined ? e.status : (e.is_active !== undefined ? e.is_active : e.employment_status);
      if (typeof st === "string") st = st.toLowerCase();
      return st === 1 || st === '1' || st === 'active' || st === true; 
    }).length;

    var elEmp = document.getElementById('stat-employees');
    if (elEmp) elEmp.textContent = empCount;
    localStorage.setItem('driven_employee_count', empCount);

    var projData = results[1] || {};
    var projList = projData.projects || projData.data || projData.records || (Array.isArray(projData) ? projData : []);
    var elProj = document.getElementById('stat-projects');
    if (elProj) elProj.textContent = projList.length;
    localStorage.setItem('driven_project_count', projList.length);

    var assetData = results[2] || {};
    var assetList = assetData.equipment || assetData.assets || assetData.data || assetData.records || (Array.isArray(assetData) ? assetData : []);
    var elEq = document.getElementById('stat-equipment');
    if (elEq) elEq.textContent = assetList.length;
    localStorage.setItem('driven_equipment_count', assetList.length);

    var clientData = results[3] || {};
    var clientList = clientData.clients || clientData.records || clientData.data || clientData.results || (Array.isArray(clientData) ? clientData : []);
    var activeClients = clientList.filter(function(c) {
      var st = c.status !== undefined ? c.status : (c.is_active !== undefined ? c.is_active : c.active);
      if (typeof st === "string") st = st.toLowerCase();
      return st === undefined || st === null || st === 1 || st === '1' || st === 'active' || st === true;
    }).length;

    var elCli = document.getElementById('stat-clients');
    if (elCli) elCli.textContent = activeClients;
    localStorage.setItem('driven_client_count', activeClients);

  } catch (e) {
    console.error('loadDashboardStats error:', e);
    var elE = document.getElementById('stat-employees'); if (elE) elE.textContent = localStorage.getItem('driven_employee_count') || '0';
    var elP = document.getElementById('stat-projects'); if (elP) elP.textContent = localStorage.getItem('driven_project_count') || '0';
    var elEq = document.getElementById('stat-equipment'); if (elEq) elEq.textContent = localStorage.getItem('driven_equipment_count') || '0';
    var elC = document.getElementById('stat-clients'); if (elC) elC.textContent = localStorage.getItem('driven_client_count') || '0';
  }
}

function renderFormsTab() {
  var c = document.getElementById('adminFormsTabLinks');
  if (!c) return;
  c.innerHTML = FORMS.map(function(f) {
    return '<a href="' + f.link + '" class="emp-form-card" data-link="' + f.link + '">' +
      '<div style="font-weight:600;font-size:15px;margin-bottom:6px;">' + esc(f.label) + '</div>' +
      '<div style="font-size:13px;color:var(--text-muted);line-height:1.4;">' + esc(f.desc) + '</div>' +
      '</a>';
  }).join('');

  c.querySelectorAll('.emp-form-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      preserveAndNavigate(e, this.getAttribute('data-link'));
    });
  });
}

function renderOnboardingUomDisplays() {
  var distEl = document.getElementById("uom-distance-display");
  var volEl = document.getElementById("uom-volume-display");
  var pressEl = document.getElementById("uom-pressure-display");

  var distVal = orgSettings.uom_distance || localStorage.getItem("driven_uom_distance") || "Miles (mi)";
  var volVal = orgSettings.uom_volume || localStorage.getItem("driven_uom_volume") || "US Gallons (gal)";
  var pressVal = orgSettings.uom_pressure || localStorage.getItem("driven_uom_pressure") || "PSI";

  if (distEl) distEl.textContent = distVal;
  if (volEl) volEl.textContent = volVal;
  if (pressEl) pressEl.textContent = pressVal;
}

function switchTab(tabName) {
  var activeObTab = document.getElementById('tab-onboarding');
  var activeSetTab = document.getElementById('tab-settings');

  if(visibilityDirty && activeObTab && activeObTab.classList.contains('active') && tabName!=='onboarding') {
    if(!confirm("You have unsaved Task Visibility changes.\n\nClick Cancel to go back and save them, or OK to discard.")) return;
    clearVisibilityDirty();
  }
  if ((settingsDirty || togglesDirty) &&
      activeSetTab &&
      activeSetTab.classList.contains("active") &&
      tabName !== "settings") {
    if (!confirm("You have unsaved changes in Settings.\n\nClick Cancel to go back and save them, or OK to discard.")) return;
    clearSettingsDirty();
  }

  document.querySelectorAll('.admin-tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.admin-tab-content').forEach(function(c){ c.classList.remove('active'); });

  var targetTabBtn = document.querySelector('.admin-tab[data-tab="'+tabName+'"]');
  var targetTabContent = document.getElementById('tab-'+tabName);

  if(targetTabBtn) targetTabBtn.classList.add('active');
  if(targetTabContent) targetTabContent.classList.add('active');

  var obBar = document.getElementById('onboardingSubtabBar');
  if(obBar) obBar.classList.toggle('visible', tabName==='onboarding');
  if(tabName==='forms') renderFormsTab();
  if(tabName==='settings') renderOnboardingUomDisplays();
  adjustStickyOffsets();
}

function switchOnboardingSubtab(subtabName) {
  var visTab = document.getElementById('onboarding-subtab-visibility');
  if(visibilityDirty && visTab && visTab.classList.contains('active') && subtabName!=='visibility') {
    if(!confirm("You have unsaved Task Visibility changes.\n\nClick Cancel to go back and save them, or OK to discard.")) return;
    clearVisibilityDirty();
  }

  document.querySelectorAll('#onboardingSubtabBar .admin-subtab').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('.admin-subtab-content[id^="onboarding-subtab-"]').forEach(function(c){c.classList.remove('active');});

  var targetSubtabBtn = document.querySelector('#onboardingSubtabBar [data-subtab="'+subtabName+'"]');
  var targetSubtabContent = document.getElementById('onboarding-subtab-'+subtabName);

  if(targetSubtabBtn) targetSubtabBtn.classList.add('active');
  if(targetSubtabContent) targetSubtabContent.classList.add('active');
}

function toggleTheme() {
  var current = document.documentElement.getAttribute("data-theme") || "light";
  var newTheme = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("driven-theme", newTheme);
  updateThemeSwitch();
}

function updateThemeSwitch() {
  var current = document.documentElement.getAttribute("data-theme") || "light";
  var cb = document.getElementById("theme-checkbox");
  var ll = document.getElementById("theme-label-light");
  var ld = document.getElementById("theme-label-dark");
  if(cb) cb.checked = (current === "dark");
  if(ll) ll.classList.toggle("active", current === "light");
  if(ld) ld.classList.toggle("active", current === "dark");
}

function renderLogoPreview(container, logo, removeButton) {
  container.replaceChildren();

  var isDataImage =
    typeof logo === "string" &&
    /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(logo);

  var isSameOriginUrl = false;
  if (typeof logo === "string" && logo && !isDataImage) {
    try {
      isSameOriginUrl = new URL(logo, window.location.origin).origin === window.location.origin;
    } catch (e) {
      isSameOriginUrl = false;
    }
  }

  if (isDataImage || isSameOriginUrl) {
    var image = document.createElement("img");
    image.src = logo;
    image.alt = "Logo";
    image.style.maxHeight = "60px";
    image.style.maxWidth = "140px";
    image.style.objectFit = "contain";
    container.appendChild(image);
    container.style.border = "none";
    if (removeButton) removeButton.style.display = "inline-block";
    return;
  }

  container.textContent = "No logo";
  container.style.border = "2px dashed var(--border,#cbd5e1)";
  if (removeButton) removeButton.style.display = "none";
}

async function loadLogo() {
  var preview = document.getElementById("logoPreview");
  var removeButton = document.getElementById("logoRemoveBtn");
  if (!preview) return;

  try {
    var res = await safeFetch("/auth/get-logo");
    if (!res.ok) {
      throw new Error("Logo fetch failed (HTTP " + res.status + ").");
    }

    var data = await res.json();
    if (data.success && data.logo) {
      localStorage.setItem("driven_customer_logo", data.logo);
      renderLogoPreview(preview, data.logo, removeButton);
    } else {
      renderLogoPreview(preview, "", removeButton);
    }
  } catch (err) {
    var storedLogo = localStorage.getItem("driven_customer_logo");
    renderLogoPreview(preview, storedLogo || "", removeButton);
  }
}

async function handleLogoUpload() {
  if (!validateOrgContext()) return;

  var logoInput = document.getElementById("logoFile");
  var statusEl = document.getElementById("logoStatus");
  var file = logoInput && logoInput.files && logoInput.files[0];
  if (!file) return;

  if (!/^image\/(?:png|jpeg|gif|webp)$/i.test(file.type)) {
    if (statusEl) {
      statusEl.textContent = "Choose a PNG, JPEG, GIF, or WebP image.";
      statusEl.style.color = "var(--error,#ef4444)";
    }
    return;
  }

  if (file.size > 500000) {
    if (statusEl) {
      statusEl.textContent = "File too large. Max 500KB.";
      statusEl.style.color = "var(--error,#ef4444)";
    }
    return;
  }

  var reader = new FileReader();

  reader.onerror = function() {
    if (statusEl) {
      statusEl.textContent = "Unable to read the selected logo.";
      statusEl.style.color = "var(--error,#ef4444)";
    }
  };

  reader.onload = async function(event) {
    var logoData = event.target && event.target.result;
    if (typeof logoData !== "string" ||
        !/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(logoData)) {
      if (statusEl) {
        statusEl.textContent = "The selected file is not a supported image.";
        statusEl.style.color = "var(--error,#ef4444)";
      }
      return;
    }

    try {
      var res = await safeFetch("/auth/save-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_data: logoData })
      });
      var data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Logo upload failed.");
      }

      localStorage.setItem("driven_customer_logo", logoData);
      renderLogoPreview(
        document.getElementById("logoPreview"),
        logoData,
        document.getElementById("logoRemoveBtn")
      );

      if (statusEl) {
        statusEl.textContent = "Logo uploaded.";
        statusEl.style.color = "var(--success,#16a34a)";
      }
    } catch (err) {
      reportError("handleLogoUpload", err);
      if (statusEl) {
        statusEl.textContent = "Logo upload failed.";
        statusEl.style.color = "var(--error,#ef4444)";
      }
    }
  };

  reader.readAsDataURL(file);
}

async function handleLogoRemove() {
  if (!validateOrgContext()) return;

  var statusEl = document.getElementById("logoStatus");

  try {
    var res = await safeFetch("/auth/save-logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo_data: "" })
    });
    var data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Logo removal failed.");
    }

    localStorage.removeItem("driven_customer_logo");
    renderLogoPreview(
      document.getElementById("logoPreview"),
      "",
      document.getElementById("logoRemoveBtn")
    );

    if (statusEl) statusEl.textContent = "Logo removed.";
  } catch (err) {
    reportError("handleLogoRemove", err);
    if (statusEl) {
      statusEl.textContent = "Logo removal failed.";
      statusEl.style.color = "var(--error,#ef4444)";
    }
  }
}

async function loadSettings() {
  try {
    var res = await safeFetch("/auth/get-settings");
    if (res) {
      var data = await res.json();
      if(data.success && data.settings) {
        orgSettings = data.settings;
        var bSelect = document.getElementById("businessTypeSelect");
        var nInput = document.getElementById("naicsInput");
        var cSelect = document.getElementById("currencySelect");

        var mpToggle = document.getElementById("fuelMeterPhotoToggle");
        var apToggle = document.getElementById("fuelAssetPhotoToggle");
        var lrToggle = document.getElementById("locationReqToggle");

        if(data.settings.business_type && bSelect) bSelect.value = data.settings.business_type;
        if(data.settings.naics_code && nInput) nInput.value = data.settings.naics_code;
        if(data.settings.currency && cSelect) cSelect.value = data.settings.currency;

        if(mpToggle && data.settings.fuel_meter_photo !== undefined) mpToggle.checked = Boolean(data.settings.fuel_meter_photo);
        if(apToggle && data.settings.fuel_asset_photo !== undefined) apToggle.checked = Boolean(data.settings.fuel_asset_photo);
        if(lrToggle && data.settings.location_request !== undefined) lrToggle.checked = Boolean(data.settings.location_request);

        if(data.settings.step_visibility && typeof data.settings.step_visibility==='object' && !Array.isArray(data.settings.step_visibility)) stepVisibility = data.settings.step_visibility;
        if(data.settings.task_completions) {
          taskCompletions = data.settings.task_completions;
          localStorage.setItem("driven_task_completions", JSON.stringify(taskCompletions));
        }
        if(data.settings.onboarding_complete) {
          onboardingComplete = true;
          hideOnboardingTab();
        }
      }
    }
  } catch(e) {
    reportError("loadSettings", e);
  }
  renderStepToggles();
  renderOnboardingUomDisplays();
  updateProgress();
}

function markSettingsDirty() {
  settingsDirty = true;
}

function markTogglesDirty() {
  togglesDirty = true;
}

function clearSettingsDirty() {
  settingsDirty = false;
  togglesDirty = false;
}

function markVisibilityDirty() {
  visibilityDirty = true;
  var warning = document.getElementById("visibilityWarning");
  if (warning) warning.style.display = "block";
}

function clearVisibilityDirty() {
  visibilityDirty = false;
  var warning = document.getElementById("visibilityWarning");
  if (warning) warning.style.display = "none";
}

async function saveSettings() {
  if (!validateOrgContext()) return;

  var businessType = document.getElementById("businessTypeSelect");
  var naicsInput = document.getElementById("naicsInput");
  var currencySelect = document.getElementById("currencySelect");

  try {
    var res = await safeFetch("/auth/save-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          business_type: businessType ? businessType.value : "",
          naics_code: naicsInput ? naicsInput.value.trim() : "",
          currency: currencySelect ? currencySelect.value : "USD"
        }
      })
    });
    var data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Settings save was rejected.");
    }

    orgSettings.business_type = businessType ? businessType.value : "";
    orgSettings.naics_code = naicsInput ? naicsInput.value.trim() : "";
    orgSettings.currency = currencySelect ? currencySelect.value : "USD";

    var status = document.getElementById("settingsStatus");
    if (status) status.textContent = "Saved.";

    settingsDirty = false;
    notifySync();
  } catch (err) {
    reportError("saveSettings", err);
    var status = document.getElementById("settingsStatus");
    if (status) status.textContent = "Save failed. Your changes are still unsaved.";
  }
}

function onNaicsChange() {
  markSettingsDirty();
}

function onCurrencyChange() {
  markSettingsDirty();
}

function onFuelPhotoToggleChange() {
  markTogglesDirty();
}

function onLocationReqToggleChange() {
  markTogglesDirty();
}

async function saveToggles() {
  if (!validateOrgContext()) return;

  var meterPhoto = document.getElementById("fuelMeterPhotoToggle");
  var assetPhoto = document.getElementById("fuelAssetPhotoToggle");
  var locationReq = document.getElementById("locationReqToggle");

  try {
    var res = await safeFetch("/auth/save-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          fuel_meter_photo: meterPhoto ? meterPhoto.checked : false,
          fuel_asset_photo: assetPhoto ? assetPhoto.checked : false,
          location_request: locationReq ? locationReq.checked : false
        }
      })
    });
    var data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Toggle save was rejected.");
    }

    togglesDirty = false;
    var status = document.getElementById("togglesStatus");
    if (status) status.textContent = "Toggles saved.";
  } catch (err) {
    reportError("saveToggles", err);
    var status = document.getElementById("togglesStatus");
    if (status) status.textContent = "Save failed. Your changes are still unsaved.";
  }
}

async function saveStepVisibility() {
  if (!validateOrgContext()) return;

  var status = document.getElementById("visibilityStatus");

  try {
    var res = await safeFetch("/auth/save-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { step_visibility: stepVisibility } })
    });
    var data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Visibility save was rejected.");
    }

    if (status) {
      status.textContent = "Visibility saved.";
      status.style.color = "var(--success,#16a34a)";
    }

    clearVisibilityDirty();
    renderStepToggles();
    updateProgress();
    notifySync();
  } catch (err) {
    reportError("saveStepVisibility", err);
    if (status) {
      status.textContent = "Save failed. Your changes are still unsaved.";
      status.style.color = "var(--error,#ef4444)";
    }
  }
}

var adminAppStarted = false;
async function startAdminApp(user) {
  if (adminAppStarted) return;

  // Set the guard after validation succeeds
  adminAppStarted = true;

  // Remainder of startAdminApp initialization logic
}

function attachEventHandlers() {
  var mpToggle = document.getElementById("fuelMeterPhotoToggle");
  var apToggle = document.getElementById("fuelAssetPhotoToggle");
  var lrToggle = document.getElementById("locationReqToggle");

  if (mpToggle) mpToggle.addEventListener("change", onFuelPhotoToggleChange);
  if (apToggle) apToggle.addEventListener("change", onFuelPhotoToggleChange);
  if (lrToggle) lrToggle.addEventListener("change", onLocationReqToggleChange);
}
