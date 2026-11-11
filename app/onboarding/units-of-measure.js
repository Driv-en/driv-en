/**
 * units-of-measure.js — DRIV-EN Onboarding: Measurement System Auto-Detect
 *
 * Extracted from units-of-measure.html for CSP compliance and separation of concerns.
 * Depends on: dashboard-common.js, units-global.js, auth-check.js (loaded before this file)
 */

/* ===== MEASUREMENT SYSTEM AUTO-DETECT ===== */
var selectedSystem = 'imperial'; // default
var detectedCountry = 'US';
var umDirty = false;

// Unit presets for each system (saved to settings for backward compatibility)
var IMPERIAL_UNITS = [
  { name: "Gallons", isCustom: false },
  { name: "Miles", isCustom: false },
  { name: "Pounds", isCustom: false },
  { name: "Hours", isCustom: false }
];
var METRIC_UNITS = [
  { name: "Liters", isCustom: false },
  { name: "Kilometers", isCustom: false },
  { name: "Kilograms", isCustom: false },
  { name: "Hours", isCustom: false }
];

function highlightCard() {
  var impCard = document.getElementById('uom-card-imperial');
  var metCard = document.getElementById('uom-card-metric');
  if (!impCard || !metCard) return;

  if (selectedSystem === 'imperial') {
    impCard.style.borderColor = '#16a34a';
    impCard.style.background = '#dcfce7';
    impCard.style.boxShadow = '0 2px 12px rgba(22,163,74,0.2)';
    metCard.style.borderColor = 'var(--border)';
    metCard.style.background = 'var(--bg-card)';
    metCard.style.boxShadow = 'none';
  } else {
    metCard.style.borderColor = '#16a34a';
    metCard.style.background = '#dcfce7';
    metCard.style.boxShadow = '0 2px 12px rgba(22,163,74,0.2)';
    impCard.style.borderColor = 'var(--border)';
    impCard.style.background = 'var(--bg-card)';
    impCard.style.boxShadow = 'none';
  }

  var countEl = document.getElementById('umCount');
  if (countEl) countEl.textContent = selectedSystem === 'metric' ? 'Metric' : 'Imperial';
}

function selectSystem(sys) {
  selectedSystem = sys;
  umDirty = true;
  highlightCard();
}

/* ===== DETECT COUNTRY & LOAD EXISTING SETTING ===== */
async function loadUnits() {
  var detectedEl = document.getElementById('uom-detected-text');
  var selectorEl = document.getElementById('uom-system-selector');

  // 1. Try to get existing unit_system from API
  var apiSet = false;
  try {
    var unitsResp = await fetch('/api/settings/units', { credentials: 'include' });
    if (unitsResp.ok) {
      var unitsData = await unitsResp.json();
      if (unitsData.result && unitsData.result.unit_system) {
        selectedSystem = unitsData.result.unit_system;
        apiSet = true;
      }
    }
  } catch (e) {}

  // 2. Try to detect country from auth settings
  if (!apiSet) {
    try {
      var settingsResp = await fetch('/auth/get-settings');
      if (settingsResp.ok) {
        var settingsData = await settingsResp.json();
        var settings = (settingsData && settingsData.settings) ? settingsData.settings : {};
        if (settings.country) {
          detectedCountry = settings.country.toUpperCase().trim();
          if (detectedCountry === 'CA') {
            selectedSystem = 'metric';
          } else {
            selectedSystem = 'imperial';
          }
        }
        // Check if units_of_measure already saved
        if (settings.units_of_measure && Array.isArray(settings.units_of_measure) && settings.units_of_measure.length > 0) {
          // Already has units saved — infer system from them
          var hasLiters = settings.units_of_measure.some(function(u) { return u.name === 'Liters'; });
          var hasGallons = settings.units_of_measure.some(function(u) { return u.name === 'Gallons'; });
          if (hasLiters && !hasGallons) selectedSystem = 'metric';
          else if (hasGallons && !hasLiters) selectedSystem = 'imperial';
        }
      }
    } catch (e) {
      // Fallback: check localStorage
      try {
        var stored = localStorage.getItem('driv-en-unit-system');
        if (stored === 'imperial' || stored === 'metric') {
          selectedSystem = stored;
        }
      } catch (le) {}
    }
  }

  // 3. Show the selector
  var countryName = detectedCountry === 'CA' ? 'Canada' : 'United States';
  var systemName = selectedSystem === 'metric' ? 'Metric' : 'Imperial';
  if (detectedEl) {
    detectedEl.innerHTML = 'Based on your organization\'s country (' + countryName + '), DRIV-EN will use <strong>' + systemName + '</strong> units.';
  }
  if (selectorEl) selectorEl.style.display = 'block';
  highlightCard();

  // Cache in localStorage
  try { localStorage.setItem('driv-en-unit-system', selectedSystem); } catch (e) {}
}

