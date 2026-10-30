/**
 * DRIV-EN Platform: Onboarding Asset Types Controller
 * File: /app/onboarding/asset-types.js
 */

var atDirty = false;
var customAssetTypes = [];
var activeOrgId = "";
var activeModal = null;
var lastActiveElement = null;
var isEventsInitialized = false;

function normalizeName(str) {
  if (typeof str === 'object' && str !== null) {
    str = str.asset_type_name || str.name || str.type || str.assetType || "";
  }
  return String(str || "").trim().replace(/\s+/g, " ");
}

/**
 * Clean string for string key mapping.
 */
function toMatchKey(str) {
  return normalizeName(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Helper to extract pristine text content from a checkbox item container
 * without including action button glyphs (like the removal cross '✕').
 */
function getCheckboxItemLabelText(cb) {
  var parent = cb.closest('.at-checkbox-item');
  if (!parent) return "";
  
  var clone = parent.cloneNode(true);
  var removeBtns = clone.querySelectorAll('.at-btn-remove-custom, button');
  removeBtns.forEach(function(btn) { btn.remove(); });
  
  return clone.textContent.trim();
}

/**
 * Flexible keyword matcher to correlate saved backend strings with static HTML inputs.
 */
function isStandardMatch(savedStr, standardValue, standardLabel) {
  var sKey = toMatchKey(savedStr);
  var vKey = toMatchKey(standardValue);
  var lKey = toMatchKey(standardLabel);

  if (sKey === vKey || (lKey && sKey === lKey)) return true;

  var keyTerms = [
    ["skid", "steer"],
    ["excavator"],
    ["dozer"],
    ["welder"],
    ["generator"]
  ];

  for (var i = 0; i < keyTerms.length; i++) {
    var terms = keyTerms[i];
    var matchSaved = terms.every(function(t) { return sKey.indexOf(t) !== -1; });
    var matchStandard = terms.every(function(t) { return vKey.indexOf(t) !== -1 || (lKey && lKey.indexOf(t) !== -1); });
    if (matchSaved && matchStandard) return true;
  }

  if (sKey.length >= 4 && (vKey.indexOf(sKey) !== -1 || sKey.indexOf(vKey) !== -1 || (lKey && (lKey.indexOf(sKey) !== -1 || sKey.indexOf(lKey) !== -1)))) {
    return true;
  }

  return false;
}

/**
 * Generates a clean, unique code string to satisfy D1 NOT NULL constraints on `asset_type_code`.
 */
function generateAssetTypeCode(name, elementId) {
  if (elementId && elementId.startsWith("at_")) {
    return elementId.toUpperCase();
  }
  return String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "CUSTOM_ASSET_TYPE";
}

function validateOrgContext() {
  if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "null") {
    var statusEl = document.getElementById("atStepStatus");
    if (statusEl) {
      statusEl.style.color = "var(--error)";
      statusEl.textContent = "Security Alert: Invalid Organization Context. Action rejected.";
    }
    return false;
  }
  return true;
}

function sendPresenceUnload() {
  if (!activeOrgId) return;
  var payload = JSON.stringify({ page: "Asset Types", action: "leave" });
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
  if (!navigator.onLine || !activeOrgId) return;
  try {
    var resp = await fetch("/api/onboarding/presence", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-org-id": activeOrgId || ""
      },
      body: JSON.stringify({ page: "Asset Types" })
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

function startPresencePolling() {
  if (window.presenceInterval) {
    clearInterval(window.presenceInterval);
  }
  checkActivePresence();
  window.presenceInterval = setInterval(checkActivePresence, 5000);
}

function doPrintAssetTypes() {
  var origTitle = document.title;
  var orgName = localStorage.getItem("driven_company_name") || "DRIV-EN Operations";
  document.title = orgName + " | Selected Asset Types";
  window.print();
  setTimeout(function() { document.title = origTitle; }, 500);
}

/* Modal Focus Management & Accessibility Functions */
function openModal(modalEl, closeBtnEl) {
  if (typeof modalEl === 'string') {
    modalEl = document.getElementById(modalEl);
  }
  if (!modalEl) return;
  lastActiveElement = document.activeElement;
  activeModal = modalEl;
  modalEl.style.display = "flex";

  if (!closeBtnEl) {
    closeBtnEl = modalEl.querySelector("button.at-btn-secondary, button");
  }
  if (closeBtnEl) {
    setTimeout(function() { closeBtnEl.focus(); }, 50);
  }
}

function closeModal(modalEl) {
  if (typeof modalEl === 'string') {
    modalEl = document.getElementById(modalEl);
  }
  if (!modalEl) return;
  modalEl.style.display = "none";
  if (activeModal === modalEl) activeModal = null;
  if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
    lastActiveElement.focus();
  }
}

function trapModalFocus(e) {
  if (!activeModal || e.key !== 'Tab') return;

  var focusables = activeModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusables.length === 0) return;

  var firstEl = focusables[0];
  var lastEl = focusables[focusables.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    }
  } else {
    if (document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  }
}

function addCustomAssetType() {
  var input = document.getElementById("customAssetInput");
  var notice = document.getElementById("customCheckNotice");
  if (!input || !notice) return;

  var val = normalizeName(input.value);
  notice.style.display = "none";
  if (!val) return;

  var matchedCheckbox = null;
  var allDefaults = document.querySelectorAll(".at-grid:not(#customAssetGrid) input[type='checkbox']");

  allDefaults.forEach(function(cb) {
    var valStr = cb.value;
    var lblStr = getCheckboxItemLabelText(cb);
    if (isStandardMatch(val, valStr, lblStr)) {
      matchedCheckbox = cb;
    }
  });

  if (matchedCheckbox) {
    var parentItem = matchedCheckbox.closest(".at-checkbox-item");
    var confirmUseStandard = confirm("⚠️ A standard asset type similar to '" + val + "' already exists:\n\n• " + matchedCheckbox.value + "\n\nClick OK to check the standard option, or Cancel to create your custom asset type anyway.");
    if (confirmUseStandard) {
      if (!matchedCheckbox.checked) {
        matchedCheckbox.checked = true;
        notice.textContent = '✓ Checked standard option: "' + matchedCheckbox.value + '"';
        notice.style.color = "var(--success)";
        notice.style.display = "block";
      } else {
        notice.textContent = 'ℹ️ "' + matchedCheckbox.value + '" is already selected above.';
        notice.style.color = "var(--primary-blue, #2563eb)";
        notice.style.display = "block";
      }
      if (parentItem) {
        parentItem.classList.add("checked-highlight");
        parentItem.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(function() { parentItem.classList.remove("checked-highlight"); }, 2500);
      }
      input.value = "";
      atDirty = true;
      return;
    }
  }

  var matchKey = toMatchKey(val);
  var existsCustom = customAssetTypes.some(function(c) {
    return toMatchKey(c) === matchKey;
  });

  if (existsCustom) {
    notice.textContent = 'ℹ️ Custom asset type "' + val + '" is already added below.';
    notice.style.color = "var(--primary-blue, #2563eb)";
    notice.style.display = "block";
    input.value = "";
    return;
  }

  customAssetTypes.push(val);
  input.value = "";
  atDirty = true;
  renderCustomAssetTypes();
}

function removeCustomAssetType(index) {
  customAssetTypes.splice(index, 1);
  atDirty = true;
  renderCustomAssetTypes();
}

function renderCustomAssetTypes() {
  var grid = document.getElementById("customAssetGrid");
  var header = document.getElementById("customSectionHeader");
  if (!grid || !header) return;

  grid.textContent = "";

  if (customAssetTypes.length === 0) {
    grid.style.display = "none";
    header.style.display = "none";
    return;
  }

  grid.style.display = "grid";
  header.style.display = "flex";

  customAssetTypes.forEach(function(name, index) {
    var item = document.createElement("div");
    item.className = "at-checkbox-item at-custom-tag";

    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.id = "custom_at_" + index;
    cb.value = name;
    cb.addEventListener("change", function() { atDirty = true; });

    var lbl = document.createElement("label");
    lbl.htmlFor = "custom_at_" + index;
    lbl.textContent = name;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "at-btn-remove-custom";
    btn.innerHTML = '<span aria-hidden="true">✕</span>';
    btn.title = "Remove custom type";
    btn.setAttribute("aria-label", "Remove " + name);
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      removeCustomAssetType(index);
    });

    item.appendChild(cb);
    item.appendChild(lbl);
    item.appendChild(btn);
    grid.appendChild(item);
  });
}

