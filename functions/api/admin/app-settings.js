// ============================================================================
// Pages Function: /api/admin/app-settings
// ============================================================================
// PURPOSE: Read and write application settings stored in the app_settings
//   table in D1. Currently used for the W-9 IRS form URL, which the owner
//   can update from the Owner Dashboard Settings tab.
//
//   GET  /api/admin/app-settings?key=w9_irs_form_url  — Get a single setting
//   GET  /api/admin/app-settings                     — Get all settings
//   POST /api/admin/app-settings                      — Save a setting
//     Body: { key: "w9_irs_form_url", value: "https://..." }
//
// AUTH: Verifies the caller is logged in as DRIV-EN Founder (same JWT
//   verification as referral-partners.js).
//
// PAGES PROJECT BINDINGS:
//   - D1: DB → driv-en-db
//   - Secret: JWT_SECRET (same value as the auth worker)
//
// LAST UPDATED: September 5, 2026
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.driv-en.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// ---------------------------------------------------------------------------
// JWT helpers — same as referral-partners.js
// ---------------------------------------------------------------------------
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

async function verifyJwt(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = headerB64 + '.' + payloadB64;
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(sigB64),
      new TextEncoder().encode(data)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = val;
  }
  return cookies;
}

async function verifyFounder(request, env) {
  if (!env.JWT_SECRET) return null;
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies['driv_en_session'];
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return null;
  if (payload.role === 'DRIV-EN Founder') return payload;
  return null;
}

// ---------------------------------------------------------------------------
// Ensure app_settings table exists
// ---------------------------------------------------------------------------
async function ensureSettingsTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      )`
    ).run();
  } catch (e) {
    console.error('[APP-SETTINGS] Table creation error:', e.message);
  }
}

// ---------------------------------------------------------------------------
// GET — Read settings
// ---------------------------------------------------------------------------
async function handleGet(request, env) {
  const user = await verifyFounder(request, env);
  if (!user) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 403);
  }

  await ensureSettingsTable(env);

  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  try {
    if (key) {
      // Get a single setting
      const row = await env.DB.prepare(
        'SELECT value FROM app_settings WHERE key = ?'
      ).bind(key).first();

      return jsonResponse({
        success: true,
        key: key,
        value: row ? row.value : null
      });
    } else {
      // Get all settings
      const result = await env.DB.prepare(
        'SELECT key, value FROM app_settings ORDER BY key'
      ).all();

      const settings = {};
      (result.results || []).forEach(function(r) {
        settings[r.key] = r.value;
      });

      return jsonResponse({ success: true, settings: settings });
    }
  } catch (e) {
    return jsonResponse({ success: false, error: 'Failed to read settings: ' + e.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST — Save a setting
// ---------------------------------------------------------------------------
async function handlePost(request, env) {
  const user = await verifyFounder(request, env);
  if (!user) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 403);
  }

  let body;
  try { body = await request.json(); } catch (e) {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const { key, value } = body;
  if (!key || value === undefined) {
    return jsonResponse({ success: false, error: 'Key and value are required' }, 400);
  }

  await ensureSettingsTable(env);

  try {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`
    ).bind(key, String(value), now, String(value), now).run();

    return jsonResponse({ success: true, message: 'Setting saved' });
  } catch (e) {
    return jsonResponse({ success: false, error: 'Failed to save setting: ' + e.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// Main handlers
// ---------------------------------------------------------------------------
export async function onRequestGet(context) {
  const { request, env } = context;
  return handleGet(request, env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  return handlePost(request, env);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
