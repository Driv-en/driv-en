export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;

  if (method !== 'PUT' && method !== 'PATCH') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const driverId = params.id;
  if (!driverId) {
    return new Response(JSON.stringify({ error: 'Driver ID required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Auth: read org_id from JWT cookie or header
  let orgId = null;
  try {
    const cookie = request.headers.get('Cookie') || '';
    const jwtMatch = cookie.match(/token=([^;]+)/);
    if (jwtMatch) {
      const payload = JSON.parse(atob(jwtMatch[1].split('.')[1]));
      orgId = payload.org_id || payload.orgId;
    }
  } catch(e) {}
  if (!orgId) orgId = request.headers.get('x-org-id');
  if (!orgId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let body;
  try { body = await request.json(); } catch(e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

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
    return new Response(JSON.stringify({ error: 'No valid fields to update', received: Object.keys(body) }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  sets.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(driverId);
  values.push(orgId);

  try {
    await env.DB.prepare("UPDATE users SET " + sets.join(', ') + " WHERE id = ? AND org_id = ?").bind(...values).run();
    return new Response(JSON.stringify({ success: true, updated: sets.length - 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ error: 'Database error: ' + e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
