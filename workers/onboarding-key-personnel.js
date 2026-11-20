// ============================================================================
// onboarding-key-personnel Worker (v11 — Single-Database Cutover)
// ============================================================================
// PURPOSE: Onboarding API for DRIV-EN — roles, permissions, key personnel, employees, active user presence.
//
// v11 CHANGES (migration off employees-db):
//   - EMPLOYEES_DB binding removed. All queries now run against env.DB (driv-en-db).
//   - `employees` table replaced by `users` + `employee_details`.
//   - `key_personnel_roles.employee_id` (INTEGER) replaced by `key_personnel_roles.user_id` (TEXT -> users.id).
//   - `is_key_personnel` is now DERIVED from key_personnel_roles, not stored on a column.
//   - `department` lives on employee_details; `status` maps to employee_details.employment_status.
//   - API responses keep the `employeeId` field name for frontend compatibility, but its value
//     is now a TEXT user id. Treat it as an opaque string.
// ============================================================================

const PBKDF2_ITERATIONS = 100000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://www.driv-en.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Cookie",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400"
};

// ─────────────────────────────────────────────────────────────────────────
// JSON Response Helper
// ─────────────────────────────────────────────────────────────────────────
function json(d, s = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extraHeaders }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Base64URL Helpers
// ─────────────────────────────────────────────────────────────────────────
function base64UrlEncode(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ─────────────────────────────────────────────────────────────────────────
// JWT Verification
// ─────────────────────────────────────────────────────────────────────────
async function importHmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
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

// ─────────────────────────────────────────────────────────────────────────
// Cookie Parser
// ─────────────────────────────────────────────────────────────────────────
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return cookies;
}

// ─────────────────────────────────────────────────────────────────────────
// Session & Org Extraction
// ─────────────────────────────────────────────────────────────────────────
async function getOrgFromSession(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies["driv_en_session"];
  if (!token) return null;
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return null;
  return {
    org_id: payload.org_id,
    email: payload.email,
    role: payload.role || payload.role_id,
    first_name: payload.first_name || ""
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Password Helpers
// ─────────────────────────────────────────────────────────────────────────
function bytesToHex(b) {
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(p) {
  const s = crypto.getRandomValues(new Uint8Array(16));
  const sh = bytesToHex(s);
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(p), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: s, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, k, 256);
  return { salt: sh, hash: base64UrlEncode(new Uint8Array(bits)) };
}

function genPwd() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  const r = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) p += c[r[i] % c.length];
  return p;
}

