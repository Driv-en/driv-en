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
 *   - Country (from Cloudflare CF-IPCountry header — server-side, not client)
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
 * 
 * This function NEVER returns an error to the visitor.
 * All failures are silent — tracking is non-critical.
 * 
 * Last updated: 2026-09-04
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
 * 
 * Request body: {
 *   pagePath: "/some/page",
 *   referralCode: "DRV-XXXX" or null,
 *   deviceType: "phone" | "tablet" | "desktop",
 *   browser: "chrome" | "safari" | etc,
 *   os: "windows" | "ios" | etc,
 *   utmSource: "google" or null,
 *   utmMedium: "cpc" or null,
 *   utmCampaign: "summer2026" or null,
 *   externalReferrer: "google.com" or null
 * }
 * 
 * Response: { success: true } or { success: false }
 * Never throws an error to the visitor.
 */
async function handleTrackVisitor(request, env) {
  try {
    // Parse the request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      // Invalid JSON — return silently
      return jsonResponse({ success: false });
    }

    // Extract and sanitize fields
    const pagePath = String(body.pagePath || '/').substring(0, 500);
    const referralCode = body.referralCode ? String(body.referralCode).replace(/[^A-Za-z0-9-]/g, '').substring(0, 20) : null;
    const deviceType = ['phone', 'tablet', 'desktop'].includes(body.deviceType) ? body.deviceType : 'desktop';
    const browser = String(body.browser || 'other').substring(0, 20);
    const os = String(body.os || 'other').substring(0, 20);
    const utmSource = body.utmSource ? String(body.utmSource).substring(0, 100) : null;
    const utmMedium = body.utmMedium ? String(body.utmMedium).substring(0, 100) : null;
    const utmCampaign = body.utmCampaign ? String(body.utmCampaign).substring(0, 100) : null;
    const externalReferrer = body.externalReferrer ? String(body.externalReferrer).substring(0, 200) : null;

    // Get country from Cloudflare's CF-IPCountry header (server-side, not client)
    // This is set by Cloudflare's edge network based on the visitor's IP
    // We do NOT store the IP address — only the country code
    const country = request.cf?.country || request.headers.get('CF-IPCountry') || null;

    // Generate a unique ID for this visit record
    const visitId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Insert the visitor record into the site_visitors table
    try {
      await env.DB.prepare(
        `INSERT INTO site_visitors 
         (id, page_path, country, device_type, browser, os, referral_code, 
          utm_source, utm_medium, utm_campaign, external_referrer, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        visitId, pagePath, country, deviceType, browser, os, referralCode,
        utmSource, utmMedium, utmCampaign, externalReferrer, now
      ).run();
    } catch (dbError) {
      // Table might not exist yet — try to create it, then insert
      console.error('[TRACK-VISITOR] DB error, attempting table creation:', dbError.message);
      try {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS site_visitors (
            id TEXT PRIMARY KEY,
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
        
        // Retry the insert
        await env.DB.prepare(
          `INSERT INTO site_visitors 
           (id, page_path, country, device_type, browser, os, referral_code, 
            utm_source, utm_medium, utm_campaign, external_referrer, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          visitId, pagePath, country, deviceType, browser, os, referralCode,
          utmSource, utmMedium, utmCampaign, externalReferrer, now
        ).run();
      } catch (retryError) {
        // Still failed — log but don't error to the visitor
        console.error('[TRACK-VISITOR] Retry failed:', retryError.message);
        return jsonResponse({ success: false });
      }
    }

    return jsonResponse({ success: true });

  } catch (error) {
    // Log the error but never expose it to the visitor
    console.error('[TRACK-VISITOR] Error:', error.message, error.stack);
    return jsonResponse({ success: false });
  }
}

/**
 * Handle OPTIONS preflight requests
 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Main POST handler
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  return handleTrackVisitor(request, env);
}

/**
 * Handle GET requests — return a simple message
 */
export async function onRequestGet(context) {
  return jsonResponse({ success: false, message: 'Use POST to track a visitor' });
}
