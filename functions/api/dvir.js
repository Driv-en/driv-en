export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-org-id, x-country'
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
    if (method === 'GET') {
      const assetNumber = url.searchParams.get('assetNumber');
      const assetType = url.searchParams.get('assetType') || 'default';

      if (!assetNumber) {
        return new Response(JSON.stringify({ error: "Query parameter 'assetNumber' is required" }), { status: 400, headers });
      }

      let savedConfig = null;
      if (kvStore) {
        savedConfig = await kvStore.get(`config:specific:${assetNumber.toLowerCase().trim()}`, { type: 'json' });
        if (!savedConfig || !savedConfig.isOverride) {
          savedConfig = await kvStore.get(`config:template:${assetType.toLowerCase().trim()}`, { type: 'json' });
        }
      }

      const rules = (savedConfig && savedConfig.rules) ? savedConfig.rules : {};
      const customItems = (savedConfig && Array.isArray(savedConfig.customItems)) ? savedConfig.customItems : [];

      const checklistSections = [
        {
          title: "1. Meter & Reading Telematics",
          items: [
            { id: "odometerReading", label: `Current Odometer (${uomDist})`, type: "number", required: true },
            { id: "hourMeterReading", label: "Engine Hours Meter", type: "number", required: false }
          ]
        },
        {
          title: "2. Regulatory Safety & Emergency Equipment",
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
          title: "3. Wheel, Tire & Braking Inspection",
          items: [
            { id: "steerTreadCheck", label: `Steer Tire Tread Depth (Min ${isMetricRegion ? '3 mm' : '4/32 in'})`, required: true },
            { id: "driveTreadCheck", label: `Drive Tire Tread Depth (Min ${isMetricRegion ? '2 mm' : '2/32 in'})`, required: true },
            { id: "steerPsiCheck", label: `Front / Steer Cold Pressure (${rules.tirePsiSteerRecommended || (isMetricRegion ? 415 : 60)} ${uomPress})`, required: true },
            { id: "drivePsiCheck", label: `Rear / Drive Cold Pressure (${rules.tirePsiDriveRecommended || (isMetricRegion ? 450 : 65)} ${uomPress})`, required: true }
          ]
        },
        {
          title: "4. Lighting, Signal & Marker Audit",
          items: [
            { id: "headlightsCheck", label: "Low & High Beam Headlights", required: true },
            { id: "brakeTailLightsCheck", label: "Tail Lights & Stop / Brake Lights", required: true },
            { id: "turnHazardsCheck", label: "Turn Signals & 4-Way Emergency Hazards", required: true },
            { id: "clearanceMarkersCheck", label: `${roadAuth} Side Marker & ID Clearance Lights`, required: true }
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
        assetNumber,
        jurisdiction: countryParam,
        authorities: { roadAuth, workAuth },
        units: { uomDist, uomPress, uomDepth },
        checklist: checklistSections,
        appliedConfig: savedConfig || null
      }), { status: 200, headers });
    }

    if (method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400, headers });
      }

      const { assetNumber, driverId, status, defectsFound, inspectionData } = body || {};

      if (!assetNumber || !status) {
        return new Response(JSON.stringify({ error: "Missing required fields: 'assetNumber' and 'status'" }), { status: 400, headers });
      }

      const dvirRecord = {
        id: `dvir_${Date.now()}`,
        assetNumber,
        driverId: driverId || 'unknown_driver',
        status, // 'pass', 'satisfactory', 'defects_found', 'out_of_service'
        defectsFound: defectsFound || [],
        inspectionData: inspectionData || {},
        country: countryParam,
        createdAt: new Date().toISOString()
      };

      if (kvStore) {
        await kvStore.put(`dvir:${assetNumber.toLowerCase().trim()}:${Date.now()}`, JSON.stringify(dvirRecord));
      }

      return new Response(JSON.stringify({
        success: true,
        message: "DVIR log successfully recorded",
        dvir: dvirRecord
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500, headers });
  }
}