// ─────────────────────────────────────────────────────────────────────────
// Email Helper
// ─────────────────────────────────────────────────────────────────────────
async function sendEmail(env, to, cc, subject, html, text) {
  const pe = { to: [{ email: to }], subject };
  if (cc) pe.cc = [{ email: cc }];
  const b = {
    to: pe.to,
    from: env.FROM_EMAIL || "support@driv-en.com",
    subject,
    text: text,
    html: html
  };
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(b)
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Welcome Email Builders
// ─────────────────────────────────────────────────────────────────────────
function buildWelcomeEmail(fullName, adminName, adminEmail, email, tempPassword, tasks, env) {
  const loginUrl = `${env.ONBOARDING_DOMAIN || "https://www.driv-en.com"}/public/login.html`;
  const taskListHtml = (tasks || []).map(t => `<li>${t}</li>`).join("");
  const emailHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="text-align:center;padding:24px 0;"><img src="https://www.driv-en.com/assets/logo.png?v=2026" alt="DRIV-EN" style="max-height:80px;"></div><h2 style="text-align:center;color:#1e293b;font-size:22px;margin:24px 0 16px 0;">Welcome to DRIV-EN</h2><p>Hello ${fullName},</p><p><strong>${adminName}</strong> has assigned you as Key Personnel for the DRIV-EN onboarding process.</p><p><strong>Your assigned tasks:</strong></p><ul>${taskListHtml}</ul><p>Your account has been activated. Please log in using the credentials below:</p><table style="border-collapse:collapse;margin:16px 0;font-family:sans-serif;"><tr><td style="padding:4px 16px 4px 0;color:#64748b;">Login URL:</td><td style="padding:4px 16px;"><a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 28px;border-radius:6px;font-size:15px;font-weight:600;">LOGIN</a></td></tr><tr><td style="padding:4px 16px 4px 0;color:#64748b;">Email:</td><td style="padding:4px 16px;">${email}</td></tr><tr><td style="padding:4px 16px 4px 0;color:#64748b;">Temporary Password:</td><td style="padding:4px 16px;"><strong style="font-family:monospace;font-size:15px;background:#f1f5f9;padding:4px 8px;border-radius:4px;">${tempPassword}</strong></td></tr></table><p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px;border-radius:6px;display:inline-block;">You will be prompted to change your password on first login.</p><p>If you have any questions, contact your administrator at ${adminEmail} or ${env.SUPPORT_CONTACT || "support@driv-en.com"}.</p><p>Best regards,<br>DRIV-EN Team</p></div>`;
  const emailText = `Welcome to DRIV-EN\n\nHello ${fullName},\n\n${adminName} has assigned you as Key Personnel for the DRIV-EN onboarding process.\n\nYour assigned tasks:\n${(tasks || []).map(t => "  - " + t).join("\n")}\n\nYour account has been activated. Please log in using:\n\nLogin URL: ${loginUrl}\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nYou will be prompted to change your password on first login.\n\nIf you have any questions, contact ${adminEmail} or ${env.SUPPORT_CONTACT || "support@driv-en.com"}.\n\nBest regards, DRIV-EN Team`;
  return { emailHtml, emailText, loginUrl };
}

function buildEmployeeLaunchEmail(fullName, adminName, adminEmail, email, tempPassword, env) {
  const loginUrl = `${env.ONBOARDING_DOMAIN || "https://www.driv-en.com"}/public/login.html`;
  const emailHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="text-align:center;padding:24px 0;"><img src="https://www.driv-en.com/assets/logo.png?v=2026" alt="DRIV-EN" style="max-height:80px;"></div><h2 style="text-align:center;color:#16a34a;font-size:22px;margin:24px 0 16px 0;">Welcome to DRIV-EN!</h2><p>Hello ${fullName},</p><p>Your organization has completed set up on DRIV-EN. Your account is now active and ready to use.</p><p>Please log in using the credentials below:</p><table style="border-collapse:collapse;margin:16px 0;font-family:sans-serif;"><tr><td style="padding:4px 16px 4px 0;color:#64748b;">Login URL:</td><td style="padding:4px 16px;"><a href="${loginUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 28px;border-radius:6px;font-size:15px;font-weight:600;">LOGIN</a></td></tr><tr><td style="padding:4px 16px 4px 0;color:#64748b;">Email:</td><td style="padding:4px 16px;">${email}</td></tr><tr><td style="padding:4px 16px 4px 0;color:#64748b;">Temporary Password:</td><td style="padding:4px 16px;"><strong style="font-family:monospace;font-size:15px;background:#f1f5f9;padding:4px 8px;border-radius:4px;">${tempPassword}</strong></td></tr></table><p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px;border-radius:6px;display:inline-block;">You will be prompted to change your password on first login.</p><p>If you have any questions, contact your administrator at ${adminEmail}.</p><p>Best regards,<br>DRIV-EN Team</p></div>`;
  const emailText = `Welcome to DRIV-EN!\n\nHello ${fullName},\n\nYour organization has completed set up on DRIV-EN. Your account is active.\n\nLogin URL: ${loginUrl}\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nYou will be prompted to change your password on first login.\n\nBest regards, DRIV-EN Team`;
  return { emailHtml, emailText };
}

// ─────────────────────────────────────────────────────────────────────────
// Schema Migration
// ─────────────────────────────────────────────────────────────────────────
async function ensureRolesTables(env) {
  try {
    const cols = await env.DB.prepare("PRAGMA table_info(roles)").all();
    const colNames = cols.results ? cols.results.map(c => c.name) : [];
    if (!colNames.includes("org_id")) {
      await env.DB.prepare("ALTER TABLE roles ADD COLUMN org_id TEXT").run();
    }
    if (!colNames.includes("is_system")) {
      await env.DB.prepare("ALTER TABLE roles ADD COLUMN is_system INTEGER DEFAULT 0").run();
    }
  } catch (e) { console.error("ensureRolesTables (roles):", e.message); }

  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, module TEXT NOT NULL)`).run();
  } catch (e) { }

  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL, permission_id TEXT NOT NULL, PRIMARY KEY (role_id, permission_id))`).run();
  } catch (e) { }

  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_permissions_override (user_id TEXT NOT NULL, permission_id TEXT NOT NULL, granted INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (user_id, permission_id))`).run();
  } catch (e) { }

  try {
    const count = await env.DB.prepare("SELECT COUNT(*) as c FROM permissions").first();
    if (count && count.c === 0) {
      const perms = [
        ["PRM-emp-view","employees.view","View employee records","employees"],
        ["PRM-emp-add","employees.add","Add new employees","employees"],
        ["PRM-emp-edit","employees.edit","Edit employee records","employees"],
        ["PRM-emp-delete","employees.delete","Delete employees","employees"],
        ["PRM-eq-view","equipment.view","View equipment records","equipment"],
        ["PRM-eq-add","equipment.add","Add new equipment","equipment"],
        ["PRM-eq-edit","equipment.edit","Edit equipment records","equipment"],
        ["PRM-eq-delete","equipment.delete","Delete equipment","equipment"],
        ["PRM-proj-view","projects.view","View projects","projects"],
        ["PRM-proj-add","projects.add","Add new projects","projects"],
        ["PRM-proj-edit","projects.edit","Edit projects","projects"],
        ["PRM-proj-delete","projects.delete","Delete projects","projects"],
        ["PRM-wo-view","workorders.view","View work orders","workorders"],
        ["PRM-wo-add","workorders.add","Add work orders","workorders"],
        ["PRM-wo-edit","workorders.edit","Edit work orders","workorders"],
        ["PRM-wo-delete","workorders.delete","Delete work orders","workorders"],
        ["PRM-insp-view","inspections.view","View inspections","inspections"],
        ["PRM-insp-add","inspections.add","Add inspections","inspections"],
        ["PRM-insp-edit","inspections.edit","Edit inspections","inspections"],
        ["PRM-insp-delete","inspections.delete","Delete inspections","inspections"],
        ["PRM-pm-view","pm.view","View PMs","pm"],
        ["PRM-pm-add","pm.add","Add PMs","pm"],
        ["PRM-pm-edit","pm.edit","Edit PMs","pm"],
        ["PRM-pm-delete","pm.delete","Delete PMs","pm"],
        ["PRM-safety-view","safety.view","View safety forms","safety"],
        ["PRM-safety-add","safety.add","Add safety forms","safety"],
        ["PRM-safety-edit","safety.edit","Edit safety forms","safety"],
        ["PRM-safety-approve","safety.approve","Approve safety forms","safety"],
        ["PRM-reports-view","reports.view","View reports","reports"],
        ["PRM-reports-export","reports.export","Export reports","reports"],
        ["PRM-users-view","users.view","View users and roles","users"],
        ["PRM-users-add","users.add","Add users","users"],
        ["PRM-users-edit","users.edit","Edit users","users"],
        ["PRM-users-delete","users.delete","Delete users","users"],
        ["PRM-settings-view","settings.view","View company settings","settings"],
        ["PRM-settings-edit","settings.edit","Edit company settings","settings"]
      ];
      for (const [id, name, desc, mod] of perms) {
        await env.DB.prepare("INSERT OR IGNORE INTO permissions (id,name,description,module) VALUES (?,?,?,?)").bind(id, name, desc, mod).run();
      }
    }
  } catch (e) { console.error("Seed permissions error:", e.message); }

  try {
    const founder = await env.DB.prepare("SELECT id FROM roles WHERE name = 'DRIV-EN Founder'").first();
    if (!founder) {
      await env.DB.prepare("INSERT INTO roles (id,name,description,org_id,is_system) VALUES ('RO-founder','DRIV-EN Founder','System administrator — full access',NULL,1)").run();
    } else {
      await env.DB.prepare("UPDATE roles SET is_system = 1, org_id = NULL WHERE name = 'DRIV-EN Founder'").run();
    }
  } catch (e) { console.error("Ensure founder role:", e.message); }

  try {
    const userCols = await env.DB.prepare("PRAGMA table_info(users)").all();
    const userColNames = userCols.results ? userCols.results.map(c => c.name) : [];
    if (!userColNames.includes("updated_at")) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN updated_at TEXT").run();
      await env.DB.prepare("UPDATE users SET updated_at = ? WHERE updated_at IS NULL").bind(new Date().toISOString()).run();
    }
  } catch (e) { console.error("OCC migration (users.updated_at):", e.message); }
}

// ─────────────────────────────────────────────────────────────────────────
// Employee Schema Guard (replaces the old employees-db bootstrap)
// ─────────────────────────────────────────────────────────────────────────
async function ensureEmployeeTables(env) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS employee_details (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      middle_name TEXT,
      suffix TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      dob TEXT,
      drivers_license TEXT,
      dl_state TEXT,
      dl_expiration TEXT,
      id_type TEXT DEFAULT 'dl',
      drives_company_vehicle TEXT,
      uses_employee_assets TEXT,
      termination_date TEXT,
      employment_status TEXT DEFAULT 'Active',
      department TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE(user_id)
    )`).run();
  } catch (e) { console.error("ensure employee_details:", e.message); }

  // Backfill department on databases created before v11.
  try {
    const cols = await env.DB.prepare("PRAGMA table_info(employee_details)").all();
    const names = (cols.results || []).map(c => c.name);
    if (names.length && !names.includes("department")) {
      await env.DB.prepare("ALTER TABLE employee_details ADD COLUMN department TEXT").run();
    }
  } catch (e) { console.error("ensure employee_details.department:", e.message); }

  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS key_personnel_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      task_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      org_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`).run();
  } catch (e) { console.error("ensure key_personnel_roles:", e.message); }
}

// ─────────────────────────────────────────────────────────────────────────
// Audit Log Helper
// ─────────────────────────────────────────────────────────────────────────
async function writeAuditLog(env, orgId, userEmail, action, module, tableName, recordId, details) {
  try {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, user_email, action, module, table_name, record_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, orgId, userEmail, action, module, tableName, recordId || null, details || "", new Date().toISOString()).run();
  } catch (e) { console.error("writeAuditLog:", e.message); }
}

// ===========================================================================
// ACTIVE USER PRESENCE POLLING
// ===========================================================================
async function handlePresence(request, env) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);

  let body = {};
  try { body = await request.json(); } catch (e) {}

  const orgId = session.org_id;
  const taskKey = body.task || body.page || "Asset Types";
  const userName = session.first_name || session.email.split("@")[0];
  const userEmail = session.email;
  const now = Math.floor(Date.now() / 1000);

  const presenceKvKey = `presence:${orgId}:${taskKey}`;

  let activeMap = {};
  try {
    const raw = await env.ONBOARDING_KV.get(presenceKvKey);
    if (raw) activeMap = JSON.parse(raw);
  } catch (e) {}

  activeMap[userEmail] = { name: userName, time: now };

  const coWorkers = [];
  const updatedMap = {};

  for (const [email, user] of Object.entries(activeMap)) {
    if (now - user.time <= 30) {
      updatedMap[email] = user;
      if (email !== userEmail) {
        coWorkers.push(user.name);
      }
    }
  }

  try {
    await env.ONBOARDING_KV.put(presenceKvKey, JSON.stringify(updatedMap), { expirationTtl: 60 });
  } catch (e) {
    console.error("KV presence write error:", e.message);
  }

  return json({
    success: true,
    task: taskKey,
    activeUsers: coWorkers
  });
}

// ===========================================================================
// ROLES & PERMISSIONS ENDPOINTS
// ===========================================================================

async function handleGetPermissions(request, env) {
  await ensureRolesTables(env);
  try {
    const r = await env.DB.prepare("SELECT id,name,description,module FROM permissions ORDER BY module, name").all();
    return json({ success: true, permissions: r.results || [] });
  } catch (e) { console.error("handleGetPermissions:", e.message); return json({ success: false, error: "Failed to fetch permissions" }, 500); }
}

async function handleGetRoles(request, env) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  await ensureRolesTables(env);
  try {
    const r = await env.DB.prepare(`SELECT r.id, r.name, r.description, r.is_system, (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as perm_count FROM roles r WHERE r.org_id = ? OR r.org_id IS NULL ORDER BY r.is_system DESC, r.name`).bind(session.org_id).all();
    return json({ success: true, roles: r.results || [] });
  } catch (e) { console.error("handleGetRoles:", e.message); return json({ success: false, error: "Failed to fetch roles" }, 500); }
}

async function handleCreateRole(request, env) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  let body; try { body = await request.json(); } catch (e) { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { name, description } = body;
  if (!name || !name.trim()) return json({ success: false, error: "Role name is required" }, 400);
  await ensureRolesTables(env);
  try {
    const existing = await env.DB.prepare("SELECT id FROM roles WHERE name = ? AND (org_id = ? OR org_id IS NULL)").bind(name.trim(), session.org_id).first();
    if (existing) return json({ success: false, error: "A role with that name already exists" }, 409);
  } catch (e) { }
  const roleId = "RO-" + crypto.randomUUID().replace(/-/g, "").substring(0, 18);
  try {
    await env.DB.prepare("INSERT INTO roles (id, name, description, org_id, is_system) VALUES (?, ?, ?, ?, 0)").bind(roleId, name.trim(), description || null, session.org_id).run();
    return json({ success: true, role: { id: roleId, name: name.trim(), description: description || null, is_system: 0, perm_count: 0 } });
  } catch (e) { console.error("handleCreateRole:", e.message); return json({ success: false, error: "Failed to create role: " + e.message }, 500); }
}

async function handleUpdateRole(request, env, roleId) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  let body; try { body = await request.json(); } catch (e) { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { name, description } = body;
  if (!name || !name.trim()) return json({ success: false, error: "Role name is required" }, 400);
  try {
    const role = await env.DB.prepare("SELECT id, org_id, is_system FROM roles WHERE id = ?").bind(roleId).first();
    if (!role) return json({ success: false, error: "Role not found" }, 404);
    if (role.is_system === 1) return json({ success: false, error: "System roles cannot be modified" }, 403);
    if (role.org_id !== session.org_id) return json({ success: false, error: "You do not have permission to modify this role" }, 403);
    await env.DB.prepare("UPDATE roles SET name = ?, description = ? WHERE id = ?").bind(name.trim(), description || null, roleId).run();
    return json({ success: true, message: "Role updated" });
  } catch (e) { console.error("handleUpdateRole:", e.message); return json({ success: false, error: "Failed to update role" }, 500); }
}

async function handleDeleteRole(request, env, roleId) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  try {
    const role = await env.DB.prepare("SELECT id, org_id, is_system FROM roles WHERE id = ?").bind(roleId).first();
    if (!role) return json({ success: false, error: "Role not found" }, 404);
    if (role.is_system === 1) return json({ success: false, error: "System roles cannot be deleted" }, 403);
    if (role.org_id !== session.org_id) return json({ success: false, error: "You do not have permission to delete this role" }, 403);
    try { await env.DB.prepare("DELETE FROM role_permissions WHERE role_id = ?").bind(roleId).run(); } catch (e) { }
    await env.DB.prepare("DELETE FROM roles WHERE id = ?").bind(roleId).run();
    return json({ success: true, message: "Role deleted" });
  } catch (e) { console.error("handleDeleteRole:", e.message); return json({ success: false, error: "Failed to delete role" }, 500); }
}

async function handleGetRolePermissions(request, env, roleId) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  try {
    const role = await env.DB.prepare("SELECT id, org_id, is_system FROM roles WHERE id = ?").bind(roleId).first();
    if (!role) return json({ success: false, error: "Role not found" }, 404);
    if (role.org_id !== session.org_id && role.org_id !== null) return json({ success: false, error: "You do not have permission to view this role" }, 403);
    const r = await env.DB.prepare(`SELECT p.id, p.name, p.description, p.module FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ? ORDER BY p.module, p.name`).bind(roleId).all();
    return json({ success: true, permissions: r.results || [] });
  } catch (e) { console.error("handleGetRolePermissions:", e.message); return json({ success: false, error: "Failed to fetch role permissions" }, 500); }
}

async function handleSetRolePermissions(request, env, roleId) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  let body; try { body = await request.json(); } catch (e) { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { permissionIds } = body;
  if (!Array.isArray(permissionIds)) return json({ success: false, error: "permissionIds must be an array" }, 400);
  try {
    const role = await env.DB.prepare("SELECT id, org_id, is_system FROM roles WHERE id = ?").bind(roleId).first();
    if (!role) return json({ success: false, error: "Role not found" }, 404);
    if (role.org_id !== session.org_id && role.org_id !== null) return json({ success: false, error: "You do not have permission to modify this role" }, 403);
    try { await env.DB.prepare("DELETE FROM role_permissions WHERE role_id = ?").bind(roleId).run(); } catch (e) { }
    for (const permId of permissionIds) { try { await env.DB.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)").bind(roleId, permId).run(); } catch (e) { } }
    return json({ success: true, message: "Permissions updated", count: permissionIds.length });
  } catch (e) { console.error("handleSetRolePermissions:", e.message); return json({ success: false, error: "Failed to set permissions" }, 500); }
}

async function handleRolesPermissionsComplete(request, env) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  return json({ success: true, message: "Roles & Permissions step complete" });
}

// ===========================================================================
// USER PERMISSION OVERRIDES
// ===========================================================================

async function handleGetUserPermissions(request, env, userId) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  try {
    const user = await env.DB.prepare("SELECT id, org_id, role_id, updated_at FROM users WHERE id = ?").bind(userId).first();
    if (!user) return json({ success: false, error: "User not found" }, 404);
    if (user.org_id !== session.org_id) return json({ success: false, error: "You do not have permission" }, 403);
    let rolePerms = [];
    if (user.role_id) { try { const r = await env.DB.prepare("SELECT p.id, p.name FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ?").bind(user.role_id).all(); rolePerms = r.results || []; } catch (e) { } }
    let overrides = [];
    try { const r = await env.DB.prepare("SELECT permission_id, granted FROM user_permissions_override WHERE user_id = ?").bind(userId).all(); overrides = r.results || []; } catch (e) { }
    const effective = new Map();
    rolePerms.forEach(p => effective.set(p.id, { id: p.id, name: p.name, source: "role" }));
    overrides.forEach(o => { if (o.granted === 1) { if (!effective.has(o.permission_id)) effective.set(o.permission_id, { id: o.permission_id, source: "override" }); } else { effective.delete(o.permission_id); } });
    return json({ success: true, rolePermissions: rolePerms, overrides: overrides, effective: Array.from(effective.values()), base_version: user.updated_at || null });
  } catch (e) { console.error("handleGetUserPermissions:", e.message); return json({ success: false, error: "Failed to fetch user permissions" }, 500); }
}

async function handleSetUserPermissions(request, env, userId) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  let body; try { body = await request.json(); } catch (e) { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { grants, revokes } = body;
  try {
    const user = await env.DB.prepare("SELECT id, org_id FROM users WHERE id = ?").bind(userId).first();
    if (!user) return json({ success: false, error: "User not found" }, 404);
    if (user.org_id !== session.org_id) return json({ success: false, error: "You do not have permission" }, 403);
    try { await env.DB.prepare("DELETE FROM user_permissions_override WHERE user_id = ?").bind(userId).run(); } catch (e) { }
    if (Array.isArray(grants)) { for (const permId of grants) { try { await env.DB.prepare("INSERT OR IGNORE INTO user_permissions_override (user_id, permission_id, granted) VALUES (?, ?, 1)").bind(userId, permId).run(); } catch (e) { } } }
    if (Array.isArray(revokes)) { for (const permId of revokes) { try { await env.DB.prepare("INSERT OR IGNORE INTO user_permissions_override (user_id, permission_id, granted) VALUES (?, ?, 0)").bind(userId, permId).run(); } catch (e) { } } }
    return json({ success: true, message: "User permission overrides saved" });
  } catch (e) { console.error("handleSetUserPermissions:", e.message); return json({ success: false, error: "Failed to save overrides" }, 500); }
}

async function handlePatchUserPermission(request, env, userId) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  let body; try { body = await request.json(); } catch (e) { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { permission_id, granted, base_version } = body;
  if (!permission_id) return json({ success: false, error: "permission_id required" }, 400);
  if (typeof granted !== "boolean") return json({ success: false, error: "granted (boolean) required" }, 400);
  try {
    const user = await env.DB.prepare("SELECT id, org_id, updated_at FROM users WHERE id = ?").bind(userId).first();
    if (!user) return json({ success: false, error: "User not found" }, 404);
    if (user.org_id !== session.org_id) return json({ success: false, error: "You do not have permission" }, 403);
    if (base_version && user.updated_at && base_version !== user.updated_at) {
      let currentOverrides = [];
      try { const r = await env.DB.prepare("SELECT permission_id, granted FROM user_permissions_override WHERE user_id = ?").bind(userId).all(); currentOverrides = r.results || []; } catch (e) { }
      return json({ success: false, error: "This user was modified by another manager. Please refresh your view.", conflict: true, current_overrides: currentOverrides, current_updated_at: user.updated_at }, 409);
    }
    const now = new Date().toISOString();
    const grantedVal = granted ? 1 : 0;
    try { await env.DB.prepare("DELETE FROM user_permissions_override WHERE user_id = ? AND permission_id = ?").bind(userId, permission_id).run(); } catch (e) { }
    try { await env.DB.prepare("INSERT INTO user_permissions_override (user_id, permission_id, granted) VALUES (?, ?, ?)").bind(userId, permission_id, grantedVal).run(); } catch (e) { }
    await env.DB.prepare("UPDATE users SET updated_at = ? WHERE id = ?").bind(now, userId).run();
    const permName = await env.DB.prepare("SELECT name FROM permissions WHERE id = ?").bind(permission_id).first();
    const permLabel = permName ? permName.name : permission_id;
    await writeAuditLog(env, user.org_id, session.email, "permission_override", "users", "user_permissions_override", userId, `${granted ? "Granted" : "Revoked"} permission "${permLabel}" for user ${userId}`);
    return json({ success: true, message: `Permission ${granted ? "granted" : "revoked"}`, updated_at: now });
  } catch (e) { console.error("handlePatchUserPermission:", e.message); return json({ success: false, error: "Failed to update permission" }, 500); }
}

async function handleUpdateUserStatus(request, env, userId) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  let body; try { body = await request.json(); } catch (e) { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { is_active, base_version } = body;
  if (typeof is_active !== "boolean") return json({ success: false, error: "is_active (boolean) required" }, 400);
  try {
    const user = await env.DB.prepare("SELECT id, org_id, is_active, updated_at FROM users WHERE id = ?").bind(userId).first();
    if (!user) return json({ success: false, error: "User not found" }, 404);
    if (user.org_id !== session.org_id) return json({ success: false, error: "You do not have permission" }, 403);
    if (base_version && user.updated_at && base_version !== user.updated_at) {
      return json({ success: false, error: "This user was modified by another manager. Please refresh your view.", conflict: true, current_is_active: user.is_active, current_updated_at: user.updated_at }, 409);
    }
    const now = new Date().toISOString();
    const activeVal = is_active ? 1 : 0;
    await env.DB.prepare("UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?").bind(activeVal, now, userId).run();
    await writeAuditLog(env, user.org_id, session.email, "status_change", "users", "users", userId, `User ${is_active ? "activated" : "deactivated"} by ${session.email}`);
    return json({ success: true, message: `User ${is_active ? "activated" : "deactivated"}`, updated_at: now });
  } catch (e) { console.error("handleUpdateUserStatus:", e.message); return json({ success: false, error: "Failed to update user status" }, 500); }
}

// ===========================================================================
// KEY PERSONNEL & ONBOARDING FINALIZE ENDPOINTS
// ===========================================================================

async function handleList(request, env) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);

  await ensureEmployeeTables(env);

  try {
    // 1. Users in this org, joined to their employee_details row.
    const users = await env.DB.prepare(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.full_name, u.role_id, u.is_active,
              d.employment_status, d.department
       FROM users u
       LEFT JOIN employee_details d ON d.user_id = u.id
       WHERE u.org_id = ?
       ORDER BY u.full_name ASC`
    ).bind(session.org_id).all();

    const result = [];

    for (const u of (users.results || [])) {
      let roles = [];
      try {
        const r = await env.DB.prepare(
          "SELECT id, task_name FROM key_personnel_roles WHERE user_id = ?"
        ).bind(u.id).all();
        roles = r.results || [];
      } catch (e) {
        console.error("Error loading roles for user:", u.id, e.message);
      }

      // Key personnel is now DERIVED: a user is key personnel iff they hold at least one task.
      if (roles.length > 0) {
        const constructedName = [u.first_name, u.last_name].filter(Boolean).join(" ");
        const displayName = u.full_name || constructedName || u.email;

        result.push({
          employeeId: u.id,
          id: u.id,
          userId: u.id,
          name: displayName,
          first_name: u.first_name || "",
          last_name: u.last_name || "",
          email: u.email || "",
          role_id: u.role_id || "Unassigned",
          department: u.department || "",
          status: u.employment_status || (u.is_active ? "Active" : "Inactive"),
          roles: roles.map(r => ({ id: r.id, role: r.task_name, task_name: r.task_name }))
        });
      }
    }

    return json({ success: true, keyPersonnel: result, employees: result });
  } catch (e) {
    console.error("handleList error:", e.message, e.stack);
    return json({ success: false, error: "Failed to list personnel", detail: e.message }, 500);
  }
}

