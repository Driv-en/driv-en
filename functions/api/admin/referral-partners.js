// ============================================================================
// Pages Function: /api/admin/referral-partners
// ============================================================================
// PURPOSE: Admin API for the Owner Dashboard's Referrers section.
//   GET  /api/admin/referral-partners       - List all referral partners
//   POST /api/admin/referral-partners       - Approve or reject a partner
//
// AUTH: Verifies the caller is logged in as an Admin via /auth/session.
//   The auth worker sets a session cookie that we check here.
//
// PAGES PROJECT BINDINGS (same as referral-signup.js):
//   - D1: DB -> driv-en-db
//   - R2: W9_BUCKET -> w9-uploads
//   - Secret: SENDGRID_API_KEY
//   - Var: SENDGRID_FROM_EMAIL = noreply@driv-en.com
//   - Var: SUPPORT_CONTACT = support@driv-en.com
//
// LAST UPDATED: September 3, 2026
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
// Auth check - verify the caller is an Admin
// Returns the user object if authenticated and is admin, null otherwise.
// ---------------------------------------------------------------------------
async function verifyAdmin(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  try {
    const resp = await fetch('https://' + (request.headers.get('host') || 'driv-en.com') + '/auth/session', {
      headers: { 'Cookie': cookieHeader }
    });
    const data = await resp.json();
    if (data.authenticated && data.user) {
      const role = (data.user.role || '').toLowerCase();
      if (role === 'admin') return data.user;
    }
  } catch (e) {
    console.error('[ADMIN-REFERRAL] Auth check failed:', e.message);
  }
  return null;
}

// ---------------------------------------------------------------------------
// SendGrid email helper
// ---------------------------------------------------------------------------
async function sendEmail(env, to, subject, htmlContent) {
  if (!env.SENDGRID_API_KEY) return false;
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.SENDGRID_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: env.SENDGRID_FROM_EMAIL || 'noreply@driv-en.com', name: 'DRIV\u2011EN Platform' },
        subject: subject,
        content: [{ type: 'text/html', value: htmlContent }]
      })
    });
    return res.ok;
  } catch (e) {
    console.error('[ADMIN-REFERRAL] Email send failed:', e.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Generate a unique referral code (DRV-XXXXXX format)
// Checks D1 to ensure it doesn't already exist.
// ---------------------------------------------------------------------------
async function generateUniqueReferralCode(env) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = 'DRV-';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const existing = await env.DB.prepare(
      'SELECT id FROM referral_partners WHERE referral_code = ?'
    ).bind(code).first();
    if (!existing) return code;
  }
  return 'DRV-' + Date.now().toString(36).toUpperCase().slice(-6);
}

// ---------------------------------------------------------------------------
// Compute W-9 expiration date: December 31 of the current year
// A new W-9 is required each calendar year.
// ---------------------------------------------------------------------------
function computeW9Expiration() {
  const now = new Date();
  return now.getFullYear() + '-12-31';
}

