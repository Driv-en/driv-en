/**
 * DRIV-EN Asset Configuration Controller
 * Path: /app/dashboard/asset-config.js
 * Strictly enforces zero-inline script security architecture & robust input sanitization.
 */

let allAssets = [];
let assetTypes = [];
let activeOrgId = null;
let customItemsList = [];
let customFieldsList = [];
let partsList = [];
let orgUOM = { distance: 'mi', pressure: 'psi', volume: 'gal' };
let orgCountry = 'US';
const API_ENDPOINT = '/api/asset-config';

// Security Helper: Escape HTML attributes to prevent breakage on quotes and XSS
function escapeHtmlAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', () => {
  bindDOMEvents();
  bindModalBackdropsAndKeydown();
});

document.addEventListener('dashSessionLoaded', async () => {
  const u = window.dashUser || window.drivenUser;
  activeOrgId = (u && u.org_id && u.org_id !== 'default_org') 
    ? u.org_id 
    : (localStorage.getItem('driven_org_id') || 'org_dsi');

  updateHeaderOffset();
  await fetchOrganizationSettings();
  await loadInitialData();

  const urlParams = new URLSearchParams(window.location.search);
  const target = urlParams.get('target');
  const assetNumber = urlParams.get('assetNumber');

  if (target === 'template') {
    const configTargetEl = document.getElementById('configTarget');
    if (configTargetEl) {
      configTargetEl.value = 'template';
      onTargetTypeChange();
    }
  } else if (assetNumber) {
    const selectAssetEl = document.getElementById('selectAsset');
    if (selectAssetEl) {
      selectAssetEl.value = assetNumber;
      onAssetSelected();
    }
  }
});

window.addEventListener('resize', updateHeaderOffset);

function updateHeaderOffset() {
  const h = document.getElementById('dashHeader') || document.querySelector('.dash-header');
  if (h) {
    const hh = h.getBoundingClientRect().height || 60;
    document.documentElement.style.setProperty('--header-height', hh + 'px');
  }
}

function bindDOMEvents() {
  // Top Nav Buttons
  document.getElementById('btnInstructions')?.addEventListener('click', openInstructionsModal);
  document.getElementById('btnCloseInstructions')?.addEventListener('click', closeInstructionsModal);
  document.getElementById('btnOpenCopy')?.addEventListener('click', openCopyModal);
  document.getElementById('btnCloseCopy')?.addEventListener('click', closeCopyModal);
  document.getElementById('btnExecuteCopy')?.addEventListener('click', executeCopyConfig);
  document.getElementById('btnLogout')?.addEventListener('click', confirmLogout);

  // Configuration Selectors
  document.getElementById('configTarget')?.addEventListener('change', onTargetTypeChange);
  document.getElementById('selectAsset')?.addEventListener('change', onAssetSelected);
  document.getElementById('selectType')?.addEventListener('change', onTypeSelected);
  document.getElementById('selectAttachment')?.addEventListener('change', onAttachmentChanged);
  document.getElementById('btnAddCustomAttachment')?.addEventListener('click', promptAddCustomAttachment);
  document.getElementById('attachmentTrackingMode')?.addEventListener('change', toggleAttachmentTrackingUI);
  document.getElementById('linkedAttachmentAssetId')?.addEventListener('change', onLinkedAttachmentSelected);
  document.getElementById('btnOpenQuickAddAttachment')?.addEventListener('click', openQuickAddAttachmentModal);
  document.getElementById('btnCloseQuickAddAttachment')?.addEventListener('click', closeQuickAddAttachmentModal);
  document.getElementById('btnSaveQuickAttachment')?.addEventListener('click', saveNewAttachmentAsset);

  // Section Action Buttons
  document.getElementById('overrideDefaults')?.addEventListener('change', toggleFormLock);
  document.getElementById('btnAddCustomField')?.addEventListener('click', () => addCustomFieldRow());
  document.getElementById('btnAddPart')?.addEventListener('click', () => addPartRow());
  document.getElementById('btnAddCustomCheck')?.addEventListener('click', () => addCustomItemRow());
  document.getElementById('btnSaveConfig')?.addEventListener('click', saveConfiguration);
}

