// ============================================================================
// Pages Function: /api/admin/w9-download
// ============================================================================
// PURPOSE: Downloads a W-9 PDF from R2 for a specific referral partner.
//   GET /api/admin/w9-download?partnerId=<uuid>
//
// AUTH: Verifies the caller is logged in as DRIV-EN Founder via /auth/session.
//
// PAGES PROJECT BINDINGS:
//   - D1: DB → driv-en-db
//   - R2: W9_BUCKET → w9-uploads
//
// LAST UPDATED: September 3, 2026
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

// ---------------------------------------------------------------------------
// Auth check — verify the caller is a DRIV-EN Founder
// ---------------------------------------------------------------------------
async function verifyAdmin(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  try {
    const resp = await fetch('https://' + (request.headers.get('host') || 'driv-en.com') + '/auth/session', {
      headers: { 'Cookie': cookieHeader }
    });
    const data = await resp.json();
    if (data.authenticated && data.user) {
      const role = data.user.role || '';
      // Only DRIV-EN Founder can download W-9s — this is platform-level data.
      if (role === 'DRIV-EN Founder') return data.user;
    }
  } catch (e) {
    console.error('[W9-DOWNLOAD] Auth check failed:', e.message);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function onRequestGet(context) {
  const { request, env } = context;

  // Auth check
  const user = await verifyAdmin(request, env);
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
    // Key format: w9/<uuid>-<original-filename>.pdf
    const keyParts = partner.w9_attachment.split('/');
    const fileNamePart = keyParts[keyParts.length - 1] || 'w9.pdf';
    // Remove the UUID prefix (first 36 chars + dash)
    const originalName = fileNamePart.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/, '') || 'w9.pdf';
    const safeName = (partner.partner_name || 'partner').replace(/[^a-zA-Z0-9]/g, '_');

    // Return the PDF file
    const headers = new Headers();
    headers.set('Content-Type', r2Object.httpMetadata?.contentType || 'application/pdf');
    headers.set('Content-Disposition', 'attachment; filename="W9-' + safeName + '.pdf"');
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
          'Content-Disposition': 'attachment; filename="W9-' + safeName + '.pdf"',
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
