/**
 * units.js — DRIV-EN Unit of Measure Enforcement
 *
 * Shared utility for all DRIV-EN pages. No page should hardcode units.
 *
 * Design:
 *   - D1 stores values in CANONICAL units (liters, km, kg, °C, bar).
 *   - This module converts canonical → display at render time.
 *   - parse*() functions convert user input (display) → canonical for storage.
 *   - Org unit system (imperial/metric) is fetched once and cached in localStorage.
 *
 * Usage:
 *   import { formatDistance, formatVolume, getUnitSystem } from '/app/shared/units.js';
 *
 *   const sys = await getUnitSystem();        // 'imperial' | 'metric'
 *   formatDistance(8.0);                      // imperial → "5.0 mi", metric → "8.0 km"
 *   formatVolume(56.8);                       // imperial → "15.0 gal", metric → "56.8 L"
 *   parseVolume("15 gal");                     // → 56.78 (liters, canonical)
 */

// ─── Canonical unit constants ────────────────────────────────────────
// All values stored in D1 use these units regardless of display preference.
export const CANONICAL = {
  distance: 'km',
  volume: 'L',
  weight: 'kg',
  temperature: 'C',
  pressure: 'bar',
};

// ─── Conversion factors (canonical → imperial display) ──────────────
const KM_PER_MILE = 1.609344;
const LITERS_PER_GAL = 3.785411784;
const KG_PER_LB = 0.45359237;
const BAR_PER_PSI = 0.0689475729;

// ─── Unit labels per system ──────────────────────────────────────────
const LABELS = {
  imperial: {
    distance: 'mi',
    volume: 'gal',
    weight: 'lbs',
    temperature: '°F',
    pressure: 'psi',
  },
  metric: {
    distance: 'km',
    volume: 'L',
    weight: 'kg',
    temperature: '°C',
    pressure: 'bar',
  },
};

// ─── Unit system management ─────────────────────────────────────────

let _cachedSystem = null;
let _fetchPromise = null;

/**
 * Get the org's unit system ('imperial' or 'metric').
 * Fetches from /api/settings/units once, caches in localStorage.
 * Falls back to 'imperial' if offline or API unavailable.
 *
 * @returns {Promise<'imperial' | 'metric'>}
 */
export async function getUnitSystem() {
  // Check cache first
  if (_cachedSystem) return _cachedSystem;

  // Check localStorage
  try {
    const stored = localStorage.getItem('driv-en-unit-system');
    if (stored === 'imperial' || stored === 'metric') {
      _cachedSystem = stored;
      return stored;
    }
  } catch (e) {
    // localStorage may be unavailable (private mode)
  }

  // Fetch from API (dedupe concurrent calls)
  if (!_fetchPromise) {
    _fetchPromise = fetchUnitSystem().finally(() => {
      _fetchPromise = null;
    });
  }

  return _fetchPromise;
}

async function fetchUnitSystem() {
  try {
    const resp = await fetch('/api/settings/units', { credentials: 'include' });
    if (resp.ok) {
      const data = await resp.json();
      const system = data?.result?.unit_system || data?.unit_system || 'imperial';
      _cachedSystem = system;
      try {
        localStorage.setItem('driv-en-unit-system', system);
      } catch (e) {}
      return system;
    }
  } catch (e) {
    // Offline or error — fall back
  }

  _cachedSystem = 'imperial';
  return _cachedSystem;
}

/**
 * Force-refresh the unit system from the API (e.g., after user changes preference).
 * @returns {Promise<'imperial' | 'metric'>}
 */
export async function refreshUnitSystem() {
  _cachedSystem = null;
  try {
    localStorage.removeItem('driv-en-unit-system');
  } catch (e) {}
  return getUnitSystem();
}

/**
 * Set the unit system locally (used after a successful PUT to update cache).
 * @param {'imperial' | 'metric'} system
 */
export function setUnitSystemCache(system) {
  _cachedSystem = system;
  try {
    localStorage.setItem('driv-en-unit-system', system);
  } catch (e) {}
}

// ─── Format functions (canonical → display) ─────────────────────────