function bindModalBackdropsAndKeydown() {
  // Close modals on clicking overlay backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  });

  // Close modals on pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
      });
    }
  });
}

async function apiFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (activeOrgId) {
    options.headers['x-org-id'] = activeOrgId;
  }
  return fetch(url, options);
}

async function fetchOrganizationSettings() {
  try {
    const uomResp = await apiFetch('/api/units-of-measure');
    if (uomResp.ok) {
      const data = await uomResp.json();
      if (data && data.uom) orgUOM = { ...orgUOM, ...data.uom };
    }
    const orgResp = await apiFetch(`/api/organization-settings?org_id=${encodeURIComponent(activeOrgId)}`);
    if (orgResp.ok) {
      const oData = await orgResp.json();
      const foundCountry = oData.country || oData.org_country || (oData.org && oData.org.country);
      if (foundCountry) {
        orgCountry = String(foundCountry).toUpperCase().trim();
      }
    }
  } catch (e) {
    console.warn('Using default UOM and country settings:', e);
  }
}

async function loadInitialData() {
  try {
    const resp = await apiFetch('/api/assets');
    if (resp.ok) {
      const data = await resp.json();
      allAssets = extractRecords(data);
      populateAssetDropdowns();
      populateLinkedAttachmentDropdown();
    }
    const typesResp = await apiFetch('/api/asset-types');
    if (typesResp.ok) {
      const tData = await typesResp.json();
      assetTypes = extractRecords(tData);
    }
    populateTypeDropdown();
  } catch (e) {
    console.error('Failed to load assets or categories:', e);
    populateTypeDropdown();
  }
}

function extractRecords(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  return data.records || data.assetTypes || data.assets || data.data || [];
}

function populateAssetDropdowns() {
  const sel = document.getElementById('selectAsset');
  const copySel = document.getElementById('copySourceAsset');
  if (!sel || !copySel) return;

  sel.innerHTML = '<option value="">-- Choose Asset Unit --</option>';
  copySel.innerHTML = '<option value="">-- Choose Source Asset --</option>';

  allAssets.forEach(a => {
    const num = a.asset_number || a.assetNumber || a.name || a.id;
    const type = a.category || a.type || a.asset_type || 'Default';
    if (num && Number(a.is_attachment) !== 1) {
      const opt = document.createElement('option');
      opt.value = num;
      opt.setAttribute('data-type', type);
      opt.textContent = `${num} (${type})`;
      sel.appendChild(opt);

      const copyOpt = opt.cloneNode(true);
      copySel.appendChild(copyOpt);
    }
  });
}

function populateTypeDropdown() {
  const sel = document.getElementById('selectType');
  if (!sel) return;

  sel.innerHTML = '<option value="">-- Choose Asset Category --</option>';
  const categorySet = new Set();

  assetTypes.forEach(t => {
    const name = typeof t === 'object' ? (t.asset_type_name || t.name || t.type || '') : String(t);
    if (name && name.trim()) categorySet.add(name.trim());
  });

  if (categorySet.size === 0 && allAssets.length > 0) {
    allAssets.forEach(a => {
      const cat = a.category || a.type || a.asset_type;
      if (cat && cat.trim() && cat !== 'Default') categorySet.add(cat.trim());
    });
  }

  if (categorySet.size === 0) {
    sel.innerHTML = '<option value="">-- No Categories Configured --</option>';
    return;
  }

  Array.from(categorySet).sort().forEach(catName => {
    const opt = document.createElement('option');
    opt.value = catName;
    opt.textContent = catName;
    sel.appendChild(opt);
  });
}

function populateLinkedAttachmentDropdown() {
  const sel = document.getElementById('linkedAttachmentAssetId');
  if (!sel) return;

  sel.innerHTML = '<option value="">-- Choose Attachment Asset --</option>';
  allAssets.forEach(a => {
    const num = a.asset_number || a.assetNumber || a.name || a.id;
    if (num && (Number(a.is_attachment) === 1 || (a.allowed_category && a.allowed_category !== 'none'))) {
      const opt = document.createElement('option');
      opt.value = num;
      opt.textContent = `${num} - ${a.name || a.make_oem || 'Attachment'}`;
      sel.appendChild(opt);
    }
  });
}

