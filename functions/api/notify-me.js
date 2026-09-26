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
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.driv-en.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
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
// SendGrid email helper
// ---------------------------------------------------------------------------
async function sendEmail(apiKey, fromEmail, toEmail, toName, subject, htmlContent) {
  const personalization = { to: [{ email: toEmail }] };
  if (toName) personalization.to[0].name = toName;

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
  return res.ok;
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
// Main handler
// ---------------------------------------------------------------------------
export async function onRequestPost({ request, env }) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const modules = body.modules;

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ success: false, error: 'Invalid email address' }, 400);
    }

    // Validate modules array
    if (!Array.isArray(modules) || modules.length === 0) {
      return jsonResponse({ success: false, error: 'No modules selected' }, 400);
    }

    // Sanitize module names — only allow alphanumeric + common punctuation
    const cleanModules = modules
      .filter(m => typeof m === 'string' && m.length > 0 && m.length < 100)
      .map(m => m.replace(/[<>&"']/g, ''))
      .filter(m => m.length > 0);

    if (cleanModules.length === 0) {
      return jsonResponse({ success: false, error: 'No valid modules selected' }, 400);
    }

    // Store in D1 (notify_requests table)
    try {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS notify_requests (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          modules TEXT NOT NULL,
          created_at TEXT NOT NULL,
          notified INTEGER DEFAULT 0
        )`
      ).run();

      const requestId = 'NR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      await env.DB.prepare(
        `INSERT INTO notify_requests (id, email, modules, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(
        requestId,
        email,
        JSON.stringify(cleanModules),
        new Date().toISOString()
      ).run();
    } catch (dbErr) {
      // D1 may not be bound in dev — log but don't fail the request
      console.error('D1 write failed:', dbErr.message);
    }

    // Send emails via SendGrid
    const sendGridKey = env.SENDGRID_API_KEY;
    const fromEmail = env.SENDGRID_FROM_EMAIL || 'noreply@driv-en.com';
    const supportEmail = env.SUPPORT_CONTACT || 'support@driv-en.com';

    if (sendGridKey) {
      // Email support@driv-en.com
      await sendEmail(
        sendGridKey, fromEmail, supportEmail, 'DRIV-EN Support',
        'New Module Launch Notification Request',
        buildSupportNotificationEmail(email, cleanModules)
      );

      // Confirmation email to visitor
      await sendEmail(
        sendGridKey, fromEmail, email, null,
        'DRIV-EN — We\'ll Keep You Posted!',
        buildVisitorConfirmationEmail(cleanModules)
      );
    } else {
      console.warn('SENDGRID_API_KEY not bound — emails not sent');
    }

    return jsonResponse({ success: true });

  } catch (err) {
    await logError(env, 'notify-me', err, request);
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
}

// Handle GET (for health check)
export async function onRequestGet() {
  return jsonResponse({ success: true, message: 'notify-me endpoint is active' });
}
