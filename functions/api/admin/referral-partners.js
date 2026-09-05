// ============================================================================
// Pages Function: /api/admin/referral-partners
// ============================================================================
// PURPOSE: Admin API for the Owner Dashboard's Referrers section.
//   GET  /api/admin/referral-partners       — List all referral partners
//   POST /api/admin/referral-partners       — Approve or reject a partner
//
// AUTH: Verifies the caller is logged in as DRIV-EN Founder by parsing
//   the driv_en_session JWT cookie directly using Web Crypto API.
//   No fetch to /auth/session needed — the JWT is verified in-place.
//   Requires JWT_SECRET to be set as a secret on the Pages project.
//
// PAGES PROJECT BINDINGS:
//   - D1: DB → driv-en-db
//   - R2: W9_BUCKET → w9-uploads
//   - Secret: SENDGRID_API_KEY
//   - Secret: JWT_SECRET (same value as the auth worker)
//   - Var: SENDGRID_FROM_EMAIL = noreply@driv-en.com
//   - Var: SUPPORT_CONTACT = support@driv-en.com
//
// LAST UPDATED: September 5, 2026
// CHANGES:
//   - Added last_referred subquery to GET (most recent referral_activity per partner)
//   - Added toggle_active action to POST (silently activate/deactivate approved partners)
//   - Added reapprove_w9 action to POST (re-approve after W-9 renewal)
//   - Approval email: sender name changed to "Jackie Blood, Founder of DRIV-EN"
//   - Approval email: DRIV-EN logo added at top of email body
//   - Rejection email: DRIV-EN logo added at top of email body
//   - Error message updated to include all valid actions
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.driv-en.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};

// ---------------------------------------------------------------------------
// DRIV-EN logo HTML — centered at the top of every email body.
// Used in approval emails, rejection emails, and any other emails sent by
// this Pages Function. The logo is loaded from the DRIV-EN website.
// ---------------------------------------------------------------------------
const EMAIL_LOGO_HTML = '<div style="text-align:center;padding:24px 0 16px 0;">' +
  '<img src="https://www.driv-en.com/assets/logo.png?v=2026" alt="DRIV-EN" style="display:block;margin:0 auto;max-width:200px;">' +
  '</div>';

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// ---------------------------------------------------------------------------
// JWT helpers — parse and verify the session cookie directly
// This avoids the need to fetch /auth/session from within a Pages Function.
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
    console.error('[ADMIN-REFERRAL] JWT verify error:', e.message);
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
// Parses the driv_en_session cookie, verifies the JWT, checks the role.
// Returns the JWT payload if authenticated and is Founder, null otherwise.
// ---------------------------------------------------------------------------
async function verifyFounder(request, env) {
  if (!env.JWT_SECRET) {
    console.error('[ADMIN-REFERRAL] JWT_SECRET is not set on the Pages project');
    return null;
  }

  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies['driv_en_session'];

  if (!token) return null;

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return null;

  // Only DRIV-EN Founder can access the Owner Dashboard admin API.
  if (payload.role === 'DRIV-EN Founder') {
    return payload;
  }

  return null;
}

// ---------------------------------------------------------------------------
// SendGrid email helper
// ---------------------------------------------------------------------------
async function sendEmail(env, to, subject, htmlContent, senderName) {
  if (!env.SENDGRID_API_KEY) {
    return { ok: false, error: 'SENDGRID_API_KEY is not set on the Pages project' };
  }
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.SENDGRID_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: env.SENDGRID_FROM_EMAIL || 'noreply@driv-en.com', name: senderName || 'DRIV\u2011EN Platform' },
        subject: subject,
        content: [{ type: 'text/html', value: htmlContent }]
      })
    });
    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: 'SendGrid API returned ' + res.status + ': ' + errBody.substring(0, 500) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Fetch error: ' + e.message };
  }
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
// Generate a random temporary password (12 chars, alphanumeric)
// ---------------------------------------------------------------------------
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

