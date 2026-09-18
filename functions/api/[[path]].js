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
  'org-settings':      'https://driven-fuel.driv-en.workers.dev',

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

  // Onboarding (legacy Airtable API worker)
  'onboarding':        'https://driv-en-api.driv-en.workers.dev',
  'Division':          'https://driv-en-api.driv-en.workers.dev',
  'Clients':           'https://driv-en-api.driv-en.workers.dev',
  'Project':           'https://driv-en-api.driv-en.workers.dev',
  'Employee':          'https://driv-en-api.driv-en.workers.dev',
  'Equipment':         'https://driv-en-api.driv-en.workers.dev',
};

function findWorkerUrl(path) {
  const parts = path.replace(/^\/api\//, '').split('/');
  const prefix = parts[0];

  if (WORKER_ROUTES[prefix]) {
    return WORKER_ROUTES[prefix] + '/' + parts.join('/');
  }

  const plural = prefix + 's';
  if (WORKER_ROUTES[plural]) {
    return WORKER_ROUTES[plural] + '/' + parts.join('/');
  }

  return null;
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

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

  if (path === '/api' || path === '/api/') {
    return new Response(JSON.stringify({
      success: true,
      service: 'DRIV-EN API Bridge',
      routes: Object.keys(WORKER_ROUTES),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

  const proxyUrl = targetUrl + (url.search || '');

  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.delete('host');

  const proxyOptions = {
    method: request.method,
    headers: proxyHeaders,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    proxyOptions.body = await request.arrayBuffer();
  }

  try {
    const response = await fetch(proxyUrl, proxyOptions);

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
