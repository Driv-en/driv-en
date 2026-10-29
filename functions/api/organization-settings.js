export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-org-id'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  const orgId = request.headers.get('x-org-id') || url.searchParams.get('org_id') || 'org_test';

  if (method === 'GET') {
    try {
      let row = null;
      if (env.DB) {
        row = await env.DB.prepare('SELECT * FROM org_settings WHERE org_id = ?').bind(orgId).first();
      }

      const defaultSettings = {
        org_id: orgId,
        country: 'US',
        volume_unit: 'gal',
        pressure_unit: 'psi',
        distance_unit: 'mi',
        timezone: 'America/New_York',
        currency: 'USD'
      };

      return new Response(JSON.stringify({
        success: true,
        settings: row || defaultSettings,
        record: row || defaultSettings
      }), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({
        success: true,
        settings: { org_id: orgId, country: 'US', volume_unit: 'gal', pressure_unit: 'psi', distance_unit: 'mi' }
      }), { status: 200, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}
