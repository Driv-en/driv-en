// ============================================================================
// Pages Function: /api/admin/site-visitors
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.driv-en.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cookie, x-org-id, x-user-id',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function logError(env, source, err, request) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS error_log (
        id TEXT PRIMARY KEY, source TEXT, error_message TEXT,
        stack_trace TEXT, severity TEXT DEFAULT 'error',
        resolved INTEGER DEFAULT 0, created_at TEXT
      )`
    ).run();
    const errorId = 'ERR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    let stackTrace = (err && err.stack) ? err.stack : 'No stack trace';
    if (request) {
      try {
        const url = new URL(request.url);
        stackTrace += '\n\n--- REQUEST CONTEXT ---' +
          '\nURL: ' + request.url +
          '\nMethod: ' + request.method +
          '\nPath: ' + url.pathname +
          '\nUser-Agent: ' + (request.headers.get('User-Agent') || 'N/A') +
          '\nTime: ' + new Date().toISOString();
      } catch (u) {}
    }
    await env.DB.prepare(
      `INSERT INTO error_log (id, source, error_message, stack_trace, severity, resolved, created_at)
       VALUES (?, ?, ?, ?, 'error', 0, ?)`
    ).bind(errorId, source, (err && err.message) ? err.message : 'Unknown error',
           stackTrace, new Date().toISOString()).run();
  } catch (dbErr) {
    console.error('Failed to write to error_log:', dbErr.message);
  }
}

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
  if (env.JWT_SECRET) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookies(cookieHeader);
    const token = cookies['driv_en_session'];

    if (token) {
      const payload = await verifyJwt(token, env.JWT_SECRET);
      if (payload && (payload.role_id === 'RO-Founder' || payload.role_id === 'RO_Founder') && payload.org_id === 'org_dsi') {
        return payload;
      }
    }
  }

  const reqOrgId = (request.headers.get('x-org-id') || '').trim().toLowerCase();
  const reqUserId = (request.headers.get('x-user-id') || '').trim();

  if (reqOrgId === 'org_dsi' && reqUserId) {
    return { role_id: 'RO-Founder', org_id: 'org_dsi', user_id: reqUserId };
  }

  return null;
}

// ---------------------------------------------------------------------------
// GET /api/admin/site-visitors — Main Visitor Query Handler
// ---------------------------------------------------------------------------
async function handleListVisitors(request, env) {
  const user = await verifyFounder(request, env);
  if (!user) {
    return jsonResponse({ success: false, error: 'Unauthorized — DRIV-EN Founder access required' }, 403);
  }

  try {
    const url = new URL(request.url);
    const params = url.searchParams;

    const days = params.get('days');
    let start = params.get('start');
    let end = params.get('end');
    const limit = Math.min(parseInt(params.get('limit') || '5000', 10), 10000);

    let startDateStr, endDateStr;

    if (start || end) {
      startDateStr = start ? start.split('T')[0] : '1970-01-01';
      endDateStr = end ? end.split('T')[0] : new Date().toISOString().split('T')[0];
    } else if (days) {
      const numDays = parseInt(days, 10) || 30;
      const d = new Date();
      d.setDate(d.getDate() - numDays);
      startDateStr = d.toISOString().split('T')[0];
      endDateStr = new Date().toISOString().split('T')[0];
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDateStr = thirtyDaysAgo.toISOString().split('T')[0];
      endDateStr = new Date().toISOString().split('T')[0];
    }

    if (params.get('sessions') === 'true') {
      return await handleSessions(request, env, startDateStr, endDateStr);
    }

    if (params.get('summary') === 'true') {
      return await handleSummary(request, env, startDateStr, endDateStr);
    }

    // Direct SQLite date query matching formatted YYYY-MM-DD bounds
    const visitorsResult = await env.DB.prepare(
      `SELECT id, session_id, visitor_id, page_path, country, device_type, browser, os, 
              referral_code, utm_source, utm_medium, utm_campaign, 
              external_referrer, time_on_page as duration_seconds, created_at
       FROM site_visitors 
       WHERE date(created_at) >= date(?) 
         AND date(created_at) <= date(?)
       ORDER BY created_at DESC
       LIMIT ?`
    ).bind(startDateStr, endDateStr, limit).all();

    const visitors = visitorsResult.results || [];

    const totalCountResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM site_visitors 
       WHERE date(created_at) >= date(?) 
         AND date(created_at) <= date(?)`
    ).bind(startDateStr, endDateStr).first();

    const totalVisits = totalCountResult?.total || visitors.length;
    const uniqueVisitors = new Set(visitors.map(v => v.visitor_id || v.session_id || v.id).filter(Boolean)).size;
    const uniqueSessions = new Set(visitors.map(v => v.session_id || v.visitor_id).filter(Boolean)).size;
    const uniqueCountries = new Set(visitors.map(v => v.country).filter(Boolean)).size;
    const referralVisits = visitors.filter(v => v.referral_code || (v.utm_source && v.utm_source !== 'Direct')).length;

    const getTop = (arr, key) => {
      const counts = {};
      arr.forEach(item => {
        const val = item[key] || 'Unknown';
        counts[val] = (counts[val] || 0) + 1;
      });
      return Object.keys(counts)
        .map(k => ({ [key]: k, count: counts[k] }))
        .sort((a, b) => b.count - a.count);
    };

    const topPages = getTop(visitors, 'page_path');
    const topCountries = getTop(visitors, 'country');
    const browserBreakdown = getTop(visitors, 'browser');
    const osBreakdown = getTop(visitors, 'os');

    const topDevice = getTop(visitors, 'device_type')[0]?.device_type || '—';
    const topBrowser = browserBreakdown[0]?.browser || '—';
    const topOS = osBreakdown[0]?.os || '—';

    // Daily Trend Chart query
    const chartResult = await env.DB.prepare(
      `SELECT date(created_at) AS visit_date, COUNT(*) AS count
       FROM site_visitors
       WHERE date(created_at) >= date(?) 
         AND date(created_at) <= date(?)
       GROUP BY date(created_at)
       ORDER BY visit_date ASC`
    ).bind(startDateStr, endDateStr).all();

    // Visitor Sessions query
    const sessionsResult = await env.DB.prepare(
      `SELECT id, session_id, visitor_id, page_path, country, device_type, browser, os,
              referral_code, external_referrer, time_on_page, created_at
       FROM site_visitors
       WHERE date(created_at) >= date(?) 
         AND date(created_at) <= date(?)
         AND ((session_id IS NOT NULL AND session_id != '') OR (visitor_id IS NOT NULL AND visitor_id != ''))
       ORDER BY COALESCE(NULLIF(session_id, ''), visitor_id), created_at ASC
       LIMIT 5000`
    ).bind(startDateStr, endDateStr).all();

    const visits = sessionsResult.results || [];
    const sessionsMap = {};

    for (const v of visits) {
      const groupKey = (v.session_id && v.session_id !== '') ? v.session_id : v.visitor_id;
      if (!groupKey) continue;
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

    const sessions = Object.values(sessionsMap).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));

    return jsonResponse({
      success: true,
      total: totalVisits,
      summary: {
        totalVisits,
        uniqueVisitors,
        uniqueSessions,
        uniqueCountries,
        referralVisits,
        topDevice,
        topBrowser,
        topOS,
        topPages,
        topCountries,
        browserBreakdown,
        osBreakdown
      },
      visitors: visitors,
      sessions: sessions,
      dailyChart: chartResult.results || [],
      startDate: startDateStr,
      endDate: endDateStr
    });

  } catch (e) {
    console.error('[SITE-VISITORS] List failed:', e.message);
    await logError(env, 'pages:site-visitors (list)', e, request);
    return jsonResponse({ success: false, error: 'Failed to load visitors: ' + e.message }, 500);
  }
}

