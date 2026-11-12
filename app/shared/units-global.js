/**
 * units-global.js — DRIV-EN Unit of Measure Enforcement (Global/Non-Module Version)
 *
 * For pages that use inline <script> tags instead of ES modules.
 * Load via: <script src="/app/shared/units-global.js"></script>
 *
 * Exposes a global `DRIVEN_UNITS` object with all format/parse functions.
 * Also exposes individual functions on window for easy use in templates.
 *
 * Unit system resolves: user preference → org default (admin's choice).
 * Fetched from /api/user/preferences/units, cached in localStorage.
 *
 * Usage:
 *   <script src="/app/shared/units-global.js"></script>
 *   <script>
 *     DRIVEN_UNITS.getUnitSystem().then(sys => {
 *       document.querySelectorAll('[data-volume]').forEach(el => {
 *         el.textContent = DRIVEN_UNITS.formatVolumeSync(parseFloat(el.dataset.volume), sys);
 *       });
 *     });
 *   </script>
 */

(function() {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────
  var KM_PER_MILE = 1.609344;
  var LITERS_PER_GAL = 3.785411784;
  var KG_PER_LB = 0.45359237;
  var BAR_PER_PSI = 0.0689475729;

  var LABELS = {
    imperial: { distance: 'mi', volume: 'gal', weight: 'lbs', temperature: '°F', pressure: 'psi' },
    metric: { distance: 'km', volume: 'L', weight: 'kg', temperature: '°C', pressure: 'bar' }
  };

  var CANONICAL = { distance: 'km', volume: 'L', weight: 'kg', temperature: 'C', pressure: 'bar' };

  // ─── Unit system cache ──────────────────────────────────────────────
  var _cachedSystem = null;
  var _fetchPromise = null;

  function getUnitSystem() {
    if (_cachedSystem) return Promise.resolve(_cachedSystem);

    try {
      var stored = localStorage.getItem('driv-en-unit-system');
      if (stored === 'imperial' || stored === 'metric') {
        _cachedSystem = stored;
        return Promise.resolve(stored);
      }
    } catch (e) {}

    if (!_fetchPromise) {
      _fetchPromise = fetch('/api/user/preferences/units', { credentials: 'include' })
        .then(function(resp) {
          if (resp.ok) return resp.json();
          throw new Error('API error');
        })
        .then(function(data) {
          var system = (data && data.result && data.result.unit_system) || 'imperial';
          _cachedSystem = system;
          try { localStorage.setItem('driv-en-unit-system', system); } catch (e) {}
          _fetchPromise = null;
          return system;
        })
        .catch(function() {
          _cachedSystem = 'imperial';
          _fetchPromise = null;
          return 'imperial';
        });
    }
    return _fetchPromise;
  }

  function refreshUnitSystem() {
    _cachedSystem = null;
    try { localStorage.removeItem('driv-en-unit-system'); } catch (e) {}
    return getUnitSystem();
  }

  function setUnitSystemCache(system) {
    _cachedSystem = system;
    try { localStorage.setItem('driv-en-unit-system', system); } catch (e) {}
  }

  // ─── Sync format functions (require known system) ───────────────────
  function formatDistanceSync(km, sys, opts) {
    opts = opts || {};
    var decimals = opts.decimals != null ? opts.decimals : 1;
    var withUnit = opts.withUnit !== false;
    if (km == null || isNaN(km)) return withUnit ? '— ' + LABELS[sys].distance : '—';
    if (sys === 'imperial') return (km / KM_PER_MILE).toFixed(decimals) + (withUnit ? ' ' + LABELS.imperial.distance : '');
    return Number(km).toFixed(decimals) + (withUnit ? ' ' + LABELS.metric.distance : '');
  }

  function formatVolumeSync(liters, sys, opts) {
    opts = opts || {};
    var decimals = opts.decimals != null ? opts.decimals : 1;
    var withUnit = opts.withUnit !== false;
    if (liters == null || isNaN(liters)) return withUnit ? '— ' + LABELS[sys].volume : '—';
    if (sys === 'imperial') return (liters / LITERS_PER_GAL).toFixed(decimals) + (withUnit ? ' ' + LABELS.imperial.volume : '');
    return Number(liters).toFixed(decimals) + (withUnit ? ' ' + LABELS.metric.volume : '');
  }

  function formatWeightSync(kg, sys, opts) {
    opts = opts || {};
    var decimals = opts.decimals != null ? opts.decimals : 0;
    var withUnit = opts.withUnit !== false;
    if (kg == null || isNaN(kg)) return withUnit ? '— ' + LABELS[sys].weight : '—';
    if (sys === 'imperial') return (kg / KG_PER_LB).toLocaleString('en-US', { maximumFractionDigits: decimals }) + (withUnit ? ' ' + LABELS.imperial.weight : '');
    return Number(kg).toLocaleString('en-US', { maximumFractionDigits: decimals }) + (withUnit ? ' ' + LABELS.metric.weight : '');
  }

  function formatTemperatureSync(celsius, sys, opts) {
    opts = opts || {};
    var decimals = opts.decimals != null ? opts.decimals : 0;
    var withUnit = opts.withUnit !== false;
    if (celsius == null || isNaN(celsius)) return withUnit ? '— ' + LABELS[sys].temperature : '—';
    if (sys === 'imperial') return ((celsius * 9 / 5) + 32).toFixed(decimals) + (withUnit ? LABELS.imperial.temperature : '');
    return Number(celsius).toFixed(decimals) + (withUnit ? LABELS.metric.temperature : '');
  }

  function formatPressureSync(bar, sys, opts) {
    opts = opts || {};
    var decimals = opts.decimals != null ? opts.decimals : 0;
    var withUnit = opts.withUnit !== false;
    if (bar == null || isNaN(bar)) return withUnit ? '— ' + LABELS[sys].pressure : '—';
    if (sys === 'imperial') return (bar / BAR_PER_PSI).toFixed(decimals) + (withUnit ? ' ' + LABELS.imperial.pressure : '');
    return Number(bar).toFixed(decimals) + (withUnit ? ' ' + LABELS.metric.pressure : '');
  }

  function formatCurrencySync(amount, sys, opts) {
    opts = opts || {};
    var currency = opts.currency || (sys === 'metric' ? 'CAD' : 'USD');
    var locale = sys === 'metric' ? 'en-CA' : 'en-US';
    if (amount == null || isNaN(amount)) return '—';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(amount);
  }

  // ─── Async format functions (fetch system if needed) ────────────────
  function formatDistance(km, opts) {
    return getUnitSystem().then(function(sys) { return formatDistanceSync(km, sys, opts); });
  }
  function formatVolume(liters, opts) {
    return getUnitSystem().then(function(sys) { return formatVolumeSync(liters, sys, opts); });
  }
  function formatWeight(kg, opts) {
    return getUnitSystem().then(function(sys) { return formatWeightSync(kg, sys, opts); });
  }
  function formatTemperature(celsius, opts) {
    return getUnitSystem().then(function(sys) { return formatTemperatureSync(celsius, sys, opts); });
  }
  function formatPressure(bar, opts) {
    return getUnitSystem().then(function(sys) { return formatPressureSync(bar, sys, opts); });
  }
  function formatCurrency(amount, opts) {
    return getUnitSystem().then(function(sys) { return formatCurrencySync(amount, sys, opts); });
  }

  // ─── Parse functions (display → canonical) ─────────────────────────
  function parseDistance(value) {
    return getUnitSystem().then(function(sys) {
      var num = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
      if (isNaN(num)) return null;
      var str = String(value).toLowerCase();
      if (str.indexOf('mi') > -1) return num * KM_PER_MILE;
      if (str.indexOf('km') > -1) return num;
      return sys === 'imperial' ? num * KM_PER_MILE : num;
    });
  }

  function parseVolume(value) {
    return getUnitSystem().then(function(sys) {
      var num = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
      if (isNaN(num)) return null;
      var str = String(value).toLowerCase();
      if (str.indexOf('gal') > -1) return num * LITERS_PER_GAL;
      if (str.match(/\b[l]\b/) || str.indexOf('liter') > -1) return num;
      return sys === 'imperial' ? num * LITERS_PER_GAL : num;
    });
  }

  function parseWeight(value) {
    return getUnitSystem().then(function(sys) {
      var num = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
      if (isNaN(num)) return null;
      var str = String(value).toLowerCase();
      if (str.indexOf('lb') > -1) return num * KG_PER_LB;
      if (str.indexOf('kg') > -1) return num;
      return sys === 'imperial' ? num * KG_PER_LB : num;
    });
  }

  function parseTemperature(value) {
    return getUnitSystem().then(function(sys) {
      var num = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
      if (isNaN(num)) return null;
      var str = String(value).toLowerCase();
      if (str.indexOf('f') > -1) return (num - 32) * 5 / 9;
      if (str.indexOf('c') > -1) return num;
      return sys === 'imperial' ? (num - 32) * 5 / 9 : num;
    });
  }

  function parsePressure(value) {
    return getUnitSystem().then(function(sys) {
      var num = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
      if (isNaN(num)) return null;
      var str = String(value).toLowerCase();
      if (str.indexOf('psi') > -1) return num * BAR_PER_PSI;
      if (str.indexOf('bar') > -1) return num;
      return sys === 'imperial' ? num * BAR_PER_PSI : num;
    });
  }

  // ─── Label helpers ──────────────────────────────────────────────────
  function getUnitLabel(type) {
    return getUnitSystem().then(function(sys) { return LABELS[sys][type] || ''; });
  }

  function getUnitLabels() {
    return getUnitSystem().then(function(sys) { return Object.assign({}, LABELS[sys]); });
  }

  function getUnitInfo() {
    return getUnitSystem().then(function(sys) {
      return { system: sys, labels: LABELS[sys], canonical: CANONICAL };
    });
  }

  // ─── Volume label shortcut (most common use case) ───────────────────
  // Returns the volume unit label synchronously from cache, or 'gal' as fallback
  function getVolumeLabel() {
    if (_cachedSystem) return LABELS[_cachedSystem].volume;
    try {
      var stored = localStorage.getItem('driv-en-unit-system');
      if (stored === 'imperial' || stored === 'metric') return LABELS[stored].volume;
    } catch (e) {}
    return 'gal'; // fallback
  }

  function getDistanceLabel() {
    if (_cachedSystem) return LABELS[_cachedSystem].distance;
    try {
      var stored = localStorage.getItem('driv-en-unit-system');
      if (stored === 'imperial' || stored === 'metric') return LABELS[stored].distance;
    } catch (e) {}
    return 'mi';
  }

  function getPressureLabel() {
    if (_cachedSystem) return LABELS[_cachedSystem].pressure;
    try {
      var stored = localStorage.getItem('driv-en-unit-system');
      if (stored === 'imperial' || stored === 'metric') return LABELS[stored].pressure;
    } catch (e) {}
    return 'psi';
  }

  function getWeightLabel() {
    if (_cachedSystem) return LABELS[_cachedSystem].weight;
    try {
      var stored = localStorage.getItem('driv-en-unit-system');
      if (stored === 'imperial' || stored === 'metric') return LABELS[stored].weight;
    } catch (e) {}
    return 'lbs';
  }

  // ─── User preference management ─────────────────────────────────────
  function getUserUnitPreference() {
    return fetch('/api/user/preferences/units', { credentials: 'include' })
      .then(function(resp) { if (resp.ok) return resp.json(); throw new Error('API error'); })
      .then(function(data) { return (data && data.result) || null; })
      .catch(function() { return null; });
  }

  function setUserUnitPreference(system) {
    return fetch('/api/user/preferences/units', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_system: system })
    })
      .then(function(resp) { if (resp.ok) return resp.json(); throw new Error('API error'); })
      .then(function(data) {
        var result = (data && data.result) || null;
        if (result && result.unit_system) {
          setUnitSystemCache(result.unit_system);
        }
        return result;
      })
      .catch(function() { return null; });
  }

  // ─── Expose globally ────────────────────────────────────────────────
  window.DRIVEN_UNITS = {
    // System management
    getUnitSystem: getUnitSystem,
    refreshUnitSystem: refreshUnitSystem,
    setUnitSystemCache: setUnitSystemCache,

    // User preference management
    getUserUnitPreference: getUserUnitPreference,
    setUserUnitPreference: setUserUnitPreference,

    // Async format (returns Promise)
    formatDistance: formatDistance,
    formatVolume: formatVolume,
    formatWeight: formatWeight,
    formatTemperature: formatTemperature,
    formatPressure: formatPressure,
    formatCurrency: formatCurrency,

    // Sync format (requires system param)
    formatDistanceSync: formatDistanceSync,
    formatVolumeSync: formatVolumeSync,
    formatWeightSync: formatWeightSync,
    formatTemperatureSync: formatTemperatureSync,
    formatPressureSync: formatPressureSync,
    formatCurrencySync: formatCurrencySync,

    // Parse (returns Promise)
    parseDistance: parseDistance,
    parseVolume: parseVolume,
    parseWeight: parseWeight,
    parseTemperature: parseTemperature,
    parsePressure: parsePressure,

    // Labels
    getUnitLabel: getUnitLabel,
    getUnitLabels: getUnitLabels,
    getUnitInfo: getUnitInfo,
    getVolumeLabel: getVolumeLabel,
    getDistanceLabel: getDistanceLabel,
    getPressureLabel: getPressureLabel,
    getWeightLabel: getWeightLabel,

    // Constants
    CANONICAL: CANONICAL,
    LABELS: LABELS,
  };

  // Also expose individual functions on window for convenience
  window.getUnitSystem = getUnitSystem;
  window.formatVolumeSync = formatVolumeSync;
  window.formatDistanceSync = formatDistanceSync;
  window.formatWeightSync = formatWeightSync;
  window.formatTemperatureSync = formatTemperatureSync;
  window.formatPressureSync = formatPressureSync;
  window.getVolumeLabel = getVolumeLabel;
  window.getDistanceLabel = getDistanceLabel;
  window.getPressureLabel = getPressureLabel;
  window.getWeightLabel = getWeightLabel;
  window.getUserUnitPreference = getUserUnitPreference;
  window.setUserUnitPreference = setUserUnitPreference;
})();
