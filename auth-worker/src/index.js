// ==========================================
// DRIV-EN AUTH WORKER — UPDATED VERSION
// Last updated: August 27, 2026
// Changes from previous version:
//   - handleLogin: now includes first_name in JWT and response
//   - handleSession: now includes first_name (from JWT or DB fallback)
//   - handleLogin2FA: now includes first_name in JWT and response
//   - handleRefresh: now includes first_name in JWT
//   - handleChangePassword: now includes first_name in new session JWT
//   - Section comments added throughout for easy navigation
//   - console.error added to all catch blocks
//   - handleForgotPassword and handleResetPassword functions included (were missing before)
//   - 2FA temporarily disabled in handleLogin (empty if block, comment shows how to re-enable)
//   - NEW: handleSaveLogo and handleGetLogo — company logo stored in D1 company_settings table
//     Logo syncs across ALL devices and ALL employees (no longer per-device localStorage)
//   - NEW (Aug 29): handleSession now fetches role from DB as fallback when JWT role is null
//     This fixes the issue where the Admin Dashboard button was hidden for admins because
//     the LEFT JOIN on roles returned null for role_name.
//
// Routes:
//   POST /auth/login              — Login with email + password
//   POST /auth/logout             — Clear session cookies
//   GET  /auth/session            — Check if logged in, return user info
//   POST /auth/refresh            — Refresh session token using refresh token
//   POST /auth/change-password    — Change password (requires current password)
//   POST /auth/forgot-password    — Send password reset email
//   POST /auth/reset-password     — Reset password using token from email
//   POST /auth/setup-2fa          — Generate TOTP secret for 2FA setup
//   POST /auth/verify-2fa         — Verify TOTP code and enable 2FA
//   POST /auth/disable-2fa        — Disable 2FA (requires password)
//   POST /auth/login-2fa          — Login with TOTP code (after 2FA enabled)
//   POST /auth/email-backup-codes — Email 2FA backup codes to user
//   POST /auth/save-logo          — Save company logo to D1 (admin uploads, all employees see it)
//   GET  /auth/get-logo           — Get company logo from D1 (every page loads this)
//
// Bindings used:
//   DB (D1)            — Users, organizations, roles, company_settings tables
//   JWT_SECRET (secret)— Signs and verifies JWT tokens
//   ONBOARDING_KV (KV) — Stores password reset tokens, 2FA pending secrets, backup codes
//   FROM_EMAIL (text)  — Sender email for SendGrid emails
//   SENDGRID_API_KEY (secret) — Sends password reset and 2FA backup code emails
//   ONBOARDING_DOMAIN (text)  — Base URL for reset links and email logos
//   SUPPORT_CONTACT (text)    — Support email shown in email templates
// ==========================================

const SESSION_LIFETIME = 3600;
const REFRESH_LIFETIME = 2592000;
const PBKDF2_ITERATIONS = 100000;
const COOKIE_SESSION = "driv_en_session";
const COOKIE_REFRESH = "driv_en_refresh";

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function base64UrlEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signJWT(payload, secret, lifetimeSeconds) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + lifetimeSeconds };
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(fullPayload)));
  const data = headerB64 + "." + payloadB64;
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return data + "." + base64UrlEncode(new Uint8Array(sig));
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = headerB64 + "." + payloadB64;
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlDecode(sigB64), new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch (e) {
    console.error("verifyJWT error:", e.message);
    return null;
  }
}

async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const saltHexStr = bytesToHex(salt);
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, keyMaterial, 256);
  return { salt: saltHexStr, hash: base64UrlEncode(new Uint8Array(bits)) };
}

async function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = await hashPassword(password, storedSalt);
  return hash === storedHash;
}

function bytesToHex(bytes) { return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(""); }
function hexToBytes(hex) { const arr = new Uint8Array(hex.length / 2); for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16); return arr; }

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(";")) { const idx = pair.indexOf("="); if (idx === -1) continue; cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim(); }
  return cookies;
}