/**
 * Format a distance value (stored in km) for display.
 * @param {number} km - Distance in kilometers (canonical)
 * @param {object} [opts] - { decimals: 1, withUnit: true }
 * @returns {Promise<string>} e.g., "5.0 mi" or "8.0 km"
 */
export async function formatDistance(km, opts = {}) {
  const sys = await getUnitSystem();
  const decimals = opts.decimals ?? 1;
  const withUnit = opts.withUnit !== false;

  if (km == null || isNaN(km)) return withUnit ? `— ${LABELS[sys].distance}` : '—';

  if (sys === 'imperial') {
    const mi = km / KM_PER_MILE;
    return `${mi.toFixed(decimals)}${withUnit ? ` ${LABELS.imperial.distance}` : ''}`;
  }
  return `${Number(km).toFixed(decimals)}${withUnit ? ` ${LABELS.metric.distance}` : ''}`;
}

/**
 * Format a volume value (stored in liters) for display.
 * @param {number} liters - Volume in liters (canonical)
 * @param {object} [opts] - { decimals: 1, withUnit: true }
 * @returns {Promise<string>} e.g., "15.0 gal" or "56.8 L"
 */
export async function formatVolume(liters, opts = {}) {
  const sys = await getUnitSystem();
  const decimals = opts.decimals ?? 1;
  const withUnit = opts.withUnit !== false;

  if (liters == null || isNaN(liters)) return withUnit ? `— ${LABELS[sys].volume}` : '—';

  if (sys === 'imperial') {
    const gal = liters / LITERS_PER_GAL;
    return `${gal.toFixed(decimals)}${withUnit ? ` ${LABELS.imperial.volume}` : ''}`;
  }
  return `${Number(liters).toFixed(decimals)}${withUnit ? ` ${LABELS.metric.volume}` : ''}`;
}

/**
 * Format a weight value (stored in kg) for display.
 * @param {number} kg - Weight in kilograms (canonical)
 * @param {object} [opts] - { decimals: 0, withUnit: true }
 * @returns {Promise<string>} e.g., "1,500 lbs" or "680 kg"
 */
export async function formatWeight(kg, opts = {}) {
  const sys = await getUnitSystem();
  const decimals = opts.decimals ?? 0;
  const withUnit = opts.withUnit !== false;

  if (kg == null || isNaN(kg)) return withUnit ? `— ${LABELS[sys].weight}` : '—';

  if (sys === 'imperial') {
    const lbs = kg / KG_PER_LB;
    return `${lbs.toLocaleString('en-US', { maximumFractionDigits: decimals })}${withUnit ? ` ${LABELS.imperial.weight}` : ''}`;
  }
  return `${Number(kg).toLocaleString('en-US', { maximumFractionDigits: decimals })}${withUnit ? ` ${LABELS.metric.weight}` : ''}`;
}

/**
 * Format a temperature value (stored in °C) for display.
 * @param {number} celsius - Temperature in Celsius (canonical)
 * @param {object} [opts] - { decimals: 0, withUnit: true }
 * @returns {Promise<string>} e.g., "72°F" or "22°C"
 */
export async function formatTemperature(celsius, opts = {}) {
  const sys = await getUnitSystem();
  const decimals = opts.decimals ?? 0;
  const withUnit = opts.withUnit !== false;

  if (celsius == null || isNaN(celsius)) return withUnit ? `— ${LABELS[sys].temperature}` : '—';

  if (sys === 'imperial') {
    const f = (celsius * 9 / 5) + 32;
    return `${f.toFixed(decimals)}${withUnit ? LABELS.imperial.temperature : ''}`;
  }
  return `${Number(celsius).toFixed(decimals)}${withUnit ? LABELS.metric.temperature : ''}`;
}

/**
 * Format a pressure value (stored in bar) for display.
 * @param {number} bar - Pressure in bar (canonical)
 * @param {object} [opts] - { decimals: 0, withUnit: true }
 * @returns {Promise<string>} e.g., "65 psi" or "4.5 bar"
 */
