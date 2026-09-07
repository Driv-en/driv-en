// ============================================================================
// Pages Function: /api/admin/issues
// ============================================================================
// PURPOSE: Admin API for the Owner Dashboard's "Issues" tab.
//   GET /api/admin/issues          — List all error log entries (newest first)
//   POST /api/admin/issues         — Resolve/unresolve an issue
//     Body: { id: "...", resolved: true|false }
//
// AUTH: Verifies the caller is logged in as DRIV-EN Founder by parsing
//   the driv_en_session JWT cookie directly using Web Crypto API.
//   Requires JWT_SECRET to be set as a secret on the Pages project.
//
// PAGES PROJECT BINDINGS:
//   - D1: DB → driv-en-db
//   - Secret: JWT_SECRET (same value as the auth worker)
//
// CREATED: September 7, 2026
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
// JWT helpers — parse and verify the session cookie directly
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
    console.error('[ISSUES] JWT verify error:', e.message);
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

// ---------------------------------------------------------------------------
// Auth check — verify the caller is a DRIV-EN Founder
// ---------------------------------------------------------------------------
async function verifyFounder(request, env) {
  if (!env.JWT_SECRET) {
    console.error('[ISSUES] JWT_SECRET is not set on the Pages project');
    return null;
  }

  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies['driv_en_session'];

  if (!token) return null;

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return null;

  if (payload.role === 'DRIV-EN Founder') {
    return payload;
  }

  return null;
}

// ---------------------------------------------------------------------------
// GET /api/admin/issues — List all error log entries
// ---------------------------------------------------------------------------
async function handleListIssues(request, env) {
  const user = await verifyFounder(request, env);
  if (!user) {
    return jsonResponse({ success: false, error: 'Unauthorized — DRIV-EN Founder access required' }, 403);
  }

  try {
    // Ensure the table exists (auto-create)
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS error_log (
        id TEXT PRIMARY KEY,
        source TEXT,
        error_message TEXT,
        stack_trace TEXT,
        severity TEXT DEFAULT 'error',
        resolved INTEGER DEFAULT 0,
        created_at TEXT
      )`
    ).run();

    const result = await env.DB.prepare(
      `SELECT id, source, error_message, stack_trace, severity, resolved, created_at
       FROM error_log
       ORDER BY created_at DESC
       LIMIT 500`
    ).all();

    return jsonResponse({ success: true, issues: result.results || [] }, 200);
  } catch (e) {
    console.error('[ISSUES] List error:', e.message, e.stack);
    return jsonResponse({ success: false, error: 'Failed to load issues: ' + e.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/issues — Resolve or unresolve an issue
// Body: { id: "...", resolved: true|false }
// ---------------------------------------------------------------------------
async function handleResolveIssue(request, env) {
  const user = await verifyFounder(request, env);
  if (!user) {
    return jsonResponse({ success: false, error: 'Unauthorized — DRIV-EN Founder access required' }, 403);
  }

  try {
    const body = await request.json();
    const { id, resolved } = body;

    if (!id) {
      return jsonResponse({ success: false, error: 'Issue ID is required' }, 400);
    }

    await env.DB.prepare(
      `UPDATE error_log SET resolved = ? WHERE id = ?`
    ).bind(resolved ? 1 : 0, id).run();

    return jsonResponse({ success: true, message: resolved ? 'Issue marked as resolved' : 'Issue reopened' }, 200);
  } catch (e) {
    console.error('[ISSUES] Resolve error:', e.message, e.stack);
    return jsonResponse({ success: false, error: 'Failed to update issue: ' + e.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (request.method === 'GET') {
    return handleListIssues(request, env);
  }

  if (request.method === 'POST') {
    return handleResolveIssue(request, env);
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
}
