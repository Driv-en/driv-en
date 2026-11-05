// ==========================================
// DRIV-EN FUEL WORKER (combined index.js)
// Double-entry fuel inventory: tanks + transactions.
// Atomic tank quantity updates inside D1 batch transaction.
//
// Routes:
//   GET    /fuel-tanks                  — List tanks (optional ?tank_type=, ?status=)
//   POST   /fuel-tanks                  — Create a tank
//   PUT    /fuel-tanks/:id              — Update a tank
//   DELETE /fuel-tanks/:id              — Deactivate a tank
//   GET    /fuel-tanks/:id              — Get single tank + recent transactions
//   POST   /fuel-tanks/:id/adjust       — Manual tank quantity adjustment (shortage/overage)
//                                         Logged to fuel_transactions (type 'adjustment')
//                                         AND fuel_flags (flag_type 'tank_adjustment')
//
//   GET    /fuel-transactions           — List transactions
//   POST   /fuel-transactions           — Create a fuel transaction (auto-updates tank quantities)
//   GET    /fuel-transactions/:id       — Get single transaction
//
//   POST   /fuel-purchases              — Create multi-line purchase
//   GET    /fuel-purchases              — List purchases
//   GET    /fuel-purchases/:id          — Get single purchase with line items
//
//   POST   /fuel-receipts/upload        — Upload receipt to R2
//   POST   /fuel-receipts/extract       — Upload receipt + AI extraction
//   GET    /fuel-receipts               — List receipts for org
//   GET    /fuel-receipts/:id           — Get single receipt
//
//   GET    /fuel-flags                  — List flags
//   PUT    /fuel-flags/:id/resolve      — Resolve a flag
//
//   GET    /org-settings / PUT /org-settings
//   GET    /fuel-tank-types / POST /fuel-tank-types / PUT /fuel-tank-types/:id
//   GET    /module-subscriptions
//
// Bindings:
//   DB (D1)        — driv-en-db
//   JWT_SECRET     — Signs/verifies JWT tokens
//   DRIVEN_DATA (R2) — receipt photo/document storage
//   AI (Workers AI) — vision model / toMarkdown for receipt extraction
//
// Unit of measure: messages and logs use the organization's volume unit
// from the units_of_measure table (selected during onboarding); defaults to gallons.
// ==========================================

// ── JWT Utilities (shared pattern) ──

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = headerB64 + "." + payloadB64;
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(sigB64),
      new TextEncoder().encode(data)
    );
    if (!valid) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64))
    );
    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch (e) {
    console.error("verifyJWT error:", e.message);
    return null;
  }
}

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

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ── JSON extraction helper ──
function _extractJSON(str) {
  if (!str || typeof str !== "string") return null;
  try { return JSON.parse(str); } catch (e) {}
  var stripped = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch (e) {}
  var first = str.indexOf("{");
  var last = str.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    var jsonStr = str.substring(first, last + 1);
    try { return JSON.parse(jsonStr); } catch (e) {}
    var cleaned = jsonStr.replace(/[\u201C\u201D]/g, '"').replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    try { return JSON.parse(cleaned); } catch (e) {}
  }
  return { raw: str };
}

// ── Recursive receipt data finder ──
function _findReceiptData(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.vendor || obj.line_items || obj.total_amount) {
    return obj;
  }
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var val = obj[keys[i]];
    if (val && typeof val === "object") {
      var found = _findReceiptData(val);
      if (found) return found;
    }
  }
  return null;
}

async function getAuth(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies["driv_en_session"];
  if (!token) return null;
  return await verifyJWT(token, env.JWT_SECRET);
}

// ── Organization unit of measure (units_of_measure table) ──
// Returns the first volume unit the customer selected during onboarding.
// Rate units (per hour / per minute) are ignored. Falls back to gallons.
const DEFAULT_VOLUME_UNIT = { name: "gallons", singular: "gallon", abbr: "gal" };

async function getOrgVolumeUnit(env, org_id) {
  try {
    const result = await env.DB.prepare("SELECT * FROM units_of_measure WHERE org_id = ?").bind(org_id).all();
    for (const row of (result.results || [])) {
      if (row.status && String(row.status).toLowerCase() !== "active") continue;
      const label = String(row.name || row.unit_name || row.code || "").toLowerCase();
      if (/per\s|\/|gph|gpm|lph|lpm/.test(label)) continue;
      if (/imperial/.test(label)) return { name: "imperial gallons", singular: "imperial gallon", abbr: "imp gal" };
      if (/liter|litre/.test(label)) return { name: "liters", singular: "liter", abbr: "L" };
      if (/gallon/.test(label)) return DEFAULT_VOLUME_UNIT;
    }
  } catch (e) {
    // Table may not exist for older orgs — fall back to gallons
  }
  return DEFAULT_VOLUME_UNIT;
}

// ── Server-side authorization ──
// 3-tier permission check: user override → role permission → deny.
// Founder is the ONLY system bypass (is_system role).

const PERM = {
  FUEL_VIEW:           "fuel.view",
  FUEL_ADD:            "fuel.add",
  FUEL_EDIT:           "fuel.edit",
  FUEL_DELETE:         "fuel.delete",
  FUEL_FLAGS_VIEW:     "fuel_flags.view",
  FUEL_FLAGS_RESOLVE:  "fuel_flags.resolve",
  ORG_SETTINGS_EDIT:   "org_settings.edit",
};

// Hardcoded fallback — used only when DB tables don't exist yet.
const FALLBACK_PERMISSIONS = {
  "DRIV-EN Founder": ["*"],
  "Admin": ["*"],
  "Field Operator": [
    "fuel.view", "fuel.add", "fuel.edit", "fuel_flags.view",
  ],
};

async function requirePermission(session, permissionName, env) {
  if (!session) return false;

  // 1. Founder bypass
  if (session.role === "DRIV-EN Founder") return true;

  let userId = session.user_id;
  let roleId = session.role_id;
  let roleName = session.role;

  // The login JWT only carries email/org_id/role, so resolve ids from the users table.
  if ((!userId || !roleId) && session.email && env && env.DB) {
    try {
      const u = await env.DB.prepare(
        "SELECT u.id AS user_id, u.role_id AS role_id, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE LOWER(u.email) = LOWER(?) LIMIT 1"
      ).bind(session.email).first();
      if (u) {
        userId = userId || u.user_id;
        roleId = roleId || u.role_id;
        roleName = roleName || u.role_name;
      }
    } catch (e) {
      // Fall through with whatever the session provides
    }
  }
  const roleKey = String(roleName || "").trim().toLowerCase();
  if (roleKey === "driv-en founder") return true;

  // 2. User override check (granted=1 allow, granted=0 deny)
  if (userId && env && env.DB) {
    try {
      const override = await env.DB.prepare(
        "SELECT upo.granted FROM user_permissions_override upo JOIN permissions p ON upo.permission_id = p.id WHERE upo.user_id = ? AND p.name = ? LIMIT 1"
      ).bind(userId, permissionName).first();
      if (override) {
        return override.granted === 1 || override.granted === true;
      }
    } catch (e) {
      // Table might not exist yet — continue to role check
    }
  }

  // 3. Role permission check
  if (roleId && env && env.DB) {
    try {
      const rolePerm = await env.DB.prepare(
        "SELECT 1 FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ? AND p.name = ? LIMIT 1"
      ).bind(roleId, permissionName).first();
      if (rolePerm) return true;

      // Role exists in DB but lacks this permission — deny
      const hasAnyRows = await env.DB.prepare(
        "SELECT 1 FROM role_permissions WHERE role_id = ? LIMIT 1"
      ).bind(roleId).first();
      if (hasAnyRows) return false;
    } catch (e) {
      // Table might not exist — fall through to hardcoded fallback
    }
  }

  // 4. Hardcoded fallback
  const fallbackKey = Object.keys(FALLBACK_PERMISSIONS).find(k => k.toLowerCase() === roleKey);
  const fallback = fallbackKey ? FALLBACK_PERMISSIONS[fallbackKey] : null;
  if (!fallback) return false;
  if (fallback.includes("*")) return true;
  return fallback.includes(permissionName);
}

// ── Subscription check ──
async function isFuelManagementSubscribed(env, org_id) {
  try {
    const sub = await env.DB.prepare(
      "SELECT is_active FROM module_subscriptions WHERE org_id = ? AND module_key = 'fuel_management'"
    ).bind(org_id).first();
    if (!sub) return true;
    return sub.is_active === 1 || sub.is_active === true;
  } catch (e) {
    return true;
  }
}

// ── Fuel tank types helper ──
async function getFuelTankTypes(env, org_id) {
  try {
    const result = await env.DB.prepare(
      "SELECT system_key, display_name, sort_order FROM fuel_tank_types WHERE org_id = ? AND is_active = 1 ORDER BY sort_order ASC"
    ).bind(org_id).all();
    if (result.results && result.results.length > 0) {
      return result.results;
    }
  } catch (e) {}
  return [
    { system_key: "bulk_tank", display_name: "Bulk Storage Tank", sort_order: 1 },
    { system_key: "dragup_tank", display_name: "Drag-Up Tank", sort_order: 2 },
    { system_key: "portable_can", display_name: "Portable Gas Can", sort_order: 3 },
    { system_key: "equipment", display_name: "Equipment", sort_order: 4 }
  ];
}

// ── Transaction type → entity mapping ──
const TX_TYPES = {
  purchase:      { from: ["vendor"],       to: ["bulk_tank", "dragup_tank", "portable_can"] },
  bulk_issue:    { from: ["bulk_tank"],    to: ["asset"] },
  dragup_fill:   { from: ["bulk_tank"],    to: ["dragup_tank"] },
  dragup_issue:  { from: ["dragup_tank"],  to: ["asset"] },
  portable_fill: { from: ["bulk_tank", "dragup_tank"], to: ["portable_can"] },
  portable_issue:{ from: ["portable_can"], to: ["asset"] },
  return:        { from: ["asset", "portable_can", "dragup_tank"], to: ["bulk_tank"] },
  adjustment:    { from: [], to: [] },
};

