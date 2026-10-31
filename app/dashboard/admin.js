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
var visibilityDirty = false;
var activeOrgId = null;
var currentUserObj = null;
var taskCompletions = {};
var syncChannel = window.BroadcastChannel ? new BroadcastChannel("driven_onboarding_sync") : null;

var BUSINESS_TYPE_DEFAULTS = {
  "Construction": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":true,"project-types":true,"projects":true,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Manufacturing": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":true,"project-types":false,"projects":false,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Chemical": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":true,"project-types":false,"projects":false,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Oil & Gas": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":true,"project-types":true,"projects":true,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Transportation": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":false,"project-types":false,"projects":false,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Warehousing": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":false,"project-types":false,"projects":false,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Fabrication": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":true,"project-types":false,"projects":false,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Logistics / Supply Chain": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":false,"project-types":false,"projects":false,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Utilities & Energy": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":true,"project-types":true,"projects":true,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Mining & Aggregates": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":true,"project-types":true,"projects":true,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Agriculture": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":true,"project-types":false,"projects":false,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Environmental Services": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":false,"project-types":false,"projects":false,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "Food & Beverage Processing": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":true,"project-types":false,"projects":false,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true},
  "General Services": {"roles-permissions":true,"employees":true,"locations":true,"clients":true,"divisions":false,"project-types":false,"projects":false,"assets":true,"fuel-types":true,"units-of-measure":true,"asset-types":true}
};

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
  options.headers = options.headers || {};
  var storedUser = currentUserObj || window.dashUser || window.drivenUser || {};
  options.headers["x-user-id"] = storedUser.id || localStorage.getItem("driven_user_id") || sessionStorage.getItem("driven_user_id") || "";
  options.headers["x-org-id"] = activeOrgId || storedUser.org_id || localStorage.getItem("driven_org_id") || sessionStorage.getItem("driven_org_id") || "";
  options.headers["x-user-role"] = "RO-admin";

  var controller = new AbortController();
  var timeoutId = setTimeout(function() { controller.abort(); }, 4000);
  options.signal = controller.signal;

  try {
    var res = await fetch(url, options);
    clearTimeout(timeoutId);
    if (res.status === 401 || res.status === 403) {
      console.warn("[AdminDashboard] Session warning from:", url);
      return null;
    }
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    reportError("safeFetch", err);
    return null;
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

function switchTab(tabName) {
  var activeObTab = document.getElementById('tab-onboarding');
  var activeSetTab = document.getElementById('tab-settings');

  if(visibilityDirty && activeObTab && activeObTab.classList.contains('active') && tabName!=='onboarding') {
    if(!confirm("You have unsaved Task Visibility changes.\n\nClick Cancel to go back and save them, or OK to discard.")) return;
    clearVisibilityDirty();
  }
  if(settingsDirty && activeSetTab && activeSetTab.classList.contains('active') && tabName!=='settings') {
    if(!confirm("You have unsaved changes in Settings.\n\nClick Cancel to go back and save them, or OK to discard.")) return;
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

async function loadLogo() {
  var p = document.getElementById("logoPreview"), r = document.getElementById("logoRemoveBtn");
  if (!p) return;
  try {
    var res = await safeFetch("/auth/get-logo");
    if (!res || !res.ok) throw new Error("Logo fetch failed");
    var d = await res.json();
    if(d.success && d.logo) {
      localStorage.setItem("driven_customer_logo", d.logo);
      p.innerHTML = '<img src="' + d.logo + '" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;">';
      p.style.border = "none";
      if(r) r.style.display = "inline-block";
    } else {
      p.innerHTML = "No logo";
      p.style.border = "2px dashed var(--border,#cbd5e1)";
      if(r) r.style.display = "none";
    }
  } catch(e) {
    var ll = localStorage.getItem("driven_customer_logo");
    if(ll) {
      p.innerHTML = '<img src="' + ll + '" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;">';
      p.style.border = "none";
      if(r) r.style.display = "inline-block";
    } else {
      p.innerHTML = "No logo";
      p.style.border = "2px dashed var(--border,#cbd5e1)";
      if(r) r.style.display = "none";
    }
  }
}

async function handleLogoUpload() {
  if (!validateOrgContext()) return;
  var logoInput = document.getElementById("logoFile");
  if (!logoInput || !logoInput.files || !logoInput.files[0]) return;
  var f = logoInput.files[0];
  var statusEl = document.getElementById("logoStatus");

  if(f.size > 500000) {
    if(statusEl) {
      statusEl.textContent = "File too large. Max 500KB.";
      statusEl.style.color = "var(--error,#ef4444)";
    }
    return;
  }

  var rd = new FileReader();
  rd.onload = async function(e) {
    var du = e.target.result;
    localStorage.setItem("driven_customer_logo", du);
    try {
      var sr = await safeFetch("/auth/save-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_data: du })
      });
      if (sr) {
        var sd = await sr.json();
        if(sd.success && statusEl) {
          statusEl.textContent = "Logo uploaded.";
          statusEl.style.color = "var(--success,#16a34a)";
        }
      }
    } catch(ex) { reportError("handleLogoUpload", ex); }
    await loadLogo();
  };
  rd.readAsDataURL(f);
}

async function handleLogoRemove() {
  if (!validateOrgContext()) return;
  try {
    await safeFetch("/auth/save-logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo_data: "" })
    });
    localStorage.removeItem("driven_customer_logo");
    var statusEl = document.getElementById("logoStatus");
    if(statusEl) statusEl.textContent = "Logo removed.";
  } catch(e) { reportError("handleLogoRemove", e); }
  await loadLogo();
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

        if(data.settings.business_type && bSelect) bSelect.value = data.settings.business_type;
        if(data.settings.naics_code && nInput) nInput.value = data.settings.naics_code;
        if(data.settings.currency && cSelect) cSelect.value = data.settings.currency;
        if(data.settings.step_visibility && typeof data.settings.step_visibility==='object' && !Array.isArray(data.settings.step_visibility)) stepVisibility = data.settings.step_visibility;
        if(data.settings.task_completions) {
          taskCompletions = data.settings.task_completions;
          localStorage.setItem("driven_task_completions", JSON.stringify(taskCompletions));
        }
        if(data.settings.onboarding_complete) {
          onboardingComplete = true;
          hideOnboardingTab();
        }
      } else {
        applyBusinessTypeDefaults();
      }
    } else {
      applyBusinessTypeDefaults();
    }
  } catch(e) {
    reportError("loadSettings", e);
    applyBusinessTypeDefaults();
  }
  renderStepToggles();
  updateProgress();
}

