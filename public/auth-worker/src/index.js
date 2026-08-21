// ============================================================
// DRIV-EN Auth Worker (D1 + Multi-tenant)
// Routes:
//   POST /auth/login           — validate credentials, issue cookies
//   POST /auth/change-password — change temp password on first login
//   GET  /auth/session         — validate current session token
//   POST /auth/logout          — clear cookies
//   POST /auth/refresh         — issue new session from refresh token
// ============================================================

// ---------- Configuration ----------
const SESSION_LIFETIME = 3600;       // 1 hour (seconds)
const REFRESH_LIFETIME = 2592000;    // 30 days (seconds)
const PBKDF2_ITERATIONS = 100000;

const COOKIE_SESSION = "driv_en_session";
const COOKIE_REFRESH = "driv_en_refresh";

// ---------- Base64URL helpers ----------
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

// ---------- JWT (HS256) ----------
async function importHmacKey(secret) {
    return crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

async function signJWT(payload, secret, lifetimeSeconds) {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = { ...payload, iat: now, exp: now + lifetimeSeconds };

    const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(fullPayload)));
    const data = `${headerB64}.${payloadB64}`;

    const key = await importHmacKey(secret);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
    return `${data}.${base64UrlEncode(new Uint8Array(sig))}`;
}

async function verifyJWT(token, secret) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const [headerB64, payloadB64, sigB64] = parts;
        const data = `${headerB64}.${payloadB64}`;

        const key = await importHmacKey(secret);
        const valid = await crypto.subtle.verify(
            "HMAC",
            key,
            base64UrlDecode(sigB64),
            new TextEncoder().encode(data)
        );
        if (!valid) return null;

        const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
        if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

// ---------- Password hashing (PBKDF2) ----------
async function hashPassword(password, saltHex) {
    const salt = saltHex
        ? hexToBytes(saltHex)
        : crypto.getRandomValues(new Uint8Array(16));
    const saltHexStr = bytesToHex(salt);

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        keyMaterial,
        256
    );
    return { salt: saltHexStr, hash: base64UrlEncode(new Uint8Array(bits)) };
}

async function verifyPassword(password, storedHash, storedSalt) {
    const { hash } = await hashPassword(password, storedSalt);
    return hash === storedHash;
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    return arr;
}

// ---------- Cookie helpers ----------
function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;
    for (const pair of cookieHeader.split(";")) {
        const idx = pair.indexOf("=");
        if (idx === -1) continue;
        const key = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        cookies[key] = val;
    }
    return cookies;
}

function buildCookie(name, value, maxAge) {
    let c = `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/`;
    if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
    return c;
}

function clearCookie(name) {
    return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// ---------- Utility ----------
function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...extraHeaders }
    });
}

// ============================================================
// Route handlers
// ============================================================

// ---------- POST /auth/login ----------
async function handleLogin(request, env) {
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const { email, password, remember } = body;
    if (!email || !password) {
        return json({ success: false, error: "Email and password are required" }, 400);
    }

    const rememberMe = remember === true;

    // Look up user with org and role via JOIN
    const stmt = env.DB.prepare(`
        SELECT u.id, u.email, u.org_id, u.password_hash, u.password_salt,
               u.must_change_password, u.is_active,
               o.status AS org_status,
               r.name AS role_name
        FROM users u
        JOIN organizations o ON u.org_id = o.id
        JOIN roles r ON u.role_id = r.id
        WHERE u.email = ?
    `);
    const result = await stmt.bind(email.toLowerCase().trim()).first();

    if (!result) {
        return json({ success: false, error: "Invalid email or password" }, 401);
    }

    // Check if user is active
    if (!result.is_active) {
        return json({ success: false, error: "Account is deactivated. Contact your administrator." }, 403);
    }

    // Check org subscription status
    if (result.org_status !== "active") {
        return json({ success: false, error: "Your organization's subscription is not active. Contact your administrator." }, 403);
    }

    // Verify password
    const valid = await verifyPassword(password, result.password_hash, result.password_salt);
    if (!valid) {
        return json({ success: false, error: "Invalid email or password" }, 401);
    }

    // Issue session JWT
    const sessionToken = await signJWT(
        {
            sub: result.email,
            email: result.email,
            org_id: result.org_id,
            role: result.role_name,
            must_change_password: result.must_change_password === 1
        },
        env.JWT_SECRET,
        SESSION_LIFETIME
    );

    const setCookies = [buildCookie(COOKIE_SESSION, sessionToken, rememberMe ? SESSION_LIFETIME : undefined)];

    // Issue refresh JWT only when remember is true
    if (rememberMe) {
        const refreshToken = await signJWT(
            { sub: result.email, email: result.email, org_id: result.org_id, type: "refresh" },
            env.JWT_SECRET,
            REFRESH_LIFETIME
        );
        setCookies.push(buildCookie(COOKIE_REFRESH, refreshToken, REFRESH_LIFETIME));
    }

    return json({
        success: true,
        role: result.role_name,
        must_change_password: result.must_change_password === 1
    }, 200, { "Set-Cookie": setCookies.join(", ") });
}