// ── Receipt extraction prompt for AI vision model ──
const RECEIPT_PROMPT = `You are an expert at reading fuel purchase receipts. Examine the image carefully.

This is a fuel receipt from a gas station, truck stop, or fuel delivery company. Look at ALL text on the receipt, including small print.

STEP 1 — Identify the vendor name. It is usually at the very top of the receipt, often in a larger or bold font. Common vendors: Pilot, Flying J, Love's, TA, Petro, Speedway, Shell, Chevron, BP, Exxon, Casey's, CFN, Pacific Pride, etc.

STEP 2 — Find the date. It may be in formats like MM/DD/YYYY, YYYY-MM-DD, or DD/MM/YYYY. Convert to YYYY-MM-DD.

STEP 3 — Find each fuel line item. Look for columns or rows with: product name, gallons/quantity, price per gallon, and total amount.

STEP 4 — Find the total amount. It is usually near the bottom, labeled TOTAL, TOTAL USD, or similar.

Return your answer as a JSON object with EXACTLY these fields. Do NOT wrap it in markdown code fences. Do NOT add any text before or after the JSON. Output the raw JSON object directly.

{
  "vendor": "string or null — the vendor/station name at the top of the receipt",
  "receipt_date": "string YYYY-MM-DD or null — the date shown on the receipt (NOT today's date)",
  "line_items": [
    {
      "fuel_type": "string — see mapping below",
      "fuel_grade": "string or null — e.g. 87, 89, 91, Premium, Clear, Dyed",
      "gallons": "number — the GALLONS or QTY column value",
      "unit_price": "number or null — the PRICE/G or unit price column value",
      "amount": "number or null — the line total / FUEL SALE column value"
    }
  ],
  "total_amount": "number or null — the total USD amount",
  "confidence": "number 0-1 — your confidence in this extraction",
  "low_confidence_fields": "array of strings — field names you are not confident about"
}

Fuel type mapping — use these exact values:
- "diesel_onroad": Diesel, Diesel #2, Clear Diesel, On-Road Diesel, D2, D2 Clear
- "diesel_offroad": Off-Road Diesel, Dyed Diesel, Red Diesel, Diesel #1 Dyed
- "gasoline": Gasoline, Unleaded, UNLD, Regular, Mid-Grade, Premium, 87, 89, 91, 93, E10, E15, E85
- "DEF": DEF, Diesel Exhaust Fluid, AdBlue, Urea
- "propane": Propane, LPG, LP
- "other": anything else

CRITICAL RULES:
- Read each value exactly as shown on the receipt. Do not guess or make up values.
- If you can read the vendor name, include it. If you cannot read it, set vendor to null.
- If you can read the date, include it. If not, set receipt_date to null.
- If you can read line items, include them. If the receipt is unreadable, return an empty line_items array.
- Set confidence to 0.9+ only if you are very sure. Set it to 0.5-0.8 if some fields are unclear. Set it below 0.5 if the receipt is mostly unreadable.
- OUTPUT ONLY THE JSON OBJECT. No markdown, no code fences, no explanation.`;

const RECEIPT_TEXT_PROMPT = `You are given text extracted from a fuel purchase receipt/delivery ticket (possibly a PDF).
Extract the fuel purchase data as JSON with these fields:
- vendor (string): fuel vendor/station/delivery company name
- receipt_date (string, YYYY-MM-DD): date printed on the receipt (not today's date)
- line_items (array of objects, each with: fuel_type (string — see mapping below), fuel_grade (string, optional — e.g., "87", "89", "91", "Premium", "Clear", "Dyed", "#1", "#2"), gallons (number), unit_price (number, optional), amount (number))
- total_amount (number): receipt total dollar amount
- confidence (number 0-1): your overall confidence in this extraction
- low_confidence_fields (array of strings): field names you are not confident about

Fuel type mapping — use these exact values:
- "diesel_onroad": Diesel, Diesel #2, Clear Diesel, On-Road Diesel, D2, D2 Clear
- "diesel_offroad": Off-Road Diesel, Dyed Diesel, Red Diesel, Diesel #1 Dyed, Off-Road D2
- "gasoline": Gasoline, Unleaded, UNLD, Regular, Mid-Grade, Premium, 87, 89, 91, 93, E10, E15, E85, Ethanol Blend
- "DEF": DEF, Diesel Exhaust Fluid, AdBlue, Urea
- "propane": Propane, LPG, LP
- "other": any other fuel product not listed above

Each line item should capture a separate fuel product or transaction on the receipt.
If a field is not visible, omit it or set it to null. Return ONLY valid JSON, no markdown, no explanation.`;

// ── Worker Entry ──

async function sendEmail(env, to, subject, htmlContent) {
  try {
    const msg = {
      to: [to],
      from: env.FROM_EMAIL || "noreply@driv-en.com",
      subject: subject,
      content: [
        { type: "text/plain", value: "DRIV-EN error notification. See dashboard Error Logs tab for details." },
        { type: "text/html", value: htmlContent }
      ]
    };
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(msg)
    });
    return resp.ok;
  } catch (e) {
    console.error("sendEmail error:", e.message);
    return false;
  }
}

