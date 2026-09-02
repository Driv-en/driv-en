// ============================================================================
// driven-checkout-submit Worker — D1 Version (Session 11)
// ============================================================================
// PURPOSE: Handles checkout form submissions from the DRIV-EN website.
//   When a customer completes checkout, this worker:
//   1. Verifies the Cloudflare Turnstile bot-protection token
//   2. Validates all required customer fields server-side
//   3. Creates a new organization + admin user in D1 (so they can log in)
//   4. Creates order, customer, and subscription records in D1
//   5. Processes referral credits (if a referral code is present)
//   6. Sends a welcome email to the customer (via SendGrid) with activation
//      code + temporary password
//   7. Sends a notification email to DRIV-EN support
//
// ROUTE: api.driv-en.com (custom domain)
// BINDINGS:
//   - D1: DB → driv-en-db (UUID: c58c4597-57f7-418d-973b-d6c67f32f07e)
//   - Secrets: TURNSTILE_SECRET_KEY, SENDGRID_API_KEY
//   - Vars: SENDGRID_FROM_EMAIL, ONBOARDING_DOMAIN, SUPPORT_CONTACT
//
// CHANGES FROM PREVIOUS VERSION (Session 10):
//   - REMOVED all Airtable API calls. All data now goes to D1 only.
//   - ADDED D1 auto-migration (creates tables if they don't exist)
//   - ADDED password hashing (PBKDF2, same as auth worker) so the temp
//     password is stored hashed in D1 and the auth worker can verify it
//   - ADDED organization + user creation in D1 (previously only in Airtable)
//   - Referral processing now reads/writes D1 tables instead of Airtable
//
// LAST UPDATED: September 2, 2026 (Session 11)
// ============================================================================

const PBKDF2_ITERATIONS = 100000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS)
  });
}

function addPeriod(date, period) {
  var s = String(period || '').toLowerCase().trim();
  var ms = 365 * 24 * 60 * 60 * 1000;
  var m = s.match(/(\d+)\s*(day|days|month|months|year|years)/);
  if (m) {
    var n = parseInt(m[1], 10);
    var unit = m[2].replace(/s$/, '');
    if (unit === 'day') ms = n * 24 * 60 * 60 * 1000;
    else if (unit === 'month') ms = n * 30 * 24 * 60 * 60 * 1000;
    else if (unit === 'year') ms = n * 365 * 24 * 60 * 60 * 1000;
  }
  return new Date(date.getTime() + ms);
}

var stateTZ = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix',
  AR: 'America/Chicago', CA: 'America/Los_Angeles', CO: 'America/Denver',
  CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu',
  IA: 'America/Chicago', ID: 'America/Denver', IL: 'America/Chicago',
  IN: 'America/New_York', KS: 'America/Chicago', KY: 'America/New_York',
  LA: 'America/Chicago', MA: 'America/New_York', MD: 'America/New_York',
  ME: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago',
  MO: 'America/Chicago', MS: 'America/Chicago', MT: 'America/Denver',
  NC: 'America/New_York', ND: 'America/Chicago', NE: 'America/Chicago',
  NH: 'America/New_York', NJ: 'America/New_York', NM: 'America/Denver',
  NV: 'America/Los_Angeles', NY: 'America/New_York', OH: 'America/New_York',
  OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York',
  RI: 'America/New_York', SC: 'America/New_York', SD: 'America/Chicago',
  TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver',
  VA: 'America/New_York', VT: 'America/New_York', WA: 'America/Los_Angeles',
  WI: 'America/Chicago', WV: 'America/New_York', WY: 'America/Denver'
};