/* ===== SAVE ===== */
document.getElementById("btnSaveUm").addEventListener("click", async function() {
  var umStepStatus = document.getElementById("umStepStatus");
  umStepStatus.textContent = ""; umStepStatus.style.color = "var(--error)";

  var btnSave = document.getElementById("btnSaveUm");
  btnSave.disabled = true; btnSave.textContent = "Saving...";

  // 1. Save unit_system to /api/settings/units
  try {
    var unitsResp = await fetch('/api/settings/units', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_system: selectedSystem })
    });
    if (!unitsResp.ok) {
      var errData = await unitsResp.json().catch(function() { return {}; });
      throw new Error(errData.error || 'Failed to save unit system');
    }
    // Update localStorage cache
    try { localStorage.setItem('driv-en-unit-system', selectedSystem); } catch (e) {}
  } catch (err) {
    umStepStatus.style.color = "var(--error)";
    umStepStatus.textContent = "Failed to save measurement system: " + err.message;
    btnSave.disabled = false; btnSave.textContent = "Save & Continue";
    return;
  }

  // 2. Save individual units to /auth/save-settings (backward compatibility)
  var unitsToSave = selectedSystem === 'metric' ? METRIC_UNITS : IMPERIAL_UNITS;
  try {
    await fetch("/auth/save-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { units_of_measure: unitsToSave } })
    });
  } catch (err) {
    // Non-fatal — the unit_system is the source of truth now
    console.warn("Could not save individual units to settings:", err.message);
  }

  // 3. Save onboarding step completion
  try {
    localStorage.setItem("driven_step9_complete", "true");
    localStorage.setItem("driven_units_of_measure", JSON.stringify(unitsToSave));
    localStorage.setItem("driven_unit_count", unitsToSave.length);
  } catch (e) {}

  umStepStatus.style.color = "var(--success)";
  umStepStatus.textContent = "Measurement system saved: " + (selectedSystem === 'metric' ? 'Metric' : 'Imperial') + ". Redirecting to onboarding dashboard…";
  btnSave.textContent = "Saved ✓";
  umDirty = false;
  setTimeout(function() {
    btnSave.disabled = false; btnSave.textContent = "Save & Continue";
    window.location.href = "/app/dashboard/onboarding-dashboard.html";
  }, 1500);
});

/* ===== DIRTY-STATE TRACKING ===== */
window.confirmLeave = function() {
  if (umDirty) { return confirm("You have unsaved changes. Click OK to leave without saving, or Cancel to stay and save them."); }
  return true;
};
window.confirmLogout = function() {
  if (umDirty) { if (!confirm("You have unsaved changes. Click OK to log out without saving, or Cancel to stay and save them.")) return; }
  dashLogout();
};
window.addEventListener("beforeunload", function(e) {
  if (umDirty) { e.preventDefault(); e.returnValue = "You have unsaved changes."; }
});

/* ===== INIT ===== */
document.addEventListener("dashSessionLoaded", function(e) {
  if (e.detail) {
    var greetingEl = document.getElementById("dashGreetingText");
    if (greetingEl) {
      greetingEl.textContent = "";
      var firstName = e.detail.first_name || "";
      if (!firstName) { var fullName = e.detail.full_name || ""; if (fullName) firstName = fullName.split(" ")[0]; }
      if (firstName) {
        greetingEl.appendChild(document.createTextNode("Welcome, "));
        var strong = document.createElement("strong");
        strong.textContent = firstName;
        greetingEl.appendChild(strong);
      } else {
        greetingEl.textContent = "Welcome";
      }
    }
  }
  var row1 = document.querySelector(".dash-header-row1");
  if (row1 && !document.querySelector(".um-header-title")) {
    var title = document.createElement("div");
    title.className = "um-header-title";
    title.textContent = "Onboarding — Measurement System";
    var logoArea = document.getElementById("dashCustomerLogoArea");
    var drivenLogo = row1.querySelector(".dash-driven-logo");
    if (logoArea && drivenLogo) { row1.insertBefore(title, drivenLogo); }
  }
  var header = document.getElementById("dashHeader");
  var tabBar = document.getElementById("umTabBar");
  if (header && tabBar && !header.contains(tabBar)) { header.appendChild(tabBar); }
  loadUnits();
});