export async function formatPressure(bar, opts = {}) {
  const sys = await getUnitSystem();
  const decimals = opts.decimals ?? 0;
  const withUnit = opts.withUnit !== false;

  if (bar == null || isNaN(bar)) return withUnit ? `— ${LABELS[sys].pressure}` : '—';

  if (sys === 'imperial') {
    const psi = bar / BAR_PER_PSI;
    return `${psi.toFixed(decimals)}${withUnit ? ` ${LABELS.imperial.pressure}` : ''}`;
  }
  return `${Number(bar).toFixed(decimals)}${withUnit ? ` ${LABELS.metric.pressure}` : ''}`;
}

/**
 * Format a currency value for display.
 * Uses Intl.NumberFormat with the org's locale (derived from unit system).
 * @param {number} amount - Currency amount
 * @param {object} [opts] - { currency: 'USD' }
 * @returns {Promise<string>} e.g., "$1,234.56"
 */
export async function formatCurrency(amount, opts = {}) {
  const sys = await getUnitSystem();
  const currency = opts.currency || (sys === 'metric' ? 'CAD' : 'USD');
  const locale = sys === 'metric' ? 'en-CA' : 'en-US';

  if (amount == null || isNaN(amount)) return '—';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

// ─── Parse functions (display → canonical) ───────────────────────────
// Used when saving user input — convert from display unit to canonical.

/**
 * Parse a distance value from user input to canonical km.
 * Detects unit from the string, or uses the org's default.
 * @param {string|number} value - e.g., "5.0 mi", "8 km", or 8
 * @returns {Promise<number>} Distance in km (canonical)
 */
export async function parseDistance(value) {
  const sys = await getUnitSystem();
  const num = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  if (isNaN(num)) return null;

  const str = String(value).toLowerCase();
  if (str.includes('mi')) return num * KM_PER_MILE;
  if (str.includes('km')) return num;

  // No unit specified — use org default
  return sys === 'imperial' ? num * KM_PER_MILE : num;
}

/**
 * Parse a volume value from user input to canonical liters.
 * @param {string|number} value - e.g., "15 gal", "56.8 L", or 56.8
 * @returns {Promise<number>} Volume in liters (canonical)
 */
export async function parseVolume(value) {
  const sys = await getUnitSystem();
  const num = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  if (isNaN(num)) return null;

  const str = String(value).toLowerCase();
  if (str.includes('gal')) return num * LITERS_PER_GAL;
  if (str.match(/\b[l]\b/) || str.includes('liter')) return num;

  return sys === 'imperial' ? num * LITERS_PER_GAL : num;
}

/**
 * Parse a weight value from user input to canonical kg.
 * @param {string|number} value - e.g., "1500 lbs", "680 kg", or 680
 * @returns {Promise<number>} Weight in kg (canonical)
 */
export async function parseWeight(value) {
  const sys = await getUnitSystem();
  const num = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  if (isNaN(num)) return null;

  const str = String(value).toLowerCase();
  if (str.includes('lb') || str.includes('lbs')) return num * KG_PER_LB;
  if (str.includes('kg')) return num;

  return sys === 'imperial' ? num * KG_PER_LB : num;
}

/**
 * Parse a temperature value from user input to canonical °C.
 * @param {string|number} value - e.g., "72°F", "22°C", or 22
 * @returns {Promise<number>} Temperature in °C (canonical)
 */
export async function parseTemperature(value) {
  const sys = await getUnitSystem();
  const num = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  if (isNaN(num)) return null;

  const str = String(value).toLowerCase();
  if (str.includes('f') || str.includes('°f')) return (num - 32) * 5 / 9;
  if (str.includes('c') || str.includes('°c')) return num;

  return sys === 'imperial' ? (num - 32) * 5 / 9 : num;
}

/**
 * Parse a pressure value from user input to canonical bar.
 * @param {string|number} value - e.g., "65 psi", "4.5 bar", or 4.5
 * @returns {Promise<number>} Pressure in bar (canonical)
 */
export async function parsePressure(value) {
  const sys = await getUnitSystem();
  const num = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  if (isNaN(num)) return null;

  const str = String(value).toLowerCase();
  if (str.includes('psi')) return num * BAR_PER_PSI;
  if (str.includes('bar')) return num;

  return sys === 'imperial' ? num * BAR_PER_PSI : num;
}

// ─── Synchronous helpers (for when system is already known) ──────────
// These are useful in templates/render loops where you already have the system
// and don't want to await each format call.

/**
 * Format distance synchronously when unit system is known.
 * @param {number} km - Distance in km (canonical)
 * @param {'imperial'|'metric'} sys - Unit system
 * @param {object} [opts]
 */
export function formatDistanceSync(km, sys, opts = {}) {
  const decimals = opts.decimals ?? 1;
  const withUnit = opts.withUnit !== false;
  if (km == null || isNaN(km)) return withUnit ? `— ${LABELS[sys].distance}` : '—';
  if (sys === 'imperial') {
    return `${(km / KM_PER_MILE).toFixed(decimals)}${withUnit ? ` ${LABELS.imperial.distance}` : ''}`;
  }
  return `${Number(km).toFixed(decimals)}${withUnit ? ` ${LABELS.metric.distance}` : ''}`;
}

export function formatVolumeSync(liters, sys, opts = {}) {
  const decimals = opts.decimals ?? 1;
  const withUnit = opts.withUnit !== false;
  if (liters == null || isNaN(liters)) return withUnit ? `— ${LABELS[sys].volume}` : '—';
  if (sys === 'imperial') {
    return `${(liters / LITERS_PER_GAL).toFixed(decimals)}${withUnit ? ` ${LABELS.imperial.volume}` : ''}`;
  }
  return `${Number(liters).toFixed(decimals)}${withUnit ? ` ${LABELS.metric.volume}` : ''}`;
}

export function formatWeightSync(kg, sys, opts = {}) {
  const decimals = opts.decimals ?? 0;
  const withUnit = opts.withUnit !== false;
  if (kg == null || isNaN(kg)) return withUnit ? `— ${LABELS[sys].weight}` : '—';
  if (sys === 'imperial') {
    return `${(kg / KG_PER_LB).toLocaleString('en-US', { maximumFractionDigits: decimals })}${withUnit ? ` ${LABELS.imperial.weight}` : ''}`;
  }
  return `${Number(kg).toLocaleString('en-US', { maximumFractionDigits: decimals })}${withUnit ? ` ${LABELS.metric.weight}` : ''}`;
}

export function formatTemperatureSync(celsius, sys, opts = {}) {
  const decimals = opts.decimals ?? 0;
  const withUnit = opts.withUnit !== false;
  if (celsius == null || isNaN(celsius)) return withUnit ? `— ${LABELS[sys].temperature}` : '—';
  if (sys === 'imperial') {
    return `${((celsius * 9 / 5) + 32).toFixed(decimals)}${withUnit ? LABELS.imperial.temperature : ''}`;
  }
  return `${Number(celsius).toFixed(decimals)}${withUnit ? LABELS.metric.temperature : ''}`;
}

export function formatPressureSync(bar, sys, opts = {}) {
  const decimals = opts.decimals ?? 0;
  const withUnit = opts.withUnit !== false;
  if (bar == null || isNaN(bar)) return withUnit ? `— ${LABELS[sys].pressure}` : '—';
  if (sys === 'imperial') {
    return `${(bar / BAR_PER_PSI).toFixed(decimals)}${withUnit ? ` ${LABELS.imperial.pressure}` : ''}`;
  }
  return `${Number(bar).toFixed(decimals)}${withUnit ? ` ${LABELS.metric.pressure}` : ''}`;
}

// ─── Unit label helpers ──────────────────────────────────────────────

/**
 * Get the display label for a unit type in the current system.
 * @param {'distance'|'volume'|'weight'|'temperature'|'pressure'} type
 * @returns {Promise<string>} e.g., "mi", "gal", "lbs"
 */
export async function getUnitLabel(type) {
  const sys = await getUnitSystem();
  return LABELS[sys][type] || '';
}

/**
 * Get all unit labels for the current system (for bulk use in templates).
 * @returns {Promise<object>} e.g., { distance: 'mi', volume: 'gal', ... }
 */
export async function getUnitLabels() {
  const sys = await getUnitSystem();
  return { ...LABELS[sys] };
}

/**
 * Get the full unit system info for display in settings UI.
 * @returns {Promise<object>} { system, labels, canonical }
 */
export async function getUnitInfo() {
  const sys = await getUnitSystem();
  return {
    system: sys,
    labels: LABELS[sys],
    canonical: CANONICAL,
  };
}
