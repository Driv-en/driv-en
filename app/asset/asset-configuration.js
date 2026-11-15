/**
 * DRIV-EN | Asset Configuration & Setup (v1)
 * File: /app/asset/asset-configuration.js
 * Extracted from asset-configuration.html for CSP compliance.
 *
 * Fixes applied during extraction:
 *   - populateDropdown: replaced select.innerHTML with clearChildren + createElement('option').
 *   - loadAssetTypesDropdown: replaced select.innerHTML with DOM-safe option building.
 *   - loadParentAssetsDropdown: replaced select.innerHTML with DOM-safe option building.
 *   - renderPmSchedulesTable: replaced tb.innerHTML with DOM-safe row building.
 *   - All onclick-referenced functions exposed on window.
 */

var currentAssetId = null;
var currentAssetType = null;
var activeOrgId = null;
var activeUserId = null;
var humanAssetNumber = "";
var pmScheduleItems = [];
var isBootstrapped = false;

window.addEventListener('storage', function(e) {
  if (e.key === 'driven-theme' && e.newValue) {
    document.documentElement.setAttribute('data-theme', e.newValue);
  }
});

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

var urlParams = new URLSearchParams(window.location.search);
currentAssetId = urlParams.get('id') || urlParams.get('asset_id');
currentAssetType = urlParams.get('asset_type') || urlParams.get('type');

function extractRecords(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  return data.assetTypes || data.records || data.equipment || data.data || data.results || [];
}

function resolveActiveOrgId(u) {
  var urlOrg = urlParams.get('org_id') || urlParams.get('orgId') || urlParams.get('customerId');
  if (urlOrg && urlOrg !== "default_org") return urlOrg;
  
  if (u && u.org_id && u.org_id !== "default_org") return u.org_id;
  if (u && u.customer_id && u.customer_id !== "default_org") return u.customer_id;
  
  var lsOrg = localStorage.getItem("driven_org_id") || localStorage.getItem("driven_customer_id");
  if (lsOrg && lsOrg !== "default_org") return lsOrg;

  var ssOrg = sessionStorage.getItem("driven_org_id");
  if (ssOrg && ssOrg !== "default_org") return ssOrg;

  var email = (u && u.email) ? u.email.toLowerCase() : "";
  var roleId = (u && u.role_id) ? String(u.role_id).toLowerCase() : "";
  if (email === "jblood@digitalsafetyinspection.com" || roleId === "ro-founder") {
    return "org_dsi";
  }

  return null;
}

async function initAssetConfig(e) {
  if (isBootstrapped) return;

  var u = (e && e.detail) ? e.detail : (window.dashUser || window.drivenUser);
  
  activeOrgId = resolveActiveOrgId(u);
  activeUserId = (u && u.id) ? u.id : null;

  if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "") {
    var errMsg = "Invalid multi-tenant session context. Execution halted to prevent data leaks.";
    
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report(
        "asset-configuration.html: " + errMsg,
        "tenant-security-guardrail",
        new Error().stack
      );
    }
    
    displayMessage(errMsg, "error");
    document.querySelector(".ac-main").style.opacity = "0.3";
    document.querySelector(".ac-save-bar").style.display = "none";
    return;
  }

  isBootstrapped = true;
  document.querySelector(".ac-main").style.opacity = "1";

  var ha = 0, hi = setInterval(function() {
    ha++;
    if (fixHeaderLayout() || ha > 50) {
      clearInterval(hi);
      updateHeaderOffset();
    }
  }, 100);

  if (currentAssetId) {
    document.getElementById("lnkOverview").href = "/app/asset/asset-detail.html?id=" + encodeURIComponent(currentAssetId);
    document.getElementById("lnkHistory").href = "/app/asset/asset-history.html?id=" + encodeURIComponent(currentAssetId);
  }

  checkActivePresence();
  setInterval(checkActivePresence, 5000);
  
  // Load D1 database options dynamically
  await loadConfigDropdowns();
  await loadAssetTypesDropdown();
  await loadParentAssetsDropdown();

  if (currentAssetType && !currentAssetId) {
    document.getElementById("cfgScopeTarget").value = "type";
    onScopeTargetChange();
    document.getElementById("cfgAssetTypeSelect").value = currentAssetType;
    await fetchAssetTypeGlobalConfig(currentAssetType);
  } else if (currentAssetId) {
    document.getElementById("cfgScopeTarget").value = "asset";
    onScopeTargetChange();
    await fetchAssetConfiguration(currentAssetId);
  } else {
    document.getElementById("txtAssetTitle").textContent = "New Asset Configuration";
  }

  updateHeaderOffset();
}