async function handleComplete(request, env) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);

  let body;
  try { body = await request.json(); } catch (e) { return json({ success: false, error: "Invalid JSON body" }, 400); }

  const { keyPersonnel } = body;
  if (!keyPersonnel || !Array.isArray(keyPersonnel) || keyPersonnel.length === 0) {
    return json({ success: false, error: "No key personnel provided" }, 400);
  }

  await ensureEmployeeTables(env);

  const orgId = session.org_id;
  const adminName = session.first_name || session.email;
  const adminEmail = session.email;
  const results = [];

  for (let i = 0; i < keyPersonnel.length; i++) {
    const person = keyPersonnel[i];
    const email = (person.email || "").toLowerCase().trim();
    const fullName = person.name || [person.firstName, person.lastName].filter(Boolean).join(" ") || email;
    const parts = fullName.split(" ");
    const firstName = person.firstName || parts[0] || "";
    const lastName = person.lastName || parts.slice(1).join(" ") || "";

    const detail = { name: fullName, email, user_created: false, email_sent: false, error: null };

    if (!email) {
      detail.error = "Invalid email address";
      results.push(detail);
      continue;
    }

    try {
      const tempPassword = genPwd();
      const { salt, hash } = await hashPassword(tempPassword);
      const now = new Date().toISOString();
      let userId;

      // 1. Upsert user
      const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
      if (existingUser) {
        userId = existingUser.id;
        await env.DB.prepare(
          "UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1, is_active = 1, first_name = ?, last_name = ?, full_name = ?, org_id = ?, updated_at = ? WHERE id = ?"
        ).bind(hash, salt, firstName, lastName, fullName, orgId, now, userId).run();
        detail.user_updated = true;
      } else {
        userId = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO users (id, org_id, email, role_id, password_hash, password_salt, must_change_password, is_active, first_name, last_name, full_name, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, 1, 1, ?, ?, ?, ?, ?)"
        ).bind(userId, orgId, email, hash, salt, firstName, lastName, fullName, now, now).run();
        detail.user_created = true;
      }

      // 2. Upsert employee_details (replaces the old employees row)
      const existingDetail = await env.DB.prepare("SELECT id FROM employee_details WHERE user_id = ?").bind(userId).first();
      if (existingDetail) {
        await env.DB.prepare(
          "UPDATE employee_details SET org_id = ?, employment_status = 'Active', updated_at = ? WHERE user_id = ?"
        ).bind(orgId, now, userId).run();
      } else {
        await env.DB.prepare(
          "INSERT INTO employee_details (id, user_id, org_id, employment_status, created_at, updated_at) VALUES (?, ?, ?, 'Active', ?, ?)"
        ).bind(crypto.randomUUID(), userId, orgId, now, now).run();
      }

      // 3. Assign tasks against user_id
      if (Array.isArray(person.tasks) && person.tasks.length > 0) {
        await env.DB.prepare("DELETE FROM key_personnel_roles WHERE user_id = ?").bind(userId).run();
        for (const task of person.tasks) {
          try {
            await env.DB.prepare("INSERT INTO key_personnel_roles (user_id, task_name, org_id) VALUES (?, ?, ?)").bind(userId, task, orgId).run();
          } catch (e) { console.error("Task assign error:", e.message); }
        }
      }

      // 4. Send Welcome Email
      const { emailHtml, emailText } = buildWelcomeEmail(fullName, adminName, adminEmail, email, tempPassword, person.tasks || [], env);
      const emailRes = await sendEmail(env, email, adminEmail, "Your DRIV-EN Account & Onboarding Responsibilities", emailHtml, emailText);

      detail.email_sent = emailRes.ok;
      if (!emailRes.ok) {
        const errTxt = await emailRes.text().catch(() => "");
        console.error("Resend API error:", emailRes.status, errTxt);
        detail.error = `User created, but email failed (Resend Status ${emailRes.status})`;
      }

    } catch (e) {
      console.error("handleComplete Error:", e.message, e.stack);
      detail.error = e.message;
    }

    results.push(detail);
  }

  const hasErrors = results.some(r => r.error !== null);
  return json({ success: !hasErrors, total: results.length, results }, hasErrors ? 207 : 200);
}

