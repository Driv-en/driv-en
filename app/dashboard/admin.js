    /* ===== STATE ===== */
    var orgSettings = {};
    var stepVisibility = {};
    var keyPersonnel = [];
    var pendingKP = []; // KP added locally but not yet saved to server
    var onboardingComplete = false;

    /* ===== BUSINESS TYPE → DEFAULT STEP VISIBILITY ===== */
    var BUSINESS_TYPE_DEFAULTS = {
      "Construction":            { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": true, "project-types": true, "projects": true, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Manufacturing":           { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": true, "project-types": false, "projects": false, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Chemical":               { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": true, "project-types": false, "projects": false, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Oil & Gas":              { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": true, "project-types": true, "projects": true, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Transportation":         { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": false, "project-types": false, "projects": false, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Warehousing":            { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": false, "project-types": false, "projects": false, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Fabrication":            { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": true, "project-types": false, "projects": false, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Logistics / Supply Chain":{ "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": false, "project-types": false, "projects": false, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Utilities & Energy":     { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": true, "project-types": true, "projects": true, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Mining & Aggregates":    { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": true, "project-types": true, "projects": true, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Agriculture":            { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": true, "project-types": false, "projects": false, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Environmental Services":  { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": false, "project-types": false, "projects": false, "assets": true, "fuel-types": true, "units-of-measure": true },
      "Food & Beverage Processing": { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": true, "project-types": false, "projects": false, "assets": true, "fuel-types": true, "units-of-measure": true },
      "General Services":        { "roles-permissions": true, "employees": true, "locations": true, "clients": true, "divisions": false, "project-types": false, "projects": false, "assets": true, "fuel-types": true, "units-of-measure": true }
    };

    /* ===== STEP DEFINITIONS (for toggles) ===== */
    var STEP_DEFS = [
      { key: "roles-permissions", label: "Roles & Permissions", desc: "Define roles and access levels", locked: true },
      { key: "employees",        label: "Employees",           desc: "Add all employees", locked: true },
      { key: "locations",        label: "Locations",           desc: "Plants, mines, facilities, warehouses, job sites", locked: false },
      { key: "clients",          label: "Clients",             desc: "Add clients and customer organizations", locked: false },
      { key: "divisions",        label: "Divisions",           desc: "Internal divisions or business units", locked: false },
      { key: "project-types",    label: "Project Types",       desc: "Types of work your organization performs", locked: false },
      { key: "projects",         label: "Projects",            desc: "Active, completed, or upcoming projects", locked: false },
      { key: "fuel-types",       label: "Fuel Types",          desc: "Types of fuel your organization uses", locked: true },
      { key: "units-of-measure", label: "Units of Measure",    desc: "Volume units for fuel and fluids (gallons, liters, etc.)", locked: true },
      { key: "assets",           label: "Assets",              desc: "Assets and equipment to maintain (includes fuel type & tank capacity)", locked: true }
    ];

    /* ===== FORM DEFINITIONS ===== */
    var FORMS = [
      { key: 'fuel_log', label: 'Log Fuel Purchase', desc: 'Record a fuel purchase with receipt AI extraction', link: '/app/forms/fuel-purchase.html' },
      { key: 'fuel_transfer', label: 'Log Fuel Transfer', desc: 'Transfer fuel between tanks or issue to equipment', link: '/app/forms/fuel-transfer.html' },
      { key: 'transfer_create', label: 'Create Transfer', desc: 'Start an equipment transfer ticket', link: '/app/forms/transfer-create.html' },
      { key: 'wo_create', label: 'Create Work Order', desc: 'Submit a maintenance request', link: '/app/forms/work-order-create.html' },
      { key: 'inspection_add', label: 'Add Inspection', desc: 'Record an equipment inspection', link: '/app/forms/inspection.html' },
      { key: 'pm_add', label: 'Add PM', desc: 'Create a preventive maintenance task', link: '/app/forms/pm.html' }
    ];

    /* ===== DASHBOARD STATS (KPIs) ===== */
    // Fetches real counts from the platform worker via the API proxy.
    // The platform worker's /users endpoint returns the user list; we also
    // query the equipment, projects, and clients endpoints for counts.
    async function loadDashboardStats() {
      var orgId = localStorage.getItem('driven_customer_id');
      if (!orgId) return;

      // The DRIV-EN API worker routes: /api/Employee (→ users table), /api/Equipment (→ assets table), /api/Project (→ projects table)
      // Response format: { records: [...] }
      var promises = [
        fetch('/api/Employee').then(function(r) { return r.json(); }).catch(function() { return { records: [] }; }),
        fetch('/api/Equipment').then(function(r) { return r.json(); }).catch(function() { return { records: [] }; }),
        fetch('/api/Project').then(function(r) { return r.json(); }).catch(function() { return { records: [] }; }),
      ];

      try {
        var results = await Promise.all(promises);

        // Employees — from /api/Employee (D1 users table, filtered by org_id on the server)
        var empRecords = results[0].records || [];
        var empCount = empRecords.length;
        document.getElementById('stat-employees').textContent = empCount;
        localStorage.setItem('driven_employee_count', empCount);

        // Equipment — from /api/Equipment (D1 assets table)
        var eqRecords = results[1].records || [];
        var eqCount = eqRecords.length;
        document.getElementById('stat-equipment').textContent = eqCount;
        localStorage.setItem('driven_equipment_count', eqCount);

        // Projects — from /api/Project (D1 projects table)
        var projRecords = results[2].records || [];
        var projCount = projRecords.length;
        document.getElementById('stat-projects').textContent = projCount;
        localStorage.setItem('driven_project_count', projCount);

        // Clients — from /api/Clients (D1 clients table)
        try {
          var clientsResp = await fetch('/api/Clients');
          var clientsData = await clientsResp.json();
          var clientRecords = clientsData.records || [];
          var clientCount = clientRecords.length;
          document.getElementById('stat-clients').textContent = clientCount;
          localStorage.setItem('driven_client_count', clientCount);
        } catch (e) { /* clients endpoint may not exist yet */ }

      } catch (e) {
        console.error('Failed to load dashboard stats:', e.message);
        document.getElementById('stat-employees').textContent = localStorage.getItem('driven_employee_count') || '0';
        document.getElementById('stat-projects').textContent = localStorage.getItem('driven_project_count') || '0';
        document.getElementById('stat-equipment').textContent = localStorage.getItem('driven_equipment_count') || '0';
        document.getElementById('stat-clients').textContent = localStorage.getItem('driven_client_count') || '0';
      }
    }

    function renderFormsTab() {
      var container = document.getElementById('adminFormsTabLinks');
      if (!container) return;
      container.innerHTML = FORMS.map(function(f) {
        return '<a href="' + f.link + '" style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:14px 16px;text-decoration:none;color:var(--text);transition:border-color 200ms ease;display:block;">' +
          '<div style="font-size:14px;font-weight:600;margin-bottom:4px;">' + esc(f.label) + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);">' + esc(f.desc) + '</div></a>';
      }).join('');
    }

    /* ===== TAB SWITCHING ===== */
    function switchTab(tabName) {
      /* Warn about unsaved visibility changes when leaving the Onboarding tab */
      if (visibilityDirty && document.getElementById('tab-onboarding').classList.contains('active') && tabName !== 'onboarding') {
        var proceed = confirm("You have unsaved Task Visibility changes.\n\nClick Cancel to go back and save, or OK to leave without saving.");
        if (!proceed) return;
        clearVisibilityDirty();
      }
      /* Warn about unsaved settings changes when leaving the Settings tab */
      if (settingsDirty && document.getElementById('tab-settings').classList.contains('active') && tabName !== 'settings') {
        var proceed2 = confirm("You have unsaved changes in Settings.\n\nClick Cancel to go back and save, or OK to leave without saving.");
        if (!proceed2) return;
        clearSettingsDirty();
      }
      document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.admin-tab-content').forEach(function(c) { c.classList.remove('active'); });
      document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
      document.getElementById('tab-' + tabName).classList.add('active');
      /* Show/hide subtab bars based on active tab */
      var settingsBar = document.getElementById('settingsSubtabBar');
      var onboardingBar = document.getElementById('onboardingSubtabBar');
      if (settingsBar) settingsBar.classList.toggle('visible', tabName === 'settings');
      if (onboardingBar) onboardingBar.classList.toggle('visible', tabName === 'onboarding');
      if (tabName === 'forms') renderFormsTab(); if (tabName === 'analytics') initAnalytics();
    }

    /* ===== SETTINGS SUBTAB SWITCHING ===== */
    function switchSettingsSubtab(subtabName) {
      /* Warn about unsaved changes when switching subtabs within Settings */
      if (settingsDirty) {
        var proceed = confirm("You have unsaved changes.\n\nClick Cancel to go back and save, or OK to leave without saving.");
        if (!proceed) return;
        clearSettingsDirty();
      }
      document.querySelectorAll('#settingsSubtabBar .admin-subtab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.admin-subtab-content[id^="settings-subtab-"]').forEach(function(c) { c.classList.remove('active'); });
      document.querySelector('#settingsSubtabBar [data-subtab="' + subtabName + '"]').classList.add('active');
      document.getElementById('settings-subtab-' + subtabName).classList.add('active');
    }

    /* ===== XSS ESCAPE HELPER ===== */
    function esc(s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ===== CLIENT-SIDE ERROR REPORTING → Owner Dashboard error_log table ===== */
    function reportError(source, err) {
      var msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : 'Unknown error');
      var stack = (err && err.stack) ? err.stack : 'No stack trace';
      try {
        fetch('/api/log-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'Admin Dashboard (' + source + ')',
            message: msg,
            stack: stack,
            url: window.location.href,
            userAgent: navigator.userAgent
          })
        }).catch(function() {});
      } catch (e) { console.error('Failed to report error:', e); }
      console.error('[' + source + ']', msg, stack);
    }

    /* ===== ONBOARDING SUBTAB SWITCHING ===== */
    function switchOnboardingSubtab(subtabName) {
      /* Warn about unsaved visibility changes when leaving the visibility subtab */
      if (visibilityDirty && document.getElementById('onboarding-subtab-visibility').classList.contains('active') && subtabName !== 'visibility') {
        var proceed = confirm("You have unsaved Task Visibility changes.\n\nClick Cancel to go back and save, or OK to leave without saving.");
        if (!proceed) return;
        clearVisibilityDirty();
      }
      document.querySelectorAll('#onboardingSubtabBar .admin-subtab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.admin-subtab-content[id^="onboarding-subtab-"]').forEach(function(c) { c.classList.remove('active'); });
      document.querySelector('#onboardingSubtabBar [data-subtab="' + subtabName + '"]').classList.add('active');
      document.getElementById('onboarding-subtab-' + subtabName).classList.add('active');
    }

    /* ===== THEME TOGGLE ===== */
    function toggleTheme() {
      var current = document.documentElement.getAttribute("data-theme");
      var newTheme = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("driven-theme", newTheme);
      updateThemeSwitch();
    }
    function updateThemeSwitch() {
      var current = document.documentElement.getAttribute("data-theme");
      var checkbox = document.getElementById("theme-checkbox");
      var labelLight = document.getElementById("theme-label-light");
      var labelDark = document.getElementById("theme-label-dark");
      if (checkbox) checkbox.checked = (current === "dark");
      if (labelLight) labelLight.classList.toggle("active", current === "light");
      if (labelDark) labelDark.classList.toggle("active", current === "dark");
    }

    /* ===== LOGO UPLOAD ===== */
    async function loadLogo() {
      var preview = document.getElementById("logoPreview");
      var removeBtn = document.getElementById("logoRemoveBtn");
      try {
        var logoRes = await fetch("/auth/get-logo");
        var logoData = await logoRes.json();
        if (logoData.success && logoData.logo) {
          localStorage.setItem("driven_customer_logo", logoData.logo);
          preview.innerHTML = '<img src="' + logoData.logo + '" alt="Logo preview">';
          preview.style.border = "none";
          removeBtn.style.display = "inline-block";
        } else {
          preview.innerHTML = "No logo";
          preview.style.border = "2px dashed var(--border)";
          removeBtn.style.display = "none";
        }
      } catch (e) {
        console.error("Logo load error:", e.message); reportError("loadLogo", e);
        var localLogo = localStorage.getItem("driven_customer_logo");
        if (localLogo) {
          preview.innerHTML = '<img src="' + localLogo + '" alt="Logo preview">';
          preview.style.border = "none";
          removeBtn.style.display = "inline-block";
        }
      }
    }

    async function handleLogoUpload() {
      var file = document.getElementById("logoFile").files[0];
      if (!file) return;
      // Client-side validation: size + MIME type
      if (file.size > 500000) {
        document.getElementById("logoStatus").textContent = "File too large. Max 500KB.";
        document.getElementById("logoStatus").style.color = "var(--error)";
        return;
      }
      var allowedTypes = ["image/png", "image/jpeg", "image/svg+xml"];
      if (allowedTypes.indexOf(file.type) === -1) {
        document.getElementById("logoStatus").textContent = "Invalid file type. Only PNG, JPEG, and SVG are allowed.";
        document.getElementById("logoStatus").style.color = "var(--error)";
        return;
      }
      var reader = new FileReader();
      reader.onload = async function(e) {
        var dataUrl = e.target.result;
        localStorage.setItem("driven_customer_logo", dataUrl);
        try {
          var saveRes = await fetch("/auth/save-logo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logo_data: dataUrl })
          });
          var saveData = await saveRes.json();
          if (saveData.success) {
            document.getElementById("logoStatus").textContent = "Logo uploaded and synced to all devices.";
            document.getElementById("logoStatus").style.color = "var(--success, #16a34a)";
          } else {
            document.getElementById("logoStatus").textContent = "Saved locally but not synced: " + (saveData.error || "Unknown error");
            document.getElementById("logoStatus").style.color = "var(--error)";
          }
        } catch (e) {
          console.error("Logo save error:", e.message); reportError("handleLogoUpload", e);
          document.getElementById("logoStatus").textContent = "Saved locally but not synced to server.";
          document.getElementById("logoStatus").style.color = "var(--error)";
        }
        await loadLogo();
      };
      reader.readAsDataURL(file);
    }

    async function handleLogoRemove() {
      try {
        await fetch("/auth/save-logo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logo_data: "" })
        });
        localStorage.removeItem("driven_customer_logo");
        document.getElementById("logoStatus").textContent = "Logo removed.";
        document.getElementById("logoStatus").style.color = "var(--text-muted)";
        await loadLogo();
      } catch (e) {
        console.error("Logo remove error:", e.message); reportError("removeLogo", e);
        document.getElementById("logoStatus").textContent = "Failed to remove logo.";
        document.getElementById("logoStatus").style.color = "var(--error)";
      }
    }

    /* ===== SETTINGS LOAD / SAVE ===== */
    async function loadSettings() {
      try {
        var res = await fetch("/auth/get-settings");
        var data = await res.json();
        if (data.success && data.settings) {
          orgSettings = data.settings;
          // Business Type
          if (data.settings.business_type) {
            document.getElementById("businessTypeSelect").value = data.settings.business_type;
            document.getElementById("overviewBusinessType").textContent = data.settings.business_type;
            document.getElementById("onboardingBtLabel").textContent = data.settings.business_type;
          }
          // NAICS
          if (data.settings.naics_code) {
            document.getElementById("naicsInput").value = data.settings.naics_code;
          }
          // Currency
          if (data.settings.currency) {
            var currencySel = document.getElementById("currencySelect");
            if (currencySel) currencySel.value = data.settings.currency;
          }
          // Step visibility
          if (data.settings.step_visibility && typeof data.settings.step_visibility === 'object' && !Array.isArray(data.settings.step_visibility)) {
            stepVisibility = data.settings.step_visibility;
          } else {
            // Apply defaults from business type
            stepVisibility = {};
            applyBusinessTypeDefaults();
          }
          // Onboarding complete
          if (data.settings.onboarding_complete) {
            onboardingComplete = true;
            hideOnboardingTab();
          }
        } else {
          // No settings yet — apply defaults
          applyBusinessTypeDefaults();
        }
      } catch (e) {
        console.error("Settings load error:", e.message); reportError("loadSettings", e);
        applyBusinessTypeDefaults();
      }
      renderStepToggles();
      updateProgress();
    }

    /* ===== UNSAVED-CHANGES TRACKING ===== */
    var settingsDirty = false;
    var visibilityDirty = false;

    function markSettingsDirty() {
      settingsDirty = true;
    }

    function clearSettingsDirty() {
      settingsDirty = false;
    }

    function markVisibilityDirty() {
      visibilityDirty = true;
      var warn = document.getElementById('visibilityWarning');
      if (warn) warn.style.display = 'block';
    }

    function clearVisibilityDirty() {
      visibilityDirty = false;
      var warn = document.getElementById('visibilityWarning');
      if (warn) warn.style.display = 'none';
    }

    async function saveSettings() {
      var btBtn = document.getElementById("saveSettingsBtn");
      var naicsBtn = document.getElementById("saveNaicsBtn");
      var currencyBtn = document.getElementById("saveCurrencyBtn");
      var status = document.getElementById("settingsStatus");
      var naicsStatus = document.getElementById("naicsStatus");
      var currencyStatus = document.getElementById("currencyStatus");
      var bt = document.getElementById("businessTypeSelect").value;
      var naics = document.getElementById("naicsInput").value.trim();
      var currency = document.getElementById("currencySelect") ? document.getElementById("currencySelect").value : "";
      // Disable whichever button exists
      if (btBtn) { btBtn.disabled = true; btBtn.textContent = "Saving…"; }
      if (naicsBtn) { naicsBtn.disabled = true; naicsBtn.textContent = "Saving…"; }
      if (currencyBtn) { currencyBtn.disabled = true; currencyBtn.textContent = "Saving…"; }
      try {
        var res = await fetch("/auth/save-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: { business_type: bt, naics_code: naics, currency: currency } })
        });
        var data = await res.json();
        if (data.success) {
          orgSettings.business_type = bt;
          orgSettings.naics_code = naics;
          orgSettings.currency = currency;
          document.getElementById("overviewBusinessType").textContent = bt || "Not set";
          document.getElementById("onboardingBtLabel").textContent = bt || "not set";
          if (status) { status.textContent = "Settings saved."; status.style.color = "var(--success, #16a34a)"; }
          if (naicsStatus) { naicsStatus.textContent = "Settings saved."; naicsStatus.style.color = "var(--success, #16a34a)"; }
          if (currencyStatus) { currencyStatus.textContent = "Settings saved."; currencyStatus.style.color = "var(--success, #16a34a)"; }
          clearSettingsDirty();
          // If business type changed, re-evaluate step visibility defaults
          if (bt && (!stepVisibility._manualOverride || !stepVisibility._btApplied)) {
            applyBusinessTypeDefaults();
            renderStepToggles();
          }
        } else {
          if (status) { status.textContent = "Failed: " + (data.error || "Unknown error"); status.style.color = "var(--error)"; }
          if (naicsStatus) { naicsStatus.textContent = "Failed: " + (data.error || "Unknown error"); naicsStatus.style.color = "var(--error)"; }
          if (currencyStatus) { currencyStatus.textContent = "Failed: " + (data.error || "Unknown error"); currencyStatus.style.color = "var(--error)"; }
        }
      } catch (e) {
        console.error("Settings save error:", e.message); reportError("saveSettings", e);
        if (status) { status.textContent = "Failed to save settings."; status.style.color = "var(--error)"; }
        if (naicsStatus) { naicsStatus.textContent = "Failed to save settings."; naicsStatus.style.color = "var(--error)"; }
        if (currencyStatus) { currencyStatus.textContent = "Failed to save settings."; currencyStatus.style.color = "var(--error)"; }
      }
      if (btBtn) { btBtn.disabled = false; btBtn.textContent = "Save"; }
      if (naicsBtn) { naicsBtn.disabled = false; naicsBtn.textContent = "Save"; }
      if (currencyBtn) { currencyBtn.disabled = false; currencyBtn.textContent = "Save"; }
      setTimeout(function() {
        if (status) status.textContent = "";
        if (naicsStatus) naicsStatus.textContent = "";
        if (currencyStatus) currencyStatus.textContent = "";
      }, 3000);
    }

    function onNaicsChange() {
      markSettingsDirty();
    }

    function onCurrencyChange() {
      markSettingsDirty();
    }

    function applyBusinessTypeDefaults() {
      if (!stepVisibility || typeof stepVisibility !== 'object') stepVisibility = {};
      var bt = document.getElementById("businessTypeSelect").value;
      if (bt && BUSINESS_TYPE_DEFAULTS[bt]) {
        var defaults = BUSINESS_TYPE_DEFAULTS[bt];
        for (var key in defaults) {
          if (!stepVisibility._manualOverrides || !stepVisibility._manualOverrides[key]) {
            stepVisibility[key] = defaults[key];
          }
        }
      }
    }

    function onBusinessTypeChange() {
      var bt = document.getElementById("businessTypeSelect").value;
      if (bt && BUSINESS_TYPE_DEFAULTS[bt]) {
        var defaults = BUSINESS_TYPE_DEFAULTS[bt];
        for (var key in defaults) {
          stepVisibility[key] = defaults[key];
        }
        stepVisibility._manualOverrides = {};
      }
      markSettingsDirty();
      renderStepToggles();
    }

    /* ===== STEP TOGGLE RENDERING ===== */
    function renderStepToggles() {
      if (!stepVisibility || typeof stepVisibility !== 'object') stepVisibility = {};
      var container = document.getElementById("stepToggleList");
      container.innerHTML = STEP_DEFS.map(function(step) {
        var isVisible = stepVisibility[step.key] !== false; // default true
        var checked = isVisible ? "checked" : "";
        var disabled = step.locked ? "disabled" : "";
        var lockedLabel = step.locked ? '<span class="step-toggle-locked">(always on)</span>' : "";
        return '<div class="step-toggle-row">' +
          '<div>' +
            '<div class="step-toggle-name">' + step.label + ' ' + lockedLabel + '</div>' +
            '<div class="step-toggle-desc">' + step.desc + '</div>' +
          '</div>' +
          '<label class="toggle-switch">' +
            '<input type="checkbox" ' + checked + ' ' + disabled + ' onchange="onToggleChange(\'' + step.key + '\', this.checked)" data-step="' + step.key + '">' +
            '<span class="toggle-slider"></span>' +
          '</label>' +
        '</div>';
      }).join("");
    }

    function onToggleChange(stepKey, checked) {
      if (!stepVisibility || typeof stepVisibility !== 'object') stepVisibility = {};
      stepVisibility[stepKey] = checked;
      if (!stepVisibility._manualOverrides) stepVisibility._manualOverrides = {};
      stepVisibility._manualOverrides[stepKey] = true;
      markVisibilityDirty();
    }

    async function saveStepVisibility() {
      var status = document.getElementById("visibilityStatus");
      if (!stepVisibility || typeof stepVisibility !== 'object') stepVisibility = {};
      try {
        var res = await fetch("/auth/save-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: { step_visibility: stepVisibility } })
        });
        var data = await res.json();
        if (data.success) {
          status.textContent = "Visibility saved.";
          status.style.color = "var(--success, #16a34a)";
          clearVisibilityDirty();
        } else {
          status.textContent = "Failed: " + (data.error || "Unknown error");
          status.style.color = "var(--error)";
        }
      } catch (e) {
        console.error("Visibility save error:", e.message); reportError("saveVisibility", e);
        status.textContent = "Failed to save visibility.";
        status.style.color = "var(--error)";
      }
      setTimeout(function() { status.textContent = ""; }, 3000);
    }

    /* ===== KEY PERSONNEL ===== */
    async function loadKeyPersonnel() {
      var customerId = localStorage.getItem("driven_customer_id");
      if (!customerId) {
        document.getElementById("kpListBody").innerHTML = '<div class="kp-loading">No organization found.</div>';
        return;
      }
      try {
        var res = await fetch("/api/onboarding/key-personnel/list?customerId=" + encodeURIComponent(customerId));
        var data = await res.json();
        if (data.success && data.keyPersonnel) {
          keyPersonnel = data.keyPersonnel;
          renderKeyPersonnel();
        } else {
          document.getElementById("kpListBody").innerHTML = '<div class="kp-loading">No key personnel assigned yet.</div>';
        }
      } catch (e) {
        console.error("KP load error:", e.message); reportError("loadKeyPersonnel", e);
        document.getElementById("kpListBody").innerHTML = '<div class="kp-loading">Failed to load key personnel.</div>';
      }
    }

    function renderKeyPersonnel() {
      var all = keyPersonnel.concat(pendingKP);
      if (all.length === 0) {
        document.getElementById("kpListBody").innerHTML = '<div class="kp-loading">No key personnel assigned yet.</div>';
        document.getElementById("kpCompleteBtn").style.display = "none";
        return;
      }
      document.getElementById("kpListBody").innerHTML = all.map(function(kp, idx) {
        var tasks = kp.roles ? kp.roles.map(function(r) { return r.role; }) : (kp.task ? [kp.task] : []);
        var email = esc(kp.email || "");
        var name = esc(kp.name || "Unknown");
        var isPending = kp._pending;
        var taskChips = tasks.map(function(t) {
          var escT = esc(t);
          var removeTaskAction = isPending
            ? 'removePendingKPTask(' + idx + ', \'' + escT.replace(/'/g, "\\'") + '\')'
            : 'revokeKPTask(\'' + esc(kp.employeeId || kp.id || kp.email).replace(/'/g, "\\'") + '\', \'' + escT.replace(/'/g, "\\'") + '\')';
          return '<span class="kp-task-chip">' + escT + ' <button title="Remove this task" onclick="' + removeTaskAction + '">×</button></span>';
        }).join("");
        var removeAllAction = isPending
          ? 'removePendingKP(' + idx + ')'
          : 'revokeKP(\'' + esc(kp.employeeId || kp.id || kp.email).replace(/'/g, "\\'") + '\')';
        return '<div class="kp-person-row">' +
          '<div class="kp-person-info">' +
            '<div class="kp-person-name">' + name + (isPending ? ' <span style="font-size:11px;color:var(--text-muted);">(pending)</span>' : '') + '</div>' +
            '<div class="kp-person-email">' + email + '</div>' +
            '<div class="kp-person-tasks">' + taskChips + '</div>' +
          '</div>' +
          '<div class="kp-person-actions">' +
            '<button class="kp-person-remove" onclick="' + removeAllAction + '">Remove All</button>' +
          '</div>' +
        '</div>';
      }).join("");
      document.getElementById("kpCompleteBtn").style.display = (keyPersonnel.length + pendingKP.length) > 0 ? "inline-block" : "none";
    }

    function addKeyPersonnel() {
      var name = document.getElementById("kpName").value.trim();
      var email = document.getElementById("kpEmail").value.trim();
      var task = document.getElementById("kpTask").value;
      if (!name || !email || !task) {
        alert("Please fill in name, email, and assign a task.");
        return;
      }
      var emailLower = email.toLowerCase();
      // If this person already exists as a pending KP, add the task to their existing record
      var existing = pendingKP.find(function(kp) { return kp.email.toLowerCase() === emailLower; });
      if (existing) {
        if (!existing.roles) existing.roles = [];
        if (!existing.roles.some(function(r) { return r.role === task; })) {
          existing.roles.push({ role: task });
        } else {
          alert(task + " is already assigned to this person.");
          return;
        }
      } else {
        pendingKP.push({ name: name, email: email, task: task, roles: [{ role: task }], _pending: true });
      }
      document.getElementById("kpName").value = "";
      document.getElementById("kpEmail").value = "";
      document.getElementById("kpTask").value = "";
      renderKeyPersonnel();
    }

    function removePendingKPTask(idx, taskName) {
      var kp = pendingKP[idx];
      if (!kp) return;
      if (kp.roles) {
        kp.roles = kp.roles.filter(function(r) { return r.role !== taskName; });
        if (kp.roles.length === 0) {
          pendingKP.splice(idx, 1);
        }
      } else {
        pendingKP.splice(idx, 1);
      }
      renderKeyPersonnel();
    }

    function removePendingKP(idx) {
      pendingKP.splice(idx, 1);
      renderKeyPersonnel();
    }

    // Normalize id comparison (API returns numeric ids; onclick passes strings)
    function kpIdMatches(kp, id) {
      var kpId = kp.employeeId || kp.id || kp.email;
      return String(kpId) === String(id);
    }

    async function revokeKPTask(employeeId, taskName) {
      if (!confirm('Remove the task "' + taskName + '" from this key personnel?')) return;
      var customerId = localStorage.getItem("driven_customer_id");
      try {
        var res = await fetch("/api/onboarding/key-personnel/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: customerId, employeeId: employeeId, roles: [taskName] })
        });
        var data = await res.json();
        if (data.success) {
          var kp = keyPersonnel.find(function(k) { return kpIdMatches(k, employeeId); });
          if (kp && kp.roles) {
            kp.roles = kp.roles.filter(function(r) { return r.role !== taskName; });
            if (kp.roles.length === 0) {
              keyPersonnel = keyPersonnel.filter(function(k) { return !kpIdMatches(k, employeeId); });
            }
          }
          renderKeyPersonnel();
        } else {
          alert("Failed: " + (data.error || "Unknown error"));
        }
      } catch (e) {
        console.error("Revoke task error:", e.message); reportError("revokeTask", e);
        alert("Failed to remove task.");
      }
    }

    async function revokeKP(employeeId) {
      if (!confirm("Remove this key personnel and all their task assignments?")) return;
      var customerId = localStorage.getItem("driven_customer_id");
      try {
        var res = await fetch("/api/onboarding/key-personnel/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: customerId, employeeId: employeeId, revokeAll: true })
        });
        var data = await res.json();
        if (data.success) {
          keyPersonnel = keyPersonnel.filter(function(kp) { return !kpIdMatches(kp, employeeId); });
          renderKeyPersonnel();
        } else {
          alert("Failed: " + (data.error || "Unknown error"));
        }
      } catch (e) {
        console.error("Revoke error:", e.message); reportError("revokeKeyPersonnel", e);
        alert("Failed to remove key personnel.");
      }
    }

    async function completeKeyPersonnel() {
      var btn = document.getElementById("kpCompleteBtn");
      btn.disabled = true;
      btn.textContent = "Creating accounts…";
      var customerId = localStorage.getItem("driven_customer_id");
      var adminUser = window.dashUser || {};
      // Group pending KP by email — one entry per person with all their tasks
      var grouped = {};
      pendingKP.forEach(function(kp) {
        var key = kp.email.toLowerCase();
        if (!grouped[key]) {
          grouped[key] = { name: kp.name, email: kp.email, tasks: [] };
        }
        if (kp.roles) {
          kp.roles.forEach(function(r) {
            if (grouped[key].tasks.indexOf(r.role) === -1) grouped[key].tasks.push(r.role);
          });
        } else if (kp.task && grouped[key].tasks.indexOf(kp.task) === -1) {
          grouped[key].tasks.push(kp.task);
        }
      });
      var kpPayload = Object.keys(grouped).map(function(key) {
        var g = grouped[key];
        return { firstName: g.name.split(" ")[0], lastName: g.name.split(" ").slice(1).join(" "), email: g.email, tasks: g.tasks };
      });
      try {
        var res = await fetch("/api/onboarding/key-personnel/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: customerId,
            adminName: adminUser.first_name || adminUser.email || "Admin",
            adminEmail: adminUser.email || "",
            keyPersonnel: kpPayload
          })
        });
        var data = await res.json();
        if (data.success) {
          pendingKP = [];
          await loadKeyPersonnel();
          btn.textContent = "Send Invitations & Create Accounts";
          btn.disabled = false;
          alert("Accounts created successfully!\n\nKey Personnel accounts have been created but are INACTIVE. Invitation emails will NOT be sent until you click \"Finalize Onboarding\" after all tasks are 100% complete.\n\nThis prevents employees from logging in before your company's information is fully set up.");
        } else {
          alert("Failed: " + (data.error || "Unknown error"));
          btn.textContent = "Send Invitations & Create Accounts";
          btn.disabled = false;
        }
      } catch (e) {
        console.error("Complete KP error:", e.message); reportError("completeKeyPersonnel", e);
        alert("Failed to create accounts.");
        btn.textContent = "Send Invitations & Create Accounts";
        btn.disabled = false;
      }
    }

    /* ===== ONBOARDING PROGRESS + COMPLETE ===== */
    // Auto-detect completion from localStorage data (same logic as onboarding dashboard)
    function adminAutoDetect(stepKey) {
      switch (stepKey) {
        case "roles-permissions":
          return false; // Must be manually marked complete
        case "employees":
          return parseInt(localStorage.getItem("driven_employee_count") || "0") > 0 ||
                 localStorage.getItem("driven_step3_complete") === "true";
        case "locations":
          return parseInt(localStorage.getItem("driven_location_count") || "0") > 0;
        case "clients":
          return parseInt(localStorage.getItem("driven_client_count") || "0") > 0 ||
                 localStorage.getItem("driven_step4_complete") === "true";
        case "divisions":
          return parseInt(localStorage.getItem("driven_division_count") || "0") > 0 ||
                 localStorage.getItem("driven_step5_complete") === "true";
        case "project-types":
          return parseInt(localStorage.getItem("driven_project_type_count") || "0") > 0 ||
                 localStorage.getItem("driven_step6_complete") === "true";
        case "projects":
          // Only mark complete if the step was explicitly completed
          // Don't auto-complete based on localStorage counts (they may be stale from testing)
          return localStorage.getItem("driven_step7_complete") === "true";
        case "fuel-types":
          return parseInt(localStorage.getItem("driven_fuel_type_count") || "0") > 0 ||
                 localStorage.getItem("driven_step8_complete") === "true";
        case "units-of-measure":
          return parseInt(localStorage.getItem("driven_unit_count") || "0") > 0 ||
                 localStorage.getItem("driven_step9_complete") === "true";
        case "assets":
          // Only mark complete if the step was explicitly completed
          // Don't auto-complete based on localStorage counts (they may be stale from testing)
          return localStorage.getItem("driven_step10_complete") === "true";
        default:
          return false;
      }
    }

    // Check if a task is fully complete (auto-detected data OR all assigned KPs clicked Complete)
    function adminIsTaskComplete(stepKey) {
      // Auto-detected data counts as complete
      if (adminAutoDetect(stepKey)) return true;

      // Check per-KP completions from localStorage (driven_task_completions)
      var taskCompletions = {};
      try { taskCompletions = JSON.parse(localStorage.getItem("driven_task_completions") || "{}"); } catch(e) {}

      // Find the task label for this step key
      var stepDef = STEP_DEFS.find(function(s) { return s.key === stepKey; });
      if (!stepDef) return false;
      var taskLabel = stepDef.label;

      // Get emails of KPs assigned to this task
      var assignedEmails = [];
      keyPersonnel.forEach(function(kp) {
        var tasks = kp.roles ? kp.roles.map(function(r) { return r.role; }) : (kp.task ? [kp.task] : []);
        if (tasks.indexOf(taskLabel) !== -1 && kp.email) {
          assignedEmails.push(kp.email.toLowerCase());
        }
      });
      pendingKP.forEach(function(kp) {
        var tasks = kp.roles ? kp.roles.map(function(r) { return r.role; }) : (kp.task ? [kp.task] : []);
        if (tasks.indexOf(taskLabel) !== -1 && kp.email) {
          assignedEmails.push(kp.email.toLowerCase());
        }
      });

      var completions = taskCompletions[taskLabel] || [];
      if (assignedEmails.length === 0) {
        // No KP assigned — admin-only task; check if anyone clicked Complete
        return completions.length > 0;
      }
      // All assigned KPs must have clicked Complete
      for (var i = 0; i < assignedEmails.length; i++) {
        if (completions.indexOf(assignedEmails[i]) === -1) return false;
      }
      return true;
    }

    function updateProgress() {
      var visibleSteps = STEP_DEFS.filter(function(s) { return stepVisibility[s.key] !== false; });
      // Count tasks as complete based on auto-detected data + KP completions
      var completed = 0;
      visibleSteps.forEach(function(s) {
        if (adminIsTaskComplete(s.key)) completed++;
      });
      var total = visibleSteps.length;
      var pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      document.getElementById("progressBarFill").style.width = pct + "%";
      document.getElementById("progressText").textContent = completed + " of " + total + " tasks complete";
      // Show mark complete button when all steps are done (placeholder logic)
      if (completed >= total && total > 0) {
        document.getElementById("markCompleteBtn").classList.add("show");
      } else {
        document.getElementById("markCompleteBtn").classList.remove("show");
      }
      // Show reopen button if onboarding is complete
      if (onboardingComplete) {
        document.getElementById("reopenOnboardingBtn").style.display = "inline-block";
      }
      // Show the 100% complete panel when ALL visible tasks are done
      // (this is the "Key Personnel have closed all onboarding tasks" message)
      var completePanel = document.getElementById("onboardingCompletePanel");
      if (completePanel) {
        if (total > 0 && completed >= total && !onboardingComplete) {
          completePanel.classList.add("show");
        } else {
          completePanel.classList.remove("show");
        }
      }
    }

    function showCompleteModal() {
      document.getElementById("confirmModal").classList.add("active");
    }
    function closeCompleteModal() {
      document.getElementById("confirmModal").classList.remove("active");
    }

    async function markOnboardingComplete() {
      closeCompleteModal();
      try {
        await fetch("/auth/save-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: { onboarding_complete: true } })
        });
        onboardingComplete = true;
        hideOnboardingTab();
        switchTab("overview");
      } catch (e) {
        console.error("Mark complete error:", e.message); reportError("markOnboardingComplete", e);
        alert("Failed to mark onboarding complete.");
      }
    }

    function hideOnboardingTab() {
      var onboardingTab = document.querySelector('[data-tab="onboarding"]');
      if (onboardingTab) onboardingTab.style.display = "none";
    }

    // Finalize onboarding: removes all KP assignments so employees can
    // access their role-based dashboards. Future data entry happens in
    // department dashboards, not the Onboarding Dashboard.
    async function finalizeOnboarding() {
      var btn = document.getElementById("finalizeOnboardingBtn");
      if (!confirm("Finalize onboarding?\n\nThis will:\n1. Activate all Key Personnel accounts and send invitation emails\n2. Remove all Key Personnel onboarding assignments\n3. Unlock role-based dashboards for your employees\n\nAfter finalizing, future additions are managed by departments through their own dashboards.\n\nClick OK to finalize, or Cancel to keep onboarding open.")) return;
      btn.disabled = true;
      btn.textContent = "Finalizing…";
      var customerId = localStorage.getItem("driven_customer_id");
      try {
        // 1) Send invite emails + activate all pending KP accounts
        var inviteRes = await fetch("/api/onboarding/key-personnel/send-invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: customerId })
        });
        var inviteData = await inviteRes.json();
        if (!inviteData.success) {
          console.error("Send invites failed:", inviteData.error);
          // Continue anyway — accounts may already be active
        }

        // 2) Remove all KP assignments (revoke all)
        var revokeRes = await fetch("/api/onboarding/key-personnel/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: customerId, revokeAll: true })
        });
        var revokeData = await revokeRes.json();
        if (!revokeData.success) {
          alert("Failed to remove Key Personnel assignments: " + (revokeData.error || "Unknown error"));
          btn.disabled = false;
          btn.textContent = "Finalize Onboarding & Unlock Dashboards";
          return;
        }
        // 3) Mark onboarding complete
        var completeRes = await fetch("/auth/save-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: { onboarding_complete: true } })
        });
        var completeData = await completeRes.json();
        if (!completeData.success) {
          alert("Failed to mark onboarding complete: " + (completeData.error || "Unknown error"));
          btn.disabled = false;
          btn.textContent = "Finalize Onboarding & Unlock Dashboards";
          return;
        }
        // 4) Update UI
        onboardingComplete = true;
        keyPersonnel = [];
        pendingKP = [];
        var panel = document.getElementById("onboardingCompletePanel");
        if (panel) panel.classList.remove("show");
        document.getElementById("reopenOnboardingBtn").style.display = "inline-block";
        hideOnboardingTab();
        switchTab("overview");
        alert("Onboarding finalized!\n\nInvitation emails have been sent to all Key Personnel. Their accounts are now active and they can log in.\n\nKey Personnel assignments have been removed. Your employees can now access their role-based dashboards.");
      } catch (e) {
        console.error("Finalize onboarding error:", e.message); reportError("finalizeOnboarding", e);
        alert("Failed to finalize onboarding.");
        btn.disabled = false;
        btn.textContent = "Finalize Onboarding & Unlock Dashboards";
      }
    }

    async function reopenOnboarding() {
      var btn = document.getElementById("reopenOnboardingBtn");
      if (btn) { btn.disabled = true; btn.textContent = "Reopening…"; }
      try {
        await fetch("/auth/save-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: { onboarding_complete: false } })
        });
        onboardingComplete = false;
        var onboardingTab = document.querySelector('[data-tab="onboarding"]');
        if (onboardingTab) onboardingTab.style.display = "";
        document.getElementById("reopenOnboardingBtn").style.display = "none";
        switchTab("onboarding");
      } catch (e) {
        console.error("Reopen error:", e.message); reportError("reopenOnboarding", e);
        alert("Failed to reopen onboarding.");
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Reopen Onboarding"; }
      }
    }

    /* ===== UNSAVED-CHANGES — PAGE LEAVE / LOGOUT GUARD ===== */
    // Warn when the admin tries to close/refresh the page with unsaved changes
    window.addEventListener("beforeunload", function(e) {
      if (visibilityDirty || settingsDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    // Override dashLogout (from dashboard-common.js) to warn about unsaved changes
    window.dashLogout = function() {
      if (visibilityDirty || settingsDirty) {
        var proceed = confirm("You have unsaved changes.\n\nClick Cancel to go back and save, or OK to leave without saving.");
        if (!proceed) return;
      }
      // Proceed with the original logout behavior
      try {
        fetch("/auth/logout", { method: "POST" });
      } catch (e) {
        console.error("Logout error:", e.message);
      }
      window.location.href = "/public/login.html";
    };

    /* ===== STICKY TABS (move tab bar + subtab bars inside shared header) ===== */
    function makeTabsSticky() {
      var header = document.getElementById("dashHeader");
      var tabBar = document.getElementById("adminTabBar");
      if (header && tabBar && !header.contains(tabBar)) {
        header.appendChild(tabBar);
      }
      // Move subtab bars into the header too (right after the main tab bar) so they stick
      var settingsSubtabBar = document.getElementById("settingsSubtabBar");
      var onboardingSubtabBar = document.getElementById("onboardingSubtabBar");
      if (header && settingsSubtabBar && !header.contains(settingsSubtabBar)) {
        header.appendChild(settingsSubtabBar);
      }
      if (header && onboardingSubtabBar && !header.contains(onboardingSubtabBar)) {
        header.appendChild(onboardingSubtabBar);
      }
    }

    /* ===== INSERT HEADER TITLE ===== */
    function insertHeaderTitle() {
      var row1 = document.querySelector(".dash-header-row1");
      if (row1 && !document.querySelector(".admin-header-title")) {
        var title = document.createElement("div");
        title.className = "admin-header-title";
        title.textContent = "Admin Dashboard";
        // Insert between logo area and driven logo
        var logoArea = document.getElementById("dashCustomerLogoArea");
        var drivenLogo = row1.querySelector(".dash-driven-logo");
        if (logoArea && drivenLogo) {
          row1.insertBefore(title, drivenLogo);
        }
      }
    }

    /* ===== INIT ===== */
    async function init() {
      // Wait for shared dashboard-common.js to load session
      document.addEventListener("dashSessionLoaded", async function() {
        var user = window.dashUser;
        if (!user) {
          window.location.href = "/public/login.html";
          return;
        }

        // Greeting — include the company name
        var firstName = user.first_name || user.email;
        var orgName = user.org_name || localStorage.getItem("driven_org_name") || "";
        var welcomeEl = document.getElementById("welcome-name");
        if (welcomeEl) {
          welcomeEl.textContent = orgName ? (firstName + " — " + orgName) : firstName;
}
document.getElementById("account-name").textContent = user.first_name ? (user.first_name + " " + (user.last_name || "")) : user.email;
        var emailEl = document.getElementById("account-email");
        if (emailEl) emailEl.textContent = user.email || "";

        // Insert title and make tabs sticky
        insertHeaderTitle();
        makeTabsSticky();

        // Load logo
        await loadLogo();

        // Load settings
        await loadSettings();

        // Load key personnel
        await loadKeyPersonnel();

        // Update progress
        updateProgress();

        // Theme switch
        updateThemeSwitch();

        // Render forms tab
        renderFormsTab();

        // Show dashboard
        document.getElementById("loading").style.display = "none";
        document.getElementById("dashboard").style.display = "block";

        // Stats — fetch real counts from the API
        loadDashboardStats();
      });
    }

    init();

// ============================================================
// ANALYTICS TAB — Cross-module metrics, charts, CSV export
// ============================================================

var analyticsDateRange = 'all';

function initAnalytics() {
  var refreshBtn = document.getElementById('btnAnalyticsRefresh');
  if (refreshBtn) refreshBtn.addEventListener('click', loadAnalytics);
  var dateSelect = document.getElementById('analyticsDateRange');
  if (dateSelect) {
    dateSelect.addEventListener('change', function() {
      analyticsDateRange = this.value;
      loadAnalytics();
    });
  }
  var btnAssets = document.getElementById('btnAnalyticsExportAssets');
  if (btnAssets) btnAssets.addEventListener('click', function() { exportCSV('assets'); });
  var btnFuel = document.getElementById('btnAnalyticsExportFuel');
  if (btnFuel) btnFuel.addEventListener('click', function() { exportCSV('fuel'); });
  loadAnalytics();
}

function getAnalyticsCutoff() {
  if (analyticsDateRange === 'all') return null;
  var days = parseInt(analyticsDateRange, 10);
  return new Date(Date.now() - days * 86400000).toISOString();
}

function getRangeLabel() {
  var sel = document.getElementById('analyticsDateRange');
  if (!sel) return 'all';
  var txt = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : 'all';
  if (txt === 'All time') return 'all';
  if (txt === 'Last 30 days') return '30d';
  if (txt === 'Last 90 days') return '90d';
  if (txt === 'Last 12 months') return '12mo';
  return 'all';
}

async function loadAnalytics() {
  try {
    var results = await Promise.all([
      fetch('/api/assets', { credentials: 'include' }).then(function(r) { return r.json(); }).catch(function() { return { records: [] }; }),
      fetch('/api/fuel_transactions', { credentials: 'include' }).then(function(r) { return r.json(); }).catch(function() { return { records: [] }; }),
      fetch('/api/projects', { credentials: 'include' }).then(function(r) { return r.json(); }).catch(function() { return { records: [] }; }),
      fetch('/api/employees', { credentials: 'include' }).then(function(r) { return r.json(); }).catch(function() { return { records: [] }; }),
    ]);
    var assetsRes = results[0], fuelRes = results[1], projectsRes = results[2], employeesRes = results[3];

    var assets = assetsRes.records || assetsRes.data || [];
    var fuel = fuelRes.records || fuelRes.data || [];
    var projects = projectsRes.records || projectsRes.data || [];
    var employees = employeesRes.records || employeesRes.data || [];

    var cutoff = getAnalyticsCutoff();
    var rLabel = getRangeLabel();

    var inspLabel = document.getElementById('kpiInspectionsLabel');
    if (inspLabel) inspLabel.textContent = 'Inspections (' + rLabel + ')';
    var fuelLabel = document.getElementById('kpiFuelCostLabel');
    if (fuelLabel) fuelLabel.textContent = 'Fuel Cost (' + rLabel + ')';

    document.getElementById('kpiTotalAssets').textContent = assets.length;
    document.getElementById('kpiActiveWO').textContent = 'N/A';

    var recentInspections = assets.filter(function(a) {
      if (!a.last_inspection_date) return false;
      if (!cutoff) return true;
      return a.last_inspection_date >= cutoff;
    }).length;
    document.getElementById('kpiInspections').textContent = recentInspections;

    var fuelCost = 0;
    var fuelGal = 0;
    fuel.forEach(function(f) {
      if (cutoff && f.transaction_date && f.transaction_date < cutoff) return;
      var qty = parseFloat(f.quantity) || 0;
      fuelGal += qty;
      var rt = parseFloat(f.receipt_total);
      var cpg = parseFloat(f.cost_per_gallon);
      if (!isNaN(rt) && rt > 0) {
        fuelCost += rt;
      } else if (!isNaN(cpg) && cpg > 0) {
        fuelCost += (qty * cpg);
      }
    });
    if (fuelCost > 0) {
      document.getElementById('kpiFuelCost').textContent = '$' + fuelCost.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } else {
      document.getElementById('kpiFuelCost').textContent = fuelGal.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' gal';
    }

    var activeProjects = projects.filter(function(p) {
      var s = String(p.status || '').toLowerCase();
      return s === 'in progress' || s === 'awarded';
    }).length;
    document.getElementById('kpiProjects').textContent = activeProjects;
    document.getElementById('kpiEmployees').textContent = employees.length;

    var assetStatuses = {};
    assets.forEach(function(a) {
      var s = String(a.status || 'unknown').toLowerCase();
      assetStatuses[s] = (assetStatuses[s] || 0) + 1;
    });
    renderBarChart('chartWOStatus', assetStatuses, {
      'active': '#16a34a', 'inactive': '#64748b', 'in_repair': '#f59e0b',
      'in repair': '#f59e0b', 'retired': '#ef4444', 'unknown': '#94a3b8'
    });

    var assetTypes = {};
    assets.forEach(function(a) {
      var t = a.asset_type || a.type || 'Unknown';
      assetTypes[t] = (assetTypes[t] || 0) + 1;
    });
    renderBarChart('chartAssetTypes', assetTypes, {});

    var recentAssets = assets.slice(0, 10);
    var tbody = document.getElementById('analyticsRecentWOBody');
    if (recentAssets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-muted);">No assets found</td></tr>';
    } else {
      tbody.innerHTML = recentAssets.map(function(a) {
        return '<tr style="border-bottom:1px solid var(--border);cursor:pointer;" onclick="analyticsViewAsset(\'' + String(a.id || '').replace(/'/g, "\\'") + '\')">' +
          '<td style="padding:6px 10px;">' + esc(a.asset_number || a.id || '') + '</td>' +
          '<td style="padding:6px 10px;">' + esc(a.name || '') + '</td>' +
          '<td style="padding:6px 10px;"><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:' + statusColor(a.status) + ';color:#fff;">' + esc(a.status || '') + '</span></td>' +
          '<td style="padding:6px 10px;">' + esc(a.asset_type || '') + '</td>' +
          '<td style="padding:6px 10px;">' + esc(a.current_location || a.location_name_resolved || '') + '</td>' +
          '<td style="padding:6px 10px;">' + esc((a.created_at || '').substring(0, 10)) + '</td>' +
          '</tr>';
      }).join('');
    }
  } catch (e) {
    console.error('[Analytics] Error:', e.message);
  }
}

function analyticsViewAsset(assetId) {
  fetch('/api/assets?id=' + encodeURIComponent(assetId), { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var records = data.records || data.data || [];
      var a = records.find(function(r) { return r.id === assetId; }) || records[0];
      if (!a) { alert('Asset not found'); return; }

      var modal = document.getElementById('analyticsAssetModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'analyticsAssetModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.style.display = 'none'; });
        document.body.appendChild(modal);
      }

      var fields = [
        ['Asset Number', a.asset_number || '\u2014'],
        ['Name', a.name || '\u2014'],
        ['Type', a.asset_type || '\u2014'],
        ['Make', a.make || '\u2014'],
        ['Model', a.model || '\u2014'],
        ['Year', a.year || '\u2014'],
        ['Status', a.status || '\u2014'],
        ['Serial Number', a.serial_number || '\u2014'],
        ['Location', a.current_location || a.location_name_resolved || '\u2014'],
        ['Assigned To', a.assigned_operator_name || '\u2014'],
        ['Created', (a.created_at || '').substring(0, 10) || '\u2014'],
      ];

      var html = '<div style="background:var(--bg-card,#fff);border:2px solid #16a34a;border-radius:12px;padding:24px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
          '<h3 style="margin:0;font-size:18px;">Asset Details</h3>' +
          '<button onclick="document.getElementById(\'analyticsAssetModal\').style.display=\'none\'" style="border:none;background:none;font-size:24px;cursor:pointer;color:var(--text-muted);">&times;</button>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
        fields.map(function(f) {
          return '<tr style="border-bottom:1px solid var(--border,#e2e8f0);">' +
            '<td style="padding:8px 12px;font-weight:600;color:var(--text-muted);width:140px;">' + f[0] + '</td>' +
            '<td style="padding:8px 12px;">' + esc(f[1]) + '</td>' +
          '</tr>';
        }).join('') +
        '</table>' +
        '<div style="margin-top:16px;text-align:right;">' +
          '<a href="/app/dashboard/asset-management.html" style="display:inline-block;padding:8px 16px;background:#0284c7;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;">Go to Asset Management &rarr;</a>' +
        '</div>' +
      '</div>';

      modal.innerHTML = html;
      modal.style.display = 'flex';
    })
    .catch(function(e) { alert('Error loading asset: ' + e.message); });
}

function statusColor(status) {
  var s = String(status || '').toLowerCase();
  var colors = { 'active': '#16a34a', 'inactive': '#64748b', 'in_repair': '#f59e0b', 'in repair': '#f59e0b', 'retired': '#ef4444', 'open': '#3b82f6', 'assigned': '#8b5cf6', 'in_progress': '#f59e0b', 'completed': '#16a34a', 'cancelled': '#ef4444', 'on_hold': '#64748b' };
  return colors[s] || '#94a3b8';
}

function renderBarChart(containerId, data, colorMap) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var entries = Object.entries(data).sort(function(a, b) { return b[1] - a[1]; });
  if (entries.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">No data</div>';
    return;
  }
  var maxVal = Math.max.apply(null, entries.map(function(e) { return e[1]; }));
  container.innerHTML = entries.map(function(entry) {
    var label = entry[0];
    var value = entry[1];
    var pct = maxVal > 0 ? Math.round((value / maxVal) * 100) : 0;
    var color = colorMap[label] || '#0284c7';
    return '<div style="display:flex;align-items:center;gap:8px;">' +
      '<div style="width:200px;font-size:12px;text-transform:capitalize;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + esc(label) + '">' + esc(label) + '</div>' +
      '<div style="flex:1;background:var(--bg-step,#f1f5f9);border-radius:4px;height:22px;position:relative;overflow:hidden;">' +
        '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px;transition:width 300ms ease;"></div>' +
        '<span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:12px;font-weight:600;color:var(--text);">' + value + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function exportCSV(type) {
  try {
    var url, filename, columns;
    if (type === 'assets') {
      url = '/api/assets';
      filename = 'driv-en-assets.csv';
      columns = ['asset_number', 'name', 'asset_type', 'make', 'model', 'year', 'status', 'current_location', 'assigned_operator_id'];
    } else if (type === 'fuel') {
      url = '/api/fuel_transactions?limit=1000';
      filename = 'driv-en-fuel.csv';
      columns = ['transaction_date', 'transaction_type', 'fuel_type', 'quantity', 'cost_per_gallon', 'receipt_total', 'vendor', 'asset_id', 'project_id', 'location'];
    } else {
      return;
    }

    var resp = await fetch(url, { credentials: 'include' });
    var data = await resp.json();
    var rows = data.records || data.data || [];
    if (!Array.isArray(rows)) rows = [];

    var header = columns.join(',');
    var lines = [header];
    rows.forEach(function(row) {
      var vals = columns.map(function(col) {
        var v = row[col];
        if (v == null) v = '';
        v = String(v).replace(/"/g, '""');
        if (v.indexOf(',') !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1) v = '"' + v + '"';
        return v;
      });
      lines.push(vals.join(','));
    });

    var csv = lines.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (e) {
    console.error('[Analytics Export] Error:', e.message);
    alert('Export failed: ' + e.message);
  }
}
