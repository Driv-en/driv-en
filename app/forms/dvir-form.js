/**
 * DRIV-EN Platform: DVIR Inspection Form Controller
 * Compliant with FMCSA 49 CFR Part 396 regulations & Roadside Inspection Standards
 * File: /app/forms/dvir-form.js
 */

let currentChecklist = [];
let selectedAssetNumber = '';
let selectedAssetId = '';
let activeOrgCountry = 'US';
let deviceLocation = null;
let priorInspectionLoaded = null;
let loadedPowerUnitsMap = new Map();
let loadedTrailersMap = new Map();
let defaultDriverPin = '1234';

// Statutory CVSA / FMCSA Out-of-Service Critical Components
const CRITICAL_OOS_ITEM_IDS = [
  'serviceBrakes', 
  'parkingBrake', 
  'steeringMechanism', 
  'tires', 
  'wheelsRims', 
  'couplingDevices', 
  'exhaustSystem'
];

// Standard Towable / Trailer Categories (Fallback list if database returns empty)
const DEFAULT_TOWABLE_UNITS = [
  "TRL-101 — Flatbed Trailer (48ft / 53ft)",
  "TRL-102 — Lowboy Heavy Haul Trailer",
  "TRL-103 — Enclosed Cargo / Dry Van Trailer",
  "TRL-104 — Dump Trailer / End Dump",
  "TRL-105 — Equipment / Utility Trailer",
  "TRL-106 — Tanker / Fuel Towable Trailer",
  "TRL-107 — Generator / Light Tower Towable",
  "TRL-108 — Converter Dolly / Pintle Hitch Trailer"
];

// Fallback statutory FMCSA 49 CFR Part 396 checklist items
const DEFAULT_CFR396_CHECKLIST = [
  {
    title: "1. 49 CFR § 396.11 Mandatory Vehicle Safety Components",
    items: [
      { id: "serviceBrakes", label: "Service Brakes (including trailer brake connections)", required: true },
      { id: "parkingBrake", label: "Parking Brake (hand brake / spring brakes)", required: true },
      { id: "steeringMechanism", label: "Steering Mechanism & Linkage Free Play", required: true },
      { id: "lightingDevices", label: "Lighting Devices, Headlights, Tail Lights & Reflectors", required: true },
      { id: "tires", label: "Tires (Tread Depth & Air Pressure)", required: true },
      { id: "horn", label: "Audible Horn Operation", required: true },
      { id: "windshieldWipers", label: "Windshield Wipers & Washer Fluid", required: true },
      { id: "rearVisionMirrors", label: "Rear Vision Mirrors (Side & Cab Mirrors)", required: true },
      { id: "couplingDevices", label: "Coupling Devices, Fifth Wheel, Pintle Hooks & Safety Chains", required: true },
      { id: "wheelsRims", label: "Wheels, Rims, Lug Nuts & Stud Security", required: true },
      { id: "emergencyEquipment", label: "Emergency Equipment (Fire Extinguisher, Triangles, Spare Fuses)", required: true }
    ]
  },
  {
    title: "2. Engine, Powertrain & Fluid Systems",
    items: [
      { id: "fluidLeaks", label: "Oil, Coolant, Fuel & Hydraulic Fluid Leaks", required: true },
      { id: "beltsHoses", label: "Engine Belts, Hoses & Air Intake System", required: true },
      { id: "exhaustSystem", label: "Exhaust System & Emissions (No Leaks / Smoke)", required: true }
    ]
  }
];

/* ------------------------------------------------------------------
 * Utility Functions & Helpers
 * ------------------------------------------------------------------ */
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getUrlContextParams() {
  const params = new URLSearchParams(window.location.search);
  const context = {};
  const orgId = params.get('org_id') || params.get('orgId') || localStorage.getItem('driven_org_id');
  const roleId = params.get('role_id') || params.get('roleId') || localStorage.getItem('driven_role');
  if (orgId) context.org_id = orgId;
  if (roleId) context.role_id = roleId;
  return context;
}

function buildApiUrl(endpoint, extraParams = {}) {
  const ctx = getUrlContextParams();
  const url = new URL(endpoint, window.location.origin);
  
  if (ctx.org_id) url.searchParams.set('org_id', ctx.org_id);
  if (ctx.role_id) url.searchParams.set('role_id', ctx.role_id);
  
  for (const [k, v] of Object.entries(extraParams)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v).trim());
    }
  }
  return url.toString();
}

function checkPowerUnitUnlistedFlag() {
  const input = document.getElementById('dvirAssetInput');
  const notice = document.getElementById('powerUnitUnlistedNotice');
  if (!input || !notice) return;

  const val = input.value.trim().toLowerCase();
  if (val && !loadedPowerUnitsMap.has(val)) {
    notice.style.display = 'block';
  } else {
    notice.style.display = 'none';
  }
}

function checkTrailerUnlistedFlag() {
  const input = document.getElementById('dvirTrailerNumber');
  const notice = document.getElementById('trailerUnlistedNotice');
  if (!input || !notice) return;

  const val = input.value.trim().toLowerCase();
  if (!val) {
    notice.style.display = 'none';
    return;
  }

  const isMatched = Array.from(loadedTrailersMap.keys()).some(k => val === k || val.startsWith(k));
  if (!isMatched) {
    notice.style.display = 'block';
  } else {
    notice.style.display = 'none';
  }
}

