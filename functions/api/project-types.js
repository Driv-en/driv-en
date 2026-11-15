// /functions/api/project-types.js
// Dedicated handler for /api/project-types — bypasses the [[path]].js router

export async function onRequestGet(context) {
  const { request, env } = context;
  
  // Extract org_id from session cookie
  let orgId = 'org_test';
  try {
    const cookie = request.headers.get('Cookie') || '';
    const sessionMatch = cookie.match(/driv_en_session=([^;]+)/);
    if (sessionMatch) {
      const payload = JSON.parse(atob(sessionMatch[1].split('.')[1]));
      if (payload.org_id) orgId = payload.org_id;
    }
  } catch (e) {
    // Fall back to org_test
  }

  try {
    const result = await env.DB.prepare(
      'SELECT id, name, code, description, status, created_at FROM project_types WHERE org_id = ? ORDER BY created_at DESC'
    ).bind(orgId).all();

    const records = (result.results || []).map(function(row) {
      const fields = {};
      if (row.name !== undefined) { fields['Project Type Name'] = row.name; fields.name = row.name; }
      if (row.code !== undefined) { fields['Code'] = row.code; fields.code = row.code; }
      if (row.description !== undefined) { fields['Description'] = row.description; fields.description = row.description; }
      if (row.status !== undefined) { fields['Status'] = row.status; fields.status = row.status; }
      return { id: row.id, ...row, fields: fields };
    });

    return Response.json({
      success: true,
      records: records,
      data: records,
      projectTypes: records
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
  try {
    const cookie = request.headers.get('Cookie') || '';
    const sessionMatch = cookie.match(/driv_en_session=([^;]+)/);
    if (sessionMatch) {
      const payload = JSON.parse(atob(sessionMatch[1].split('.')[1]));
      if (payload.org_id) orgId = payload.org_id;
    }
  } catch (e) {}

  try {
    const body = await request.json();
    const name = body['Project Type Name'] || body.name || body.project_type_name || '';
    const code = body['Code'] || body.code || '';
    const description = body['Description'] || body.description || '';
    const status = body['Status'] || body.status || 'Active';
    
    if (!name) {
      return Response.json({ success: false, error: 'Name is required' }, { status: 400 });
    }
    
    const id = 'pt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    
    await env.DB.prepare(
      'INSERT INTO project_types (id, org_id, name, code, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))'
    ).bind(id, orgId, name, code, description, status).run();
    
    return Response.json({ success: true, id: id }, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