function markSettingsDirty(){ settingsDirty = true; }
function clearSettingsDirty(){ settingsDirty = false; }

function markVisibilityDirty(){
  visibilityDirty = true;
  var w = document.getElementById('visibilityWarning');
  if(w) w.style.display = 'block';
}

function clearVisibilityDirty(){
  visibilityDirty = false;
  var w = document.getElementById('visibilityWarning');
  if(w) w.style.display = 'none';
}

async function saveSettings() {
  if (!validateOrgContext()) return;
  var bt = document.getElementById("businessTypeSelect") ? document.getElementById("businessTypeSelect").value : "";
  var naics = document.getElementById("naicsInput") ? document.getElementById("naicsInput").value.trim() : "";
  var cur = document.getElementById("currencySelect") ? document.getElementById("currencySelect").value : "USD";
  try {
    var res = await safeFetch("/auth/save-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { business_type: bt, naics_code: naics, currency: cur } })
    });
    if (res) {
      var d = await res.json();
      if(d.success) {
        orgSettings.business_type = bt;
        orgSettings.naics_code = naics;
        orgSettings.currency = cur;
        var sStatus = document.getElementById("settingsStatus");
        if(sStatus) sStatus.textContent = "Saved.";
        notifySync();
      }
    }
  } catch(e) { reportError("saveSettings", e); }
  clearSettingsDirty();
}

