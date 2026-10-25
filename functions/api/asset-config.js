export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  // Predefined granular component schemas per asset category
  const CATEGORY_SCHEMAS = {
    "Excavator": {
      sections: [
        {
          title: "1. Usage & Engine Metrics",
          fields: [
            { id: "trackHours", label: "Track Engine Hours", type: "toggle", default: true, desc: "Require meter entry during inspections" },
            { id: "idleTimeThreshold", label: "Max Allowed Idle Time (Mins)", type: "number", default: 30, desc: "Flag excessive idling in telemetry" }
          ]
        },
        {
          title: "2. Hydraulics & Attachments",
          fields: [
            { id: "trackHydraulicPressure", label: "Monitor Hydraulic Pressure", type: "toggle", default: true, desc: "Flag main pump pressure spikes" },
            { id: "bucketToothWearLimit", label: "Bucket Tooth Wear Threshold (%)", type: "number", default: 80, desc: "Trigger replacement prompt" },
            { id: "greaseIntervalHours", label: "Pin & Bushing Grease Interval (Hrs)", type: "number", default: 50, desc: "Daily/weekly lubrication cycle" },
            { id: "quickCouplerCheck", label: "Require Quick Coupler Safety Lock Test", type: "toggle", default: true, desc: "Mandatory pre-operation check" }
          ]
        },
        {
          title: "3. Undercarriage & Tracks",
          fields: [
            { id: "trackTensionCheck", label: "Track Sag / Tension Inspection Interval (Days)", type: "number", default: 14, desc: "Prevent thrown tracks" },
            { id: "sprocketWearCheck", label: "Sprocket & Idler Wear Audit", type: "toggle", default: true, desc: "Include in monthly inspections" }
          ]
        },
        {
          title: "4. Preventative Maintenance (PM) Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Oil & Filter Service (Hours)", type: "number", default: 250, desc: "Main PM threshold" },
            { id: "hydraulicFilterInterval", label: "Hydraulic Fluid & Filter Service (Hours)", type: "number", default: 1000, desc: "Major hydraulic service" },
            { id: "pmCalendarInterval", label: "Calendar Service Limit (Days)", type: "number", default: 180, desc: "Max time between services" }
          ]
        }
      ]
    },
    "Class 8 Semi Truck": {
      sections: [
        {
          title: "1. Road Mileage & DOT Compliance",
          fields: [
            { id: "trackOdometer", label: "Track Mileage / Odometer", type: "toggle", default: true, desc: "Log odometer for DOT/IFTA" },
            { id: "dotAnnualInspectionDays", label: "DOT Annual Inspection Alert Window (Days)", type: "number", default: 30, desc: "Notice before expiration" }
          ]
        },
        {
          title: "2. Brakes, Tires & Chassis",
          fields: [
            { id: "airBrakePressureTest", label: "Require Air Brake Leakage & Bleed Check", type: "toggle", default: true, desc: "Pre-trip safety requirement" },
            { id: "minTreadDepth32nd", label: "Minimum Steer Tire Tread Depth (1/32 in)", type: "number", default: 4, desc: "Out of service threshold" },
            { id: "fifthWheelJawCheck", label: "Fifth Wheel Jaw & Kingpin Latch Check", type: "toggle", default: true, desc: "Mandatory coupling check" }
          ]
        },
        {
          title: "3. Preventative Maintenance Schedules",
          fields: [
            { id: "pmMilesInterval", label: "Oil Service Interval (Miles)", type: "number", default: 15000, desc: "Engine service schedule" },
            { id: "pmCalendarInterval", label: "Safety Inspection Interval (Days)", type: "number", default: 90, desc: "Quarterly inspection" }
          ]
        }
      ]
    },
    "Generator": {
      sections: [
        {
          title: "1. Run Time & Telemetry",
          fields: [
            { id: "trackHours", label: "Track Engine Hours", type: "toggle", default: true, desc: "Record run duration" },
            { id: "autoTestExercise", label: "Require Weekly Auto-Exercise Test Log", type: "toggle", default: true, desc: "No-load run verification" }
          ]
        },
        {
          title: "2. Fuel System & Power Output",
          fields: [
            { id: "minFuelLevelPercent", label: "Minimum Fuel Reserve Threshold (%)", type: "number", default: 50, desc: "Alert when fuel drops below level" },
            { id: "loadBankIntervalDays", label: "Load Bank Test Schedule (Days)", type: "number", default: 365, desc: "Annual full load test" },
            { id: "coolantHeaterStatus", label: "Block Heater Temperature Check", type: "toggle", default: true, desc: "Cold-start safety check" }
          ]
        },
        {
          title: "3. Service Intervals",
          fields: [
            { id: "pmMeterInterval", label: "Oil & Filter Change (Hours)", type: "number", default: 200, desc: "Engine service threshold" },
            { id: "pmCalendarInterval", label: "Annual Comprehensive Service (Days)", type: "number", default: 365, desc: "Yearly maintenance" }
          ]
        }
      ]
    },
    "Default": {
      sections: [
        {
          title: "1. Meter & Usage Tracking",
          fields: [
            { id: "trackHours", label: "Track Engine Hours", type: "toggle", default: true, desc: "Require engine hours" },
            { id: "trackOdometer", label: "Track Mileage / Odometer", type: "toggle", default: false, desc: "Require mileage" }
          ]
        },
        {
          title: "2. Inspection Rules",
          fields: [
            { id: "autoWorkOrder", label: "Auto-Create Work Order on Failure", type: "toggle", default: true, desc: "Generate WO when inspection item fails" }
          ]
        },
        {
          title: "3. Maintenance Schedule",
          fields: [
            { id: "pmMeterInterval", label: "PM Meter Interval (Hours)", type: "number", default: 250, desc: "Service interval in hours" },
            { id: "pmCalendarInterval", label: "PM Calendar Interval (Days)", type: "number", default: 180, desc: "Service interval in days" }
          ]
        }
      ]
    }
  };

  try {
    if (method === 'GET') {
      const targetType = url.searchParams.get('targetType') || 'specific';
      const key = url.searchParams.get('key');
      const assetType = url.searchParams.get('assetType') || key || 'Default';

      if (!key) {
        return new Response(JSON.stringify({ error: 'Missing key parameter' }), { status: 400, headers });
      }

      // 1. Resolve Schema based on Asset Category
      const schemaKey = Object.keys(CATEGORY_SCHEMAS).find(k => k.toLowerCase() === assetType.toLowerCase()) || 'Default';
      const schema = CATEGORY_SCHEMAS[schemaKey];

      // 2. Fetch Saved Config Values from KV
      const storageKey = `config:${targetType}:${key.toLowerCase()}`;
      let savedConfig = null;

      if (env.DRIVEN_KV) {
        savedConfig = await env.DRIVEN_KV.get(storageKey, { type: 'json' });
      }

      // Fallback to Category Template if specific override doesn't exist yet
      if (!savedConfig && targetType === 'specific' && assetType) {
        const templateKey = `config:template:${assetType.toLowerCase()}`;
        if (env.DRIVEN_KV) {
          savedConfig = await env.DRIVEN_KV.get(templateKey, { type: 'json' });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        schemaKey,
        schema,
        config: savedConfig || null
      }), { status: 200, headers });
    }

    if (method === 'POST') {
      const body = await request.json();
      const { targetType, key, config } = body;

      if (!targetType || !key || !config) {
        return new Response(JSON.stringify({ error: 'Missing required payload parameters' }), { status: 400, headers });
      }

      const storageKey = `config:${targetType}:${key.toLowerCase()}`;

      if (env.DRIVEN_KV) {
        await env.DRIVEN_KV.put(storageKey, JSON.stringify(config));
      }

      return new Response(JSON.stringify({ success: true, message: 'Configuration saved successfully' }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500, headers });
  }
}
