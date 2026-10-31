// ============================================================================
// Pages Function: /api/admin/app-settings
// ============================================================================
// PURPOSE:
//   Read and write organization & application settings stored in the app_settings D1 table.
//
// ROUTES:
//   GET  /api/admin/app-settings?key=business_type
//   GET  /api/admin/app-settings
//   GET  /auth/get-settings
//   POST /api/admin/app-settings
//   POST /auth/save-settings
//
// POST BODY FORMATS:
//   Option A: { "key": "business_type", "value": "Construction" }
//   Option B: { "settings": { "business_type": "Construction", "currency": "USD" } }
//
// AUTHORIZATION REQUIREMENTS:
//   1. JWT_SECRET must be configured (or fallback API headers supplied).
//   2. DB must be configured.
//   3. The driv_en_session cookie or x-user-id header must exist.
//   4. The session must be valid and unexpired.
//   5. User must be active in the DB.
//   6. Role must be RO-admin, RO-Founder, admin, or founder.
//   7. Tenant data is isolated by org_id.
//
// PAGES PROJECT BINDINGS:
//   - D1: DB -> driv-en-db
//   - Secret: JWT_SECRET
// ============================================================================

const ALLOWED_ROLES = ["RO-admin", "RO-Founder", "admin", "founder"];
const SESSION_COOKIE_NAME = "driv_en_session";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://www.driv-en.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Cookie, x-user-id, x-org-id, x-user-role",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function jsonResponse(data, status = 200, extraHeaders = {}) {
  const responseBody = JSON.stringify(data);
  const responseHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...CORS_HEADERS,
    ...extraHeaders
  };
  return new Response(responseBody, { status, headers: responseHeaders });
}

