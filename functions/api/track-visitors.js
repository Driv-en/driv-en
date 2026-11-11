/**
 * Visitor Tracking Pages Function
 * 
 * Route: POST /api/track-visitor
 * 
 * Purpose: Receives anonymous visitor data from the visitor-tracking.js
 * script (which runs on every page). Stores it in the site_visitors table
 * for display in the Owner Dashboard's "Site Visitors" tab.
 * 
 * What is stored:
 *   - Timestamp of the visit
 *   - Page path (what page they visited)
 *   - Session ID & Visitor ID (for tracking sessions/duration)
 *   - Time on page (in seconds)
 *   - Country (from Cloudflare CF-IPCountry header — server-side)
 *   - Device type (phone, tablet, desktop)
 *   - Browser (chrome, safari, firefox, edge, opera, other)
 *   - OS (windows, macos, ios, android, linux, other)
 *   - Referral code (if present)
 *   - UTM parameters (source, medium, campaign — if present)
 *   - External referrer (which site they came from, if not driv-en.com)
 * 
 * What is NOT stored:
 *   - IP addresses (never)
 *   - Names, emails, or any personal data
 *   - Exact location (only country-level)
 * 
 * Bindings used:
 * - DB (D1 → driv-en-db)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.driv-en.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

/**
 * Main handler — receives visitor data and stores it
 */
async function handleTrackVisitor(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ success: false });
    }

    // Extract and sanitize fields
    const pagePath = String(body.pagePath || '/').substring(0, 500);
    const sessionId = body.sessionId ? String(body.sessionId).substring(0, 100) : null;
    const visitorId = body.visitorId ? String(body.visitorId).substring(0, 100) : null;
    const timeOnPage = typeof body.timeOnPage === 'number' ? Math.max(0, Math.floor(body.timeOnPage)) : null;
    
    const referralCode = body.referralCode ? String(body.referralCode).replace(/[^A-Za-z0-9-]/g, '').substring(0, 20) : null;
    const deviceType = ['phone', 'tablet', 'desktop'].includes(body.deviceType) ? body.deviceType : 'desktop';
    const browser = String(body.browser || 'other').substring(0, 20);
    const os = String(body.os || 'other').substring(0, 20);
    const utmSource = body.utmSource ? String(body.utmSource).substring(0, 100) : null;
    const utmMedium = body.utmMedium ? String(body.utmMedium).substring(0, 100) : null;
    const utmCampaign = body.utmCampaign ? String(body.utmCampaign).substring(0, 100) : null;
    const externalReferrer = body.externalReferrer ? String(body.externalReferrer).substring(0, 200) : null;

    const country = request.cf?.country || request.headers.get('CF-IPCountry') || null;

    const visitId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      await env.DB.prepare(
        `INSERT INTO site_visitors 
         (id, session_id, visitor_id, time_on_page, page_path, country, device_type, browser, os, referral_code, 
          utm_source, utm_medium, utm_campaign, external_referrer, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        visitId, sessionId, visitorId, timeOnPage, pagePath, country, deviceType, browser, os, referralCode,
        utmSource, utmMedium, utmCampaign, externalReferrer, now
      ).run();
    } catch (dbError) {
      console.error('[TRACK-VISITOR] DB error, attempting table creation/schema migration:', dbError.message);
      try {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS site_visitors (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            visitor_id TEXT,
            time_on_page INTEGER,
            page_path TEXT,
            country TEXT,
            device_type TEXT,
            browser TEXT,
            os TEXT,
            referral_code TEXT,
            utm_source TEXT,
            utm_medium TEXT,
            utm_campaign TEXT,
            external_referrer TEXT,
            created_at TEXT
          )`
        ).run();

        // Ensure new columns exist on older tables
        try { await env.DB.prepare('ALTER TABLE site_visitors ADD COLUMN session_id TEXT').run(); } catch(e) {}
        try { await env.DB.prepare('ALTER TABLE site_visitors ADD COLUMN visitor_id TEXT').run(); } catch(e) {}
        try { await env.DB.prepare('ALTER TABLE site_visitors ADD COLUMN time_on_page INTEGER').run(); } catch(e) {}
        
        // Retry insert
        await env.DB.prepare(
          `INSERT INTO site_visitors 
           (id, session_id, visitor_id, time_on_page, page_path, country, device_type, browser, os, referral_code, 
            utm_source, utm_medium, utm_campaign, external_referrer, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          visitId, sessionId, visitorId, timeOnPage, pagePath, country, deviceType, browser, os, referralCode,
          utmSource, utmMedium, utmCampaign, externalReferrer, now
        ).run();
      } catch (retryError) {
        console.error('[TRACK-VISITOR] Retry failed:', retryError.message);
        return jsonResponse({ success: false });
      }
    }

    return jsonResponse({ success: true });

  } catch (error) {
    console.error('[TRACK-VISITOR] Error:', error.message, error.stack);
    return jsonResponse({ success: false });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  return handleTrackVisitor(request, env);
}

export async function onRequestGet(context) {
  return jsonResponse({ success: false, message: 'Use POST to track a visitor' });
}