async function loadSavedAssetTypes() {
  try {
    var userObj = JSON.parse(localStorage.getItem("driven_user") || "{}");
    var orgId = activeOrgId || userObj.org_id || localStorage.getItem("driven_org_id");
    var userId = userObj.id || localStorage.getItem("driven_user_id");
    var rawSaved = [];

    if (navigator.onLine && orgId && orgId !== "default_org") {
      try {
        var res = await fetch("/api/asset-types", { 
          method: "GET",
          headers: { "x-org-id": orgId, "x-user-id": String(userId || "") }
        });
        if (res.ok) {
          var data = await res.json();
          rawSaved = data.assetTypes || data.records || data.data || (Array.isArray(data) ? data : []);
        }
      } catch (apiErr) {
        console.warn("D1 GET /api/asset-types fetch failed:", apiErr);
      }
    }

    if (!rawSaved || rawSaved.length === 0) {
      try {
        var localRaw = localStorage.getItem("driven_asset_types");
        if (localRaw) rawSaved = JSON.parse(localRaw);
      } catch(e) {}
    }

    var normalizedSaved = (Array.isArray(rawSaved) ? rawSaved : [])
      .map(normalizeName)
      .filter(function(name) { return name && name !== "[object Object]"; });

    localStorage.setItem("driven_asset_types", JSON.stringify(normalizedSaved));
    localStorage.setItem("driven_asset_type_count", String(normalizedSaved.length));

    customAssetTypes = [];
    var defaultCheckboxes = document.querySelectorAll(".at-grid:not(#customAssetGrid) input[type='checkbox']");

    defaultCheckboxes.forEach(function(cb) {
      cb.checked = false;
    });

    normalizedSaved.forEach(function(savedItem) {
      var matchedCb = null;

      defaultCheckboxes.forEach(function(cb) {
        if (matchedCb) return;
        var cbVal = cb.value;
        var cbLabel = getCheckboxItemLabelText(cb);
        if (isStandardMatch(savedItem, cbVal, cbLabel)) {
          matchedCb = cb;
        }
      });

      if (matchedCb) {
        matchedCb.checked = true;
      } else {
        if (!customAssetTypes.some(function(c) { return toMatchKey(c) === toMatchKey(savedItem); })) {
          customAssetTypes.push(savedItem);
        }
      }
    });

    renderCustomAssetTypes();
  } catch (e) {
    console.warn("Load asset types critical error:", e);
  }
}

