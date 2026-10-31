/**
 * DRIV-EN Platform: DVIR Inspection Form Controller
 * File: /app/forms/dvir-form.js
 */

let currentChecklist = [];
let selectedAssetNumber = '';
let selectedAssetId = '';
let activeOrgCountry = 'US';
let deviceLocation = null;

function getUrlContextParams() {
  const params = new URLSearchParams(window.location.search);
  const context = {};
  const orgId = params.get('org_id') || params.get('orgId') || localStorage.getItem('driven_org_id');
  const roleId = params.get('role_id') || params.get('roleId') || localStorage.getItem('driven_role');
  if (orgId) context.org_id = orgId;
  if (roleId) context.role_id = roleId;
  return context;
}

function buildApiUrl(endpoint) {
  const ctx = getUrlContextParams();
  const url = new URL(endpoint, window.location.origin);
  if (ctx.org_id) url.searchParams.set('org_id', ctx.org_id);
  if (ctx.role_id) url.searchParams.set('role_id', ctx.role_id);
  return url.pathname + url.search;
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
  if (hasLocation) {
    banner.className = 'location-banner ok';
    banner.style.display = 'block';
    banner.innerHTML = `<strong>📍 Location Tagged:</strong> ${deviceLocation.latitude.toFixed(6)}, ${deviceLocation.longitude.toFixed(6)} (±${Math.round(deviceLocation.accuracy)}m)`;
  } else {
    banner.className = 'location-banner warn';
    banner.style.display = 'block';
    banner.innerHTML = `<strong>⚠️ Device Location OFF</strong> — Click to retry <button type="button" onclick="checkDeviceLocation()" style="margin-left:8px;padding:4px 12px;border:1px solid #b45309;border-radius:4px;background:#fef3c7;color:#78350f;cursor:pointer;font-size:12px;">Retry Location</button>`;
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

  if (isMobileDevice()) {
    checkDeviceLocation();
  }

  loadDVIRAssets();
});