function onTargetTypeChange() {
  const target = document.getElementById('configTarget').value;
  document.getElementById('assetSelectGroup').style.display = target === 'specific' ? 'flex' : 'none';
  document.getElementById('typeSelectGroup').style.display = target === 'template' ? 'flex' : 'none';
  document.getElementById('overrideRow').style.display = target === 'specific' ? 'flex' : 'none';
  document.getElementById('selectAsset').value = '';
  document.getElementById('selectType').value = '';
  document.getElementById('configPanel').style.opacity = '0.5';
  document.getElementById('configPanel').style.pointerEvents = 'none';
  document.getElementById('dynamicSchemaFields').innerHTML = '';

  customItemsList = [];
  customFieldsList = [];
  partsList = [];
  renderCustomItemRows();
  renderCustomFieldRows();
  renderPartsRows();
}

async function onAssetSelected() {
  const assetNum = document.getElementById('selectAsset').value;
  if (!assetNum) return;

  const select = document.getElementById('selectAsset');
  const rawType = select.options[select.selectedIndex]?.getAttribute('data-type') || 'Default';
  document.getElementById('configPanel').style.opacity = '1';
  document.getElementById('configPanel').style.pointerEvents = 'auto';
  document.getElementById('modeBanner').innerText = `Configuring Rules for Asset Unit: ${assetNum} (${rawType})`;

  await fetchAndRenderSchema('specific', assetNum, rawType);
}

async function onTypeSelected() {
  const select = document.getElementById('selectType');
  const typeName = select.value;
  if (!typeName) return;

  document.getElementById('configPanel').style.opacity = '1';
  document.getElementById('configPanel').style.pointerEvents = 'auto';
  document.getElementById('modeBanner').innerText = `Editing Global Defaults for Category: ${typeName}`;

  await fetchAndRenderSchema('template', typeName.trim(), typeName.trim());
}

async function fetchAndRenderSchema(targetType, key, assetType = '') {
  try {
    const params = new URLSearchParams({
      targetType: targetType || 'specific',
      key: key || 'default',
      assetType: assetType || key || 'default',
      country: orgCountry || 'US',
      vol: orgUOM.volume || 'gal',
      press: orgUOM.pressure || 'psi',
      dist: orgUOM.distance || 'mi'
    });

    const res = await apiFetch(`${API_ENDPOINT}?${params.toString()}`);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Schema request failed (${res.status})`);
    }

    const data = await res.json();
    const schema = data.schema || { sections: [] };
    const savedConfig = data.config || {};

    applyConfigToUI(savedConfig, schema);
    toggleFormLock();
  } catch (e) {
    console.error('Failed to load asset schema:', e);
    showMessage(`Error loading schema: ${e.message}`, 'error');
  }
}

function applyConfigToUI(config, schema) {
  customItemsList = config.customItems ? [...config.customItems] : [];
  customFieldsList = config.customFields ? [...config.customFields] : [];
  partsList = config.parts ? [...config.parts] : [];

  document.getElementById('overrideDefaults').checked = config.isOverride || false;

  if (config.attachment) {
    document.getElementById('selectAttachment').value = config.attachment || 'none';
    onAttachmentChanged();
    if (config.attachmentTrackingMode) {
      document.getElementById('attachmentTrackingMode').value = config.attachmentTrackingMode;
      toggleAttachmentTrackingUI();
    }
    if (config.linkedAttachmentAssetId) {
      document.getElementById('linkedAttachmentAssetId').value = config.linkedAttachmentAssetId;
    }
    if (config.attachmentMountState) {
      document.getElementById('attachmentMountState').value = config.attachmentMountState;
    }
  }

  renderCompositeForm(schema, config.rules || {});
}

function onAttachmentChanged() {
  const val = document.getElementById('selectAttachment').value;
  const metaRow = document.getElementById('attachmentMetaRow');
  if (metaRow) {
    metaRow.style.display = (val && val !== 'none') ? 'grid' : 'none';
  }
}

function toggleAttachmentTrackingUI() {
  const mode = document.getElementById('attachmentTrackingMode').value;
  const picker = document.getElementById('linkedAssetPickerGroup');
  if (picker) {
    picker.style.display = mode === 'linked' ? 'flex' : 'none';
  }
}

function onLinkedAttachmentSelected() {
  const id = document.getElementById('linkedAttachmentAssetId').value;
  if (id) {
    showMessage(`Linked attachment asset #${id} assigned.`, 'success');
  }
}

