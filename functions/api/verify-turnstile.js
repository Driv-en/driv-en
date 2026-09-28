// ============================================================================
// Pages Function: /api/verify-turnstile
// ============================================================================
// PURPOSE: Verifies a Cloudflare Turnstile token server-side.
//   Called by module-selection.html before proceeding to cart/checkout.
//
//   POST /api/verify-turnstile
//   Body: { "token": "..." }
//   Response: { "success": true } or { "success": false, "error": "..." }
//
// PAGES PROJECT BINDINGS:
//   - Secret: TURNSTILE_SECRET_KEY
//
// CREATED: September 28, 2026 (Session 48)
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.driv-en.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function verifyTurnstile(token, secret) {
  if (!token) return { success: false, error: 'Missing Turnstile token' };
  if (!secret) return { success: false, error: 'Turnstile secret not configured' };
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'secret=' + encodeURIComponent(secret) + '&response=' + encodeURIComponent(token)
    });
    const data = await res.json();
    if (!data.success) return { success: false, error: 'Turnstile verification failed' };
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Turnstile verification error: ' + (e.message || 'unknown') };
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const token = body.token || '';
    const result = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY);
    if (result.success) return jsonResponse({ success: true });
    return jsonResponse({ success: false, error: result.error }, 403);
  } catch (e) {
    return jsonResponse({ success: false, error: 'Invalid request body' }, 400);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
