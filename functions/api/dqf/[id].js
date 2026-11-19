// functions/api/dqf/[id].js — DQF profile update endpoint
// Handles: PUT /api/dqf/:id

function base64UrlDecode(str) {
  let input = str.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  const bin = atob(input);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, base64UrlDecode(sigB64), new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return cookies;
}

async function getOrgId(request, env) {
  const url = new URL(request.url);
  let orgId = request.headers.get('x-org-id') || request.headers.get('x-customer-id');
  if (!orgId) {
    orgId = url.searchParams.get('org_id') || url.searchParams.get('orgId') || url.searchParams.get('customerId') || url.searchParams.get('customer_id');
  }
  if (env.JWT_SECRET) {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies['driv_en_session'];
    if (token) {
      const payload = await verifyJWT(token, env.JWT_SECRET);
      if (payload && !orgId) {
        orgId = payload.org_id || payload.orgId;
      }
    }
  }
  if (!orgId || orgId === 'null' || orgId === 'undefined') orgId = 'org_test';
  return orgId;
}

function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;

  if (method !== 'PUT' && method !== 'PATCH') {
    return jsonResp({ error: 'Method not allowed' }, 405);
  }

  const driverId = params.id;
  if (!driverId) return jsonResp({ error: 'Driver ID required' }, 400);

  const orgId = await getOrgId(request, env);

  let body;
  try { body = await request.json(); } catch(e) { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const allowedFields = ['full_name','first_name','last_name','email','role_id','employee_number','phone','cdl_class','cdl_endorsements','is_commercial_driver','step2_status','compliance_entry_mode','driving_record_verified','driving_record_recheck_date','driving_record_status','driving_record_doc','medical_card_expiration','medical_card_status','medical_card_doc','background_check_date','background_check_recheck','background_check_status','drug_test_date','drug_test_recheck','drug_test_status','auto_policy_status','dl_photo_front','dl_photo_back','dqf_application_date','dqf_application_doc','dqf_emp_verification_date','dqf_emp_verification_status','dqf_emp_verification_notes','dqf_emp_verification_doc','dqf_annual_mvr_date','dqf_annual_mvr_reviewer','dqf_annual_mvr_notes','dqf_annual_mvr_doc','dqf_annual_violations_date','dqf_annual_violations_cert','dqf_annual_violations_details','dqf_road_test_date','dqf_road_test_examiner','dqf_road_test_vehicle','dqf_road_test_equiv','dqf_road_test_doc','dqf_preemp_drug_date','dqf_preemp_drug_result','dqf_preemp_drug_doc','dqf_drug_test_reason','dqf_alcohol_test_date','dqf_alcohol_test_reason','dqf_alcohol_test_result','dqf_alcohol_test_doc','dqf_medex_name','dqf_medex_registry','dqf_medex_phone','dqf_medex_address','dqf_med_variance','dqf_med_variance_num','dqf_cdlis_date','dqf_cdlis_result','dqf_cdlis_doc','dqf_safety_perf_date','dqf_safety_perf_result','dqf_safety_perf_doc','dqf_hazmat_date','dqf_hazmat_result','dqf_hazmat_doc','dqf_twic_num','dqf_twic_exp','dqf_twic_doc','dqf_additional_docs','location','project_id','project_name','unit_system'];

  const sets = [];
  const values = [];
  for (const [key, val] of Object.entries(body)) {
    if (allowedFields.includes(key)) {
      const cleanVal = (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) ? null : val;
      sets.push(key + ' = ?');
      values.push(cleanVal);
    }
  }

  if (sets.length === 0) {
    return jsonResp({ error: 'No valid fields to update', received: Object.keys(body) }, 400);
  }

  sets.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(driverId);
  values.push(orgId);

  try {
    await env.DB.prepare("UPDATE users SET " + sets.join(', ') + " WHERE id = ? AND org_id = ?").bind(...values).run();
    return jsonResp({ success: true, updated: sets.length - 1 });
  } catch(e) {
    return jsonResp({ error: 'Database error: ' + e.message }, 500);
  }
}