var zipOverrides = {
  TX: { '798': 'America/Denver', '799': 'America/Denver' },
  FL: { '323': 'America/Chicago', '324': 'America/Chicago', '325': 'America/Chicago' },
  IN: { '463': 'America/Chicago', '464': 'America/Chicago', '465': 'America/Chicago', '476': 'America/Chicago', '477': 'America/Chicago' },
  TN: { '376': 'America/New_York', '377': 'America/New_York', '378': 'America/New_York', '379': 'America/New_York' },
  KY: { '420': 'America/Chicago', '421': 'America/Chicago', '422': 'America/Chicago', '423': 'America/Chicago', '424': 'America/Chicago', '425': 'America/Chicago', '426': 'America/Chicago', '427': 'America/Chicago' },
  ND: { '589': 'America/Denver', '590': 'America/Denver', '591': 'America/Denver', '592': 'America/Denver', '593': 'America/Denver', '594': 'America/Denver', '595': 'America/Denver', '596': 'America/Denver', '597': 'America/Denver', '598': 'America/Denver', '599': 'America/Denver' },
  SD: { '577': 'America/Denver', '578': 'America/Denver', '579': 'America/Denver' },
  ID: { '838': 'America/Los_Angeles' }
};

function getTimezoneForLocation(state, zip) {
  var st = String(state || '').toUpperCase().trim();
  var z = String(zip || '').replace(/\D/g, '');
  if (zipOverrides[st] && z.length >= 3) {
    var prefix = z.substring(0, 3);
    if (zipOverrides[st][prefix]) return zipOverrides[st][prefix];
  }
  if (stateTZ[st]) return stateTZ[st];
  return 'America/Chicago';
}

function fmtLocal(date, tz) {
  var opts = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz, timeZoneName: 'short' };
  return new Intl.DateTimeFormat('en-US', opts).format(date);
}

function midnightInTimezone(date, tz) {
  var dateFmt = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz });
  var parts = dateFmt.formatToParts(date);
  var y = '', m = '', d = '';
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].type === 'year') y = parts[i].value;
    else if (parts[i].type === 'month') m = parts[i].value;
    else if (parts[i].type === 'day') d = parts[i].value;
  }
  var noon = new Date(y + '-' + m + '-' + d + 'T12:00:00.000Z');
  var timeFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: tz });
  var localHour = parseInt(timeFmt.format(noon), 10);
  if (localHour === 24) localHour = 0;
  var offsetHours = 12 - localHour;
  var pad = function(n) { return String(n).padStart(2, '0'); };
  return new Date(y + '-' + m + '-' + d + 'T' + pad(offsetHours) + ':00:00.000Z');
}

function genActivationCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function seg(n) {
    var out = '';
    for (var i = 0; i < n; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  }
  return seg(4) + '-' + seg(4) + '-' + seg(4) + '-' + seg(4);
}

function genPassword() {
  var chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  var out = '';
  for (var i = 0; i < 16; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function base64UrlEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}

async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const saltHexStr = bytesToHex(salt);
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, keyMaterial, 256);
  return { salt: saltHexStr, hash: base64UrlEncode(new Uint8Array(bits)) };
}

