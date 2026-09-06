// ============================================================================
// Pages Function: /api/admin/site-visitors
// ============================================================================
// PURPOSE: Admin API for the Owner Dashboard's "Site Visitors" tab.
//   GET /api/admin/site-visitors          — List visitors with optional date range
//   GET /api/admin/site-visitors?start=ISO&end=ISO  — Filter by date range
//   GET /api/admin/site-visitors?summary=true       — Get summary stats only
//   GET /api/admin/site-visitors?sessions=true     — Get visitor sessions grouped
//
// AUTH: Verifies the caller is logged in as DRIV-EN Founder by parsing
//   the driv_en_session JWT cookie directly using Web Crypto API.
//   Requires JWT_SECRET to be set as a secret on the Pages project.
//
// PAGES PROJECT BINDINGS:
//   - D1: DB → driv-en-db
//   - Secret: JWT_SECRET (same value as the auth worker)
//
// LAST UPDATED: September 6, 2026
// CHANGES:
//   - Added uniqueVisitors count (COUNT DISTINCT visitor_id)
//   - Session grouping now falls back to visitor_id when session_id is empty
//   - Visitor list query now includes visitor_id column
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.driv-en.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    console.error('[SITE-VISITORS] JWT verify error:', e.message);
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
    console.error('[SITE-VISITORS] JWT_SECRET is not set on the Pages project');
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
// GET /api/admin/site-visitors — List visitors with optional date range
// ---------------------------------------------------------------------------
async function handleListVisitors(request, env) {
  const user = await verifyFounder(request, env);
  if (!user) {
    return jsonResponse({ success: false, error: 'Unauthorized — DRIV-EN Founder access required' }, 403);
  }

  try {
    const url = new URL(request.url);
    const params = url.searchParams;

    // Parse date range (optional)
    let startDate = params.get('start');
    let endDate = params.get('end');

    if (!startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString();
    }
    if (!endDate) {
      endDate = new Date().toISOString();
    }

    // If sessions=true, return session-grouped data
    if (params.get('sessions') === 'true') {
      return await handleSessions(request, env, startDate, endDate);
    }

    // If summary=true, return aggregate stats only
    if (params.get('summary') === 'true') {
      return await handleSummary(request, env, startDate, endDate);
    }

    // Get total count
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM site_visitors WHERE created_at >= ? AND created_at <= ?`
    ).bind(startDate, endDate).first();

    const total = countResult?.total || 0;

    // Get visitors (limited to 500 most recent)
    const visitorsResult = await env.DB.prepare(
      `SELECT id, session_id, visitor_id, page_path, country, device_type, browser, os, 
              referral_code, utm_source, utm_medium, utm_campaign, 
              external_referrer, time_on_page, created_at
       FROM site_visitors 
       WHERE created_at >= ? AND created_at <= ?
       ORDER BY created_at DESC
       LIMIT 500`
    ).bind(startDate, endDate).all();

    return jsonResponse({
      success: true,
      total: total,
      visitors: visitorsResult.results || [],
      startDate: startDate,
      endDate: endDate
    });

  } catch (e) {
    console.error('[SITE-VISITORS] List failed:', e.message);
    return jsonResponse({ success: false, error: 'Failed to load visitors: ' + e.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// Session-grouped data — groups page visits by session_id (or visitor_id fallback)
// ---------------------------------------------------------------------------
async function handleSessions(request, env, startDate, endDate) {
  try {
    // Get all visits in the date range, ordered by session and time
    // Group by session_id if available, otherwise by visitor_id
    const result = await env.DB.prepare(
      `SELECT id, session_id, visitor_id, page_path, country, device_type, browser, os,
              referral_code, external_referrer, time_on_page, created_at
       FROM site_visitors
       WHERE created_at >= ? AND created_at <= ?
         AND ((session_id IS NOT NULL AND session_id != '') OR (visitor_id IS NOT NULL AND visitor_id != ''))
       ORDER BY COALESCE(NULLIF(session_id, ''), visitor_id), created_at ASC
       LIMIT 2000`
    ).bind(startDate, endDate).all();

    const visits = result.results || [];

    // Group by session_id (fall back to visitor_id if session_id is empty)
    const sessionsMap = {};
    for (const v of visits) {
      var groupKey = (v.session_id && v.session_id !== '') ? v.session_id : v.visitor_id;
      if (!groupKey) continue; // skip records with neither
      if (!sessionsMap[groupKey]) {
        sessionsMap[groupKey] = {
          sessionId: v.session_id || v.visitor_id || '',
          visitorId: v.visitor_id || '',
          pages: [],
          firstVisit: v.created_at,
          lastVisit: v.created_at,
          totalTimeOnSite: 0,
          country: v.country,
          deviceType: v.device_type,
          browser: v.browser,
          os: v.os,
          referralCode: v.referral_code,
          externalReferrer: v.external_referrer
        };
      }
      const sess = sessionsMap[groupKey];
      sess.pages.push({
        pagePath: v.page_path,
        timeOnPage: v.time_on_page || null,
        visitedAt: v.created_at
      });
      if (v.time_on_page) sess.totalTimeOnSite += v.time_on_page;
      if (v.created_at < sess.firstVisit) sess.firstVisit = v.created_at;
      if (v.created_at > sess.lastVisit) sess.lastVisit = v.created_at;
    }

    // Convert to array and sort by most recent first
    const sessions = Object.values(sessionsMap).sort(function(a, b) {
      return b.lastVisit.localeCompare(a.lastVisit);
    });

    return jsonResponse({
      success: true,
      sessions: sessions,
      totalSessions: sessions.length,
      startDate: startDate,
      endDate: endDate
    });

  } catch (e) {
    console.error('[SITE-VISITORS] Sessions failed:', e.message);
    return jsonResponse({ success: false, error: 'Failed to load sessions: ' + e.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// Summary stats — aggregate data for dashboard cards
// ---------------------------------------------------------------------------
async function handleSummary(request, env, startDate, endDate) {
  try {
    const totalResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM site_visitors WHERE created_at >= ? AND created_at <= ?`
    ).bind(startDate, endDate).first();

    const countriesResult = await env.DB.prepare(
      `SELECT COUNT(DISTINCT country) as count FROM site_visitors 
       WHERE created_at >= ? AND created_at <= ? AND country IS NOT NULL`
    ).bind(startDate, endDate).first();

    const deviceResult = await env.DB.prepare(
      `SELECT device_type, COUNT(*) as count FROM site_visitors 
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY device_type ORDER BY count DESC`
    ).bind(startDate, endDate).all();

    const browserResult = await env.DB.prepare(
      `SELECT browser, COUNT(*) as count FROM site_visitors 
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY browser ORDER BY count DESC`
    ).bind(startDate, endDate).all();

    const osResult = await env.DB.prepare(
      `SELECT os, COUNT(*) as count FROM site_visitors 
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY os ORDER BY count DESC`
    ).bind(startDate, endDate).all();

    const pagesResult = await env.DB.prepare(
      `SELECT page_path, COUNT(*) as count FROM site_visitors 
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY page_path ORDER BY count DESC LIMIT 10`
    ).bind(startDate, endDate).all();

    const topCountriesResult = await env.DB.prepare(
      `SELECT country, COUNT(*) as count FROM site_visitors 
       WHERE created_at >= ? AND created_at <= ? AND country IS NOT NULL
       GROUP BY country ORDER BY count DESC LIMIT 10`
    ).bind(startDate, endDate).all();

    const referralResult = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM site_visitors 
       WHERE created_at >= ? AND created_at <= ? AND referral_code IS NOT NULL`
    ).bind(startDate, endDate).first();

    const referrersResult = await env.DB.prepare(
      `SELECT external_referrer, COUNT(*) as count FROM site_visitors 
       WHERE created_at >= ? AND created_at <= ? AND external_referrer IS NOT NULL
       GROUP BY external_referrer ORDER BY count DESC LIMIT 10`
    ).bind(startDate, endDate).all();

    // Unique sessions count
    const sessionsResult = await env.DB.prepare(
      `SELECT COUNT(DISTINCT session_id) as count FROM site_visitors 
       WHERE created_at >= ? AND created_at <= ? AND session_id IS NOT NULL AND session_id != ''`
    ).bind(startDate, endDate).first();

    // Unique visitors count (by visitor_id — persistent across sessions)
    const uniqueVisitorsResult = await env.DB.prepare(
      `SELECT COUNT(DISTINCT visitor_id) as count FROM site_visitors 
       WHERE created_at >= ? AND created_at <= ? AND visitor_id IS NOT NULL AND visitor_id != ''`
    ).bind(startDate, endDate).first();

    return jsonResponse({
      success: true,
      summary: {
        totalVisits: totalResult?.total || 0,
        uniqueVisitors: uniqueVisitorsResult?.count || 0,
        uniqueSessions: sessionsResult?.count || 0,
        uniqueCountries: countriesResult?.count || 0,
        referralVisits: referralResult?.count || 0,
        deviceBreakdown: deviceResult.results || [],
        browserBreakdown: browserResult.results || [],
        osBreakdown: osResult.results || [],
        topPages: pagesResult.results || [],
        topCountries: topCountriesResult.results || [],
        topReferrers: referrersResult.results || []
      },
      startDate: startDate,
      endDate: endDate
    });

  } catch (e) {
    console.error('[SITE-VISITORS] Summary failed:', e.message);
    return jsonResponse({ success: false, error: 'Failed to load summary: ' + e.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function onRequestGet(context) {
  const { request, env } = context;
  return handleListVisitors(request, env);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
