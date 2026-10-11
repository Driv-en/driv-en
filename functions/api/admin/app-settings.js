// ============================================================================
// Pages Function: /api/admin/app-settings
// ============================================================================
// PURPOSE:
//   Read and write application settings stored in the app_settings D1 table.
//
// ROUTES:
//   GET  /api/admin/app-settings?key=w9_irs_form_url
//   GET  /api/admin/app-settings?key=owner_logo
//   GET  /api/admin/app-settings
//   POST /api/admin/app-settings
//
// POST BODY:
//   {
//     "key": "w9_irs_form_url",
//     "value": "https://example.com/file.pdf"
//   }
//
// FOUNDER AUTHORIZATION REQUIREMENTS:
//   1. JWT_SECRET must be configured.
//   2. DB must be configured.
//   3. The driv_en_session cookie must exist.
//   4. The JWT must be valid and unexpired.
//   5. JWT role_id must equal RO-Founder.
//   6. JWT org_id must equal org_dsi.
//   7. JWT user_id must identify an existing users record.
//   8. The users record must be active.
//   9. Database role_id must equal RO-Founder.
//  10. Database org_id must equal org_dsi.
//  11. JWT email must match the database email.
//
// PAGES PROJECT BINDINGS:
//   - D1: DB -> driv-en-db
//   - Secret: JWT_SECRET
// ============================================================================

const FOUNDER_ROLE_ID = "RO-Founder";

const FOUNDER_ORG_ID = "org_dsi";

const SESSION_COOKIE_NAME = "driv_en_session";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://www.driv-en.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Cookie",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function jsonResponse(
  data,
  status = 200,
  extraHeaders = {}
) {
  const responseBody = JSON.stringify(data);

  const responseHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...CORS_HEADERS,
    ...extraHeaders
  };

  return new Response(
    responseBody,
    {
      status: status,
      headers: responseHeaders
    }
  );
}