async function handleSendInvites(request, env) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  let body; try { body = await request.json(); } catch (e) { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const { emails } = body;
  if (!Array.isArray(emails) || emails.length === 0) return json({ success: false, error: "emails array is required" }, 400);

  await ensureEmployeeTables(env);

  const adminName = session.first_name || session.email;
  const adminEmail = session.email;
  const results = [];

  for (const rawEmail of emails) {
    const email = (rawEmail || "").toLowerCase().trim();
    const detail = { email, activated: false, email_sent: false, error: null };
    if (!email) { detail.error = "Empty email"; results.push(detail); continue; }
    try {
      const user = await env.DB.prepare("SELECT id, org_id, first_name, last_name, full_name FROM users WHERE email = ?").bind(email).first();
      if (!user) { detail.error = "User not found — complete the key personnel step first"; results.push(detail); continue; }
      if (user.org_id !== session.org_id) { detail.error = "You do not have permission to invite this user"; results.push(detail); continue; }

      const tempPassword = genPwd();
      const { salt, hash } = await hashPassword(tempPassword);
      await env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1, is_active = 1, updated_at = ? WHERE id = ?")
        .bind(hash, salt, new Date().toISOString(), user.id).run();
      detail.activated = true;

      let tasks = [];
      try {
        const roles = await env.DB.prepare("SELECT task_name FROM key_personnel_roles WHERE user_id = ?").bind(user.id).all();
        tasks = (roles.results || []).map(r => r.task_name);
      } catch (e) { console.error("KP roles lookup for invite:", e.message); }

      const fullName = user.full_name || [user.first_name, user.last_name].filter(x => x).join(" ") || email;
      const { emailHtml, emailText } = buildWelcomeEmail(fullName, adminName, adminEmail, email, tempPassword, tasks, env);
      const emailResponse = await sendEmail(env, email, adminEmail, "Your DRIV-EN Account & Onboarding Responsibilities", emailHtml, emailText);

      detail.email_sent = emailResponse.ok;
      if (!emailResponse.ok) { const et = await emailResponse.text().catch(() => ""); console.error("Invite email failed:", emailResponse.status, et); detail.error = `Email failed (${emailResponse.status})`; }
      await writeAuditLog(env, session.org_id, session.email, "send_invite", "users", "users", user.id, `Invitation email sent to ${email}, account activated`);
    } catch (e) { console.error("handleSendInvites error:", e.message, e.stack); detail.error = e.message; }
    results.push(detail);
  }
  const allSuccess = results.every(r => r.error === null);
  return json({ success: allSuccess, total: results.length, results }, allSuccess ? 200 : 207);
}