function authorizationFailure(error, status = 403) {
  const response = jsonResponse({ success: false, error }, status);
  return { authorized: false, response };
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

async function logError(env, source, error, request) {
  if (!env) {
    console.error("[APP-SETTINGS] Error environment is unavailable");
    return;
  }
  if (!env.DB) {
    console.error("[APP-SETTINGS] DB binding is unavailable");
    return;
  }

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

    const randomPart = Math.random().toString(36).substring(2, 11);
    const errorId = "ERR-" + Date.now() + "-" + randomPart;

    let stackTrace = "No stack trace";
    if (error && error.stack) {
      stackTrace = error.stack;
    }

    if (request) {
      try {
        const requestUrl = new URL(request.url);
        const userAgent = request.headers.get("User-Agent") || "N/A";
        const cfRay = request.headers.get("CF-Ray") || "N/A";

        stackTrace += "\n\n--- REQUEST CONTEXT ---";
        stackTrace += "\nURL: " + request.url;
        stackTrace += "\nMethod: " + request.method;
        stackTrace += "\nPath: " + requestUrl.pathname;
        stackTrace += "\nUser-Agent: " + userAgent;
        stackTrace += "\nCF-Ray: " + cfRay;
        stackTrace += "\nTime: " + new Date().toISOString();
      } catch (requestError) {
        console.error("[APP-SETTINGS] Request context error:", requestError.message);
      }
    }

    let errorMessage = "Unknown error";
    if (error && error.message) {
      errorMessage = error.message;
    }

    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO error_log (
        id, source, error_message, stack_trace, severity, resolved, created_at
      ) VALUES (?, ?, ?, ?, 'error', 0, ?)`
    ).bind(errorId, source, errorMessage, stackTrace, createdAt).run();
  } catch (loggingError) {
    console.error("[APP-SETTINGS] Failed to write error log:", loggingError.message);
  }
}

// ============================================================================
// BASE64URL HELPERS
// ============================================================================

function base64UrlDecode(value) {
  let normalizedValue = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (normalizedValue.length % 4) {
    normalizedValue += "=";
  }
  const binaryValue = atob(normalizedValue);
  const bytes = new Uint8Array(binaryValue.length);
  for (let index = 0; index < binaryValue.length; index++) {
    bytes[index] = binaryValue.charCodeAt(index);
  }
  return bytes;
}

// ============================================================================
// JWT HELPERS
// ============================================================================

async function importHmacKey(secret) {
  const secretBytes = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function verifyJwt(token, secret) {
  if (!token || !secret) return null;
  try {
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) return null;

    const headerBase64 = tokenParts[0];
    const payloadBase64 = tokenParts[1];
    const signatureBase64 = tokenParts[2];

    const headerBytes = base64UrlDecode(headerBase64);
    const headerText = new TextDecoder().decode(headerBytes);
    const header = JSON.parse(headerText);

    if (!header || header.alg !== "HS256") return null;

    const signedData = headerBase64 + "." + payloadBase64;
    const key = await importHmacKey(secret);
    const signatureBytes = base64UrlDecode(signatureBase64);
    const signedDataBytes = new TextEncoder().encode(signedData);

    const signatureIsValid = await crypto.subtle.verify("HMAC", key, signatureBytes, signedDataBytes);
    if (!signatureIsValid) return null;

    const payloadBytes = base64UrlDecode(payloadBase64);
    const payloadText = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadText);

    if (!payload) return null;

    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp && currentTime >= Number(payload.exp)) return null;
    if (payload.nbf && currentTime < Number(payload.nbf)) return null;

    return payload;
  } catch (error) {
    console.error("[APP-SETTINGS] JWT verification failed:", error.message);
    return null;
  }
}

// ============================================================================
// COOKIE HELPERS
// ============================================================================

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const cookiePairs = cookieHeader.split(";");
  for (const cookiePair of cookiePairs) {
    const separatorIndex = cookiePair.indexOf("=");
    if (separatorIndex === -1) continue;
    const cookieName = cookiePair.slice(0, separatorIndex).trim();
    const cookieValue = cookiePair.slice(separatorIndex + 1).trim();
    if (cookieName) cookies[cookieName] = cookieValue;
  }
  return cookies;
}

// ============================================================================
// ACTIVE USER NORMALIZATION
// ============================================================================

function isActiveUser(value) {
  if (value === 1 || value === true || value === "1") return true;
  if (String(value).toLowerCase() === "true") return true;
  return false;
}

// ============================================================================
// ZERO-TRUST AUTHORIZATION
// ============================================================================

async function requireAdmin(request, env) {
  if (!env) return authorizationFailure("Server environment unavailable", 500);
  if (!env.DB) return authorizationFailure("Server database unavailable", 500);

  let userId = null;
  let orgId = null;
  let roleId = null;

  // 1. JWT Session Cookie Verification
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (sessionToken && env.JWT_SECRET) {
    const payload = await verifyJwt(sessionToken, env.JWT_SECRET);
    if (payload) {
      userId = payload.user_id;
      orgId = payload.org_id;
      roleId = payload.role_id || payload.role;
    }
  }

  // 2. Fallback API Header verification
  if (!userId) {
    userId = request.headers.get("x-user-id");
    orgId = request.headers.get("x-org-id");
    roleId = request.headers.get("x-user-role");
  }

  if (!userId) return authorizationFailure("Not authenticated", 401);

  // 3. Database User Account & Role Check
  let user = null;
  try {
    user = await env.DB.prepare(
      `SELECT id, email, role_id, org_id, is_active FROM users WHERE id = ? LIMIT 1`
    ).bind(userId).first();
  } catch (error) {
    await logError(env, "pages:app-settings (user lookup)", error, request);
    return authorizationFailure("Unable to verify user account", 500);
  }

  if (!user) return authorizationFailure("User account not found", 403);
  if (!isActiveUser(user.is_active)) return authorizationFailure("User account is inactive", 403);

  const effectiveRole = (user.role_id || roleId || "").trim();
  const isAllowed = ALLOWED_ROLES.some(r => r.toLowerCase() === effectiveRole.toLowerCase());

  if (!isAllowed) return authorizationFailure("Administrative access required", 403);

  return {
    authorized: true,
    user: user,
    orgId: user.org_id || orgId || "org_dsi"
  };
}

// ============================================================================
// SETTINGS TABLE SETUP
// ============================================================================

async function ensureSettingsTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS app_settings (
      org_id TEXT NOT NULL DEFAULT 'org_dsi',
      key TEXT NOT NULL,
      value TEXT,
      updated_at TEXT,
      PRIMARY KEY (org_id, key)
    )`
  ).run();
}

function isValidSettingKey(key) {
  if (typeof key !== "string" || key.length === 0 || key.length > 100) return false;
  return /^[a-zA-Z0-9_.-]+$/.test(key);
}