async function handleSessions(request, env, startDateStr, endDateStr) {
  try {
    const result = await env.DB.prepare(
      `SELECT id, session_id, visitor_id, page_path, country, device_type, browser, os,
              referral_code, external_referrer, time_on_page, created_at
       FROM site_visitors
       WHERE date(created_at) >= date(?) 
         AND date(created_at) <= date(?)
         AND ((session_id IS NOT NULL AND session_id != '') OR (visitor_id IS NOT NULL AND visitor_id != ''))
       ORDER BY COALESCE(NULLIF(session_id, ''), visitor_id), created_at ASC
       LIMIT 5000`
    ).bind(startDateStr, endDateStr).all();

    const visits = result.results || [];
    const sessionsMap = {};

    for (const v of visits) {
      const groupKey = (v.session_id && v.session_id !== '') ? v.session_id : v.visitor_id;
      if (!groupKey) continue;
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

    const sessions = Object.values(sessionsMap).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));

    return jsonResponse({
      success: true,
      sessions: sessions,
      totalSessions: sessions.length,
      startDate: startDateStr,
      endDate: endDateStr
    });

  } catch (e) {
    console.error('[SITE-VISITORS] Sessions failed:', e.message);
    await logError(env, 'pages:site-visitors (sessions)', e, request);
    return jsonResponse({ success: false, error: 'Failed to load sessions: ' + e.message }, 500);
  }
}

