/* ==========================================================================
   DRIV-EN Platform — Onboarding: Fuels, Fluids & Energy JavaScript (v1)
   File: /app/onboarding/fuel-types.js
   Extracted from fuel-types.html for CSP compliance (no inline scripts).
   ========================================================================== */

var ftDirty = false;
var customFuelTypes = [];
var activeOrgId = null;

function normalizeName(str) { 
  if (typeof str === 'object' && str !== null) {
    str = str.fuel_name || str.name || str.fuel_type || str.description || "";
  }
  return String(str || "").trim().replace(/\s+/g, " "); 
}

function validateOrgContext() {
  if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "null") {
    var statusEl = document.getElementById("ftStepStatus");
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
  var payload = JSON.stringify({ page: "Fuels & Fluids", action: "leave" });
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
      body: JSON.stringify({ page: "Fuels & Fluids" })
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
  if (ftDirty) {
    e.preventDefault();
    e.returnValue = "You have unsaved changes.";
  }
});
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") {
    sendPresenceUnload();
  } else if (document.visibilityState === "visible") {
    checkActivePresence();
  }
});

function addCustomFuelType() {
  var input = document.getElementById("customFuelInput");
  var notice = document.getElementById("customCheckNotice");
  var val = normalizeName(input.value);
  notice.style.display = "none";
  if (!val) return;

  var checkClean = val.toLowerCase();

  var matchedCheckbox = null;
  var allDefaults = document.querySelectorAll(".ft-grid:not(#customFuelGrid) input[type='checkbox']");

  allDefaults.forEach(function(cb) {
    var valText = cb.value.toLowerCase();
    var lblText = (cb.nextElementSibling ? cb.nextElementSibling.textContent : "").toLowerCase();
    
    if (valText === checkClean || lblText === checkClean || 
        (checkClean.length >= 3 && (valText.indexOf(checkClean) !== -1 || lblText.indexOf(checkClean) !== -1))) {
      matchedCheckbox = cb;
    }
  });

  if (matchedCheckbox) {
    var parentItem = matchedCheckbox.closest(".ft-checkbox-item");
    if (!matchedCheckbox.checked) {
      matchedCheckbox.checked = true;
      notice.textContent = '✓ Automatically checked standard item: "' + matchedCheckbox.value + '"';
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
    ftDirty = true;
    return;
  }

  var existsCustom = customFuelTypes.some(function(c) { return c.toLowerCase() === checkClean; });
  if (existsCustom) {
    notice.textContent = 'ℹ️ Custom fuel type "' + val + '" is already added below.';
    notice.style.color = "var(--primary-blue, #2563eb)";
    notice.style.display = "block";
    input.value = "";
    return;
  }

  customFuelTypes.push(val);
  input.value = "";
  ftDirty = true;
  renderCustomFuelTypes();
}
window.addCustomFuelType = addCustomFuelType;

function removeCustomFuelType(index) {
  customFuelTypes.splice(index, 1);
  ftDirty = true;
  renderCustomFuelTypes();
}

function renderCustomFuelTypes() {
  var grid = document.getElementById("customFuelGrid");
  var header = document.getElementById("customSectionHeader");
  grid.textContent = "";

  if (customFuelTypes.length === 0) {
    grid.style.display = "none";
    header.style.display = "none";
    return;
  }

  grid.style.display = "grid";
  header.style.display = "flex";

  customFuelTypes.forEach(function(name, index) {
    var item = document.createElement("div");
    item.className = "ft-checkbox-item ft-custom-tag";

    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.id = "custom_ft_" + index;
    cb.value = name;
    cb.onchange = function() { ftDirty = true; };

    var lbl = document.createElement("label");
    lbl.htmlFor = "custom_ft_" + index;
    lbl.textContent = name;

    var btn = document.createElement("button");
    btn.className = "ft-btn-remove-custom";
    btn.innerHTML = "✕";
    btn.title = "Remove custom type";
    btn.onclick = function(e) {
      e.preventDefault();
      removeCustomFuelType(index);
    };

    item.appendChild(cb);
    item.appendChild(lbl);
    item.appendChild(btn);
    grid.appendChild(item);
  });
}

async function loadSavedFuelTypes() {
  var saved = [];

  if (navigator.onLine) {
    try {
      var res = await fetch("/api/fuel-types", {
        headers: { "x-org-id": activeOrgId || "" }
      });
      if (res.ok) {
        var data = await res.json();
        var rawList = data.fuelTypes || data.records || data.data || (Array.isArray(data) ? data : []);
        saved = rawList.map(function(item) {
          return normalizeName(item);
        }).filter(Boolean);

        localStorage.setItem("driven_fuel_types", JSON.stringify(saved));
      } else {
        saved = JSON.parse(localStorage.getItem("driven_fuel_types") || "[]").map(normalizeName).filter(Boolean);
      }
    } catch (e) {
      console.warn("API load for fuel types failed, falling back to local storage:", e.message);
      saved = JSON.parse(localStorage.getItem("driven_fuel_types") || "[]").map(normalizeName).filter(Boolean);
    }
  } else {
    saved = JSON.parse(localStorage.getItem("driven_fuel_types") || "[]").map(normalizeName).filter(Boolean);
  }

  if (saved && saved.length > 0) {
    var defaultVals = [];
    document.querySelectorAll(".ft-grid:not(#customFuelGrid) input[type='checkbox']").forEach(function(cb) {
      defaultVals.push(cb.value);
      cb.checked = saved.indexOf(cb.value) !== -1;
    });

    saved.forEach(function(sItem) {
      if (defaultVals.indexOf(sItem) === -1 && customFuelTypes.indexOf(sItem) === -1) {
        customFuelTypes.push(sItem);
      }
    });
    renderCustomFuelTypes();
  }
}

async function saveFuelTypes() {
  if (!validateOrgContext()) return;

  var statusEl = document.getElementById("ftStepStatus");
  statusEl.style.color = "var(--error)";

  if (!navigator.onLine) {
    statusEl.textContent = "Network Error: You must be connected to the internet to save fuel & fluid selections to Cloudflare D1.";
    return;
  }

  var selected = [];
  document.querySelectorAll(".dash-card input[type='checkbox']:checked").forEach(function(cb) {
    selected.push(cb.value);
  });

  if (selected.length === 0) {
    statusEl.textContent = "Please select at least one fuel, fluid, or energy type.";
    return;
  }

  localStorage.setItem("driven_fuel_types", JSON.stringify(selected));
  localStorage.setItem("driven_fuel_count", String(selected.length));
  localStorage.setItem("driven_fuel_types_count", String(selected.length));
  
  var btnSave = document.getElementById("btnSaveFt");
  btnSave.disabled = true;
  btnSave.textContent = "Saving...";

  try {
    var res = await fetch("/api/fuel-types", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-org-id": activeOrgId || ""
      },
      body: JSON.stringify({ fuelTypes: selected })
    });
    if (!res.ok) throw new Error("Save failed");
    
    statusEl.style.color = "var(--success)";
    statusEl.textContent = selected.length + " fuel & fluid type(s) saved directly to system. Redirecting to onboarding dashboard…";
    btnSave.textContent = "Saved ✓";
    ftDirty = false;

    setTimeout(function() {
      window.location.href = "/app/dashboard/onboarding-dashboard.html";
    }, 1200);
  } catch(err) {
    statusEl.style.color = "var(--error)";
    statusEl.textContent = "Save failed: " + err.message;
    btnSave.disabled = false;
    btnSave.textContent = "Save & Continue";
  }
}
window.saveFuelTypes = saveFuelTypes;

