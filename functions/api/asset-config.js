export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-org-id'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  // Predefined granular component schemas per primary category group
  const CATEGORY_SCHEMAS = {
    "excavator": {
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
    "class8semitruck": {
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
    "lightfleet": {
      sections: [
        {
          title: "1. Vehicle Mileage & Usage",
          fields: [
            { id: "trackOdometer", label: "Track Odometer / Mileage", type: "toggle", default: true, desc: "Require entry during inspections" },
            { id: "tpmsAlertThreshold", label: "Tire Pressure (TPMS) Warning Limit (PSI)", type: "number", default: 32, desc: "Minimum tire pressure" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMilesInterval", label: "Oil Change Interval (Miles)", type: "number", default: 5000, desc: "Standard service interval" },
            { id: "tireRotationMiles", label: "Tire Rotation Interval (Miles)", type: "number", default: 7500, desc: "Rotate and balance schedule" }
          ]
        }
      ]
    },
    "drillingrig": {
      sections: [
        {
          title: "1. Engine & Rig Hours",
          fields: [
            { id: "trackHours", label: "Track Engine & Drawworks Hours", type: "toggle", default: true, desc: "Log total operating hours" },
            { id: "topDrivePressureCheck", label: "Require Top Drive / Rotary Hydraulic Pressure Check", type: "toggle", default: true, desc: "Pre-shift inspection requirement" }
          ]
        },
        {
          title: "2. Safety & BOP Systems",
          fields: [
            { id: "bopPressureTestDays", label: "BOP Stack Pressure Test Interval (Days)", type: "number", default: 14, desc: "Mandatory well-control audit" },
            { id: "crownSaverTest", label: "Require Crown Saver & Safety Cut-off Test", type: "toggle", default: true, desc: "Daily pre-shift test" }
          ]
        },
        {
          title: "3. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Rig Engine Service Interval (Hours)", type: "number", default: 250, desc: "Engine PM schedule" },
            { id: "drawworksGreaseHours", label: "Drawworks & Crown Block Lubrication (Hours)", type: "number", default: 24, desc: "Daily lubrication" }
          ]
        }
      ]
    },
    "crane": {
      sections: [
        {
          title: "1. Inspection & Wire Rope Metrics",
          fields: [
            { id: "trackHours", label: "Track Crane Engine & PTO Hours", type: "toggle", default: true, desc: "Log operating hours" },
            { id: "wireRopeInspectionDays", label: "Wire Rope & Sheave Inspection Window (Days)", type: "number", default: 7, desc: "Weekly safety inspection" },
            { id: "lmiTestRequired", label: "Require Load Moment Indicator (LMI) Test", type: "toggle", default: true, desc: "Mandatory pre-operation calibration" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Service Interval (Hours)", type: "number", default: 250, desc: "Standard engine service" },
            { id: "annualCraneCertDays", label: "Annual Third-Party Certification Alert (Days)", type: "number", default: 30, desc: "Advance notice prior to expiration" }
          ]
        }
      ]
    },
    "generator": {
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
    "trailer": {
      sections: [
        {
          title: "1. Brake & Axle Inspection",
          fields: [
            { id: "airBrakePressureTest", label: "Check Air Brake / Electrical Breakaway System", type: "toggle", default: true, desc: "Pre-trip safety check" },
            { id: "minTreadDepth32nd", label: "Minimum Tire Tread Depth (1/32 in)", type: "number", default: 4, desc: "Out of service limit" },
            { id: "wheelBearingGreaseDays", label: "Wheel Bearing Repack Interval (Days)", type: "number", default: 180, desc: "Semi-annual maintenance" }
          ]
        }
      ]
    },
    "default": {
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

  // Comprehensive category normalization for all 18 sections from asset-types.html
  function normalizeCategoryKey(str) {
    if (!str) return "default";
    const s = String(str).toLowerCase().trim();

    // 1. Light & Medium Fleet Vehicles
    if (s.includes("pickup") || s.includes("sedan") || s.includes("suv") || s.includes("cargo van") || s.includes("passenger van") || s.includes("utv") || s.includes("buggy")) {
      return "lightfleet";
    }

    // 2. Heavy Vocational Trucks & Tractors (Class 7-8)
    if (s.includes("day cab") || s.includes("sleeper") || s.includes("straight truck") || s.includes("dump truck") || s.includes("service / utility") || s.includes("bucket") || s.includes("vacuum") || s.includes("hydro-vac") || s.includes("water truck") || s.includes("fuel & lube") || s.includes("concrete mixer") || s.includes("roll-off") || s.includes("winch / bed") || s.includes("wireline") || s.includes("perforating")) {
      return "class8semitruck";
    }

    // 3. Off-Road Extreme Terrain Transport
    if (s.includes("rolligon") || s.includes("tracked dump") || s.includes("morooka") || s.includes("panther") || s.includes("vibroseis") || s.includes("seismic")) {
      return "class8semitruck";
    }

    // 4. Aerial Work Platforms, Personnel Lifts & Cranes
    if (s.includes("boom lift") || s.includes("scissor lift") || s.includes("vertical mast") || s.includes("telehandler") || s.includes("forklift") || s.includes("crane") || s.includes("gantry") || s.includes("jib crane")) {
      return "crane";
    }

    // 5 & 6. Drilling Rigs & Rig Sub-Components
    if (s.includes("drilling rig") || s.includes("coiled tubing") || s.includes("workover") || s.includes("substructure") || s.includes("derrick") || s.includes("drawworks") || s.includes("top drive") || s.includes("mud pump") || s.includes("shale shaker") || s.includes("bop") || s.includes("vfd") || s.includes("frac tank") || s.includes("vacuum tank skid") || s.includes("mud logging")) {
      return "drillingrig";
    }

    // 7. Earthmoving, Paving & Roadwork
    if (s.includes("excavator")) {
      return "excavator";
    }
    if (s.includes("skid steer") || s.includes("wheel loader") || s.includes("dozer") || s.includes("motor grader") || s.includes("backhoe") || s.includes("articulated dump") || s.includes("haul truck") || s.includes("scraper") || s.includes("compactor") || s.includes("paver") || s.includes("milling") || s.includes("reclaimer") || s.includes("striping") || s.includes("asphalt buggy") || s.includes("cold planer")) {
      return "excavator";
    }

    // 8. Deep Foundation, Boring & Tunneling
    if (s.includes("directional drill") || s.includes("hdd") || s.includes("rock saw") || s.includes("trencher") || s.includes("pile driver") || s.includes("tunnel boring") || s.includes("roadheader") || s.includes("pipe jacking") || s.includes("microtunneling") || s.includes("muck transport")) {
      return "drillingrig";
    }

    // 9. Asphalt & Concrete Production Facilities
    if (s.includes("asphalt plant") || s.includes("concrete batch plant") || s.includes("dryer drum") || s.includes("batcher") || s.includes("cement silo") || s.includes("feed bins") || s.includes("central mixer")) {
      return "generator";
    }

    // 10. Pipeline Construction & ROW Clearing
    if (s.includes("sideboom") || s.includes("pipe bender") || s.includes("pipe tac") || s.includes("padding machine") || s.includes("hydrostatic test") || s.includes("jarraff") || s.includes("stump grinder") || s.includes("mulcher") || s.includes("chipper") || s.includes("tub grinder") || s.includes("hydro-ax")) {
      return "excavator";
    }

    // 11. Agriculture, Farming & Timber Forestry
    if (s.includes("agricultural tractor") || s.includes("combine") || s.includes("sprayer") || s.includes("baler") || s.includes("feller buncher") || s.includes("skidder") || s.includes("log loader") || s.includes("forwarder") || s.includes("brush hog") || s.includes("air seeder") || s.includes("grain cart")) {
      return "excavator";
    }

    // 12. Lifting, Material Handling & Shop Cranes
    if (s.includes("a-frame gantry") || s.includes("overhead bridge crane") || s.includes("reach forklift")) {
      return "crane";
    }

    // 13. Mining & Quarrying Operations
    if (s.includes("mine haul") || s.includes("mining shovel") || s.includes("dragline") || s.includes("blast hole") || s.includes("rock crusher") || s.includes("scooptram") || s.includes("screening plant")) {
      return "excavator";
    }

    // 14. Fabrication, Welding & Metalworking
    if (s.includes("welder") || s.includes("plasma") || s.includes("oxy-fuel") || s.includes("press brake") || s.includes("ironworker") || s.includes("cnc") || s.includes("lathe") || s.includes("milling machine") || s.includes("blast pot") || s.includes("fume extraction")) {
      return "generator";
    }

    // 15 & 16. Refineries, Process Plants, Plant Machinery & Utilities
    if (s.includes("generator") || s.includes("air compressor") || s.includes("pump") || s.includes("heat exchanger") || s.includes("pressure vessel") || s.includes("storage tank") || s.includes("boiler") || s.includes("flare stack") || s.includes("hpu") || s.includes("transformer") || s.includes("switchgear") || s.includes("light tower") || s.includes("fin-fan") || s.includes("dust collector") || s.includes("trash pump")) {
      return "generator";
    }

    // 17. Trailers & Transport Equipment
    if (s.includes("trailer") || s.includes("flatbed") || s.includes("step deck") || s.includes("lowboy") || s.includes("tanker trailer") || s.includes("rgn") || s.includes("end dump") || s.includes("tag trailer")) {
      return "trailer";
    }

    // 18. Attachments & Work Tools
    if (s.includes("bucket") || s.includes("breaker") || s.includes("grapple") || s.includes("auger") || s.includes("man basket") || s.includes("skip pan") || s.includes("pallet forks") || s.includes("vac lifter") || s.includes("pipe sucker")) {
      return "excavator";
    }

    return "default";
  }

  try {
    if (method === 'GET') {
      const targetType = url.searchParams.get('targetType') || 'specific';
      const key = url.searchParams.get('key');
      const rawAssetType = url.searchParams.get('assetType') || key || 'default';

      if (targetType === 'specific' && !key) {
        return new Response(JSON.stringify({ 
          error: "Missing required 'key' parameter for targetType 'specific'" 
        }), { status: 400, headers });
      }

      const normKey = normalizeCategoryKey(rawAssetType);
      const schemaKey = Object.keys(CATEGORY_SCHEMAS).find(k => k === normKey) || 'default';
      const schema = CATEGORY_SCHEMAS[schemaKey];

      let savedConfig = null;

      if (env.DRIVEN_KV && key) {
        const storageKey = `config:${targetType}:${key.toLowerCase()}`;
        savedConfig = await env.DRIVEN_KV.get(storageKey, { type: 'json' });
      }

      if (!savedConfig && targetType === 'specific' && rawAssetType && env.DRIVEN_KV) {
        const templateKey = `config:template:${normalizeCategoryKey(rawAssetType)}`;
        savedConfig = await env.DRIVEN_KV.get(templateKey, { type: 'json' });
      }

      return new Response(JSON.stringify({
        success: true,
        schemaKey,
        schema,
        config: savedConfig || null
      }), { status: 200, headers });
    }

    if (method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (jsonErr) {
        return new Response(JSON.stringify({ error: 'Invalid JSON payload in request body' }), { status: 400, headers });
      }

      const { targetType, key, config } = body || {};

      if (!targetType || !key || config === undefined) {
        return new Response(JSON.stringify({ 
          error: "Missing required payload parameters: 'targetType', 'key', and 'config' must be supplied" 
        }), { status: 400, headers });
      }

      if (!env.DRIVEN_KV) {
        return new Response(JSON.stringify({ 
          error: "KV storage binding 'DRIVEN_KV' is not configured on this environment" 
        }), { status: 500, headers });
      }

      const storageKey = `config:${targetType}:${key.toLowerCase()}`;
      await env.DRIVEN_KV.put(storageKey, JSON.stringify(config));

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Configuration saved successfully' 
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500, headers });
  }
}
