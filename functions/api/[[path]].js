/**
 * Cloudflare Pages Function: /api/[[path]].js
 * Catch-all API proxy router that forwards incoming fetch requests to
 * their respective microservice workers.
 */

const WORKER_ROUTES = {
  // Auth worker
  'auth':              'https://driven-auth.driv-en.workers.dev',
  'login':             'https://driven-auth.driv-en.workers.dev',
  'register':          'https://driven-auth.driv-en.workers.dev',
  'logout':            'https://driven-auth.driv-en.workers.dev',
  'session':           'https://driven-auth.driv-en.workers.dev',
  'me':                'https://driven-auth.driv-en.workers.dev',
  'refresh':           'https://driven-auth.driv-en.workers.dev',
  'forgot-password':   'https://driven-auth.driv-en.workers.dev',
  'reset-password':    'https://driven-auth.driv-en.workers.dev',
  'change-password':   'https://driven-auth.driv-en.workers.dev',
  'verify-email':      'https://driven-auth.driv-en.workers.dev',
  'resend-verify':     'https://driven-auth.driv-en.workers.dev',
  '2fa':               'https://driven-auth.driv-en.workers.dev',

  // DRIV-EN API Worker (handles Project, Clients, Division, Equipment, Users, Roles, AuditLog)
  'project':           'https://driven-api.driv-en.workers.dev',
  'projects':          'https://driven-api.driv-en.workers.dev',
  'clients':           'https://driven-api.driv-en.workers.dev',
  'division':          'https://driven-api.driv-en.workers.dev',
  'log-error':         'https://driven-api.driv-en.workers.dev',

  // Onboarding / Key Personnel worker
  'onboarding':        'https://driven-api.driv-en.workers.dev',

  // Platform worker
  'equipment':         'https://driven-platform.driv-en.workers.dev',
  'error-log':         'https://driven-platform.driv-en.workers.dev',
  'users':             'https://driven-platform.driv-en.workers.dev',
  'permissions':       'https://driven-platform.driv-en.workers.dev',
  'audit-log':         'https://driven-platform.driv-en.workers.dev',

  // Employee Management worker
  'employees':         'https://driven-employees.driv-en.workers.dev',
  'departments':       'https://driven-employees.driv-en.workers.dev',

  // CRM / Customer Management worker
  'customers':         'https://driven-crm.driv-en.workers.dev',
  'contacts':          'https://driven-crm.driv-en.workers.dev',

  // Billing / Subscription worker
  'billing':           'https://driven-billing.driv-en.workers.dev',
  'invoices':          'https://driven-billing.driv-en.workers.dev',
  'subscriptions':     'https://driven-billing.driv-en.workers.dev',

  // Referral worker
  'referral':          'https://driven-referral.driv-en.workers.dev',
  'partners':          'https://driven-referral.driv-en.workers.dev'
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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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

  // Construct target URL — keep /api/ prefix and exact path segment casing
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
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