function buildCookie(name, value, maxAge) { let c = name + "=" + value + "; HttpOnly; Secure; SameSite=Lax; Path=/"; if (maxAge !== undefined) c += "; Max-Age=" + maxAge; return c; }
function clearCookie(name) { return name + "=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"; }
function json(data, status, extraHeaders) { return new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json" }, extraHeaders || {}) }); }

// ==========================================
// EMAIL FUNCTION (SendGrid)
// ==========================================

async function sendEmail(env, to, subject, htmlContent, textContent) {
  if (!env.SENDGRID_API_KEY) { console.error("sendEmail: SENDGRID_API_KEY not bound"); return false; }
  const msg = { personalizations: [{ to: [{ email: to }] }], from: { email: env.FROM_EMAIL }, subject, content: [{ type: "text/plain", value: textContent }, { type: "text/html", value: htmlContent }] };
  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { "Authorization": "Bearer " + env.SENDGRID_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify(msg) });
  return resp.ok;
}

// ==========================================
// LOGIN HANDLER
// Includes first_name in JWT and response
// ==========================================

async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { console.error("Login JSON parse error:", e.message); return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { email, password, remember } = body;
  if (!email || !password) return json({ success: false, error: "Email and password are required" }, 400);
  const rememberMe = remember === true;
  const result = await env.DB.prepare("SELECT u.id, u.email, u.org_id, u.password_hash, u.password_salt, u.must_change_password, u.is_active, u.twofa_enabled, u.first_name, o.status AS org_status, r.name AS role_name FROM users u JOIN organizations o ON u.org_id = o.id LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ?").bind(email.toLowerCase().trim()).first();
  if (!result) return json({ success: false, error: "Invalid email or password" }, 401);
  if (!result.is_active) return json({ success: false, error: "Account is deactivated. Contact your administrator." }, 403);
  if (result.org_status !== "active") return json({ success: false, error: "Your organization's subscription is not active. Contact your administrator." }, 403);
  const valid = await verifyPassword(password, result.password_hash, result.password_salt);
  if (!valid) return json({ success: false, error: "Invalid email or password" }, 401);
  if (result.twofa_enabled === 1) {
    // 2FA temporarily disabled during development — skip and proceed with normal login
    // To re-enable: replace this block with: return json({ success: false, requires2FA: true, email: email.toLowerCase().trim(), error: "2FA verification required" });
  }
  const sessionToken = await signJWT({ sub: result.email, email: result.email, org_id: result.org_id, role: result.role_name, first_name: result.first_name || "", must_change_password: result.must_change_password === 1, twofa_enabled: result.twofa_enabled === 1 }, env.JWT_SECRET, SESSION_LIFETIME);
  const setCookies = [buildCookie(COOKIE_SESSION, sessionToken, rememberMe ? SESSION_LIFETIME : undefined)];
  if (rememberMe) { const refreshToken = await signJWT({ sub: result.email, email: result.email, org_id: result.org_id, type: "refresh" }, env.JWT_SECRET, REFRESH_LIFETIME); setCookies.push(buildCookie(COOKIE_REFRESH, refreshToken, REFRESH_LIFETIME)); }
  return json({ success: true, role: result.role_name, first_name: result.first_name || "", must_change_password: result.must_change_password === 1, twofa_enabled: result.twofa_enabled === 1 }, 200, { "Set-Cookie": setCookies.join(", ") });
}

// ==========================================
// CHANGE PASSWORD HANDLER
// ==========================================