async function ensureD1Tables(env) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, order_id TEXT UNIQUE, org_id TEXT,
      contact_name TEXT, customer_email TEXT, customer_name TEXT,
      billing_address TEXT, city TEXT, state TEXT, zip TEXT,
      modules_selected TEXT, invoice_total REAL, taxable_sales REAL,
      tax_amount REAL, discount_code TEXT, payment_status TEXT,
      raw_payload TEXT, customer_id TEXT, subscription_type TEXT,
      activation_date TEXT, expiration_date TEXT, created_at TEXT
    )`).run();

    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, customer_id TEXT UNIQUE, org_id TEXT,
      company_name TEXT, admin_email TEXT, admin_phone TEXT,
      billing_address TEXT, city TEXT, state TEXT, zip TEXT,
      subscription_type TEXT, activation_date TEXT, expiration_date TEXT,
      access_period TEXT, order_id TEXT, status TEXT,
      referral_partner_id TEXT, referral_code TEXT, created_at TEXT
    )`).run();

    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY, customer_id TEXT, org_id TEXT, order_id TEXT,
      modules_selected TEXT, billing_model TEXT, price_calculated REAL,
      discount_applied TEXT, discount_percent REAL, discount_amount REAL,
      founder_override INTEGER DEFAULT 0, activation_date TEXT,
      expiration_date TEXT, status TEXT, payment_status TEXT,
      renewal_date TEXT, free_modules TEXT, module_free_until TEXT, created_at TEXT
    )`).run();

    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_partners (
      id TEXT PRIMARY KEY, partner_name TEXT, partner_email TEXT,
      partner_phone TEXT, company_referred TEXT, contact_email_referred TEXT,
      status TEXT DEFAULT 'Pending', referral_code TEXT, active INTEGER DEFAULT 0,
      is_eligible INTEGER DEFAULT 0, partner_status TEXT DEFAULT 'Pending',
      w9_attachment TEXT, w9_expiration_date TEXT, commission_rate REAL DEFAULT 0,
      linked_customer_id TEXT, commission_eligible_date TEXT,
      commission_payable INTEGER DEFAULT 0, referral_link_status TEXT,
      total_commission_earned REAL DEFAULT 0, total_commission_payable REAL DEFAULT 0,
      created_at TEXT
    )`).run();

    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_activity (
      id TEXT PRIMARY KEY, referrer_id TEXT, customer_id TEXT,
      customer_contact_name TEXT, customer_contact_email TEXT,
      referral_status TEXT, referral_date TEXT, referral_code_incoming TEXT,
      subscription_amount REAL, commission_rate REAL, commission_amount REAL,
      commission_eligible_date TEXT, commission_payable INTEGER DEFAULT 0,
      commission_eligible INTEGER DEFAULT 0, attribution_status TEXT,
      is_qualified INTEGER DEFAULT 0, start_date TEXT, mark_as_paid INTEGER DEFAULT 0,
      commission_status TEXT, commission_rate_override REAL, created_at TEXT
    )`).run();

    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_contacts (
      id TEXT PRIMARY KEY, contact_email TEXT, referral_partner_id TEXT,
      referral_code_used TEXT, setup_wizard_status TEXT,
      subscription_ids TEXT, created_at TEXT
    )`).run();
  } catch (e) {
    console.error('D1 schema migration error (non-fatal):', e.message);
  }
}