async function loadDVIRAssets() {
  const selectEl = document.getElementById('dvirAssetSelect');
  if (!selectEl) return;

  try {
    const endpoint = buildApiUrl('/api/assets') + '&limit=500&all=true';
    let resp = await fetch(endpoint);
    if (!resp.ok) {
      resp = await fetch('/api/assets');
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    let assetsList = Array.isArray(data) ? data : (data.assets || data.data || data.items || []);

    const activeAssets = assetsList.filter(a => {
      if (!a) return false;
      const st = String(a.status || '').toLowerCase().trim();
      return st !== 'inactive' && st !== 'retired' && st !== 'decommissioned' && st !== 'sold' && st !== 'deleted' && st !== '0';
    });

    selectEl.innerHTML = '<option value="">-- Choose Asset Unit --</option>' + 
      activeAssets.map(a => {
        const assetNum = a.asset_number || a.unit_number || a.code || a.id;
        const name = a.name || a.title || [a.year, a.make, a.model].filter(Boolean).join(' ') || 'Unnamed Unit';
        const typeAttr = a.asset_type || a.type || 'vehicle';
        return `<option value="${esc(a.id)}" data-asset-num="${esc(assetNum)}" data-type="${esc(typeAttr)}">${esc(assetNum)} — ${esc(name)}</option>`;
      }).join('');
  } catch (err) {
    console.error('Error loading DVIR asset list:', err);
  }
}

async function onDVIRAssetChange() {
  const assetSelect = document.getElementById('dvirAssetSelect');
  selectedAssetId = assetSelect.value;
  if (!selectedAssetId) {
    const container = document.getElementById('dvirChecklistContainer');
    if (container) container.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Please select an asset unit above to generate the inspection checklist.</p>';
    return;
  }

  const selectedOption = assetSelect.options[assetSelect.selectedIndex];
  selectedAssetNumber = selectedOption ? selectedOption.getAttribute('data-asset-num') || selectedAssetId : selectedAssetId;
  const rawType = selectedOption ? selectedOption.getAttribute('data-type') || 'default' : 'default';

  try {
    const params = new URLSearchParams({
      assetNumber: selectedAssetNumber,
      assetId: selectedAssetId,
      assetType: rawType,
      country: activeOrgCountry
    });

    const res = await fetch(`${buildApiUrl('/api/dvir')}&${params.toString()}`, {
      headers: {
        'x-country': activeOrgCountry,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success) {
      currentChecklist = data.checklist;
      renderDVIRChecklist(data);
    }
  } catch (err) {
    console.error('Error fetching DVIR checklist:', err);
  }
}

function renderDVIRChecklist(dvirData) {
  const container = document.getElementById('dvirChecklistContainer');
  if (!container) return;

  container.innerHTML = '';

  if (dvirData.jurisdiction || dvirData.authorities) {
    const header = document.createElement('div');
    header.className = 'intl-banner';
    header.innerHTML = `
      <div><strong>Inspection Jurisdiction:</strong> ${esc(dvirData.jurisdiction || 'US Standard')}</div>
      <div><strong>Road Authority:</strong> ${esc(dvirData.authorities?.roadAuth || 'DOT/FMCSA')} | <strong>Work Safety:</strong> ${esc(dvirData.authorities?.workAuth || 'OSHA')}</div>
    `;
    container.appendChild(header);
  }

  (dvirData.checklist || []).forEach(sec => {
    const secEl = document.createElement('div');
    secEl.className = 'dvir-section';
    secEl.innerHTML = `<h4 class="section-title">${esc(sec.title)}</h4>`;

    (sec.items || []).forEach(item => {
      const row = document.createElement('div');
      row.className = 'toggle-row';
      row.innerHTML = `
        <div>
          <div class="toggle-title">${esc(item.label)}</div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <label><input type="radio" name="item_${item.id}" value="pass" checked onchange="updateOverallDefectState()"> Pass</label>
          <label><input type="radio" name="item_${item.id}" value="fail" onchange="updateOverallDefectState()"> Fail</label>
        </div>
      `;
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
    showStatusMessage('Please select an asset unit before submitting.', true);
    return;
  }

  const meterInput = document.getElementById('dvirMeterReading');
  const meterReading = meterInput ? parseFloat(meterInput.value) : null;
  if (!meterReading || isNaN(meterReading) || meterReading < 0) {
    showStatusMessage('Odometer / Hour Meter Reading is required.', true);
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

  const inspectionType = document.getElementById('inspectionType')?.value || 'pre_trip';
  const location = document.getElementById('dvirLocation')?.value.trim() || '';
  const remarks = document.getElementById('dvirRemarks')?.value.trim() || '';
  const selectedDefectStatus = document.querySelector('input[name="defectStatus"]:checked')?.value || (defects.length > 0 ? 'defects_found' : 'no_defects');

  const payload = {
    asset_id: selectedAssetId,
    asset_number: selectedAssetNumber,
    inspection_type: inspectionType,
    meter_reading: meterReading,
    location: location,
    status: selectedDefectStatus === 'defects_found' || defects.length > 0 ? 'defects_found' : 'pass',
    defects_found: defects,
    remarks: remarks,
    inspection_data: inspectionData,
    certified: true,
    device_location: hasDeviceLocation() ? deviceLocation : null
  };

  const btnSubmit = document.getElementById('btnSubmitDVIR');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Submitting DVIR...';
  }

  try {
    const res = await fetch(buildApiUrl('/api/dvir'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-country': activeOrgCountry
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();

    if (result.success) {
      showStatusMessage('DVIR inspection logged successfully!');
      document.getElementById('dvirInspectionForm').reset();
      document.getElementById('dvirChecklistContainer').innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Please select an asset unit above to generate the inspection checklist.</p>';
      selectedAssetId = '';
      selectedAssetNumber = '';
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
