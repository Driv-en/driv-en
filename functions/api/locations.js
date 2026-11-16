// /functions/api/locations.js
// Dedicated handler for /api/locations — bypasses the [[path]].js router

export async function onRequestGet(context) {
  const { request, env } = context;

  let orgId = 'org_test';
  try {
    const cookie = request.headers.get('Cookie') || '';
    const sessionMatch = cookie.match(/driv_en_session=([^;]+)/);
    if (sessionMatch) {
      const payload = JSON.parse(atob(sessionMatch[1].split('.')[1]));
      if (payload.org_id) orgId = payload.org_id;
    }
  } catch (e) {}

  try {
    const result = await env.DB.prepare(
      'SELECT id, org_id, name, code, type, address, city, state, zip_code, division, status, notes, created_at, created_by, updated_at, updated_by FROM locations WHERE org_id = ? ORDER BY created_at DESC'
    ).bind(orgId).all();

    const records = (result.results || []).map(function(row) {
      const fields = {};
      if (row.name !== undefined) { fields['Location Name'] = row.name; fields.name = row.name; }
      if (row.code !== undefined) { fields['Location Code'] = row.code; fields.code = row.code; }
      if (row.type !== undefined) { fields['Type'] = row.type; fields.type = row.type; }
      if (row.address !== undefined) { fields['Address'] = row.address; fields.address = row.address; }
      if (row.city !== undefined) { fields['City'] = row.city; fields.city = row.city; }
      if (row.state !== undefined) { fields['State'] = row.state; fields.state = row.state; }
      if (row.zip_code !== undefined) { fields['Zip Code'] = row.zip_code; fields.zip_code = row.zip_code; }
      if (row.division !== undefined) { fields['Division'] = row.division; fields.division = row.division; }
      if (row.status !== undefined) { fields['Status'] = row.status; fields.status = row.status; }
      if (row.notes !== undefined) { fields['Notes'] = row.notes; fields.notes = row.notes; }
      return { id: row.id, ...row, fields: fields };
    });

    return Response.json({
      success: true,
      records: records,
      data: records,
      locations: records
    }, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return Response.json({
      success: false,
      error: e.message,
      records: []
    }, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let orgId = 'org_test';
  let userId = 'unknown';
  try {
    const cookie = request.headers.get('Cookie') || '';
    const sessionMatch = cookie.match(/driv_en_session=([^;]+)/);
    if (sessionMatch) {
      const payload = JSON.parse(atob(sessionMatch[1].split('.')[1]));
      if (payload.org_id) orgId = payload.org_id;
      if (payload.user_id || payload.sub) userId = payload.user_id || payload.sub;
    }
  } catch (e) {}

  try {
    const body = await request.json();
    const name = body['Location Name'] || body.name || '';
    const code = body['Location Code'] || body.code || '';
    const type = body['Type'] || body.type || '';
    const address = body['Address'] || body.address || '';
    const city = body['City'] || body.city || '';
    const state = body['State'] || body.state || '';
    const zipCode = body['Zip Code'] || body.zip_code || body.zip || '';
    const division = body['Division'] || body.division || '';
    const status = body['Status'] || body.status || 'Active';
    const notes = body['Notes'] || body.notes || '';

    if (!name) {
      return Response.json({ success: false, error: 'Location name is required' }, { status: 400 });
    }

    const id = 'loc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    await env.DB.prepare(
      `INSERT INTO locations (id, org_id, name, code, type, address, city, state, zip_code, division, status, notes, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`
    ).bind(id, orgId, name, code, type, address, city, state, zipCode, division, status, notes, userId).run();

    return Response.json({ success: true, id: id, record: { id, org_id: orgId, name, code, type, address, city, state, zip_code: zipCode, division, status, notes, fields: { 'Location Name': name, 'Location Code': code, 'Type': type, 'Address': address, 'City': city, 'State': state, 'Zip Code': zipCode, 'Division': division, 'Status': status, 'Notes': notes } } }, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;

  let orgId = 'org_test';
  let userId = 'unknown';
  try {
    const cookie = request.headers.get('Cookie') || '';
    const sessionMatch = cookie.match(/driv_en_session=([^;]+)/);
    if (sessionMatch) {
      const payload = JSON.parse(atob(sessionMatch[1].split('.')[1]));
      if (payload.org_id) orgId = payload.org_id;
      if (payload.user_id || payload.sub) userId = payload.user_id || payload.sub;
    }
  } catch (e) {}

  try {
    const body = await request.json();
    const locId = body.id || body.Id || '';
    if (!locId) {
      return Response.json({ success: false, error: 'Location ID is required' }, { status: 400 });
    }

    const name = body['Location Name'] || body.name || '';
    const code = body['Location Code'] || body.code || '';
    const type = body['Type'] || body.type || '';
    const address = body['Address'] || body.address || '';
    const city = body['City'] || body.city || '';
    const state = body['State'] || body.state || '';
    const zipCode = body['Zip Code'] || body.zip_code || body.zip || '';
    const division = body['Division'] || body.division || '';
    const status = body['Status'] || body.status || 'Active';
    const notes = body['Notes'] || body.notes || '';

    await env.DB.prepare(
      `UPDATE locations SET name = ?, code = ?, type = ?, address = ?, city = ?, state = ?, zip_code = ?, division = ?, status = ?, notes = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ? AND org_id = ?`
    ).bind(name, code, type, address, city, state, zipCode, division, status, notes, userId, locId, orgId).run();

    return Response.json({ success: true }, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;

  let orgId = 'org_test';
  try {
    const cookie = request.headers.get('Cookie') || '';
    const sessionMatch = cookie.match(/driv_en_session=([^;]+)/);
    if (sessionMatch) {
      const payload = JSON.parse(atob(sessionMatch[1].split('.')[1]));
      if (payload.org_id) orgId = payload.org_id;
    }
  } catch (e) {}

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const locId = pathParts[pathParts.length - 1];
    if (!locId) {
      return Response.json({ success: false, error: 'Location ID is required' }, { status: 400 });
    }

    await env.DB.prepare('DELETE FROM locations WHERE id = ? AND org_id = ?').bind(locId, orgId).run();
    return Response.json({ success: true }, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
