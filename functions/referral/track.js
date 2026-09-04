/**
 * Referral Tracking Pages Function
 * 
 * Route: POST /referral/track
 * 
 * Purpose: When a visitor arrives at driv-en.com/?ref=DRV-CODE, the home page
 * fires a POST to this endpoint. This function:
 * 1. Looks up the referral partner by their referral_code
 * 2. If found and active, creates a "Visited" record in referral_activity
 * 3. Returns success (or silently fails — never errors to the visitor)
 * 
 * Bindings used:
 * - DB (D1 → driv-en-db)
 * 
 * Last updated: 2026-09-04
 */

// CORS headers — same origin only
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.driv-en.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
};

/**
 * Handle OPTIONS preflight requests
 */
function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Main handler — receives referral code, records the visit
 * 
 * Request body: { referralCode: "DRV-XXXXXX" }
 * Response: { success: true } or { success: false }
 * 
 * This function NEVER throws an error to the visitor.
 * If anything goes wrong, it returns { success: false } silently.
 * Errors are logged but do not affect the visitor's browsing experience.
 */
async function handleTrack(request, env) {
  try {
    // Parse the request body
    const body = await request.json();
    const referralCode = body?.referralCode;

    // No referral code? Return silently — visitor browses normally
    if (!referralCode || typeof referralCode !== 'string') {
      return new Response(JSON.stringify({ success: false, message: 'No referral code provided' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Sanitize — referral codes are alphanumeric with dashes, max 20 chars
    const cleanCode = referralCode.replace(/[^A-Za-z0-9-]/g, '').substring(0, 20);

    if (!cleanCode) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid referral code' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Look up the referral partner by code
    // Only track if the partner is Approved and Active
    const partnerResult = await env.DB.prepare(
      `SELECT id, partner_name, partner_email, status, active 
       FROM referral_partners 
       WHERE referral_code = ? AND status = 'Approved' AND active = 1`
    ).bind(cleanCode).first();

    // Partner not found or not active — return silently
    if (!partnerResult) {
      return new Response(JSON.stringify({ success: false, message: 'Referral code not found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Check if a "Visited" record already exists for this partner
    // We only create ONE record per partner (not per visit) to keep it simple
    const existingRecord = await env.DB.prepare(
      `SELECT id FROM referral_activity 
       WHERE partner_id = ? AND activity_type = 'Visited'`
    ).bind(partnerResult.id).first();

    // If a visit record already exists, don't create a duplicate
    if (existingRecord) {
      return new Response(JSON.stringify({ success: true, message: 'Visit already recorded' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Create a new "Visited" record in referral_activity
    // This shows up on the referrer's dashboard as a new lead
    const activityId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO referral_activity (id, partner_id, activity_type, status, created_at)
       VALUES (?, ?, 'Visited', 'Visited', ?)`
    ).bind(activityId, partnerResult.id, now).run();

    // Return success — the visit was recorded
    return new Response(JSON.stringify({ success: true, message: 'Visit recorded' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });

  } catch (error) {
    // Log the error but never expose it to the visitor
    console.error('[REFERRAL-TRACK] Error:', error.message, error.stack);

    return new Response(JSON.stringify({ success: false, message: 'Tracking error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
}

/**
 * Main fetch handler — routes requests
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  if (request.method === 'POST') {
    return handleTrack(request, env);
  }

  return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/**
 * Handle GET requests — not used, but return a simple response
 */
export async function onRequestGet(context) {
  return new Response(JSON.stringify({ success: false, message: 'Use POST to track a referral visit' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
