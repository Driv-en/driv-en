/* Carrier Dashboard — carrier/DOT info + drug & alcohol record-keeping */
(function () {
  'use strict';

  var CARRIER_FIELDS = [
    'carrier_name', 'carrier_dba', 'carrier_dot', 'carrier_mc', 'carrier_scac',
    'carrier_address', 'carrier_phone', 'carrier_usdot_pin',
    'carrier_insurance_name', 'carrier_insurance_policy'
  ];
  var settings = {};

  function $(id) { return document.getElementById(id); }

  function setStatus(elId, msg, ok) {
    var el = $(elId);
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? 'var(--success,#16a34a)' : 'var(--error,#ef4444)';
  }

  function toggleTpaFields() {
    var model = $('dna_model');
    var tpa = $('dnaTpaFields');
    var note = $('dnaModelNote');
    if (!model) return;
    if (tpa) tpa.style.display = (model.value === 'tpa') ? 'block' : 'none';
    if (note) {
      var notes = {
        driven: 'Drug & alcohol test fields will be shown on each driver profile, and test documents will be included in audit packets.',
        tpa: 'The driver profile will show a reference to your TPA instead of test entry fields. Audit packets will include a page stating records are held by your TPA.',
        clearinghouse: 'The platform will track FMCSA Clearinghouse query dates/results. Audit packets will include the Clearinghouse query record.',
        physical: 'The platform will note where physical records are kept. Audit packets will include a reference page.'
      };
      note.textContent = notes[model.value] || '';
    }
  }

  async function loadSettings() {
    try {
      var res = await fetch('/auth/get-settings', { credentials: 'include' });
      var data = await res.json();
      if (data && data.success && data.settings) {
        settings = data.settings;
        CARRIER_FIELDS.forEach(function (k) {
          var el = $(k);
          if (el && settings[k] !== undefined && settings[k] !== null) el.value = settings[k];
        });
        if ($('dna_model') && settings.dna_model) $('dna_model').value = settings.dna_model;
        if ($('dna_tpa_name') && settings.dna_tpa_name) $('dna_tpa_name').value = settings.dna_tpa_name;
        if ($('dna_tpa_contact') && settings.dna_tpa_contact) $('dna_tpa_contact').value = settings.dna_tpa_contact;
        if ($('dna_tpa_account') && settings.dna_tpa_account) $('dna_tpa_account').value = settings.dna_tpa_account;
        if ($('clearinghouse_tracking') && settings.clearinghouse_tracking !== undefined) $('clearinghouse_tracking').checked = Boolean(settings.clearinghouse_tracking);
        toggleTpaFields();
      }
    } catch (e) {
      console.warn('Carrier settings load failed:', e);
    }
  }

  async function saveSettings(payload, statusId) {
    try {
      var res = await fetch('/auth/save-settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload })
      });
      var data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Save failed');
      Object.assign(settings, payload);
      setStatus(statusId, 'Saved.', true);
      // Mark Carrier Info onboarding task complete
      markCarrierTaskComplete();
    } catch (e) {
      setStatus(statusId, e.message || 'Could not save.', false);
    }
  }

  function saveCarrier() {
    var payload = {};
    CARRIER_FIELDS.forEach(function (k) {
      var el = $(k);
      if (el) payload[k] = el.value.trim();
    });
    saveSettings(payload, 'carrierStatus');
  }

  function saveDna() {
    var payload = {
      dna_model: ($('dna_model') || {}).value || 'driven',
      dna_tpa_name: ($('dna_tpa_name') || {}).value || '',
      dna_tpa_contact: ($('dna_tpa_contact') || {}).value || '',
      dna_tpa_account: ($('dna_tpa_account') || {}).value || '',
      clearinghouse_tracking: ($('clearinghouse_tracking') || {}).checked || false
    };
    saveSettings(payload, 'dnaStatus');
  }

  // Mark the "Carrier Info" onboarding task complete for the current user
  function markCarrierTaskComplete() {
    try {
      var userObj = JSON.parse(localStorage.getItem('driven_user') || '{}');
      var myEmail = (userObj.email || '').toLowerCase();
      if (!myEmail) return;
      var completions = JSON.parse(localStorage.getItem('driven_task_completions') || '{}');
      if (!completions['Carrier Info']) completions['Carrier Info'] = [];
      if (completions['Carrier Info'].indexOf(myEmail) === -1) {
        completions['Carrier Info'].push(myEmail);
        localStorage.setItem('driven_task_completions', JSON.stringify(completions));
        fetch('/api/onboarding/task-completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskName: 'Carrier Info', completions: completions['Carrier Info'] })
        }).catch(function () {});
      }
    } catch (e) {}
  }

  window.cdLogout = function () {
    fetch('/auth/logout', { method: 'POST', credentials: 'include' })
      .catch(function () {})
      .finally(function () { window.location.href = '/public/login.html'; });
  };

  document.addEventListener('DOMContentLoaded', function () {
    var y = $('dashFooterYear');
    if (y) y.textContent = new Date().getFullYear();
    var sc = $('saveCarrierBtn');
    if (sc) sc.addEventListener('click', saveCarrier);
    var sd = $('saveDnaBtn');
    if (sd) sd.addEventListener('click', saveDna);
    var dm = $('dna_model');
    if (dm) dm.addEventListener('change', toggleTpaFields);
    loadSettings();
  });
})();