function promptAddCustomAttachment() {
  const name = prompt("Enter Custom Attachment Name (e.g., Hydro-Vac Boom, Concrete Mixer Drum):");
  if (name && name.trim()) {
    const val = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const sel = document.getElementById('selectAttachment');
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = name.trim();
    sel.appendChild(opt);
    sel.value = val;
    onAttachmentChanged();
  }
}

function renderCompositeForm(schema, savedRules = {}) {
  const container = document.getElementById('dynamicSchemaFields');
  container.innerHTML = '';
  if (!schema || !schema.sections) return;

  schema.sections.forEach(sec => {
    const secTitle = document.createElement('div');
    secTitle.className = 'section-title';
    secTitle.textContent = sec.title;
    container.appendChild(secTitle);

    sec.fields.forEach(field => {
      renderFieldRow(container, field, savedRules);
    });
  });

  renderCustomFieldRows();
  renderPartsRows();
  renderCustomItemRows();
}

function renderFieldRow(container, field, savedRules) {
  const rawVal = savedRules[field.id] !== undefined ? savedRules[field.id] : (field.default !== undefined ? field.default : '');
  const val = escapeHtmlAttr(rawVal);
  const isLocked = field.locked || false;

  let badgeHTML = '';
  if (field.badge) {
    let bClass = 'badge-dot';
    if (field.badge.includes('OSHA') || field.badge.includes('CCOHS')) bClass = 'badge-osha';
    if (field.badge.includes('MSHA') || field.badge.includes('Mining')) bClass = 'badge-msha';
    badgeHTML = `<span class="badge ${bClass}">${escapeHtmlAttr(field.badge)}</span>`;
  }

  if (field.type === 'toggle') {
    const row = document.createElement('div');
    row.className = 'toggle-row';
    row.innerHTML = `
      <div>
        <div class="toggle-title">${escapeHtmlAttr(field.label)} ${badgeHTML}</div>
        <div class="toggle-desc">${escapeHtmlAttr(field.desc || '')}</div>
      </div>
      <label class="switch">
        <input type="checkbox" id="field_${field.id}" ${rawVal ? 'checked' : ''} ${isLocked ? 'data-locked="true"' : ''}>
        <span class="slider"></span>
      </label>
    `;
    container.appendChild(row);
  } else if (field.type === 'select') {
    const row = document.createElement('div');
    row.className = 'form-group';
    row.style.marginBottom = '12px';

    let optsHTML = (field.options || []).map(o => `<option value="${escapeHtmlAttr(o)}" ${rawVal === o ? 'selected' : ''}>${escapeHtmlAttr(o)}</option>`).join('');
    optsHTML += `<option value="__add_custom_opt__" style="font-weight: bold; color: var(--primary);">+ Add Custom Option...</option>`;

    row.innerHTML = `
      <label for="field_${field.id}">${escapeHtmlAttr(field.label)} ${badgeHTML}</label>
      <select id="field_${field.id}" ${isLocked ? 'data-locked="true"' : ''}>${optsHTML}</select>
      <span style="font-size: 12px; color: var(--text-muted);">${escapeHtmlAttr(field.desc || '')}</span>
    `;
    container.appendChild(row);

    const selectEl = row.querySelector('select');
    selectEl.addEventListener('change', () => handleDropdownCustomAdd(selectEl));
  } else if (field.type === 'number' || field.type === 'text') {
    const row = document.createElement('div');
    row.className = 'form-group';
    row.style.marginBottom = '12px';
    row.innerHTML = `
      <label for="field_${field.id}">${escapeHtmlAttr(field.label)} ${badgeHTML}</label>
      <input type="${field.type}" id="field_${field.id}" value="${val}" ${isLocked ? 'data-locked="true"' : ''}>
      <span style="font-size: 12px; color: var(--text-muted);">${escapeHtmlAttr(field.desc || '')}</span>
    `;
    container.appendChild(row);
  }
}