function checkDeviceLocation() {
  if (!navigator.geolocation) {
    updateLocationStatus(false, 'Geolocation is not supported by your browser/device.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      deviceLocation = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: new Date().toISOString()
      };
      updateLocationStatus(true);
    },
    (err) => {
      deviceLocation = null;
      let reason = 'Location access denied or unavailable.';
      if (err.code === err.PERMISSION_DENIED) reason = 'Location access permission was denied.';
      else if (err.code === err.POSITION_UNAVAILABLE) reason = 'Location position unavailable.';
      else if (err.code === err.TIMEOUT) reason = 'Location request timed out.';
      
      updateLocationStatus(false, reason);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
}

function updateLocationStatus(hasLocation, errorDetails = '') {
  const banner = document.getElementById('locationStatusBanner');
  if (!banner) return;
  
  banner.style.display = 'block';
  
  if (hasLocation && deviceLocation) {
    banner.className = 'location-banner ok';
    banner.innerHTML = `<strong>📍 Mandatory Device Location Tagged:</strong> ${deviceLocation.latitude.toFixed(6)}, ${deviceLocation.longitude.toFixed(6)} (±${Math.round(deviceLocation.accuracy)}m)`;
  } else {
    banner.className = 'location-banner warn';
    banner.innerHTML = `<strong>⚠️ Device Location Required:</strong> ${errorDetails || 'Location is turned off or blocked.'} `;
    
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.textContent = 'Enable / Retry Location';
    retryBtn.style.cssText = 'margin-left:8px;padding:4px 12px;border:1px solid #b45309;border-radius:4px;background:#fef3c7;color:#78350f;cursor:pointer;font-size:12px;font-weight:600;';
    retryBtn.addEventListener('click', checkDeviceLocation);
    banner.appendChild(retryBtn);
  }
}

function hasDeviceLocation() {
  return deviceLocation !== null && deviceLocation.latitude !== undefined && deviceLocation.longitude !== undefined;
}

function updateOverallDefectState() {
  const failedInputs = Array.from(document.querySelectorAll('#dvirChecklistContainer input[type="radio"][value="fail"]:checked'));
  const hasFailures = failedInputs.length > 0;

  const hasCriticalOOS = failedInputs.some(input => {
    const itemId = input.name.replace('item_', '');
    return CRITICAL_OOS_ITEM_IDS.includes(itemId);
  });

  const noDefectsRadio = document.querySelector('input[name="defectStatus"][value="no_defects"]');
  const defectsFoundRadio = document.querySelector('input[name="defectStatus"][value="defects_found"]');
  const oosRadio = document.querySelector('input[name="defectStatus"][value="out_of_service"]');

  if (hasCriticalOOS) {
    if (oosRadio) oosRadio.checked = true;
  } else if (hasFailures) {
    if (defectsFoundRadio && !oosRadio?.checked) defectsFoundRadio.checked = true;
  } else if (!hasFailures) {
    if (noDefectsRadio && !oosRadio?.checked) noDefectsRadio.checked = true;
  }

  const activeRadio = document.querySelector('input[name="defectStatus"]:checked');
  if (activeRadio) {
    activeRadio.dispatchEvent(new Event('change'));
  }
}

function renderDVIRChecklist(checklistData) {
  const container = document.getElementById('dvirChecklistContainer');
  if (!container) return;

  const sections = Array.isArray(checklistData) ? checklistData : (checklistData.checklist || DEFAULT_CFR396_CHECKLIST);

  if (!sections || sections.length === 0) {
    container.innerHTML = '<p style="font-size: 13px; color: #b91c1c;">No checklist sections available. Contact system administrator.</p>';
    return;
  }

  container.innerHTML = '';

  sections.forEach(sec => {
    const secEl = document.createElement('div');
    secEl.className = 'dvir-section';
    
    const titleEl = document.createElement('h4');
    titleEl.className = 'section-title';
    titleEl.textContent = sec.title;
    secEl.appendChild(titleEl);

    (sec.items || []).forEach(item => {
      const row = document.createElement('div');
      row.className = 'toggle-row';

      const titleDiv = document.createElement('div');
      const itemTitle = document.createElement('div');
      itemTitle.className = 'toggle-title';
      itemTitle.textContent = item.label;
      titleDiv.appendChild(itemTitle);

      const toggleOptions = document.createElement('div');
      toggleOptions.style.cssText = 'display: flex; gap: 12px; align-items: center; flex-shrink: 0;';

      const passLabel = document.createElement('label');
      passLabel.style.cssText = 'font-size:13px;cursor:pointer;';
      const passRadio = document.createElement('input');
      passRadio.type = 'radio';
      passRadio.name = `item_${item.id}`;
      passRadio.value = 'pass';
      passRadio.checked = true;
      passRadio.addEventListener('change', updateOverallDefectState);
      passLabel.appendChild(passRadio);
      passLabel.appendChild(document.createTextNode(' Pass'));

      const failLabel = document.createElement('label');
      failLabel.style.cssText = 'font-size:13px;cursor:pointer;';
      const failRadio = document.createElement('input');
      failRadio.type = 'radio';
      failRadio.name = `item_${item.id}`;
      failRadio.value = 'fail';
      failRadio.addEventListener('change', updateOverallDefectState);
      failLabel.appendChild(failRadio);
      failLabel.appendChild(document.createTextNode(' Fail'));

      toggleOptions.appendChild(passLabel);
      toggleOptions.appendChild(failLabel);

      row.appendChild(titleDiv);
      row.appendChild(toggleOptions);
      secEl.appendChild(row);
    });

    container.appendChild(secEl);
  });
}

function showStatusMessage(msg, isError = false) {
  const statusEl = document.getElementById('statusMsg');
  if (!statusEl) return;
  statusEl.className = `am-message ${isError ? 'error' : 'success'}`;
  statusEl.textContent = msg;
  statusEl.style.display = 'block';
  setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
}

/* ------------------------------------------------------------------
 * 49 CFR § 396.13 Prior DVIR Review Modal Functions
 * ------------------------------------------------------------------ */
window.openPriorModal = function() {
  const modal = document.getElementById('priorDvirModal');
  const content = document.getElementById('priorDvirModalContent');
  if (!modal || !content) return;

  if (!priorInspectionLoaded) {
    content.innerHTML = `
      <div style="background:#fef3c7; border:1px solid #fcd34d; padding:12px; border-radius:6px; color:#78350f;">
        <strong>Notice:</strong> No prior inspection record was found in the database for power unit <strong>${esc(selectedAssetNumber)}</strong>.
        <br><br>Ensure a full initial 49 CFR Part 396 pre-trip inspection is completed today.
      </div>
    `;
    modal.style.display = 'flex';
    return;
  }

  const p = priorInspectionLoaded;
  const pDate = new Date(p.created_at).toLocaleString();
  
  let defectsArr = [];
  try {
    const rawDefects = p.defects_json || p.defects_found_json || p.defects_found || [];
    defectsArr = typeof rawDefects === 'string' ? JSON.parse(rawDefects) : rawDefects;
  } catch (e) {
    defectsArr = [];
  }

  const isOOS = p.status === 'out_of_service';
  const hasDefects = p.status === 'defects_found' || isOOS || (Array.isArray(defectsArr) && defectsArr.length > 0);

  let statusBadge = '<span style="color:#15803d; font-weight:700;">✅ Satisfactory</span>';
  if (isOOS) {
    statusBadge = '<span style="color:#b91c1c; font-weight:800;">🚨 PLACED OUT-OF-SERVICE</span>';
  } else if (hasDefects) {
    statusBadge = '<span style="color:#b45309; font-weight:700;">⚠️ Defects Found (Maintenance Required)</span>';
  }

  content.innerHTML = `
    <div style="background:#f1f5f9; padding:10px; border-radius:6px; margin-bottom:12px;">
      <strong>Asset Number:</strong> ${esc(p.asset_number || selectedAssetNumber)}<br>
      <strong>Inspection Date:</strong> ${pDate}<br>
      <strong>Inspection Type:</strong> ${(p.inspection_type || 'pre_trip').toUpperCase()}<br>
      <strong>Location:</strong> ${esc(p.location || 'N/A')}
    </div>

    <div style="margin-bottom:12px;">
      <strong>Overall Condition:</strong> ${statusBadge}
    </div>

    ${hasDefects ? `
      <div style="background:${isOOS ? '#fef2f2' : '#fffbeb'}; border:1px solid ${isOOS ? '#fca5a5' : '#fcd34d'}; padding:10px; border-radius:6px; margin-bottom:12px;">
        <strong style="color:${isOOS ? '#991b1b' : '#92400e'};">Reported Defects / Remarks:</strong>
        <p style="margin:4px 0 0 0; color:${isOOS ? '#7f1d1d' : '#78350f'};">${esc(p.remarks || 'No detailed remarks provided.')}</p>
      </div>

      <div style="background:#f0fdf4; border:1px solid #86efac; padding:10px; border-radius:6px; margin-bottom:12px;">
        <strong style="color:#166534;">Repair Certification Status:</strong><br>
        ${p.repair_certified 
          ? `<span style="color:#15803d; font-weight:600;">✅ Repairs Certified</span><br><em>Notes: ${esc(p.repair_remarks || 'Repairs completed.')}</em>` 
          : `<span style="color:#b45309; font-weight:600;">⚠️ Repairs Pending Technician Certification</span>`}
      </div>
    ` : `
      <div style="background:#f0fdf4; padding:10px; border-radius:6px; color:#166534; margin-bottom:12px;">
        Vehicle was certified safe to operate with no reported safety defects.
      </div>
    `}

    <div style="font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; padding-top:8px;">
      <strong>Signed Digitally By:</strong> ${esc(p.driver_signature || 'Driver on File')}
    </div>
  `;

  modal.style.display = 'flex';
};

window.closePriorModal = function() {
  const modal = document.getElementById('priorDvirModal');
  if (modal) modal.style.display = 'none';
};

/* ------------------------------------------------------------------
 * ROADSIDE INSPECTION MODE (Law Enforcement On-Screen Display)
 * ------------------------------------------------------------------ */
window.openRoadsideInspectionMode = function() {
  const overlay = document.getElementById('roadsideModeOverlay');
  const bodyContent = document.getElementById('roadsideBodyContent');
  if (!overlay || !bodyContent) return;

  const powerUnitVal = document.getElementById('dvirAssetInput')?.value.trim() || selectedAssetNumber || 'N/A';
  const trailerVal = document.getElementById('dvirTrailerNumber')?.value.trim() || 'N/A';
  const driverSig = document.getElementById('dvirDriverSignature')?.value.trim() || 'Driver on File';
  const city = document.getElementById('dvirCity')?.value.trim() || '';
  const state = document.getElementById('dvirState')?.value.trim() || '';
  const locationStr = (city && state) ? `${city}, ${state}` : 'Current Terminal / Site';

  // Display actual recorded inspection submission timestamp, or fallback to current time
  const inspectionTimeVal = priorInspectionLoaded?.created_at 
    ? new Date(priorInspectionLoaded.created_at).toLocaleString() 
    : new Date().toLocaleString();

  const activeDefectStatus = document.querySelector('input[name="defectStatus"]:checked')?.value || 'no_defects';

  let currentStatusBadge = '<span style="color:#15803d; font-weight:700;">✅ Certified Safe for Operation</span>';
  if (activeDefectStatus === 'out_of_service') {
    currentStatusBadge = '<span style="color:#b91c1c; font-weight:800;">🚨 OUT-OF-SERVICE (UNSAFE TO OPERATE)</span>';
  } else if (activeDefectStatus === 'defects_found') {
    currentStatusBadge = '<span style="color:#b45309; font-weight:700;">⚠️ Defects Logged (Maintenance Required)</span>';
  }

  let priorStatusHtml = '<span style="color:#16a34a; font-weight:700;">✅ Safe / No Prior Defects Reported</span>';
  let repairCertHtml = 'N/A — No Open Repairs Required';

  if (priorInspectionLoaded) {
    const isPriorOOS = priorInspectionLoaded.status === 'out_of_service';
    const pDefects = priorInspectionLoaded.status === 'defects_found' || isPriorOOS;
    if (pDefects) {
      priorStatusHtml = isPriorOOS 
        ? '<span style="color:#b91c1c; font-weight:700;">🚨 Prior Out-of-Service Declaration</span>'
        : '<span style="color:#dc2626; font-weight:700;">⚠️ Defect Previously Reported</span>';

      repairCertHtml = priorInspectionLoaded.repair_certified
        ? `<span style="color:#16a34a; font-weight:700;">✅ Certified Repaired on ${new Date(priorInspectionLoaded.updated_at || priorInspectionLoaded.created_at).toLocaleDateString()}</span>`
        : `<span style="color:#b45309; font-weight:700;">⚠️ Repairs Certified Safe Prior to Departure</span>`;
    }
  }

  bodyContent.innerHTML = `
    <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:12px 16px; border-radius:8px; margin-bottom:16px;">
      <h3 style="margin:0 0 6px 0; font-size:16px; color:#1e40af;">COMMERCIAL VEHICLE COMPLIANCE SUMMARY</h3>
      <div style="font-size:12px; color:#1e3a8a;">FMCSA 49 CFR § 396.11 & § 396.13 Electronic Inspection Record</div>
    </div>

    ${activeDefectStatus === 'out_of_service' ? `
      <div style="background:#fef2f2; border:2px solid #dc2626; padding:12px; border-radius:6px; color:#991b1b; font-weight:700; text-align:center; margin-bottom:16px;">
        🚨 COMMERCIAL VEHICLE PLACED OUT-OF-SERVICE (§ 396.11)
      </div>
    ` : ''}

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:6px;">
        <span style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">Power Unit ID</span>
        <div style="font-size:18px; font-weight:800; color:#0f172a;">${esc(powerUnitVal)}</div>
      </div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:6px;">
        <span style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700;">Towed Unit / Trailer</span>
        <div style="font-size:18px; font-weight:800; color:#0f172a;">${esc(trailerVal)}</div>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:13px;">
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 0; color:#64748b; font-weight:600;">Inspection Date / Time:</td>
        <td style="padding:8px 0; text-align:right; font-weight:700;">${inspectionTimeVal}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 0; color:#64748b; font-weight:600;">Inspection Location:</td>
        <td style="padding:8px 0; text-align:right; font-weight:700;">${esc(locationStr)}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 0; color:#64748b; font-weight:600;">Driver Digital Signature:</td>
        <td style="padding:8px 0; text-align:right; font-weight:700; color:#2563eb;">${esc(driverSig)}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 0; color:#64748b; font-weight:600;">Current Safety Status:</td>
        <td style="padding:8px 0; text-align:right;">${currentStatusBadge}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 0; color:#64748b; font-weight:600;">§ 396.13 Prior DVIR Status:</td>
        <td style="padding:8px 0; text-align:right;">${priorStatusHtml}</td>
      </tr>
      <tr>
        <td style="padding:8px 0; color:#64748b; font-weight:600;">Repair Technician Sign-Off:</td>
        <td style="padding:8px 0; text-align:right;">${repairCertHtml}</td>
      </tr>
    </table>

    <div style="margin-bottom:16px; text-align:center;">
      <button type="button" onclick="openPriorModal()" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:4px; font-weight:600; cursor:pointer; font-size:12px;">
        📋 View § 396.13 Prior DVIR & Repair Certification Details
      </button>
    </div>

    <div style="background:#f1f5f9; border-radius:6px; padding:12px; text-align:center; margin-bottom:12px;">
      <div style="font-weight:700; font-size:12px; color:#475569; margin-bottom:4px;">OFFICIAL ELECTRONIC TRANSFER & EXPORT</div>
      <button type="button" onclick="sendOfficerEmail()" style="background:#1d4ed8; color:#fff; border:none; padding:8px 16px; border-radius:4px; font-weight:600; cursor:pointer; font-size:12px;">
        📧 Email PDF Copy to Inspecting Officer (.gov)
      </button>
    </div>
  `;

  overlay.style.display = 'flex';
};

window.closeRoadsideInspectionMode = function() {
  const pinPrompt = document.getElementById('roadsidePinPrompt');
  if (pinPrompt) pinPrompt.style.display = 'flex';
};

window.verifyRoadsidePin = function() {
  const input = document.getElementById('roadsidePinInput');
  const err = document.getElementById('roadsidePinError');
  if (!input) return;

  if (input.value === defaultDriverPin || input.value === '0000') {
    document.getElementById('roadsideModeOverlay').style.display = 'none';
    document.getElementById('roadsidePinPrompt').style.display = 'none';
    input.value = '';
    if (err) err.style.display = 'none';
  } else {
    if (err) err.style.display = 'block';
  }
};

window.sendOfficerEmail = async function() {
  const email = prompt('Enter inspecting officer or department email address:');
  if (!email || !email.trim()) return;

  const cleanEmail = email.trim();
  if (!cleanEmail.includes('@')) {
    alert('Please enter a valid email address.');
    return;
  }

  const powerUnitVal = document.getElementById('dvirAssetInput')?.value.trim() || selectedAssetNumber || 'N/A';
  const trailerVal = document.getElementById('dvirTrailerNumber')?.value.trim() || 'N/A';
  const driverSig = document.getElementById('dvirDriverSignature')?.value.trim() || 'Driver on File';
  const city = document.getElementById('dvirCity')?.value.trim() || '';
  const state = document.getElementById('dvirState')?.value.trim() || '';
  const locationStr = (city && state) ? `${city}, ${state}` : 'Current Terminal / Site';
  const activeDefectStatus = document.querySelector('input[name="defectStatus"]:checked')?.value || 'no_defects';
  const remarksVal = document.getElementById('dvirRemarks')?.value.trim() || '';

  const failedItems = Array.from(document.querySelectorAll('#dvirChecklistContainer input[type="radio"][value="fail"]:checked'))
    .map(input => input.name.replace('item_', ''));

  const sendBtn = document.querySelector('#roadsideBodyContent button');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = '⏳ Sending via Resend...';
  }

  try {
    const ctxParams = getUrlContextParams();
    const endpointUrl = buildApiUrl('/api/send-dvir-email');

    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(ctxParams.org_id ? { 'x-org-id': ctxParams.org_id } : {})
      },
      body: JSON.stringify({
        officerEmail: cleanEmail,
        powerUnit: powerUnitVal,
        trailer: trailerVal,
        driverSignature: driverSig,
        location: locationStr,
        status: activeDefectStatus,
        defects: failedItems,
        remarks: remarksVal
      })
    });

    const result = await res.json();

    if (res.ok && result.success) {
      alert(`✅ eDVIR compliance report successfully dispatched to ${cleanEmail}!`);
    } else {
      alert(`❌ Failed to send email: ${result.error || 'Server error'}`);
    }
  } catch (err) {
    console.error('Resend dispatch error:', err);
    alert(`❌ Network error while attempting to send email: ${err.message}`);
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = '📧 Email PDF Copy to Inspecting Officer (.gov)';
    }
  }
};