async function handleChangePassword(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { console.error("ChangePassword JSON parse error:", e.message); return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { current_password, new_password } = body;
  if (!current_password || !new_password) return json({ success: false, error: "Current password and new password are required" }, 400);
  if (new_password.length < 8) return json({ success: false, error: "New password must be at least 8 characters" }, 400);
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[COOKIE_SESSION];
  if (!token) return json({ success: false, error: "Not authenticated" }, 401);
  const session = await verifyJWT(token, env.JWT_SECRET);
  if (!session) return json({ success: false, error: "Session expired" }, 401);
  const user = await env.DB.prepare("SELECT password_hash, password_salt FROM users WHERE email = ?").bind(session.email).first();
  if (!user) return json({ success: false, error: "User not found" }, 404);
  const valid = await verifyPassword(current_password, user.password_hash, user.password_salt);
  if (!valid) return json({ success: false, error: "Current password is incorrect" }, 401);
  const { salt, hash } = await hashPassword(new_password);
  await env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE email = ?").bind(hash, salt, session.email).run();
  const newSessionToken = await signJWT({ sub: session.email, email: session.email, org_id: session.org_id, role: session.role, first_name: session.first_name || "", must_change_password: false }, env.JWT_SECRET, SESSION_LIFETIME);
  return json({ success: true }, 200, { "Set-Cookie": buildCookie(COOKIE_SESSION, newSessionToken, SESSION_LIFETIME) });
}

// ==========================================
// SESSION HANDLER
// Returns first_name, last_name, full_name, and role from JWT or DB fallback
// ==========================================

async function handleSession(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[COOKIE_SESSION];
  if (!token) return json({ authenticated: false }, 401);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return json({ authenticated: false }, 401);
  // Fetch first_name, last_name, full_name, and role from DB as fallback
  // This handles older JWTs that don't have these fields, AND handles
  // cases where the JWT role is null (e.g., user was created with a
  // null role_id, or the roles table JOIN failed at login time).
  let firstName = payload.first_name || "";
  let lastName = payload.last_name || "";
  let fullName = payload.full_name || "";
  let role = payload.role || "";
  if (!firstName || !fullName || !role) {
    try {
      const user = await env.DB.prepare(
        "SELECT u.first_name, u.last_name, u.full_name, u.role_id, r.name AS role_name " +
        "FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ?"
      ).bind(payload.email).first();
      if (user) {
        if (user.first_name) firstName = user.first_name;
        if (user.last_name) lastName = user.last_name;
        if (user.full_name) fullName = user.full_name;
        // If full_name is empty but we have first and last, build it
        if (!fullName && firstName) fullName = [firstName, lastName].filter(x => x).join(" ");
        // Use DB role if JWT role is missing/null
        if (!role && user.role_name) role = user.role_name;
      }
    } catch (e) { console.error("Session name/role fetch error:", e.message); }
  }
  return json({ authenticated: true, user: { email: payload.email, org_id: payload.org_id, role: role, first_name: firstName, last_name: lastName, full_name: fullName, must_change_password: payload.must_change_password === true } }, 200);
}

// ==========================================
// LOGOUT HANDLER
// ==========================================

async function handleLogout() { return json({ success: true }, 200, { "Set-Cookie": clearCookie(COOKIE_SESSION) + ", " + clearCookie(COOKIE_REFRESH) }); }

// ==========================================
// REFRESH TOKEN HANDLER
// Includes first_name in new JWT
// ==========================================

async function handleRefresh(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const refreshToken = cookies[COOKIE_REFRESH];
  if (!refreshToken) return json({ success: false, error: "No refresh token" }, 401);
  const payload = await verifyJWT(refreshToken, env.JWT_SECRET);
  if (!payload || payload.type !== "refresh") return json({ success: false, error: "Invalid or expired refresh token" }, 401);
  const result = await env.DB.prepare("SELECT u.email, u.org_id, u.is_active, u.first_name, o.status AS org_status, r.name AS role_name FROM users u JOIN organizations o ON u.org_id = o.id LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = ?").bind(payload.email).first();
  if (!result || !result.is_active || result.org_status !== "active") return json({ success: false, error: "Account or organization is no longer active" }, 401);
  const sessionToken = await signJWT({ sub: result.email, email: result.email, org_id: result.org_id, role: result.role_name, first_name: result.first_name || "", must_change_password: false }, env.JWT_SECRET, SESSION_LIFETIME);
  return json({ success: true }, 200, { "Set-Cookie": buildCookie(COOKIE_SESSION, sessionToken, SESSION_LIFETIME) });
}

// ==========================================
// FORGOT PASSWORD HANDLER
// Generates reset token in KV, emails reset link
// ==========================================

async function handleForgotPassword(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { console.error("ForgotPassword JSON parse error:", e.message); return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { email } = body;
  if (!email) return json({ success: false, error: "Email is required" }, 400);
  try {
    const emailLower = email.toLowerCase().trim();
    const user = await env.DB.prepare("SELECT id, email, first_name, last_name FROM users WHERE email = ?").bind(emailLower).first();
    if (!user) return json({ success: true, message: "If an account exists for that email, a reset link has been sent." });
    const resetToken = crypto.randomUUID();
    await env.ONBOARDING_KV.put("pwd_reset:" + resetToken, JSON.stringify({ userId: user.id, email: user.email }), { expirationTtl: 1800 });
    const resetUrl = env.ONBOARDING_DOMAIN + "/public/reset-password?token=" + resetToken;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
    const supportContact = env.SUPPORT_CONTACT || "support@driv-en.com";
    const emailHtml = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="text-align:center;padding:24px 0;"><img src="' + env.ONBOARDING_DOMAIN + '/logo.png?v=2026" alt="DRIV-EN" style="max-height:80px;"></div><h2 style="text-align:center;color:#1e293b;font-size:22px;margin:24px 0 16px 0;">Password Reset Request</h2><p>Hello ' + fullName + ',</p><p>We received a request to reset your DRIV-EN account password.</p><p>Click the button below to set a new password. This link will expire in 30 minutes.</p><p style="text-align:center;margin:24px 0;"><a href="' + resetUrl + '" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:15px;font-weight:600;">RESET PASSWORD</a></p><p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px;border-radius:6px;display:inline-block;">If you did not request a password reset, you can safely ignore this email.</p><p>If you have any questions, contact support at <a href="mailto:' + supportContact + '">' + supportContact + '</a>.</p><p>Best regards,<br>DRIV-EN Team</p></div>';
    const emailText = "Password Reset Request\n\nHello " + fullName + ",\n\nWe received a request to reset your DRIV-EN account password.\n\nClick the link below to set a new password. This link will expire in 30 minutes.\n" + resetUrl + "\n\nIf you did not request a password reset, you can safely ignore this email.\n\nIf you have any questions, contact support at " + supportContact + ".\n\nBest regards, DRIV-EN Team";
    await sendEmail(env, user.email, "DRIV-EN Password Reset", emailHtml, emailText);
    return json({ success: true, message: "If an account exists for that email, a reset link has been sent." });
  } catch (e) {
    console.error("ForgotPassword error:", e.message, e.stack);
    return json({ success: false, error: "Failed to process password reset request" }, 500);
  }
}

// ==========================================
// RESET PASSWORD HANDLER
// Validates token from KV, updates password
// ==========================================

async function handleResetPassword(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { console.error("ResetPassword JSON parse error:", e.message); return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { token, new_password } = body;
  if (!token || !new_password) return json({ success: false, error: "Token and new password are required" }, 400);
  if (new_password.length < 8) return json({ success: false, error: "Password must be at least 8 characters" }, 400);
  try {
    const stored = await env.ONBOARDING_KV.get("pwd_reset:" + token);
    if (!stored) return json({ success: false, error: "Invalid or expired reset token" }, 400);
    const resetData = JSON.parse(stored);
    const { salt, hash } = await hashPassword(new_password);
    await env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?").bind(hash, salt, resetData.userId).run();
    await env.ONBOARDING_KV.delete("pwd_reset:" + token);
    return json({ success: true, message: "Password reset successfully" });
  } catch (e) {
    console.error("ResetPassword error:", e.message, e.stack);
    return json({ success: false, error: "Failed to reset password" }, 500);
  }
}

// ==========================================
// TOTP / 2FA HELPER FUNCTIONS
// ==========================================

function base32Encode(bytes) { const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, value = 0, output = ""; for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) { output += alphabet[(value << (5 - bits)) & 31]; } return output; }
function base32Decode(str) { const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; const cleanStr = str.replace(/=/g, "").toUpperCase(); let bits = 0, value = 0, output = []; for (const char of cleanStr) { const idx = alphabet.indexOf(char); if (idx === -1) continue; value = (value << 5) | idx; bits += 5; if (bits >= 8) { output.push((value >>> (bits - 8)) & 0xFF); bits -= 8; } } return new Uint8Array(output); }
async function generateTotpSecret() { return base32Encode(crypto.getRandomValues(new Uint8Array(20))); }
async function generateTotpCode(secret, timestamp) { const time = Math.floor((timestamp || Date.now()) / 1000 / 30); const buffer = new ArrayBuffer(8); const view = new DataView(buffer); view.setUint32(0, Math.floor(time / 0x100000000)); view.setUint32(4, time & 0xFFFFFFFF); const key = base32Decode(secret); const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]); const hmac = await crypto.subtle.sign("HMAC", cryptoKey, buffer); const hmacBytes = new Uint8Array(hmac); const offset = hmacBytes[hmacBytes.length - 1] & 0x0F; const code = ((hmacBytes[offset] & 0x7F) << 24) | ((hmacBytes[offset + 1] & 0xFF) << 16) | ((hmacBytes[offset + 2] & 0xFF) << 8) | (hmacBytes[offset + 3] & 0xFF); return (code % 1000000).toString().padStart(6, "0"); }
async function verifyTotpCode(secret, code) { const now = Date.now(); for (let offset = -1; offset <= 1; offset++) { if (await generateTotpCode(secret, now + offset * 30000) === code) return true; } return false; }
function generateBackupCodes() { const codes = []; for (let i = 0; i < 10; i++) { const bytes = crypto.getRandomValues(new Uint8Array(4)); codes.push(Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")); } return codes; }

// ==========================================
// 2FA: EMAIL BACKUP CODES
// ==========================================

async function handleEmailBackupCodes(request, env) {
  try {
    const cookies = parseCookies(request.headers.get("Cookie")); const token = cookies[COOKIE_SESSION];
    if (!token) return json({ success: false, error: "Not authenticated" }, 401);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) return json({ success: false, error: "Not authenticated" }, 401);
    const user = await env.DB.prepare("SELECT id, email, first_name, last_name FROM users WHERE email = ?").bind(payload.email).first();
    if (!user) return json({ success: false, error: "User not found" }, 404);
    const stored = await env.ONBOARDING_KV.get("2fa_backup:" + user.id);
    if (!stored) return json({ success: false, error: "No backup codes found" }, 400);
    const backupCodes = JSON.parse(stored);
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
    const supportContact = env.SUPPORT_CONTACT || "support@driv-en.com";
    const codesHtml = backupCodes.map(function(c, i) { return '<div style="font-family:monospace;font-size:16px;padding:4px 0;">' + (i + 1) + ". " + c + "</div>"; }).join("");
    const emailHtml = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="text-align:center;padding:24px 0;"><img src="' + env.ONBOARDING_DOMAIN + '/logo.png?v=2026" alt="DRIV-EN" style="max-height:80px;"></div><h2 style="text-align:center;color:#1e293b;font-size:22px;margin:24px 0 16px 0;">Your 2FA Backup Codes</h2><p>Hello ' + fullName + ',</p><p>You are receiving this email because you enabled Two-Factor Authentication (2FA) on your DRIV-EN account.</p><p><strong>What are these codes?</strong> Backup codes are one-time use codes that allow you to log in if you lose access to your authenticator app.</p><p><strong>How to use them:</strong> When logging in, if you cannot access your authenticator app, enter one of these codes instead of the 6-digit verification code.</p><p><strong>Important:</strong> Store these codes in a safe, secure place. Do not share them with anyone.</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">' + codesHtml + '</div><p>If you did not enable 2FA, please contact support immediately at ' + supportContact + ".</p><p>Best regards,<br>DRIV-EN Team</p></div>";
    const emailText = "Your 2FA Backup Codes\n\nHello " + fullName + ",\n\nYou are receiving this email because you enabled Two-Factor Authentication (2FA) on your DRIV-EN account.\n\nYour backup codes:\n" + backupCodes.map(function(c, i) { return (i + 1) + ". " + c; }).join("\n") + "\n\nIf you did not enable 2FA, please contact support immediately at " + supportContact + ".\n\nBest regards, DRIV-EN Team";
    await sendEmail(env, user.email, "DRIV-EN 2FA Backup Codes", emailHtml, emailText);
    return json({ success: true, message: "Backup codes emailed to " + user.email });
  } catch (e) { console.error("EmailBackupCodes error:", e.message, e.stack); return json({ success: false, error: "Failed to email backup codes" }, 500); }
}

// ==========================================
// 2FA: SETUP
// ==========================================

async function handleSetup2FA(request, env) {
  try {
    const cookies = parseCookies(request.headers.get("Cookie")); const token = cookies[COOKIE_SESSION];
    if (!token) return json({ success: false, error: "Not authenticated" }, 401);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) return json({ success: false, error: "Not authenticated" }, 401);
    const user = await env.DB.prepare("SELECT id, email FROM users WHERE email = ?").bind(payload.email).first();
    if (!user) return json({ success: false, error: "User not found" }, 404);
    const existing = await env.DB.prepare("SELECT twofa_enabled FROM users WHERE id = ?").bind(user.id).first();
    if (existing && existing.twofa_enabled === 1) return json({ success: false, error: "2FA is already enabled" }, 400);
    const secret = await generateTotpSecret();
    const otpauthUri = "otpauth://totp/" + encodeURIComponent("DRIV-EN:" + user.email) + "?secret=" + secret + "&issuer=" + encodeURIComponent("DRIV-EN") + "&algorithm=SHA1&digits=6&period=30";
    await env.ONBOARDING_KV.put("2fa_pending:" + user.id, secret, { expirationTtl: 600 });
    return json({ success: true, otpauthUri: otpauthUri, secret: secret });
  } catch (e) { console.error("Setup2FA error:", e.message, e.stack); return json({ success: false, error: "Failed to setup 2FA: " + e.message }, 500); }
}

// ==========================================
// 2FA: VERIFY (enables 2FA)
// ==========================================

async function handleVerify2FA(request, env) {
  let body; try { body = await request.json(); } catch (e) { console.error("Verify2FA JSON parse error:", e.message); return json({ success: false, error: "Invalid JSON" }, 400); }
  const { code } = body;
  if (!code) return json({ success: false, error: "Verification code is required" }, 400);
  try {
    const cookies = parseCookies(request.headers.get("Cookie")); const token = cookies[COOKIE_SESSION];
    if (!token) return json({ success: false, error: "Not authenticated" }, 401);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) return json({ success: false, error: "Not authenticated" }, 401);
    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(payload.email).first();
    if (!user) return json({ success: false, error: "User not found" }, 404);
    const secret = await env.ONBOARDING_KV.get("2fa_pending:" + user.id);
    if (!secret) return json({ success: false, error: "No pending 2FA setup. Please start again." }, 400);
    const valid = await verifyTotpCode(secret, code);
    if (!valid) return json({ success: false, error: "Invalid verification code. Please try again." }, 400);
    await env.DB.prepare("UPDATE users SET totp_secret = ?, twofa_enabled = 1 WHERE id = ?").bind(secret, user.id).run();
    await env.ONBOARDING_KV.delete("2fa_pending:" + user.id);
    const backupCodes = generateBackupCodes();
    await env.ONBOARDING_KV.put("2fa_backup:" + user.id, JSON.stringify(backupCodes));
    return json({ success: true, message: "2FA enabled successfully", backupCodes: backupCodes });
  } catch (e) { console.error("Verify2FA error:", e.message, e.stack); return json({ success: false, error: "Failed to verify 2FA: " + e.message }, 500); }
}

