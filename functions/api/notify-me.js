// ============================================================================
// Pages Function: /api/notify-me
// ============================================================================
// PURPOSE: When a visitor on the Module Selection page checks "Notify me
//   when this launches" on one or more Coming Soon modules and submits their
//   email, this function:
//   1. Validates the email and module list
//   2. Stores the notification request in D1 (notify_requests table)
//   3. Sends an email to support@driv-en.com via SendGrid with the details
//   4. Sends a confirmation email to the visitor
//
// POST /api/notify-me
// Body: { "email": "user@example.com", "modules": ["Safety Training", "HAZCOM"] }
// Response: { "success": true }
//        or { "success": false, "error": "Invalid email" }
//
// PAGES PROJECT BINDINGS (configured on the "driv-en" Pages project):
//   - D1: DB → driv-en-db
//   - Secret: SENDGRID_API_KEY
//   - Var: SENDGRID_FROM_EMAIL = noreply@driv-en.com
//   - Var: SUPPORT_CONTACT = support@driv-en.com
//
// CREATED: 2026-09-26
// HARDENED: 2026-09-26 — transactional success semantics, CORS allowlist,
//   malformed-JSON handling, abuse protection, module dedup, email delivery
//   validation.
// HARDENED v2: 2026-09-26 — safe email coercion, fail-closed rate limiting,
//   pending→sent status flow for atomicity, full HTML-escape of module
//   names, widened CORS Allow-Headers.
// ============================================================================

// ---------------------------------------------------------------------------
// CORS — allowlist of valid origins (www + apex + preview environments)
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  'https://www.driv-en.com',
  'https://driv-en.com',
  'https://preview.driv-en.com',
  'https://staging.driv-en.com'
];

function getCORSHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  // Echo the origin only if it's in the allowlist
  const allowedOrigin = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(obj, status, corsHeaders) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// ---------------------------------------------------------------------------
// logError — writes to error_log D1 table
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
// SendGrid email helper — returns { ok, status, error }
// ---------------------------------------------------------------------------
async function sendEmail(apiKey, fromEmail, toEmail, toName, subject, htmlContent) {
  const personalization = { to: [{ email: toEmail }] };
  if (toName) personalization.to[0].name = toName;

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [personalization],
        from: { email: fromEmail, name: 'DRIV\u2011EN Platform' },
        subject: subject,
        content: [{ type: 'text/html', value: htmlContent }]
      })
    });

    if (!res.ok) {
      // Read error body for diagnostics
      let errBody = '';
      try { errBody = await res.text(); } catch (e) { /* ignore */ }
      return {
        ok: false,
        status: res.status,
        error: 'SendGrid returned ' + res.status + ': ' + errBody.substring(0, 500)
      };
    }

    return { ok: true, status: res.status, error: null };
  } catch (fetchErr) {
    return {
      ok: false,
      status: 0,
      error: 'Network error contacting SendGrid: ' + (fetchErr.message || 'unknown')
    };
  }
}

// ---------------------------------------------------------------------------
// DRIV-EN logo HTML — centered at the top of every email body
// ---------------------------------------------------------------------------
const EMAIL_LOGO_HTML = '<div style="text-align:center;padding:24px 0 16px 0;">' +
  '<img src="https://www.driv-en.com/assets/logo.png?v=2026" alt="DRIV-EN" style="display:block;margin:0 auto;max-width:200px;">' +
  '</div>';