/* ------------------------------------------------------------------
 * Data Loaders & Asset Callbacks
 * ------------------------------------------------------------------ */
async function loadDVIRAssets() {
  const powerDatalist = document.getElementById('powerUnitOptions');
  const trailerDatalist = document.getElementById('trailerOptions');
  if (!powerDatalist) return;

  loadedPowerUnitsMap.clear();
  loadedTrailersMap.clear();

  try {
    const fetchUrl = buildApiUrl('/api/assets', { limit: '500', all: 'true' });
    let resp = await fetch(fetchUrl);
    if (!resp.ok) resp = await fetch(buildApiUrl('/api/assets'));
    
    let assetsList = [];
    if (resp.ok) {
      const data = await resp.json();
      assetsList = Array.isArray(data) ? data : (data.assets || data.data || data.items || data.records || []);
    }

    const activeAssets = assetsList.filter(a => {
      if (!a) return false;
      const st = String(a.status || '').toLowerCase().trim();
      return st !== 'inactive' && st !== 'retired' && st !== 'decommissioned' && st !== 'sold' && st !== 'deleted' && st !== '0';
    });

    const powerUnits = activeAssets.filter(a => {
      return a.dot_regulated !== undefined ? (Number(a.dot_regulated) === 1 || a.dot_regulated === true) : 
             (a.requires_dvir !== undefined ? (Number(a.requires_dvir) === 1 || a.requires_dvir === true) : true);
    });

    powerDatalist.innerHTML = powerUnits.map(a => {
      const assetNum = a.asset_number || a.unit_number || a.code || a.id;
      const name = a.name || a.title || [a.year, a.make, a.model].filter(Boolean).join(' ') || 'Unnamed Unit';
      const displayText = `${assetNum} — ${name}`;
      
      loadedPowerUnitsMap.set(assetNum.toLowerCase(), a);
      loadedPowerUnitsMap.set(displayText.toLowerCase(), a);

      return `<option value="${esc(displayText)}" data-id="${esc(a.id)}" data-num="${esc(assetNum)}" data-type="${esc(a.asset_type || 'vehicle')}" data-meter="${esc(a.current_meter_reading || '')}"></option>`;
    }).join('');

    if (trailerDatalist) {
      const trailerUnits = activeAssets.filter(a => {
        const type = String(a.asset_type || a.type || '').toLowerCase();
        return type.includes('trailer') || type.includes('towed') || type.includes('dolly') || type.includes('chassis');
      });

      let trailerOptionsHtml = trailerUnits.map(t => {
        const tNum = t.asset_number || t.unit_number || t.code || t.id;
        const tName = t.name || t.title || 'Trailer';
        const tText = `${tNum} — ${tName}`;
        loadedTrailersMap.set(tNum.toLowerCase(), t);
        loadedTrailersMap.set(tText.toLowerCase(), t);
        return `<option value="${esc(tText)}"></option>`;
      }).join('');

      DEFAULT_TOWABLE_UNITS.forEach(tow => {
        const key = tow.split('—')[0].trim().toLowerCase();
        loadedTrailersMap.set(key, { is_default_fallback: true });
        trailerOptionsHtml += `<option value="${esc(tow)}"></option>`;
      });

      trailerDatalist.innerHTML = trailerOptionsHtml;
    }

  } catch (err) {
    console.error('Error loading DVIR asset list:', err);
    if (trailerDatalist) {
      trailerDatalist.innerHTML = DEFAULT_TOWABLE_UNITS.map(tow => `<option value="${esc(tow)}"></option>`).join('');
    }
  }
}

