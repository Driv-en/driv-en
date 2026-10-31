/**
 * Cloudflare Pages Function: /api/dvir
 * Handles DVIR checklist generation (GET) and inspection record submission (POST)
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

  let roadAuth = 'DOT';
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
  } else if (countryParam !== 'US') {
    roadAuth = 'ISO Universal Road Safety';
    workAuth = 'ISO Universal Workplace Safety';
  }

  const kvStore = env.DRIVEN_KV || env.ASSET_CONFIG_KV;

  try {
    // =========================================================================
    // GET: FETCH CHECKLIST
    // =========================================================================
    if (method === 'GET') {
      const assetNumber = url.searchParams.get('assetNumber') || url.searchParams.get('asset_number');
      const assetId = url.searchParams.get('assetId') || url.searchParams.get('asset_id');
      const assetType = url.searchParams.get('assetType') || url.searchParams.get('asset_type') || 'default';

      if (!assetNumber && !assetId) {
        return new Response(JSON.stringify({ error: "Query parameter 'assetNumber' or 'assetId' is required" }), { status: 400, headers });
      }

      const lookupKey = (assetNumber || assetId).toLowerCase().trim();

      let savedConfig = null;
      if (kvStore) {
        savedConfig = await kvStore.get(`config:specific:${lookupKey}`, { type: 'json' });
        if (!savedConfig || !savedConfig.isOverride) {
          savedConfig = await kvStore.get(`config:template:${assetType.toLowerCase().trim()}`, { type: 'json' });
        }
      }

      const rules = (savedConfig && savedConfig.rules) ? savedConfig.rules : {};
      const customItems = (savedConfig && Array.isArray(savedConfig.customItems)) ? savedConfig.customItems : [];

      const checklistSections = [
        {
          title: "1. Regulatory Safety & Emergency Equipment",
          items: [
            { id: "seatBeltCheck", label: `${workAuth} Seat Belt Condition & Retractor Lock`, required: true },
            { id: "hornCheck", label: "Audible Horn Operation (60m / 200ft)", required: true },
            { id: "fireExtinguisherCheck", label: "Fire Extinguisher Charge & Mount Security", required: true },
            { id: "firstAidCheck", label: `${workAuth} Stocked First Aid Kit`, required: true },
            { id: "warningTrianglesCheck", label: `Set of 3 ${roadAuth} Emergency Reflective Triangles`, required: true },
            { id: "wheelChocksCheck", label: "Pair of Wheel Chocks Present", required: true }
          ]
        },
        {
          title: "2. Wheel, Tire & Braking Inspection",
          items: [
            { id: "brakesCheck", label: "Service Brakes & Parking Brake Hold", required: true },
            { id: "steerTreadCheck", label: `Steer Tire Tread Depth (Min ${isMetricRegion ? '3 mm' : '4/32 in'})`, required: true },
            { id: "driveTreadCheck", label: `Drive Tire Tread Depth (Min ${isMetricRegion ? '2 mm' : '2/32 in'})`, required: true },
            { id: "steerPsiCheck", label: `Front / Steer Cold Pressure (${rules.tirePsiSteerRecommended || (isMetricRegion ? 415 : 60)} ${uomPress})`, required: true },
            { id: "drivePsiCheck", label: `Rear / Drive Cold Pressure (${rules.tirePsiDriveRecommended || (isMetricRegion ? 450 : 65)} ${uomPress})`, required: true }
          ]
        },
        {
          title: "3. Lighting, Signal & Marker Audit",
          items: [
            { id: "headlightsCheck", label: "Low & High Beam Headlights", required: true },
            { id: "brakeTailLightsCheck", label: "Tail Lights & Stop / Brake Lights", required: true },
            { id: "turnHazardsCheck", label: "Turn Signals & 4-Way Emergency Hazards", required: true },
            { id: "clearanceMarkersCheck", label: `${roadAuth} Side Marker & ID Clearance Lights`, required: true }
          ]
        },
        {
          title: "4. Engine Compartment, Fluids & Coupling",
          items: [
            { id: "fluidLeaksCheck", label: "Oil, Coolant & Hydraulic Fluid Leak Audit", required: true },
            { id: "beltsHosesCheck", label: "Engine Belts & Hoses Condition", required: true },
            { id: "steeringMechanismCheck", label: "Steering Gear Box & Linkage Free Play", required: true },
            { id: "mirrorsWipersCheck", label: "Mirrors, Windshield & Wiper Blades", required: true }
          ]
        }
      ];

      if (customItems.length > 0) {
        checklistSections.push({
          title: "5. Company & Site Specific Check Items",
          items: customItems.map((itemStr, idx) => ({
            id: `custom_item_${idx}`,
            label: itemStr,
            required: false
          }))
        });
      }

      return new Response(JSON.stringify({
        success: true,
        assetNumber: assetNumber || assetId,
        assetId: assetId || assetNumber,
        jurisdiction: countryParam,
        authorities: { roadAuth, workAuth },
        units: { uomDist, uomPress, uomDepth },
        checklist: checklistSections,
        appliedConfig: savedConfig || null
      }), { status: 200, headers });
    }

    // =========================================================================
    // POST: SUBMIT INSPECTION
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
      const driverId = body.driver_id || body.driverId || request.headers.get('x-user-id') || 'unknown_driver';
      const inspectionType = body.inspection_type || body.inspectionType || 'pre_trip';
      const meterReading = body.meter_reading !== undefined ? body.meter_reading : body.meterReading;
      const location = body.location || '';
      const status = body.status || 'pass';
      const defectsFound = body.defects_found || body.defectsFound || [];
      const inspectionData = body.inspection_data || body.inspectionData || {};
      const remarks = body.remarks || '';
      const certified = body.certified !== undefined ? body.certified : true;
      const deviceLocation = body.device_location || body.deviceLocation || null;

      if (!assetNumber && !assetId) {
        return new Response(JSON.stringify({ error: "Missing required asset identifier ('asset_number' or 'asset_id')" }), { status: 400, headers });
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
        driver_id: driverId,
        inspection_type: inspectionType,
        meter_reading: meterReading,
        location: location,
        status: finalStatus,
        defects_found: defectsFound,
        inspection_data: inspectionData,
        remarks: remarks,
        certified: certified,
        country: countryParam,
        device_location: deviceLocation,
        created_at: createdAt
      };

      // 1. Write to D1 Database if available
      if (env.DB) {
        try {
          await env.DB.prepare(
            `CREATE TABLE IF NOT EXISTS dvir_inspections (
              id TEXT PRIMARY KEY,
              asset_id TEXT,
              asset_number TEXT,
              driver_id TEXT,
              inspection_type TEXT,
              meter_reading REAL,
              location TEXT,
              status TEXT,
              defects_count INTEGER,
              defects_json TEXT,
              inspection_data_json TEXT,
              remarks TEXT,
              country TEXT,
              certified INTEGER,
              device_location_json TEXT,
              created_at TEXT
            )`
          ).run();

          await env.DB.prepare(
            `INSERT INTO dvir_inspections (
              id, asset_id, asset_number, driver_id, inspection_type, meter_reading,
              location, status, defects_count, defects_json, inspection_data_json,
              remarks, country, certified, device_location_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            dvirId,
            assetId,
            assetNumber,
            driverId,
            inspectionType,
            meterReading || 0,
            location,
            finalStatus,
            defectsFound.length,
            JSON.stringify(defectsFound),
            JSON.stringify(inspectionData),
            remarks,
            countryParam,
            certified ? 1 : 0,
            JSON.stringify(deviceLocation),
            createdAt
          ).run();
        } catch (dbErr) {
          console.error('[DVIR-API] D1 insert failed:', dbErr.message);
        }
      }

      // 2. Write to KV Store
      if (kvStore) {
        const lookupKey = (assetNumber || assetId).toLowerCase().trim();
        await kvStore.put(`dvir:${lookupKey}:${timestamp}`, JSON.stringify(dvirRecord));

        if (hasDefects) {
          await kvStore.put(`dvir:defects:${lookupKey}`, JSON.stringify({
            assetNumber,
            assetId,
            latestDvirId: dvirId,
            defectsCount: defectsFound.length,
            defects: defectsFound,
            remarks,
            reportedAt: createdAt,
            workOrderCreated: false
          }));
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: hasDefects 
          ? "DVIR submitted with defects. Asset flagged for maintenance review." 
          : "DVIR inspection logged successfully with zero defects.",
        hasDefects,
        dvir: dvirRecord
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500, headers });
  }
}
