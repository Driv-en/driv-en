// ═══════════════════════════════════════════════════════════════
// DRIV-EN Pages Functions — /api/* proxy bridge
// Forwards all /api/* requests to the correct D1-backed Worker.
// The session cookie (driv_en_session) is forwarded automatically.
// ═══════════════════════════════════════════════════════════════

// Route map: /api/{prefix}/* → worker URL
const WORKER_ROUTES = {
  // Fuel worker
  'fuel-tanks':        'https://driven-fuel.driv-en.workers.dev',
  'fuel-transactions': 'https://driven-fuel.driv-en.workers.dev',
  'fuel-receipts':     'https://driven-fuel.driv-en.workers.dev',
  'fuel-flags':        'https://driven-fuel.driv-en.workers.dev',
  'fuel-purchases':    'https://driven-fuel.driv-en.workers.dev',
  'fuel-tank-types':   'https://driven-fuel.driv-en.workers.dev',
  'org-settings':      'https://driven-fuel.driv-en.workers.dev',
  'log-error':         'https://driven-fuel.driv-en.workers.dev',
  'module-subscriptions': 'https://driven-fuel.driv-en.workers.dev',

  // Equipment config worker
  'assets':            'https://driven-equipment-config.driv-en.workers.dev',

  // Transfers worker
  'carriers':          'https://driven-transfers.driv-en.workers.dev',
  'transfers':         'https://driven-transfers.driv-en.workers.dev',

  // Work orders worker
  'work-orders':            'https://driven-work-orders.driv-en.workers.dev',
  'work-order-templates':   'https://driven-work-orders.driv-en.workers.dev',

  // Projects worker
  'projects':          'https://driven-projects.driv-en.workers.dev',

  // Extraction worker
  'extract':           'https://driven-extraction.driv-en.workers.dev',

  // Platform worker
  'error-log':         'https://driven-platform.driv-en.workers.dev',
  'users':             'https://driven-platform.driv-en.workers.dev',
  'permissions':       'https://driven-platform.driv-en.workers.dev',

  // Equipment types worker
  'equipment-types':   'https://driven-equipment-types.driv-en.workers.dev',

  // Asset groups worker
  'asset-groups':      'https://driven-asset-groups.driv-en.workers.dev',

  // Templates worker
  'inspection-templates': 'https://driven-templates.driv-en.workers.dev',
  'pm-templates':        'https://driven-templates.driv-en.workers.dev',

  // Meter update worker
  'meter-update':      'https://driven-meter-update.driv-en.workers.dev',

  // Inspection complete worker
  'inspection-complete': 'https://driven-inspection-complete.driv-en.workers.dev',

  // PM complete worker
  'pm-complete':       'https://driven-pm-complete.driv-en.workers.dev',

  // Onboarding key-personnel worker (roles, permissions, key personnel)
  'onboarding':        'https://onboarding-key-personnel.driv-en.workers.dev',

  // Legacy API worker (CRUD for D1 tables) — workers.dev now enabled
  'Division':          'https://driv-en-api.driv-en.workers.dev',
  'Clients':           'https://driv-en-api.driv-en.workers.dev',
  'Project':           'https://driv-en-api.driv-en.workers.dev',
  'Employee':          'https://driv-en-api.driv-en.workers.dev',
  'Equipment':         'https://driv-en-api.driv-en.workers.dev',

};

function findWorkerUrl(path) {
  const parts = path.replace(/^\//, '').split('/');
  const prefix = parts[0] === 'api' ? parts[1] : parts[0];

  if (WORKER_ROUTES[prefix]) {
    var pathParts = parts.filter(function(p) { return p !== 'api'; });
    // driv-en-api worker expects /api/ prefix; other workers don't
    if (WORKER_ROUTES[prefix].indexOf('driv-en-api') !== -1) {
      return WORKER_ROUTES[prefix] + '/api/' + pathParts.join('/');
    }
    return WORKER_ROUTES[prefix] + '/' + pathParts.join('/');
  }

  const plural = prefix + 's';
  if (WORKER_ROUTES[plural]) {
    var pathParts = parts.filter(function(p) { return p !== 'api'; });
    if (WORKER_ROUTES[plural].indexOf('driv-en-api') !== -1) {
      return WORKER_ROUTES[plural] + '/api/' + pathParts.join('/');
    }
    return WORKER_ROUTES[plural] + '/' + pathParts.join('/');
  }

  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // ── Turnstile verification (handled locally — no worker proxy) ──
  if (path === '/api/verify-turnstile') {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const token = body.token || '';
        const secret = env.TURNSTILE_SECRET_KEY;
        if (!token) {
          return new Response(JSON.stringify({ success: false, error: 'Missing Turnstile token' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
        if (!secret) {
          return new Response(JSON.stringify({ success: false, error: 'Turnstile secret not configured', debug: { envKeys: Object.keys(env || {}) } }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'secret=' + encodeURIComponent(secret) + '&response=' + encodeURIComponent(token),
        });
        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        } else {
          return new Response(JSON.stringify({ success: false, error: 'Turnstile verification failed' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid request body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
  }

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Health check
  if (path === '/api' || path === '/api/') {
    return new Response(JSON.stringify({
      success: true,
      service: 'DRIV-EN API Bridge',
      routes: Object.keys(WORKER_ROUTES),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Find the target worker URL
  const targetUrl = findWorkerUrl(path);

  if (!targetUrl) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unknown API route: ' + path,
      availableRoutes: Object.keys(WORKER_ROUTES),
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build the proxied request — preserve method, headers, body, query string
  const proxyUrl = targetUrl + (url.search || '');

  const proxyHeaders = new Headers(request.headers);
  // Remove host header so fetch uses the worker URL
  proxyHeaders.delete('host');
  // Cookie forwarding is automatic in Pages Functions (same-origin)

  const proxyOptions = {
    method: request.method,
    headers: proxyHeaders,
  };

  // Forward body for POST/PUT/PATCH/DELETE
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Stream the raw body directly (ReadableStream passthrough).
    // This preserves the multipart boundary AND the file metadata (filename,
    // content-type) embedded in the multipart Content-Disposition headers.
    // Using arrayBuffer() causes fetch() to re-encode the body and strip
    // filenames, making formData.get("file") return a string instead of a File.
    proxyOptions.body = request.body;
  }

  try {
    const response = await fetch(proxyUrl, proxyOptions);

    // Return the response with CORS headers
    const respHeaders = new Headers(response.headers);
    respHeaders.set('Access-Control-Allow-Origin', '*');
    respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    respHeaders.set('Access-Control-Allow-Headers', 'Content-Type');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Proxy error: ' + e.message,
      target: proxyUrl,
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
