let currentChecklist = [];
let selectedAssetNumber = '';
let activeOrgCountry = 'US';

document.addEventListener('DOMContentLoaded', () => {
  const assetSelect = document.getElementById('dvirAssetSelect');
  if (assetSelect) {
    assetSelect.addEventListener('change', onDVIRAssetChange);
  }

  const form = document.getElementById('dvirInspectionForm');
  if (form) {
    form.addEventListener('submit', submitDVIRForm);
  }
});

async function onDVIRAssetChange() {
  const assetSelect = document.getElementById('dvirAssetSelect');
  selectedAssetNumber = assetSelect.value;
  if (!selectedAssetNumber) return;

  const rawType = assetSelect.options[assetSelect.selectedIndex]?.getAttribute('data-type') || 'default';
  
  try {
    const params = new URLSearchParams({
      assetNumber: selectedAssetNumber,
      assetType: rawType,
      country: activeOrgCountry
    });

    const res = await fetch(`/api/dvir?${params.toString()}`, {
      headers: {
        'x-country': activeOrgCountry,
        'Content-Type': 'application/json'
      }
    });

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

  const header = document.createElement('div');
  header.className = 'intl-banner';
  header.innerHTML = `
    <div><strong>Inspection Jurisdiction:</strong> ${dvirData.jurisdiction}</div>
    <div><strong>Road Authority:</strong> ${dvirData.authorities.roadAuth} | <strong>Work Safety:</strong> ${dvirData.authorities.workAuth}</div>
  `;
  container.appendChild(header);

  dvirData.checklist.forEach(sec => {
    const secEl = document.createElement('div');
    secEl.className = 'dvir-section';
    secEl.innerHTML = `<h4 class="section-title">${sec.title}</h4>`;

    sec.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'toggle-row';
      row.innerHTML = `
        <div>
          <div class="toggle-title">${item.label}</div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <label><input type="radio" name="item_${item.id}" value="pass" checked> Pass</label>
          <label><input type="radio" name="item_${item.id}" value="fail"> Fail</label>
        </div>
      `;
      secEl.appendChild(row);
    });

    container.appendChild(secEl);
  });
}

async function submitDVIRForm(e) {
  e.preventDefault();
  if (!selectedAssetNumber) return;

  const defects = [];
  const inspectionData = {};

  document.querySelectorAll('#dvirChecklistContainer input[type="radio"]:checked').forEach(input => {
    const itemId = input.name.replace('item_', '');
    inspectionData[itemId] = input.value;
    if (input.value === 'fail') {
      defects.push(itemId);
    }
  });

  const payload = {
    assetNumber: selectedAssetNumber,
    status: defects.length > 0 ? 'defects_found' : 'pass',
    defectsFound: defects,
    inspectionData
  };

  try {
    const res = await fetch('/api/dvir', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-country': activeOrgCountry
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.success) {
      alert('DVIR inspection logged successfully!');
    }
  } catch (err) {
    console.error('Error submitting DVIR:', err);
  }
}