// ---------------------------------------------------------------------------
// Build notification email to support@driv-en.com
// ---------------------------------------------------------------------------
function buildSupportNotificationEmail(visitorEmail, modules) {
  const moduleList = modules.map(m => '<li>' + m + '</li>').join('');
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;">
  ${EMAIL_LOGO_HTML}
  <h2 style="color:#111;">New Module Launch Notification Request</h2>
  <p>A visitor has requested to be notified when the following modules launch:</p>
  <ul>${moduleList}</ul>
  <p><strong>Visitor email:</strong> ${visitorEmail}</p>
  <p><strong>Submitted:</strong> ${new Date().toISOString()}</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:24px 0;">
  <p style="font-size:13px;color:#888;">This request was submitted from the Module Selection page on driv-en.com.</p>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Build visitor confirmation email
// ---------------------------------------------------------------------------
function buildVisitorConfirmationEmail(modules) {
  const moduleList = modules.map(m => '<li>' + m + '</li>').join('');
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;">
  ${EMAIL_LOGO_HTML}
  <h2 style="color:#111;">We'll Keep You Posted!</h2>
  <p>Thank you for your interest in DRIV\u2011EN. You've requested to be notified when the following modules launch:</p>
  <ul>${moduleList}</ul>
  <p>We'll send you an email as soon as each module is available. In the meantime, if you have any questions, feel free to reach out to us at <a href="mailto:support@driv-en.com">support@driv-en.com</a>.</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:24px 0;">
  <p style="font-size:13px;color:#888;">DRIV\u2011EN — Digital Safety Inspection LLC</p>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Rate limiting — check recent submissions per email using D1
// Returns true if the email is allowed, false if rate-limited.
// Limit: max 3 submissions per email per hour.
// ---------------------------------------------------------------------------
async function checkRateLimit(env, email) {
  try {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const result = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM notify_requests
       WHERE email = ? AND created_at > ?`
    ).bind(email, oneHourAgo).first();

    return (result && result.count < 3);
  } catch (e) {
    // Fail closed — if D1 is unavailable, block the request rather than
    // silently disabling abuse protection on a public endpoint.
    console.error('Rate limit check failed (D1 unavailable):', e.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function onRequestPost({ request, env }) {
  const corsHeaders = getCORSHeaders(request);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // --- Parse body with explicit malformed-JSON handling ---
  let body;
  try {
    body = await request.json();
  } catch (parseErr) {
    return jsonResponse(
      { success: false, error: 'Invalid request body. Please send valid JSON.' },
      400, corsHeaders
    );
  }

  // --- Validate body is an object ---
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse(
      { success: false, error: 'Invalid request format.' },
      400, corsHeaders
    );
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const modules = body.modules;

  // --- Validate email ---
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ success: false, error: 'Invalid email address' }, 400, corsHeaders);
  }

  // --- Validate modules array ---
  if (!Array.isArray(modules) || modules.length === 0) {
    return jsonResponse({ success: false, error: 'No modules selected' }, 400, corsHeaders);
  }

  // --- Sanitize + deduplicate module names ---
  // Full HTML-escape to prevent injection in email body templates.
  const seenModules = new Set();
  const cleanModules = [];
  for (const m of modules) {
    if (typeof m !== 'string' || m.length === 0 || m.length >= 100) continue;
    // Full HTML entity escaping — covers all HTML contexts
    const escaped = m
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .trim();
    if (escaped.length === 0) continue;
    const lower = escaped.toLowerCase();
    if (seenModules.has(lower)) continue; // skip duplicates
    seenModules.add(lower);
    cleanModules.push(escaped);
  }

  if (cleanModules.length === 0) {
    return jsonResponse({ success: false, error: 'No valid modules selected' }, 400, corsHeaders);
  }

  // --- Rate limiting (per email, per hour) ---
  const allowed = await checkRateLimit(env, email);
  if (!allowed) {
    return jsonResponse(
      { success: false, error: 'Too many requests. Please try again later.' },
      429, corsHeaders
    );
  }

  // --- Store in D1 (notify_requests table) — fail hard if D1 is unavailable ---
  // The record is inserted with status='pending' and updated to 'sent' only
  // after the support email is delivered. This avoids orphaned "success"
  // records if email delivery fails, and allows a reconciliation job to
  // retry pending records later.
  let requestId;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS notify_requests (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        modules TEXT NOT NULL,
        created_at TEXT NOT NULL,
        notified INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending'
      )`
    ).run();

    requestId = 'NR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    await env.DB.prepare(
      `INSERT INTO notify_requests (id, email, modules, created_at, status)
       VALUES (?, ?, ?, ?, 'pending')`
    ).bind(
      requestId,
      email,
      JSON.stringify(cleanModules),
      new Date().toISOString()
    ).run();
  } catch (dbErr) {
    // D1 is a required dependency — if it fails, the request fails
    console.error('D1 write failed:', dbErr.message);
    await logError(env, 'notify-me-d1', dbErr, request);
    return jsonResponse(
      { success: false, error: 'Unable to save your request. Please try again.' },
      503, corsHeaders
    );
  }

  // --- Send emails via SendGrid — fail hard if email delivery fails ---
  const sendGridKey = env.SENDGRID_API_KEY;
  const fromEmail = env.SENDGRID_FROM_EMAIL || 'noreply@driv-en.com';
  const supportEmail = env.SUPPORT_CONTACT || 'support@driv-en.com';

  if (!sendGridKey) {
    // No API key = misconfiguration — fail rather than pretend success
    console.error('SENDGRID_API_KEY not bound — cannot send emails');
    await logError(env, 'notify-me-sendgrid', new Error('SENDGRID_API_KEY not bound'), request);
    return jsonResponse(
      { success: false, error: 'Email service unavailable. Please try again later.' },
      503, corsHeaders
    );
  }

  // Send support notification email
  const supportResult = await sendEmail(
    sendGridKey, fromEmail, supportEmail, 'DRIV-EN Support',
    'New Module Launch Notification Request',
    buildSupportNotificationEmail(email, cleanModules)
  );

  if (!supportResult.ok) {
    console.error('Support email failed:', supportResult.error);
    // Leave the D1 record as 'pending' so a reconciliation job can retry it
    await logError(env, 'notify-me-sendgrid', new Error(supportResult.error), request);
    return jsonResponse(
      { success: false, error: 'Unable to send notification. Please try again.' },
      502, corsHeaders
    );
  }

  // --- Mark D1 record as 'sent' now that the support email succeeded ---
  try {
    await env.DB.prepare(
      `UPDATE notify_requests SET status = 'sent', notified = 1 WHERE id = ?`
    ).bind(requestId).run();
  } catch (updateErr) {
    // The email was sent but we couldn't update the status — log it
    // The record stays as 'pending' which is fine for reconciliation
    console.error('D1 status update failed (email was sent):', updateErr.message);
  }

  // Send visitor confirmation email
  const visitorResult = await sendEmail(
    sendGridKey, fromEmail, email, null,
    'DRIV-EN — We\'ll Keep You Posted!',
    buildVisitorConfirmationEmail(cleanModules)
  );

  if (!visitorResult.ok) {
    // Support email succeeded but visitor confirmation failed
    // The lead is captured in D1 + support was notified, so we can still
    // return success — but log the failure for follow-up
    console.error('Visitor confirmation email failed:', visitorResult.error);
    await logError(env, 'notify-me-sendgrid', new Error(visitorResult.error), request);
    // Still return success — the primary purpose (notify support) succeeded
    return jsonResponse({
      success: true,
      warning: 'Your request was received but the confirmation email could not be delivered.'
    }, 200, corsHeaders);
  }

  // --- All critical steps succeeded ---
  return jsonResponse({ success: true }, 200, corsHeaders);
}

// Handle GET (for health check)
export async function onRequestGet({ request }) {
  const corsHeaders = getCORSHeaders(request);
  return jsonResponse({ success: true, message: 'notify-me endpoint is active' }, 200, corsHeaders);
}