// ---------- POST /auth/change-password ----------
async function handleChangePassword(request, env) {
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const { current_password, new_password } = body;
    if (!current_password || !new_password) {
        return json({ success: false, error: "Current password and new password are required" }, 400);
    }

    if (new_password.length < 8) {
        return json({ success: false, error: "New password must be at least 8 characters" }, 400);
    }

    // Get session from cookie
    const cookies = parseCookies(request.headers.get("Cookie"));
    const token = cookies[COOKIE_SESSION];
    if (!token) {
        return json({ success: false, error: "Not authenticated" }, 401);
    }

    const session = await verifyJWT(token, env.JWT_SECRET);
    if (!session) {
        return json({ success: false, error: "Session expired" }, 401);
    }

    // Verify current password
    const user = await env.DB.prepare(
        "SELECT password_hash, password_salt FROM users WHERE email = ?"
    ).bind(session.email).first();

    if (!user) {
        return json({ success: false, error: "User not found" }, 404);
    }

    const valid = await verifyPassword(current_password, user.password_hash, user.password_salt);
    if (!valid) {
        return json({ success: false, error: "Current password is incorrect" }, 401);
    }

    // Hash new password and update
    const { salt, hash } = await hashPassword(new_password);
    await env.DB.prepare(
        "UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE email = ?"
    ).bind(hash, salt, session.email).run();

    return json({ success: true });
}

// ---------- GET /auth/session ----------
async function handleSession(request, env) {
    const cookies = parseCookies(request.headers.get("Cookie"));
    const token = cookies[COOKIE_SESSION];

    if (!token) {
        return json({ authenticated: false }, 401);
    }

    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) {
        return json({ authenticated: false }, 401);
    }

    return json({
        authenticated: true,
        user: {
            email: payload.email,
            org_id: payload.org_id,
            role: payload.role,
            must_change_password: payload.must_change_password === true
        }
    }, 200);
}

// ---------- POST /auth/logout ----------
async function handleLogout() {
    const headers = {
        "Set-Cookie": `${clearCookie(COOKIE_SESSION)}, ${clearCookie(COOKIE_REFRESH)}`
    };
    return json({ success: true }, 200, headers);
}

// ---------- POST /auth/refresh ----------
async function handleRefresh(request, env) {
    const cookies = parseCookies(request.headers.get("Cookie"));
    const refreshToken = cookies[COOKIE_REFRESH];

    if (!refreshToken) {
        return json({ success: false, error: "No refresh token" }, 401);
    }

    const payload = await verifyJWT(refreshToken, env.JWT_SECRET);
    if (!payload || payload.type !== "refresh") {
        return json({ success: false, error: "Invalid or expired refresh token" }, 401);
    }

    // Look up user to get current role and status
    const result = await env.DB.prepare(`
        SELECT u.email, u.org_id, u.is_active,
               o.status AS org_status,
               r.name AS role_name
        FROM users u
        JOIN organizations o ON u.org_id = o.id
        JOIN roles r ON u.role_id = r.id
        WHERE u.email = ?
    `).bind(payload.email).first();

    if (!result || !result.is_active || result.org_status !== "active") {
        return json({ success: false, error: "Account or organization is no longer active" }, 401);
    }

    // Issue new session JWT
    const sessionToken = await signJWT(
        {
            sub: result.email,
            email: result.email,
            org_id: result.org_id,
            role: result.role_name,
            must_change_password: false
        },
        env.JWT_SECRET,
        SESSION_LIFETIME
    );

    return json({ success: true }, 200, {
        "Set-Cookie": buildCookie(COOKIE_SESSION, sessionToken, SESSION_LIFETIME)
    });
}

// ============================================================
// Main worker entry
// ============================================================
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // CORS
        if (method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Cookie",
                    "Access-Control-Allow-Credentials": "true"
                }
            });
        }

        // Route matching
        if (path === "/auth/login" && method === "POST")
            return handleLogin(request, env);
        if (path === "/auth/change-password" && method === "POST")
            return handleChangePassword(request, env);
        if (path === "/auth/session" && method === "GET")
            return handleSession(request, env);
        if (path === "/auth/logout" && method === "POST")
            return handleLogout();
        if (path === "/auth/refresh" && method === "POST")
            return handleRefresh(request, env);

        return json({ error: "Not found" }, 404);
    }
};

