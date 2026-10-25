export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-org-id'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  if (method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const orgId = request.headers.get('x-org-id') || 'org_dsi';

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'Database binding env.DB not found' }), { status: 500, headers });
    }

    // Query D1 table for both global 'system' options and organization-specific overrides
    const { results } = await env.DB.prepare(`
      SELECT category, option_value, option_label 
      FROM configuration_options 
      WHERE org_id = ? OR org_id = 'system'
      ORDER BY category, sort_order ASC, option_label ASC
    `).bind(orgId).all();

    // Group options by category key (e.g. cab_type, drive_configuration, pto_setup)
    const groupedOptions = {};
    for (const row of results || []) {
      if (!groupedOptions[row.category]) {
        groupedOptions[row.category] = [];
      }
      groupedOptions[row.category].push({
        value: row.option_value,
        label: row.option_label
      });
    }

    return new Response(JSON.stringify(groupedOptions), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500, headers });
  }
}
