/**
 * DRIV-EN | Master Asset Profile (v1)
 * File: /app/asset/asset-detail.js
 * Extracted from asset-detail.html for CSP compliance.
 *
 * Fixes applied during extraction:
 *   - All select.innerHTML replaced with clearChildren + addOption (DOM-safe).
 *   - loadOpenInspectionIssues: tb.innerHTML replaced with DOM-safe row building.
 *   - All onclick/onsubmit-referenced functions exposed on window.
 */

var currentAssetId = null;
var activeOrgId = null;
var canEditAssets = false;
var isEditMode = false;
var isBootstrapped = false;

// Truth vs Working Copy Separation to prevent state mutation bugs
var originalAssetRecord = null;
var workingAssetRecord = {};

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

// Helper function to build Request Headers with full fallback credentials
function getAuthHeaders(additionalHeaders) {
    var headers = Object.assign({
        "Content-Type": "application/json",
        "x-org-id": activeOrgId || ""
    }, additionalHeaders || {});

    var token = localStorage.getItem("driven_token") || localStorage.getItem("auth_token") || sessionStorage.getItem("driven_token");
    if (token) {
        headers["Authorization"] = "Bearer " + token;
    }

    var user = window.dashUser || window.drivenUser;
    if (user && user.id) {
        headers["x-user-id"] = user.id;
    }

    return headers;
}

// Storage Listener to sync theme toggles in real-time across tabs/headers
window.addEventListener('storage', function(e) {
    if (e.key === 'driven-theme' && e.newValue) {
        document.documentElement.setAttribute("data-theme", e.newValue);
    }
});

// Header Height Adjustment Logic matching asset-management.html
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

// URL Query Parameter Parsing
var urlParams = new URLSearchParams(window.location.search);
currentAssetId = urlParams.get('id') || urlParams.get('asset_id');

// Extract normalized array helper across all worker payload variants
function extractRecords(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
    return data.employees || data.personnel || data.key_personnel || data.records || data.assetTypes || data.projects || data.divisions || data.locations || data.users || data.data || data.results || [];
}

// Helper to resolve org_id with comprehensive fallbacks
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

// Strict Multi-Tenant Execution Guardrail & Boot
async function initAssetDetail(e) {
    if (isBootstrapped) return;

    var u = (e && e.detail) ? e.detail : (window.dashUser || window.drivenUser);
    
    // Multi-Tenant Isolation Verification
    activeOrgId = resolveActiveOrgId(u);

    if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "") {
        var errMsg = "Invalid multi-tenant session context. Execution halted to prevent data leaks.";
        if (window.DRIVENErrorHandler) {
            window.DRIVENErrorHandler.report(
                "asset-detail.html: " + errMsg,
                "tenant-security-guardrail",
                new Error().stack
            );
        }
        displayMessage(errMsg, "error");
        document.querySelector(".ad-main").style.opacity = "0.3";
        return;
    }

    isBootstrapped = true;
    document.querySelector(".ad-main").style.opacity = "1";

    // Role Permission Check: Admin or Authorized Asset Manager
    var rpRoleId = u ? (u.role_id || u.role || "") : "";
    var rpIsAdmin = (rpRoleId === "RO-admin" || rpRoleId === "RO-Founder" || (u && u.is_admin === true));
    canEditAssets = rpIsAdmin || (u && u.permissions && u.permissions.can_edit_assets === true);

    if (canEditAssets) {
        var btnToggle = document.getElementById("btnToggleEdit");
        if (btnToggle) btnToggle.style.display = "inline-flex";
    }

    // Fix Header Layout & Adjust Height Offset
    var ha = 0, hi = setInterval(function() {
        ha++;
        if (fixHeaderLayout() || ha > 50) {
            clearInterval(hi);
            updateHeaderOffset();
        }
    }, 100);

    // Configure sub-navigation links with asset context
    if (currentAssetId) {
        document.getElementById("lnkConfig").href = "/app/dashboard/asset-config.html?id=" + encodeURIComponent(currentAssetId);
        document.getElementById("lnkHistory").href = "/app/asset/asset-history.html?id=" + encodeURIComponent(currentAssetId);
        document.getElementById("lnkQuickEditConfig").href = "/app/dashboard/asset-config.html?id=" + encodeURIComponent(currentAssetId);
    }

    // Load relational dropdowns in parallel
    await Promise.all([
        loadAssetTypesDropdown(),
        loadProjectsDropdown(),
        loadDivisionsDropdown(),
        loadLocationsDropdown(),
        loadOperatorsDropdown()
    ]);

    // Initialize active co-worker presence
    checkActivePresence();
    setInterval(checkActivePresence, 5000);

    if (currentAssetId) {
        await loadAssetDetails(currentAssetId);
        await loadOpenInspectionIssues(currentAssetId);
    } else {
        displayMessage("No Asset ID specified in navigation request.", "error");
    }

    updateHeaderOffset();
}

