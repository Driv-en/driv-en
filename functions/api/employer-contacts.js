// functions/api/employer-contacts.js — Per-org employer contact directory
// GET  /api/employer-contacts?search=...  → search the org's known employer contacts
// POST /api/employer-contacts             → upsert a contact (auto-populated from prior-employer entries)
//
// NOTE: This is per-org today. To make it a shared cross-org directory later,
// change the SELECT to also include rows where org_id = '__shared__' (or null),
// and add a ToS note about contributed company contacts. No schema change needed.

function base64UrlDecode(str) {
  let input = str.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  const bin = atob(input);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function importHmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
}
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, base64UrlDecode(s), new TextEncoder().encode(`${h}.${p}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(p)));
    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return cookies;
}
async function getOrgId(request, env) {
  const url = new URL(request.url);
  let orgId = request.headers.get('x-org-id') || request.headers.get('x-customer-id');
  if (!orgId) orgId = url.searchParams.get('org_id') || url.searchParams.get('orgId');
  if (env.JWT_SECRET) {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies['driv_en_session'];
    if (token) {
      const payload = await verifyJWT(token, env.JWT_SECRET);
      if (payload && !orgId) orgId = payload.org_id || payload.orgId;
    }
  }
  if (!orgId || orgId === 'null' || orgId === 'undefined') orgId = 'org_test';
  return orgId;
}
function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

async function ensureTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS employer_contacts (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      employer_name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      fax TEXT,
      email TEXT,
      address TEXT,
      last_updated TEXT,
      updated_by TEXT,
      source TEXT
    )
  `).run();
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const orgId = await getOrgId(request, env);
  await ensureTable(env);

  if (method === 'GET') {
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') || '').trim();
    try {
      let rows;
      if (search) {
        rows = await env.DB.prepare(
          "SELECT * FROM employer_contacts WHERE org_id = ? AND LOWER(employer_name) LIKE ? ORDER BY employer_name ASC LIMIT 25"
        ).bind(orgId, '%' + search.toLowerCase() + '%').all();
      } else {
        rows = await env.DB.prepare(
          "SELECT * FROM employer_contacts WHERE org_id = ? ORDER BY employer_name ASC LIMIT 100"
        ).bind(orgId).all();
      }
      return jsonResp({ success: true, contacts: rows.results || [] });
    } catch (e) {
      return jsonResp({ success: false, error: e.message }, 500);
    }
  }

  if (method === 'POST') {
    let body;
    try { body = await request.json(); } catch (e) { return jsonResp({ error: 'Invalid JSON' }, 400); }
    const name = (body.employer_name || '').trim();
    if (!name) return jsonResp({ error: 'employer_name required' }, 400);

    const now = new Date().toISOString();
    const updatedBy = body.updated_by || '';
    try {
      const existing = await env.DB.prepare(
        "SELECT id FROM employer_contacts WHERE org_id = ? AND LOWER(employer_name) = ?"
      ).bind(orgId, name.toLowerCase()).first();

      if (existing && existing.id) {
        await env.DB.prepare(
          "UPDATE employer_contacts SET contact_name = ?, phone = ?, fax = ?, email = ?, address = ?, last_updated = ?, updated_by = ?, source = ? WHERE id = ? AND org_id = ?"
        ).bind(
          body.contact_name || null, body.phone || null, body.fax || null, body.email || null,
          body.address || null, now, updatedBy, body.source || 'manual', existing.id, orgId
        ).run();
        return jsonResp({ success: true, id: existing.id, updated: true });
      } else {
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO employer_contacts (id, org_id, employer_name, contact_name, phone, fax, email, address, last_updated, updated_by, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          id, orgId, name, body.contact_name || null, body.phone || null, body.fax || null,
          body.email || null, body.address || null, now, updatedBy, body.source || 'manual'
        ).run();
        return jsonResp({ success: true, id, created: true });
      }
    } catch (e) {
      return jsonResp({ success: false, error: e.message }, 500);
    }
  }

  return jsonResp({ error: 'Method not allowed' }, 405);
}