function normalizeCompanyName(name) {
  var s = String(name || '').toLowerCase().trim();
  s = s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
  s = s.replace(/\b(llc|inc|co|corp|company|ltd|lp|llp|pllc)\b/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function getEmailDomain(email) {
  var parts = String(email || '').split('@');
  return parts.length > 1 ? parts[1].toLowerCase().trim() : '';
}

function buildOnboardingEmail(d) {
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body style="font-family:Arial,sans-serif;background:#f7f7f7;padding:30px;margin:0;">';
  html += '<div style="max-width:600px;margin:auto;background:#ffffff;padding:25px;border-radius:10px;box-shadow:0 0 10px rgba(0,0,0,0.08);">';
  html += '<div style="text-align:center;margin-bottom:10px;"><img src="https://www.driv-en.com/logo.png" alt="DRIV\u2011EN Logo" style="width:160px;height:auto;" /></div>';
  html += '<h2 style="text-align:center;margin-bottom:8px;">Welcome to DRIV\u2011EN</h2>';
  html += '<div style="border:3px solid #00b140;border-radius:10px;padding:15px;margin-bottom:18px;background:#ffffff;">';
  html += '<h3 style="margin-top:0;">Your Account Details</h3>';
  html += '<p style="margin-top:8px;margin-bottom:12px;">';
  html += '<strong>Company:</strong> {{companyName}}<br>';
  html += '<strong>Contact Name:</strong> {{contactName}}<br>';
  html += '<strong>Email:</strong> {{customerEmail}}<br><strong>Phone:</strong> {{customerPhone}}<br><br>';
  html += '<strong>Customer ID:</strong> {{customerId}}<br>';
  html += '<strong>Order ID:</strong> {{orderId}}<br>';
  html += '<strong>Subscription Type:</strong> {{subscriptionType}}<br><br>';
  html += '<strong>Activation Date:</strong> <span style="font-weight:bold;">{{activationDate}}</span><br>';
  html += '<strong>Expiration Date:</strong> <span style="font-weight:bold;">{{expirationDate}}</span><br><br>';
  html += '<strong>Activation Code:</strong> <span style="font-size:17px;font-weight:bold;color:#00b140;">{{activationCode}}</span><br>';
  html += '<strong>Temporary Password:</strong> <span style="font-size:17px;font-weight:bold;color:#e53935;">{{temporaryPassword}}</span>';
  html += '</p>';
  html += '<div style="text-align:center;margin:20px 0;"><a href="https://www.driv-en.com/public/login.html" style="display:inline-block;padding:12px 20px;background:#C0C0C0;color:#000;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold;border:2px solid #C0C0C0;">Login to DRIV\u2011EN</a></div>';
  html += '</div>';
  html += '<div style="border:3px solid #00b140;border-radius:10px;padding:15px;margin-bottom:18px;background:#ffffff;">';
  html += '<h3 style="margin-top:0;">Modules Purchased</h3>';
  html += '<ul style="margin-top:8px;padding-left:20px;">{{modulesPurchasedList}}</ul>';
  html += '</div>';
  html += '<div style="border:3px solid #00b140;border-radius:10px;padding:15px;margin-bottom:18px;background:#ffffff;">';
  html += '<h3 style="margin-top:0;">Getting Started</h3>';
  html += '<p style="margin-top:8px;">1. Click the login button above.<br>2. Enter your email and temporary password.<br>3. When prompted, enter your Activation Code.<br>4. Set your permanent password.<br>5. Begin onboarding using the guided checklist.</p>';
  html += '</div>';
  html += '<p style="margin-top:10px;">If you need help at any point, our team is here for you.<br><strong>Email:</strong> <a href="mailto:support@driv-en.com" style="color:#e53935;text-decoration:none;font-weight:bold;">support@driv-en.com</a></p>';
  html += '<p style="color:#999;font-size:13px;text-align:center;margin-top:20px;">\u00a9 2026 Digital Safety Inspection, LLC \u2013 DRIV\u2011EN Platform</p>';
  html += '</div></body></html>';
  html = html.split('{{companyName}}').join(d.companyName);
  html = html.split('{{contactName}}').join(d.contactName);
  html = html.split('{{customerEmail}}').join(d.customerEmail);
  html = html.split('{{customerPhone}}').join(d.customerPhone);
  html = html.split('{{customerId}}').join(d.customerId);
  html = html.split('{{orderId}}').join(d.orderId);
  html = html.split('{{subscriptionType}}').join(d.subscriptionType);
  html = html.split('{{activationDate}}').join(d.activationDate);
  html = html.split('{{expirationDate}}').join(d.expirationDate);
  html = html.split('{{activationCode}}').join(d.activationCode);
  html = html.split('{{temporaryPassword}}').join(d.temporaryPassword);
  html = html.split('{{modulesPurchasedList}}').join(d.modulesPurchasedList);
  return html;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    let payload;
    try { payload = await request.json(); } catch (err) { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

    const turnstileToken = payload.turnstileToken || '';
    if (!turnstileToken) return jsonResponse({ error: 'Missing Turnstile token' }, 403);

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'secret=' + encodeURIComponent(env.TURNSTILE_SECRET_KEY) + '&response=' + encodeURIComponent(turnstileToken)
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.success) return jsonResponse({ error: 'Turnstile verification failed' }, 403);

    const p = payload || {};
    const customerEmail = p.customerEmail || '';
    const customerName = p.customerName || '';
    const contactName = p.contactName || '';
    const billingAddress = p.billingAddress || '';
    const city = p.city || '';
    const state = p.state || '';
    const zip = p.zip || '';
    const modulesSelected = Array.isArray(p.modulesSelected) ? p.modulesSelected : [];
    const invoiceTotal = Number(p.invoiceTotal) || 0;
    const discountCode = p.discountCode || '';
    const customerPhone = p.customerPhone || p.phone || p.adminPhone || '';
    const subscriptionType = p.subscriptionType || 'Annual';
    const accessPeriod = p.accessPeriod || '12 months';
    const billingModel = p.billingModel || subscriptionType;
    const priceCalculated = Number(p.priceCalculated) || invoiceTotal;
    const discountPercent = Number(p.discountPercent) || 0;
    const discountAmount = Number(p.discountAmount) || 0;
    const moduleFreeUntil = p.moduleFreeUntil || '';
    const founderOverride = !!(p.founderOverride);
    const orderId = p.orderId || ('ORD-' + Date.now());
    const referralCode = (p.referralCode || '').trim();
    const invoiceSubtotal = Number(p.invoiceSubtotal) || 0;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const requiredErrors = [];
    if (!customerName) requiredErrors.push('Company Name');
    if (!contactName) requiredErrors.push('Contact Name');
    if (!customerPhone) requiredErrors.push('Phone');
    if (!customerEmail) requiredErrors.push('Email');
    else if (!emailRegex.test(customerEmail)) requiredErrors.push('Email (invalid format)');
    if (!billingAddress) requiredErrors.push('Street');
    if (!city) requiredErrors.push('City');
    if (!state) requiredErrors.push('State');
    if (!zip) requiredErrors.push('Zip');
    if (requiredErrors.length) return jsonResponse({ error: 'Missing required field(s): ' + requiredErrors.join(', ') }, 400);

    let freeModulesArr = [];
    if (Array.isArray(p.freeModules)) freeModulesArr = p.freeModules;
    else if (p.freeModules && typeof p.freeModules === 'string') freeModulesArr = p.freeModules.split(',').map(function(s) { return s.trim(); }).filter(Boolean);

    const now = new Date();
    const taxableSales = invoiceTotal;
    const isTexas = state.toLowerCase() === 'tx' || state.toLowerCase() === 'texas';
    const taxAmount = isTexas ? Number((invoiceTotal * 0.0825).toFixed(2)) : 0;

    let discountApplied = 'None';
    if (founderOverride) discountApplied = 'Founder Override';
    else if (freeModulesArr.length > 0) discountApplied = 'Free Module';
    else if (discountAmount > 0) discountApplied = 'Fixed Amount';
    else if (discountPercent > 0) discountApplied = 'Percentage';
    else if (discountCode && discountCode.trim()) discountApplied = 'Percentage';

    var customerTZ = getTimezoneForLocation(state, zip);
    var activationDateISO = now.toISOString();
    var activationDate = fmtLocal(now, customerTZ);
    var expDate = midnightInTimezone(addPeriod(now, accessPeriod), customerTZ);
    var expirationDateISO = expDate.toISOString();
    var expirationDate = fmtLocal(expDate, customerTZ);
    var renewalDateISO = expirationDateISO;
    const paymentStatus = 'Paid';
    const statusActive = 'Active';

    const customerId = p.customerId || ('CUST-' + Date.now().toString(36).toUpperCase());
    const activationCode = p.activationCode || genActivationCode();
    const temporaryPassword = genPassword();
    const nameParts = contactName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const { salt: pwSalt, hash: pwHash } = await hashPassword(temporaryPassword);

    await ensureD1Tables(env);

    try {
      const adminRole = await env.DB.prepare("SELECT id FROM roles WHERE LOWER(name) = 'admin' LIMIT 1").first();
      if (!adminRole) {
        const roleId = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO roles (id, name) VALUES (?, 'admin')").bind(roleId).run();
        adminRole = { id: roleId };
      }

      const orgId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO organizations (id, name, status, activation_code, activation_complete, activated_modules, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)").bind(orgId, customerName, 'active', activationCode, JSON.stringify(modulesSelected), now.toISOString()).run();

      const userId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO users (id, email, org_id, password_hash, password_salt, must_change_password, is_active, twofa_enabled, first_name, last_name, role_id, created_at) VALUES (?, ?, ?, ?, ?, 1, 1, 0, ?, ?, ?, ?)").bind(userId, customerEmail.toLowerCase().trim(), orgId, pwHash, pwSalt, firstName, lastName, adminRole.id, now.toISOString()).run();

      const orderRowId = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO orders (id, order_id, org_id, contact_name, customer_email, customer_name, billing_address, city, state, zip, modules_selected, invoice_total, taxable_sales, tax_amount, discount_code, payment_status, raw_payload, customer_id, subscription_type, activation_date, expiration_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(orderRowId, orderId, orgId, contactName, customerEmail.toLowerCase().trim(), customerName, billingAddress, city, state, zip, JSON.stringify(modulesSelected), invoiceTotal, taxableSales, taxAmount, discountCode, paymentStatus, JSON.stringify(payload), customerId, subscriptionType, activationDateISO, expirationDateISO, now.toISOString()).run();

      const customerRowId = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO customers (id, customer_id, org_id, company_name, admin_email, admin_phone, billing_address, city, state, zip, subscription_type, activation_date, expiration_date, access_period, order_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(customerRowId, customerId, orgId, customerName, customerEmail.toLowerCase().trim(), customerPhone, billingAddress, city, state, zip, subscriptionType, activationDateISO, expirationDateISO, accessPeriod, orderId, statusActive, now.toISOString()).run();

      const subRowId = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO subscriptions (id, customer_id, org_id, order_id, modules_selected, billing_model, price_calculated, discount_applied, discount_percent, discount_amount, founder_override, activation_date, expiration_date, status, payment_status, renewal_date, free_modules, module_free_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(subRowId, customerId, orgId, orderId, JSON.stringify(modulesSelected), billingModel, priceCalculated, discountApplied, discountPercent, discountAmount, founderOverride ? 1 : 0, activationDateISO, expirationDateISO, statusActive, paymentStatus, renewalDateISO, freeModulesArr.length > 0 ? JSON.stringify(freeModulesArr) : null, moduleFreeUntil || null, now.toISOString()).run();

      let referralResult = { processed: false, status: 'no_referral' };
      try {
        const subscriptionAmount = invoiceSubtotal;
        let referralPartner = null;
        let matchMethod = 'none';

        if (referralCode) {
          referralPartner = await env.DB.prepare("SELECT * FROM referral_partners WHERE contact_email_referred = ? AND status = 'Pending' AND referral_code = ? LIMIT 1").bind(customerEmail.toLowerCase().trim(), referralCode).first();
        } else {
          referralPartner = await env.DB.prepare("SELECT * FROM referral_partners WHERE contact_email_referred = ? AND status = 'Pending' LIMIT 1").bind(customerEmail.toLowerCase().trim()).first();
        }
        if (referralPartner) matchMethod = 'exact_email';

        if (!referralPartner) {
          const allPending = await env.DB.prepare("SELECT * FROM referral_partners WHERE status = 'Pending'").all();
          const pendingRows = allPending.results || [];
          const normalizedIncomingName = normalizeCompanyName(customerName);
          const incomingDomain = getEmailDomain(customerEmail);
          if (normalizedIncomingName) {
            for (let i = 0; i < pendingRows.length; i++) {
              if (normalizeCompanyName(String(pendingRows[i].company_referred || '')) === normalizedIncomingName) { referralPartner = pendingRows[i]; matchMethod = 'company_name'; break; }
            }
          }
          if (!referralPartner && incomingDomain) {
            for (let i = 0; i < pendingRows.length; i++) {
              if (getEmailDomain(String(pendingRows[i].contact_email_referred || '')) === incomingDomain) { referralPartner = pendingRows[i]; matchMethod = 'email_domain'; break; }
            }
          }
        }

        if (!referralPartner) {
          referralResult = { processed: false, status: 'no_match' };
        } else {
          const referrerId = referralPartner.id;
          const referrerFields = referralPartner;
          const effectiveReferralCode = referralCode || String(referrerFields.referral_code || '').trim();

          if (referrerFields.linked_customer_id) {
            referralResult = { processed: false, status: 'duplicate_prevented', referralId: referrerId };
          } else {
            const partnerStatus = String(referrerFields.partner_status || '').trim();
            const isActive = referrerFields.active === 1;
            const isEligible = referrerFields.is_eligible === 1;
            const w9HasAttachment = !!referrerFields.w9_attachment;
            const w9ExpirationDate = referrerFields.w9_expiration_date ? new Date(referrerFields.w9_expiration_date) : null;
            const w9NotExpired = w9ExpirationDate && w9ExpirationDate > now;

            const eligibilityFailures = [];
            if (partnerStatus !== 'Approved') eligibilityFailures.push('Partner Status not Approved');
            if (!isActive) eligibilityFailures.push('Not Active');
            if (!isEligible) eligibilityFailures.push('Not Eligible');
            if (!w9HasAttachment) eligibilityFailures.push('W-9 Attachment missing');
            if (!w9NotExpired) eligibilityFailures.push('W-9 expired or missing');

            if (eligibilityFailures.length > 0) {
              const rejectedActivityId = crypto.randomUUID();
              await env.DB.prepare(`INSERT INTO referral_activity (id, referrer_id, customer_id, customer_contact_name, customer_contact_email, referral_status, referral_date, referral_code_incoming, subscription_amount, commission_rate, attribution_status, is_qualified, start_date, mark_as_paid, commission_status, commission_payable, commission_eligible, created_at) VALUES (?, ?, ?, ?, ?, 'Rejected - Not Eligible', ?, ?, ?, ?, 'Failed Eligibility', 0, ?, 0, 'Rejected', 0, 0, ?)`).bind(rejectedActivityId, referrerId, customerId, contactName, customerEmail.toLowerCase().trim(), now.toISOString(), effectiveReferralCode, subscriptionAmount, Number(referrerFields.commission_rate) || 0, activationDateISO, now.toISOString()).run();
              referralResult = { processed: true, status: 'eligibility_failed', referralId: referrerId, failures: eligibilityFailures };
            } else {
              let commissionRate = 0;
              const payloadOverride = Number(p.commissionRateOverride) || 0;
              if (payloadOverride > 0) commissionRate = payloadOverride;
              else if (String(billingModel || subscriptionType).toLowerCase() === 'monthly') commissionRate = 5;
              else commissionRate = 10;

              const refActivityId = crypto.randomUUID();
              await env.DB.prepare(`INSERT INTO referral_activity (id, referrer_id, customer_id, customer_contact_name, customer_contact_email, referral_status, referral_date, referral_code_incoming, subscription_amount, commission_rate, commission_amount, commission_eligible_date, commission_payable, commission_eligible, attribution_status, is_qualified, start_date, mark_as_paid, commission_status, commission_rate_override, created_at) VALUES (?, ?, ?, ?, ?, 'Converted', ?, ?, ?, ?, ?, ?, 1, 1, 'Success', 1, ?, 0, 'Pending', ?, ?)`).bind(refActivityId, referrerId, customerId, contactName, customerEmail.toLowerCase().trim(), now.toISOString(), effectiveReferralCode, subscriptionAmount, commissionRate, 0, now.toISOString(), activationDateISO, payloadOverride > 0 ? payloadOverride : null, now.toISOString()).run();

              const commissionAmount = Number((subscriptionAmount * (commissionRate / 100)).toFixed(2));
              await env.DB.prepare("UPDATE referral_activity SET commission_amount = ? WHERE id = ?").bind(commissionAmount, refActivityId).run();

              await env.DB.prepare(`UPDATE referral_partners SET linked_customer_id = ?, status = 'Converted', commission_eligible_date = ?, commission_payable = 1, referral_link_status = 'Converted' WHERE id = ?`).bind(customerId, now.toISOString(), referrerId).run();

              const newTotalEarned = Number(((Number(referrerFields.total_commission_earned) || 0) + commissionAmount).toFixed(2));
              const newTotalPayable = Number(((Number(referrerFields.total_commission_payable) || 0) + commissionAmount).toFixed(2));
              await env.DB.prepare("UPDATE referral_partners SET total_commission_earned = ?, total_commission_payable = ? WHERE id = ?").bind(newTotalEarned, newTotalPayable, referrerId).run();

              await env.DB.prepare("UPDATE customers SET referral_partner_id = ?, referral_code = ? WHERE id = ?").bind(referrerId, effectiveReferralCode, customerRowId).run();

              const contactMatch = await env.DB.prepare("SELECT * FROM referral_contacts WHERE contact_email = ? LIMIT 1").bind(customerEmail.toLowerCase().trim()).first();
              if (contactMatch) {
                let existingSubIds = [];
                try { existingSubIds = JSON.parse(contactMatch.subscription_ids || '[]'); } catch (e) {}
                existingSubIds.push(subRowId);
                await env.DB.prepare("UPDATE referral_contacts SET referral_partner_id = ?, referral_code_used = ?, setup_wizard_status = 'Referred - Converted', subscription_ids = ? WHERE id = ?").bind(referrerId, effectiveReferralCode, JSON.stringify(existingSubIds), contactMatch.id).run();
              }

              referralResult = { processed: true, status: 'converted', referralId: referrerId, activityId: refActivityId, commissionAmount: commissionAmount, commissionRate: commissionRate, matchMethod: matchMethod };
            }
          }
        }
      } catch (refErr) {
        referralResult = { processed: false, status: 'error', error: refErr.message };
      }

      const onboardingDomain = env.ONBOARDING_DOMAIN || 'driv-en.com';
      const loginUrl = 'https://www.' + onboardingDomain + '/public/login.html';
      const fromEmail = env.SENDGRID_FROM_EMAIL || 'noreply@driv-en.com';
      const supportContact = env.SUPPORT_CONTACT || 'jblood@digitalsafetyinspection.com';
      var modulesListHtml = modulesSelected.map(function(m) { return '<li>' + m + '</li>'; }).join('');

      const emailHtml = buildOnboardingEmail({ companyName: customerName, contactName: contactName, customerEmail: customerEmail, customerPhone: customerPhone, customerId: customerId, orderId: orderId, subscriptionType: subscriptionType, activationDate: activationDate, expirationDate: expirationDate, activationCode: activationCode, temporaryPassword: temporaryPassword, modulesPurchasedList: modulesListHtml });

      const customerEmailRes = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { 'Authorization': 'Bearer ' + env.SENDGRID_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: customerEmail, name: contactName }] }], from: { email: fromEmail, name: 'DRIV\u2011EN Platform' }, subject: 'Welcome to DRIV\u2011EN \u2014 Your Onboarding Details', content: [{ type: 'text/html', value: emailHtml }] }) });
      if (!customerEmailRes.ok) { const emailErr = await customerEmailRes.text(); return jsonResponse({ error: 'SendGrid customer email failed', details: emailErr, orderId: orderId, customerId: customerId }, 502); }

      const supportEmailRes = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { 'Authorization': 'Bearer ' + env.SENDGRID_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: supportContact }] }], from: { email: fromEmail, name: 'DRIV\u2011EN Platform' }, subject: 'DRIV\u2011EN has a new customer: ' + customerName, content: [{ type: 'text/html', value: emailHtml }] }) });
      if (!supportEmailRes.ok) { const supportErr = await supportEmailRes.text(); return jsonResponse({ error: 'SendGrid support email failed', details: supportErr, orderId: orderId, customerId: customerId }, 502); }

      return jsonResponse({ success: true, orderId: orderId, customerId: customerId, activationCode: activationCode, customerTimezone: customerTZ, orgId: orgId, userId: userId, loginUrl: loginUrl, referral: referralResult }, 200);
    } catch (err) {
      console.error('Checkout processing failed:', err.message, err.stack);
      return jsonResponse({ error: 'Checkout processing failed', details: err.message }, 500);
    }
  }
};