async function logError(env, source, err, request) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS error_log (
        id TEXT PRIMARY KEY,
        source TEXT,
        error_message TEXT,
        stack_trace TEXT,
        severity TEXT DEFAULT 'error',
        resolved INTEGER DEFAULT 0,
        created_at TEXT
      )`
    ).run();
    const errorId = "ERR-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);

    let stackTrace = (err && err.stack) ? err.stack : "No stack trace";
    if (request) {
      try {
        const url = new URL(request.url);
        stackTrace += "\n\n--- REQUEST CONTEXT ---" +
          "\nURL: " + request.url +
          "\nMethod: " + request.method +
          "\nPath: " + url.pathname +
          "\nUser-Agent: " + (request.headers.get("User-Agent") || "N/A") +
          "\nCF-Ray: " + (request.headers.get("CF-Ray") || "N/A") +
          "\nTime: " + new Date().toISOString();
      } catch (u) {}
    }

    await env.DB.prepare(
      `INSERT INTO error_log (id, source, error_message, stack_trace, severity, resolved, created_at)
       VALUES (?, ?, ?, ?, 'error', 0, ?)`
    ).bind(
      errorId,
      source,
      (err && err.message) ? err.message : "Unknown error",
      stackTrace,
      new Date().toISOString()
    ).run();
  } catch (dbErr) {
    console.error("Failed to write to error_log:", dbErr.message);
  }

  try {
    const supportEmail = env.SUPPORT_CONTACT || "support@driv-en.com";
    if (env.RESEND_API_KEY) {
      await sendEmail(env, supportEmail,
        "ERROR: " + source,
        "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;\">" +
        "<h2 style=\"color:#cc0000;\">Worker Error — " + source + "</h2>" +
        "<p><strong>Time:</strong> " + new Date().toISOString() + "</p>" +
        "<p><strong>Error:</strong> " + ((err && err.message) || "Unknown error") + "</p>" +
        "<p><strong>Stack:</strong></p><pre style=\"background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto;font-size:13px;\">" + ((err && err.stack) || "No stack trace") + "</pre>" +
        "<p style=\"font-size:13px;color:#888;\">This is an automated error notification from the DRIV-EN platform.</p>" +
        "</div>"
      );
    }
  } catch (emailErr) {
    console.error("Failed to send error email:", emailErr.message);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const session = await getAuth(request, env);
    if (!session) return json({ success: false, error: "Not authenticated" }, 401);

    const org_id = session.org_id;
    if (!org_id) return json({ success: false, error: "No org context" }, 403);

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ── Subscription gating ──
    const isSubscriptionCheck = path === "/module-subscriptions" && method === "GET";
    const isTankTypesQuery = path === "/fuel-tank-types" && method === "GET";
    if (!isSubscriptionCheck && !isTankTypesQuery) {
      const subscribed = await isFuelManagementSubscribed(env, org_id);
      if (!subscribed) {
        return json({ success: false, error: "Fuel Management module is not subscribed for this organization" }, 403);
      }
    }

    try {
      // ════════════════════════════════════════
      // FUEL TANKS
      // ════════════════════════════════════════

      // ── GET /fuel-tanks — List ──
      if (path === "/fuel-tanks" && method === "GET") {
        if (!await requirePermission(session, PERM.FUEL_VIEW, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const tankType = url.searchParams.get("tank_type");
        const status = url.searchParams.get("status");
        let query = "SELECT * FROM fuel_tanks WHERE org_id = ?";
        const bindings = [org_id];
        if (tankType) { query += " AND tank_type = ?"; bindings.push(tankType); }
        if (status) { query += " AND status = ?"; bindings.push(status); }
        query += " ORDER BY created_at DESC";
        const result = await env.DB.prepare(query).bind(...bindings).all();
        return json({ success: true, tanks: result.results });
      }

      // ── POST /fuel-tanks — Create ──
      if (path === "/fuel-tanks" && method === "POST") {
        if (!await requirePermission(session, PERM.FUEL_EDIT, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const body = await request.json();
        const { name, tank_type, fuel_type, capacity, current_quantity, unit, asset_id, location, ownership_type, owner_name, owner_employee_id } = body;
        if (!name) return json({ success: false, error: "name is required" }, 400);
        if (!tank_type) return json({ success: false, error: "tank_type is required (bulk/dragup/portable)" }, 400);

        if (ownership_type && !["company", "employee", "rental"].includes(ownership_type)) {
          return json({ success: false, error: "ownership_type must be company, employee, or rental" }, 400);
        }

        if (tank_type === "dragup" && asset_id) {
          const asset = await env.DB.prepare("SELECT id FROM assets WHERE id = ? AND org_id = ?").bind(asset_id, org_id).first();
          if (!asset) return json({ success: false, error: "Asset not found" }, 404);
        }

        const orgUnit = await getOrgVolumeUnit(env, org_id);
        const tankUnit = unit || orgUnit.name;

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare(
          "INSERT INTO fuel_tanks (id, org_id, name, tank_type, fuel_type, capacity, current_quantity, unit, asset_id, location, status, ownership_type, owner_name, owner_employee_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)"
        ).bind(id, org_id, name, tank_type, fuel_type || null, capacity || 0, current_quantity || 0, tankUnit, asset_id || null, location || null, ownership_type || "company", owner_name || null, owner_employee_id || null, now, now).run();

        return json({ success: true, tank: { id, org_id, name, tank_type, fuel_type, capacity: capacity || 0, current_quantity: current_quantity || 0, unit: tankUnit, asset_id: asset_id || null, location, status: "active", ownership_type: ownership_type || "company", owner_name: owner_name || null, owner_employee_id: owner_employee_id || null } }, 201);
      }

      // ── GET /fuel-tanks/:id — Single tank + recent transactions ──
      const tankMatch = path.match(/^\/fuel-tanks\/([^/]+)$/);
      if (tankMatch && method === "GET") {
        if (!await requirePermission(session, PERM.FUEL_VIEW, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const tankId = tankMatch[1];
        const tank = await env.DB.prepare("SELECT * FROM fuel_tanks WHERE id = ? AND org_id = ?").bind(tankId, org_id).first();
        if (!tank) return json({ success: false, error: "Tank not found" }, 404);

        const txs = await env.DB.prepare(
          "SELECT * FROM fuel_transactions WHERE org_id = ? AND ((from_entity_type = ? AND from_entity_id = ?) OR (to_entity_type = ? AND to_entity_id = ?)) ORDER BY transaction_date DESC LIMIT 50"
        ).bind(org_id, tank.tank_type + "_tank", tankId, tank.tank_type + "_tank", tankId).all();

        return json({ success: true, tank, recent_transactions: txs.results });
      }

      // ── PUT /fuel-tanks/:id — Update ──
      if (tankMatch && method === "PUT") {
        if (!await requirePermission(session, PERM.FUEL_EDIT, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const tankId = tankMatch[1];
        const body = await request.json();
        const { name, fuel_type, capacity, current_quantity, unit, location, status, ownership_type, owner_name, owner_employee_id } = body;
        const now = new Date().toISOString();

        const tank = await env.DB.prepare("SELECT * FROM fuel_tanks WHERE id = ? AND org_id = ?").bind(tankId, org_id).first();
        if (!tank) return json({ success: false, error: "Tank not found" }, 404);

        if (ownership_type && !["company", "employee", "rental"].includes(ownership_type)) {
          return json({ success: false, error: "ownership_type must be company, employee, or rental" }, 400);
        }

        await env.DB.prepare(
          "UPDATE fuel_tanks SET name = ?, fuel_type = ?, capacity = ?, current_quantity = ?, unit = ?, location = ?, status = ?, ownership_type = ?, owner_name = ?, owner_employee_id = ?, updated_at = ? WHERE id = ? AND org_id = ?"
        ).bind(
          name !== undefined ? name : tank.name,
          fuel_type !== undefined ? fuel_type : tank.fuel_type,
          capacity !== undefined ? capacity : tank.capacity,
          current_quantity !== undefined ? current_quantity : tank.current_quantity,
          unit !== undefined ? unit : tank.unit,
          location !== undefined ? location : tank.location,
          status !== undefined ? status : tank.status,
          ownership_type !== undefined ? ownership_type : tank.ownership_type,
          owner_name !== undefined ? owner_name : tank.owner_name,
          owner_employee_id !== undefined ? owner_employee_id : tank.owner_employee_id,
          now, tankId, org_id
        ).run();

        return json({ success: true, tank_id: tankId });
      }

      // ── DELETE /fuel-tanks/:id — Deactivate ──
      if (tankMatch && method === "DELETE") {
        if (!await requirePermission(session, PERM.FUEL_EDIT, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const tankId = tankMatch[1];
        const tank = await env.DB.prepare("SELECT * FROM fuel_tanks WHERE id = ? AND org_id = ?").bind(tankId, org_id).first();
        if (!tank) return json({ success: false, error: "Tank not found" }, 404);
        await env.DB.prepare("UPDATE fuel_tanks SET status = 'inactive', updated_at = ? WHERE id = ? AND org_id = ?").bind(new Date().toISOString(), tankId, org_id).run();
        return json({ success: true, message: "Tank deactivated" });
      }

      // ── POST /fuel-tanks/:id/adjust — Manual quantity adjustment ──
      // Audit trail: one row in fuel_transactions (type 'adjustment') + one row in
      // fuel_flags (flag_type 'tank_adjustment', shown on the Fuel Alerts tab).
      const tankAdjustMatch = path.match(/^\/fuel-tanks\/([^/]+)\/adjust$/);
      if (tankAdjustMatch && method === "POST") {
        if (!await requirePermission(session, PERM.FUEL_EDIT, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const tankId = tankAdjustMatch[1];
        const body = await request.json();
        const { adjustment_amount, reason, person, notes } = body;

        if (adjustment_amount === undefined || adjustment_amount === null) {
          return json({ success: false, error: "adjustment_amount is required (positive for overage, negative for shortage)" }, 400);
        }
        const adjAmt = parseFloat(adjustment_amount);
        if (isNaN(adjAmt) || adjAmt === 0) {
          return json({ success: false, error: "adjustment_amount must be a non-zero number" }, 400);
        }
        if (!reason || !reason.trim()) {
          return json({ success: false, error: "reason is required for all adjustments" }, 400);
        }

        const tank = await env.DB.prepare("SELECT * FROM fuel_tanks WHERE id = ? AND org_id = ?").bind(tankId, org_id).first();
        if (!tank) return json({ success: false, error: "Tank not found" }, 404);
        if (tank.status === "inactive") return json({ success: false, error: "Cannot adjust an inactive tank" }, 400);

        const orgUnit = await getOrgVolumeUnit(env, org_id);
        const u = orgUnit.abbr;
        const cleanNotes = (notes && String(notes).trim()) || "";

        const previousQty = tank.current_quantity || 0;
        const newQty = Math.round((previousQty + adjAmt) * 1000) / 1000;
        if (newQty < 0) {
          return json({ success: false, error: "Adjustment would result in negative quantity (" + newQty + " " + u + "). Current: " + previousQty + ", adjustment: " + adjAmt }, 400);
        }
        if (tank.capacity > 0 && newQty > tank.capacity) {
          return json({ success: false, error: "Adjustment would exceed tank capacity (" + tank.capacity + " " + u + "). New quantity would be: " + newQty }, 400);
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const personName = person || session.email;
        const txNotes = "ADJUSTMENT: " + (adjAmt > 0 ? "+" : "-") + Math.abs(adjAmt) + " " + u + " — " + reason.trim() + " (prev: " + previousQty + " → new: " + newQty + ")" + (cleanNotes ? " | Notes: " + cleanNotes : "");

        const batchStatements = [
          env.DB.prepare(
            "UPDATE fuel_tanks SET current_quantity = ?, updated_at = ? WHERE id = ? AND org_id = ?"
          ).bind(newQty, now, tankId, org_id),
          env.DB.prepare(
            "INSERT INTO fuel_transactions (id, org_id, transaction_type, fuel_type, quantity, from_entity_type, from_entity_id, to_entity_type, to_entity_id, person, location, transaction_date, notes, created_at) VALUES (?, ?, 'adjustment', ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?)"
          ).bind(id, org_id, tank.fuel_type || null, Math.abs(adjAmt), personName, tank.location || null, now, txNotes, now)
        ];

        await env.DB.batch(batchStatements);

        try {
          const flagId = crypto.randomUUID();
          const severity = Math.abs(adjAmt) > (tank.capacity || 100) * 0.1 ? "warning" : "info";
          const message = "Tank adjustment: " + tank.name + " " + (adjAmt > 0 ? "+" : "") + adjAmt + " " + u + " (prev: " + previousQty + " → new: " + newQty + "). Reason: " + reason.trim() + (cleanNotes ? ". Notes: " + cleanNotes : "");
          await env.DB.prepare(
            "INSERT INTO fuel_flags (id, org_id, asset_id, tank_id, transaction_id, flag_type, message, severity, status, details, created_at) VALUES (?, ?, NULL, ?, ?, 'tank_adjustment', ?, ?, 'open', ?, ?)"
          ).bind(flagId, org_id, tankId, id, message, severity, JSON.stringify({ tank_name: tank.name, previous_quantity: previousQty, new_quantity: newQty, adjustment_amount: adjAmt, unit: orgUnit.name, reason: reason.trim(), notes: cleanNotes || null, person: personName }), now).run();
        } catch (flagErr) {
          console.error("Adjustment flag creation error:", flagErr.message);
          await logError(env, "Fuel worker (adjustment flag)", flagErr, request);
        }

        return json({
          success: true,
          adjustment: {
            id, tank_id: tankId, tank_name: tank.name,
            previous_quantity: previousQty, adjustment_amount: adjAmt,
            new_quantity: newQty, unit: orgUnit.name, reason: reason.trim(),
            notes: cleanNotes || null,
            person: personName, created_at: now
          }
        }, 201);
      }

      // ════════════════════════════════════════
      // FUEL TRANSACTIONS
      // ════════════════════════════════════════

      // ── GET /fuel-transactions — List ──
      if (path === "/fuel-transactions" && method === "GET") {
        if (!await requirePermission(session, PERM.FUEL_VIEW, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const assetId = url.searchParams.get("asset_id");
        const projectId = url.searchParams.get("project_id");
        const txType = url.searchParams.get("type");
        const fromDate = url.searchParams.get("from");
        const toDate = url.searchParams.get("to");
        let query = "SELECT ft.*, a.asset_number, a.name AS asset_name, p.name AS project_name FROM fuel_transactions ft LEFT JOIN assets a ON ft.asset_id = a.id LEFT JOIN projects p ON ft.project_id = p.id WHERE ft.org_id = ?";
        const bindings = [org_id];
        if (assetId) { query += " AND ft.asset_id = ?"; bindings.push(assetId); }
        if (projectId) { query += " AND ft.project_id = ?"; bindings.push(projectId); }
        if (txType) { query += " AND ft.transaction_type = ?"; bindings.push(txType); }
        if (fromDate) { query += " AND ft.transaction_date >= ?"; bindings.push(fromDate); }
        if (toDate) { query += " AND ft.transaction_date <= ?"; bindings.push(toDate); }
        query += " ORDER BY ft.transaction_date DESC LIMIT 200";
        const result = await env.DB.prepare(query).bind(...bindings).all();
        return json({ success: true, transactions: result.results });
      }

      // ── POST /fuel-transactions — Create (atomic tank update) ──
      if (path === "/fuel-transactions" && method === "POST") {
        if (!await requirePermission(session, PERM.FUEL_ADD, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const body = await request.json();
        const { transaction_type, fuel_type, quantity, from_entity_type, from_entity_id, to_entity_type, to_entity_id, asset_id, project_id, person, location, receipt_r2_key, receipt_url, transaction_date, notes, cost_per_gallon, total_cost, vendor, device_location } = body;

        if (!transaction_type) return json({ success: false, error: "transaction_type is required" }, 400);
        if (!quantity || quantity <= 0) return json({ success: false, error: "quantity must be > 0" }, 400);
        if (!transaction_date) return json({ success: false, error: "transaction_date is required" }, 400);

        const txDef = TX_TYPES[transaction_type];
        if (!txDef) return json({ success: false, error: `Invalid transaction_type. Valid: ${Object.keys(TX_TYPES).join(", ")}` }, 400);

        if (from_entity_type && !txDef.from.includes(from_entity_type)) {
          return json({ success: false, error: `from_entity_type "${from_entity_type}" not valid for ${transaction_type}. Valid: ${txDef.from.join(", ")}` }, 400);
        }
        if (to_entity_type && !txDef.to.includes(to_entity_type)) {
          return json({ success: false, error: `to_entity_type "${to_entity_type}" not valid for ${transaction_type}. Valid: ${txDef.to.join(", ")}` }, 400);
        }

        if (asset_id) {
          const asset = await env.DB.prepare("SELECT id FROM assets WHERE id = ? AND org_id = ?").bind(asset_id, org_id).first();
          if (!asset) return json({ success: false, error: "Asset not found" }, 404);
        }

        if (project_id) {
          const project = await env.DB.prepare("SELECT id FROM projects WHERE id = ? AND org_id = ?").bind(project_id, org_id).first();
          if (!project) return json({ success: false, error: "Project not found" }, 404);
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const batchStatements = [];

        batchStatements.push(
          env.DB.prepare(
            "INSERT INTO fuel_transactions (id, org_id, transaction_type, fuel_type, quantity, from_entity_type, from_entity_id, to_entity_type, to_entity_id, asset_id, project_id, person, location, receipt_r2_key, receipt_url, transaction_date, notes, created_at, cost_per_gallon, total_cost, vendor, device_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(id, org_id, transaction_type, fuel_type || null, quantity, from_entity_type || null, from_entity_id || null, to_entity_type || null, to_entity_id || null, asset_id || null, project_id || null, person || session.email, location || null, receipt_r2_key || null, receipt_url || null, transaction_date, notes || null, now, cost_per_gallon || null, total_cost || null, vendor || null, device_location ? JSON.stringify(device_location) : null)
        );

        if (from_entity_type && from_entity_type.endsWith("_tank") && from_entity_id) {
          const tank = await env.DB.prepare("SELECT * FROM fuel_tanks WHERE id = ? AND org_id = ?").bind(from_entity_id, org_id).first();
          if (!tank) return json({ success: false, error: "Source tank not found" }, 404);
          if (tank.current_quantity < quantity) {
            return json({ success: false, error: `Insufficient fuel in tank "${tank.name}". Current: ${tank.current_quantity}, requested: ${quantity}` }, 400);
          }
          batchStatements.push(
            env.DB.prepare("UPDATE fuel_tanks SET current_quantity = current_quantity - ?, updated_at = ? WHERE id = ? AND org_id = ?")
              .bind(quantity, now, from_entity_id, org_id)
          );
        }

        if (to_entity_type && to_entity_type.endsWith("_tank") && to_entity_id) {
          const tank = await env.DB.prepare("SELECT * FROM fuel_tanks WHERE id = ? AND org_id = ?").bind(to_entity_id, org_id).first();
          if (!tank) return json({ success: false, error: "Destination tank not found" }, 404);
          if (tank.capacity > 0 && (tank.current_quantity + quantity) > tank.capacity) {
            return json({ success: false, error: `Destination tank "${tank.name}" would overflow. Capacity: ${tank.capacity}, current: ${tank.current_quantity}, adding: ${quantity}` }, 400);
          }
          batchStatements.push(
            env.DB.prepare("UPDATE fuel_tanks SET current_quantity = current_quantity + ?, updated_at = ? WHERE id = ? AND org_id = ?")
              .bind(quantity, now, to_entity_id, org_id)
          );
        }

        if (asset_id) {
          const fueledAsset = await env.DB.prepare("SELECT current_meter_reading FROM assets WHERE id = ? AND org_id = ?").bind(asset_id, org_id).first();
          const reading = (fueledAsset && fueledAsset.current_meter_reading != null) ? fueledAsset.current_meter_reading : 0;
          batchStatements.push(
            env.DB.prepare(
              "INSERT INTO asset_meter_history (id, org_id, asset_id, reading, source, recorded_by, recorded_at) VALUES (?, ?, ?, ?, 'fuel', ?, ?)"
            ).bind(crypto.randomUUID(), org_id, asset_id, reading, session.email, now)
          );
        }

        await env.DB.batch(batchStatements);

        // ════════════════════════════════════════════════════════════
        // PHASE 6A — FUEL FLAGS
        // ════════════════════════════════════════════════════════════
        const flags = [];
        try {
          const orgUnit = await getOrgVolumeUnit(env, org_id);
          const u = orgUnit.abbr;

          if (asset_id && (to_entity_type === "asset" || (transaction_type.endsWith("_issue") && to_entity_type === "asset"))) {
            const asset = await env.DB.prepare(
              "SELECT id, asset_number, name, fuel_tank_capacity, fuel_consumption_rate, current_meter_reading FROM assets WHERE id = ? AND org_id = ?"
            ).bind(asset_id, org_id).first();

            if (asset && asset.fuel_tank_capacity && asset.fuel_tank_capacity > 0) {
              const tolerance = asset.fuel_tank_capacity * 0.05;
              if (quantity > asset.fuel_tank_capacity + tolerance) {
                const flagId = crypto.randomUUID();
                const message = `Fuel quantity ${quantity} ${u} exceeds tank capacity ${asset.fuel_tank_capacity} ${u} (+5% tolerance) for asset "${asset.asset_number || asset.name}"`;
                await env.DB.prepare(
                  "INSERT INTO fuel_flags (id, org_id, asset_id, tank_id, transaction_id, flag_type, message, severity, status, details, created_at) VALUES (?, ?, ?, ?, ?, 'capacity_exceeded', ?, 'critical', 'open', ?, ?)"
                ).bind(flagId, org_id, asset_id, null, id, message, JSON.stringify({ capacity: asset.fuel_tank_capacity, quantity, tolerance, unit: orgUnit.name, asset_number: asset.asset_number, asset_name: asset.name }), now).run();
                flags.push({ id: flagId, flag_type: "capacity_exceeded", message, severity: "critical" });
              }
            }

            if (asset && asset.fuel_consumption_rate && asset.fuel_consumption_rate > 0) {
              const prevMeter = await env.DB.prepare(
                "SELECT reading, recorded_at FROM asset_meter_history WHERE asset_id = ? AND org_id = ? AND recorded_at <= ? ORDER BY recorded_at DESC LIMIT 1"
              ).bind(asset_id, org_id, transaction_date).first();
              const curMeter = asset.current_meter_reading;

              if (prevMeter && curMeter != null && curMeter >= prevMeter.reading) {
                const hoursWorked = (curMeter - prevMeter.reading);
                if (hoursWorked > 0) {
                  const expected = asset.fuel_consumption_rate * hoursWorked;
                  const tolerance = expected * 0.5;
                  if (quantity > expected + tolerance) {
                    const flagId = crypto.randomUUID();
                    const message = `Fuel quantity ${quantity} ${u} is ${Math.round((quantity / expected) * 100)}% of expected consumption (${expected.toFixed(1)} ${u} over ${hoursWorked} hours at ${asset.fuel_consumption_rate} ${u}/hr) for asset "${asset.asset_number || asset.name}"`;
                    await env.DB.prepare(
                      "INSERT INTO fuel_flags (id, org_id, asset_id, tank_id, transaction_id, flag_type, message, severity, status, details, created_at) VALUES (?, ?, ?, ?, ?, 'consumption_anomaly', ?, 'warning', 'open', ?, ?)"
                    ).bind(flagId, org_id, asset_id, null, id, message, JSON.stringify({ consumption_rate: asset.fuel_consumption_rate, hours_worked: hoursWorked, expected, actual: quantity, tolerance, unit: orgUnit.name }), now).run();
                    flags.push({ id: flagId, flag_type: "consumption_anomaly", message, severity: "warning" });
                  }
                }
              }
            }
          }

          if (to_entity_type && to_entity_type.endsWith("_tank") && to_entity_id) {
            const destTank = await env.DB.prepare(
              "SELECT id, name, tank_type, ownership_type, owner_name FROM fuel_tanks WHERE id = ? AND org_id = ?"
            ).bind(to_entity_id, org_id).first();
            if (destTank && destTank.ownership_type === "employee") {
              const flagId = crypto.randomUUID();
              const message = `Company fuel (${quantity} ${u}) added to employee-owned ${destTank.tank_type} tank "${destTank.name}"${destTank.owner_name ? " (" + destTank.owner_name + ")" : ""}`;
              await env.DB.prepare(
                "INSERT INTO fuel_flags (id, org_id, asset_id, tank_id, transaction_id, flag_type, message, severity, status, details, created_at) VALUES (?, ?, ?, ?, ?, 'employee_tank_fill', ?, 'info', 'open', ?, ?)"
              ).bind(flagId, org_id, null, to_entity_id, id, message, JSON.stringify({ tank_name: destTank.name, tank_type: destTank.tank_type, owner_name: destTank.owner_name, quantity, unit: orgUnit.name }), now).run();
              flags.push({ id: flagId, flag_type: "employee_tank_fill", message, severity: "info" });
            }
          }

          if (flags.length > 0) {
            const settings = await env.DB.prepare("SELECT * FROM org_settings WHERE org_id = ?").bind(org_id).first();
            const shouldEmail = settings && (
              (settings.notify_capacity_flags_email && flags.some(f => f.flag_type === "capacity_exceeded")) ||
              (settings.notify_consumption_flags_email && flags.some(f => f.flag_type === "consumption_anomaly")) ||
              (settings.notify_employee_tank_flags_email && flags.some(f => f.flag_type === "employee_tank_fill"))
            );
            if (shouldEmail && env.RESEND_API_KEY) {
              const flagList = flags.map(f => `<li><strong>${f.flag_type}</strong> — ${f.message}</li>`).join("");
              await sendEmail(env, session.email,
                "DRIV-EN Fuel Alert: " + flags.map(f => f.flag_type).join(", "),
                "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222;\">" +
                "<h2 style=\"color:#cc0000;\">Fuel Flag(s) Raised</h2>" +
                "<p>Transaction: " + id + "</p>" +
                "<ul>" + flagList + "</ul>" +
                "<p>Review and resolve in the DRIV-EN dashboard → Fuel Alerts.</p>" +
                "</div>"
              );
            }
          }
        } catch (flagErr) {
          console.error("Fuel flag creation error:", flagErr.message);
          await logError(env, "Fuel worker (flag creation)", flagErr, request);
        }

        return json({
          success: true,
          transaction: {
            id, org_id, transaction_type, fuel_type, quantity,
            from_entity_type, from_entity_id, to_entity_type, to_entity_id,
            asset_id, project_id, person: person || session.email,
            location, transaction_date, notes,
            cost_per_gallon, total_cost, vendor,
          },
          flags: flags,
        }, 201);
      }

      // ── GET /fuel-transactions/:id — Single transaction ──
      const txMatch = path.match(/^\/fuel-transactions\/([^/]+)$/);
      if (txMatch && method === "GET") {
        if (!await requirePermission(session, PERM.FUEL_VIEW, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const txId = txMatch[1];
        const tx = await env.DB.prepare(
          "SELECT ft.*, a.asset_number, a.name AS asset_name, p.name AS project_name FROM fuel_transactions ft LEFT JOIN assets a ON ft.asset_id = a.id LEFT JOIN projects p ON ft.project_id = p.id WHERE ft.id = ? AND ft.org_id = ?"
        ).bind(txId, org_id).first();
        if (!tx) return json({ success: false, error: "Transaction not found" }, 404);
        return json({ success: true, transaction: tx });
      }

      // ════════════════════════════════════════
      // FUEL PURCHASES (multi-line: multiple fuel types + destinations)
      // ════════════════════════════════════════

      // ── POST /fuel-purchases — Create multi-line purchase ──
      if (path === "/fuel-purchases" && method === "POST") {
        if (!await requirePermission(session, PERM.FUEL_ADD, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const body = await request.json();
        const { vendor, purchase_date, location, person, notes, receipt_r2_key, receipt_total, receipt_items, po_number, line_items, manager_review_flags, device_location } = body;

        if (!purchase_date) return json({ success: false, error: "purchase_date is required" }, 400);
        if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
          return json({ success: false, error: "line_items array is required (at least 1 line)" }, 400);
        }

        for (let i = 0; i < line_items.length; i++) {
          const li = line_items[i];
          if (!li.quantity || li.quantity <= 0) {
            return json({ success: false, error: "Line " + (i + 1) + ": quantity must be > 0" }, 400);
          }
          if (!li.to_entity_type || !li.to_entity_id) {
            if (!li.custom_asset_name) {
              return json({ success: false, error: "Line " + (i + 1) + ": to_entity_type and to_entity_id are required (or provide custom_asset_name)" }, 400);
            }
          }
        }

        const purchaseId = crypto.randomUUID();
        const now = new Date().toISOString();
        const personName = person || session.email;

        let totalCost = 0;
        const batchStatements = [];

        for (let i = 0; i < line_items.length; i++) {
          const li = line_items[i];
          if (li.cost_per_gallon && li.quantity) {
            totalCost += li.cost_per_gallon * li.quantity;
          } else if (li.total_cost) {
            totalCost += li.total_cost;
          }
        }

        batchStatements.push(
          env.DB.prepare(
            "INSERT INTO fuel_purchases (id, org_id, vendor, purchase_date, location, person, total_cost, receipt_r2_key, receipt_total, receipt_items, po_number, notes, created_at, device_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(purchaseId, org_id, vendor || null, purchase_date, location || null, personName, totalCost || 0, receipt_r2_key || null, receipt_total || null, receipt_items || null, po_number || null, notes || null, now, device_location ? JSON.stringify(device_location) : null)
        );

        const createdTransactions = [];
        for (let i = 0; i < line_items.length; i++) {
          const li = line_items[i];
          const txId = crypto.randomUUID();
          const lineCost = li.cost_per_gallon ? (li.cost_per_gallon * li.quantity) : (li.total_cost || null);

          if (li.to_entity_type && li.to_entity_type.endsWith("_tank") && li.to_entity_id) {
            const tank = await env.DB.prepare("SELECT * FROM fuel_tanks WHERE id = ? AND org_id = ?").bind(li.to_entity_id, org_id).first();
            if (!tank) return json({ success: false, error: "Line " + (i + 1) + ": destination tank not found" }, 404);
            if (tank.status === "inactive") return json({ success: false, error: "Line " + (i + 1) + ": destination tank is inactive" }, 400);
            if (tank.capacity > 0 && (tank.current_quantity + li.quantity) > tank.capacity) {
              return json({ success: false, error: "Line " + (i + 1) + ": tank \"" + tank.name + "\" would overflow. Capacity: " + tank.capacity + ", current: " + tank.current_quantity + ", adding: " + li.quantity }, 400);
            }
            batchStatements.push(
              env.DB.prepare("UPDATE fuel_tanks SET current_quantity = current_quantity + ?, updated_at = ? WHERE id = ? AND org_id = ?")
                .bind(li.quantity, now, li.to_entity_id, org_id)
            );
          }

          if (li.asset_id) {
            const asset = await env.DB.prepare("SELECT id FROM assets WHERE id = ? AND org_id = ?").bind(li.asset_id, org_id).first();
            if (!asset) return json({ success: false, error: "Line " + (i + 1) + ": asset not found" }, 404);
          }

          var txNotes = notes || null;
          if (li.project_name && !li.project_id) {
            txNotes = (txNotes ? txNotes + " | " : "") + "NEW PROJECT (pending manager review): " + li.project_name;
          }
          batchStatements.push(
            env.DB.prepare(
              "INSERT INTO fuel_transactions (id, org_id, transaction_type, fuel_type, quantity, from_entity_type, from_entity_id, to_entity_type, to_entity_id, asset_id, project_id, person, location, transaction_date, notes, created_at, cost_per_gallon, total_cost, vendor, purchase_id, device_location) VALUES (?, ?, 'purchase', ?, ?, 'vendor', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(txId, org_id, li.fuel_type || null, li.quantity, li.to_entity_type, li.to_entity_id, li.asset_id || null, li.project_id || null, personName, location || null, purchase_date, txNotes, now, li.cost_per_gallon || null, lineCost, vendor || null, purchaseId, device_location ? JSON.stringify(device_location) : null)
          );

          createdTransactions.push({
            id: txId, fuel_type: li.fuel_type, quantity: li.quantity,
            to_entity_type: li.to_entity_type, to_entity_id: li.to_entity_id,
            asset_id: li.asset_id || null, cost_per_gallon: li.cost_per_gallon || null,
            total_cost: lineCost
          });
        }

        await env.DB.batch(batchStatements);

        const createdFlags = [];
        if (Array.isArray(manager_review_flags) && manager_review_flags.length > 0) {
          for (const flag of manager_review_flags) {
            try {
              const flagId = crypto.randomUUID();
              const fieldLabel = flag.field === "location" ? "Location" : (flag.field === "fuel_type" ? "Fuel type" : (flag.field === "project" ? "Project" : (flag.field === "asset" ? "Asset" : (flag.field === "receipt_items" ? "Receipt items" : (flag.field || "Field")))));
              const lineLabel = flag.line ? " (line " + flag.line + ")" : "";
              const message = "Manager review: " + fieldLabel + lineLabel + " = \"" + (flag.value || "") + "\" — " + (flag.reason || "custom entry");
              await env.DB.prepare(
                "INSERT INTO fuel_flags (id, org_id, asset_id, tank_id, transaction_id, flag_type, message, severity, status, details, created_at) VALUES (?, ?, NULL, NULL, NULL, 'manager_review', ?, 'info', 'open', ?, ?)"
              ).bind(flagId, org_id, message, JSON.stringify({ purchase_id: purchaseId, field: flag.field, line: flag.line || null, value: flag.value || null, reason: flag.reason || null, person: personName, user_id: session.user_id || null, user_email: session.email }), now).run();
              createdFlags.push({ id: flagId, flag_type: "manager_review", message, severity: "info" });
            } catch (flagErr) {
              console.error("Manager review flag creation error:", flagErr.message);
              await logError(env, "Fuel worker (manager review flag)", flagErr, request);
            }
          }
        }

        return json({
          success: true,
          purchase: {
            id: purchaseId, org_id, vendor, purchase_date, location,
            person: personName, total_cost: totalCost, receipt_r2_key: receipt_r2_key || null,
            receipt_total: receipt_total || null,
            notes, line_items: createdTransactions
          },
          flags: createdFlags
        }, 201);
      }

      // ── GET /fuel-purchases — List purchases ──
      if (path === "/fuel-purchases" && method === "GET") {
        if (!await requirePermission(session, PERM.FUEL_VIEW, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const result = await env.DB.prepare(
          "SELECT * FROM fuel_purchases WHERE org_id = ? ORDER BY purchase_date DESC LIMIT 100"
        ).bind(org_id).all();
        return json({ success: true, purchases: result.results });
      }

      // ── GET /fuel-purchases/:id — Single purchase with line items ──
      const purchaseMatch = path.match(/^\/fuel-purchases\/([^/]+)$/);
      if (purchaseMatch && method === "GET") {
        if (!await requirePermission(session, PERM.FUEL_VIEW, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const purchaseId = purchaseMatch[1];
        const purchase = await env.DB.prepare(
          "SELECT * FROM fuel_purchases WHERE id = ? AND org_id = ?"
        ).bind(purchaseId, org_id).first();
        if (!purchase) return json({ success: false, error: "Purchase not found" }, 404);

        const lineItems = await env.DB.prepare(
          "SELECT ft.*, a.asset_number, a.name AS asset_name FROM fuel_transactions ft LEFT JOIN assets a ON ft.asset_id = a.id WHERE ft.purchase_id = ? AND ft.org_id = ? ORDER BY ft.created_at ASC"
        ).bind(purchaseId, org_id).all();

        const flags = await env.DB.prepare(
          "SELECT * FROM fuel_flags WHERE details LIKE ? AND org_id = ? ORDER BY created_at ASC"
        ).bind('%"purchase_id":"' + purchaseId + '"%', org_id).all();

        return json({ success: true, purchase, line_items: lineItems.results, flags: flags.results });
      }

      // ════════════════════════════════════════
      // FUEL RECEIPTS (upload to R2 + AI extraction)
      // ════════════════════════════════════════

      // ── POST /fuel-receipts/upload — Upload receipt photo to R2 ──
      if (path === "/fuel-receipts/upload" && method === "POST") {
        if (!await requirePermission(session, PERM.FUEL_ADD, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const contentType = request.headers.get("Content-Type") || "";
        if (!contentType.includes("multipart/form-data")) {
          return json({ success: false, error: "multipart/form-data required (got: " + contentType.substring(0, 100) + ")" }, 400);
        }
        const formData = await request.formData();
        const file = formData.get("file");
        const fuelTransactionId = formData.get("fuel_transaction_id");
        if (!file) return json({ success: false, error: "file is required" }, 400);

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const ext = (typeof file === 'object' && file.name) ? file.name.split(".").pop() : "jpg";
        const r2Key = `${org_id}/receipts/${id}.${ext}`;

        await env.DRIVEN_DATA.put(r2Key, file, {
          customMetadata: { org_id, uploaded_by: session.email, fuel_transaction_id: fuelTransactionId || "" }
        });

        await env.DB.prepare(
          "INSERT INTO fuel_receipts (id, org_id, fuel_transaction_id, r2_key, extraction_status, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)"
        ).bind(id, org_id, fuelTransactionId || null, r2Key, session.email, now).run();

        return json({ success: true, receipt: { id, r2_key: r2Key, fuel_transaction_id: fuelTransactionId || null, extraction_status: "pending" } }, 201);
      }

      // ── POST /fuel-receipts/extract — Upload receipt (image or PDF) + AI extraction ──
      if (path === "/fuel-receipts/extract" && method === "POST") {
        if (!await requirePermission(session, PERM.FUEL_ADD, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const contentType = request.headers.get("Content-Type") || "";

        let fileBytes, fileName, fileType, imageDataUrl;

        if (contentType.includes("application/json")) {
          const body = await request.json();
          if (!body.file) return json({ success: false, error: "file is required" }, 400);

          imageDataUrl = body.file;
          const matches = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) {
            return json({ success: false, error: "Invalid data URL format" }, 400);
          }
          fileType = body.fileType || matches[1] || "image/jpeg";
          fileName = body.fileName || "receipt.jpg";
          const base64Data = matches[2];
          const binaryString = atob(base64Data);
          fileBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            fileBytes[i] = binaryString.charCodeAt(i);
          }
        } else if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          const file = formData.get("file");
          if (!file) return json({ success: false, error: "file is required" }, 400);
          fileType = (typeof file === 'object' && file.type) ? file.type : "";
          fileName = (typeof file === 'object' && file.name) ? file.name : "receipt.jpg";
          if (file instanceof Blob) {
            fileBytes = new Uint8Array(await file.arrayBuffer());
          } else if (typeof file === 'string') {
            fileBytes = new TextEncoder().encode(file);
          } else {
            fileBytes = new Uint8Array(await file.arrayBuffer());
          }
        } else {
          return json({ success: false, error: "Content-Type must be application/json or multipart/form-data (got: " + contentType.substring(0, 100) + ")" }, 400);
        }

        const fn = (fileName || "").toLowerCase();
        let isImage = (fileType || "").startsWith("image/") ||
          /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(fn);
        let isPdf = fileType === "application/pdf" || fn.endsWith(".pdf");
        if (!isImage && !isPdf) {
          isImage = true;
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const ext = isPdf ? "pdf" : ((fileName && fileName.includes(".")) ? fileName.split(".").pop() : "jpg");
        const r2Key = org_id + "/receipts/" + id + "." + ext;

        await env.DRIVEN_DATA.put(r2Key, fileBytes, {
          customMetadata: { org_id, uploaded_by: session.email, type: "receipt_extraction", file_type: isPdf ? "pdf" : "image" }
        });

        await env.DB.prepare(
          "INSERT INTO fuel_receipts (id, org_id, fuel_transaction_id, r2_key, extraction_status, uploaded_by, uploaded_at) VALUES (?, ?, NULL, ?, 'processing', ?, ?)"
        ).bind(id, org_id, r2Key, session.email, now).run();

        try {
          let extracted = {};
          let aiElapsed = 0;

          if (isImage) {
            const imageByteLen = fileBytes.length;
            console.log("RECEIPT IMAGE SIZE: " + imageByteLen + " bytes (" + Math.round(imageByteLen / 1024) + "KB)");

            const MAX_DIRECT_BYTES = 500_000;
            if (imageByteLen > MAX_DIRECT_BYTES) {
              await env.DB.prepare(
                "UPDATE fuel_receipts SET extraction_status = 'failed', updated_at = ? WHERE id = ? AND org_id = ?"
              ).bind(now, id, org_id).run();
              return json({
                success: false,
                error: "Image is too large (" + Math.round(imageByteLen / 1024) + "KB). Max size is " + Math.round(MAX_DIRECT_BYTES / 1024) + "KB. Please crop the receipt to show only the text area, then try again.",
                code: "IMAGE_TOO_LARGE",
                receipt_id: id
              }, 400);
            }

            let aiImageData = imageDataUrl;
            if (!aiImageData) {
              let binary = "";
              for (let i = 0; i < fileBytes.length; i++) {
                binary += String.fromCharCode(fileBytes[i]);
              }
              aiImageData = "data:" + (fileType || "image/jpeg") + ";base64," + btoa(binary);
            }

            const aiStart = Date.now();
            const MAX_AI_RETRIES = 3;
            let aiResponse = null;
            let aiError = null;
            for (let attempt = 1; attempt <= MAX_AI_RETRIES; attempt++) {
              try {
                aiResponse = await env.AI.run(
                  "@cf/meta/llama-3.2-11b-vision-instruct",
                  {
                    messages: [
                      { role: "system", content: "You are a receipt data extraction assistant. Return only valid JSON, no markdown, no explanation." },
                      { role: "user", content: RECEIPT_PROMPT },
                    ],
                    image: aiImageData,
                  }
                );
                aiError = null;
                break;
              } catch (e) {
                aiError = e;
                console.log("AI attempt " + attempt + " failed: " + e.message);
                if (attempt < MAX_AI_RETRIES) {
                  const delayMs = 1000 * Math.pow(2, attempt - 1);
                  await new Promise(r => setTimeout(r, delayMs));
                }
              }
            }
            if (aiError) {
              await logError(env, "Fuel worker (receipt extraction)", aiError, request);
              return json({
                success: false,
                error: "Receipt extraction failed: " + aiError.message + (MAX_AI_RETRIES > 1 ? " (after " + MAX_AI_RETRIES + " attempts)" : ""),
              }, 500);
            }
            aiElapsed = Date.now() - aiStart;

            console.log("RECEIPT AI RESPONSE TYPE: " + typeof aiResponse);
            if (typeof aiResponse === "object" && aiResponse) {
              console.log("RECEIPT AI RESPONSE KEYS: " + Object.keys(aiResponse).join(", "));
              var respSnippet = aiResponse.response || aiResponse.result || "";
              console.log("RECEIPT AI RESPONSE SNIPPET: " + JSON.stringify(respSnippet).substring(0, 500));
            } else {
              console.log("RECEIPT AI RESPONSE SNIPPET: " + String(aiResponse).substring(0, 500));
            }

            let parsed = aiResponse;
            if (typeof aiResponse === "string") {
              parsed = _extractJSON(aiResponse);
            }
            if (parsed && parsed.response) {
              if (typeof parsed.response === "string") {
                parsed = _extractJSON(parsed.response);
              } else if (Array.isArray(parsed.response) && parsed.response.length > 0) {
                var firstItem = parsed.response[0];
                if (firstItem && typeof firstItem.content === "string") {
                  parsed = _extractJSON(firstItem.content);
                } else if (typeof firstItem === "string") {
                  parsed = _extractJSON(firstItem);
                }
              } else if (typeof parsed.response === "object" && parsed.response !== null) {
                if (parsed.response.vendor || parsed.response.line_items || parsed.response.total_amount) {
                  parsed = parsed.response;
                } else if (typeof parsed.response.content === "string") {
                  parsed = _extractJSON(parsed.response.content);
                } else {
                  parsed = _extractJSON(JSON.stringify(parsed.response));
                }
              }
            }
            if (parsed && parsed.result && typeof parsed.result === "string") {
              parsed = _extractJSON(parsed.result);
            }
            if (parsed && parsed.result && parsed.result.response && typeof parsed.result.response === "string") {
              parsed = _extractJSON(parsed.result.response);
            }
            extracted = parsed || {};

            console.log("RECEIPT PARSED KEYS: " + (parsed ? Object.keys(parsed).join(", ") : "null"));
            console.log("RECEIPT EXTRACTED VENDOR: " + (extracted.vendor || "NONE"));

            if (!extracted.vendor && !extracted.line_items && !extracted.total_amount) {
              console.log("RECEIPT: Standard parsing found no data, searching recursively...");
              var found = _findReceiptData(aiResponse);
              if (found) {
                console.log("RECEIPT: Found data via recursive search! vendor=" + (found.vendor || "NONE"));
                extracted = found;
              }
            }

          } else if (isPdf) {
            const pdfBuffer = fileBytes.buffer;

            const aiStart = Date.now();
            const mdResult = await env.AI.toMarkdown([
              {
                name: fileName || "receipt.pdf",
                blob: new Blob([pdfBuffer], { type: "application/pdf" }),
              },
            ]);
            aiElapsed = Date.now() - aiStart;

            let pdfText = "";
            if (Array.isArray(mdResult)) {
              pdfText = mdResult.map(function(r) { return r.text || r.markdown || ""; }).join("\n\n");
            } else if (mdResult && typeof mdResult === "object") {
              pdfText = mdResult.text || mdResult.markdown || JSON.stringify(mdResult);
            } else if (typeof mdResult === "string") {
              pdfText = mdResult;
            }

            if (!pdfText || pdfText.trim().length === 0) {
              throw new Error("PDF text extraction returned empty content — the PDF may be scanned images without OCR");
            }

            const textAiStart = Date.now();
            const textAiResponse = await env.AI.run(
              "@cf/meta/llama-3.1-8b-instruct",
              {
                messages: [
                  { role: "system", content: "You are a receipt data extraction assistant. Return only valid JSON." },
                  { role: "user", content: RECEIPT_TEXT_PROMPT + "\n\n--- RECEIPT TEXT ---\n" + pdfText.substring(0, 8000) },
                ],
                response_format: { type: "json_object" },
              }
            );
            aiElapsed += Date.now() - textAiStart;

            let parsed = textAiResponse;
            if (typeof textAiResponse === "string") {
              parsed = _extractJSON(textAiResponse);
            }
            if (parsed && parsed.response && typeof parsed.response === "string") {
              parsed = _extractJSON(parsed.response);
            }
            if (parsed && parsed.result && typeof parsed.result === "string") {
              parsed = _extractJSON(parsed.result);
            }
            extracted = parsed || {};
          }

          const confidence = typeof extracted.confidence === "number" ? extracted.confidence : 0.5;
          const lowConfidence = Array.isArray(extracted.low_confidence_fields) ? extracted.low_confidence_fields : [];

          await env.DB.prepare(
            "UPDATE fuel_receipts SET extraction_status = 'extracted', extracted_data = ?, vendor = ?, receipt_date = ?, total_amount = ?, updated_at = ? WHERE id = ? AND org_id = ?"
          ).bind(
            JSON.stringify(extracted),
            extracted.vendor || null,
            extracted.receipt_date || null,
            extracted.total_amount || null,
            now, id, org_id
          ).run();

          return json({
            success: true,
            receipt: { id, r2_key: r2Key, extraction_status: "extracted", file_type: isPdf ? "pdf" : "image" },
            extracted: {
              vendor: extracted.vendor || null,
              receipt_date: extracted.receipt_date || null,
              line_items: extracted.line_items || [],
              total_amount: extracted.total_amount || null,
              confidence: confidence,
              low_confidence_fields: lowConfidence,
            },
            processing_time_ms: aiElapsed,
          });
        } catch (extractErr) {
          await env.DB.prepare(
            "UPDATE fuel_receipts SET extraction_status = 'failed', updated_at = ? WHERE id = ? AND org_id = ?"
          ).bind(now, id, org_id).run();

          await logError(env, "Fuel worker (receipt extraction)", extractErr, request);
          return json({ success: false, error: "Receipt extraction failed: " + extractErr.message, receipt_id: id }, 500);
        }
      }

      // ── GET /fuel-receipts — List ──
      if (path === "/fuel-receipts" && method === "GET") {
        if (!await requirePermission(session, PERM.FUEL_VIEW, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const result = await env.DB.prepare(
          "SELECT * FROM fuel_receipts WHERE org_id = ? ORDER BY uploaded_at DESC LIMIT 100"
        ).bind(org_id).all();
        return json({ success: true, receipts: result.results });
      }

      // ── GET /fuel-receipts/:id — Single receipt ──
      const receiptMatch = path.match(/^\/fuel-receipts\/([^/]+)$/);
      if (receiptMatch && method === "GET") {
        if (!await requirePermission(session, PERM.FUEL_VIEW, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const receiptId = receiptMatch[1];
        const receipt = await env.DB.prepare("SELECT * FROM fuel_receipts WHERE id = ? AND org_id = ?").bind(receiptId, org_id).first();
        if (!receipt) return json({ success: false, error: "Receipt not found" }, 404);

        const r2Object = await env.DRIVEN_DATA.get(receipt.r2_key);
        if (!r2Object) return json({ success: false, error: "Receipt file not found in storage" }, 404);
        const bytes = new Uint8Array(await r2Object.arrayBuffer());
        // Chunked to avoid call-stack overflow on large files
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        const base64 = btoa(binary);
        return json({ success: true, receipt, image_base64: base64, content_type: r2Object.httpMetadata?.contentType || "image/jpeg" });
      }

      // ════════════════════════════════════════
      // FUEL FLAGS (Phase 6A)
      // ════════════════════════════════════════

      // ── GET /fuel-flags — List flags (optional ?status=, ?flag_type=) ──
      if (path === "/fuel-flags" && method === "GET") {
        if (!await requirePermission(session, PERM.FUEL_FLAGS_VIEW, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const flagStatus = url.searchParams.get("status");
        const flagType = url.searchParams.get("flag_type");
        let query = "SELECT ff.*, a.asset_number, a.name AS asset_name, t.name AS tank_name FROM fuel_flags ff LEFT JOIN assets a ON ff.asset_id = a.id LEFT JOIN fuel_tanks t ON ff.tank_id = t.id WHERE ff.org_id = ?";
        const bindings = [org_id];
        if (flagStatus) { query += " AND ff.status = ?"; bindings.push(flagStatus); }
        if (flagType) { query += " AND ff.flag_type = ?"; bindings.push(flagType); }
        query += " ORDER BY ff.created_at DESC LIMIT 200";
        const result = await env.DB.prepare(query).bind(...bindings).all();
        return json({ success: true, flags: result.results });
      }

      // ── PUT /fuel-flags/:id/resolve — Resolve a flag ──
      const flagResolveMatch = path.match(/^\/fuel-flags\/([^/]+)\/resolve$/);
      if (flagResolveMatch && method === "PUT") {
        if (!await requirePermission(session, PERM.FUEL_FLAGS_RESOLVE, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const flagId = flagResolveMatch[1];
        const body = await request.json();
        const now = new Date().toISOString();

        const flag = await env.DB.prepare("SELECT * FROM fuel_flags WHERE id = ? AND org_id = ?").bind(flagId, org_id).first();
        if (!flag) return json({ success: false, error: "Flag not found" }, 404);
        if (flag.status === "resolved") return json({ success: false, error: "Flag already resolved" }, 400);

        await env.DB.prepare(
          "UPDATE fuel_flags SET status = 'resolved', resolved_at = ?, resolved_by = ?, resolution_notes = ? WHERE id = ? AND org_id = ?"
        ).bind(now, session.email, body.resolution_notes || null, flagId, org_id).run();

        return json({ success: true, flag_id: flagId, status: "resolved" });
      }

      // ── POST /fuel-flags/:id/add-and-resolve ──
      const flagAddResolveMatch = path.match(/^\/fuel-flags\/([^/]+)\/add-and-resolve$/);
      if (flagAddResolveMatch && method === "POST") {
        if (!await requirePermission(session, PERM.FUEL_FLAGS_RESOLVE, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const flagId = flagAddResolveMatch[1];
        const body = await request.json();
        const now = new Date().toISOString();

        const flag = await env.DB.prepare("SELECT * FROM fuel_flags WHERE id = ? AND org_id = ?").bind(flagId, org_id).first();
        if (!flag) return json({ success: false, error: "Flag not found" }, 404);
        if (flag.status === "resolved") return json({ success: false, error: "Flag already resolved" }, 400);

        let details = {};
        try { details = JSON.parse(flag.details || "{}"); } catch (e) {}
        const field = details.field || body.field;
        const value = (body.value || details.value || "").trim();
        const submitterEmail = details.person || body.person || null;
        const submitterUserId = details.user_id || body.user_id || null;

        if (!field || !value) {
          return json({ success: false, error: "Flag has no field/value to add" }, 400);
        }

        const created = { field, value };
        const notificationType = field === "project" ? "project_added" : (field === "asset" ? "asset_added" : "location_added");
        const entityLabel = field === "project" ? "Project" : (field === "asset" ? "Asset" : "Location");

        try {
          if (field === "project") {
            const projectId = crypto.randomUUID();
            await env.DB.prepare(
              "INSERT INTO projects (id, org_id, name, code, location, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)"
            ).bind(projectId, org_id, value, value, details.location || null, now, now).run();
            created.entity_id = projectId;
            created.entity_name = value;

            const pending = await env.DB.prepare(
              "SELECT id FROM fuel_transactions WHERE org_id = ? AND project_id IS NULL AND notes LIKE ?"
            ).bind(org_id, "%NEW PROJECT (pending manager review): " + value + "%").all();
            if (pending.results.length > 0) {
              const updates = pending.results.map((t) =>
                env.DB.prepare("UPDATE fuel_transactions SET project_id = ? WHERE id = ? AND org_id = ?")
                  .bind(projectId, t.id, org_id)
              );
              await env.DB.batch(updates);
            }
          } else if (field === "asset") {
            const assetId = crypto.randomUUID();
            const assetNumber = body.asset_number || (value.toUpperCase().replace(/[^A-Z0-9-]/g, "-").slice(0, 20));
            await env.DB.prepare(
              "INSERT INTO assets (id, org_id, asset_number, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)"
            ).bind(assetId, org_id, assetNumber, value, now, now).run();
            created.entity_id = assetId;
            created.entity_name = assetNumber;
          } else {
            created.entity_name = value;
          }

          await env.DB.prepare(
            "UPDATE fuel_flags SET status = 'resolved', resolved_at = ?, resolved_by = ?, resolution_notes = ? WHERE id = ? AND org_id = ?"
          ).bind(now, session.email, "Added " + entityLabel + " \"" + value + "\" (" + (created.entity_name || value) + ")", flagId, org_id).run();

          if (submitterEmail || submitterUserId) {
            const notifId = crypto.randomUUID();
            const title = entityLabel + " added: " + value;
            const message = "The " + entityLabel.toLowerCase() + " \"" + value + "\" you entered has been added to the system" +
              (created.entity_name && created.entity_name !== value ? " as \"" + created.entity_name + "\"" : "") +
              ". You can use it on future fuel purchases.";
            await env.DB.prepare(
              "INSERT INTO notifications (id, org_id, user_id, user_email, type, title, message, related_flag_id, related_purchase_id, related_entity_id, entity_name, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)"
            ).bind(notifId, org_id, submitterUserId || "", submitterEmail || "", notificationType, title, message, flagId, details.purchase_id || null, created.entity_id || null, created.entity_name || value, now).run();
            created.notification_id = notifId;
          }

          return json({ success: true, created, flag_id: flagId, status: "resolved", notified: !!(submitterEmail || submitterUserId) });
        } catch (err) {
          console.error("add-and-resolve error:", err.message);
          await logError(env, "Fuel worker (add-and-resolve)", err, request);
          return json({ success: false, error: "Failed to add " + entityLabel + ": " + err.message }, 500);
        }
      }

      // ── GET /notifications — List notifications for the current user ──
      if (path === "/notifications" && method === "GET") {
        const unreadOnly = url.searchParams.get("unread") === "1";
        let query = "SELECT * FROM notifications WHERE org_id = ? AND (user_id = ? OR user_email = ?)";
        const bindings = [org_id, session.user_id || "", session.email];
        if (unreadOnly) { query += " AND read_at IS NULL"; }
        query += " ORDER BY created_at DESC LIMIT 50";
        const result = await env.DB.prepare(query).bind(...bindings).all();
        return json({ success: true, notifications: result.results });
      }

      // ── PUT /notifications/:id/read — Mark a notification as read ──
      const notifReadMatch = path.match(/^\/notifications\/([^/]+)\/read$/);
      if (notifReadMatch && method === "PUT") {
        const notifId = notifReadMatch[1];
        await env.DB.prepare(
          "UPDATE notifications SET read_at = ? WHERE id = ? AND org_id = ?"
        ).bind(new Date().toISOString(), notifId, org_id).run();
        return json({ success: true });
      }

      // ── POST /notifications/forward ──
      if (path === "/notifications/forward" && method === "POST") {
        if (!await requirePermission(session, PERM.FUEL_FLAGS_RESOLVE, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const body = await request.json();
        const now = new Date().toISOString();
        const { flag_id, recipient_email, note } = body;
        if (!flag_id || !recipient_email) {
          return json({ success: false, error: "flag_id and recipient_email are required" }, 400);
        }
        const flag = await env.DB.prepare("SELECT * FROM fuel_flags WHERE id = ? AND org_id = ?").bind(flag_id, org_id).first();
        if (!flag) return json({ success: false, error: "Flag not found" }, 404);

        let flagDetails = {};
        try { flagDetails = JSON.parse(flag.details || "{}"); } catch (e) {}
        const notifId = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO notifications (id, org_id, user_id, user_email, type, title, message, related_flag_id, related_purchase_id, related_entity_id, entity_name, read_at, created_at) VALUES (?, ?, ?, ?, 'flag_forwarded', ?, ?, ?, ?, NULL, NULL, NULL, ?)"
        ).bind(notifId, org_id, "", recipient_email, "Fuel alert forwarded to you", "A fuel alert was forwarded to you by " + session.email + (note ? " — " + note : "") + ". Please review and add the missing item.", flag_id, flagDetails.purchase_id || null, now).run();

        return json({ success: true, notification_id: notifId });
      }

      // ════════════════════════════════════════
      // ORG SETTINGS (Phase 6A)
      // ════════════════════════════════════════

      // ── GET /org-settings ──
      if (path === "/org-settings" && method === "GET") {
        let settings = await env.DB.prepare("SELECT * FROM org_settings WHERE org_id = ?").bind(org_id).first();
        if (!settings) {
          settings = {
            org_id,
            notify_capacity_flags_email: 0,
            notify_equipment_manager_email: 0,
            notify_consumption_flags_email: 0,
            notify_employee_tank_flags_email: 0,
          };
        }
        return json({ success: true, settings });
      }

      // ── PUT /org-settings ──
      if (path === "/org-settings" && method === "PUT") {
        if (!await requirePermission(session, PERM.ORG_SETTINGS_EDIT, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const body = await request.json();
        const now = new Date().toISOString();
        const { notify_capacity_flags_email, notify_equipment_manager_email, notify_consumption_flags_email, notify_employee_tank_flags_email } = body;

        const existing = await env.DB.prepare("SELECT org_id FROM org_settings WHERE org_id = ?").bind(org_id).first();
        if (existing) {
          await env.DB.prepare(
            "UPDATE org_settings SET notify_capacity_flags_email = ?, notify_equipment_manager_email = ?, notify_consumption_flags_email = ?, notify_employee_tank_flags_email = ?, updated_at = ?, updated_by = ? WHERE org_id = ?"
          ).bind(
            notify_capacity_flags_email ? 1 : 0,
            notify_equipment_manager_email ? 1 : 0,
            notify_consumption_flags_email ? 1 : 0,
            notify_employee_tank_flags_email ? 1 : 0,
            now, session.email, org_id
          ).run();
        } else {
          await env.DB.prepare(
            "INSERT INTO org_settings (org_id, notify_capacity_flags_email, notify_equipment_manager_email, notify_consumption_flags_email, notify_employee_tank_flags_email, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).bind(
            org_id,
            notify_capacity_flags_email ? 1 : 0,
            notify_equipment_manager_email ? 1 : 0,
            notify_consumption_flags_email ? 1 : 0,
            notify_employee_tank_flags_email ? 1 : 0,
            now, session.email
          ).run();
        }

        return json({ success: true, settings: { org_id, notify_capacity_flags_email: notify_capacity_flags_email ? 1 : 0, notify_equipment_manager_email: notify_equipment_manager_email ? 1 : 0, notify_consumption_flags_email: notify_consumption_flags_email ? 1 : 0, notify_employee_tank_flags_email: notify_employee_tank_flags_email ? 1 : 0 } });
      }

      // ════════════════════════════════════════
      // FUEL TANK TYPES (dynamic tabs + custom display names)
      // ════════════════════════════════════════

      // ── GET /fuel-tank-types ──
      if (path === "/fuel-tank-types" && method === "GET") {
        const types = await getFuelTankTypes(env, org_id);
        return json({ success: true, tank_types: types });
      }

      // ── POST /fuel-tank-types ──
      if (path === "/fuel-tank-types" && method === "POST") {
        if (!await requirePermission(session, PERM.FUEL_EDIT, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const body = await request.json();
        const { system_key, display_name, sort_order } = body;
        if (!system_key) return json({ success: false, error: "system_key is required" }, 400);
        if (!display_name) return json({ success: false, error: "display_name is required" }, 400);
        if (!/^[a-z][a-z0-9_]*$/.test(system_key)) {
          return json({ success: false, error: "system_key must be lowercase letters, numbers, and underscores only" }, 400);
        }
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        try {
          await env.DB.prepare(
            "INSERT INTO fuel_tank_types (id, org_id, system_key, display_name, is_active, sort_order, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
          ).bind(id, org_id, system_key, display_name, sort_order || 99, now).run();
        } catch (insertErr) {
          if (insertErr.message && insertErr.message.includes("UNIQUE")) {
            return json({ success: false, error: "A fuel tank type with this system_key already exists for this organization" }, 409);
          }
          throw insertErr;
        }
        return json({ success: true, tank_type: { id, system_key, display_name, is_active: 1, sort_order: sort_order || 99 } }, 201);
      }

      // ── PUT /fuel-tank-types/:id ──
      const tankTypeMatch = path.match(/^\/fuel-tank-types\/([^/]+)$/);
      if (tankTypeMatch && method === "PUT") {
        if (!await requirePermission(session, PERM.FUEL_EDIT, env)) return json({ success: false, error: "Insufficient permissions" }, 403);
        const typeId = tankTypeMatch[1];
        const body = await request.json();
        const { display_name, is_active, sort_order } = body;
        const existing = await env.DB.prepare("SELECT * FROM fuel_tank_types WHERE id = ? AND org_id = ?").bind(typeId, org_id).first();
        if (!existing) return json({ success: false, error: "Fuel tank type not found" }, 404);
        await env.DB.prepare(
          "UPDATE fuel_tank_types SET display_name = ?, is_active = ?, sort_order = ? WHERE id = ? AND org_id = ?"
        ).bind(
          display_name !== undefined ? display_name : existing.display_name,
          is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
          sort_order !== undefined ? sort_order : existing.sort_order,
          typeId, org_id
        ).run();
        return json({ success: true, tank_type_id: typeId });
      }

      // ════════════════════════════════════════
      // MODULE SUBSCRIPTIONS
      // ════════════════════════════════════════

      // ── GET /module-subscriptions ──
      if (path === "/module-subscriptions" && method === "GET") {
        const subscribed = await isFuelManagementSubscribed(env, org_id);
        return json({ success: true, subscribed, module: "fuel_management" });
      }

      // ── POST /log-error ──
      if (path === "/log-error" && method === "POST") {
        const body = await request.json();
        const { source, message, stack, url, userAgent } = body;
        const clientErr = new Error(message || "Client-side error");
        if (stack) clientErr.stack = stack;
        if (url) { clientErr._clientUrl = url; clientErr._clientUA = userAgent || "N/A"; }
        await logError(env, source || "Client-side error", clientErr, request);
        return json({ success: true, logged: true });
      }

      return json({ success: false, error: "Route not found" }, 404);
    } catch (e) {
      await logError(env, "Fuel worker", e, request);
      console.error("Fuel worker error:", e.message, e.stack);
      return json({ success: false, error: "Internal server error: " + e.message }, 500);
    }
  },
};
