// ============================================================================
// Pages Function: /api/validate-promo
// ============================================================================
// PURPOSE: Validates a Founding Member Code (promo code) entered by a user
//   on the Module Selection page. If valid, the user gets free access.
//
//   POST /api/validate-promo
//   Body: { "code": "FOUNDING-2026" }
//   Response: { "success": true, "valid": true, "type": "free_period", "validUntil": "2026-12-31" }
//           or { "success": true, "valid": false, "error": "Invalid code" }
//
// PAGES PROJECT BINDINGS:
//   - D1: DB -> driv-en-db
//
// CREATED: September 7, 2026 (Session 24 — Phase 1)
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

// ---------------------------------------------------------------------------
// Ensure promo_codes table exists (auto-create on first request)
// ---------------------------------------------------------------------------
async function ensurePromoTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS promo_codes (
        code TEXT PRIMARY KEY,
        type TEXT DEFAULT 'free_period',
        valid_until TEXT,
        max_uses INTEGER DEFAULT 0,
        used_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT
      )`
    ).run();

    // Seed the Founding Member code if it doesn't exist
    const existing = await env.DB.prepare(
      'SELECT code FROM promo_codes WHERE code = ?'
    ).bind('FOUNDING-2026').first();

    if (!existing) {
      await env.DB.prepare(
        'INSERT INTO promo_codes (code, type, valid_until, max_uses, used_count, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind('FOUNDING-2026', 'free_period', '2026-12-31', 0, 0, 1, new Date().toISOString()).run();
    }
  } catch (e) {
    console.error('[VALIDATE-PROMO] Table creation error:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const code = (body.code || '').trim().toUpperCase();

    if (!code) {
      return jsonResponse({ success: true, valid: false, error: 'Please enter a code.' }, 200);
    }

    await ensurePromoTable(env);

    // Look up the code
    const promo = await env.DB.prepare(
      'SELECT code, type, valid_until, max_uses, used_count, is_active FROM promo_codes WHERE code = ?'
    ).bind(code).first();

    if (!promo) {
      return jsonResponse({ success: true, valid: false, error: 'Invalid code. Please check and try again.' }, 200);
    }

    if (promo.is_active !== 1) {
      return jsonResponse({ success: true, valid: false, error: 'This code is no longer active.' }, 200);
    }

    // Check max_uses (0 = unlimited)
    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
      return jsonResponse({ success: true, valid: false, error: 'This code has reached its usage limit.' }, 200);
    }

    // Check if the code itself has expired
    if (promo.valid_until) {
      const now = new Date();
      const validUntil = new Date(promo.valid_until + 'T23:59:59');
      if (validUntil < now) {
        return jsonResponse({ success: true, valid: false, error: 'This code has expired.' }, 200);
      }
    }

    // Code is valid — return success
    return jsonResponse({
      success: true,
      valid: true,
      type: promo.type,
      validUntil: promo.valid_until
    }, 200);

  } catch (e) {
    console.error('[VALIDATE-PROMO] Error:', e.message, e.stack);
    return jsonResponse({ success: false, error: 'Unable to validate code. Please try again.' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
