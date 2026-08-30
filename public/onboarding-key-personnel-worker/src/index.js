const PBKDF2_ITERATIONS = 100000;
const CH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(d, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", ...CH } });
}

function base64UrlEncode(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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

async function sendEmail(env, to, cc, subject, html, text) {
  const pe = { to: [{ email: to }], subject };
  if (cc) pe.cc = [{ email: cc }];
  const b = {
    personalizations: [pe],
    from: { email: env.FROM_EMAIL },
    subject,
    content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }]
  };
  return fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(b)
  });
}

async function createAirtableEmployee(env, person, eid) {
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) return null;
  const fn = person.firstName || "";
  const ln = person.lastName || "";
  const full = [fn, ln].filter(x => x).join(" ");
  const today = new Date().toISOString().split("T")[0];
  const ts = (person.tasks && person.tasks.length > 0) ? `Onboarding responsibilities: ${person.tasks.join(", ")}` : "";
  const f = {
    "First Name": fn, "Last Name": ln, "Full Name": full,
    "Email": person.email || "", "Phone": "", "Employee ID": eid,
    "Division": "Unassigned", "Role": "Key Personnel",
    "Employment Type": "Full-Time", "Start Date": today,
    "Status": "Onboarding", "Notes": ts
  };
  try {
    const r = await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Employee`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: [{ fields: f }] })
    });
    return r.ok;
  } catch (e) {
    console.error("createAirtableEmployee error:", e.message, e.stack);
    return false;
  }
}

async function handleGetRoles(request, env) {
  try {
    const r = await env.DB.prepare("SELECT id,name,description FROM roles ORDER BY name").all();
    return json({ success: true, roles: r.results });
  } catch (e) {
    console.error("handleGetRoles error:", e.message, e.stack);
    return json({ success: false, error: "Failed to fetch roles", detail: e.message }, 500);
  }
}

async function handleComplete(request, env) {
  let body;
  try { body = await request.json(); } catch (e) {
    console.error("handleComplete JSON parse error:", e.message);
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { customerId, adminName, adminEmail, keyPersonnel } = body;
  if (!customerId) return json({ success: false, error: "Missing customerId" }, 400);
  if (!keyPersonnel || !Array.isArray(keyPersonnel) || keyPersonnel.length === 0) return json({ success: false, error: "No key personnel" }, 400);
  if (!adminName || !adminEmail) return json({ success: false, error: "Admin name and email required" }, 400);

  const results = [];

  for (let i = 0; i < keyPersonnel.length; i++) {
    const person = keyPersonnel[i];
    const firstName = person.firstName || "";
    const lastName = person.lastName || "";
    const fullName = [firstName, lastName].filter(x => x).join(" ");
    const email = person.email || "";
    const emailLower = email.toLowerCase().trim();

    const detail = { name: fullName, email, user_created: false, user_updated: false, employee_created: false, airtable_created: false, email_sent: false, error: null };

    try {
      const tempPassword = genPwd();
      let hashed;
      try {
        hashed = await hashPassword(tempPassword);
      } catch (he) {
        console.error("hashPassword threw:", he.message, he.stack);
        detail.error = "hashPassword threw: " + he.message;
        results.push(detail);
        continue;
      }

      const salt = hashed.salt || "";
      const hash = hashed.hash || "";

      if (!salt || !hash) {
        console.error("hash or salt is empty: salt=" + typeof salt + " hash=" + typeof hash);
        detail.error = "hash or salt is empty: salt=" + typeof salt + " hash=" + typeof hash;
        results.push(detail);
        continue;
      }

      let userId;
      try {
        const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(emailLower).first();
        if (existing) {
          await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,must_change_password=1,role_id=?,first_name=?,last_name=?,full_name=? WHERE email=?").bind(hash, salt, null, firstName, lastName, fullName, emailLower).run();
          detail.user_updated = true;
          userId = existing.id;
        } else {
          userId = crypto.randomUUID();
          await env.DB.prepare("INSERT INTO users (id,org_id,email,role_id,password_hash,password_salt,must_change_password,is_active,first_name,last_name,full_name) VALUES (?,?,?,?,?,?,1,1,?,?,?)").bind(userId, customerId, emailLower, null, hash, salt, firstName, lastName, fullName).run();
          detail.user_created = true;
        }
      } catch (e) {
        console.error("D1 users error:", e.message, e.stack);
        detail.error = "D1 users error: " + e.message;
        results.push(detail);
        continue;
      }

      let employeeDbId;
      try {
        const er = await env.EMPLOYEES_DB.prepare("INSERT INTO employees (name,role,email,employee_name,status,is_key_personnel,customer_id) VALUES (?,'Unassigned',?,?,'Active',1,?) RETURNING id").bind(fullName, email, fullName, customerId).first();
        employeeDbId = er ? er.id : null;
        if (employeeDbId === undefined || employeeDbId === null) {
          console.error("D1 employees error: RETURNING id returned null");
          detail.error = "D1 employees error: RETURNING id returned null";
          results.push(detail);
          continue;
        }
        detail.employee_created = true;
      } catch (e) {
        console.error("D1 employees error:", e.message, e.stack);
        detail.error = "D1 employees error: " + e.message;
        results.push(detail);
        continue;
      }

      if (person.tasks && person.tasks.length > 0) {
        for (const task of person.tasks) {
          try {
            await env.EMPLOYEES_DB.prepare("INSERT INTO key_personnel_roles (employee_id,role) VALUES (?,?)").bind(employeeDbId, task).run();
          } catch (e) {
            console.error("D1 key_personnel_roles error:", e.message, e.stack, "employeeDbId=" + JSON.stringify(employeeDbId), "task=" + JSON.stringify(task));
            detail.error = "D1 key_personnel_roles error: " + e.message + " (employeeDbId=" + JSON.stringify(employeeDbId) + ",task=" + JSON.stringify(task) + ")";
            results.push(detail);
            continue;
          }
        }
      }

      const airtableEmpId = `KP-${String(i + 1).padStart(3, "0")}`;
      detail.airtable_created = await createAirtableEmployee(env, person, airtableEmpId) === true;

      const loginUrl = `${env.ONBOARDING_DOMAIN}/public/login`;
      const taskListHtml = (person.tasks || []).map(t => `<li>${t}</li>`).join("");
      const emailHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="text-align:center;padding:24px 0;"><img src="https://www.driv-en.com/logo.png?v=2026" alt="DRIV-EN" style="max-height:80px;"></div><h2 style="text-align:center;color:#1e293b;font-size:22px;margin:24px 0 16px 0;">Welcome to <span style="color:#8c8c8c;font-weight:bold;font-style:italic;letter-spacing:-1px;">DRIV</span><span style="color:#2da94f;font-weight:bold;font-style:italic;letter-spacing:-1px;">-</span><span style="color:#dc2626;font-weight:bold;font-style:italic;letter-spacing:-1px;">EN</span></h2><p>Hello ${fullName},</p><p>Driv-en is a cloud-based platform for equipment management, work orders, preventative maintenance, inspections, fuel tracking, and project management — designed for companies that need to keep their equipment and crews running efficiently.</p><p><strong>${adminName}</strong> has assigned you as Key Personnel and you are responsible for helping complete the initial data setup.</p><p><strong>Your assigned tasks:</strong></p><ul>${taskListHtml}</ul><p>Your account has been created. Please log in using the credentials below:</p><table style="border-collapse:collapse;margin:16px 0;font-family:sans-serif;"><tr><td style="padding:4px 16px 4px 0;color:#64748b;">Login URL:</td><td style="padding:4px 16px;"><a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 28px;border-radius:6px;font-size:15px;font-weight:600;">LOGIN</a></td></tr><tr><td style="padding:4px 16px 4px 0;color:#64748b;">Email:</td><td style="padding:4px 16px;">${email}</td></tr><tr><td style="padding:4px 16px 4px 0;color:#64748b;">Temporary Password:</td><td style="padding:4px 16px;"><strong style="font-family:monospace;font-size:15px;background:#f1f5f9;padding:4px 8px;border-radius:4px;">${tempPassword}</strong></td></tr></table><p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px;border-radius:6px;display:inline-block;">You will be prompted to change your password on first login.</p><p>If you have any questions, contact your administrator at <a href="mailto:${adminEmail}">${adminEmail}</a> or <a href="mailto:${env.SUPPORT_CONTACT}">${env.SUPPORT_CONTACT}</a>.</p><p>Best regards,<br><span style="color:#8c8c8c;font-weight:bold;font-style:italic;letter-spacing:-1px;">DRIV</span><span style="color:#2da94f;font-weight:bold;font-style:italic;letter-spacing:-1px;">-</span><span style="color:#dc2626;font-weight:bold;font-style:italic;letter-spacing:-1px;">EN</span> Team</p></div>`;
      const emailText = `Welcome to DRIV-EN\n\nHello ${fullName},\n\nDriv-en is a cloud-based platform for equipment management, work orders, preventative maintenance, inspections, fuel tracking, and project management — designed for companies that need to keep their equipment and crews running efficiently.\n\n${adminName} has assigned you as Key Personnel and you are responsible for helping complete the initial data setup.\n\nYour assigned tasks:\n${(person.tasks || []).map(t => "  - " + t).join("\n")}\n\nYour account has been created. Please log in using the credentials below:\n\nLogin URL: ${loginUrl}\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nYou will be prompted to change your password on first login.\n\nIf you have any questions, contact your administrator at ${adminEmail} or ${env.SUPPORT_CONTACT}.\n\nBest regards, DRIV-EN Team`;

      const emailResponse = await sendEmail(env, email, adminEmail, "Your DRIV-EN Account & Onboarding Responsibilities", emailHtml, emailText);
      detail.email_sent = emailResponse.ok;
      if (!emailResponse.ok) {
        const et = await emailResponse.text().catch(() => "");
        console.error("Email failed:", emailResponse.status, et);
        detail.error = `Email failed (${emailResponse.status}): ${et}`;
      }
    } catch (e) {
      console.error("handleComplete person error:", e.message, e.stack);
      detail.error = e.message;
    }

    results.push(detail);
  }

  const allSuccess = results.every(r => r.error === null);
  return json({ success: allSuccess, total: results.length, results }, allSuccess ? 200 : 207);
}