async function saveAssetTypes(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  if (!validateOrgContext()) return;

  var statusEl = document.getElementById("atStepStatus");
  if (!statusEl) return;
  
  statusEl.style.color = "var(--error)";

  if (!navigator.onLine) {
    statusEl.textContent = "Network Error: You must be connected to internet to save asset types.";
    return;
  }

  var selectedPayload = [];
  var simpleSelectedList = [];

  document.querySelectorAll(".dash-card input[type='checkbox']:checked").forEach(function(cb) {
    var val = normalizeName(cb.value);
    if (!val || val === "[object Object]") return;

    simpleSelectedList.push(val);

    var categoryGroup = "General";
    var parentGrid = cb.closest('.at-grid');
    if (parentGrid) {
      var prev = parentGrid.previousElementSibling;
      while (prev) {
        if (prev.classList && prev.classList.contains('at-section-heading')) {
          categoryGroup = prev.textContent.replace(/^[^\w\s]+/, '').trim();
          break;
        }
        prev = prev.previousElementSibling;
      }
    }

    selectedPayload.push({
      asset_type_code: generateAssetTypeCode(val, cb.id),
      asset_type_name: val,
      category_group: categoryGroup,
      is_custom: cb.id.startsWith("custom_at_") ? 1 : 0
    });
  });

  if (selectedPayload.length === 0) {
    statusEl.textContent = "Please select at least one asset type.";
    return;
  }

  var userObj = JSON.parse(localStorage.getItem("driven_user") || "{}");
  var userId = userObj.id || localStorage.getItem("driven_user_id");

  var btnSave = document.getElementById("btnSaveAt");
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = "Saving to Database...";
  }

  var primarySaved = false;

  try {
    var res = await fetch("/api/asset-types", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-org-id": activeOrgId,
        "x-user-id": String(userId || "")
      },
      body: JSON.stringify({ assetTypes: selectedPayload })
    });

    if (res.ok) {
      primarySaved = true;
      localStorage.setItem("driven_asset_types", JSON.stringify(simpleSelectedList));
      localStorage.setItem("driven_asset_type_count", String(simpleSelectedList.length));
    } else {
      var errData = await res.json().catch(function() { return {}; });
      console.warn("Primary API save notice:", errData);
    }
  } catch (d1Err) {
    console.warn("Primary API save exception:", d1Err);
  }

  if (primarySaved) {
    statusEl.style.color = "var(--success,#16a34a)";
    statusEl.textContent = selectedPayload.length + " asset type(s) saved under " + activeOrgId + ". Redirecting…";
    if (btnSave) btnSave.textContent = "Saved ✓";
    atDirty = false;

    if (window.BroadcastChannel) {
      try {
        var bc = new BroadcastChannel("driven_onboarding_sync");
        bc.postMessage({ type: "driven_data_updated" });
      } catch(e){}
    }

    setTimeout(function() {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = "Save & Continue";
      }
      window.location.href = "/app/dashboard/onboarding-dashboard.html";
    }, 1200);
  } else {
    statusEl.style.color = "var(--error)";
    statusEl.textContent = "Server save failed. Please check your connection and try again.";
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = "Save & Continue";
    }
  }
}

