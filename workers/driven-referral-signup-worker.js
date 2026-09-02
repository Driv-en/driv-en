// ============================================================================
// driven-referral-signup Worker
// ============================================================================
// PURPOSE: Handles referral partner signup form submissions from the
//   DRIV-EN website (referral-signup.html).
//   1. Verifies the Cloudflare Turnstile bot-protection token
//   2. Validates partner fields (name, email, phone)
//   3. Accepts W-9 PDF upload (stores in R2 if bound, otherwise base64 in D1)
//   4. Creates a referral_partners row in D1 (status = Pending)
//   5. Sends a notification email to support@driv-en.com
//   6. Sends a confirmation email to the partner
//
// ROUTE: api.driv-en.com/referral-signup (or standalone worker)
// BINDINGS:
//   - D1: DB → driv-en-db (same as checkout worker)
//   - R2: W9_BUCKET → (optional) bucket for W-9 file storage
//   - Secrets: TURNSTILE_SECRET_KEY, SENDGRID_API_KEY
//   - Vars: SENDGRID_FROM_EMAIL=noreply@driv-en.com, SUPPORT_CONTACT=support@driv-en.com
//
// LAST UPDATED: September 2, 2026
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
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
// Turnstile verification
// ---------------------------------------------------------------------------
async function verifyTurnstile(token, secret) {
  if (!token) return { success: false, error: 'Missing Turnstile token' };
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'secret=' + encodeURIComponent(secret) + '&response=' + encodeURIComponent(token)
  });
  const data = await res.json();
  if (!data.success) return { success: false, error: 'Turnstile verification failed' };
  return { success: true };
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
// Build partner confirmation email
// ---------------------------------------------------------------------------
function buildPartnerConfirmationEmail(partnerName) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;">
  <h2 style="color:#111;">Thank You for Applying, ${partnerName}!</h2>
  <p>We have received your referral partner application and your W-9 form.</p>
  <p>Our team will review your submission and verify your W-9. Once approved, you will receive:</p>
  <ul>
    <li>Your unique referral link</li>
    <li>Access to your Partner Dashboard</li>
    <li>Instructions on how to start referring companies</li>
  </ul>
  <p><strong>Commission rates:</strong></p>
  <ul>
    <li>Monthly subscriptions: 5% recurring commission</li>
    <li>Annual subscriptions: 10% recurring commission</li>
  </ul>
  <p>Commissions are paid monthly via ACH (Direct Deposit), 60 days after DRIV-EN receives payment from the customer.</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:24px 0;">
  <p style="font-size:13px;color:#888;">If you have questions, contact us at support@driv-en.com</p>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Build admin notification email
// ---------------------------------------------------------------------------
function buildAdminNotificationEmail(partnerName, partnerEmail, partnerPhone) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;">
  <h2 style="color:#111;">New Referral Partner Application</h2>
  <table style="width:100%;border-collapse:collapse;font-size:15px;">
    <tr><td style="padding:6px 0;font-weight:bold;">Name:</td><td>${partnerName}</td></tr>
    <tr><td style="padding:6px 0;font-weight:bold;">Email:</td><td>${partnerEmail}</td></tr>
    <tr><td style="padding:6px 0;font-weight:bold;">Phone:</td><td>${partnerPhone}</td></tr>
  </table>
  <p>The W-9 form has been uploaded and is ready for review.</p>
  <p><strong>Next steps:</strong></p>
  <ol>
    <li>Review the W-9 for completeness and signature</li>
    <li>Approve the partner in the admin dashboard</li>
    <li>Generate a referral code (e.g., DRV-ABC123)</li>
    <li>Set status = Approved, active = 1, is_eligible = 1</li>
    <li>Set w9_expiration_date to 1 year from today</li>
  </ol>
  <hr style="border:none;border-top:1px solid #ccc;margin:24px 0;">
  <p style="font-size:13px;color:#888;">This is an automated notification from the DRIV-EN referral system.</p>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Ensure referral_partners table exists (same schema as checkout worker)