// ---------------------------------------------------------------------------
// Hash a password using PBKDF2 (same algorithm as the auth worker)
// Returns { salt, hash } as base64 strings
// ---------------------------------------------------------------------------
function base64UrlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hashPassword(password, saltHex) {
  // If no salt provided, generate a new random 16-byte salt
  let saltBytes;
  let saltHexResult;

  if (!saltHex) {
    // Generate a new random salt
    const newSalt = new Uint8Array(16);
    crypto.getRandomValues(newSalt);
    saltBytes = newSalt;
    saltHexResult = Array.from(newSalt).map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Parse the existing salt from hex string
    const hexPairs = saltHex.match(/.{1,2}/g);
    if (!hexPairs) {
      // Invalid hex string — generate a new salt as fallback
      const newSalt = new Uint8Array(16);
      crypto.getRandomValues(newSalt);
      saltBytes = newSalt;
      saltHexResult = Array.from(newSalt).map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      saltBytes = new Uint8Array(hexPairs.map(b => parseInt(b, 16)));
      saltHexResult = saltHex;
    }
  }

  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return { salt: saltHexResult, hash: base64UrlEncode(new Uint8Array(bits)) };
}

// ---------------------------------------------------------------------------
// Escape HTML to prevent injection in emails and responses.
// Used on user-supplied fields like partner name and rejection reason.
// ---------------------------------------------------------------------------
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text || '').replace(/[&<>"']/g, function(m) { return map[m]; });
}

// ---------------------------------------------------------------------------
// GET /api/admin/referral-partners — List all partners
// ---------------------------------------------------------------------------
async function handleListPartners(request, env) {
  const user = await verifyFounder(request, env);
  if (!user) {
    return jsonResponse({ success: false, error: 'Unauthorized — DRIV-EN Founder access required' }, 403);
  }

  try {
    // Query all partners, with a subquery to get the most recent referral_activity
    // date for each partner. This tells the owner when each partner last referred
    // someone (or had any activity like a visit). The subquery checks both
    // partner_id and referrer_id columns since track.js uses partner_id and
    // the checkout worker uses referrer_id.
    const result = await env.DB.prepare(
      `SELECT rp.id, rp.partner_name, rp.partner_email, rp.partner_phone, rp.status,
              rp.referral_code, rp.active, rp.is_eligible, rp.partner_status,
              rp.w9_attachment, rp.w9_expiration_date, rp.created_at,
              (SELECT MAX(ra.created_at)
               FROM referral_activity ra
               WHERE ra.partner_id = rp.id OR ra.referrer_id = rp.id
              ) as last_referred
       FROM referral_partners rp
       ORDER BY
         CASE WHEN rp.status = 'Pending' THEN 0
              WHEN rp.status = 'Pending W-9 Review' THEN 1
              ELSE 2 END,
         rp.created_at DESC`
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
// POST /api/admin/referral-partners — Approve or reject a partner
// Body: { action: 'approve' | 'reject' | 'toggle_active' | 'reapprove_w9', partnerId, referralCode?, w9ExpirationDate?, reason? }
// ---------------------------------------------------------------------------
async function handleUpdatePartner(request, env) {
  const user = await verifyFounder(request, env);
  if (!user) {
    return jsonResponse({ success: false, error: 'Unauthorized — DRIV-EN Founder access required' }, 403);
  }

  let body;
  try { body = await request.json(); } catch (e) {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const { action, partnerId, referralCode, w9ExpirationDate, reason } = body;

  if (!action || !partnerId) {
    return jsonResponse({ success: false, error: 'Action and partnerId are required' }, 400);
  }

  // Fetch the partner
  const partner = await env.DB.prepare(
    'SELECT id, partner_name, partner_email, status FROM referral_partners WHERE id = ?'
  ).bind(partnerId).first();

  if (!partner) {
    return jsonResponse({ success: false, error: 'Partner not found' }, 404);
  }

  if (action === 'approve') {
    // Validate referral code
    if (!referralCode) {
      return jsonResponse({ success: false, error: 'Referral code is required' }, 400);
    }

    // Check referral code uniqueness
    const existingCode = await env.DB.prepare(
      'SELECT id FROM referral_partners WHERE referral_code = ? AND id != ?'
    ).bind(referralCode, partnerId).first();
    if (existingCode) {
      return jsonResponse({ success: false, error: 'Referral code already in use by another partner' }, 409);
    }

    // W-9 expiration: December 31 of current year if not provided
    const w9Exp = w9ExpirationDate || computeW9Expiration();

    // Generate a temporary password for the referrer to log in
    const tempPassword = generateTempPassword();
    const { salt, hash } = await hashPassword(tempPassword);

    // Update partner to Approved with temp password
    await env.DB.prepare(
      `UPDATE referral_partners
       SET status = 'Approved', active = 1, is_eligible = 1,
           partner_status = 'Approved', referral_code = ?,
           w9_expiration_date = ?,
           password_hash = ?, password_salt = ?, must_change_password = 1
       WHERE id = ?`
    ).bind(referralCode, w9Exp, hash, salt, partnerId).run();

    // Send approval email to the partner
    const domain = 'https://www.driv-en.com';
    const referralLink = domain + '/?ref=' + referralCode;
    const loginLink = domain + '/public/referrer-login.html';

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;">
  ${EMAIL_LOGO_HTML}
  <h2 style="color:#111;">You're Approved, ${escapeHtml(partner.partner_name)}!</h2>
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
  <p><strong>Your login credentials:</strong></p>
  <div style="background:#f0f7ff;border:1px solid #c3dbf7;padding:16px;border-radius:6px;margin:12px 0;">
    <p style="margin:0 0 8px 0;"><strong>Login URL:</strong> <a href="${loginLink}" style="color:#2563eb;">${loginLink}</a></p>
    <p style="margin:0 0 8px 0;"><strong>Email:</strong> ${escapeHtml(partner.partner_email)}</p>
    <p style="margin:0 0 8px 0;"><strong>Temporary Password:</strong> <span style="font-family:monospace;font-size:16px;font-weight:700;background:#fff;padding:4px 8px;border-radius:4px;border:1px solid #ddd;">${tempPassword}</span></p>
  </div>
  <p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px;border-radius:6px;font-size:14px;">
    <strong>Important:</strong> Please change your password after logging in for the first time.
  </p>
  <p>You can now log in to your Partner Dashboard to track your referrals and commissions:</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="${loginLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:700;">Log In to Partner Dashboard</a>
  </p>
  <p style="font-size:13px;color:#888;">If the button doesn't work, copy and paste this link into your browser: ${loginLink}</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:24px 0;">
  <h3 style="font-size:16px;color:#111;">Quick Access on Your Phone</h3>
  <p style="font-size:14px;">Add a DRIV-EN icon to your home screen so you can log in with one tap:</p>
  <p style="font-size:14px;font-weight:600;margin-bottom:4px;">iPhone (Safari):</p>
  <ol style="font-size:14px;margin:0 0 12px 0;padding-left:20px;">
    <li>Open this link in Safari: <a href="${loginLink}" style="color:#2563eb;">${loginLink}</a></li>
    <li>Tap the Share button (square with up arrow)</li>
    <li>Tap "Add to Home Screen"</li>
    <li>Tap "Add" — you'll now have a DRIV-EN icon on your home screen</li>
  </ol>
  <p style="font-size:14px;font-weight:600;margin-bottom:4px;">Android (Chrome):</p>
  <ol style="font-size:14px;margin:0 0 12px 0;padding-left:20px;">
    <li>Open this link in Chrome: <a href="${loginLink}" style="color:#2563eb;">${loginLink}</a></li>
    <li>Tap the menu (three dots in upper right)</li>
    <li>Tap "Add to Home screen"</li>
    <li>Tap "Add" — you'll now have a DRIV-EN icon on your home screen</li>
  </ol>
  <p style="font-size:13px;color:#888;">If you have questions, contact us at support@driv-en.com</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:24px 0;">
  <p style="font-size:13px;color:#888;">This is an automated notification from the DRIV-EN referral system.</p>
</body>
</html>`;

    const emailResult = await sendEmail(env, partner.partner_email, 'You\'re Approved — DRIV-EN Referral Partner', emailHtml, 'Jackie Blood, Founder of DRIV\u2011EN');

    return jsonResponse({
      success: true,
      message: 'Partner approved successfully. Approval email sent to ' + partner.partner_email,
      referralCode: referralCode,
      w9ExpirationDate: w9Exp,
      tempPassword: tempPassword,
      emailSent: emailResult.ok,
      emailError: emailResult.ok ? null : emailResult.error
    });

  } else if (action === 'reject') {
    // Update partner to Rejected
    await env.DB.prepare(
      `UPDATE referral_partners
       SET status = 'Rejected', active = 0, is_eligible = 0,
           partner_status = 'Rejected'
       WHERE id = ?`
    ).bind(partnerId).run();

    // Send rejection email to the partner
    const reasonText = reason ? '<p><strong>Reason:</strong> ' + escapeHtml(reason) + '</p>' : '';
    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;">
  ${EMAIL_LOGO_HTML}
  <h2 style="color:#111;">Update on Your DRIV-EN Referral Partner Application</h2>
  <p>Hello ${escapeHtml(partner.partner_name)},</p>
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

  } else if (action === 'reapprove_w9') {
    // -----------------------------------------------------------------
    // Re-approve a partner whose W-9 was renewed (status was "Pending W-9 Review").
    // Sets status back to Approved, active=1. The partner keeps their
    // existing referral code — only the W-9 was renewed.
    // No email is sent (the referrer already knows they uploaded a new W-9).
    // -----------------------------------------------------------------
    const w9Partner = await env.DB.prepare(
      'SELECT status, referral_code FROM referral_partners WHERE id = ?'
    ).bind(partnerId).first();

    if (!w9Partner) {
      return jsonResponse({ success: false, error: 'Partner not found' }, 404);
    }

    if (w9Partner.status !== 'Pending W-9 Review') {
      return jsonResponse({ success: false, error: 'Can only re-approve partners with W-9 pending review' }, 400);
    }

    await env.DB.prepare(
      `UPDATE referral_partners
       SET status = 'Approved', active = 1, is_eligible = 1, partner_status = 'Approved'
       WHERE id = ?`
    ).bind(partnerId).run();

    return jsonResponse({
      success: true,
      message: 'Partner re-approved. Referral link reactivated.'
    });

  } else if (action === 'toggle_active') {
    // -----------------------------------------------------------------
    // Toggle active/inactive for an Approved partner.
    // This is SILENT (no email sent) and REVERSIBLE.
    // When deactivated (active=0): the referrer can still log in, but their
    // referral link stops working (the tracking endpoint checks active=1).
    // When reactivated (active=1): everything works again.
    // This is different from Reject, which sends an email and sets status=Rejected.
    // -----------------------------------------------------------------

    // Fetch the current active state
    const currentPartner = await env.DB.prepare(
      'SELECT active, status FROM referral_partners WHERE id = ?'
    ).bind(partnerId).first();

    if (!currentPartner) {
      return jsonResponse({ success: false, error: 'Partner not found' }, 404);
    }

    // Only allow toggling for Approved partners
    if (currentPartner.status !== 'Approved') {
      return jsonResponse({ success: false, error: 'Can only toggle active state for Approved partners' }, 400);
    }

    const newActive = currentPartner.active === 1 ? 0 : 1;

    await env.DB.prepare(
      'UPDATE referral_partners SET active = ? WHERE id = ?'
    ).bind(newActive, partnerId).run();

    return jsonResponse({
      success: true,
      message: newActive === 1 ? 'Partner activated' : 'Partner deactivated',
      active: newActive
    });

  } else {
    return jsonResponse({ success: false, error: 'Invalid action. Use "approve", "reject", "toggle_active", or "reapprove_w9".' }, 400);
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