function initEventHandlers() {
  if (isEventsInitialized) return;
  isEventsInitialized = true;

  var form = document.getElementById("assetTypesForm");
  if (form) form.addEventListener("submit", saveAssetTypes);

  var btnPrint = document.getElementById("btnPrintSelection");
  if (btnPrint) btnPrint.addEventListener("click", doPrintAssetTypes);

  var btnAddCustom = document.getElementById("btnAddCustom");
  if (btnAddCustom) btnAddCustom.addEventListener("click", addCustomAssetType);

  var customInput = document.getElementById("customAssetInput");
  if (customInput) {
    customInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        addCustomAssetType();
      }
    });
  }

  var btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", function() {
      if (atDirty && !confirm("You have unsaved changes. Click OK to log out without saving, or Cancel to stay.")) return;
      if (typeof dashLogout === 'function') dashLogout();
    });
  }

  var btnReturn = document.getElementById("btnReturnOnboarding");
  if (btnReturn) {
    btnReturn.addEventListener("click", function(e) {
      if (atDirty && !confirm("You have unsaved changes. Click OK to leave without saving, or Cancel to stay.")) e.preventDefault();
    });
  }

  var btnAdmin = document.getElementById("btnAdminDash");
  if (btnAdmin) {
    btnAdmin.addEventListener("click", function(e) {
      if (atDirty && !confirm("You have unsaved changes. Click OK to leave without saving, or Cancel to stay.")) e.preventDefault();
    });
  }

  document.querySelectorAll(".dash-card input[type='checkbox']").forEach(function(cb) {
    cb.addEventListener("change", function() { atDirty = true; });
  });

  // Help Modals Binding & Accessibility
  var btnPurpose = document.getElementById("btnPurpose");
  var btnClosePurpose = document.getElementById("btnClosePurpose");
  var purposeModal = document.getElementById("purposeModal");

  var btnInstructions = document.getElementById("btnInstructions");
  var btnCloseInstructions = document.getElementById("btnCloseInstructions");
  var instructionsModal = document.getElementById("instructionsModal");

  if (btnPurpose && purposeModal) btnPurpose.addEventListener("click", function() { openModal(purposeModal, btnClosePurpose); });
  if (btnClosePurpose && purposeModal) btnClosePurpose.addEventListener("click", function() { closeModal(purposeModal); });

  if (btnInstructions && instructionsModal) btnInstructions.addEventListener("click", function() { openModal(instructionsModal, btnCloseInstructions); });
  if (btnCloseInstructions && instructionsModal) btnCloseInstructions.addEventListener("click", function() { closeModal(instructionsModal); });

  document.querySelectorAll("#purposeModal, #instructionsModal").forEach(function(modal) {
    modal.addEventListener("click", function(e) {
      if (e.target === modal) closeModal(modal);
    });
  });

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && activeModal) {
      closeModal(activeModal);
    } else {
      trapModalFocus(e);
    }
  });
}

function processSessionInit(eDetail) {
  var userObj = JSON.parse(localStorage.getItem("driven_user") || "{}");
  activeOrgId = userObj.org_id || (eDetail && eDetail.org_id) || localStorage.getItem("driven_org_id") || "";

  var row1 = document.querySelector(".dash-header-row1");
  if (row1 && !document.querySelector(".at-header-title")) {
    var title = document.createElement("div");
    title.className = "at-header-title";
    title.textContent = "Onboarding — Asset Types";
    var drivenLogo = row1.querySelector(".dash-driven-logo");
    if (drivenLogo) row1.insertBefore(title, drivenLogo);
  }

  loadSavedAssetTypes();
  startPresencePolling();
}

window.addEventListener("pagehide", sendPresenceUnload);
window.addEventListener("beforeunload", function(e) {
  sendPresenceUnload();
  if (atDirty) {
    e.preventDefault();
    e.returnValue = "You have unsaved changes.";
  }
});

document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") sendPresenceUnload();
  else if (document.visibilityState === "visible") checkActivePresence();
});

document.addEventListener("DOMContentLoaded", function() {
  var yEl = document.getElementById("dashFooterYear");
  if (yEl) yEl.textContent = new Date().getFullYear();
  initEventHandlers();
});

document.addEventListener("dashSessionLoaded", function(e) {
  processSessionInit(e.detail);
});
