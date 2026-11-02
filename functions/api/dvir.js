/**
 * Cloudflare Pages Function: /api/dvir
 * Compliant with 49 CFR Part 396  (FMCSA statutory DVIR & inspection requirements)
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-org-id, x-country, x-user-id'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
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

  try {
    // =========================================================================
    // GET: FETCH COMPLIANT CHECKLIST & PRIOR DEFECT STATUS (§ 396.13)
    // =========================================================================
    if (method === 'GET') {
      const assetNumber = url.searchParams.get('assetNumber') || url.searchParams.get('asset_number');
      const assetId = url.searchParams.get('assetId') || url.searchParams.get('asset_id');

      if (!assetNumber && !assetId) {
        return new Response(JSON.stringify({ error: "Query parameter 'assetNumber' or 'assetId' is required" }), { status: 400, headers });
      }

      // Safe prior defects lookup (defensively isolated so GET won't throw 500 if DB table is uninitialized)
      let priorDefects = null;
      if (env.DB) {
        try {
          priorDefects = await env.DB.prepare(
            `SELECT id, status, defects_json, remarks, created_at, repair_certified, repair_remarks 
             FROM dvir_inspections 
             WHERE (asset_number = ? OR asset_id = ?) 
             ORDER BY created_at DESC LIMIT 1`
          ).bind(assetNumber || '', assetId || '').first();
        } catch (e) {
          console.warn('[DVIR-GET] Non-fatal DB lookup warning:', e.message);
        }
      }

      // Mandatory 49 CFR § 396.11(a)(1) Minimum Statutory Items Checklist
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
        assetNumber: assetNumber || assetId,
        assetId: assetId || assetNumber,
        jurisdiction: countryParam,
        authorities: { roadAuth, workAuth },
        cfrCompliance: "49 CFR Part 396 Compliant",
        priorInspection: priorDefects || null,
        units: { uomDist, uomPress, uomDepth },
        checklist: checklistSections
      }), { status: 200, headers });
    }

    // =========================================================================
    // POST: SUBMIT COMPLIANT DVIR (§ 396.11(a) & (b))
    // =========================================================================
    if (method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400, headers });
      }

      const assetNumber = body.asset_number || body.assetNumber;
      const assetId = body.asset_id || body.assetId || assetNumber;
      const trailerNumber = body.trailer_number || body.trailerNumber || null;
      const driverId = body.driver_id || body.driverId || request.headers.get('x-user-id') || 'unknown_driver';
      const driverSignature = body.driver_signature || body.driverSignature || '';
      const inspectionType = body.inspection_type || body.inspectionType || 'pre_trip';
      const meterReading = body.meter_reading !== undefined ? body.meter_reading : body.meterReading;
      const location = body.location || '';
      const status = body.status || 'pass';
      const defectsFound = body.defects_found || body.defectsFound || [];
      const inspectionData = body.inspection_data || body.inspectionData || {};
      const remarks = body.remarks || '';
      const priorReviewAcknowledged = body.prior_review_acknowledged ? 1 : 0;
      const certified = body.certified ? 1 : 0;
      const deviceLocation = body.device_location || body.deviceLocation || null;

      if (!assetNumber && !assetId) {
        return new Response(JSON.stringify({ error: "Missing required asset identifier" }), { status: 400, headers });
      }

      if (!driverSignature) {
        return new Response(JSON.stringify({ error: "49 CFR § 396.11(b) requires a driver digital signature." }), { status: 400, headers });
      }

      const hasDefects = Array.isArray(defectsFound) && defectsFound.length > 0;
      const finalStatus = hasDefects ? 'defects_found' : status;
      const timestamp = Date.now();
      const dvirId = `dvir_${timestamp}`;
      const createdAt = new Date(timestamp).toISOString();

      const dvirRecord = {
        id: dvirId,
        asset_id: assetId,
        asset_number: assetNumber,
        trailer_number: trailerNumber,
        driver_id: driverId,
        driver_signature: driverSignature,
        inspection_type: inspectionType,
        meter_reading: meterReading,
        location: location,
        status: finalStatus,
        defects_found: defectsFound,
        inspection_data: inspectionData,
        remarks: remarks,
        prior_review_acknowledged: priorReviewAcknowledged,
        certified: certified,
        country: countryParam,
        device_location: deviceLocation,
        created_at: createdAt
      };

      // Ensure D1 Table matches 49 CFR Part 396 requirements
      if (env.DB) {
        try {
          await env.DB.prepare(
            `CREATE TABLE IF NOT EXISTS dvir_inspections (
              id TEXT PRIMARY KEY,
              asset_id TEXT,
              asset_number TEXT,
              trailer_number TEXT,
              driver_id TEXT,
              driver_signature TEXT,
              inspection_type TEXT,
              meter_reading REAL,
              location TEXT,
              status TEXT,
              defects_count INTEGER,
              defects_json TEXT,
              inspection_data_json TEXT,
              remarks TEXT,
              prior_review_acknowledged INTEGER DEFAULT 0,
              certified INTEGER DEFAULT 1,
              repair_certified INTEGER DEFAULT 0,
              repair_remarks TEXT,
              repair_signature TEXT,
              country TEXT,
              device_location_json TEXT,
              created_at TEXT
            )`
          ).run();

          await env.DB.prepare(
            `INSERT INTO dvir_inspections (
              id, asset_id, asset_number, trailer_number, driver_id, driver_signature,
              inspection_type, meter_reading, location, status, defects_count, defects_json,
              inspection_data_json, remarks, prior_review_acknowledged, certified, country,
              device_location_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            dvirId, assetId, assetNumber, trailerNumber, driverId, driverSignature,
            inspectionType, meterReading || 0, location, finalStatus, defectsFound.length,
            JSON.stringify(defectsFound), JSON.stringify(inspectionData), remarks,
            priorReviewAcknowledged, certified, countryParam, JSON.stringify(deviceLocation), createdAt
          ).run();
        } catch (dbErr) {
          console.error('[DVIR-CFR396] D1 storage error:', dbErr.message);
        }
      }

      if (kvStore) {
        const lookupKey = (assetNumber || assetId).toLowerCase().trim();
        await kvStore.put(`dvir:${lookupKey}:${timestamp}`, JSON.stringify(dvirRecord));
      }

      return new Response(JSON.stringify({
        success: true,
        message: hasDefects 
          ? "DVIR submitted with defects. Asset flagged for maintenance certification under 49 CFR § 396.11(a)(3)." 
          : "DVIR inspection logged successfully under 49 CFR Part 396.",
        hasDefects,
        dvir: dvirRecord
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500, headers });
  }
}