document.addEventListener("dashSessionLoaded", initAssetConfig);

if (window.dashUser || window.drivenUser) {
  initAssetConfig();
}

function reportClientError(msg, context, err) {
  if (window.DRIVENErrorHandler) {
    window.DRIVENErrorHandler.report("asset-configuration.html: " + msg, context, err ? err.stack : null);
  }
}

function displayMessage(msg, type) {
  var el = document.getElementById("acMessage");
  if (!el) return;
  el.textContent = msg;
  el.className = "ac-message " + type;
  el.style.display = "block";
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function sendPresenceUnload() {
  if (!activeOrgId) return;
  var payload = JSON.stringify({ page: "Asset Configuration", action: "leave" });
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
  if (!activeOrgId) return;
  try {
    var resp = await fetch("/api/onboarding/presence", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-org-id": activeOrgId
      },
      body: JSON.stringify({ page: "Asset Configuration" })
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

// ===== DOM-SAFE HELPERS =====
function clearChildren(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
function addOption(select, value, text, i18n) {
  var opt = document.createElement("option");
  opt.value = value;
  opt.textContent = text;
  if (i18n) opt.setAttribute("data-i18n", "");
  select.appendChild(opt);
  return opt;
}

// Dynamic Database Lookup Dropdown Hydration Function
async function loadConfigDropdowns() {
  try {
    var resp = await fetch("/api/configuration-options", {
      headers: { "x-org-id": activeOrgId }
    });
    if (!resp.ok) return;

    var data = await resp.json();

    populateDropdown("cfgCabType", data.cab_type, "-- Select Cab Type --", true);
    populateDropdown("cfgCabStyle", data.cab_style, "-- Select Cab Style --", true);
    populateDropdown("cfgMobilityType", data.mobility_type, "-- Select Mobility Setup --", true);
    populateDropdown("cfgDrive", data.drive_configuration, "-- Select Drive System --", true);
    populateDropdown("cfgTransmissionType", data.transmission_type, "-- Select Transmission --", true);
    populateDropdown("cfgWheelSetup", data.wheel_setup, "-- Select Wheel Setup --", true);
    populateDropdown("cfgNumAxles", data.num_axles, "-- Select Axle Count --", true);
    populateDropdown("cfgFuelType", data.fuel_type, "-- Select Power Source --", true);
    populateDropdown("cfgPtoSetup", data.pto_setup, "-- Select PTO Setup --", true);
    populateDropdown("cfgWinchSetup", data.winch_setup, "-- Select Winch System --", true);
    populateDropdown("cfgAuxHydraulics", data.aux_hydraulics, "-- Select Aux Hydraulics --", true);
  } catch (e) {
    reportClientError("Failed loading config dropdown options", "loadConfigDropdowns", e);
  }
}

function populateDropdown(selectId, optionsList, placeholder, i18nPlaceholder) {
  var sel = document.getElementById(selectId);
  if (!sel || !Array.isArray(optionsList)) return;

  clearChildren(sel);
  addOption(sel, "", placeholder, i18nPlaceholder);
  optionsList.forEach(function(opt) {
    var val = (typeof opt === "object") ? opt.value : opt;
    var label = (typeof opt === "object") ? opt.label : opt;
    addOption(sel, val, label);
  });
}

function onScopeTargetChange() {
  var scope = document.getElementById("cfgScopeTarget").value;
  var grpAssetType = document.getElementById("grpAssetTypeSelect");

  if (scope === "type") {
    grpAssetType.style.display = "flex";
  } else {
    grpAssetType.style.display = "none";
    if (currentAssetId) {
      fetchAssetConfiguration(currentAssetId);
    }
  }
}

async function onAssetTypeCategoryChange() {
  var typeVal = document.getElementById("cfgAssetTypeSelect").value;
  if (!typeVal) return;
  await fetchAssetTypeGlobalConfig(typeVal);
}

async function loadAssetTypesDropdown() {
  try {
    var resp = await fetch("/api/asset-types", { headers: { "x-org-id": activeOrgId } });
    if (resp.ok) {
      var data = await resp.json();
      var list = extractRecords(data);
      var sel = document.getElementById("cfgAssetTypeSelect");
      clearChildren(sel);
      addOption(sel, "", "-- Select Asset Type --", true);
      list.forEach(function(item) {
        var name = item.asset_type_name || item.name || item.type;
        if (name) {
          addOption(sel, name, name);
        }
      });
    }
  } catch (e) {
    reportClientError("Failed loading asset types", "loadAssetTypesDropdown", e);
  }
}

async function loadParentAssetsDropdown() {
  try {
    var resp = await fetch("/api/equipment", {
      headers: { "x-org-id": activeOrgId }
    });
    var sel = document.getElementById("cfgParentAsset");
    clearChildren(sel);
    addOption(sel, "", "-- Standalone Asset (No Parent) --", true);
    
    if (resp.ok) {
      var data = await resp.json();
      var list = data.records || data.equipment || data.data || (Array.isArray(data) ? data : []);
      list.forEach(function(item) {
        var id = item.id || (item.fields ? item.fields.id : null);
        var num = item.asset_number || item.assetNumber || (item.fields ? item.fields.asset_number : null);
        var type = item.category || item.type || (item.fields ? item.fields.category : "");
        
        if (id && num && id !== currentAssetId) {
          addOption(sel, id, num + " (" + type + ")");
        }
      });
    }
  } catch (e) {
    reportClientError("Failed loading parent assets", "loadParentAssetsDropdown", e);
  }
}

async function fetchAssetTypeGlobalConfig(assetTypeName) {
  try {
    var resp = await fetch("/api/asset-types/config?type=" + encodeURIComponent(assetTypeName), {
      headers: { "x-org-id": activeOrgId }
    });
    
    document.getElementById("txtAssetTitle").textContent = "Asset-Type Global Defaults: " + assetTypeName;

    if (resp.ok) {
      var data = await resp.json();
      var rec = data.record || data.config || data;

      document.getElementById("cfgMake").value = rec.make || "";
      document.getElementById("cfgModel").value = rec.model || "";
      document.getElementById("cfgYear").value = rec.year || "";
      document.getElementById("cfgSerial").value = rec.serial_number || "";
      document.getElementById("cfgCabType").value = rec.cab_type || "";
      document.getElementById("cfgCabStyle").value = rec.cab_style || "";

      document.getElementById("cfgMobilityType").value = rec.mobility_type || "";
      document.getElementById("cfgDrive").value = rec.drive_configuration || "";
      document.getElementById("cfgTransmissionType").value = rec.transmission_type || "";
      document.getElementById("cfgWheelSetup").value = rec.wheel_setup || "";
      document.getElementById("cfgNumAxles").value = rec.num_axles || "";
      document.getElementById("cfgFuelType").value = rec.fuel_type || "";

      document.getElementById("cfgPtoSetup").value = rec.pto_setup || "";
      document.getElementById("cfgWinchSetup").value = rec.winch_setup || "";
      document.getElementById("cfgWinchRating").value = rec.winch_rating || "";
      document.getElementById("cfgAuxHydraulics").value = rec.aux_hydraulics || "";
      
      document.getElementById("cfgEngineOil").value = rec.engine_oil_spec || "";
      document.getElementById("cfgTransmission").value = rec.transmission_fluid_spec || "";
      document.getElementById("cfgBrakeFluid").value = rec.brake_fluid_spec || "";
      document.getElementById("cfgCoolant").value = rec.coolant_spec || "";
      document.getElementById("cfgHydraulicFluid").value = rec.hydraulic_fluid_spec || "";
      document.getElementById("cfgDefTank").value = rec.def_capacity || "";
      document.getElementById("cfgFuelCap").value = rec.fuel_capacity || "";
      document.getElementById("cfgCabinFilter").value = rec.cabin_filter_spec || "";
      document.getElementById("cfgWipers").value = rec.wiper_blades_spec || "";

      if (rec.pm_schedules && Array.isArray(rec.pm_schedules)) {
        pmScheduleItems = rec.pm_schedules;
        renderPmSchedulesTable();
      } else {
        pmScheduleItems = [];
        renderPmSchedulesTable();
      }
    }
  } catch (e) {
    reportClientError("Fetch asset-type global config failed", "fetchAssetTypeGlobalConfig", e);
  }
}

async function fetchAssetConfiguration(assetId) {
  try {
    var resp = await fetch("/api/equipment/" + encodeURIComponent(assetId), {
      headers: { "x-org-id": activeOrgId }
    });
    if (!resp.ok) throw new Error("HTTP Error " + resp.status);
    
    var data = await resp.json();
    var rec = data.record || data.equipment || data;
    
    humanAssetNumber = rec.asset_number || rec.assetNumber || "Asset #" + assetId;
    var category = rec.category || rec.type || "";
    document.getElementById("txtAssetTitle").textContent = humanAssetNumber + (category ? " (" + category + ")" : "");

    document.getElementById("cfgMake").value = rec.make || "";
    document.getElementById("cfgModel").value = rec.model || "";
    document.getElementById("cfgYear").value = rec.year || "";
    document.getElementById("cfgSerial").value = rec.serial_number || rec.serialNumber || "";
    document.getElementById("cfgCabType").value = rec.cab_type || "";
    document.getElementById("cfgCabStyle").value = rec.cab_style || "";

    document.getElementById("cfgMobilityType").value = rec.mobility_type || "";
    document.getElementById("cfgDrive").value = rec.drive_configuration || "";
    document.getElementById("cfgTransmissionType").value = rec.transmission_type || "";
    document.getElementById("cfgWheelSetup").value = rec.wheel_setup || "";
    document.getElementById("cfgNumAxles").value = rec.num_axles || "";
    document.getElementById("cfgFuelType").value = rec.fuel_type || "";

    document.getElementById("cfgPtoSetup").value = rec.pto_setup || "";
    document.getElementById("cfgWinchSetup").value = rec.winch_setup || "";
    document.getElementById("cfgWinchRating").value = rec.winch_rating || "";
    document.getElementById("cfgAuxHydraulics").value = rec.aux_hydraulics || "";

    document.getElementById("cfgEngineOil").value = rec.engine_oil_spec || "";
    document.getElementById("cfgTransmission").value = rec.transmission_fluid_spec || "";
    document.getElementById("cfgBrakeFluid").value = rec.brake_fluid_spec || "";
    document.getElementById("cfgCoolant").value = rec.coolant_spec || "";
    document.getElementById("cfgHydraulicFluid").value = rec.hydraulic_fluid_spec || "";
    document.getElementById("cfgDefTank").value = rec.def_capacity || "";
    document.getElementById("cfgFuelCap").value = rec.fuel_capacity || "";
    document.getElementById("cfgCabinFilter").value = rec.cabin_filter_spec || "";
    document.getElementById("cfgWipers").value = rec.wiper_blades_spec || "";
    
    document.getElementById("cfgParentAsset").value = rec.parent_asset_id || "";
    document.getElementById("cfgCompositeRole").value = rec.composite_role || "";

    if (rec.pm_schedules && Array.isArray(rec.pm_schedules)) {
      pmScheduleItems = rec.pm_schedules;
      renderPmSchedulesTable();
    } else {
      pmScheduleItems = [];
      renderPmSchedulesTable();
    }
  } catch (e) {
    reportClientError("Fetch asset configuration failed", "fetchAssetConfiguration", e);
    displayMessage("Unable to load asset configuration details.", "error");
  }
}

function addPmScheduleRow() {
  var interval = document.getElementById("pmInterval").value.trim();
  var task = document.getElementById("pmTaskName").value.trim();
  var parts = document.getElementById("pmParts").value.trim();

  if (!interval || !task) {
    alert("Please specify both a PM interval and task name.");
    return;
  }

  pmScheduleItems.push({
    interval: parseInt(interval, 10),
    task_name: task,
    parts: parts
  });

  document.getElementById("pmInterval").value = "";
  document.getElementById("pmTaskName").value = "";
  document.getElementById("pmParts").value = "";

  renderPmSchedulesTable();
}

function removePmRule(idx) {
  pmScheduleItems.splice(idx, 1);
  renderPmSchedulesTable();
}

function renderPmSchedulesTable() {
  var tb = document.getElementById("tbPmSchedules");
  clearChildren(tb);
  
  if (pmScheduleItems.length === 0) {
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = 4;
    td.style.cssText = "text-align:center; color:var(--text-muted, #64748b);";
    td.setAttribute("data-i18n", "");
    td.textContent = "No PM schedule rules configured yet.";
    tr.appendChild(td);
    tb.appendChild(tr);
    return;
  }

  pmScheduleItems.forEach(function(item, idx) {
    var tr = document.createElement("tr");

    var td1 = document.createElement("td");
    td1.textContent = item.interval + " Hours/Miles";
    tr.appendChild(td1);

    var td2 = document.createElement("td");
    td2.textContent = item.task_name;
    tr.appendChild(td2);

    var td3 = document.createElement("td");
    td3.textContent = item.parts || "—";
    tr.appendChild(td3);

    var td4 = document.createElement("td");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "am-tab-logout";
    btn.style.cssText = "padding:4px 10px; font-size:12px; margin-left:0;";
    btn.setAttribute("data-i18n", "");
    btn.textContent = "Remove";
    (function(i) { btn.addEventListener("click", function() { removePmRule(i); }); })(idx);
    td4.appendChild(btn);
    tr.appendChild(td4);

    tb.appendChild(tr);
  });
}

function doPrintConfig() {
  var u = window.dashUser || {};
  var customerName = u.org_name || u.tenant_name || u.company_name || u.organization_name || "Organization";
  var assetIdentifier = humanAssetNumber || currentAssetId || "Setup";

  document.title = customerName + " Technical Configuration | Asset #" + assetIdentifier;
  
  window.print();
}

async function uploadOemManual() {
  var fileInput = document.getElementById("fileManualPdf");
  var statusEl = document.getElementById("txtIngestStatus");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Please select a PDF file first.");
    return;
  }

  var file = fileInput.files[0];
  statusEl.textContent = "⌛ Uploading manual & initiating async text chunking/RAG extraction...";

  var formData = new FormData();
  formData.append("manual", file);
  formData.append("asset_id", currentAssetId || "");

  try {
    var resp = await fetch("/api/equipment/ingest-manual", {
      method: "POST",
      headers: {
        "x-org-id": activeOrgId
      },
      body: formData
    });

    if (resp.ok) {
      statusEl.textContent = "✅ OEM Manual ingested successfully! Extracted fluid specs and PM rules applied below.";
    } else {
      statusEl.textContent = "⚠️ Manual upload queued. Background processing will extract specs shortly.";
    }
  } catch (e) {
    reportClientError("OEM manual ingestion failed", "uploadOemManual", e);
    statusEl.textContent = "❌ Manual ingestion error. Please try again.";
  }
}

async function saveConfigurationData() {
  var scope = document.getElementById("cfgScopeTarget").value;
  var endpoint = "";
  var payload = {
    make: document.getElementById("cfgMake").value.trim(),
    model: document.getElementById("cfgModel").value.trim(),
    year: document.getElementById("cfgYear").value.trim(),
    serial_number: document.getElementById("cfgSerial").value.trim(),
    cab_type: document.getElementById("cfgCabType").value,
    cab_style: document.getElementById("cfgCabStyle").value,

    mobility_type: document.getElementById("cfgMobilityType").value,
    drive_configuration: document.getElementById("cfgDrive").value,
    transmission_type: document.getElementById("cfgTransmissionType").value,
    wheel_setup: document.getElementById("cfgWheelSetup").value,
    num_axles: document.getElementById("cfgNumAxles").value,
    fuel_type: document.getElementById("cfgFuelType").value,

    pto_setup: document.getElementById("cfgPtoSetup").value,
    winch_setup: document.getElementById("cfgWinchSetup").value,
    winch_rating: document.getElementById("cfgWinchRating").value.trim(),
    aux_hydraulics: document.getElementById("cfgAuxHydraulics").value,
    
    engine_oil_spec: document.getElementById("cfgEngineOil").value.trim(),
    transmission_fluid_spec: document.getElementById("cfgTransmission").value.trim(),
    brake_fluid_spec: document.getElementById("cfgBrakeFluid").value.trim(),
    coolant_spec: document.getElementById("cfgCoolant").value.trim(),
    hydraulic_fluid_spec: document.getElementById("cfgHydraulicFluid").value.trim(),
    def_capacity: document.getElementById("cfgDefTank").value.trim(),
    fuel_capacity: document.getElementById("cfgFuelCap").value.trim(),
    cabin_filter_spec: document.getElementById("cfgCabinFilter").value.trim(),
    wiper_blades_spec: document.getElementById("cfgWipers").value.trim(),
    
    parent_asset_id: document.getElementById("cfgParentAsset").value,
    composite_role: document.getElementById("cfgCompositeRole").value.trim(),
    pm_schedules: pmScheduleItems
  };

  if (scope === "type") {
    var selectedType = document.getElementById("cfgAssetTypeSelect").value;
    if (!selectedType) {
      displayMessage("Please select an Asset Type Category to save global defaults.", "error");
      return;
    }
    endpoint = "/api/asset-types/config?type=" + encodeURIComponent(selectedType);
  } else {
    if (!currentAssetId) {
      displayMessage("Cannot save configuration without an active Asset ID.", "error");
      return;
    }
    endpoint = "/api/equipment/" + encodeURIComponent(currentAssetId);
  }

  try {
    var resp = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-org-id": activeOrgId
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) throw new Error("HTTP error " + resp.status);

    document.getElementById("lblSaveStatus").textContent = "Configuration Saved";
    document.getElementById("lblSaveStatus").style.color = "#16a34a";
    displayMessage("Technical asset configuration saved successfully.", "success");
  } catch (e) {
    reportClientError("Save asset configuration failed", "saveConfigurationData", e);
    displayMessage("Failed to save asset configuration. " + e.message, "error");
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function confirmLogout() {
  if (confirm("Are you sure you want to log out? Unsaved technical configurations will be lost.")) {
    dashLogout();
  }
}

// ===== EXPOSE FUNCTIONS FOR INLINE ONCLICK HANDLERS =====
window.onScopeTargetChange = onScopeTargetChange;
window.onAssetTypeCategoryChange = onAssetTypeCategoryChange;
window.addPmScheduleRow = addPmScheduleRow;
window.removePmRule = removePmRule;
window.doPrintConfig = doPrintConfig;
window.uploadOemManual = uploadOemManual;
window.saveConfigurationData = saveConfigurationData;
window.confirmLogout = confirmLogout;