async function handleRevoke(request, env) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  let body; try { body = await request.json(); } catch (e) { return json({ success: false, error: "Invalid JSON body" }, 400); }

  // Accept either name; both now carry a TEXT user id.
  const { employeeId, userId, revokeAll, roles } = body;
  const targetId = userId || employeeId;
  if (!targetId) return json({ success: false, error: "Missing employeeId" }, 400);

  await ensureEmployeeTables(env);

  try {
    const user = await env.DB.prepare("SELECT id, org_id FROM users WHERE id = ?").bind(String(targetId)).first();
    if (!user) return json({ success: false, error: "Employee not found" }, 404);
    if (user.org_id !== session.org_id) return json({ success: false, error: "You do not have permission to modify this employee" }, 403);

    if (revokeAll) {
      await env.DB.prepare("DELETE FROM key_personnel_roles WHERE user_id = ?").bind(user.id).run();
      return json({ success: true, message: "All assignments revoked" });
    }

    if (!roles || !Array.isArray(roles) || roles.length === 0) return json({ success: false, error: "Provide roles array or revokeAll=true" }, 400);

    for (const role of roles) {
      await env.DB.prepare("DELETE FROM key_personnel_roles WHERE user_id = ? AND task_name = ?").bind(user.id, role).run();
    }

    const remaining = await env.DB.prepare("SELECT COUNT(*) as count FROM key_personnel_roles WHERE user_id = ?").bind(user.id).first();
    return json({ success: true, message: "Selected assignments revoked", remainingRoles: remaining ? remaining.count : 0 });
  } catch (e) { console.error("handleRevoke:", e.message, e.stack); return json({ success: false, error: "Failed to revoke assignments" }, 500); }
}