function handleDropdownCustomAdd(selectEl) {
  if (selectEl.value === '__add_custom_opt__') {
    const newOpt = prompt("Enter new specification option name:");
    if (newOpt && newOpt.trim()) {
      const optVal = newOpt.trim();
      const option = document.createElement("option");
      option.value = optVal;
      option.textContent = optVal;
      selectEl.insertBefore(option, selectEl.lastElementChild);
      selectEl.value = optVal;
    } else {
      selectEl.selectedIndex = 0;
    }
  }
}

function addPartRow(comp = "", oemB = "", oemP = "", crossB = "", crossP = "") {
  partsList.push({ component: comp, oemBrand: oemB, oemPart: oemP, crossBrand: crossB, crossPart: crossP });
  renderPartsRows();
  toggleFormLock();

  // UX Improvement: Auto-focus the newly added row
  const tbody = document.getElementById('partsTableBody');
  if (tbody && tbody.lastElementChild) {
    const firstInput = tbody.lastElementChild.querySelector('input');
    if (firstInput) firstInput.focus();
  }
}

function removePartRow(index) {
  partsList.splice(index, 1);
  renderPartsRows();
  toggleFormLock();
}

function renderPartsRows() {
  const tbody = document.getElementById('partsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  partsList.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${escapeHtmlAttr(p.component)}" placeholder="Component Name"></td>
      <td><input type="text" value="${escapeHtmlAttr(p.oemBrand)}" placeholder="OEM Brand Spec"></td>
      <td><input type="text" value="${escapeHtmlAttr(p.oemPart)}" placeholder="OEM Part #"></td>
      <td><input type="text" value="${escapeHtmlAttr(p.crossBrand)}" placeholder="e.g. Baldwin / Donaldson"></td>
      <td><input type="text" value="${escapeHtmlAttr(p.crossPart)}" placeholder="e.g. P550388"></td>
      <td><button type="button" class="btn-small-remove">Remove</button></td>
    `;

    const inputs = tr.querySelectorAll('input');
    inputs[0].addEventListener('change', (e) => { partsList[idx].component = e.target.value; });
    inputs[1].addEventListener('change', (e) => { partsList[idx].oemBrand = e.target.value; });
    inputs[2].addEventListener('change', (e) => { partsList[idx].oemPart = e.target.value; });
    inputs[3].addEventListener('change', (e) => { partsList[idx].crossBrand = e.target.value; });
    inputs[4].addEventListener('change', (e) => { partsList[idx].crossPart = e.target.value; });

    tr.querySelector('.btn-small-remove').addEventListener('click', () => removePartRow(idx));
    tbody.appendChild(tr);
  });
}

function addCustomFieldRow(key = "", val = "") {
  customFieldsList.push({ key, value: val });
  renderCustomFieldRows();
  toggleFormLock();

  // UX Improvement: Auto-focus the newly added custom field
  const container = document.getElementById('customFieldsContainer');
  if (container && container.lastElementChild) {
    const firstInput = container.lastElementChild.querySelector('input');
    if (firstInput) firstInput.focus();
  }
}

function removeCustomFieldRow(index) {
  customFieldsList.splice(index, 1);
  renderCustomFieldRows();
  toggleFormLock();
}

function renderCustomFieldRows() {
  const container = document.getElementById('customFieldsContainer');
  if (!container) return;
  container.innerHTML = '';

  customFieldsList.forEach((f, index) => {
    const row = document.createElement('div');
    row.className = 'custom-item-row';
    row.innerHTML = `
      <span class="badge badge-custom">Spec</span>
      <input type="text" value="${escapeHtmlAttr(f.key)}" placeholder="Field Label..." style="flex: 1;">
      <input type="text" value="${escapeHtmlAttr(f.value)}" placeholder="Field Value..." style="flex: 1;">
      <button type="button" class="btn-small-remove">Remove</button>
    `;

    const inputs = row.querySelectorAll('input');
    inputs[0].addEventListener('change', (e) => { customFieldsList[index].key = e.target.value; });
    inputs[1].addEventListener('change', (e) => { customFieldsList[index].value = e.target.value; });
    row.querySelector('.btn-small-remove').addEventListener('click', () => removeCustomFieldRow(index));

    container.appendChild(row);
  });
}

function addCustomItemRow(labelValue = "") {
  customItemsList.push(labelValue);
  renderCustomItemRows();
  toggleFormLock();

  // UX Improvement: Auto-focus newly created checklist item
  const container = document.getElementById('customItemsContainer');
  if (container && container.lastElementChild) {
    const input = container.lastElementChild.querySelector('input');
    if (input) input.focus();
  }
}

function removeCustomItemRow(index) {
  customItemsList.splice(index, 1);
  renderCustomItemRows();
  toggleFormLock();
}

function renderCustomItemRows() {
  const container = document.getElementById('customItemsContainer');
  if (!container) return;
  container.innerHTML = '';

  customItemsList.forEach((itemText, index) => {
    const row = document.createElement('div');
    row.className = 'custom-item-row';
    row.innerHTML = `
      <span class="badge badge-custom">Custom Check</span>
      <input type="text" value="${escapeHtmlAttr(itemText)}" placeholder="Enter check item name...">
      <button type="button" class="btn-small-remove">Remove</button>
    `;

    row.querySelector('input').addEventListener('change', (e) => { customItemsList[index] = e.target.value; });
    row.querySelector('.btn-small-remove').addEventListener('click', () => removeCustomItemRow(index));

    container.appendChild(row);
  });
}

function toggleFormLock() {
  const target = document.getElementById('configTarget').value;
  const isOverride = document.getElementById('overrideDefaults').checked;
  if (target === 'specific' && !isOverride) {
    disableForm();
  } else {
    enableForm();
  }
}

function disableForm() {
  document.querySelectorAll('#dynamicSchemaFields input, #dynamicSchemaFields select, #customFieldsContainer input, #customItemsContainer input, #partsTableBody input, #partsTableBody select').forEach(f => {
    f.disabled = true;
  });
}

function enableForm() {
  document.querySelectorAll('#dynamicSchemaFields input, #dynamicSchemaFields select, #customFieldsContainer input, #customItemsContainer input, #partsTableBody input, #partsTableBody select').forEach(f => {
    f.disabled = f.getAttribute('data-locked') === 'true';
  });
}

async function saveConfiguration() {
  const btn = document.getElementById('btnSaveConfig');
  const targetType = document.getElementById('configTarget').value;
  const key = targetType === 'specific' ? document.getElementById('selectAsset').value : document.getElementById('selectType').value;

  if (!key) {
    showMessage('Please select an asset unit or category before saving.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving Configuration...';

  const rules = {};
  document.querySelectorAll('#dynamicSchemaFields input, #dynamicSchemaFields select').forEach(el => {
    if (el.id.startsWith('field_')) {
      const fieldId = el.id.replace('field_', '');
      if (el.type === 'checkbox') {
        rules[fieldId] = el.checked;
      } else if (el.type === 'number') {
        const numVal = Number(el.value);
        rules[fieldId] = (el.value === '' || isNaN(numVal)) ? null : numVal;
      } else {
        rules[fieldId] = el.value;
      }
    }
  });

  const payload = {
    targetType,
    key,
    config: {
      isOverride: document.getElementById('overrideDefaults').checked,
      attachment: document.getElementById('selectAttachment').value,
      attachmentTrackingMode: document.getElementById('attachmentTrackingMode').value,
      linkedAttachmentAssetId: document.getElementById('linkedAttachmentAssetId').value,
      attachmentMountState: document.getElementById('attachmentMountState').value,
      rules,
      customFields: customFieldsList.filter(f => f.key && f.key.trim() !== ''),
      parts: partsList.filter(p => p.component || p.oemPart || p.crossPart),
      customItems: customItemsList.filter(item => typeof item === 'string' && item.trim() !== ''),
      updatedAt: new Date().toISOString()
    }
  };

  try {
    const resp = await apiFetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const resData = await resp.json();

    if (resp.ok && resData.success) {
      showMessage(`Configuration saved successfully for ${key}!`, 'success');
    } else {
      showMessage(resData.error || 'Failed to save configuration.', 'error');
    }
  } catch (e) {
    showMessage(`Save error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Complete Asset Configuration';
  }
}