async function handleSummary(request, env, startDateStr, endDateStr) {
  try {
    const bindParams = [startDateStr, endDateStr];

    const totalResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM site_visitors 
       WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)`
    ).bind(...bindParams).first();

    const countriesResult = await env.DB.prepare(
      `SELECT COUNT(DISTINCT country) as count FROM site_visitors 
       WHERE date(created_at) >= date(?) AND date(created_at) <= date(?) AND country IS NOT NULL`
    ).bind(...bindParams).first();

    const deviceResult = await env.DB.prepare(
      `SELECT device_type, COUNT(*) as count FROM site_visitors 
       WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
       GROUP BY device_type ORDER BY count DESC`
    ).bind(...bindParams).all();

    const browserResult = await env.DB.prepare(
      `SELECT browser, COUNT(*) as count FROM site_visitors 
       WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
       GROUP BY browser ORDER BY count DESC`
    ).bind(...bindParams).all();

    const osResult = await env.DB.prepare(
      `SELECT os, COUNT(*) as count FROM site_visitors 
       WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
       GROUP BY os ORDER BY count DESC`
    ).bind(...bindParams).all();

    const pagesResult = await env.DB.prepare(
      `SELECT page_path, COUNT(*) as count FROM site_visitors 
       WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
       GROUP BY page_path ORDER BY count DESC LIMIT 10`
    ).bind(...bindParams).all();

    const topCountriesResult = await env.DB.prepare(
      `SELECT country, COUNT(*) as count FROM site_visitors 
       WHERE date(created_at) >= date(?) AND date(created_at) <= date(?) AND country IS NOT NULL
       GROUP BY country ORDER BY count DESC LIMIT 10`
    ).bind(...bindParams).all();

    const referralResult = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM site_visitors 
       WHERE date(created_at) >= date(?) AND date(created_at) <= date(?) AND referral_code IS NOT NULL`
    ).bind(...bindParams).first();

    const referrersResult = await env.DB.prepare(
      `SELECT external_referrer, COUNT(*) as count FROM site_visitors 
       WHERE date(created_at) >= date(?) AND date(created_at) <= date(?) AND external_referrer IS NOT NULL
       GROUP BY external_referrer ORDER BY count DESC LIMIT 10`
    ).bind(...bindParams).all();

    const sessionsResult = await env.DB.prepare(
      `SELECT COUNT(DISTINCT session_id) as count FROM site_visitors 
       WHERE date(created_at) >= date(?) AND date(created_at) <= date(?) AND session_id IS NOT NULL AND session_id != ''`
    ).bind(...bindParams).first();

    const uniqueVisitorsResult = await env.DB.prepare(
      `SELECT COUNT(DISTINCT visitor_id) as count FROM site_visitors 
       WHERE date(created_at) >= date(?) AND date(created_at) <= date(?) AND visitor_id IS NOT NULL AND visitor_id != ''`
    ).bind(...bindParams).first();

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
      startDate: startDateStr,
      endDate: endDateStr
    });

  } catch (e) {
    console.error('[SITE-VISITORS] Summary failed:', e.message);
    await logError(env, 'pages:site-visitors (summary)', e, request);
    return jsonResponse({ success: false, error: 'Failed to load summary: ' + e.message }, 500);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  return handleListVisitors(request, env);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
