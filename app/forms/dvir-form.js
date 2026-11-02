/**
 * DRIV-EN Platform: DVIR Inspection Form Controller
 * Compliant with 49 CFR Part 396 regulations
 * File: /app/forms/dvir-form.js
 */

let currentChecklist = [];
let selectedAssetNumber = '';
let selectedAssetId = '';
let activeOrgCountry = 'US';
let deviceLocation = null;
let priorInspectionLoaded = null;

function getUrlContextParams() {
  const params = new URLSearchParams(window.location.search);
  const context = {};
  const orgId = params.get('org_id') || params.get('orgId') || localStorage.getItem('driven_org_id');
  const roleId = params.get('role_id') || params.get('roleId') || localStorage.getItem('driven_role');
  if (orgId) context.org_id = orgId;
  if (roleId) context.role_id = roleId;
  return context;
}

// Safely builds API URLs without query parameter collision or formatting bugs
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

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

function checkDeviceLocation() {
  if (!navigator.geolocation) return;
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
      updateLocationStatus(false);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function updateLocationStatus(hasLocation) {
  const banner = document.getElementById('locationStatusBanner');
  if (!banner) return;
  
  banner.style.display = 'block';
  
  if (hasLocation && deviceLocation) {
    banner.className = 'location-banner ok';
    banner.innerHTML = `<strong>📍 Location Tagged:</strong> ${deviceLocation.latitude.toFixed(6)}, ${deviceLocation.longitude.toFixed(6)} (±${Math.round(deviceLocation.accuracy)}m)`;
  } else {
    banner.className = 'location-banner warn';
    banner.innerHTML = `<strong>⚠️ Device Location OFF</strong> — Click to retry `;
    
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.textContent = 'Retry Location';
    retryBtn.style.cssText = 'margin-left:8px;padding:4px 12px;border:1px solid #b45309;border-radius:4px;background:#fef3c7;color:#78350f;cursor:pointer;font-size:12px;';
    retryBtn.addEventListener('click', checkDeviceLocation);
    banner.appendChild(retryBtn);
  }
}

function hasDeviceLocation() {
  return deviceLocation !== null && deviceLocation.latitude !== undefined && deviceLocation.longitude !== undefined;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  const assetSelect = document.getElementById('dvirAssetSelect');
  if (assetSelect) {
    assetSelect.addEventListener('change', onDVIRAssetChange);
  }

  const form = document.getElementById('dvirInspectionForm');
  if (form) {
    form.addEventListener('submit', submitDVIRForm);
  }

  // Pre-fill signature with logged-in user name if available
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

  if (isMobileDevice()) {
    checkDeviceLocation();
  }

  loadDVIRAssets();
});

