export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-org-id'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  const orgId = request.headers.get('x-org-id') || 'org_dsi';
  const assetTypeName = url.searchParams.get('type');

  if (!assetTypeName) {
    return new Response(JSON.stringify({ error: "Missing required 'type' query parameter" }), { status: 400, headers });
  }

  try {
    if (method === 'GET') {
      const record = await env.DB.prepare(`
        SELECT * FROM asset_type_defaults 
        WHERE (org_id = ? OR org_id = 'system') AND asset_type_name = ?
        ORDER BY CASE WHEN org_id = ? THEN 1 ELSE 2 END
        LIMIT 1
      `).bind(orgId, assetTypeName, orgId).first();

      if (record && record.pm_schedules_json) {
        try {
          record.pm_schedules = JSON.parse(record.pm_schedules_json);
        } catch(e) {
          record.pm_schedules = [];
        }
      }

      return new Response(JSON.stringify({ success: true, record: record || null }), { status: 200, headers });
    }

    if (method === 'PUT') {
      const body = await request.json();
      const id = `atd_${orgId}_${assetTypeName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      await env.DB.prepare(`
        INSERT INTO asset_type_defaults (
          id, org_id, asset_type_name, make, model, year, serial_number,
          cab_type, cab_style, mobility_type, drive_configuration, transmission_type,
          wheel_setup, num_axles, fuel_type, pto_setup, winch_setup, winch_rating,
          aux_hydraulics, engine_oil_spec, hydraulic_fluid_spec, coolant_spec,
          def_capacity, fuel_capacity, transmission_fluid_spec, pm_schedules_json, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, CURRENT_TIMESTAMP
        )
        ON CONFLICT(org_id, asset_type_name) DO UPDATE SET
          make = excluded.make,
          model = excluded.model,
          year = excluded.year,
          serial_number = excluded.serial_number,
          cab_type = excluded.cab_type,
          cab_style = excluded.cab_style,
          mobility_type = excluded.mobility_type,
          drive_configuration = excluded.drive_configuration,
          transmission_type = excluded.transmission_type,
          wheel_setup = excluded.wheel_setup,
          num_axles = excluded.num_axles,
          fuel_type = excluded.fuel_type,
          pto_setup = excluded.pto_setup,
          winch_setup = excluded.winch_setup,
          winch_rating = excluded.winch_rating,
          aux_hydraulics = excluded.aux_hydraulics,
          engine_oil_spec = excluded.engine_oil_spec,
          hydraulic_fluid_spec = excluded.hydraulic_fluid_spec,
          coolant_spec = excluded.coolant_spec,
          def_capacity = excluded.def_capacity,
          fuel_capacity = excluded.fuel_capacity,
          transmission_fluid_spec = excluded.transmission_fluid_spec,
          pm_schedules_json = excluded.pm_schedules_json,
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        id, orgId, assetTypeName,
        body.make || null, body.model || null, body.year || null, body.serial_number || null,
        body.cab_type || null, body.cab_style || null, body.mobility_type || null, body.drive_configuration || null, body.transmission_type || null,
        body.wheel_setup || null, body.num_axles || null, body.fuel_type || null, body.pto_setup || null, body.winch_setup || null, body.winch_rating || null,
        body.aux_hydraulics || null, body.engine_oil_spec || null, body.hydraulic_fluid_spec || null, body.coolant_spec || null,
        body.def_capacity || null, body.fuel_capacity || null, body.transmission_fluid_spec || null,
        JSON.stringify(body.pm_schedules || [])
      ).run();

      return new Response(JSON.stringify({ success: true, message: "Asset type default configuration updated" }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