async function handleFinalizeOnboarding(request, env) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  if (session.role !== "Admin" && session.role !== "RO-admin") return json({ success: false, error: "Only Admin can finalize onboarding" }, 403);

  const orgId = session.org_id;
  const adminName = session.first_name || session.email;
  const adminEmail = session.email;

  await ensureEmployeeTables(env);

  try {
    const users = await env.DB.prepare(
      "SELECT id, email, first_name, last_name, full_name FROM users WHERE org_id = ? AND lower(email) != ?"
    ).bind(orgId, adminEmail.toLowerCase()).all();

    const results = [];

    for (const u of (users.results || [])) {
      const email = (u.email || "").toLowerCase().trim();
      if (!email) continue;

      const tempPassword = genPwd();
      const { salt, hash } = await hashPassword(tempPassword);
      const now = new Date().toISOString();

      await env.DB.prepare(
        "UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1, is_active = 1, updated_at = ? WHERE id = ?"
      ).bind(hash, salt, now, u.id).run();

      const displayName = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || email;
      const { emailHtml, emailText } = buildEmployeeLaunchEmail(displayName, adminName, adminEmail, email, tempPassword, env);
      const emailRes = await sendEmail(env, email, adminEmail, "Welcome to DRIV-EN — Your Account is Ready", emailHtml, emailText);

      results.push({ email, sent: emailRes.ok });
    }

    return json({ success: true, message: "Onboarding finalized and welcome emails sent", totalEmployees: results.length, details: results });
  } catch (e) {
    return json({ success: false, error: "Failed to finalize onboarding: " + e.message }, 500);
  }
}

