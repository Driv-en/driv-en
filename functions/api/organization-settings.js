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

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding env.DB not found' }), { status: 500, headers });
  }

  try {
    // ─── GET: FETCH ORGANIZATION SETTINGS ───────────────────── ──────
    if (method === 'GET') {
      const row = await env.DB.prepare(
        'SELECT * FROM org_settings WHERE org_id = ?'
      ).bind(orgId).first();

      const defaultSettings = {
        org_id: orgId,
        country: 'US',
        volume_unit: 'gal',
        pressure_unit: 'psi',
        distance_unit: 'mi',
        timezone: 'America/New_York',
        currency: 'USD'
      };

      const settings = row || defaultSettings;
      return new Response(JSON.stringify({
        success: true,
        settings: settings,
        record: settings
      }), { status: 200, headers });
    }

    // ─── PUT / POST: UPSERT ORGANIZATION SETTINGS ───────────────────
    if (method === 'PUT' || method === 'POST') {
      const body = await request.json();
      const id = body.id || `org_set_${orgId}`;

      const name = body.name !== undefined ? body.name : null;
      const country = body.country || 'US';
      const volumeUnit = body.volume_unit || body.volumeUnit || 'gal';
      const pressureUnit = body.pressure_unit || body.pressureUnit || 'psi';
      const distanceUnit = body.distance_unit || body.distanceUnit || 'mi';
      const timezone = body.timezone || 'America/New_York';
      const currency = body.currency || 'USD';

      await env.DB.prepare(`
        INSERT INTO org_settings (
          id, org_id, name, country, volume_unit, pressure_unit, distance_unit, timezone, currency, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
        )
        ON CONFLICT(org_id) DO UPDATE SET
          name = excluded.name,
          country = excluded.country,
          volume_unit = excluded.volume_unit,
          pressure_unit = excluded.pressure_unit,
          distance_unit = excluded.distance_unit,
          timezone = excluded.timezone,
          currency = excluded.currency,
          updated_at = CURRENT_TIMESTAMP
      `).bind(id, orgId, name, country, volumeUnit, pressureUnit, distanceUnit, timezone, currency).run();

      const updatedRow = await env.DB.prepare(
        'SELECT * FROM org_settings WHERE org_id = ?'
      ).bind(orgId).first();

      return new Response(JSON.stringify({
        success: true,
        message: 'Organization settings saved successfully',
        settings: updatedRow,
        record: updatedRow
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405, headers });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Failed to process organization settings request'
    }), { status: 500, headers });
  }
}
