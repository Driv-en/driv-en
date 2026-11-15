// /functions/api/clients.js
// Dedicated handler for /api/clients — bypasses the [[path]].js router

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
      'SELECT id, client_name, contact_name, contact_email, contact_phone, company, address, city, state, zip_code, country, industry, status, notes, created_at FROM clients WHERE org_id = ? ORDER BY created_at DESC'
    ).bind(orgId).all();

    const records = (result.results || []).map(function(row) {
      const fields = {};
      if (row.client_name !== undefined) { fields['Client Name'] = row.client_name; fields.client_name = row.client_name; }
      if (row.contact_name !== undefined) { fields['Contact Name'] = row.contact_name; fields.contact_name = row.contact_name; }
      if (row.contact_email !== undefined) { fields['Contact Email'] = row.contact_email; fields.contact_email = row.contact_email; }
      if (row.contact_phone !== undefined) { fields['Contact Phone'] = row.contact_phone; fields.contact_phone = row.contact_phone; }
      if (row.company !== undefined) { fields['Company'] = row.company; fields.company = row.company; }
      if (row.address !== undefined) { fields['Address'] = row.address; fields.address = row.address; }
      if (row.city !== undefined) { fields['City'] = row.city; fields.city = row.city; }
      if (row.state !== undefined) { fields['State'] = row.state; fields.state = row.state; }
      if (row.zip_code !== undefined) { fields['Zip Code'] = row.zip_code; fields.zip_code = row.zip_code; }
      if (row.country !== undefined) { fields['Country'] = row.country; fields.country = row.country; }
      if (row.industry !== undefined) { fields['Industry'] = row.industry; fields.industry = row.industry; }
      if (row.status !== undefined) { fields['Status'] = row.status; fields.status = row.status; }
      if (row.notes !== undefined) { fields['Notes'] = row.notes; fields.notes = row.notes; }
      return { id: row.id, ...row, fields: fields };
    });

    return Response.json({
      success: true,
      records: records,
      data: records,
      clients: records
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
    const clientName = body['Client Name'] || body.client_name || body.name || '';
    const contactName = body['Contact Name'] || body.contact_name || '';
    const contactEmail = body['Contact Email'] || body.contact_email || '';
    const contactPhone = body['Contact Phone'] || body.contact_phone || '';
    const company = body['Company'] || body.company || '';
    const address = body['Address'] || body.address || '';
    const city = body['City'] || body.city || '';
    const state = body['State'] || body.state || '';
    const zipCode = body['Zip Code'] || body.zip_code || body.zip || '';
    const country = body['Country'] || body.country || '';
    const industry = body['Industry'] || body.industry || '';
    const status = body['Status'] || body.status || 'Active';
    const notes = body['Notes'] || body.notes || '';
    
    if (!clientName) {
      return Response.json({ success: false, error: 'Client name is required' }, { status: 400 });
    }
    
    const id = 'cli_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    
    await env.DB.prepare(
      `INSERT INTO clients (id, org_id, user_id, client_name, contact_name, contact_email, contact_phone, company, address, city, state, zip_code, country, industry, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(id, orgId, userId, clientName, contactName, contactEmail, contactPhone, company, address, city, state, zipCode, country, industry, status, notes).run();
    
    return Response.json({ success: true, id: id }, { headers: { 'Content-Type': 'application/json' } });
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
    const clientId = body.id || body.Id || '';
    
    if (!clientId) {
      return Response.json({ success: false, error: 'Client ID is required' }, { status: 400 });
    }
    
    const clientName = body['Client Name'] || body.client_name || body.name || '';
    const contactName = body['Contact Name'] || body.contact_name || '';
    const contactEmail = body['Contact Email'] || body.contact_email || '';
    const contactPhone = body['Contact Phone'] || body.contact_phone || '';
    const company = body['Company'] || body.company || '';
    const address = body['Address'] || body.address || '';
    const city = body['City'] || body.city || '';
    const state = body['State'] || body.state || '';
    const zipCode = body['Zip Code'] || body.zip_code || body.zip || '';
    const country = body['Country'] || body.country || '';
    const industry = body['Industry'] || body.industry || '';
    const status = body['Status'] || body.status || 'Active';
    const notes = body['Notes'] || body.notes || '';
    
    await env.DB.prepare(
      `UPDATE clients SET client_name = ?, contact_name = ?, contact_email = ?, contact_phone = ?, company = ?, address = ?, city = ?, state = ?, zip_code = ?, country = ?, industry = ?, status = ?, notes = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ? AND org_id = ?`
    ).bind(clientName, contactName, contactEmail, contactPhone, company, address, city, state, zipCode, country, industry, status, notes, userId, clientId, orgId).run();
    
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
    const clientId = pathParts[pathParts.length - 1];
    
    if (!clientId) {
      return Response.json({ success: false, error: 'Client ID is required' }, { status: 400 });
    }
    
    await env.DB.prepare(
      'DELETE FROM clients WHERE id = ? AND org_id = ?'
    ).bind(clientId, orgId).run();
    
    return Response.json({ success: true }, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