// ==========================================
// 2FA: DISABLE
// ==========================================

async function handleDisable2FA(request, env) {
  let body; try { body = await request.json(); } catch (e) { console.error("Disable2FA JSON parse error:", e.message); return json({ success: false, error: "Invalid JSON" }, 400); }
  const { password } = body;
  if (!password) return json({ success: false, error: "Password is required to disable 2FA" }, 400);
  try {
    const cookies = parseCookies(request.headers.get("Cookie")); const token = cookies[COOKIE_SESSION];
    if (!token) return json({ success: false, error: "Not authenticated" }, 401);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) return json({ success: false, error: "Not authenticated" }, 401);
    const user = await env.DB.prepare("SELECT id, password_hash, password_salt FROM users WHERE email = ?").bind(payload.email).first();
    if (!user) return json({ success: false, error: "User not found" }, 404);
    const { hash } = await hashPassword(password, user.password_salt);
    if (hash !== user.password_hash) return json({ success: false, error: "Incorrect password" }, 401);
    await env.DB.prepare("UPDATE users SET totp_secret = NULL, twofa_enabled = 0 WHERE id = ?").bind(user.id).run();
    await env.ONBOARDING_KV.delete("2fa_backup:" + user.id);
    return json({ success: true, message: "2FA disabled successfully" });
  } catch (e) { console.error("Disable2FA error:", e.message, e.stack); return json({ success: false, error: "Failed to disable 2FA" }, 500); }
}