document.addEventListener("dashSessionLoaded", initAssetDetail);

// Fallback initialization check if event already fired prior to listener attachment
if (window.dashUser || window.drivenUser) {
    initAssetDetail();
}

function displayMessage(msg, type) {
    var el = document.getElementById("adMessage");
    if (!el) return;
    el.textContent = msg;
    el.className = "ad-message " + type;
    el.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function reportClientError(msg, context, err) {
    if (window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report("asset-detail.html: " + msg, context, err ? err.stack : null);
    }
}

// Dropdown Loaders
async function loadAssetTypesDropdown() {
    try {
        var resp = await fetch("/api/asset-types", { headers: getAuthHeaders() });
        if (resp.ok) {
            var data = await resp.json();
            var list = extractRecords(data);
            var sel = document.getElementById("inpCategory");
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

async function loadProjectsDropdown() {
    try {
        var resp = await fetch("/api/projects", { headers: getAuthHeaders() });
        if (resp.ok) {
            var data = await resp.json();
            var list = extractRecords(data);
            var sel = document.getElementById("inpProject");
            clearChildren(sel);
            addOption(sel, "", "-- Unassigned / Yard --", true);
            list.forEach(function(item) {
                var prjId = item.id;
                var prjNum = item.project_number || item.code || "";
                var prjName = item.name || item.project_name || "";

                var displayText = prjNum && prjName ? (prjNum + " — " + prjName) : (prjNum || prjName);

                if (displayText && prjId) {
                    var opt = addOption(sel, prjId, displayText);
                    opt.setAttribute("data-project-number", prjNum);
                    opt.setAttribute("data-project-name", prjName);
                }
            });
        }
    } catch (e) {
        reportClientError("Failed loading projects", "loadProjectsDropdown", e);
    }
}

async function loadDivisionsDropdown() {
    try {
        var resp = await fetch("/api/division", { headers: getAuthHeaders() });
        if (resp.ok) {
            var data = await resp.json();
            var list = extractRecords(data);
            var sel = document.getElementById("inpDivision");
            clearChildren(sel);
            addOption(sel, "", "-- Select Division --", true);
            list.forEach(function(item) {
                var name = item.division_name || item.name;
                var id = item.id || name;
                if (name) {
                    addOption(sel, id, name);
                }
            });
        }
    } catch (e) {
        reportClientError("Failed loading divisions", "loadDivisionsDropdown", e);
    }
}

async function loadLocationsDropdown() {
    var endpoints = ["/api/locations", "/api/location"];
    var list = [];
    for (var i = 0; i < endpoints.length; i++) {
        try {
            var resp = await fetch(endpoints[i], { headers: getAuthHeaders() });
            if (resp.ok) {
                var data = await resp.json();
                list = extractRecords(data);
                if (list.length > 0) break;
            }
        } catch (e) {}
    }
    var sel = document.getElementById("inpLocation");
    clearChildren(sel);
    addOption(sel, "", "-- Select Location / Site --", true);
    list.forEach(function(item) {
        var name = item.location_name || item.name || item.site_name || item.location;
        var id = item.id || name;
        if (name) {
            addOption(sel, id, name);
        }
    });
}

async function loadOperatorsDropdown() {
    var endpoints = ["/api/onboarding/key-personnel/list", "/api/users"];
    var list = [];

    for (var i = 0; i < endpoints.length; i++) {
        try {
            var resp = await fetch(endpoints[i], { headers: getAuthHeaders() });
            if (resp.ok) {
                var data = await resp.json();
                var records = extractRecords(data);
                if (records && records.length > 0) {
                    list = records;
                    break;
                }
            }
        } catch (e) {}
    }

    var sel = document.getElementById("inpOperator");
    clearChildren(sel);
    addOption(sel, "", "-- Unassigned --", true);

    list.forEach(function(item) {
        var st = (item.status || item.employment_status || "").toLowerCase();
        var isActiveBool = item.is_active !== undefined ? Boolean(item.is_active) : (item.active !== undefined ? Boolean(item.active) : true);

        if (st !== "inactive" && isActiveBool !== false) {
            var firstName = item.firstName || item.first_name || "";
            var lastName = item.lastName || item.last_name || "";
            var name = (firstName + " " + lastName).trim() || item.fullName || item.full_name || item.name || item.user_name || item.email;
            var id = item.id || item.user_id || item.empNumber || item.emp_number || name;

            if (name) {
                addOption(sel, id, name);
            }
        }
    });
}

// Helper: Matches raw value or human name against select options and updates UI
function matchDropdownValue(selectId, rawVal, fallbackName) {
    var sel = document.getElementById(selectId);
    if (!sel) return fallbackName || "—";

    var searchTarget = (rawVal || fallbackName || "").toString().trim().toLowerCase();
    if (!searchTarget || searchTarget === "—" || searchTarget === "unassigned") {
        sel.value = "";
        return fallbackName || "—";
    }

    // 1. Try direct option value match
    for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value.toString().trim().toLowerCase() === searchTarget) {
            sel.value = sel.options[i].value;
            return sel.options[i].text;
        }
    }

    // 2. Try option text match if rawVal was a display name
    for (var j = 0; j < sel.options.length; j++) {
        if (sel.options[j].text.toString().trim().toLowerCase() === searchTarget) {
            sel.value = sel.options[j].value;
            return sel.options[j].text;
        }
    }

    sel.value = "";
    return fallbackName || rawVal || "—";
}

// High-Frequency Co-Worker Polling & Fast Beacon Unload
function sendPresenceUnload() {
    if (!activeOrgId) return;
    var payload = JSON.stringify({ page: "Asset Detail", action: "leave" });
    if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/onboarding/presence", blob);
    } else {
        fetch("/api/onboarding/presence", {
            method: "POST",
            headers: getAuthHeaders(),
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
            headers: getAuthHeaders(),
            body: JSON.stringify({ page: "Asset Detail" })
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

// Fetch Master Asset Record
async function loadAssetDetails(assetId) {
    try {
        var resp = await fetch("/api/equipment/" + encodeURIComponent(assetId), {
            headers: getAuthHeaders()
        });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        
        var data = await resp.json();
        originalAssetRecord = JSON.parse(JSON.stringify(data.record || data.equipment || data));
        workingAssetRecord = Object.assign({}, originalAssetRecord);

        renderAssetData(workingAssetRecord);

    } catch (e) {
        reportClientError("Failed loading asset profile details", "loadAssetDetails", e);
        displayMessage("Unable to retrieve asset profile records.", "error");
    }
}

// Render Values into View Spans and Form Inputs
function renderAssetData(rec) {
    if (!rec) return;

    var num = rec.asset_number || rec.assetNumber || "Asset #" + currentAssetId;
    document.getElementById("txtAssetNumber").textContent = num;
    document.getElementById("valAssetNumber").textContent = num;
    document.getElementById("inpAssetNumber").value = num;

    // Asset Type / Category
    var catName = matchDropdownValue("inpCategory", rec.asset_type || rec.type || rec.category, rec.asset_type || rec.category);
    document.getElementById("valCategory").textContent = catName;

    // Operational Status
    var st = rec.status || "Available";
    document.getElementById("valStatus").textContent = st;
    document.getElementById("inpStatus").value = st;

    // Make & Model
    var makeVal = rec.make_oem || rec.make || "";
    document.getElementById("valMake").textContent = makeVal || "—";
    document.getElementById("inpMake").value = makeVal;

    var modelVal = rec.model || "";
    document.getElementById("valModel").textContent = modelVal || "—";
    document.getElementById("inpModel").value = modelVal;

    // Serial / VIN (Checking serial column variants)
    var sn = rec.serial_number || rec.serial || rec.serialNumber || rec.serial_no || "—";
    document.getElementById("valSerial").textContent = sn;
    document.getElementById("inpSerial").value = sn !== "—" ? sn : "";

    // Meter (Preserve null vs 0 accurately)
    var mtrVal = (rec.current_meter_reading !== undefined && rec.current_meter_reading !== null)
        ? rec.current_meter_reading 
        : (rec.current_meter !== undefined && rec.current_meter !== null ? rec.current_meter : "");
    document.getElementById("valMeter").textContent = mtrVal !== "" ? mtrVal + " hrs" : "—";
    document.getElementById("inpMeter").value = mtrVal;

    // Current Project Number (Foreign key match against ID or fallback string)
    var prjValue = rec.project_id || rec.current_project || rec.project;
    var prjName = matchDropdownValue("inpProject", prjValue, rec.current_project || rec.project_number || rec.project_name || rec.project);
    
    var prjSelect = document.getElementById("inpProject");
    var selectedOpt = prjSelect.options[prjSelect.selectedIndex];
    if (selectedOpt && selectedOpt.value) {
        var pNum = selectedOpt.getAttribute("data-project-number");
        var pName = selectedOpt.getAttribute("data-project-name");
        document.getElementById("valProject").textContent = pNum ? (pNum + " (" + pName + ")") : prjName;
    } else {
        document.getElementById("valProject").textContent = prjName || "—";
    }

    // Division
    var divName = matchDropdownValue("inpDivision", rec.assigned_division || rec.division_id || rec.division, rec.division_name || rec.division);
    document.getElementById("valDivision").textContent = divName;

    // Location
    var locName = matchDropdownValue("inpLocation", rec.location_id || rec.current_location || rec.location, rec.location_name || rec.location);
    document.getElementById("valLocation").textContent = locName;

    // Operator
    var opName = matchDropdownValue("inpOperator", rec.assigned_operator || rec.operator_id || rec.operator, rec.operator_name);
    document.getElementById("valOperator").textContent = opName;

    // Drive Configuration
    var drv = rec.drive_configuration || "Standard";
    document.getElementById("valDriveConfig").textContent = drv;
    document.getElementById("inpDriveConfig").value = drv;
}

// Toggle Between View Mode and Edit Mode
function toggleEditMode() {
    if (!canEditAssets) return;
    isEditMode = !isEditMode;

    // Dynamically query all metric boxes to prevent out-of-sync DOM issues
    var metricBoxes = document.querySelectorAll(".ad-metric-box");
    metricBoxes.forEach(function(box) {
        var valEl = box.querySelector(".ad-metric-value");
        var inpEl = box.querySelector(".ad-input");
        if (valEl && inpEl) {
            valEl.style.display = isEditMode ? "none" : "block";
            inpEl.style.display = isEditMode ? "block" : "none";
        }
    });

    var btnToggle = document.getElementById("btnToggleEdit");
    var saveBar = document.getElementById("saveBar");

    if (isEditMode) {
        if (btnToggle) {
            btnToggle.textContent = "🔒 Cancel Editing";
            btnToggle.style.background = "#64748b";
        }
        if (saveBar) saveBar.style.display = "flex";
    } else {
        if (btnToggle) {
            btnToggle.textContent = "✏️ Edit Profile";
            btnToggle.style.background = "#2563eb";
        }
        if (saveBar) saveBar.style.display = "none";

        // Revert to original server record on cancel
        workingAssetRecord = JSON.parse(JSON.stringify(originalAssetRecord || {}));
        renderAssetData(workingAssetRecord);
    }
}

// Save Profile Updates to API
async function saveAssetDetails(e) {
    e.preventDefault();
    if (!currentAssetId || !activeOrgId) return;

    var btn = document.getElementById("btnSaveAsset");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ Saving...";
    }

    var meterRaw = document.getElementById("inpMeter").value;
    var parsedMeter = meterRaw === "" ? null : parseFloat(meterRaw);
    var serialVal = document.getElementById("inpSerial").value.trim();
    var locSelect = document.getElementById("inpLocation");
    var catVal = document.getElementById("inpCategory").value;
    var prjSelect = document.getElementById("inpProject");
    var divSelect = document.getElementById("inpDivision");
    var opVal = document.getElementById("inpOperator").value;

    var selectedPrjOpt = prjSelect.options[prjSelect.selectedIndex];
    var selectedLocOpt = locSelect.options[locSelect.selectedIndex];
    var selectedDivOpt = divSelect.options[divSelect.selectedIndex];

    var prjIdVal = prjSelect.value ? prjSelect.value : null;
    var prjNameVal = (selectedPrjOpt && selectedPrjOpt.value) ? selectedPrjOpt.textContent.trim() : null;

    var locIdVal = locSelect.value ? locSelect.value : null;
    var locNameVal = (selectedLocOpt && selectedLocOpt.value) ? selectedLocOpt.textContent.trim() : null;

    var divVal = divSelect.value ? divSelect.value : null;
    var divNameVal = (selectedDivOpt && selectedDivOpt.value) ? selectedDivOpt.textContent.trim() : null;

    // Strict Schema-Aligned Payload matching Cloudflare D1 `assets` table
    var payload = {
        id: currentAssetId,
        asset_number: document.getElementById("inpAssetNumber").value.trim(),
        asset_type: catVal,
        type: catVal,
        status: document.getElementById("inpStatus").value,
        make_oem: document.getElementById("inpMake").value.trim(),
        model: document.getElementById("inpModel").value.trim(),
        serial_number: serialVal,
        current_meter_reading: isNaN(parsedMeter) ? null : parsedMeter,
        project_id: prjIdVal,
        current_project: prjNameVal,
        project_name: prjNameVal,
        assigned_division: divVal ? divVal : null,
        division_name: divNameVal,
        current_location: locNameVal,
        location_id: locIdVal,
        location_name: locNameVal,
        assigned_operator: opVal ? opVal : null,
        drive_configuration: document.getElementById("inpDriveConfig").value.trim()
    };

    try {
        // Primary PUT endpoint
        var resp = await fetch("/api/equipment/" + encodeURIComponent(currentAssetId), {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        // Fallback to POST if PUT is not allowed or fails with 405/404
        if (!resp.ok && (resp.status === 405 || resp.status === 404)) {
            resp = await fetch("/api/equipment/" + encodeURIComponent(currentAssetId), {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
        }

        if (!resp.ok) {
            var errData = {};
            try { errData = await resp.json(); } catch(e) {}
            var errDetails = errData.message || errData.error || ("HTTP " + resp.status);
            throw new Error(errDetails);
        }

        // Commit working payload to immutable server record
        originalAssetRecord = JSON.parse(JSON.stringify(Object.assign({}, workingAssetRecord, payload)));
        workingAssetRecord = Object.assign({}, originalAssetRecord);

        renderAssetData(workingAssetRecord);
        toggleEditMode(); // Exit edit mode
        displayMessage("Asset profile updated successfully!", "success");

    } catch (err) {
        reportClientError("Failed updating asset profile", "saveAssetDetails", err);
        displayMessage("Failed to save changes: " + (err.message || "Please try again."), "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "💾 Save Changes";
        }
    }
}

// Dynamic Query for Open Inspection Issues & Flags
async function loadOpenInspectionIssues(assetId) {
    try {
        var resp = await fetch("/api/equipment/" + encodeURIComponent(assetId) + "/open-issues", {
            headers: getAuthHeaders()
        });

        if (resp.ok) {
            var data = await resp.json();
            var issues = extractRecords(data);
            
            if (issues.length > 0) {
                var banner = document.getElementById("bannerOpenIssues");
                if (banner) banner.style.display = "block";
                var tb = document.getElementById("tbOpenIssues");
                if (tb) {
                    clearChildren(tb);
                    issues.forEach(function(iss) {
                        var tr = document.createElement("tr");

                        var td1 = document.createElement("td");
                        td1.textContent = iss.created_at ? new Date(iss.created_at).toLocaleDateString() : "—";
                        tr.appendChild(td1);

                        var td2 = document.createElement("td");
                        var strong = document.createElement("strong");
                        strong.style.color = "#eab308";
                        strong.textContent = "⚠️ Inspection Flag";
                        td2.appendChild(strong);
                        tr.appendChild(td2);

                        var td3 = document.createElement("td");
                        td3.textContent = iss.description || iss.issue_details || "Defect logged during inspection";
                        tr.appendChild(td3);

                        var td4 = document.createElement("td");
                        var span = document.createElement("span");
                        span.style.cssText = "background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; font-weight:600; font-size:12px;";
                        span.textContent = "OPEN";
                        td4.appendChild(span);
                        tr.appendChild(td4);

                        tb.appendChild(tr);
                    });
                }
            }
        }
    } catch (e) {
        reportClientError("Failed loading open inspection flags", "loadOpenInspectionIssues", e);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function confirmLogout() {
    if (confirm("Are you sure you want to log out?")) {
        dashLogout();
    }
}

// ===== EXPOSE FUNCTIONS FOR INLINE ONCLICK/ONSUBMIT HANDLERS =====
window.toggleEditMode = toggleEditMode;
window.saveAssetDetails = saveAssetDetails;
window.confirmLogout = confirmLogout;