// ---------------------------------------------------------------------------
// GET /api/admin/referral-partners - List all partners
// ---------------------------------------------------------------------------
async function handleListPartners(request, env) {
  const user = await verifyAdmin(request, env);
  if (!user) {
    return jsonResponse({ success: false, error: 'Unauthorized - Admin access required' }, 403);
  }

  try {
    const result = await env.DB.prepare(
      `SELECT id, partner_name, partner_email, partner_phone, status,
              referral_code, active, is_eligible, partner_status,
              w9_attachment, w9_expiration_date, created_at
       FROM referral_partners
       ORDER BY
         CASE WHEN status = 'Pending' THEN 0 ELSE 1 END,
         created_at DESC`
    ).all();

    return jsonResponse({
      success: true,
      partners: result.results || []
    });
  } catch (e) {
    console.error('[ADMIN-REFERRAL] List failed:', e.message);
    return jsonResponse({ success: false, error: 'Failed to load partners: ' + e.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/referral-partners - Approve or reject a partner
// Body: { action: 'approve' | 'reject', partnerId, referralCode?, w9ExpirationDate?, reason? }
// ---------------------------------------------------------------------------
async function handleUpdatePartner(request, env) {
  const user = await verifyAdmin(request, env);
  if (!user) {
    return jsonResponse({ success: false, error: 'Unauthorized - Admin access required' }, 403);
  }

  let body;
  try { body = await request.json(); } catch (e) {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const { action, partnerId, referralCode, w9ExpirationDate, reason } = body;

  if (!action || !partnerId) {
    return jsonResponse({ success: false, error: 'Action and partnerId are required' }, 400);
  }

  const partner = await env.DB.prepare(
    'SELECT id, partner_name, partner_email, status FROM referral_partners WHERE id = ?'
  ).bind(partnerId).first();

  if (!partner) {
    return jsonResponse({ success: false, error: 'Partner not found' }, 404);
  }

  if (action === 'approve') {
    if (!referralCode) {
      return jsonResponse({ success: false, error: 'Referral code is required' }, 400);
    }

    const existingCode = await env.DB.prepare(
      'SELECT id FROM referral_partners WHERE referral_code = ? AND id != ?'
    ).bind(referralCode, partnerId).first();
    if (existingCode) {
      return jsonResponse({ success: false, error: 'Referral code already in use by another partner' }, 409);
    }

    const w9Exp = w9ExpirationDate || computeW9Expiration();

    await env.DB.prepare(
      `UPDATE referral_partners
       SET status = 'Approved', active = 1, is_eligible = 1,
           partner_status = 'Approved', referral_code = ?,
           w9_expiration_date = ?
       WHERE id = ?`
    ).bind(referralCode, w9Exp, partnerId).run();

    const domain = 'https://www.driv-en.com';
    const referralLink = domain + '/checkout.html?ref=' + referralCode;
    const loginLink = domain + '/public/referrer-login.html';

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;">
  <h2 style="color:#111;">You're Approved, ${partner.partner_name}!</h2>
  <p>Congratulations! Your DRIV-EN referral partner application has been approved.</p>
  <p><strong>Your referral code:</strong> ${referralCode}</p>
  <p><strong>Your referral link:</strong></p>
  <p style="background:#f0f7ff;border:1px solid #c3dbf7;padding:12px;border-radius:6px;word-break:break-all;font-size:14px;">
    <a href="${referralLink}" style="color:#2563eb;">${referralLink}</a>
  </p>
  <p>Share this link with companies you'd like to refer to DRIV-EN. When they sign up using your link, you'll automatically receive credit for the referral.</p>
  <p><strong>Commission rates:</strong></p>
  <ul>
    <li>Monthly subscriptions: 5% recurring commission</li>
    <li>Annual subscriptions: 10% recurring commission</li>
  </ul>
  <p>You can now log in to your Partner Dashboard to track your referrals and commissions:</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="${loginLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:15px;font-weight:600;">Log In to Partner Dashboard</a>
  </p>
  <p style="font-size:13px;color:#888;">If you have questions, contact us at support@driv-en.com</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:24px 0;">
  <p style="font-size:13px;color:#888;">This is an automated notification from the DRIV-EN referral system.</p>
</body>
</html>`;

    await sendEmail(env, partner.partner_email, 'You\'re Approved - DRIV-EN Referral Partner', emailHtml);

    return jsonResponse({
      success: true,
      message: 'Partner approved successfully. Approval email sent to ' + partner.partner_email,
      referralCode: referralCode,
      w9ExpirationDate: w9Exp
    });

  } else if (action === 'reject') {
    await env.DB.prepare(
      `UPDATE referral_partners
       SET status = 'Rejected', active = 0, is_eligible = 0,
           partner_status = 'Rejected'
       WHERE id = ?`
    ).bind(partnerId).run();

    const reasonText = reason ? '<p><strong>Reason:</strong> ' + reason + '</p>' : '';
    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;">
  <h2 style="color:#111;">Update on Your DRIV-EN Referral Partner Application</h2>
  <p>Hello ${partner.partner_name},</p>
  <p>Thank you for your interest in becoming a DRIV-EN referral partner. After reviewing your application, we are unable to approve it at this time.</p>
  ${reasonText}
  <p>If you have questions or would like to reapply in the future, please contact us at support@driv-en.com.</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:24px 0;">
  <p style="font-size:13px;color:#888;">This is an automated notification from the DRIV-EN referral system.</p>
</body>
</html>`;

    await sendEmail(env, partner.partner_email, 'Update on Your DRIV-EN Referral Partner Application', emailHtml);

    return jsonResponse({
      success: true,
      message: 'Partner rejected. Notification email sent to ' + partner.partner_email
    });

  } else {
    return jsonResponse({ success: false, error: 'Invalid action. Use "approve" or "reject".' }, 400);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function onRequestGet(context) {
  const { request, env } = context;
  return handleListPartners(request, env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  return handleUpdatePartner(request, env);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