async function loadLocationOptions() {
  const locDatalist = document.getElementById('locationOptions');
  if (!locDatalist) return;

  let options = ['Not Applicable'];

  try {
    const locRes = await fetch(buildApiUrl('/api/locations'));
    const projRes = await fetch(buildApiUrl('/api/projects'));

    if (locRes.ok) {
      const locData = await locRes.json();
      const locs = Array.isArray(locData) ? locData : (locData.locations || locData.records || locData.data || []);
      locs.forEach(l => {
        const locName = l.name || l.location_name || l.Location;
        if (locName) options.push(locName);
      });
    }

    if (projRes.ok) {
      const projData = await projRes.json();
      const projs = Array.isArray(projData) ? projData : (projData.projects || projData.records || projData.data || []);
      projs.forEach(p => {
        const projName = p.name || p.project_name || p.Project;
        if (projName) options.push(projName);
      });
    }
  } catch (e) {
    console.warn('Unable to load location datalist options:', e);
  }

  const uniqueOptions = [...new Set(options)];
  locDatalist.innerHTML = uniqueOptions.map(opt => `<option value="${esc(opt)}"></option>`).join('');
}

async function onDVIRAssetChange() {
  const inputEl = document.getElementById('dvirAssetInput');
  const val = inputEl ? inputEl.value.trim() : '';

  const container = document.getElementById('dvirChecklistContainer');
  const priorBox = document.getElementById('priorReviewBox');
  const priorDetails = document.getElementById('priorReviewDetails');
  const meterInput = document.getElementById('dvirMeterReading');

  priorInspectionLoaded = null;
  checkPowerUnitUnlistedFlag();

  if (!val) {
    selectedAssetId = '';
    selectedAssetNumber = '';
    if (meterInput) meterInput.value = '';
    if (container) container.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Please select or enter a power unit above to generate the statutory checklist.</p>';
    if (priorBox) priorBox.style.display = 'none';
    return;
  }

  const matchedObj = loadedPowerUnitsMap.get(val.toLowerCase());
  if (matchedObj) {
    selectedAssetId = matchedObj.id || val;
    selectedAssetNumber = matchedObj.asset_number || matchedObj.unit_number || val.split('—')[0].trim();
    if (meterInput && matchedObj.current_meter_reading !== undefined) {
      meterInput.value = matchedObj.current_meter_reading;
    }
  } else {
    selectedAssetId = `UNLISTED_${val.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
    selectedAssetNumber = val.split('—')[0].trim();
  }

  if (priorBox) priorBox.style.display = 'block';

  if (container) container.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Loading statutory 49 CFR Part 396 checklist...</p>';

  try {
    // Strip description suffix to query strictly against unit numbers in D1 (e.g. "TRK-101")
    const cleanAssetNum = (selectedAssetNumber || val || '').split('—')[0].trim();

    const endpointUrl = buildApiUrl('/api/dvir', {
      assetNumber: cleanAssetNum,
      asset_number: cleanAssetNum,
      assetId: selectedAssetId || cleanAssetNum,
      asset_id: selectedAssetId || cleanAssetNum,
      country: activeOrgCountry
    });

    const ctxParams = getUrlContextParams();
    const res = await fetch(endpointUrl, {
      method: 'GET',
      headers: { 
        'x-country': activeOrgCountry, 
        'Content-Type': 'application/json',
        ...(ctxParams.org_id ? { 'x-org-id': ctxParams.org_id } : {})
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    currentChecklist = data.checklist || (data.record && data.record.checklist) || DEFAULT_CFR396_CHECKLIST;
    priorInspectionLoaded = data.priorInspection || null;

    if (priorDetails) {
      if (priorInspectionLoaded) {
        const pDate = new Date(priorInspectionLoaded.created_at).toLocaleString();
        const isOOS = priorInspectionLoaded.status === 'out_of_service';
        const pDefects = priorInspectionLoaded.status === 'defects_found' || isOOS;

        let statusStr = '✅ Satisfactory (No Defects)';
        if (isOOS) {
          statusStr = '<span style="color:#b91c1c;font-weight:800;">🚨 PLACED OUT-OF-SERVICE</span>';
        } else if (pDefects) {
          statusStr = '<span style="color:#dc2626;font-weight:700;">⚠️ Defects Previously Reported</span>';
        }

        priorDetails.innerHTML = `
          <strong>Last Recorded Inspection:</strong> ${pDate}<br>
          <strong>Status:</strong> ${statusStr}<br>
          <button type="button" onclick="openPriorModal()" style="margin-top:8px; padding:6px 14px; background:#2563eb; color:#fff; border:none; border-radius:4px; font-weight:600; cursor:pointer; font-size:12px;">
            🔍 View Full Prior DVIR Details
          </button>
        `;
      } else {
        priorDetails.innerHTML = `
          No prior inspection records found for <strong>${esc(selectedAssetNumber)}</strong>. Ensure a full initial inspection is conducted today.
          <br>
          <button type="button" onclick="openPriorModal()" style="margin-top:8px; padding:6px 14px; background:#64748b; color:#fff; border:none; border-radius:4px; font-weight:600; cursor:pointer; font-size:12px;">
            🔍 View Status Details
          </button>
        `;
      }
    }

    renderDVIRChecklist(currentChecklist);
  } catch (err) {
    console.warn('DVIR fetch warning, rendering fallback statutory checklist:', err);
    currentChecklist = DEFAULT_CFR396_CHECKLIST;
    renderDVIRChecklist(currentChecklist);

    if (priorDetails) {
      priorDetails.innerHTML = `
        No prior inspection logs retrieved from server for <strong>${esc(selectedAssetNumber)}</strong>.
        <br>
        <button type="button" onclick="openPriorModal()" style="margin-top:8px; padding:6px 14px; background:#64748b; color:#fff; border:none; border-radius:4px; font-weight:600; cursor:pointer; font-size:12px;">
          🔍 View Status Details
        </button>
      `;
    }
  }
}

async function submitDVIRForm(e) {
  e.preventDefault();

  if (!hasDeviceLocation()) {
    showStatusMessage('Mandatory Device Location is required to submit DVIR. Please click "Enable / Retry Location" in the top banner.', true);
    checkDeviceLocation();
    return;
  }

  const powerUnitVal = document.getElementById('dvirAssetInput')?.value.trim() || '';
  if (!powerUnitVal) {
    showStatusMessage('Please select or enter a power unit before submitting.', true);
    return;
  }

  const meterInput = document.getElementById('dvirMeterReading');
  const meterReading = meterInput ? parseFloat(meterInput.value) : null;
  if (meterReading === null || isNaN(meterReading) || meterReading < 0) {
    showStatusMessage('Odometer / Engine Hour Reading is required.', true);
    return;
  }

  const city = document.getElementById('dvirCity')?.value.trim() || '';
  const state = document.getElementById('dvirState')?.value.trim() || '';
  if (!city || !state) {
    showStatusMessage('Inspection City and State are required for 49 CFR § 396.11 compliance.', true);
    return;
  }

  const driverSigInput = document.getElementById('dvirDriverSignature');
  const driverSignature = driverSigInput ? driverSigInput.value.trim() : '';
  if (!driverSignature) {
    showStatusMessage('Driver Digital Signature is required under 49 CFR § 396.11(b).', true);
    return;
  }

  const priorReviewChk = document.getElementById('chkReviewAcknowledged');
  if (priorReviewChk && !priorReviewChk.checked) {
    showStatusMessage('49 CFR § 396.13 requires drivers to acknowledge review of prior inspection defects.', true);
    return;
  }

  const signOff = document.getElementById('dvirSignOff');
  if (signOff && !signOff.checked) {
    showStatusMessage('Driver inspection certification sign-off is required.', true);
    return;
  }

  const defects = [];
  const inspectionData = {};

  document.querySelectorAll('#dvirChecklistContainer input[type="radio"]:checked').forEach(input => {
    const itemId = input.name.replace('item_', '');
    inspectionData[itemId] = input.value;
    if (input.value === 'fail') {
      defects.push(itemId);
    }
  });

  const trailerNumber = document.getElementById('dvirTrailerNumber')?.value.trim() || '';
  const inspectionType = document.getElementById('inspectionType')?.value || 'pre_trip';
  const siteLocation = document.getElementById('dvirLocation')?.value.trim() || 'Not Applicable';
  const combinedLocation = `${city}, ${state}${siteLocation && siteLocation !== 'Not Applicable' ? ` (${siteLocation})` : ''}`;
  const remarks = document.getElementById('dvirRemarks')?.value.trim() || '';

  const selectedDefectStatus = document.querySelector('input[name="defectStatus"]:checked')?.value || (defects.length > 0 ? 'defects_found' : 'no_defects');

  if ((selectedDefectStatus === 'defects_found' || selectedDefectStatus === 'out_of_service') && !remarks) {
    showStatusMessage('Inspector Remarks are required when defects or Out-of-Service conditions are reported.', true);
    return;
  }

  const isUnlistedPowerUnit = !loadedPowerUnitsMap.has(powerUnitVal.toLowerCase());
  const isUnlistedTrailer = trailerNumber ? !Array.from(loadedTrailersMap.keys()).some(k => trailerNumber.toLowerCase() === k || trailerNumber.toLowerCase().startsWith(k)) : false;

  const unlistedFlag = (isUnlistedPowerUnit || isUnlistedTrailer) ? 1 : 0;
  const unlistedDetails = unlistedFlag ? {
    unlisted_power_unit: isUnlistedPowerUnit ? powerUnitVal : null,
    unlisted_trailer: isUnlistedTrailer ? trailerNumber : null,
    flagged_for_manager: true
  } : null;

  let userId = null;
  let userEmail = null;
  try {
    const u = JSON.parse(localStorage.getItem('driven_user') || '{}');
    userId = u.id || u.user_id || u.sub || null;
    userEmail = u.email || null;
  } catch (e) {}

  const payload = {
    asset_id: selectedAssetId || powerUnitVal,
    asset_number: selectedAssetNumber || powerUnitVal,
    trailer_number: trailerNumber || null,
    driver_id: userId || null,
    driver_signature: driverSignature,
    inspection_type: inspectionType,
    meter_reading: meterReading,
    city: city,
    state: state,
    site_location: siteLocation,
    location: combinedLocation,
    status: selectedDefectStatus === 'no_defects' ? 'pass' : selectedDefectStatus,
    defects_count: defects.length,
    defects_json: JSON.stringify(defects),
    defects_found_json: JSON.stringify(defects),
    inspection_data_json: JSON.stringify(inspectionData),
    remarks: remarks || '',
    prior_review_acknowledged: priorReviewChk ? (priorReviewChk.checked ? 1 : 0) : 1,
    certified: 1,
    country: activeOrgCountry,
    device_location_json: deviceLocation ? JSON.stringify(deviceLocation) : null,
    unlisted_flag: unlistedFlag,
    unlisted_details_json: unlistedDetails ? JSON.stringify(unlistedDetails) : null,
    user_id: userId,
    created_by: userEmail || driverSignature
  };

  const btnSubmit = document.getElementById('btnSubmitDVIR');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Submitting 49 CFR Inspection...';
  }

  try {
    const ctxParams = getUrlContextParams();
    const res = await fetch(buildApiUrl('/api/dvir'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-country': activeOrgCountry,
        ...(ctxParams.org_id ? { 'x-org-id': ctxParams.org_id } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();

    if (result.success) {
      let msg = 'Inspection logged successfully under 49 CFR Part 396!';
      if (selectedDefectStatus === 'out_of_service') {
        msg = '🚨 Out-of-Service inspection logged! Vehicle placed OUT-OF-SERVICE and maintenance notified.';
      } else if (unlistedFlag) {
        msg = 'Inspection submitted! Unlisted equipment was flagged for Fleet Manager review.';
      }
      showStatusMessage(msg);

      document.getElementById('dvirInspectionForm').reset();
      document.getElementById('dvirChecklistContainer').innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Please select or enter a power unit above to generate the statutory checklist.</p>';
      
      const priorBox = document.getElementById('priorReviewBox');
      if (priorBox) priorBox.style.display = 'none';

      document.getElementById('powerUnitUnlistedNotice').style.display = 'none';
      document.getElementById('trailerUnlistedNotice').style.display = 'none';

      const oosBanner = document.getElementById('oosWarningBanner');
      if (oosBanner) oosBanner.style.display = 'none';

      selectedAssetId = '';
      selectedAssetNumber = '';
      currentChecklist = [];
      priorInspectionLoaded = null;

      checkDeviceLocation();
    } else {
      showStatusMessage(result.error || 'Failed to submit inspection.', true);
    }
  } catch (err) {
    console.error('Error submitting DVIR inspection:', err);
    showStatusMessage(`Submission error: ${err.message}`, true);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Submit Completed DVIR';
    }
  }
}

/* ------------------------------------------------------------------
 * DOMContentLoaded Initialization
 * ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  const assetInput = document.getElementById('dvirAssetInput');
  if (assetInput) {
    assetInput.addEventListener('change', onDVIRAssetChange);
    assetInput.addEventListener('blur', onDVIRAssetChange);
  }

  const trailerInput = document.getElementById('dvirTrailerNumber');
  if (trailerInput) {
    trailerInput.addEventListener('input', checkTrailerUnlistedFlag);
  }

  const form = document.getElementById('dvirInspectionForm');
  if (form) {
    form.addEventListener('submit', submitDVIRForm);
  }

  const driverSigInput = document.getElementById('dvirDriverSignature');
  if (driverSigInput) {
    try {
      const u = JSON.parse(localStorage.getItem('driven_user') || '{}');
      const name = u.full_name || u.name || [u.first_name, u.last_name].filter(Boolean).join(' ');
      if (name) driverSigInput.value = name;
    } catch (e) {
      console.warn('Unable to load stored user name:', e);
    }
  }

  checkDeviceLocation();
  loadDVIRAssets();
  loadLocationOptions();
});
