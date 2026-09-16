// ============================================================================
// Pages Function: /api/admin/customers
// ============================================================================
// PURPOSE: Admin API for the Owner Dashboard's Customers section.
//   GET  /api/admin/customers  — List all customers with org + subscription info
//
// AUTH: Verifies the caller is logged in as DRIV-EN Founder by parsing
//   the driv_en_session JWT cookie directly using Web Crypto API.
//   Requires JWT_SECRET to be set as a secret on the Pages project.
//
// PAGES PROJECT BINDINGS:
//   - D1: DB → driv-en-db
//   - Secret: JWT_SECRET (same value as the auth worker)
//   - Var: SENDGRID_FROM_EMAIL = noreply@driv-en.com
//   - Var: SUPPORT_CONTACT = support@driv-en.com
//
// LAST UPDATED: September 16, 2026 (Session 38 — fixed broken JOIN on
//   organizations.admin_email which does not exist; now queries customers
//   directly and enriches from organizations by id/name match)
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
// logError — writes to error_log D1 table (Error Logs tab)
// ---------------------------------------------------------------------------
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
          '\nCF-Ray: ' + (request.headers.get('CF-Ray') || 'N/A') +
          '\nTime: ' + new Date().toISOString();
      } catch (u) { /* ignore */ }
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
    console.error('[ADMIN-CUSTOMERS] JWT verify error:', e.message);
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
    console.error('[ADMIN-CUSTOMERS] JWT_SECRET is not set on the Pages project');
    return null;
  }
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
// Main handler
// ---------------------------------------------------------------------------
export async function onRequestGet(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const founder = await verifyFounder(request, env);
    if (!founder) {
      return jsonResponse({ success: false, error: 'Unauthorized — DRIV-EN Founder access required' }, 401);
    }

    // Query customers table directly (organizations table has no admin_email column)
    let customers = [];
    try {
      const result = await env.DB.prepare(
        `SELECT c.customer_id, c.company_name, c.admin_email, c.admin_phone,
                c.billing_address, c.city, c.state, c.zip,
                c.subscription_type, c.status AS customer_status,
                c.activation_date, c.expiration_date, c.created_at
         FROM customers c
         ORDER BY c.created_at DESC`
      ).all();
      customers = result.results || [];
    } catch (dbErr) {
      // customers table may not exist yet — return empty list
      console.log('[ADMIN-CUSTOMERS] customers table query error:', dbErr.message);
    }

    // Also query organizations table (for org_id, subscription_status, modules)
    let orgMap = {};
    try {
      const orgResult = await env.DB.prepare(
        `SELECT id, name, status, subscription_status, activated_modules,
                activation_code, activation_complete, free_until, paid_until, created_at
         FROM organizations`
      ).all();
      if (orgResult.results) {
        for (const o of orgResult.results) {
          orgMap[o.id] = o;
        }
      }
    } catch (dbErr) {
      console.log('[ADMIN-CUSTOMERS] organizations query error:', dbErr.message);
    }

    // Get employee counts per org (from employees-db if available, or users table)
    let employeeMap = {};
    try {
      const empCounts = await env.DB.prepare(
        `SELECT org_id, COUNT(*) as emp_count FROM users GROUP BY org_id`
      ).all();
      if (empCounts.results) {
        for (const ec of empCounts.results) {
          employeeMap[ec.org_id] = ec.emp_count;
        }
      }
    } catch (dbErr) { /* users table may not exist */ }

    // Get order counts per customer (if orders table exists)
    let orderMap = {};
    try {
      const orderCounts = await env.DB.prepare(
        `SELECT customer_id, COUNT(*) as order_count, SUM(invoice_total) as total_spent
         FROM orders GROUP BY customer_id`
      ).all();
      if (orderCounts.results) {
        for (const oc of orderCounts.results) {
          orderMap[oc.customer_id] = { order_count: oc.order_count, total_spent: oc.total_spent || 0 };
        }
      }
    } catch (dbErr) {
      // orders table may not exist — skip
    }

    // Enrich customers with org data, employee counts, and order data
    const enrichedCustomers = customers.map(c => {
      // Try to find matching org by name (customers.company_name → organizations.name)
      var org = orgMap[c.customer_id] || null;
      // Also try matching by email if no org_id match
      if (!org) {
        for (var oid in orgMap) {
          if (orgMap[oid].name && c.company_name && orgMap[oid].name.toLowerCase() === c.company_name.toLowerCase()) {
            org = orgMap[oid];
            break;
          }
        }
      }
      var oc = orderMap[c.customer_id] || { order_count: 0, total_spent: 0 };
      var empCount = org ? (employeeMap[org.id] || 0) : 0;
      return {
        ...c,
        org_id: org ? org.id : null,
        subscription_status: org ? (org.subscription_status || org.status) : (c.customer_status || 'unknown'),
        activated_modules: org ? org.activated_modules : null,
        activation_code: org ? org.activation_code : null,
        activation_complete: org ? org.activation_complete : null,
        free_until: org ? org.free_until : null,
        paid_until: org ? org.paid_until : null,
        employee_count: empCount,
        order_count: oc.order_count,
        total_spent: oc.total_spent
      };
    });

    return jsonResponse({ success: true, customers: enrichedCustomers, total: enrichedCustomers.length }, 200);
  } catch (err) {
    console.error('[ADMIN-CUSTOMERS] Error:', err.message, err.stack);
    await logError(env, 'Pages Function: /api/admin/customers', err, request);
    return jsonResponse({ success: false, error: 'An internal error occurred. DRIV-EN Support has been notified.' }, 500);
  }
}

// Handle POST (for future customer management actions)
export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const founder = await verifyFounder(request, env);
    if (!founder) {
      return jsonResponse({ success: false, error: 'Unauthorized — DRIV-EN Founder access required' }, 401);
    }

    const body = await request.json();
    // Future: handle customer actions (update status, etc.)
    return jsonResponse({ success: false, error: 'No POST actions implemented yet' }, 400);
  } catch (err) {
    console.error('[ADMIN-CUSTOMERS] POST Error:', err.message, err.stack);
    await logError(env, 'Pages Function: /api/admin/customers (POST)', err, request);
    return jsonResponse({ success: false, error: 'An internal error occurred. DRIV-EN Support has been notified.' }, 500);
  }
}
