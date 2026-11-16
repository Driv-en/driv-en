export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  // Normalize path by lowercasing and removing trailing slashes
  const path = url.pathname.toLowerCase().replace(/\/+$/, '') || '/';

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  // FUEL WORKER: forward fuel endpoints to the standalone fuel worker (service binding FUEL_WORKER).
  // The worker authenticates with the driv_en_session cookie, so the request is passed through unchanged.
  if (env.FUEL_WORKER && /^\/api\/(fuel-(tanks|transactions|purchases|receipts|flags|tank-types)|notifications|module-subscriptions)(\/|$)/.test(path)) {
    const workerUrl = new URL(request.url);
    workerUrl.pathname = workerUrl.pathname.replace(/^\/api/, '');
    return env.FUEL_WORKER.fetch(new Request(workerUrl.toString(), request));
  }

    // Forward VIN decode + recall tracking to the driv-en-vin-decode worker
  if (env.VIN_WORKER && /^\/api\/(vin-decode|recalls|assets\/[^/]+\/recalls)(\/|$)/i.test(path)) {
    return env.VIN_WORKER.fetch(new Request(request.url, request));
  }

  // Forward predictive maintenance endpoints to the driv-en-predictive worker
  if (env.PREDICTIVE_WORKER && /^\/api\/predictive(\/|$)/i.test(path)) {
    return env.PREDICTIVE_WORKER.fetch(new Request(request.url, request));
  }

  // Forward TCO endpoints to the driv-en-tco worker
  if (env.TCO_WORKER && /^\/api\/tco(\/|$)/i.test(path)) {
    return env.TCO_WORKER.fetch(new Request(request.url, request));
  }

  // Forward extraction endpoints to the driven-extraction worker
  if (/^\/api\/extract(\/|$)/i.test(path)) {
    if (env.EXTRACTION_WORKER) {
      const wUrl = new URL(request.url);
      wUrl.pathname = wUrl.pathname.replace(/^\/api\/extract/, '/extract');
      return env.EXTRACTION_WORKER.fetch(new Request(wUrl.toString(), request));
    }
    try {
      const extractUrl = new URL(request.url);
      extractUrl.hostname = 'driven-extraction.driv-en.workers.dev';
      extractUrl.pathname = extractUrl.pathname.replace(/^\/api\/extract/, '/extract');
      const reqHeaders = new Headers(request.headers);
      reqHeaders.set('Host', extractUrl.hostname);
      const proxyReq = new Request(extractUrl.toString(), {
        method: request.method,
        headers: reqHeaders,
        body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.body : null,
        redirect: 'manual',
      });
      const resp = await fetch(proxyReq);
      return resp;
    } catch(e) {
      return new Response(JSON.stringify({ success: false, error: 'Extraction worker unreachable: ' + e.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // ── Translate endpoints: proxy to driv-en-api worker (which has the AI binding) ──
  if (/^\/api\/translate(\/|$)/i.test(path)) {
    try {
      const apiUrl = new URL(request.url);
      apiUrl.hostname = 'driv-en-api.driv-en.workers.dev';
      const reqHeaders = new Headers(request.headers);
      reqHeaders.set('Host', apiUrl.hostname);
      const proxyReq = new Request(apiUrl.toString(), {
        method: request.method,
        headers: reqHeaders,
        body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.body : null,
        redirect: 'follow'
      });
      const response = await fetch(proxyReq);
      const respHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => respHeaders.set(k, v));
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders
      });
    } catch (err) {
      console.error('Translate proxy error:', err.message);
      return json({ success: false, error: 'Translation service unavailable' }, 502, request);
    }
  }

  // DIRECT DISPATCH: Send DVIR Officer Email via Resend
  if (
    path === '/api/send-dvir-email' || 
    path === '/send-dvir-email' || 
    path.endsWith('/send-dvir-email')
  ) {
    if (method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      const body = await request.json();
      const { officerEmail, powerUnit, trailer, driverSignature, location, status, defects, remarks } = body || {};

      if (!officerEmail || !officerEmail.trim()) {
        return json({ success: false, error: 'Officer email address is required.' }, 400);
      }

      const resendApiKey = env.RESEND_API_KEY;
      if (!resendApiKey) {
        return json({ success: false, error: 'RESEND_API_KEY environment variable is missing.' }, 500);
      }

      const ITEM_LABELS = {
        serviceBrakes: "Service Brakes (including trailer brake connections)",
        parkingBrake: "Parking Brake (hand brake / spring brakes)",
        steeringMechanism: "Steering Mechanism & Linkage Free Play",
        lightingDevices: "Lighting Devices, Headlights, Tail Lights & Reflectors",
        tires: "Tires (Tread Depth & Air Pressure)",
        horn: "Audible Horn Operation",
        windshieldWipers: "Windshield Wipers & Washer Fluid",
        rearVisionMirrors: "Rear Vision Mirrors (Side & Cab Mirrors)",
        couplingDevices: "Coupling Devices, Fifth Wheel, Pintle Hooks & Safety Chains",
        wheelsRims: "Wheels, Rim, Lug Nuts & Stud Security",
        emergencyEquipment: "Emergency Equipment (Fire Extinguisher, Triangles, Spare Fuses)",
        fluidLeaks: "Oil, Coolant, Fuel & Hydraulic Fluid Leaks",
        beltsHoses: "Engine Belts, Hoses & Air Intake System",
        exhaustSystem: "Exhaust System & Emissions (No Leaks / Smoke)"
      };

      const escStr = (s) => !s ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

      const defectsList = Array.isArray(defects) && defects.length > 0
        ? defects.map(id => `<li><strong>${escStr(ITEM_LABELS[id] || id)}</strong></li>`).join('')
        : '<li><em>No specific defect items selected.</em></li>';

      let statusBadge = '<span style="color:#15803d; font-weight:bold;">✅ Certified Safe for Operation</span>';
      if (status === 'out_of_service') {
        statusBadge = '<span style="color:#b91c1c; font-weight:bold;">🚨 OUT-OF-SERVICE (UNSAFE TO OPERATE)</span>';
      } else if (status === 'defects_found') {
        statusBadge = '<span style="color:#b45309; font-weight:bold;">⚠️ Safety Defects Logged</span>';
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 20px; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">Official DVIR Safety Inspection Report</h2>
            <p style="font-size: 14px; color: #64748b;">FMCSA 49 CFR Part 396 Electronic Record Verification</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #64748b;">Power Unit ID:</td><td style="font-weight: bold; text-align: right;">${escStr(powerUnit || 'N/A')}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;">Trailer / Towed Unit:</td><td style="font-weight: bold; text-align: right;">${escStr(trailer || 'N/A')}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;">Inspection Location:</td><td style="text-align: right;">${escStr(location || 'N/A')}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;">Driver Signature:</td><td style="color: #2563eb; font-weight: bold; text-align: right;">${escStr(driverSignature || 'N/A')}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;">Compliance Status:</td><td style="text-align: right;">${statusBadge}</td></tr>
            </table>

            ${(status === 'defects_found' || status === 'out_of_service') ? `
              <div style="margin-top: 20px; background: #fffbeb; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px;">
                <h4 style="margin: 0 0 8px 0; color: #92400e;">Logbook Reported Defect Items:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #78350f;">${defectsList}</ul>
                ${remarks ? `<p style="margin: 8px 0 0 0; font-size: 13px;"><strong>Inspector Remarks:</strong> ${escStr(remarks)}</p>` : ''}
              </div>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">Dispatched automatically via DRIV-EN Electronic Safety Platform</p>
          </div>
        </body>
        </html>
      `;

      const rawFrom = env.RESEND_FROM_EMAIL || 'noreply@driv-en.com';
      const fromAddress = rawFrom.includes('<') ? rawFrom : `DRIV-EN Compliance <${rawFrom}>`;

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [officerEmail.trim()],
          subject: `Official DVIR Vehicle Inspection Report — Unit #${powerUnit || 'N/A'}`,
          html: htmlContent
        })
      });

      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        return json({ success: false, error: resendData.message || 'Failed to dispatch email via Resend' }, resendRes.status);
      }

      return json({ success: true, message: 'Email sent successfully', data: resendData });
    } catch (err) {
      return json({ success: false, error: err.message }, 500);
    }
  }
  
  // Direct Endpoint: DVIR Inspection Form & CFR 396 Lookup
  if (path === '/api/dvir' || path === '/dvir') {
    const authCtx = await getAuthContext(request, env);
    const orgId = authCtx.orgId || url.searchParams.get('org_id') || url.searchParams.get('orgId');

    if (!orgId) {
      return json({ error: "Multi-tenant context missing (org_id required)" }, 401);
    }

    const countryParam = (url.searchParams.get('country') || request.headers.get('x-country') || 'US').toUpperCase().trim();
    const isCanada = countryParam === 'CA';
    const isAustralasia = ['AU', 'NZ'].includes(countryParam);
    const isEurope = ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'NO', 'FI'].includes(countryParam);
    const isMetricRegion = isCanada || isAustralasia || isEurope || countryParam !== 'US';

    const uomDist = (url.searchParams.get('dist') === 'km' || isMetricRegion) ? 'Kilometers' : 'Miles';
    const uomPress = (url.searchParams.get('press') || (isMetricRegion ? 'kPa' : 'PSI')).toUpperCase();
    const uomDepth = isMetricRegion ? 'mm' : '1/32 in';

    let roadAuth = 'DOT / FMCSA';
    let workAuth = 'OSHA / MSHA';

    if (isCanada) {
      roadAuth = 'NSC Standard 11';
      workAuth = 'CCOHS / COR';
    } else if (isAustralasia) {
      roadAuth = 'NHVR';
      workAuth = 'WHS Code';
    } else if (isEurope) {
      roadAuth = 'DVSA / EU Directives';
      workAuth = 'HSE / EU-OSHA';
    }

    const kvStore = env.DRIVEN_KV || env.ASSET_CONFIG_KV;
    await ensureTableSchema(env.DB, 'dvir_inspections');

    if (method === 'GET') {
      const assetNumber = url.searchParams.get('assetNumber') || url.searchParams.get('asset_number');
      const assetId = url.searchParams.get('assetId') || url.searchParams.get('asset_id');

      if (!assetNumber && !assetId) {
        return json({ error: "Query parameter 'assetNumber' or 'assetId' is required" }, 400);
      }

      let priorInspection = null;
      if (env.DB) {
        try {
          priorInspection = await env.DB.prepare(
            `SELECT 
               id, org_id, asset_id, asset_number, trailer_number, driver_signature, 
               inspection_type, meter_reading, city, state, location, status, 
               defects_found_json, defects_json, remarks, repair_certified, repair_remarks, 
               repair_signature, created_at 
             FROM dvir_inspections 
             WHERE org_id = ? 
               AND (LOWER(asset_number) = LOWER(?) OR LOWER(asset_id) = LOWER(?)) 
             ORDER BY created_at DESC LIMIT 1`
          ).bind(orgId, assetNumber || assetId || '', assetId || assetNumber || '').first();

          if (priorInspection) {
            const rawDefectsJson = priorInspection.defects_json || priorInspection.defects_found_json;
            if (rawDefectsJson) {
              try {
                priorInspection.defects_found = typeof rawDefectsJson === 'string' ? JSON.parse(rawDefectsJson) : rawDefectsJson;
              } catch (e) {
                priorInspection.defects_found = [];
              }
            } else {
              priorInspection.defects_found = [];
            }
          }
        } catch (e) {
          console.warn('[DVIR-GET] Non-fatal DB lookup warning:', e.message);
        }
      }

      const checklistSections = [
        {
          title: "1. 49 CFR § 396.11 Mandatory Vehicle Safety Components",
          items: [
            { id: "serviceBrakes", label: "Service Brakes (including trailer brake connections)", required: true },
            { id: "parkingBrake", label: "Parking Brake (hand brake / spring brakes)", required: true },
            { id: "steeringMechanism", label: "Steering Mechanism & Linkage Free Play", required: true },
            { id: "lightingDevices", label: "Lighting Devices, Headlights, Tail Lights & Reflectors", required: true },
            { id: "tires", label: `Tires (Tread Depth: Steer ≥ ${isMetricRegion ? '3mm' : '4/32"'}, Drive ≥ ${isMetricRegion ? '2mm' : '2/32"'})`, required: true },
            { id: "horn", label: "Audible Horn Operation", required: true },
            { id: "windshieldWipers", label: "Windshield Wipers & Washer Fluid", required: true },
            { id: "rearVisionMirrors", label: "Rear Vision Mirrors (Side & Cab Mirrors)", required: true },
            { id: "couplingDevices", label: "Coupling Devices, Fifth Wheel, Pintle Hooks & Safety Chains", required: true },
            { id: "wheelsRims", label: "Wheels, Rims, Lug Nuts & Stud Security", required: true },
            { id: "emergencyEquipment", label: "Emergency Equipment (Fire Extinguisher, Triangles, Spare Fuses)", required: true }
          ]
        },
        {
          title: "2. Engine, Powertrain & Fluid Systems",
          items: [
            { id: "fluidLeaks", label: "Oil, Coolant, Fuel & Hydraulic Fluid Leaks", required: true },
            { id: "beltsHoses", label: "Engine Belts, Hoses & Air Intake System", required: true },
            { id: "exhaustSystem", label: "Exhaust System & Emissions (No Leaks / Smoke)", required: true }
          ]
        }
      ];

      return json({
        success: true,
        orgId,
        assetNumber: assetNumber || assetId,
        assetId: assetId || assetNumber,
        jurisdiction: countryParam,
        authorities: { roadAuth, workAuth },
        cfrCompliance: "49 CFR Part 396 Compliant",
        priorInspection: priorInspection || null,
        units: { uomDist, uomPress, uomDepth },
        checklist: checklistSections
      });
    }

    if (method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "Invalid JSON payload" }, 400);
      }

      const assetNumber = body.asset_number || body.assetNumber;
      const assetId = body.asset_id || body.assetId || assetNumber;
      const trailerNumber = body.trailer_number || body.trailerNumber || null;
      const userId = body.user_id || body.userId || authCtx.userId;
      const driverId = body.driver_id || body.driverId || userId || request.headers.get('x-user-id') || 'unknown_driver';
      const driverSignature = body.driver_signature || body.driverSignature || '';
      const inspectionType = body.inspection_type || body.inspectionType || 'pre_trip';
      const meterReading = body.meter_reading !== undefined ? body.meter_reading : body.meterReading;
      const city = body.city || '';
      const state = body.state || '';
      const siteLocation = body.site_location || body.siteLocation || 'Not Applicable';
      const location = body.location || `${city}, ${state}${siteLocation && siteLocation !== 'Not Applicable' ? ` (${siteLocation})` : ''}`;

      let defectsFound = [];
      const rawDefects = body.defects_json || body.defects_found_json || body.defects_found || body.defectsFound || [];
      if (typeof rawDefects === 'string') {
        try { defectsFound = JSON.parse(rawDefects); } catch(e){ defectsFound = []; }
      } else if (Array.isArray(rawDefects)) {
        defectsFound = rawDefects;
      }

      let inspectionData = {};
      if (body.inspection_data_json) {
        try { inspectionData = typeof body.inspection_data_json === 'string' ? JSON.parse(body.inspection_data_json) : body.inspection_data_json; } catch(e){}
      } else {
        inspectionData = body.inspection_data || body.inspectionData || {};
      }

      const remarks = body.remarks || '';
      const priorReviewAcknowledged = (body.prior_review_acknowledged || body.priorReviewAcknowledged) ? 1 : 0;
      const certified = (body.certified !== undefined) ? (body.certified ? 1 : 0) : 1;
      
      const unlistedFlag = (body.unlisted_flag || body.unlistedFlag) ? 1 : 0;
      let unlistedDetails = body.unlisted_details_json || body.unlisted_details || body.unlistedDetails || null;
      if (typeof unlistedDetails === 'object' && unlistedDetails !== null) {
        unlistedDetails = JSON.stringify(unlistedDetails);
      }

      let deviceLocation = body.device_location_json || body.device_location || body.deviceLocation || null;
      if (typeof deviceLocation === 'object' && deviceLocation !== null) {
        deviceLocation = JSON.stringify(deviceLocation);
      }

      if (!assetNumber && !assetId) {
        return json({ error: "Missing required asset identifier" }, 400);
      }

      if (!driverSignature) {
        return json({ error: "49 CFR § 396.11(b) requires a driver digital signature." }, 400);
      }

      const defectsCount = body.defects_count !== undefined ? Number(body.defects_count) : defectsFound.length;
      
      let finalStatus = 'pass';
      if (body.status === 'out_of_service') {
        finalStatus = 'out_of_service';
      } else if (defectsCount > 0 || body.status === 'defects_found') {
        finalStatus = 'defects_found';
      }

      const hasDefects = finalStatus === 'out_of_service' || finalStatus === 'defects_found' || defectsCount > 0;
      
      const timestamp = Date.now();
      const dvirId = `dvir_${timestamp}`;
      const createdAt = new Date(timestamp).toISOString();
      const createdBy = authCtx.userEmail || driverSignature;
      const defectsJsonStr = JSON.stringify(defectsFound);

      const dvirRecord = {
        id: dvirId,
        org_id: orgId,
        user_id: userId,
        asset_id: assetId,
        asset_number: assetNumber,
        trailer_number: trailerNumber,
        driver_id: driverId,
        driver_signature: driverSignature,
        inspection_type: inspectionType,
        meter_reading: meterReading,
        city: city,
        state: state,
        site_location: siteLocation,
        location: location,
        status: finalStatus,
        defects_count: defectsCount,
        has_defects: hasDefects ? 1 : 0,
        defects_found: defectsFound,
        defects_found_json: defectsJsonStr,
        defects_json: defectsJsonStr,
        inspection_data: inspectionData,
        inspection_data_json: JSON.stringify(inspectionData),
        remarks: remarks,
        prior_review_acknowledged: priorReviewAcknowledged,
        certified: certified,
        unlisted_flag: unlistedFlag,
        unlisted_details: unlistedDetails,
        country: countryParam,
        device_location: deviceLocation,
        created_at: createdAt,
        created_by: createdBy
      };

      if (env.DB) {
        try {
          await env.DB.prepare(
            `INSERT INTO dvir_inspections (
              id, org_id, user_id, asset_id, asset_number, trailer_number, driver_id, driver_signature,
              inspection_type, meter_reading, city, state, site_location, location, status, defects_count,
              has_defects, defects_found_json, defects_json, inspection_data_json, remarks, prior_review_acknowledged,
              certified, unlisted_flag, unlisted_details_json, country, device_location_json, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            dvirId, orgId, userId, assetId, assetNumber, trailerNumber, driverId, driverSignature,
            inspectionType, meterReading ?? 0, city, state, siteLocation, location, finalStatus, defectsCount,
            hasDefects ? 1 : 0, defectsJsonStr, defectsJsonStr, JSON.stringify(inspectionData), remarks, priorReviewAcknowledged,
            certified, unlistedFlag, unlistedDetails, countryParam, deviceLocation, createdAt, createdBy
          ).run();

          if (unlistedFlag) {
            await env.DB.prepare(
              `INSERT INTO error_log (id, source, error_message, stack_trace, severity, created_at) VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(
              crypto.randomUUID(),
              'DVIR Inspection Form (Unlisted Unit Flag)',
              `Unlisted Unit Logged: Power Unit "${assetNumber}" or Towed Unit "${trailerNumber}" submitted by ${driverSignature}.`,
              unlistedDetails || '{}',
              'warning',
              createdAt
            ).run().catch(() => {});
          }

        } catch (dbErr) {
          console.error('[DVIR-CFR396] D1 storage error:', dbErr.message);
        }
      }

      if (kvStore) {
        const lookupKey = (assetNumber || assetId).toLowerCase().trim();
        await kvStore.put(`dvir:${orgId}:${lookupKey}:${timestamp}`, JSON.stringify(dvirRecord));
      }

      return json({
        success: true,
        message: finalStatus === 'out_of_service'
          ? "Out-of-Service inspection logged! Vehicle placed OUT-OF-SERVICE."
          : unlistedFlag 
          ? "DVIR submitted! Unlisted unit flagged for Fleet Manager review." 
          : "DVIR inspection logged successfully under 49 CFR Part 396.",
        unlistedFlagged: Boolean(unlistedFlag),
        dvir: dvirRecord
      });
    }

    return json({ error: "Method not allowed" }, 405);
  }

  // Direct Endpoint: Asset Configuration
  if (path === '/api/asset-config' || path.startsWith('/api/asset-config/')) {
    const countryParam = (url.searchParams.get('country') || request.headers.get('x-country') || 'US').toUpperCase().trim();
    const isCanada = countryParam === 'CA';
    const kvStore = env.DRIVEN_KV || env.ASSET_CONFIG_KV;

    if (method === 'GET') {
      const targetType = url.searchParams.get('targetType') || 'specific';
      const key = url.searchParams.get('key') || '';
      const rawAssetType = url.searchParams.get('assetType') || key || 'default';

      const normKey = normalizeCategoryKey(rawAssetType);
      const schema = buildCategorySchema(normKey, isCanada);

      let savedConfig = null;

      if (kvStore && key) {
        try {
          const storageKey = targetType === 'template'
            ? `config:template:${normKey}`
            : `config:specific:${key.toLowerCase().trim()}`;
            
          savedConfig = await kvStore.get(storageKey, { type: 'json' });
        } catch (e) {
          console.error("Error fetching config from KV:", e);
        }
      }

      return json({
        success: true,
        jurisdiction: isCanada ? 'CA' : 'US',
        schemaKey: normKey,
        schema: schema,
        config: savedConfig || null
      });
    }

    if (method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (jsonErr) {
        return json({ error: 'Invalid JSON payload' }, 400);
      }

      const { targetType, key, config } = body || {};

      if (!targetType || !key || !config) {
        return json({ error: "Missing required parameters: 'targetType', 'key', and 'config' required" }, 400);
      }

      if (kvStore) {
        const storageKey = targetType === 'template'
          ? `config:template:${normalizeCategoryKey(key)}`
          : `config:specific:${key.toLowerCase().trim()}`;

        await kvStore.put(storageKey, JSON.stringify(config));
      }

      return json({ success: true, message: 'Configuration saved successfully' });
    }

    return json({ error: 'Method not allowed' }, 405);
  }

  // Direct Endpoint: Organization Settings
  if (path === '/api/organization-settings' || path.startsWith('/api/organization-settings/')) {
    const authCtx = await getAuthContext(request, env);
    const orgId = authCtx.orgId || url.searchParams.get('org_id') || url.searchParams.get('customerId') || url.searchParams.get('customer_id');

    if (!orgId) {
      return json({ error: true, message: 'Organization ID context missing' }, 400);
    }

    if (method === 'GET') {
      try {
        await ensureTableSchema(env.DB, 'org_settings');
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

        return json({ success: true, settings: row || defaultSettings, record: row || defaultSettings });
      } catch (e) {
        return json({ 
          success: true, 
          settings: { org_id: orgId, country: 'US', volume_unit: 'gal', pressure_unit: 'psi', distance_unit: 'mi' } 
        });
      }
    }

    if (method === 'PUT' || method === 'POST') {
      try {
        await ensureTableSchema(env.DB, 'org_settings');
        const body = await request.json();
        
        // Use a deterministic ID per tenant to prevent primary key index churn on upserts
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

        return json({ success: true, settings: updatedRow, record: updatedRow });
      } catch (e) {
        return json({ success: false, error: e.message || 'Failed to save settings' }, 500);
      }
    }
  }

  if (path.startsWith('/api/admin')) {
    try {
      const adminWorkerUrl = new URL(request.url);
      adminWorkerUrl.hostname = 'driven-admin-api.driv-en.workers.dev';

      const reqHeaders = new Headers(request.headers);
      reqHeaders.set('Host', adminWorkerUrl.hostname);
      reqHeaders.set('X-Forwarded-Host', url.hostname);

      const proxyReq = new Request(adminWorkerUrl.toString(), {
        method: request.method,
        headers: reqHeaders,
        body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.body : null,
        redirect: 'follow'
      });

      const response = await fetch(proxyReq);
      const respHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => respHeaders.set(k, v));

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders
      });
    } catch (err) {
      console.error('Failed to proxy request to driven-admin-api:', err.message);
      return json({ success: false, error: 'Admin Service Proxy Failure' }, 502);
    }
  }

  if (path === '' || path === '/' || (path === '/api' && method === 'GET')) {
    return json({
      status: 'ok',
      service: 'DRIV-EN API Worker (D1)',
      tables: Object.keys(TABLE_MAP)
    });
  }

  if ((path === '/api/log-error' || path === '/log-error') && method === 'POST') {
    try {
      const body = await request.json();
      return await handleLogError(env, body);
    } catch (e) {
      return json({ success: false, error: e.message }, 500);
    }
  }

    // Unit of Measure Settings (org-level, admin-managed)
  if (path === '/api/settings/units' || path === '/api/settings/units/') {
    if (method === 'GET') return await handleGetUnitSettings(env, request);
    if (method === 'PUT' || method === 'PATCH') return await handlePutUnitSettings(env, request);
    return json({ success: false, error: 'Method not allowed' }, 405, request);
  }

  // User-level Unit Preferences (personal override)
  if (path === '/api/user/preferences/units' || path === '/api/user/preferences/units/') {
    if (method === 'GET') return await handleGetUserUnitPrefs(env, request);
    if (method === 'PUT' || method === 'PATCH') return await handlePutUserUnitPrefs(env, request);
    return json({ success: false, error: 'Method not allowed' }, 405, request);
  }
  
  // Direct Endpoint: Asset Types Batch & Direct Table Retrieval
  if (path === '/api/asset-types' || path === '/api/asset_types' || path.startsWith('/api/asset-types/') || path.startsWith('/api/asset_types/')) {
    const authCtx = await getAuthContext(request, env);
    const orgId = authCtx.orgId || url.searchParams.get('org_id') || url.searchParams.get('customerId');
    const userId = authCtx.userId;
    const userEmail = authCtx.userEmail;

    if (!orgId) {
      await logTenantContextError(env, path, request);
      return json({ 
        error: true, 
        message: 'Multi-tenant authentication error: Organization context missing.' 
      }, 401);
    }

    if (method === 'GET') {
      try {
        await ensureTableSchema(env.DB, 'asset_types');

        let records = [];
        if (env.DB && orgId) {
          const { results } = await env.DB.prepare(`
            SELECT * FROM asset_types WHERE org_id = ? OR org_id = 'system' ORDER BY category_group ASC, asset_type_name ASC
          `).bind(orgId).all();

          records = results || [];
        }

        if (!records || records.length === 0) {
          const defaultCategories = [
            "Pickup Truck",
            "Highway Motor Vehicles (Classes 1–8)",
            "Medium Vocational / Service Truck",
            "Earthmoving — Dozers & Heavy Tracked Equipment",
            "Earthmoving — Wheel Loaders, Graders & Backhoes",
            "Excavator",
            "Mining, Drilling & Rigging",
            "Cranes & Aerial Lifts",
            "Stationary & Engine Plants",
            "Auxiliary Tools, Pumps & Light Towers",
            "Trailers & Towables"
          ];
          records = defaultCategories.map(cat => ({ asset_type_name: cat }));
        }

        const tableConfig = resolveTableConfig('AssetTypes');
        const formatted = records.map(r => formatRecord(r, tableConfig));
        return json({ success: true, records: formatted, assetTypes: records, data: records });
      } catch (e) {
        return json({ success: true, records: [], assetTypes: [], data: [] });
      }
    }

    if (method === 'POST') {
      try {
        await ensureTableSchema(env.DB, 'asset_types');

        const body = await request.json();
        let rawTypes = body.assetTypes || body.asset_types || body.records || body;

        let itemsList = Array.isArray(rawTypes) 
          ? rawTypes 
          : (typeof rawTypes === 'object' && rawTypes !== null ? Object.values(rawTypes) : []);
        
        const now = new Date().toISOString();
        const stmts = [];

        for (const item of itemsList) {
          if (!item) continue;

          const cleanName = typeof item === 'object' ? (item.asset_type_name || item.name || '') : String(item);
          if (!cleanName || cleanName === '[object Object]') continue;

          const code = (typeof item === 'object' && item.asset_type_code)
            ? item.asset_type_code
            : cleanName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

          const categoryGroup = (typeof item === 'object' && item.category_group) ? item.category_group : 'General';
          const isCustom = (typeof item === 'object' && item.is_custom !== undefined) ? (item.is_custom ? 1 : 0) : 0;
          const id = (typeof item === 'object' && item.id) ? item.id : crypto.randomUUID();

          stmts.push(
            env.DB.prepare(`
              INSERT INTO asset_types (
                id, org_id, user_id, asset_type_code, asset_type_name, category_group, is_custom, created_at, created_by, updated_at, updated_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                asset_type_code = excluded.asset_type_code,
                asset_type_name = excluded.asset_type_name,
                category_group = excluded.category_group,
                is_custom = excluded.is_custom,
                updated_at = excluded.updated_at,
                updated_by = excluded.updated_by
            `).bind(id, orgId, userId, code, cleanName, categoryGroup, isCustom, now, userEmail, now, userEmail)
          );
        }

        if (stmts.length > 0) {
          await executeD1BatchChunks(env.DB, stmts, 25);
        }

        return json({ success: true, count: itemsList.length, org_id: orgId });
      } catch (e) {
        console.error('Asset types save exception:', e.message);
        return json({ success: false, error: e.message, org_id: orgId }, 500);
      }
    }

    return json({ error: 'Method not allowed' }, 405);
  }

  // Direct Endpoint: Assets / Equipment Handling
  if (path === '/api/assets' || path === '/api/equipment') {
    const authCtx = await getAuthContext(request, env);
    const orgId = authCtx.orgId || url.searchParams.get('org_id') || url.searchParams.get('customerId');

    if (!orgId) {
      await logTenantContextError(env, path, request);
      return json({ error: true, message: 'Multi-tenant authentication error: Organization context missing.' }, 401);
    }

    if (method === 'GET') {
      try {
        await ensureTableSchema(env.DB, 'assets');
        const sql = `
          SELECT a.*, p.name AS project_name, l.name AS location_name_resolved, d.name AS division_name_resolved 
          FROM assets a 
          LEFT JOIN projects p ON a.project_id = p.id 
          LEFT JOIN locations l ON a.location_id = l.id 
          LEFT JOIN divisions d ON a.assigned_division = d.id OR a.assigned_division = d.name
          WHERE a.org_id = ? 
          ORDER BY a.asset_number ASC
        `;
        const { results } = await env.DB.prepare(sql).bind(orgId).all();

        const tableConfig = resolveTableConfig('equipment');
        const records = (results || []).map(r => formatRecord(r, tableConfig));
        return json({ success: true, records, assets: records, equipment: records, data: records });
      } catch (e) {
        return json({ success: true, records: [], assets: [], equipment: [], data: [] });
      }
    }
  }

  // Direct Endpoint: Fuel Types Batch & Direct Table Retrieval
  if (path === '/api/fuel-types' || path === '/api/fuel_types') {
    const authCtx = await getAuthContext(request, env);
    const orgId = authCtx.orgId || url.searchParams.get('org_id') || url.searchParams.get('customerId');
    const userId = authCtx.userId;
    const userEmail = authCtx.userEmail;

    if (!orgId) {
      await logTenantContextError(env, path, request);
      return json({ 
        error: true, 
        message: 'Multi-tenant authentication error: Organization context missing.' 
      }, 401);
    }

    if (method === 'GET') {
      try {
        await ensureTableSchema(env.DB, 'fuel_types');
        const { results } = await env.DB.prepare(
          'SELECT * FROM fuel_types WHERE org_id = ? ORDER BY fuel_name ASC'
        ).bind(orgId).all();

        const records = results || [];
        return json({ success: true, records, fuelTypes: records, data: records });
      } catch (e) {
        return json({ success: true, records: [], fuelTypes: [], data: [] });
      }
    }

    if (method === 'POST') {
      try {
        await ensureTableSchema(env.DB, 'fuel_types');

        const body = await request.json();
        let rawTypes = body.fuelTypes || body.fuel_types || body.records || body.selectedFuelTypes || body;

        let itemsList = Array.isArray(rawTypes) 
          ? rawTypes 
          : (typeof rawTypes === 'object' && rawTypes !== null ? Object.values(rawTypes) : []);

        const stmts = [env.DB.prepare('DELETE FROM fuel_types WHERE org_id = ?').bind(orgId)];

        const now = new Date().toISOString();
        for (const item of itemsList) {
          if (!item) continue;

          const cleanName = toPrimitiveString(item);
          if (!cleanName) continue;

          const code = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50);
          const desc = (typeof item === 'object' && item.description) ? toPrimitiveString(item.description) : cleanName;
          const isCustom = (typeof item === 'object' && item.is_custom !== undefined) ? (item.is_custom ? 1 : 0) : 1;

          stmts.push(
            env.DB.prepare(
              'INSERT INTO fuel_types (id, org_id, user_id, fuel_code, fuel_name, description, is_custom, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(crypto.randomUUID(), orgId, userId, code, cleanName, desc, isCustom, now, userEmail, now, userEmail)
          );
        }

        // Atomic Execution: If payload is within parameter binding thresholds (under ~20 items), batch together atomically
        if (stmts.length <= 25) {
          await env.DB.batch(stmts);
        } else {
          await executeD1BatchChunks(env.DB, stmts, 25);
        }

        return json({ success: true, count: itemsList.length, org_id: orgId });
      } catch (e) {
        return json({ success: false, error: e.message, org_id: orgId }, 500);
      }
    }

    return json({ error: 'Method not allowed' }, 405);
  }

  // Generic Routing for Dynamic Tables
  const match = path.match(/^\/api\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) return json({ error: 'Not found' }, 404);

  const requestedTable = decodeURIComponent(match[1]);
  const recordId = match[2] ? decodeURIComponent(match[2]) : null;

  // Prevent internal API routes from entering table mapping logic
  const EXCLUDED_API_ROUTES = new Set([
    'send-dvir-email', 
    'send_dvir_email',
    'dvir', 
    'asset-config', 
    'organization-settings', 
    'log-error', 
    'asset-types', 
    'asset_types', 
    'fuel-types', 
    'fuel_types',
    'settings',
    'user',
    'translate',
    'translate/batch',
    'translate/languages',
    'translations'
  ]);

  if (
    requestedTable.toLowerCase().includes('send-dvir-email') || 
    requestedTable.toLowerCase().includes('send_dvir_email') ||
    EXCLUDED_API_ROUTES.has(requestedTable.toLowerCase())
  ) {
    return json({ success: false, error: 'Endpoint handled by standalone Pages Function or method not allowed' }, 405);
  }

  const tableConfig = resolveTableConfig(requestedTable);
  if (!tableConfig) {
    return json({ error: 'Unknown table: ' + requestedTable, fuelWorkerBound: !!env.FUEL_WORKER, envKeys: Object.keys(env || {}), availableTables: Object.keys(TABLE_MAP) }, 400);
  }

  const d1Table = tableConfig.d1Table;
  const authCtx = await getAuthContext(request, env);
  const orgId = authCtx.orgId || url.searchParams.get('org_id') || url.searchParams.get('customerId') || url.searchParams.get('customer_id');
  const userId = authCtx.userId;
  const userEmail = authCtx.userEmail;

  if (!orgId) {
    await logTenantContextError(env, path, request);
    return json({ error: 'Multi-tenant error: Organization context missing' }, 401);
  }

  try { await ensureTableSchema(env.DB, d1Table); } catch (schemaErr) { console.warn('Schema check skipped for ' + d1Table + ':', schemaErr.message); }

  try {
    // LIST
    if (method === 'GET' && !recordId) {
      let sql = 'SELECT * FROM ' + d1Table + ' WHERE org_id = ?';
      
      if (d1Table === 'assets') {
        sql = `
          SELECT a.*, p.name AS project_name, l.name AS location_name_resolved, d.name AS division_name_resolved 
          FROM assets a 
          LEFT JOIN projects p ON a.project_id = p.id 
          LEFT JOIN locations l ON a.location_id = l.id 
          LEFT JOIN divisions d ON a.assigned_division = d.id OR a.assigned_division = d.name
          WHERE a.org_id = ? 
          ORDER BY a.asset_number ASC
        `;
      } else if (d1Table === 'fuel_transactions') {
        sql = 'SELECT * FROM fuel_transactions WHERE org_id = ? ORDER BY transaction_date DESC';
      }

      let result;
      try {
        result = await env.DB.prepare(sql).bind(orgId).all();
      } catch (dbErr) {
        try {
          result = await env.DB.prepare('SELECT * FROM ' + d1Table + ' WHERE org_id = ?').bind(orgId).all();
        } catch (fallbackErr) {
          result = { results: [] };
        }
      }

      const records = (result.results || []).map(r => formatRecord(r, tableConfig));
      return json({ 
        success: true, 
        records, 
        data: records, 
        clients: records, 
        divisions: records, 
        locations: records, 
        projects: records, 
        projectTypes: records,
        unitsOfMeasure: records,
        equipment: records,
        assets: records,
        tanks: records,
        inspections: records,
        transfers: records,
        workOrders: records,
        fueling: records
      });
    }

    // GET ONE
    if (method === 'GET' && recordId) {
      let sql = 'SELECT * FROM ' + d1Table + ' WHERE id = ? AND org_id = ?';
      if (d1Table === 'assets') {
        sql = `
          SELECT a.*, p.name AS project_name, l.name AS location_name_resolved, d.name AS division_name_resolved 
          FROM assets a 
          LEFT JOIN projects p ON a.project_id = p.id 
          LEFT JOIN locations l ON a.location_id = l.id 
          LEFT JOIN divisions d ON a.assigned_division = d.id OR a.assigned_division = d.name
          WHERE a.id = ? AND a.org_id = ?
        `;
      }
      const row = await env.DB.prepare(sql).bind(recordId, orgId).first();
      if (row) return json({ success: true, record: formatRecord(row, tableConfig) });
      return json({ error: 'Record not found' }, 404);
    }

    // CREATE
    if (method === 'POST' && !recordId) {
      const body = await request.json();
      const d1Row = mapPayloadToD1(tableConfig, body);

      const id = body.id || crypto.randomUUID();
      const now = new Date().toISOString();

      const cols = ['"id"', '"org_id"', '"user_id"'];
      const vals = [id, orgId, userId];

      for (const [col, val] of Object.entries(d1Row)) {
        if (col === 'id' || col === 'org_id' || col === 'user_id' || col === 'created_by' || col === 'updated_by') continue;
        cols.push(`"${col}"`);
        vals.push(val);
      }

      cols.push('"created_at"');
      vals.push(now);
      cols.push('"created_by"');
      vals.push(userEmail);
      cols.push('"updated_at"');
      vals.push(now);
      cols.push('"updated_by"');
      vals.push(userEmail);

      await env.DB.prepare(
        'INSERT INTO ' + d1Table + ' (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')'
      ).bind(...vals).run();

      const row = await env.DB.prepare('SELECT * FROM ' + d1Table + ' WHERE id = ? AND org_id = ?').bind(id, orgId).first();
      return json({ success: true, record: formatRecord(row, tableConfig) }, 201);
    }

    // UPDATE
    if ((method === 'PUT' || method === 'PATCH') && recordId) {
      const body = await request.json();
      const d1Row = mapPayloadToD1(tableConfig, body);

      const sets = [];
      const values = [];
      for (const [col, val] of Object.entries(d1Row)) {
        if (col === 'id' || col === 'org_id' || col === 'user_id' || col === 'created_at' || col === 'created_by' || col === 'updated_at' || col === 'updated_by') continue;
        sets.push(`"${col}" = ?`);
        values.push(val);
      }
      if (sets.length === 0) return json({ error: 'No fields to update' }, 400);

      sets.push('"updated_at" = ?');
      values.push(new Date().toISOString());
      sets.push('"updated_by" = ?');
      values.push(userEmail);

      values.push(recordId);
      values.push(orgId);

      let sql = 'UPDATE ' + d1Table + ' SET ' + sets.join(', ') + ' WHERE id = ? AND org_id = ?';
      await env.DB.prepare(sql).bind(...values).run();

      let fetchSql = 'SELECT * FROM ' + d1Table + ' WHERE id = ? AND org_id = ?';
      if (d1Table === 'assets') {
        fetchSql = `
          SELECT a.*, p.name AS project_name, l.name AS location_name_resolved, d.name AS division_name_resolved 
          FROM assets a 
          LEFT JOIN projects p ON a.project_id = p.id 
          LEFT JOIN locations l ON a.location_id = l.id 
          LEFT JOIN divisions d ON a.assigned_division = d.id OR a.assigned_division = d.name
          WHERE a.id = ? AND a.org_id = ?
        `;
      }
      const row = await env.DB.prepare(fetchSql).bind(recordId, orgId).first();
      return json({ success: true, record: formatRecord(row, tableConfig) });
    }

    // DELETE
    if (method === 'DELETE' && recordId) {
      let sql = 'DELETE FROM ' + d1Table + ' WHERE id = ? AND org_id = ?';
      const result = await env.DB.prepare(sql).bind(recordId, orgId).run();
      if (result.meta.changes === 0) return json({ error: 'Record not found' }, 404);
      return json({ success: true, id: recordId });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (e) {
    console.error('API error:', e.message);
    try {
      await env.DB.prepare(
        'INSERT INTO error_log (id, source, error_message, stack_trace, severity, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        crypto.randomUUID(),
        'API Worker (' + requestedTable + ':' + method + ')',
        e.message,
        e.stack || null,
        'error',
        new Date().toISOString()
      ).run();
    } catch (logErr) {
      console.error('Error logging failure:', logErr.message);
    }

    return json({ error: true, message: e.message }, 500);
  }
}
