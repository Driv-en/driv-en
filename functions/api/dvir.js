/** 
 * Cloudflare Pages Function: /api/dvir 
 * Multi-Tenant Isolated & 49 CFR Part 396 Compliant 
 * File: /functions/api/dvir.js
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-org-id, x-country, x-user-id'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  const orgId = request.headers.get('x-org-id') || url.searchParams.get('org_id') || url.searchParams.get('orgId') || null;

  if (!orgId) {
    return new Response(JSON.stringify({ error: "Multi-tenant context missing (org_id required)" }), { status: 401, headers });
  }

  // Regional Jurisdictions & Regulatory Context
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

  async function ensureDvirTable() {
    if (!env.DB) return;
    try {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS dvir_inspections (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          user_id TEXT,
          asset_id TEXT,
          asset_number TEXT,
          trailer_number TEXT,
          driver_id TEXT,
          driver_signature TEXT,
          inspection_type TEXT,
          meter_reading REAL,
          city TEXT,
          state TEXT,
          site_location TEXT,
          location TEXT,
          status TEXT,
          defects_count INTEGER DEFAULT 0,
          has_defects INTEGER DEFAULT 0,
          defects_found_json TEXT,
          defects_json TEXT,
          inspection_data_json TEXT,
          remarks TEXT,
          prior_review_acknowledged INTEGER DEFAULT 0,
          certified INTEGER DEFAULT 1,
          repair_certified INTEGER DEFAULT 0,
          repair_remarks TEXT,
          repair_signature TEXT,
          unlisted_flag INTEGER DEFAULT 0,
          unlisted_details_json TEXT,
          country TEXT,
          device_location_json TEXT,
          created_at TEXT,
          created_by TEXT,
          updated_at TEXT,
          updated_by TEXT
        )`
      ).run();

      // Ensure defects_json and defects_found_json columns exist on pre-existing table instances
      await env.DB.prepare(`ALTER TABLE dvir_inspections ADD COLUMN defects_json TEXT`).run().catch(() => {});
      await env.DB.prepare(`ALTER TABLE dvir_inspections ADD COLUMN defects_found_json TEXT`).run().catch(() => {});
      await env.DB.prepare(`ALTER TABLE dvir_inspections ADD COLUMN defects_count INTEGER DEFAULT 0`).run().catch(() => {});
    } catch (e) {
      console.warn('[DVIR-INIT] Table creation/schema migration warning:', e.message);
    }
  }

  try {
    // ------------------------------------------------------------------
    // GET: Query Prior Inspection Logs for 49 CFR § 396.13 Review Box
    // ------------------------------------------------------------------
    if (method === 'GET') {
      const assetNumber = url.searchParams.get('assetNumber') || url.searchParams.get('asset_number');
      const assetId = url.searchParams.get('assetId') || url.searchParams.get('asset_id');

      if (!assetNumber && !assetId) {
        return new Response(JSON.stringify({ error: "Query parameter 'assetNumber' or 'assetId' is required" }), { status: 400, headers });
      }

      await ensureDvirTable();

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

          // Standardize defects_found field for client compatibility
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

      return new Response(JSON.stringify({
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
      }), { status: 200, headers });
    }

    // ------------------------------------------------------------------
    // POST: Save DVIR Inspection Payload
    // ------------------------------------------------------------------
    if (method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400, headers });
      }

      // Flexible extraction supporting camelCase and snake_case properties
      const assetNumber = body.asset_number || body.assetNumber;
      const assetId = body.asset_id || body.assetId || assetNumber;
      const trailerNumber = body.trailer_number || body.trailerNumber || null;
      const userId = body.user_id || body.userId || null;
      const driverId = body.driver_id || body.driverId || userId || request.headers.get('x-user-id') || 'unknown_driver';
      const driverSignature = body.driver_signature || body.driverSignature || '';
      const inspectionType = body.inspection_type || body.inspectionType || 'pre_trip';
      const meterReading = body.meter_reading !== undefined ? body.meter_reading : body.meterReading;
      const city = body.city || '';
      const state = body.state || '';
      const siteLocation = body.site_location || body.siteLocation || 'Not Applicable';
      const location = body.location || `${city}, ${state}${siteLocation && siteLocation !== 'Not Applicable' ? ` (${siteLocation})` : ''}`;
      
      // Parse defects_found whether passed as raw array, defects_json, or defects_found_json
      let defectsFound = [];
      const rawDefects = body.defects_json || body.defects_found_json || body.defects_found || body.defectsFound || [];
      if (typeof rawDefects === 'string') {
        try { defectsFound = JSON.parse(rawDefects); } catch(e){ defectsFound = []; }
      } else if (Array.isArray(rawDefects)) {
        defectsFound = rawDefects;
      }

      // Parse inspection_data key-values
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
        return new Response(JSON.stringify({ error: "Missing required asset identifier" }), { status: 400, headers });
      }

      if (!driverSignature) {
        return new Response(JSON.stringify({ error: "49 CFR § 396.11(b) requires a driver digital signature." }), { status: 400, headers });
      }

      const defectsCount = body.defects_count !== undefined ? Number(body.defects_count) : defectsFound.length;
      
      // Preserve explicit out_of_service status sent from client
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
      const createdBy = body.created_by || body.createdBy || userEmailFromContext(request) || driverSignature;

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

      await ensureDvirTable();

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

          // Log unlisted asset warning to error_log for Equipment / Fleet Manager audit review
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

      return new Response(JSON.stringify({
        success: true,
        message: finalStatus === 'out_of_service'
          ? "Out-of-Service inspection logged! Vehicle placed OUT-OF-SERVICE."
          : unlistedFlag 
          ? "DVIR submitted! Unlisted unit flagged for Fleet Manager review." 
          : "DVIR inspection logged successfully under 49 CFR Part 396.",
        unlistedFlagged: Boolean(unlistedFlag),
        dvir: dvirRecord
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500, headers });
  }
}

function userEmailFromContext(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.email || payload.sub || null;
    }
  } catch (e) {}
  return null;
}