document.querySelectorAll(".dash-card input[type='checkbox']").forEach(function(cb) {
  cb.addEventListener("change", function() { ftDirty = true; });
});

document.getElementById("customFuelInput").addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    addCustomFuelType();
  }
});

window.confirmLeave = function() {
  if (ftDirty) {
    return confirm("You have unsaved changes to your fuel & fluid selections. Click OK to leave without saving, or Cancel to stay.");
  }
  return true;
};
window.confirmLogout = function() {
  if (ftDirty) {
    if (!confirm("You have unsaved changes. Click OK to log out without saving, or Cancel to stay.")) return;
  }
  dashLogout();
};

document.addEventListener("dashSessionLoaded", function(e) {
  activeOrgId = (e.detail && e.detail.org_id) || localStorage.getItem("driven_org_id");

  var row1 = document.querySelector(".dash-header-row1");
  if (row1 && !document.querySelector(".ft-header-title")) { 
    var title = document.createElement("div"); 
    title.className = "ft-header-title"; 
    title.textContent = "Onboarding — Fuels, Fluids & Energy"; 
    var logoArea = document.getElementById("dashCustomerLogoArea"); 
    var drivenLogo = row1.querySelector(".dash-driven-logo"); 
    if (logoArea && drivenLogo) { row1.insertBefore(title, drivenLogo); } 
  }

  loadSavedFuelTypes();
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