async function loadDVIRAssets() {
  const selectEl = document.getElementById('dvirAssetSelect');
  if (!selectEl) return;

  try {
    const fetchUrl = buildApiUrl('/api/assets', { limit: '500', all: 'true' });

    let resp = await fetch(fetchUrl);
    if (!resp.ok) {
      // Fallback with context parameters preserved
      resp = await fetch(buildApiUrl('/api/assets'));
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    let assetsList = Array.isArray(data) ? data : (data.assets || data.data || data.items || []);

    const activeAssets = assetsList.filter(a => {
      if (!a) return false;
      const st = String(a.status || '').toLowerCase().trim();
      return st !== 'inactive' && st !== 'retired' && st !== 'decommissioned' && st !== 'sold' && st !== 'deleted' && st !== '0';
    });

    selectEl.innerHTML = '<option value="">-- Choose Power Unit --</option>' + 
      activeAssets.map(a => {
        const assetNum = a.asset_number || a.unit_number || a.code || a.id;
        const name = a.name || a.title || [a.year, a.make, a.model].filter(Boolean).join(' ') || 'Unnamed Unit';
        const typeAttr = a.asset_type || a.type || 'vehicle';
        return `<option value="${esc(a.id)}" data-asset-num="${esc(assetNum)}" data-type="${esc(typeAttr)}">${esc(assetNum)} — ${esc(name)}</option>`;
      }).join('');

    // Trigger state sync if browser pre-selected an option
    onDVIRAssetChange();
  } catch (err) {
    console.error('Error loading DVIR asset list:', err);
  }
}

async function onDVIRAssetChange() {
  const assetSelect = document.getElementById('dvirAssetSelect');
  selectedAssetId = assetSelect ? assetSelect.value : '';
  
  const container = document.getElementById('dvirChecklistContainer');
  const priorBox = document.getElementById('priorReviewBox');

  // Clear previous inspection state when changing selection
  priorInspectionLoaded = null;

  if (!selectedAssetId) {
    selectedAssetNumber = '';
    if (container) container.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Please select a power unit above to generate the statutory checklist.</p>';
    if (priorBox) priorBox.style.display = 'none';
    return;
  }

  const selectedOption = assetSelect.options[assetSelect.selectedIndex];
  
  // Parameter Fallback Guard: Guarantees assetNumber is non-empty to prevent HTTP 400
  selectedAssetNumber = (selectedOption ? selectedOption.getAttribute('data-asset-num') : null) || selectedAssetId || (selectedOption ? selectedOption.text.split('—')[0].trim() : 'UNIT-1');
  const rawType = (selectedOption ? selectedOption.getAttribute('data-type') : null) || 'default';

  if (container) container.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Loading statutory 49 CFR Part 396 checklist...</p>';

  try {
    const endpointUrl = buildApiUrl('/api/dvir', {
      assetNumber: selectedAssetNumber,
      asset_number: selectedAssetNumber,
      assetId: selectedAssetId,
      asset_id: selectedAssetId,
      assetType: rawType,
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

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.success) {
      currentChecklist = data.checklist || [];
      priorInspectionLoaded = data.priorInspection || null;

      // Render 49 CFR § 396.13 Prior Driver Inspection Review
      if (priorBox) {
        const priorDetails = document.getElementById('priorReviewDetails');
        if (priorInspectionLoaded && priorDetails) {
          priorBox.style.display = 'block';
          const pDate = new Date(priorInspectionLoaded.created_at).toLocaleString();
          const pDefects = priorInspectionLoaded.status === 'defects_found';
          priorDetails.innerHTML = `
            <strong>Last Recorded Inspection:</strong> ${pDate}<br>
            <strong>Status:</strong> ${pDefects ? '<span style="color:#dc2626;font-weight:700;">⚠️ Defects Previously Reported</span>' : '✅ Satisfactory (No Defects)'}<br>
            ${pDefects ? `<strong>Reported Defects / Remarks:</strong> ${esc(priorInspectionLoaded.remarks || 'None listed')}<br>
            <strong>Repair Status:</strong> ${priorInspectionLoaded.repair_certified ? '✅ Repairs Certified by Technician' : '⚠️ Pending Maintenance Certification'}` : ''}
          `;
        } else if (priorDetails) {
          priorBox.style.display = 'block';
          priorDetails.innerHTML = 'No prior DVIR records found for this unit. Ensure full initial inspection is conducted.';
        }
      }

      renderDVIRChecklist(data);
    } else {
      throw new Error(data.error || 'Checklist failed to load');
    }
  } catch (err) {
    console.error('Error fetching DVIR checklist:', err);
    if (container) {
      container.innerHTML = `<p style="font-size: 13px; color: #b91c1c;">Unable to load inspection checklist (${esc(err.message)}). Please check network connection.</p>`;
    }
  }
}

function renderDVIRChecklist(dvirData) {
  const container = document.getElementById('dvirChecklistContainer');
  if (!container) return;

  container.innerHTML = '';

  (dvirData.checklist || []).forEach(sec => {
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

function updateOverallDefectState() {
  const hasFailures = Array.from(document.querySelectorAll('#dvirChecklistContainer input[type="radio"]:checked'))
    .some(input => input.value === 'fail');

  const noDefectsRadio = document.querySelector('input[name="defectStatus"][value="no_defects"]');
  const defectsFoundRadio = document.querySelector('input[name="defectStatus"][value="defects_found"]');

  if (hasFailures && defectsFoundRadio) {
    defectsFoundRadio.checked = true;
  } else if (!hasFailures && noDefectsRadio) {
    noDefectsRadio.checked = true;
  }
}

function showStatusMessage(msg, isError = false) {
  const statusEl = document.getElementById('statusMsg');
  if (!statusEl) return;
  statusEl.className = `am-message ${isError ? 'error' : 'success'}`;
  statusEl.textContent = msg;
  statusEl.style.display = 'block';
  setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
}

async function submitDVIRForm(e) {
  e.preventDefault();
  if (!selectedAssetId && !selectedAssetNumber) {
    showStatusMessage('Please select a power unit before submitting.', true);
    return;
  }

  const meterInput = document.getElementById('dvirMeterReading');
  const meterReading = meterInput ? parseFloat(meterInput.value) : null;
  if (meterReading === null || isNaN(meterReading) || meterReading < 0) {
    showStatusMessage('Odometer / Engine Hour Reading is required.', true);
    return;
  }

  const driverSigInput = document.getElementById('dvirDriverSignature');
  const driverSignature = driverSigInput ? driverSigInput.value.trim() : '';
  if (!driverSignature) {
    showStatusMessage('Driver Digital Signature is required under 49 CFR § 396.11(b).', true);
    return;
  }

  const priorReviewChk = document.getElementById('chkReviewAcknowledged');
  if (priorInspectionLoaded && priorReviewChk && !priorReviewChk.checked) {
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
  const location = document.getElementById('dvirLocation')?.value.trim() || '';
  const remarks = document.getElementById('dvirRemarks')?.value.trim() || '';
  const selectedDefectStatus = document.querySelector('input[name="defectStatus"]:checked')?.value || (defects.length > 0 ? 'defects_found' : 'no_defects');

  const payload = {
    asset_id: selectedAssetId,
    asset_number: selectedAssetNumber,
    trailer_number: trailerNumber,
    driver_signature: driverSignature,
    inspection_type: inspectionType,
    meter_reading: meterReading,
    location: location,
    status: selectedDefectStatus === 'defects_found' || defects.length > 0 ? 'defects_found' : 'pass',
    defects_found: defects,
    remarks: remarks,
    prior_review_acknowledged: priorInspectionLoaded ? (priorReviewChk ? priorReviewChk.checked : false) : true,
    certified: true,
    device_location: hasDeviceLocation() ? deviceLocation : null
  };

  const btnSubmit = document.getElementById('btnSubmitDVIR');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Submitting 49 CFR DVIR...';
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
      showStatusMessage('DVIR inspection logged successfully under 49 CFR Part 396!');
      document.getElementById('dvirInspectionForm').reset();
      document.getElementById('dvirChecklistContainer').innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Please select a power unit above to generate the statutory checklist.</p>';
      
      const priorBox = document.getElementById('priorReviewBox');
      if (priorBox) priorBox.style.display = 'none';
      
      // Clean up local application state
      selectedAssetId = '';
      selectedAssetNumber = '';
      currentChecklist = [];
      priorInspectionLoaded = null;
    } else {
      showStatusMessage(result.error || 'Failed to submit DVIR inspection.', true);
    }
  } catch (err) {
    console.error('Error submitting DVIR:', err);
    showStatusMessage(`Submission error: ${err.message}`, true);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Submit Completed DVIR';
    }
  }
}