function openInstructionsModal() {
  const modal = document.getElementById('instructionsModal');
  if (modal) modal.style.display = 'flex';
}

function closeInstructionsModal() {
  const modal = document.getElementById('instructionsModal');
  if (modal) modal.style.display = 'none';
}

function openQuickAddAttachmentModal() {
  const modal = document.getElementById('quickAddAttachmentModal');
  if (modal) modal.style.display = 'flex';
}

function closeQuickAddAttachmentModal() {
  const modal = document.getElementById('quickAddAttachmentModal');
  if (modal) modal.style.display = 'none';
}

async function saveNewAttachmentAsset() {
  const assetNum = document.getElementById('newAttAssetNumber').value.trim();
  const category = document.getElementById('newAttAllowedCategory').value;
  const serial = document.getElementById('newAttSerialNum').value.trim();
  const make = document.getElementById('newAttMake').value.trim();
  const model = document.getElementById('newAttModel').value.trim();

  if (!assetNum) {
    alert('Please enter an attachment asset number.');
    return;
  }

  const payload = {
    asset_number: assetNum,
    name: `${make} ${model} (${assetNum})`.trim(),
    asset_type: 'Attachment',
    is_attachment: 1,
    allowed_category: category,
    serial_number: serial,
    make_oem: make,
    model: model,
    status: 'active'
  };

  try {
    const resp = await apiFetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      closeQuickAddAttachmentModal();
      showMessage(`Registered attachment ${assetNum} successfully!`, 'success');
      await loadInitialData();
      document.getElementById('linkedAttachmentAssetId').value = assetNum;
    } else {
      const err = await resp.json().catch(() => ({}));
      alert(err.error || err.message || 'Failed to create attachment asset.');
    }
  } catch (e) {
    alert('Error creating attachment: ' + e.message);
  }
}

