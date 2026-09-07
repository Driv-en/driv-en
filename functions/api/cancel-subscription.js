/* ==========================================================================
   DRIV-EN CANCEL SUBSCRIPTION — PAGES FUNCTION
   ==========================================================================
   PURPOSE: Customer-initiated subscription cancellation.
     - Marks subscription_status = 'cancelled' in D1
     - Sets cancelled_at timestamp
     - Account stays active until free_until or paid_until date
     - Sends confirmation email
     - Cron Trigger worker handles actual deactivation when date passes

   POST /api/cancel-subscription
   Body: { "org_id": "org_xxx", "reason": "optional reason text" }
   Response: { "success": true, "message": "...", "activeUntil": "2026-12-31" }

   PAGES PROJECT BINDINGS:
     - D1: DB -> driv-en-db
     - Secrets: SENDGRID_API_KEY
   ========================================================================== */

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

async function sendEmail(env, to, subject, htmlContent) {
  const fromEmail = env.SENDGRID_FROM_EMAIL || 'noreply@driv-en.com';
  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.SENDGRID_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: 'DRIV\u2011EN Platform' },
      subject: subject,
      content: [{ type: 'text/html', value: htmlContent }]
    })
  });
  return resp.ok;
}

function buildCancellationEmail(orgName, activeUntil, reason) {
  const reasonHtml = reason ? '<p><strong>Reason provided:</strong> ' + reason + '</p>' : '';
  return '<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body style="font-family:Arial,sans-serif;background:#f7f7f7;padding:30px;margin:0;">' +
    '<div style="max-width:600px;margin:auto;background:#ffffff;padding:25px;border-radius:10px;box-shadow:0 0 10px rgba(0,0,0,0.08);">' +
    '<div style="text-align:center;margin-bottom:10px;"><img src="https://www.driv-en.com/assets/logo.png?v=2026" alt="DRIV\u2011EN Logo" style="width:160px;height:auto;" /></div>' +
    '<h2 style="text-align:center;margin-bottom:8px;">Subscription Cancelled</h2>' +
    '<div style="border:3px solid #00b140;border-radius:10px;padding:15px;margin-bottom:18px;background:#ffffff;">' +
    '<p style="margin-top:8px;">Hello ' + orgName + ',</p>' +
    '<p>Your DRIV\u2011EN subscription has been cancelled. You will continue to have full access to all features until <strong>' + activeUntil + '</strong>.</p>' +
    '<p>After that date, your account will be deactivated. You can reactivate at any time by contacting support.</p>' +
    reasonHtml +
    '<div style="text-align:center;margin:20px 0;"><a href="https://www.driv-en.com/public/login.html" style="display:inline-block;padding:12px 20px;background:#22c55e;color:#022c22;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold;border:2px solid #16a34a;">Continue Using DRIV\u2011EN</a></div>' +
    '</div>' +
    '<p style="margin-top:10px;">If you did not request this cancellation, please contact <a href="mailto:support@driv-en.com" style="color:#00b140;font-weight:bold;">support@driv-en.com</a> immediately.</p>' +
    '<p style="color:#999;font-size:13px;text-align:center;margin-top:20px;">\u00a9 2026 Digital Safety Inspection, LLC \u2014 DRIV\u2011EN Platform</p>' +
    '</div></body></html>';
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const orgId = body.org_id || '';
    const reason = body.reason || '';
    const userEmail = body.email || '';

    if (!orgId) return jsonResponse({ success: false, error: 'Organization ID is required.' }, 400);

    const org = await env.DB.prepare("SELECT id, name, admin_email, status, subscription_status, free_until, paid_until FROM organizations WHERE id = ?").bind(orgId).first();
    if (!org) return jsonResponse({ success: false, error: 'Organization not found.' }, 404);
    if (org.subscription_status === 'cancelled') return jsonResponse({ success: false, error: 'Subscription is already cancelled.' }, 400);

    const activeUntil = org.paid_until || org.free_until || 'the end of your current billing period';
    await env.DB.prepare("UPDATE organizations SET subscription_status = 'cancelled', cancelled_at = ? WHERE id = ?").bind(new Date().toISOString(), org.id).run();

    const emailTo = org.admin_email || userEmail;
    if (emailTo && env.SENDGRID_API_KEY) {
      const emailHtml = buildCancellationEmail(org.name, activeUntil, reason);
      await sendEmail(env, emailTo, 'Your DRIV\u2011EN Subscription Has Been Cancelled', emailHtml);
    }

    if (env.SENDGRID_API_KEY) {
      const supportEmail = env.SUPPORT_CONTACT || 'support@driv-en.com';
      const supportHtml = '<p><strong>Organization:</strong> ' + org.name + '</p><p><strong>Org ID:</strong> ' + org.id + '</p><p><strong>Cancelled by:</strong> ' + (userEmail || 'unknown') + '</p><p><strong>Reason:</strong> ' + (reason || 'none provided') + '</p><p><strong>Active until:</strong> ' + activeUntil + '</p>';
      await sendEmail(env, supportEmail, 'DRIV\u2011EN Subscription Cancelled: ' + org.name, supportHtml);
    }

    return jsonResponse({ success: true, message: 'Subscription cancelled. You will have access until ' + activeUntil + '.', activeUntil }, 200);
  } catch (e) {
    console.error('[CANCEL-SUBSCRIPTION] Error:', e.message, e.stack);
    return jsonResponse({ success: false, error: 'Unable to process cancellation. Please try again.' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
