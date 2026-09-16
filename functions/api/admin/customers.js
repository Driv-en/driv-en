// ============================================================================
// Pages Function: /api/admin/customers
// ============================================================================
// PURPOSE: Admin API for the Owner Dashboard's Customers section.
//   GET  /api/admin/customers  — List all customers (organizations) with
//   subscription info, employee counts, and order data.
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
// LAST UPDATED: September 16, 2026 (Session 38) — rewrote to read from the
//   `organizations` table (the real customer table driv-en uses). The old
//   version JOINed customers→organizations on admin_email which did not
//   exist, then read only from `customers` which is not the live table.
//   Fixed: removed admin_email from organizations query (column doesn't exist
//   in deployed schema); admin email now sourced from users table via org_id.
//   Updated: filters out the platform owner org (org_type = 'platform') so
//   the founder company does not appear as a customer.
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

    // =====================================================================
    // PRIMARY SOURCE: organizations table — this is the real customer table.
    // Every org that signs up / activates is a customer.
    // NOTE: The deployed organizations table does NOT have an admin_email
    // column. The admin email lives in the users table (via org_id).
    // The platform owner org (org_type = 'platform') is excluded.
    // =====================================================================
    let orgs = [];
    try {
      const result = await env.DB.prepare(
        `SELECT id, name, plan, status, subscription_status,
                activated_modules, activation_code, activation_complete,
                free_until, paid_until, created_at
         FROM organizations
         WHERE org_type IS NULL OR org_type != 'platform'
         ORDER BY created_at DESC`
      ).all();
      orgs = result.results || [];
    } catch (dbErr) {
      console.log('[ADMIN-CUSTOMERS] organizations query error:', dbErr.message);
    }

    // =====================================================================
    // ENRICHMENT 1: admin emails + employee counts per org from users table
    // The admin is the user with role RO-Founder or RO-admin; fall back to
    // the earliest-created user in the org.
    // =====================================================================
    let userMap = {};
    let employeeMap = {};
    try {
      const users = await env.DB.prepare(
        `SELECT u.org_id, u.email, u.first_name, u.last_name, u.role_id, u.created_at
         FROM users u
         ORDER BY u.created_at ASC`
      ).all();
      if (users.results) {
        for (const u of users.results) {
          if (!u.org_id) continue;
          // Count employees per org
          employeeMap[u.org_id] = (employeeMap[u.org_id] || 0) + 1;
          // Pick admin: prefer Founder role, then Admin role, then first user
          const isFounder = u.role_id === 'RO-Founder';
          const isAdmin = u.role_id === 'RO-admin';
          const existing = userMap[u.org_id];
          if (!existing) {
            userMap[u.org_id] = u;
          } else if (isFounder || (isAdmin && existing.role_id !== 'RO-Founder')) {
            userMap[u.org_id] = u;
          }
        }
      }
    } catch (dbErr) { /* users table may not exist */ }

    // =====================================================================
    // ENRICHMENT 2: order counts per org from orders table (if it exists)
    // =====================================================================
    let orderMap = {};
    try {
      const orderCounts = await env.DB.prepare(
        `SELECT org_id, COUNT(*) as order_count, SUM(invoice_total) as total_spent
         FROM orders GROUP BY org_id`
      ).all();
      if (orderCounts.results) {
        for (const oc of orderCounts.results) {
          orderMap[oc.org_id] = { order_count: oc.order_count, total_spent: oc.total_spent || 0 };
        }
      }
    } catch (dbErr) {
      // orders table may not exist — skip
    }

    // =====================================================================
    // ENRICHMENT 3: customers table (legacy/checkout records) — match by
    // admin_email so any data there is merged in
    // =====================================================================
    let customerMap = {};
    try {
      const custResult = await env.DB.prepare(
        `SELECT customer_id, company_name, admin_email, admin_phone,
                billing_address, city, state, zip,
                subscription_type, status, activation_date, expiration_date
         FROM customers`
      ).all();
      if (custResult.results) {
        for (const c of custResult.results) {
          if (c.admin_email) customerMap[c.admin_email.toLowerCase()] = c;
        }
      }
    } catch (dbErr) {
      // customers table may not exist — skip
    }

    // =====================================================================
    // Build the customer list from organizations
    // =====================================================================
    const customers = orgs.map(o => {
      const legacy = o.admin_email ? customerMap[o.admin_email.toLowerCase()] : null;
      const adminUser = userMap[o.id] || null;
      const empCount = employeeMap[o.id] || 0;
      const oc = orderMap[o.id] || { order_count: 0, total_spent: 0 };

      // Parse activated_modules (may be JSON string or comma list)
      let modules = o.activated_modules;
      if (modules) {
        try { modules = JSON.parse(modules); } catch (e) {
          modules = String(modules).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        }
      }

      const subStatus = o.subscription_status || o.status || (legacy ? legacy.status : null) || 'unknown';

      return {
        // Identity
        org_id: o.id,
        customer_id: legacy ? legacy.customer_id : o.id,
        company_name: o.name || (legacy ? legacy.company_name : null) || 'Unknown',
        admin_email: (adminUser && adminUser.email) || (legacy ? legacy.admin_email : null),
        email: (adminUser && adminUser.email) || (legacy ? legacy.admin_email : null), // alias for dashboard
        contact_email: (adminUser && adminUser.email) || (legacy ? legacy.admin_email : null), // alias for dashboard
        admin_name: adminUser ? [adminUser.first_name, adminUser.last_name].filter(Boolean).join(' ') : null,
        contact_name: adminUser ? [adminUser.first_name, adminUser.last_name].filter(Boolean).join(' ') : null, // alias for dashboard
        admin_phone: legacy ? legacy.admin_phone : null,
        billing_address: legacy ? legacy.billing_address : null,
        city: legacy ? legacy.city : null,
        state: legacy ? legacy.state : null,
        zip: legacy ? legacy.zip : null,

        // Subscription
        subscription_status: subStatus,
        subscription_type: legacy ? legacy.subscription_type : o.plan || null,
        activation_date: legacy ? legacy.activation_date : (o.created_at || null),
        expiration_date: legacy ? legacy.expiration_date : (o.paid_until || o.free_until || null),
        free_until: o.free_until || null,
        paid_until: o.paid_until || null,
        activated_modules: modules || null,
        activation_code: o.activation_code || null,
        activation_complete: o.activation_complete || null,

        // Counts
        employee_count: empCount,
        order_count: oc.order_count,
        total_spent: oc.total_spent,
        asset_count: 0,
        pm_count: 0,
        wo_count: 0,
        transfer_count: 0,
        fuel_count: 0,

        // Meta
        created_at: o.created_at || null
      };
    });

    return jsonResponse({ success: true, customers: customers, total: customers.length }, 200);
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
