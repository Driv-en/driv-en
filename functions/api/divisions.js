// /functions/api/divisions.js
// Dedicated handler for /api/divisions — bypasses the [[path]].js router

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
      'SELECT * FROM divisions WHERE org_id = ? ORDER BY rowid DESC'
    ).bind(orgId).all();

    const records = (result.results || []).map(function(row) {
      const fields = { ...row };  // raw D1 column names
      if (row.name !== undefined) { fields['Division Name'] = row.name; }
      if (row.code !== undefined) { fields['Division Code'] = row.code; }
      if (row.description !== undefined) { fields['Description'] = row.description; }
      if (row.manager !== undefined) { fields['Manager'] = row.manager; }
      if (row.status !== undefined) { fields['Status'] = row.status; }
      return { id: row.id, ...row, fields: fields };
    });

    return Response.json({
      success: true,
      records: records,
      data: records,
      divisions: records
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
    const name = body['Division Name'] || body.name || '';
    const code = body['Division Code'] || body.code || '';
    const description = body['Description'] || body.description || '';
    const manager = body['Manager'] || body.manager || '';
    const status = body['Status'] || body.status || 'Active';

    if (!name) {
      return Response.json({ success: false, error: 'Division name is required' }, { status: 400 });
    }

    const id = 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    await env.DB.prepare(
      `INSERT INTO divisions (id, org_id, name, code, description, manager, status, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`
    ).bind(id, orgId, name, code, description, manager, status, userId).run();

    return Response.json({ success: true, id: id, record: { id, org_id: orgId, name, code, description, manager, status, fields: { 'Division Name': name, 'Division Code': code, 'Description': description, 'Manager': manager, 'Status': status } } }, { headers: { 'Content-Type': 'application/json' } });
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
    const divId = body.id || body.Id || '';
    if (!divId) {
      return Response.json({ success: false, error: 'Division ID is required' }, { status: 400 });
    }

    const name = body['Division Name'] || body.name || '';
    const code = body['Division Code'] || body.code || '';
    const description = body['Description'] || body.description || '';
    const manager = body['Manager'] || body.manager || '';
    const status = body['Status'] || body.status || 'Active';

    await env.DB.prepare(
      `UPDATE divisions SET name = ?, code = ?, description = ?, manager = ?, status = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ? AND org_id = ?`
    ).bind(name, code, description, manager, status, userId, divId, orgId).run();

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
    const divId = pathParts[pathParts.length - 1];
    if (!divId) {
      return Response.json({ success: false, error: 'Division ID is required' }, { status: 400 });
    }

    await env.DB.prepare('DELETE FROM divisions WHERE id = ? AND org_id = ?').bind(divId, orgId).run();
    return Response.json({ success: true }, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