function onNaicsChange(){ markSettingsDirty(); }
function onCurrencyChange(){ markSettingsDirty(); }
function onFuelPhotoToggleChange() { markSettingsDirty(); }
function onLocationReqToggleChange() { markSettingsDirty(); }

async function saveToggles() {
  if (!validateOrgContext()) return;
  var mp = document.getElementById("fuelMeterPhotoToggle") ? document.getElementById("fuelMeterPhotoToggle").checked : false;
  var ap = document.getElementById("fuelAssetPhotoToggle") ? document.getElementById("fuelAssetPhotoToggle").checked : false;
  var lr = document.getElementById("locationReqToggle") ? document.getElementById("locationReqToggle").checked : false;
  try {
    await safeFetch("/auth/save-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { fuel_meter_photo: mp, fuel_asset_photo: ap, location_request: lr } })
    });
    var tStatus = document.getElementById("togglesStatus");
    if(tStatus) tStatus.textContent = "Toggles saved.";
  } catch(e) { reportError("saveToggles", e); }
}

function applyBusinessTypeDefaults() {
  if(!stepVisibility || typeof stepVisibility !== 'object') stepVisibility = {};
  var bEl = document.getElementById("businessTypeSelect");
  var bt = bEl ? bEl.value : "";
  if(bt && BUSINESS_TYPE_DEFAULTS[bt]) {
    var df = BUSINESS_TYPE_DEFAULTS[bt];
    for(var k in df) {
      if(!stepVisibility._manualOverrides || !stepVisibility._manualOverrides[k]) stepVisibility[k] = df[k];
    }
  }
}

function onBusinessTypeChange() {
  var bEl = document.getElementById("businessTypeSelect");
  var bt = bEl ? bEl.value : "";
  if(bt && BUSINESS_TYPE_DEFAULTS[bt]) {
    var df = BUSINESS_TYPE_DEFAULTS[bt];
    for(var k in df) stepVisibility[k] = df[k];
    stepVisibility._manualOverrides = {};
  }
  markSettingsDirty();
  renderStepToggles();
}

function renderStepToggles() {
  if(!stepVisibility || typeof stepVisibility !== 'object') stepVisibility = {};
  var c = document.getElementById("stepToggleList");
  if(!c) return;
  c.innerHTML = STEP_DEFS.map(function(s) {
    var v = stepVisibility[s.key] !== false,
        ck = v ? "checked" : "",
        dis = s.locked ? "disabled" : "",
        ll = s.locked ? '<span class="step-toggle-locked">(always on)</span>' : "";
    return '<div class="step-toggle-row"><div><div class="step-toggle-name">' + s.label + ' ' + ll + '</div><div class="step-toggle-desc">' + s.desc + '</div></div><label class="toggle-switch"><input type="checkbox" ' + ck + ' ' + dis + ' data-stepkey="' + s.key + '"><span class="toggle-slider"></span></label></div>';
  }).join("");

  c.querySelectorAll('input[type="checkbox"]').forEach(function(inp) {
    inp.addEventListener('change', function() {
      var key = this.getAttribute('data-stepkey');
      onToggleChange(key, this.checked);
    });
  });
}

function onToggleChange(k, v) {
  if(!stepVisibility || typeof stepVisibility !== 'object') stepVisibility = {};
  stepVisibility[k] = v;
  if(!stepVisibility._manualOverrides) stepVisibility._manualOverrides = {};
  stepVisibility._manualOverrides[k] = true;
  markVisibilityDirty();
}

