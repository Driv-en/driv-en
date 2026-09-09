/* ==========================================================================
   DRIV-EN ERROR REPORT ENDPOINT (Pages Function)
   ==========================================================================
   PURPOSE: Receives client-side error reports from error-handler.js and:
     1. Writes the error to the error_log D1 table (Error Logs tab)
     2. Sends an email to support@driv-en.com with the error details
     3. Returns 200 so the client doesn't retry

   DEPLOY: Place at /functions/api/error-report.js in the Pages project

   D1 BINDING: DB (already configured on the Pages project)
   ========================================================================== */

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS error_log (' +
      'id TEXT PRIMARY KEY, ' +
      'source TEXT, ' +
      'error_message TEXT, ' +
      'stack_trace TEXT, ' +
      'severity TEXT DEFAULT \'error\', ' +
      'resolved INTEGER DEFAULT 0, ' +
      'created_at TEXT' +
      ')'
    ).run();

    const errorId = 'ERR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    let stackTrace = body.stack || 'No stack trace';
    stackTrace += '\n\n--- CLIENT CONTEXT ---';
    stackTrace += '\nPage: ' + (body.page || 'N/A');
    stackTrace += '\nURL: ' + (body.url || 'N/A');
    stackTrace += '\nFile: ' + (body.filename || 'N/A') + ':' + (body.lineno || '?') + ':' + (body.colno || '?');
    stackTrace += '\nUser-Agent: ' + (body.userAgent || 'N/A');
    stackTrace += '\nSource: ' + (body.source || 'N/A');
    stackTrace += '\nTime: ' + (body.timestamp || new Date().toISOString());

    await env.DB.prepare(
      'INSERT INTO error_log (id, source, error_message, stack_trace, severity, resolved, created_at) ' +
      'VALUES (?, ?, ?, ?, \'error\', 0, ?)'
    ).bind(
      errorId,
      'client-side (' + (body.source || 'unknown') + ')',
      body.message || 'Unknown client error',
      stackTrace,
      new Date().toISOString()
    ).run();

    if (env.SENDGRID_API_KEY) {
      try {
        const supportEmail = env.SUPPORT_CONTACT || 'support@driv-en.com';
        const fromEmail = env.SENDGRID_FROM_EMAIL || 'noreply@driv-en.com';

        await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.SENDGRID_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: supportEmail }] }],
            from: { email: fromEmail, name: 'DRIV-EN Error Monitor' },
            subject: 'CLIENT ERROR: ' + (body.message || 'Unknown error').substring(0, 80),
            content: [{
              type: 'text/html',
              value: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;">' +
                '<h2 style="color:#cc6600;">Client-Side Error Report</h2>' +
                '<p><strong>Time:</strong> ' + new Date().toISOString() + '</p>' +
                '<p><strong>Error:</strong> ' + (body.message || 'Unknown error') + '</p>' +
                '<p><strong>Page:</strong> ' + (body.page || 'N/A') + '</p>' +
                '<p><strong>URL:</strong> ' + (body.url || 'N/A') + '</p>' +
                '<p><strong>Source:</strong> ' + (body.source || 'N/A') + '</p>' +
                '<p><strong>Stack:</strong></p><pre style="background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto;font-size:13px;">' +
                (body.stack || 'No stack trace') + '</pre>' +
                '<p><strong>User-Agent:</strong> ' + (body.userAgent || 'N/A') + '</p>' +
                '<p style="font-size:13px;color:#888;">This is an automated error notification from the DRIV-EN platform (client-side).</p>' +
                '</div>'
            }]
          })
        });
      } catch (emailErr) {
        console.error('Failed to send client error email:', emailErr.message);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Error report endpoint failed:', err.message);
    return new Response(JSON.stringify({ success: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