function authorizationFailure(
  error,
  status
) {
  const response = jsonResponse(
    {
      success: false,
      error: error
    },
    status
  );

  return {
    authorized: false,
    response: response
  };
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

async function logError(
  env,
  source,
  error,
  request
) {
  if (!env) {
    console.error(
      "[APP-SETTINGS] Error environment is unavailable"
    );

    return;
  }

  if (!env.DB) {
    console.error(
      "[APP-SETTINGS] DB binding is unavailable"
    );

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

    const randomPart = Math
      .random()
      .toString(36)
      .substring(2, 11);

    const errorId =
      "ERR-" +
      Date.now() +
      "-" +
      randomPart;

    let stackTrace = "No stack trace";

    if (
      error &&
      error.stack
    ) {
      stackTrace = error.stack;
    }

    if (request) {
      try {
        const requestUrl = new URL(
          request.url
        );

        const userAgent =
          request.headers.get("User-Agent") ||
          "N/A";

        const cfRay =
          request.headers.get("CF-Ray") ||
          "N/A";

        stackTrace +=
          "\n\n--- REQUEST CONTEXT ---";

        stackTrace +=
          "\nURL: " +
          request.url;

        stackTrace +=
          "\nMethod: " +
          request.method;

        stackTrace +=
          "\nPath: " +
          requestUrl.pathname;

        stackTrace +=
          "\nUser-Agent: " +
          userAgent;

        stackTrace +=
          "\nCF-Ray: " +
          cfRay;

        stackTrace +=
          "\nTime: " +
          new Date().toISOString();
      } catch (requestError) {
        console.error(
          "[APP-SETTINGS] Request context error:",
          requestError.message
        );
      }
    }

    let errorMessage = "Unknown error";

    if (
      error &&
      error.message
    ) {
      errorMessage = error.message;
    }

    const createdAt =
      new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO error_log (
        id,
        source,
        error_message,
        stack_trace,
        severity,
        resolved,
        created_at
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        'error',
        0,
        ?
      )`
    )
      .bind(
        errorId,
        source,
        errorMessage,
        stackTrace,
        createdAt
      )
      .run();
  } catch (loggingError) {
    console.error(
      "[APP-SETTINGS] Failed to write error log:",
      loggingError.message
    );
  }
}

// ============================================================================
// BASE64URL HELPERS
// ============================================================================

function base64UrlDecode(value) {
  let normalizedValue =
    String(value || "");

  normalizedValue =
    normalizedValue.replace(
      /-/g,
      "+"
    );

  normalizedValue =
    normalizedValue.replace(
      /_/g,
      "/"
    );

  while (
    normalizedValue.length % 4
  ) {
    normalizedValue += "=";
  }

  const binaryValue =
    atob(normalizedValue);

  const bytes =
    new Uint8Array(
      binaryValue.length
    );

  for (
    let index = 0;
    index < binaryValue.length;
    index++
  ) {
    bytes[index] =
      binaryValue.charCodeAt(index);
  }

  return bytes;
}

// ============================================================================
// JWT HELPERS
// ============================================================================

async function importHmacKey(secret) {
  const secretBytes =
    new TextEncoder().encode(secret);

  return crypto.subtle.importKey(
    "raw",
    secretBytes,
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    [
      "verify"
    ]
  );
}

async function verifyJwt(
  token,
  secret
) {
  if (!token) {
    return null;
  }

  if (!secret) {
    return null;
  }

  try {
    const tokenParts =
      token.split(".");

    if (
      tokenParts.length !== 3
    ) {
      return null;
    }

    const headerBase64 =
      tokenParts[0];

    const payloadBase64 =
      tokenParts[1];

    const signatureBase64 =
      tokenParts[2];

    const headerBytes =
      base64UrlDecode(
        headerBase64
      );

    const headerText =
      new TextDecoder().decode(
        headerBytes
      );

    const header =
      JSON.parse(headerText);

    if (!header) {
      return null;
    }

    if (
      header.alg !== "HS256"
    ) {
      return null;
    }

    const signedData =
      headerBase64 +
      "." +
      payloadBase64;

    const key =
      await importHmacKey(secret);

    const signatureBytes =
      base64UrlDecode(
        signatureBase64
      );

    const signedDataBytes =
      new TextEncoder().encode(
        signedData
      );

    const signatureIsValid =
      await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBytes,
        signedDataBytes
      );

    if (!signatureIsValid) {
      return null;
    }

    const payloadBytes =
      base64UrlDecode(
        payloadBase64
      );

    const payloadText =
      new TextDecoder().decode(
        payloadBytes
      );

    const payload =
      JSON.parse(payloadText);

    if (!payload) {
      return null;
    }

    const currentTime =
      Math.floor(
        Date.now() / 1000
      );

    if (
      payload.exp &&
      currentTime >= Number(payload.exp)
    ) {
      return null;
    }

    if (
      payload.nbf &&
      currentTime < Number(payload.nbf)
    ) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error(
      "[APP-SETTINGS] JWT verification failed:",
      error.message
    );

    return null;
  }
}

// ============================================================================
// COOKIE HELPERS
// ============================================================================

function parseCookies(cookieHeader) {
  const cookies = {};

  if (!cookieHeader) {
    return cookies;
  }

  const cookiePairs =
    cookieHeader.split(";");

  for (
    const cookiePair of cookiePairs
  ) {
    const separatorIndex =
      cookiePair.indexOf("=");

    if (
      separatorIndex === -1
    ) {
      continue;
    }

    const cookieName =
      cookiePair
        .slice(
          0,
          separatorIndex
        )
        .trim();

    const cookieValue =
      cookiePair
        .slice(
          separatorIndex + 1
        )
        .trim();

    if (!cookieName) {
      continue;
    }

    cookies[cookieName] =
      cookieValue;
  }

  return cookies;
}

// ============================================================================
// ACTIVE USER NORMALIZATION
// ============================================================================

function isActiveUser(value) {
  if (
    value === 1
  ) {
    return true;
  }

  if (
    value === true
  ) {
    return true;
  }

  if (
    value === "1"
  ) {
    return true;
  }

  if (
    String(value).toLowerCase() === "true"
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// FOUNDER AUTHORIZATION
// ============================================================================

async function requireFounder(
  request,
  env
) {
  if (!env) {
    return authorizationFailure(
      "Server environment is unavailable",
      500
    );
  }

  if (!env.JWT_SECRET) {
    console.error(
      "[APP-SETTINGS] JWT_SECRET binding is missing"
    );

    return authorizationFailure(
      "Server authentication is not configured",
      500
    );
  }

  if (!env.DB) {
    console.error(
      "[APP-SETTINGS] DB binding is missing"
    );

    return authorizationFailure(
      "Server database is not configured",
      500
    );
  }

  const cookieHeader =
    request.headers.get("Cookie") ||
    "";

  const cookies =
    parseCookies(cookieHeader);

  const sessionToken =
    cookies[SESSION_COOKIE_NAME];

  if (!sessionToken) {
    return authorizationFailure(
      "Not authenticated",
      401
    );
  }

  const payload =
    await verifyJwt(
      sessionToken,
      env.JWT_SECRET
    );

  if (!payload) {
    return authorizationFailure(
      "Invalid or expired session",
      401
    );
  }

  if (
    !payload.user_id
  ) {
    return authorizationFailure(
      "Session does not identify a user",
      401
    );
  }

  if (
    !payload.email
  ) {
    return authorizationFailure(
      "Session does not contain an email",
      401
    );
  }

  if (
    payload.role_id !==
    FOUNDER_ROLE_ID
  ) {
    return authorizationFailure(
      "Founder access required",
      403
    );
  }

  if (
    payload.org_id !==
    FOUNDER_ORG_ID
  ) {
    return authorizationFailure(
      "Founder organization required",
      403
    );
  }

  let user = null;

  try {
    user =
      await env.DB.prepare(
        `SELECT
          id,
          email,
          role_id,
          org_id,
          is_active
        FROM users
        WHERE id = ?
        LIMIT 1`
      )
        .bind(
          payload.user_id
        )
        .first();
  } catch (error) {
    await logError(
      env,
      "pages:app-settings (founder lookup)",
      error,
      request
    );

    return authorizationFailure(
      "Unable to verify Founder account",
      500
    );
  }

  if (!user) {
    return authorizationFailure(
      "User account not found",
      403
    );
  }

  if (
    String(user.id) !==
    String(payload.user_id)
  ) {
    return authorizationFailure(
      "Session user does not match the account",
      403
    );
  }

  const payloadEmail =
    String(payload.email)
      .trim()
      .toLowerCase();

  const databaseEmail =
    String(user.email || "")
      .trim()
      .toLowerCase();

  if (
    payloadEmail !==
    databaseEmail
  ) {
    return authorizationFailure(
      "Session email does not match the account",
      403
    );
  }

  const userIsActive =
    isActiveUser(
      user.is_active
    );

  if (!userIsActive) {
    return authorizationFailure(
      "User account is inactive",
      403
    );
  }

  if (
    user.role_id !==
    FOUNDER_ROLE_ID
  ) {
    return authorizationFailure(
      "Founder role is required",
      403
    );
  }

  if (
    user.org_id !==
    FOUNDER_ORG_ID
  ) {
    return authorizationFailure(
      "Founder organization is required",
      403
    );
  }

  return {
    authorized: true,
    payload: payload,
    user: user
  };
}

// ============================================================================
// SETTINGS TABLE
// ============================================================================

async function ensureSettingsTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    )`
  ).run();
}

function isValidSettingKey(key) {
  if (
    typeof key !== "string"
  ) {
    return false;
  }

  if (
    key.length === 0
  ) {
    return false;
  }

  if (
    key.length > 100
  ) {
    return false;
  }

  const validPattern =
    /^[a-zA-Z0-9_.-]+$/;

  if (
    !validPattern.test(key)
  ) {
    return false;
  }

  return true;
}

// ============================================================================
// GET SETTINGS
// ============================================================================

async function handleGet(
  request,
  env
) {
  const authorization =
    await requireFounder(
      request,
      env
    );

  if (
    !authorization.authorized
  ) {
    return authorization.response;
  }

  try {
    await ensureSettingsTable(env);

    const requestUrl =
      new URL(request.url);

    const key =
      requestUrl.searchParams.get(
        "key"
      );

    if (
      key !== null
    ) {
      const keyIsValid =
        isValidSettingKey(key);

      if (!keyIsValid) {
        return jsonResponse(
          {
            success: false,
            error: "Invalid setting key"
          },
          400
        );
      }

      const row =
        await env.DB.prepare(
          `SELECT
            key,
            value,
            updated_at
          FROM app_settings
          WHERE key = ?
          LIMIT 1`
        )
          .bind(key)
          .first();

      if (!row) {
        return jsonResponse(
          {
            success: true,
            key: key,
            value: null,
            updated_at: null
          },
          200
        );
      }

      return jsonResponse(
        {
          success: true,
          key: row.key,
          value: row.value,
          updated_at:
            row.updated_at ||
            null
        },
        200
      );
    }

    const result =
      await env.DB.prepare(
        `SELECT
          key,
          value,
          updated_at
        FROM app_settings
        ORDER BY key ASC`
      ).all();

    const settings = {};

    const rows =
      result.results ||
      [];

    for (
      const row of rows
    ) {
      settings[row.key] =
        row.value;
    }

    return jsonResponse(
      {
        success: true,
        settings: settings
      },
      200
    );
  } catch (error) {
    await logError(
      env,
      "pages:app-settings (read)",
      error,
      request
    );

    return jsonResponse(
      {
        success: false,
        error:
          "Failed to read application settings"
      },
      500
    );
  }
}

// ============================================================================
// POST SETTING
// ============================================================================

async function handlePost(
  request,
  env
) {
  const authorization =
    await requireFounder(
      request,
      env
    );

  if (
    !authorization.authorized
  ) {
    return authorization.response;
  }

  let body = null;

  try {
    body =
      await request.json();
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: "Invalid JSON body"
      },
      400
    );
  }

  if (
    !body ||
    typeof body !== "object"
  ) {
    return jsonResponse(
      {
        success: false,
        error: "A JSON object is required"
      },
      400
    );
  }

  let key = "";

  if (
    typeof body.key === "string"
  ) {
    key =
      body.key.trim();
  }

  const keyIsValid =
    isValidSettingKey(key);

  if (!keyIsValid) {
    return jsonResponse(
      {
        success: false,
        error:
          "A valid setting key is required"
      },
      400
    );
  }

  if (
    body.value === undefined
  ) {
    return jsonResponse(
      {
        success: false,
        error: "Setting value is required"
      },
      400
    );
  }

  if (
    body.value === null
  ) {
    return jsonResponse(
      {
        success: false,
        error: "Setting value cannot be null"
      },
      400
    );
  }

  const value =
    String(body.value);

  const updatedAt =
    new Date().toISOString();

  try {
    await ensureSettingsTable(env);

    await env.DB.prepare(
      `INSERT INTO app_settings (
        key,
        value,
        updated_at
      )
      VALUES (
        ?,
        ?,
        ?
      )
      ON CONFLICT(key)
      DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at`
    )
      .bind(
        key,
        value,
        updatedAt
      )
      .run();

    return jsonResponse(
      {
        success: true,
        message: "Setting saved",
        setting: {
          key: key,
          value: value,
          updated_at: updatedAt
        }
      },
      200
    );
  } catch (error) {
    await logError(
      env,
      "pages:app-settings (save)",
      error,
      request
    );

    return jsonResponse(
      {
        success: false,
        error:
          "Failed to save application setting"
      },
      500
    );
  }
}

// ============================================================================
// CLOUDFLARE PAGES FUNCTION HANDLERS
// ============================================================================

export async function onRequestGet(
  context
) {
  const request =
    context.request;

  const env =
    context.env;

  return handleGet(
    request,
    env
  );
}

export async function onRequestPost(
  context
) {
  const request =
    context.request;

  const env =
    context.env;

  return handlePost(
    request,
    env
  );
}

export async function onRequestOptions() {
  return new Response(
    null,
    {
      status: 204,
      headers: CORS_HEADERS
    }
  );
}