async function saveStepVisibility() {
  if (!validateOrgContext()) return;
  var st = document.getElementById("visibilityStatus");
  try {
    var res = await safeFetch("/auth/save-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { step_visibility: stepVisibility } })
    });
    if (res) {
      var d = await res.json();
      if(d.success && st) {
        st.textContent = "Visibility saved.";
        st.style.color = "var(--success,#16a34a)";
      }
    }
    clearVisibilityDirty();
    renderStepToggles();
    updateProgress();
    notifySync();
  } catch(e) { reportError("saveStepVisibility", e); }
}

async function loadKeyPersonnel() {
  try {
    var res = await safeFetch("/api/onboarding/key-personnel/list");
    if (res) {
      var d = await res.json();
      if(d.success && d.keyPersonnel) {
        keyPersonnel = d.keyPersonnel.map(function(kp) {
          return {
            employeeId: kp.employeeId || kp.id,
            name: kp.name,
            email: kp.email,
            role_id: kp.role_id,
            tasks: kp.roles ? kp.roles.map(function(r) { return r.role || r.task_name; }) : []
          };
        });
      }
    }
  } catch(e) { reportError("loadKeyPersonnel", e); }
  renderKeyPersonnel();
}

function renderKeyPersonnel() {
  var all = keyPersonnel.concat(pendingKP);
  var container = document.getElementById("kpListBody");
  var completeBtn = document.getElementById("kpCompleteBtn");
  var unsavedBanner = document.getElementById("kpUnsavedBanner");

  if(!container) return;

  if(unsavedBanner) unsavedBanner.style.display = pendingKP.length > 0 ? "flex" : "none";
  if(completeBtn) completeBtn.style.display = pendingKP.length > 0 ? "inline-block" : "none";

  if(all.length === 0) {
    container.innerHTML = '<div class="kp-loading">No key personnel assigned yet.</div>';
    return;
  }

  container.innerHTML = all.map(function(kp, personIdx) {
    var tasks = kp.tasks || (kp.roles ? kp.roles.map(function(r){return r.role || r.task_name;}) : (kp.task ? [kp.task] : []));
    var isPending = personIdx >= keyPersonnel.length;
    var chips = tasks.map(function(t, taskIdx) {
      return '<div class="kp-task-chip">' + esc(t) + ' <button class="btn-remove-kptask" data-person="' + personIdx + '" data-task="' + taskIdx + '" title="Remove task">×</button></div>';
    }).join("");

    return '<div class="kp-person-row">' +
      '<div class="kp-person-info">' +
      '<div class="kp-person-name">' + esc(kp.name || 'Unknown') + (isPending ? ' <span style="font-size:11px;color:#d97706;font-weight:normal;">(Pending Save)</span>' : '') + '</div>' +
      '<div class="kp-person-email">' + esc(kp.email || '') + '</div>' +
      '<div class="kp-person-tasks">' + (chips || '<span style="font-size:12px;color:var(--text-muted);italic;">No tasks assigned</span>') + '</div>' +
      '</div>' +
      '<div class="kp-person-actions">' +
      '<button class="kp-person-remove" data-person="' + personIdx + '">Remove Person</button>' +
      '</div>' +
      '</div>';
  }).join("");

  container.querySelectorAll('.btn-remove-kptask').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var pIdx = parseInt(this.getAttribute('data-person'), 10);
      var tIdx = parseInt(this.getAttribute('data-task'), 10);
      removeKpTask(pIdx, tIdx);
    });
  });

  container.querySelectorAll('.kp-person-remove').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var pIdx = parseInt(this.getAttribute('data-person'), 10);
      removeKpPerson(pIdx);
    });
  });
}

function loadTaskCompletions() {
  try {
    taskCompletions = JSON.parse(localStorage.getItem("driven_task_completions") || sessionStorage.getItem("driven_task_completions") || "{}");
  } catch(e) { taskCompletions = {}; }
}

