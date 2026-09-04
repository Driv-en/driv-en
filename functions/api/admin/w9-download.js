// ============================================================================
// Pages Function: /api/admin/w9-download
// ============================================================================
// PURPOSE: Downloads a W-9 PDF from R2 for a specific referral partner.
//   GET /api/admin/w9-download?partnerId=<uuid>
//
// AUTH: Verifies the caller is logged in as DRIV-EN Founder by parsing
//   the driv_en_session JWT cookie directly using Web Crypto API.
//   Requires JWT_SECRET to be set as a secret on the Pages project.
//
// PAGES PROJECT BINDINGS:
//   - D1: DB → driv-en-db
//   - R2: W9_BUCKET → w9-uploads
//   - Secret: JWT_SECRET (same value as the auth worker)
//
// LAST UPDATED: September 4, 2026
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.driv-en.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};

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
    console.error('[W9-DOWNLOAD] JWT verify error:', e.message);
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
    console.error('[W9-DOWNLOAD] JWT_SECRET is not set on the Pages project');
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
// Main handler
// ---------------------------------------------------------------------------
export async function onRequestGet(context) {
  const { request, env } = context;

  // Auth check
  const user = await verifyFounder(request, env);
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized — DRIV-EN Founder access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  const url = new URL(request.url);
  const partnerId = url.searchParams.get('partnerId');

  if (!partnerId) {
    return new Response(JSON.stringify({ success: false, error: 'partnerId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  // Fetch the partner record to get the W-9 attachment key
  const partner = await env.DB.prepare(
    'SELECT partner_name, w9_attachment FROM referral_partners WHERE id = ?'
  ).bind(partnerId).first();

  if (!partner) {
    return new Response(JSON.stringify({ success: false, error: 'Partner not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  if (!partner.w9_attachment) {
    return new Response(JSON.stringify({ success: false, error: 'No W-9 on file for this partner' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  // Check if w9_attachment is an R2 key (starts with "w9/") or base64 data
  if (partner.w9_attachment.startsWith('w9/')) {
    // R2 storage — fetch from R2
    if (!env.W9_BUCKET) {
      return new Response(JSON.stringify({ success: false, error: 'R2 bucket not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    const r2Object = await env.W9_BUCKET.get(partner.w9_attachment);
    if (!r2Object) {
      return new Response(JSON.stringify({ success: false, error: 'W-9 file not found in R2 storage' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // Extract original filename from the R2 key
    const keyParts = partner.w9_attachment.split('/');
    const fileNamePart = keyParts[keyParts.length - 1] || 'w9.pdf';
    const originalName = fileNamePart.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/, '') || 'w9.pdf';
    const safeName = (partner.partner_name || 'partner').replace(/[^a-zA-Z0-9]/g, '_');

    // Return the PDF file — inline so it opens in the browser for viewing
    const headers = new Headers();
    headers.set('Content-Type', r2Object.httpMetadata?.contentType || 'application/pdf');
    headers.set('Content-Disposition', 'inline; filename="W9-' + safeName + '.pdf"');
    headers.set('Content-Length', r2Object.size.toString());

    return new Response(r2Object.body, {
      status: 200,
      headers
    });

  } else {
    // Base64 storage (fallback) — decode and return
    try {
      const binary = atob(partner.w9_attachment);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const safeName = (partner.partner_name || 'partner').replace(/[^a-zA-Z0-9]/g, '_');

      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="W9-' + safeName + '.pdf"',
          'Content-Length': bytes.length.toString()
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to decode W-9 data: ' + e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