// ===========================================================================
// EMPLOYEE ENDPOINTS
// ===========================================================================

async function handleCreateEmployee(request, env) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  let body; try { body = await request.json(); } catch (e) { return json({ success: false, error: "Invalid JSON body" }, 400); }

  const orgId = session.org_id;
  const firstName = (body.first_name || "").trim();
  const lastName = (body.last_name || "").trim();
  const middleName = (body.middle_name || "").trim();
  const suffix = (body.suffix || "").trim();
  const email = (body.email || "").toLowerCase().trim();
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ") + (suffix ? " " + suffix : "");

  if (!firstName || !lastName) return json({ success: false, error: "First name and last name are required" }, 400);
  if (!email) return json({ success: false, error: "Email is required" }, 400);

  const dlFront = body.dl_image_front || "";
  const dlBack = body.dl_image_back || "";
  if (dlFront.length > 2 * 1024 * 1024) return json({ success: false, error: "Driver's license front image is too large (max 2MB)" }, 400);
  if (dlBack.length > 2 * 1024 * 1024) return json({ success: false, error: "Driver's license back image is too large (max 2MB)" }, 400);

  await ensureEmployeeTables(env);

  try {
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) return json({ success: false, error: "An employee with this email already exists" }, 409);

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO users (id, org_id, email, role_id, first_name, last_name, full_name, is_active, must_change_password,
                          phone, employee_number, address, dl_photo_front, dl_photo_back, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      userId, orgId, email,
      body.role_id || body.role || null,
      firstName, lastName, fullName,
      body.phone || "", body.employee_number || "", body.address || "",
      dlFront, dlBack, now, now
    ).run();

    await env.DB.prepare(
      `INSERT INTO employee_details (id, user_id, org_id, middle_name, suffix, address, city, state, zip,
                                     dob, drivers_license, dl_state, id_type, employment_status, department, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dl', ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), userId, orgId,
      middleName, suffix, body.address || "", body.city || "", body.state || "", body.zip || "",
      body.dob || "", body.drivers_license || "", body.dl_state || "",
      body.status || "Active", body.department || null, now, now
    ).run();

    await writeAuditLog(env, orgId, session.email, "create_employee", "employees", "users", userId, `Created employee ${fullName} (${email})`);

    return json({ success: true, employeeId: userId, message: "Employee created" });
  } catch (e) { console.error("handleCreateEmployee:", e.message, e.stack); return json({ success: false, error: "Failed to create employee: " + e.message }, 500); }
}

async function handleUpdateEmployee(request, env, employeeId) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);
  let body; try { body = await request.json(); } catch (e) { return json({ success: false, error: "Invalid JSON body" }, 400); }

  const orgId = session.org_id;
  const firstName = (body.first_name || "").trim();
  const lastName = (body.last_name || "").trim();
  const middleName = (body.middle_name || "").trim();
  const suffix = (body.suffix || "").trim();
  const email = (body.email || "").toLowerCase().trim();
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ") + (suffix ? " " + suffix : "");

  if (!firstName || !lastName) return json({ success: false, error: "First name and last name are required" }, 400);

  await ensureEmployeeTables(env);

  try {
    const existing = await env.DB.prepare("SELECT id, org_id FROM users WHERE id = ?").bind(String(employeeId)).first();
    if (!existing) return json({ success: false, error: "Employee not found" }, 404);
    if (existing.org_id !== orgId) return json({ success: false, error: "You do not have permission to modify this employee" }, 403);

    const now = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE users SET first_name = ?, last_name = ?, full_name = ?, email = ?, role_id = ?, phone = ?, updated_at = ?
       WHERE id = ? AND org_id = ?`
    ).bind(
      firstName, lastName, fullName, email,
      body.role_id || body.role || null,
      body.phone || "", now, existing.id, orgId
    ).run();

    const detail = await env.DB.prepare("SELECT id FROM employee_details WHERE user_id = ?").bind(existing.id).first();
    if (detail) {
      await env.DB.prepare(
        `UPDATE employee_details SET middle_name = ?, suffix = ?, employment_status = ?, department = ?, updated_at = ?
         WHERE user_id = ?`
      ).bind(middleName, suffix, body.status || "Active", body.department || null, now, existing.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO employee_details (id, user_id, org_id, middle_name, suffix, employment_status, department, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), existing.id, orgId, middleName, suffix, body.status || "Active", body.department || null, now, now).run();
    }

    await writeAuditLog(env, orgId, session.email, "update_employee", "employees", "users", existing.id, `Updated employee ${fullName} (${email})`);

    return json({ success: true, message: "Employee record updated successfully" });
  } catch (e) {
    console.error("handleUpdateEmployee:", e.message, e.stack);
    return json({ success: false, error: "Failed to update employee: " + e.message }, 500);
  }
}

