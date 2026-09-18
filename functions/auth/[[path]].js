// ═══════════════════════════════════════════════════════════════
// DRIV-EN Pages Functions — /auth/* proxy bridge
// Forwards all /auth/* requests to the driv-en-auth Worker.
// Session cookies are forwarded automatically (same-origin).
// ═══════════════════════════════════════════════════════════════

const AUTH_WORKER_URL = 'https://driv-en-auth.driv-en.workers.dev';

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

  const proxyUrl = AUTH_WORKER_URL + path + (url.search || '');

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
      error: 'Auth proxy error: ' + e.message,
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