function adminIsTaskComplete(taskKey) {
  var mapKeyToTask = {
    "roles-permissions": "Roles & Permissions",
    "employees": "Employees",
    "locations": "Locations",
    "clients": "Clients",
    "divisions": "Divisions",
    "project-types": "Project Types",
    "projects": "Projects",
    "fuel-types": "Fuels, Fluids & Energy",
    "units-of-measure": "Units of Measure",
    "asset-types": "Asset Types",
    "assets": "Assets"
  };

  var taskName = mapKeyToTask[taskKey];
  if (!taskName) return false;

  var completions = taskCompletions[taskName] || [];
  var assignedEmails = [];

  var all = keyPersonnel.concat(pendingKP);
  all.forEach(function(kp) {
    var tasks = kp.tasks || (kp.roles ? kp.roles.map(function(r){return r.role || r.task_name;}) : (kp.task ? [kp.task] : []));
    if (tasks.indexOf(taskName) !== -1 && kp.email) {
      assignedEmails.push(kp.email.toLowerCase());
    }
  });

  if (assignedEmails.length === 0) {
    return completions.length > 0;
  }

  for (var i = 0; i < assignedEmails.length; i++) {
    if (completions.indexOf(assignedEmails[i]) === -1) return false;
  }
  return true;
}

function updateProgress() {
  loadTaskCompletions();
  var vs = STEP_DEFS.filter(function(s){return stepVisibility[s.key] !== false;}), comp = 0;
  vs.forEach(function(s){ if(adminIsTaskComplete(s.key)) comp++; });
  var tot = vs.length, pct = tot > 0 ? Math.round((comp / tot) * 100) : 0;
  var fillEl = document.getElementById("progressBarFill");
  var textEl = document.getElementById("progressText");
  if (fillEl) fillEl.style.width = pct + "%";
  if (textEl) textEl.textContent = comp + " of " + tot + " tasks complete";
}

function notifySync() {
  window.dispatchEvent(new CustomEvent("driven_completion_updated"));
  if (syncChannel) syncChannel.postMessage({ type: "driven_completion_updated" });
}

function showCompleteModal(){ 
  var m = document.getElementById("confirmModal");
  if(m) m.classList.add("active"); 
}

function closeCompleteModal(){ 
  var m = document.getElementById("confirmModal");
  if(m) m.classList.remove("active"); 
}

function hideOnboardingTab(){ 
  var t = document.querySelector('.admin-tab[data-tab="onboarding"]'); 
  if(t) t.style.display = "none"; 
}

function insertHeaderTitle(){
  var r = document.querySelector(".dash-header-row1");
  if(r) {
    r.style.position = "relative";
    r.style.display = "flex";
    r.style.alignItems = "center";
    r.style.justifyContent = "space-between";

    var existing = document.querySelector(".admin-header-title");
    if(existing) existing.remove();
    var t = document.createElement("div");
    t.className = "admin-header-title";
    t.textContent = "Admin Dashboard";
    t.style.position = "absolute";
    t.style.left = "50%";
    t.style.transform = "translateX(-50%)";
    t.style.fontWeight = "700";
    t.style.fontSize = "18px";
    t.style.color = "var(--text-main,#0f172a)";

    r.appendChild(t);
  }
}

function injectGlobalUIStyles() {
  if (document.getElementById("driven-admin-ui-styles")) return;
  var style = document.createElement("style");
  style.id = "driven-admin-ui-styles";
  style.textContent = `
    #dashHeader {
      background-color: #ffffff !important;
      border-bottom: 1px solid var(--border, #e2e8f0);
    }
    .admin-card, .emp-form-card, .kp-person-row, .step-toggle-row, .card, .stat-card {
      background-color: var(--card-bg, #ffffff) !important;
      border: 1px solid var(--border, #e2e8f0);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .btn-change-password, #changePasswordBtn {
      background-color: #16a34a !important;
      color: #ffffff !important;
      border: none !important;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-change-password:hover, #changePasswordBtn:hover {
      background-color: #15803d !important;
    }
    .theme-toggle-container {
      display: inline-flex;
      align-items: center;
      border: 2px solid var(--border, #94a3b8);
      border-radius: 20px;
      padding: 2px 6px;
      background: var(--bg-secondary, #f1f5f9);
    }
    .theme-switch input:checked + .toggle-slider {
      background-color: #2563eb;
    }
  `;
  document.head.appendChild(style);
}