// ============================================================================
// GET SETTINGS HANDLER
// ============================================================================

async function handleGet(request, env) {
  const authorization = await requireAdmin(request, env);
  if (!authorization.authorized) return authorization.response;

  try {
    await ensureSettingsTable(env);
    const orgId = authorization.orgId;
    const requestUrl = new URL(request.url);
    const key = requestUrl.searchParams.get("key");

    if (key !== null) {
      if (!isValidSettingKey(key)) {
        return jsonResponse({ success: false, error: "Invalid setting key" }, 400);
      }

      const row = await env.DB.prepare(
        `SELECT key, value, updated_at FROM app_settings WHERE org_id = ? AND key = ? LIMIT 1`
      ).bind(orgId, key).first();

      if (!row) {
        return jsonResponse({ success: true, key: key, value: null, updated_at: null });
      }

      let parsedVal = row.value;
      try { parsedVal = JSON.parse(row.value); } catch(e) {}

      return jsonResponse({
        success: true,
        key: row.key,
        value: parsedVal,
        updated_at: row.updated_at || null
      });
    }

    const result = await env.DB.prepare(
      `SELECT key, value, updated_at FROM app_settings WHERE org_id = ? ORDER BY key ASC`
    ).bind(orgId).all();

    const settings = {};
    const rows = result.results || [];

    for (const row of rows) {
      let parsedVal = row.value;
      try { parsedVal = JSON.parse(row.value); } catch(e) {}
      settings[row.key] = parsedVal;
    }

    return jsonResponse({
      success: true,
      settings: settings
    });
  } catch (error) {
    await logError(env, "pages:app-settings (read)", error, request);
    return jsonResponse({ success: false, error: "Failed to read application settings" }, 500);
  }
}

// ============================================================================
// POST SETTING HANDLER
// ============================================================================

async function handlePost(request, env) {
  const authorization = await requireAdmin(request, env);
  if (!authorization.authorized) return authorization.response;

  let body = null;
  try {
    body = await request.json();
  } catch (error) {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ success: false, error: "A JSON object is required" }, 400);
  }

  const orgId = authorization.orgId;
  const updatedAt = new Date().toISOString();

  try {
    await ensureSettingsTable(env);

    // Format A: Object Dictionary ({ settings: { business_type: "...", currency: "..." } })
    if (body.settings && typeof body.settings === "object") {
      const batchQueries = [];
      for (const [k, v] of Object.entries(body.settings)) {
        if (!isValidSettingKey(k)) continue;
        const strVal = typeof v === "object" ? JSON.stringify(v) : String(v);
        batchQueries.push(
          env.DB.prepare(
            `INSERT INTO app_settings (org_id, key, value, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(org_id, key)
             DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
          ).bind(orgId, k, strVal, updatedAt)
        );
      }

      if (batchQueries.length > 0) {
        await env.DB.batch(batchQueries);
      }

      return jsonResponse({
        success: true,
        message: "Settings saved successfully",
        updated_at: updatedAt
      });
    }

    // Format B: Single key/value ({ key: "...", value: "..." })
    if (typeof body.key === "string" && body.value !== undefined) {
      const key = body.key.trim();
      if (!isValidSettingKey(key)) {
        return jsonResponse({ success: false, error: "A valid setting key is required" }, 400);
      }

      const strVal = typeof body.value === "object" ? JSON.stringify(body.value) : String(body.value);

      await env.DB.prepare(
        `INSERT INTO app_settings (org_id, key, value, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(org_id, key)
         DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).bind(orgId, key, strVal, updatedAt).run();

      return jsonResponse({
        success: true,
        message: "Setting saved",
        setting: { key, value: body.value, updated_at: updatedAt }
      });
    }

    return jsonResponse({ success: false, error: "Invalid request payload format" }, 400);
  } catch (error) {
    await logError(env, "pages:app-settings (save)", error, request);
    return jsonResponse({ success: false, error: "Failed to save application setting" }, 500);
  }
}

// ============================================================================
// CLOUDFLARE PAGES FUNCTION HANDLERS
// ============================================================================

export async function onRequestGet(context) {
  return handleGet(context.request, context.env);
}

export async function onRequestPost(context) {
  return handlePost(context.request, context.env);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