async function handleList(request, env) {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId");
    if (!customerId) return json({ success: false, error: "Missing customerId" }, 400);

    const employees = await env.EMPLOYEES_DB.prepare("SELECT id,name,email,employee_name,status,is_key_personnel,customer_id FROM employees WHERE is_key_personnel=1 AND customer_id=? ORDER BY name").bind(customerId).all();

    const result = [];
    for (const emp of employees.results) {
      const roles = await env.EMPLOYEES_DB.prepare("SELECT id,role FROM key_personnel_roles WHERE employee_id=?").bind(emp.id).all();
      result.push({
        employeeId: emp.id,
        name: emp.employee_name || emp.name,
        email: emp.email,
        status: emp.status,
        roles: roles.results.map(r => ({ id: r.id, role: r.role }))
      });
    }

    return json({ success: true, keyPersonnel: result });
  } catch (e) {
    console.error("handleList error:", e.message, e.stack);
    return json({ success: false, error: "Failed to list key personnel", detail: e.message }, 500);
  }
}

async function handleRevoke(request, env) {
  let body;
  try { body = await request.json(); } catch (e) {
    console.error("handleRevoke JSON parse error:", e.message);
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { customerId, employeeId, revokeAll, roles } = body;
  if (!employeeId) return json({ success: false, error: "Missing employeeId" }, 400);

  try {
    if (revokeAll) {
      await env.EMPLOYEES_DB.prepare("DELETE FROM key_personnel_roles WHERE employee_id=?").bind(employeeId).run();
      await env.EMPLOYEES_DB.prepare("UPDATE employees SET is_key_personnel=0 WHERE id=?").bind(employeeId).run();
      return json({ success: true, message: "All assignments revoked, key personnel status removed" });
    }

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return json({ success: false, error: "Provide roles array or revokeAll=true" }, 400);
    }

    for (const role of roles) {
      await env.EMPLOYEES_DB.prepare("DELETE FROM key_personnel_roles WHERE employee_id=? AND role=?").bind(employeeId, role).run();
    }

    const remaining = await env.EMPLOYEES_DB.prepare("SELECT COUNT(*) as count FROM key_personnel_roles WHERE employee_id=?").bind(employeeId).first();
    if (remaining && remaining.count === 0) {
      await env.EMPLOYEES_DB.prepare("UPDATE employees SET is_key_personnel=0 WHERE id=?").bind(employeeId).run();
    }

    return json({ success: true, message: "Selected assignments revoked", remainingRoles: remaining ? remaining.count : 0 });
  } catch (e) {
    console.error("handleRevoke error:", e.message, e.stack);
    return json({ success: false, error: "Failed to revoke assignments", detail: e.message }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: CH });
    if (path === "/api/onboarding/roles" && method === "GET") return handleGetRoles(request, env);
    if (path === "/api/onboarding/key-personnel/list" && method === "GET") return handleList(request, env);
    if (path === "/api/onboarding/key-personnel/revoke" && method === "POST") return handleRevoke(request, env);
    if (path === "/api/onboarding/key-personnel/complete" && method === "POST") return handleComplete(request, env);
    return json({ error: "Not found" }, 404);
  }
};