// ==========================================
// 2FA: LOGIN (verify TOTP during login)
// Includes first_name in JWT and response
// ==========================================

async function handleLogin2FA(request, env) {
  let body; try { body = await request.json(); } catch (e) { console.error("Login2FA JSON parse error:", e.message); return json({ success: false, error: "Invalid JSON" }, 400); }
  const { email, code, remember } = body;
  if (!email || !code) return json({ success: false, error: "Email and verification code are required" }, 400);
  try {
    const emailLower = email.trim().toLowerCase();
    const user = await env.DB.prepare("SELECT u.id, u.email, u.org_id, u.totp_secret, u.must_change_password, u.first_name FROM users u WHERE u.email = ? AND u.is_active = 1 AND u.twofa_enabled = 1").bind(emailLower).first();
    if (!user) return json({ success: false, error: "Invalid credentials" }, 401);
    const valid = await verifyTotpCode(user.totp_secret, code);
    if (!valid) return json({ success: false, error: "Invalid verification code" }, 401);
    const rememberMe = remember === true;
    const sessionToken = await signJWT({ sub: user.email, email: user.email, org_id: user.org_id, first_name: user.first_name || "", must_change_password: user.must_change_password === 1 }, env.JWT_SECRET, SESSION_LIFETIME);
    const setCookies = [buildCookie(COOKIE_SESSION, sessionToken, rememberMe ? SESSION_LIFETIME : undefined)];
    return json({ success: true, first_name: user.first_name || "", must_change_password: user.must_change_password === 1 }, 200, { "Set-Cookie": setCookies });
  } catch (e) { console.error("Login2FA error:", e.message, e.stack); return json({ success: false, error: "Login failed" }, 500); }
}