// ---------------------------------------------------------------------------
async function ensureTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_partners (
    id TEXT PRIMARY KEY,
    partner_name TEXT,
    partner_email TEXT,
    partner_phone TEXT,
    company_referred TEXT,
    contact_email_referred TEXT,
    status TEXT DEFAULT 'Pending',
    referral_code TEXT,
    active INTEGER DEFAULT 0,
    is_eligible INTEGER DEFAULT 0,
    partner_status TEXT DEFAULT 'Pending',
    w9_attachment TEXT,
    w9_expiration_date TEXT,
    commission_rate REAL DEFAULT 0,
    linked_customer_id TEXT,
    commission_eligible_date TEXT,
    commission_payable INTEGER DEFAULT 0,
    referral_link_status TEXT,
    total_commission_earned REAL DEFAULT 0,
    total_commission_payable REAL DEFAULT 0,
    created_at TEXT
  )`).run();
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
      // --- Parse the form data (multipart, includes W-9 file) ---
      const formData = await request.formData();

      const turnstileToken = formData.get('turnstileToken') || '';
      const partnerName = (formData.get('name') || '').trim();
      const partnerEmail = (formData.get('email') || '').trim().toLowerCase();
      const partnerPhone = (formData.get('phone') || '').trim();
      const w9File = formData.get('w9file');

      // --- Validate required fields ---
      const errors = [];
      if (!partnerName) errors.push('Name');
      if (!partnerEmail) errors.push('Email');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmail)) errors.push('Email (invalid format)');
      if (!partnerPhone) errors.push('Phone');
      if (!w9File) errors.push('W-9 file');
      if (errors.length) {
        return jsonResponse({ error: 'Missing required field(s): ' + errors.join(', ') }, 400);
      }

      // --- Verify Turnstile token ---
      if (env.TURNSTILE_SECRET_KEY) {
        const tsResult = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY);
        if (!tsResult.success) {
          return jsonResponse({ error: tsResult.error }, 403);
        }
      }

      // --- Ensure table exists ---
      await ensureTable(env);

      // --- Check for duplicate partner (same email) ---
      const existing = await env.DB.prepare(
        'SELECT id FROM referral_partners WHERE partner_email = ?'
      ).bind(partnerEmail).first();
      if (existing) {
        return jsonResponse({ error: 'A referral partner application already exists for this email address.' }, 409);
      }

      // --- Store W-9 file ---
      let w9StorageKey = null;
      let w9Base64 = null;

      if (w9File && w9File.size > 0) {
        const fileBuffer = await w9File.arrayBuffer();

        // Try R2 first (if the W9_BUCKET binding exists)
        if (env.W9_BUCKET) {
          w9StorageKey = 'w9/' + crypto.randomUUID() + '.pdf';
          await env.W9_BUCKET.put(w9StorageKey, fileBuffer, {
            httpMetadata: { contentType: 'application/pdf' }
          });
        } else {
          // Fallback: store as base64 in D1 (not ideal for large files, but works)
          // Limit to 2MB to avoid D1 row size issues
          if (w9File.size > 2 * 1024 * 1024) {
            return jsonResponse({ error: 'W-9 file is too large. Please upload a file under 2MB, or contact support@driv-en.com.' }, 413);
          }
          const bytes = new Uint8Array(fileBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          w9Base64 = btoa(binary);
        }
      }

      // --- Create referral_partners row ---
      const partnerId = crypto.randomUUID();
      const now = new Date().toISOString();

      // w9_attachment stores either the R2 key or the base64 data
      const w9Attachment = w9StorageKey || w9Base64 || null;

      await env.DB.prepare(
        `INSERT INTO referral_partners (id, partner_name, partner_email, partner_phone, status, active, is_eligible, partner_status, w9_attachment, created_at)
         VALUES (?, ?, ?, ?, 'Pending', 0, 0, 'Pending', ?, ?)`
      ).bind(
        partnerId,
        partnerName,
        partnerEmail,
        partnerPhone,
        w9Attachment,
        now
      ).run();

      // --- Send emails ---
      const fromEmail = env.SENDGRID_FROM_EMAIL || 'noreply@driv-en.com';
      const supportEmail = env.SUPPORT_CONTACT || 'support@driv-en.com';

      if (env.SENDGRID_API_KEY) {
        // Confirmation email to partner
        await sendEmail(
          env.SENDGRID_API_KEY,
          fromEmail,
          partnerEmail,
          partnerName,
          'Your DRIV-EN Referral Partner Application \u2014 Received',
          buildPartnerConfirmationEmail(partnerName)
        );

        // Notification email to support/admin
        await sendEmail(
          env.SENDGRID_API_KEY,
          fromEmail,
          supportEmail,
          null,
          'New Referral Partner Application: ' + partnerName,
          buildAdminNotificationEmail(partnerName, partnerEmail, partnerPhone)
        );
      }

      return jsonResponse({
        success: true,
        partnerId: partnerId,
        status: 'Pending',
        message: 'Your application has been submitted successfully. We will review your W-9 and contact you within 2-3 business days.'
      }, 200);

    } catch (err) {
      console.error('[REFERRAL-SIGNUP] Error:', err);
      return jsonResponse({
        error: 'An error occurred while processing your application.',
        details: err.message
      }, 500);
    }
  }
};