async function handleListEmployees(request, env) {
  const session = await getOrgFromSession(request, env);
  if (!session) return json({ success: false, error: "Not authenticated" }, 401);

  await ensureEmployeeTables(env);

  try {
    const result = await env.DB.prepare(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.full_name, u.role_id, u.is_active,
              u.phone, u.employee_number, d.employment_status, d.department,
              (SELECT COUNT(*) FROM key_personnel_roles k WHERE k.user_id = u.id) AS kp_count
       FROM users u
       LEFT JOIN employee_details d ON d.user_id = u.id
       WHERE u.org_id = ?
       ORDER BY u.full_name ASC`
    ).bind(session.org_id).all();

    const employees = (result.results || []).map(function(row) {
      let status = row.employment_status || (row.is_active ? "Active" : "Inactive");
      if (status === 1 || status === "1") status = "Active";
      if (status === 0 || status === "0") status = "Inactive";

      return {
        id: row.id,
        name: row.full_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || "",
        email: row.email || "",
        role: row.role_id || "Unassigned",
        department: row.department || "",
        status: status,
        phone: row.phone || "",
        employeeNumber: row.employee_number || "",
        isKeyPersonnel: (row.kp_count || 0) > 0
      };
    });

    return json({ success: true, employees: employees });
  } catch (e) { console.error("handleListEmployees:", e.message); return json({ success: false, error: "Failed to fetch employees" }, 500); }
}

// ===========================================================================
// ROUTER
// ===========================================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

    // --- Active User Presence ---
    if (path === "/api/onboarding/presence" && method === "POST") return handlePresence(request, env);

    // --- Roles & Permissions ---
    if (path === "/api/onboarding/permissions" && method === "GET") return handleGetPermissions(request, env);
    if (path === "/api/onboarding/roles" && method === "GET") return handleGetRoles(request, env);
    if (path === "/api/onboarding/roles" && method === "POST") return handleCreateRole(request, env);
    if (path === "/api/onboarding/roles-permissions/complete" && method === "POST") return handleRolesPermissionsComplete(request, env);

    const roleMatch = path.match(/^\/api\/onboarding\/roles\/([^\/]+)$/);
    if (roleMatch) {
      const roleId = roleMatch[1];
      if (method === "PUT") return handleUpdateRole(request, env, roleId);
      if (method === "DELETE") return handleDeleteRole(request, env, roleId);
    }

    const rolePermMatch = path.match(/^\/api\/onboarding\/roles\/([^\/]+)\/permissions$/);
    if (rolePermMatch) {
      const roleId = rolePermMatch[1];
      if (method === "GET") return handleGetRolePermissions(request, env, roleId);
      if (method === "PUT") return handleSetRolePermissions(request, env, roleId);
    }

    const userPermMatch = path.match(/^\/api\/onboarding\/users\/([^\/]+)\/permissions$/);
    if (userPermMatch) {
      const userId = userPermMatch[1];
      if (method === "GET") return handleGetUserPermissions(request, env, userId);
      if (method === "PUT") return handleSetUserPermissions(request, env, userId);
      if (method === "PATCH") return handlePatchUserPermission(request, env, userId);
    }

    const userStatusMatch = path.match(/^\/api\/onboarding\/users\/([^\/]+)\/status$/);
    if (userStatusMatch) {
      const userId = userStatusMatch[1];
      if (method === "PUT") return handleUpdateUserStatus(request, env, userId);
    }

    // --- Key Personnel & Onboarding Finalize ---
    if (path === "/api/onboarding/key-personnel/list" && method === "GET") return handleList(request, env);
    if (path === "/api/onboarding/key-personnel/complete" && method === "POST") return handleComplete(request, env);
    if (path === "/api/onboarding/key-personnel/send-invites" && method === "POST") return handleSendInvites(request, env);
    if (path === "/api/onboarding/key-personnel/revoke" && method === "POST") return handleRevoke(request, env);
    if (path === "/api/onboarding/finalize" && method === "POST") return handleFinalizeOnboarding(request, env);

    // --- Employees ---
    if (path === "/api/onboarding/employees/create" && method === "POST") return handleCreateEmployee(request, env);
    if (path === "/api/onboarding/employees/list" && method === "GET") return handleListEmployees(request, env);

    const empMatch = path.match(/^\/api\/onboarding\/employees\/([^/]+)$/);
    if (empMatch) {
      const empId = empMatch[1];
      if (method === "PUT") return handleUpdateEmployee(request, env, empId);
    }

    return json({ error: "Not found" }, 404);
  }
};
