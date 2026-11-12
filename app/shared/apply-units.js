/**
 * apply-units.js — DRIV-EN DOM Unit Applicator
 *
 * Walks the DOM and formats all [data-uom] elements based on the
 * resolved unit system (user preference → org default).
 *
 * Load AFTER units-global.js on every page:
 *   <script src="/app/shared/units-global.js"></script>
 *   <script src="/app/shared/apply-units.js"></script>
 *
 * HTML patterns:
 *
 * 1. Display a formatted value (canonical → display):
 *    <td data-uom="volume" data-value="56.8">56.8</td>
 *    → imperial: "15.0 gal"  |  metric: "56.8 L"
 *
 *    Supported types: volume, distance, weight, temperature, pressure
 *
 * 2. Display just the unit label:
 *    <span data-uom-label="volume">gal</span>
 *    → imperial: "gal"  |  metric: "L"
 *
 * 3. Input field with unit label:
 *    <input data-uom-input="volume" type="number" ...>
 *    <span data-uom-label="volume">gal</span>
 *    On form submit, call DRIVEN_APPLY_UNITS.parseInputs(form) to
 *    convert all [data-uom-input] values to canonical before sending.
 *
 * For dynamically rendered content (tables, modals, AJAX):
 *    DRIVEN_APPLY_UNITS.applyUnits(containerElement);
 *
 * @requires DRIVEN_UNITS (from units-global.js)
 */

(function() {
  'use strict';

  var _system = null;
  var _ready = null;

  // ─── Unit labels per system ──────────────────────────────────────────
  var LABELS = {
    imperial: { distance: 'mi', volume: 'gal', weight: 'lbs', temperature: '°F', pressure: 'psi' },
    metric:   { distance: 'km', volume: 'L',   weight: 'kg',  temperature: '°C', pressure: 'bar' }
  };

  // ─── Init: resolve unit system once ─────────────────────────────────
  function init() {
    if (_ready) return _ready;
    _ready = DRIVEN_UNITS.getUnitSystem().then(function(sys) {
      _system = sys;
      return sys;
    });
    return _ready;
  }

  // ─── Apply units to a root element (or entire document) ──────────────
  function applyUnits(root) {
    root = root || document;
    if (!_system) {
      init().then(function() { applyUnits(root); });
      return;
    }

    // Format values: [data-uom="type"] with data-value="canonical_value"
    var valueEls = root.querySelectorAll('[data-uom]');
    for (var i = 0; i < valueEls.length; i++) {
      var el = valueEls[i];
      var type = el.getAttribute('data-uom');
      var rawVal = el.getAttribute('data-value');
      if (rawVal == null) rawVal = el.textContent;
      var value = parseFloat(rawVal);
      if (isNaN(value)) continue;

      var formatted;
      switch (type) {
        case 'distance':    formatted = DRIVEN_UNITS.formatDistanceSync(value, _system); break;
        case 'volume':      formatted = DRIVEN_UNITS.formatVolumeSync(value, _system); break;
        case 'weight':      formatted = DRIVEN_UNITS.formatWeightSync(value, _system); break;
        case 'temperature': formatted = DRIVEN_UNITS.formatTemperatureSync(value, _system); break;
        case 'pressure':    formatted = DRIVEN_UNITS.formatPressureSync(value, _system); break;
        default: continue;
      }
      el.textContent = formatted;
    }

    // Format labels: [data-uom-label="type"]
    var labelEls = root.querySelectorAll('[data-uom-label]');
    for (var j = 0; j < labelEls.length; j++) {
      var labelEl = labelEls[j];
      var labelType = labelEl.getAttribute('data-uom-label');
      labelEl.textContent = (LABELS[_system] && LABELS[_system][labelType]) || '';
    }
  }

  // ─── Parse form inputs to canonical before submission ───────────────
  // Returns an object mapping input name → canonical value
  function parseInputs(form) {
    var inputs = form.querySelectorAll('[data-uom-input]');
    var result = {};
    var parsers = {
      distance:    DRIVEN_UNITS.parseDistance,
      volume:      DRIVEN_UNITS.parseVolume,
      weight:      DRIVEN_UNITS.parseWeight,
      temperature: DRIVEN_UNITS.parseTemperature,
      pressure:    DRIVEN_UNITS.parsePressure
    };

    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var type = input.getAttribute('data-uom-input');
      var name = input.name || input.id || input.getAttribute('data-field');
      if (!name) continue;
      var parser = parsers[type];
      if (!parser) continue;

      // parse* returns a Promise
      (function(input, name, parser) {
        parser(input.value).then(function(canonical) {
          if (canonical != null) {
            input.setAttribute('data-canonical-value', canonical);
          }
        });
      })(input, name, parser);
    }

    // Note: parseInputs is async due to parse* returning Promises.
    // For synchronous form submission, use parseInputsSync() instead,
    // or use the async parseInputsAsync() wrapper below.
    return result;
  }

  // ─── Async version: returns Promise resolving to { name: canonical } ─
  function parseInputsAsync(form) {
    var inputs = form.querySelectorAll('[data-uom-input]');
    var promises = [];
    var result = {};

    var parsers = {
      distance:    DRIVEN_UNITS.parseDistance,
      volume:      DRIVEN_UNITS.parseVolume,
      weight:      DRIVEN_UNITS.parseWeight,
      temperature: DRIVEN_UNITS.parseTemperature,
      pressure:    DRIVEN_UNITS.parsePressure
    };

    for (var i = 0; i < inputs.length; i++) {
      (function(input) {
        var type = input.getAttribute('data-uom-input');
        var name = input.name || input.id || input.getAttribute('data-field');
        if (!name) return;
        var parser = parsers[type];
        if (!parser) return;

        promises.push(
          parser(input.value).then(function(canonical) {
            if (canonical != null) result[name] = canonical;
          })
        );
      })(inputs[i]);
    }

    return Promise.all(promises).then(function() { return result; });
  }

  // ─── Get the current unit system synchronously (from cache) ─────────
  function getSystem() {
    return _system;
  }

  // ─── Force re-init and re-apply (after user changes preference) ─────
  function refresh() {
    _system = null;
    _ready = null;
    return init().then(function(sys) {
      applyUnits();
      return sys;
    });
  }

  // ─── Auto-apply on DOMContentLoaded ──────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      init().then(function() { applyUnits(); });
    });
  } else {
    init().then(function() { applyUnits(); });
  }

  // ─── Listen for unit system changes in other tabs/windows ──────────
  window.addEventListener('storage', function(e) {
    if (e.key === 'driv-en-unit-system' || e.key === 'driv-en-unit-system-changed') {
      refresh();
    }
  });

  // ─── Expose globally ────────────────────────────────────────────────
  window.DRIVEN_APPLY_UNITS = {
    applyUnits: applyUnits,
    parseInputs: parseInputs,
    parseInputsAsync: parseInputsAsync,
    getSystem: getSystem,
    refresh: refresh,
    init: init,
    LABELS: LABELS
  };
  window.applyUnits = applyUnits;
})();