function attachEventHandlers() {
  document.querySelectorAll('.admin-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var tabName = this.getAttribute('data-tab');
      if (tabName) switchTab(tabName);
    });
  });

  document.querySelectorAll('#onboardingSubtabBar .admin-subtab').forEach(function(subtab) {
    subtab.addEventListener('click', function() {
      var subtabName = this.getAttribute('data-subtab');
      if (subtabName) switchOnboardingSubtab(subtabName);
    });
  });

  var themeCb = document.getElementById("theme-checkbox");
  if(themeCb) {
    themeCb.addEventListener('change', toggleTheme);
  }

  var logoFile = document.getElementById("logoFile");
  if (logoFile) {
    logoFile.addEventListener('change', handleLogoUpload);
  }

  var logoRemove = document.getElementById("logoRemoveBtn");
  if (logoRemove) {
    logoRemove.addEventListener('click', handleLogoRemove);
  }

  var bSelect = document.getElementById("businessTypeSelect");
  if (bSelect) {
    bSelect.addEventListener('change', onBusinessTypeChange);
  }

  var nInput = document.getElementById("naicsInput");
  if (nInput) {
    nInput.addEventListener('input', onNaicsChange);
  }

  var cSelect = document.getElementById("currencySelect");
  if (cSelect) {
    cSelect.addEventListener('change', onCurrencyChange);
  }

  var btnSaveSettings = document.getElementById("saveSettingsBtn");
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', saveSettings);
  }

  var btnSaveNaics = document.getElementById("saveNaicsBtn");
  if (btnSaveNaics) {
    btnSaveNaics.addEventListener('click', saveSettings);
  }

  var btnSaveCurrency = document.getElementById("saveCurrencyBtn");
  if (btnSaveCurrency) {
    btnSaveCurrency.addEventListener('click', saveSettings);
  }

  var btnSaveToggles = document.getElementById("saveTogglesBtn");
  if (btnSaveToggles) {
    btnSaveToggles.addEventListener('click', saveToggles);
  }

  var btnSaveVisibilityTop = document.getElementById("btnSaveStepVisibilityTop");
  if (btnSaveVisibilityTop) {
    btnSaveVisibilityTop.addEventListener('click', saveStepVisibility);
  }

  var btnSaveVisibilityBottom = document.getElementById("btnSaveStepVisibilityBottom");
  if (btnSaveVisibilityBottom) {
    btnSaveVisibilityBottom.addEventListener('click', saveStepVisibility);
  }

  var btnAddKp = document.getElementById("kpAddBtn");
  if (btnAddKp) {
    btnAddKp.addEventListener('click', addKeyPersonnel);
  }

  var kpSelectAll = document.getElementById("kpTaskSelectAll");
  if (kpSelectAll) {
    kpSelectAll.addEventListener('change', function() {
      toggleSelectAllKpTasks(this.checked);
    });
  }

  var kpCompleteBtn = document.getElementById("kpCompleteBtn");
  if (kpCompleteBtn) {
    kpCompleteBtn.addEventListener('click', saveKeyPersonnelToDB);
  }

  var finalizeBtn = document.getElementById("finalizeOnboardingBtn");
  if (finalizeBtn) {
    finalizeBtn.addEventListener('click', finalizeCompanyOnboarding);
  }

  var btnDismissErr = document.getElementById("btnDismissError");
  if (btnDismissErr) {
    btnDismissErr.addEventListener('click', dismissPageError);
  }

  var btnLogout = document.getElementById("btnAdminLogout");
  if (btnLogout) {
    btnLogout.addEventListener('click', function() {
      if (typeof window.drivenLogout === 'function') {
        window.drivenLogout();
      } else {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/app/auth/login.html';
      }
    });
  }
}

