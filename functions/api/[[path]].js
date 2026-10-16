/**
 * Cloudflare Pages Function: /api/[[path]].js
 * Catch-all API proxy router that forwards incoming fetch requests to
 * their respective microservice workers.
 */

const WORKER_ROUTES = {
  // Auth worker (driv-en-auth)
  'auth':              'https://driv-en-auth.driv-en.workers.dev',
  'login':             'https://driv-en-auth.driv-en.workers.dev',
  'register':          'https://driv-en-auth.driv-en.workers.dev',
  'logout':            'https://driv-en-auth.driv-en.workers.dev',
  'session':           'https://driv-en-auth.driv-en.workers.dev',
  'me':                'https://driv-en-auth.driv-en.workers.dev',
  'refresh':           'https://driv-en-auth.driv-en.workers.dev',
  'forgot-password':   'https://driv-en-auth.driv-en.workers.dev',
  'reset-password':    'https://driv-en-auth.driv-en.workers.dev',
  'change-password':   'https://driv-en-auth.driv-en.workers.dev',
  'verify-email':      'https://driv-en-auth.driv-en.workers.dev',
  'resend-verify':     'https://driv-en-auth.driv-en.workers.dev',
  '2fa':               'https://driv-en-auth.driv-en.workers.dev',

  // DRIV-EN API Worker (driv-en-api — Project, Clients, Division, Equipment, Asset Types, Users, Roles, AuditLog)
  'project':           'https://driv-en-api.driv-en.workers.dev',
  'projects':          'https://driv-en-api.driv-en.workers.dev',
  'clients':           'https://driv-en-api.driv-en.workers.dev',
  'division':          'https://driv-en-api.driv-en.workers.dev',
  'equipment':         'https://driv-en-api.driv-en.workers.dev',
  'asset-types':       'https://driv-en-api.driv-en.workers.dev',
  'log-error':         'https://driv-en-api.driv-en.workers.dev',

  // Onboarding & Key Personnel worker (onboarding-key-personnel)
  'onboarding':        'https://onboarding-key-personnel.driv-en.workers.dev',

  // Platform worker (driven-platform)
  'error-log':         'https://driven-platform.driv-en.workers.dev',
  'users':             'https://driven-platform.driv-en.workers.dev',
  'permissions':       'https://driven-platform.driv-en.workers.dev',
  'audit-log':         'https://driven-platform.driv-en.workers.dev',
  'project-assignments': 'https://driven-platform.driv-en.workers.dev',
  'user-activity':     'https://driven-platform.driv-en.workers.dev',
  'admin-safeguard':   'https://driven-platform.driv-en.workers.dev',

  // Referral workers (driven-referral-api & driven-referral-signup)
  'referral':          'https://driven-referral-api.driv-en.workers.dev',
  'referral-signup':   'https://driven-referral-signup.driv-en.workers.dev',
  'partners':          'https://driven-referral-api.driv-en.workers.dev'
};

/**
 * Main onRequest handler for Pages Functions
 */
export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);

  // Handle CORS preflight OPTIONS requests immediately
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-org-id, x-user-id',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Extract path components (params.path contains sub-path segments after /api/)
  const pathSegments = params.path || [];
  const primaryRoute = pathSegments[0] ? pathSegments[0].toLowerCase() : '';

  // Find target worker base URL
  const targetWorkerBase = WORKER_ROUTES[primaryRoute];

  if (!targetWorkerBase) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Unknown API route: /api/${primaryRoute}`,
        availableRoutes: Object.keys(WORKER_ROUTES)
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Construct target URL — preserve /api/ prefix and exact path segment casing
  const fullPath = pathSegments.join('/');
  const targetUrl = `${targetWorkerBase}/api/${fullPath}${url.search}`;

  // Clone headers and remove host header
  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.delete('host');

  const proxyOptions = {
    method: request.method,
    headers: proxyHeaders
  };

  // Pass through request body for non-GET/HEAD methods
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    proxyOptions.body = request.body;
  }

  try {
    const response = await fetch(targetUrl, proxyOptions);

    // Attach CORS headers to proxy response
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-org-id, x-user-id');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Proxy Error: ' + error.message,
        target: targetUrl
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