// ==========================================
// COMPANY LOGO — Save/Get from D1
// Stores logo as base64 data URL in company_settings table
// So it syncs across ALL devices and ALL employees
// ==========================================

async function handleSaveLogo(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { console.error("SaveLogo JSON parse error:", e.message); return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { logo_data } = body;
  if (!logo_data) return json({ success: false, error: "Logo data is required" }, 400);

  // Get user session to determine org_id
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[COOKIE_SESSION];
  if (!token) return json({ success: false, error: "Not authenticated" }, 401);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return json({ success: false, error: "Session expired" }, 401);
  const orgId = payload.org_id;
  if (!orgId) return json({ success: false, error: "No organization found" }, 400);

  try {
    // Upsert: insert or replace the logo setting for this org
    await env.DB.prepare(
      "INSERT INTO company_settings (id, org_id, setting_key, setting_value, updated_at) VALUES (?, ?, 'logo', ?, datetime('now')) ON CONFLICT(org_id, setting_key) DO UPDATE SET setting_value = ?, updated_at = datetime('now')"
    ).bind(crypto.randomUUID(), orgId, logo_data, logo_data).run();

    return json({ success: true, message: "Logo saved successfully" });
  } catch (e) {
    console.error("SaveLogo error:", e.message, e.stack);
    return json({ success: false, error: "Failed to save logo" }, 500);
  }
}

async function handleGetLogo(request, env) {
  // Get user session to determine org_id
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[COOKIE_SESSION];
  if (!token) return json({ success: false, error: "Not authenticated" }, 401);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return json({ success: false, error: "Session expired" }, 401);
  const orgId = payload.org_id;
  if (!orgId) return json({ success: false, error: "No organization found" }, 400 );

  try {
    const result = await env.DB.prepare(
      "SELECT setting_value FROM company_settings WHERE org_id = ? AND setting_key = 'logo'"
    ).bind(orgId).first();

    if (result && result.setting_value) {
      return json({ success: true, logo: result.setting_value });
    } else {
      return json({ success: true, logo: null });
    }
  } catch (e) {
    console.error("GetLogo error:", e.message, e.stack);
    return json({ success: false, error: "Failed to get logo" }, 500);
  }
}

// ==========================================
// ROUTER — Maps URL paths to handler functions
// ==========================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    // CORS preflight
    if (method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Cookie", "Access-Control-Allow-Credentials": "true" } });
    // Auth routes
    if (path === "/auth/forgot-password" && method === "POST") return handleForgotPassword(request, env);
    if (path === "/auth/reset-password" && method === "POST") return handleResetPassword(request, env);
    if (path === "/auth/email-backup-codes" && method === "POST") return handleEmailBackupCodes(request, env);
    if (path === "/auth/setup-2fa" && method === "POST") return handleSetup2FA(request, env);
    if (path === "/auth/verify-2fa" && method === "POST") return handleVerify2FA(request, env);
    if (path === "/auth/disable-2fa" && method === "POST") return handleDisable2FA(request, env);
    if (path === "/auth/login-2fa" && method === "POST") return handleLogin2FA(request, env);
    if (path === "/auth/login" && method === "POST") return handleLogin(request, env);
    if (path === "/auth/change-password" && method === "POST") return handleChangePassword(request, env);
    if (path === "/auth/session" && method === "GET") return handleSession(request, env);
    if (path === "/auth/logout" && method === "POST") return handleLogout();
    if (path === "/auth/refresh" && method === "POST") return handleRefresh(request, env);
    // Company logo routes (stored in D1, syncs across all devices)
    if (path === "/auth/save-logo" && method === "POST") return handleSaveLogo(request, env);
    if (path === "/auth/get-logo" && method === "GET") return handleGetLogo(request, env);
    return json({ error: "Not found" }, 404);
  }
};