async function startAdminApp(user) {
  if (!user) {
    var savedUserStr = localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user");
    if (savedUserStr) {
      try { user = JSON.parse(savedUserStr); } catch(e){}
    }
  }

  currentUserObj = user;
  var roleVal = String((user && (user.role_id || user.role)) || "").trim().toLowerCase();
  var isAllowedAdmin = roleVal === "ro-admin" || roleVal === "admin" || roleVal.indexOf("founder") !== -1;

  if (!user || !isAllowedAdmin) { 
    console.warn("[AdminDashboard] Guard rejected role:", roleVal);
    window.location.href = "/app/auth/login.html"; 
    return; 
  }

  activeOrgId = user.org_id || localStorage.getItem("driven_org_id") || sessionStorage.getItem("driven_org_id") || "org_dsi";

  if (!user.id && user.user_id) user.id = user.user_id;
  var userStr = JSON.stringify(user);

  localStorage.setItem("driven_org_id", activeOrgId);
  localStorage.setItem("driven_user", userStr);
  localStorage.setItem("driven_role", user.role_id || user.role || "RO-admin");
  if (user.id) localStorage.setItem("driven_user_id", user.id);

  sessionStorage.setItem("driven_org_id", activeOrgId);
  sessionStorage.setItem("driven_user", userStr);
  sessionStorage.setItem("driven_role", user.role_id || user.role || "RO-admin");
  if (user.id) sessionStorage.setItem("driven_user_id", user.id);

  var elName = document.getElementById("welcome-name");
  var elComp = document.getElementById("welcome-company");
  var elRole = document.getElementById("welcome-role");
  var elMail = document.getElementById("welcome-email");

  if(elName) elName.textContent = user.first_name || user.email || "Admin";
  if(elComp) elComp.textContent = user.org_name || localStorage.getItem("driven_org_name") || "Digital Safety Inspection, LLC";
  if(elRole) elRole.textContent = user.role || user.role_id || "RO-admin";
  if(elMail) elMail.textContent = user.email || "";

  injectGlobalUIStyles();
  insertHeaderTitle();
  attachEventHandlers();

  /* Reveal Dashboard UI */
  var loadingEl = document.getElementById("loading");
  var dashEl = document.getElementById("dashboard");
  if (loadingEl) loadingEl.style.display = "none";
  if (dashEl) dashEl.style.display = "block";
  
  adjustStickyOffsets();

  /* Load Initial Data and Stats */
  loadLogo().catch(function(e){ reportError("loadLogo", e); });
  loadSettings().catch(function(e){ reportError("loadSettings", e); });
  loadKeyPersonnel().catch(function(e){ reportError("loadKeyPersonnel", e); });
  updateProgress();
  updateThemeSwitch();
  renderFormsTab();
  
  // High-reliability KPI load sequence
  await loadDashboardStats().catch(function(e){ reportError("init-loadDashboardStats", e); });
  setTimeout(function() {
    loadDashboardStats().catch(function(e){ reportError("init-loadDashboardStats-retry", e); });
  }, 1000);
}

async function init() {
  var savedTheme = localStorage.getItem("driven-theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  var current = window.dashUser || window.drivenUser;
  if (current) {
    startAdminApp(current);
  } else {
    document.addEventListener("dashSessionLoaded", async function(e) {
      startAdminApp(e.detail || window.dashUser || window.drivenUser);
    });
  }

  window.addEventListener("resize", adjustStickyOffsets);
  window.addEventListener("orientationchange", adjustStickyOffsets);
  window.addEventListener("scroll", adjustStickyOffsets, { passive: true });
  window.addEventListener("driven_completion_updated", function() {
    updateProgress();
  });

  window.addEventListener("load", adjustStickyOffsets);

  if (syncChannel) {
    syncChannel.onmessage = function(msg) {
      if (msg.data && msg.data.type === "driven_completion_updated") {
        updateProgress();
      }
    };
  }
}

init();