function openCopyModal() {
  const targetKey = document.getElementById('selectAsset').value;
  if (!targetKey) {
    showMessage('Please select a destination asset unit first before copying configuration.', 'error');
    return;
  }
  const modal = document.getElementById('copyModal');
  if (modal) modal.style.display = 'flex';
}

function closeCopyModal() {
  const modal = document.getElementById('copyModal');
  if (modal) modal.style.display = 'none';
}

async function executeCopyConfig() {
  const sourceKey = document.getElementById('copySourceAsset').value;
  const targetKey = document.getElementById('selectAsset').value;

  if (!sourceKey) {
    alert('Please choose a source asset.');
    return;
  }

  try {
    const resp = await apiFetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'copyConfig', sourceKey, key: targetKey })
    });
    const data = await resp.json();

    if (resp.ok && data.success) {
      closeCopyModal();
      showMessage(data.message || 'Configuration copied successfully!', 'success');
      await onAssetSelected();
    } else {
      alert(data.error || 'Copy failed. Source asset has no saved configuration.');
    }
  } catch (e) {
    alert('Error copying configuration: ' + e.message);
  }
}

function confirmLogout() {
  if (typeof dashLogout === 'function') dashLogout();
  else window.location.href = '/public/login.html';
}

function showMessage(msg, type) {
  const el = document.getElementById('statusMsg');
  if (!el) return;
  el.textContent = msg;
  el.className = `am-message ${type}`;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}
