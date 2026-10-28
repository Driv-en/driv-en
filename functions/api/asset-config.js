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

  // =========================================================================
  // JURISDICTION & UNIT CONFIGURATION CONTEXT
  // =========================================================================
  const countryParam = (url.searchParams.get('country') || request.headers.get('x-country') || 'US').toUpperCase().trim();
  const isCanada = countryParam === 'CA';

  // Dynamic Units
  const uomVol = url.searchParams.get('vol') === 'L' || isCanada ? 'Liters' : 'Gallons';
  const uomPress = (url.searchParams.get('press') || 'PSI').toUpperCase();
  const uomDist = url.searchParams.get('dist') === 'km' || isCanada ? 'Kilometers' : 'Miles';
  const uomDepth = isCanada ? 'mm' : '1/32 in';

  // Dynamic Badges & Authority References
  const roadAuth = isCanada ? 'NSC Standard 11' : 'DOT';
  const workAuth = isCanada ? 'CCOHS / COR' : 'OSHA / MSHA';

  // =========================================================================
  // UNIVERSAL REUSABLE SECTION GENERATORS
  // =========================================================================

  const createTireConfigurationSection = (configType = 'standard_2axle') => {
    let fields = [
      { id: "tireSizeSteer", label: "Front / Steer Tire Size Specification", type: "text", default: "LT275/70R18", desc: "Manufacturer spec steer tire size" },
      { id: "tirePsiSteerRecommended", label: `Front / Steer Recommended Cold Inflation (${uomPress})`, type: "number", default: 60, desc: "Door-jamb recommended inflation" },
      { id: "tireSizeDrive", label: "Rear / Drive Tire Size Specification", type: "text", default: "LT275/70R18", desc: "Manufacturer spec drive tire size" },
      { id: "tirePsiDriveRecommended", label: `Rear / Drive Recommended Cold Inflation (${uomPress})`, type: "number", default: 65, desc: "Door-jamb recommended inflation" },
      { id: "tpmsThresholdLowPsi", label: `TPMS Low Inflation Alarm Trigger (${uomPress})`, type: "number", default: 50, desc: "Telemetry alert threshold" },
      { id: "isDuallyConfiguration", label: "Dually Rear Axle Setup (1-Ton Dual Wheels)", type: "toggle", default: false, desc: "Enable 4-tire tracking on rear axle" },
      { id: "minSteerTread32nd", label: `${workAuth} / ${roadAuth} Minimum Steer Tire Tread Depth (${uomDepth})`, type: "number", default: isCanada ? 3 : 4, desc: `Out-of-service limit (${isCanada ? '3 mm' : '4/32 in'} min)` },
      { id: "minDriveTread32nd", label: `${workAuth} / ${roadAuth} Minimum Drive Tire Tread Depth (${uomDepth})`, type: "number", default: isCanada ? 2 : 2, desc: `Out-of-service limit (${isCanada ? '2 mm' : '2/32 in'} min)` }
    ];

    if (configType === 'multi_axle_trailer') {
      fields = [
        { id: "axleCount", label: "Trailer Axle Quantity", type: "number", default: 2, desc: "Total number of trailer axles (1-4)" },
        { id: "isDuallyTrailer", label: "Dually Axle Setup (Dual Wheels Per Side)", type: "toggle", default: false, desc: "Enable inner/outer position tracking" },
        { id: "trailerTireSize", label: "Trailer Tire Size Spec (ST / LT)", type: "text", default: "ST235/80R16", desc: "Trailer tire size rating" },
        { id: "trailerTirePsiRecommended", label: `Trailer Recommended Cold Inflation (${uomPress})`, type: "number", default: 80, desc: "Spec inflation pressure" },
        { id: "minTrailerTread32nd", label: `${workAuth} / ${roadAuth} Minimum Trailer Tread Depth (${uomDepth})`, type: "number", default: isCanada ? 2 : 2, desc: "Legal minimum tread" },
        { id: "trackSpecificTirePositions", label: "Enable Individual Wheel Position Tracking", type: "toggle", default: true, desc: "Track wear/replacements per position (Axle 1 L/R, Axle 2 L/R, Inner/Outer)" }
      ];
    }

    return {
      title: "Wheel Position, Tire Specs & Pressure Telematics",
      fields
    };
  };

  const createConsumablePartsSection = () => ({
    title: "Consumable Parts, Quantities & Replacement Numbers",
    fields: [
      { id: "partEngineOilFilter", label: "Engine Oil Filter Part #", type: "text", default: "", desc: "OEM or aftermarket filter code" },
      { id: "partEngineOilQty", label: `Engine Oil Capacity & Spec (${uomVol})`, type: "text", default: isCanada ? "5.7 L / 5W-30 Full Synthetic" : "6 Qt / 5W-30 Full Synthetic", desc: "Engine oil spec and volume" },
      { id: "partTransFluidTypeQty", label: `Transmission Fluid Spec & Capacity (${uomVol})`, type: "text", default: isCanada ? "11.4 L / Dexron VI" : "12 Qt / Dexron VI", desc: "Fluid specification and fill capacity" },
      { id: "partBrakeFluidTypeQty", label: `Brake Fluid Spec & Capacity (${uomVol})`, type: "text", default: isCanada ? "1 L / DOT 3" : "32 oz / DOT 3", desc: "Fluid specification and fill capacity" },
      { id: "partCoolantTypeQty", label: `Engine Coolant Spec & Capacity (${uomVol})`, type: "text", default: isCanada ? "13.2 L / 50/50 OAT" : "14 Qt / 50/50 OAT", desc: "Antifreeze spec and capacity" },
      { id: "partFuelFilterPrimary", label: "Primary Fuel Filter / Water Separator Part #", type: "text", default: "", desc: "Primary fuel filter code" },
      { id: "partFuelFilterSecondary", label: "Secondary Fuel Filter Part #", type: "text", default: "", desc: "Secondary fuel filter code" },
      { id: "partAirFilterPrimary", label: "Primary Air Intake Filter Part #", type: "text", default: "", desc: "Engine intake filter" },
      { id: "partAirFilterSecondary", label: "Secondary / Safety Air Filter Part #", type: "text", default: "", desc: "Inner safety filter code" },
      { id: "partCabinAirFilter", label: "Cabin HVAC Air Filter Part #", type: "text", default: "", desc: "Cabin filter code" },
      { id: "partWiperBlades", label: "Wiper Blade Set Part #", type: "text", default: "", desc: "Driver & passenger wiper sizes/part numbers" },
      { id: "partHydraulicFilterMain", label: "Main Hydraulic Return / Pressure Filter Part #", type: "text", default: "", desc: "Hydraulic filter number" },
      { id: "partHydraulicOilQty", label: `Hydraulic Reservoir Fluid Capacity (${uomVol})`, type: "text", default: "", desc: "Total fluid volume" },
      { id: "partBrakePadsFront", label: "Front Brake Pad Set Part # & Quantity", type: "text", default: "", desc: "Front brake pad kit spec" },
      { id: "partBrakePadsRear", label: "Rear Brake Pad Set / Shoe Kit Part #", type: "text", default: "", desc: "Rear brake kit spec" },
      { id: "partSerpentineBelt", label: "Main Engine Serpentine Belt Part #", type: "text", default: "", desc: "Drive belt part number" }
    ]
  });

  const createLightingAndPlacardsSection = (customLights = [], customPlacards = []) => {
    const baseLights = [
      { id: "lightHeadlightsLowHigh", label: "Low & High Beam Headlights", type: "toggle", default: true, desc: "Illumination check" },
      { id: "lightBrakeAndTail", label: "Tail Lights & Stop / Brake Lights", type: "toggle", default: true, desc: "Rear illumination check" },
      { id: "lightTurnSignalsHazards", label: "Turn Signals, Blinkers & 4-Way Emergency Hazard Flashers", type: "toggle", default: true, desc: "Directional indicators" },
      { id: "lightClearanceMarker", label: "Clearance, Side Marker & ID Lights (>2.03 m / 80 in wide)", type: "toggle", default: true, desc: `${roadAuth} width marker lights` },
      { id: "lightLicensePlate", label: "License Plate Tag Light", type: "toggle", default: true, desc: "Rear tag illumination" },
      { id: "lightReverseBackup", label: "Reverse Backup Lights & Audible Alarm Signal", type: "toggle", default: true, desc: `${workAuth} required backup warning` },
      { id: "lightStrobeBeacon", label: "Amber Strobe Light / Rotating Beacon", type: "toggle", default: true, desc: `${workAuth} jobsite hazard warning light` },
      { id: "lightOtherAuxiliary", label: "Auxiliary & Other Lights Not Listed Above", type: "toggle", default: true, desc: "Inspect light bars, beacons, work lights, and clearance lights" },
      ...customLights
    ];

    const basePlacards = [
      { id: "placardDotHazmat", label: `${roadAuth} Hazmat Placards & Class Identification Signs`, type: "toggle", default: false, desc: "When carrying hazardous goods (TDG / DOT)" },
      { id: "signEmergencyStop", label: "E-Stop Safety Labeling & Machine Cut-Off Signage", type: "toggle", default: true, desc: `${workAuth} required red E-stop signage` },
      { id: "signMaxPayloadCapacity", label: "Max Load Capacity / Towing Rating Warning Decal", type: "toggle", default: true, desc: `${workAuth} rating decal on frame/cab` },
      { id: "signSlowMovingVehicle", label: "Slow Moving Vehicle (SMV) Triangle Emblem", type: "toggle", default: false, desc: "Required for assets operating under 40 km/h (25 mph)" },
      ...customPlacards
    ];

    return {
      title: "Lighting Systems, Required Placards & Safety Signage",
      fields: [...baseLights, ...basePlacards]
    };
  };

  const createOshaMandatesSection = () => ({
    title: isCanada ? "Canadian NSC Standard 11 & CCOHS Mandated Safety Devices" : "OSHA / MSHA Mandated Safety Devices & Emergency Equipment",
    fields: [
      { id: "seatBeltMandate", label: `${workAuth} Seat Belt Functional & Webbing Inspection`, type: "toggle", default: true, desc: isCanada ? "Mandatory check per CCOHS / NSC Standard 11" : "Mandatory check per 29 CFR 1926.601(b)(9) / MSHA 30 CFR 56.14130" },
      { id: "hornAudible200ft", label: "Audible Warning Horn Operational (Audible at 60 m / 200 ft)", type: "toggle", default: true, desc: `${workAuth} compliance` },
      { id: "fireExtinguisherCharged", label: "On-Board Fire Extinguisher (Gauge Green, Sealed & Mounted)", type: "toggle", default: true, desc: `${workAuth} safety requirement` },
      { id: "firstAidKitStocked", label: `${workAuth} Compliant Stocked First Aid Kit`, type: "toggle", default: true, desc: "Required pre-shift emergency inventory" },
      { id: "dotReflectiveTriangles", label: `Set of 3 ${roadAuth} Emergency Reflective Triangles / Flares`, type: "toggle", default: true, desc: `${roadAuth} emergency breakdown kit` },
      { id: "wheelChocksPair", label: "Pair of Heavy Duty Wheel Chocks Present", type: "toggle", default: true, desc: "Required parking containment" }
    ]
  });

  // =========================================================================
  // GRANULAR CONFIGURATION SCHEMAS FOR ALL EQUIPMENT TYPES
  // =========================================================================
  const CATEGORY_SCHEMAS = {

    // -----------------------------------------------------------------------
    // SECTION 1: LIGHT & MEDIUM FLEET VEHICLES
    // -----------------------------------------------------------------------
    "pickup": {
      sections: [
        {
          title: "1. Light Pickup Truck Baseline & Cab Specifications",
          fields: [
            { id: "cabStyle", label: "Cab Configuration Style", type: "text", default: "Crew Cab", desc: "Single Cab, Extended Cab, Crew Cab" },
            { id: "bedType", label: "Bed Type & Setup", type: "text", default: "Standard Bed", desc: "Short Bed, Long Bed, Utility Bed, Flatbed" },
            { id: "transmissionType", label: "Transmission Type", type: "text", default: "Automatic", desc: "Automatic / Manual" },
            { id: "fuelType", label: "Fuel Type", type: "text", default: "Gasoline", desc: "Gasoline, Diesel, Flex Fuel, EV" },
            { id: "hasWinch", label: "Equipped with Auxiliary Winch", type: "toggle", default: false, desc: "Enable winch configuration" },
            { id: "trackOdometer", label: `Track Odometer Mileage (${uomDist})`, type: "toggle", default: true, desc: "Require mileage entry during pre-trip checks" }
          ]
        },
        {
          title: "2. Engine Compartment, HVAC & Controls Inspection",
          fields: [
            { id: "inspectACHeaterDefroster", label: "Audit HVAC (Air Conditioner, Heater, Defroster)", type: "toggle", default: true, desc: "Require check for heating, cooling, and window defrosting" },
            { id: "inspectWipersWashers", label: "Audit Windshield Wipers & Washers", type: "toggle", default: true, desc: "Check wiper blade condition and washer fluid spray" },
            { id: "oilLevelCheck", label: "Require Engine Oil Level & Fluid Leak Audit", type: "toggle", default: true, desc: "Inspect dipstick level and valve cover/pan leaks" },
            { id: "coolantSystemCheck", label: "Coolant Reservoir & Hose Swell Inspection", type: "toggle", default: true, desc: "Check coolant level and radiator hoses" },
            { id: "driveBeltCheck", label: "Serpentine Belt & Tensioner Inspection", type: "toggle", default: true, desc: "Check belt for cracking, fraying, or tension loss" },
            { id: "batteryTerminalCheck", label: "Battery Hold-down & Terminal Corrosion Check", type: "toggle", default: true, desc: "Inspect hold-down clamp and cable tightness" }
          ]
        },
        {
          title: "3. Steering, Suspension, Drivetrain & Winch Audit",
          fields: [
            { id: "steeringLinkagePlay", label: "Tie-Rod & Drag Link Play Audit", type: "toggle", default: true, desc: "Inspect steering shaft and tie-rod boots for play" },
            { id: "suspensionLeafCheck", label: "Leaf Spring & Shock Absorber Leak Audit", type: "toggle", default: true, desc: "Check for cracked spring leaves and shock fluid leaks" },
            { id: "fourWheelDriveCheck", label: "Require 4WD Actuator & Transfer Case Engagement Check", type: "toggle", default: true, desc: "Test 4x4 engagement and check differential seals" },
            { id: "driveshaftUjointCheck", label: "Driveshaft U-Joint & Slip Yoke Play Audit", type: "toggle", default: true, desc: "Inspect needle bearings and driveshaft slop" },
            { id: "inspectWinchOperation", label: "Audit Winch Cable & Remote Control", type: "toggle", default: false, desc: "Inspect winch cable tension, spooling, and controller" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection([
          { id: "lightWorkBed", label: "Truck Bed Utility Work Light", type: "toggle", default: true, desc: "Bed area illumination" }
        ], [
          { id: "signFuelType", label: "Diesel Fuel / Gasoline Only Fuel Cap Decal", type: "toggle", default: true, desc: "Misfuel prevention signage" }
        ]),
        createOshaMandatesSection(),
        {
          title: "7. Truck Bed, Cargo Securement & Towing Hitch",
          fields: [
            { id: "headacheRackCheck", label: "Headache Rack / Cab Guard Security Audit", type: "toggle", default: true, desc: "Verify cab protector mounting bolts" },
            { id: "bedAnchorDringCheck", label: "Bed Tie-Down Anchor & D-Ring Inspection", type: "toggle", default: true, desc: "Inspect cargo securement anchors for cracks" },
            { id: "receiverHitchBoltCheck", label: "Class III/IV/V Receiver & Gooseneck Puck Audit", type: "toggle", default: true, desc: "Inspect frame mounting bolts and safety chain loops" },
            { id: "trailerPlugSevenWayCheck", label: "7-Way / 4-Way Electrical Trailer Connector Check", type: "toggle", default: true, desc: "Inspect trailer plug pins and spring cover lock" }
          ]
        },
        createConsumablePartsSection(),
        {
          title: "9. Preventative Maintenance (PM) Schedules",
          fields: [
            { id: "pmMilesInterval", label: `Engine Oil & Filter Change Interval (${uomDist})`, type: "number", default: isCanada ? 8000 : 5000, desc: "Standard oil change threshold" },
            { id: "tireRotationMiles", label: `Tire Rotation & Balance Schedule (${uomDist})`, type: "number", default: isCanada ? 12000 : 7500, desc: "Tire rotation interval" },
            { id: "brakePadCheckMiles", label: `Brake Lining & Rotor Service Interval (${uomDist})`, type: "number", default: isCanada ? 24000 : 15000, desc: "Comprehensive brake wear inspection" }
          ]
        }
      ]
    },

    "medtruck": {
      sections: [
        {
          title: "1. Vocational Mileage & Aux Hydraulics",
          fields: [
            { id: "trackOdometer", label: `Track Odometer (${uomDist})`, type: "toggle", default: true, desc: "Log odometer reading" },
            { id: "trackPtoHours", label: "Track PTO / Auxiliary Engine Hours", type: "toggle", default: true, desc: "Separate PTO runtime from road mileage" },
            { id: "hydraulicLiftCheck", label: "Hydraulic Hoist / Lift Pressure Test", type: "toggle", default: true, desc: "Flag bed/lift pump pressure drops" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection(),
        {
          title: "5. Service Intervals",
          fields: [
            { id: "pmMilesInterval", label: `Medium Diesel Oil Service (${uomDist})`, type: "number", default: isCanada ? 12000 : 7500, desc: "Engine PM schedule" },
            { id: "ptoHydraulicServiceHours", label: "PTO Hydraulic Fluid Change (Hours)", type: "number", default: 500, desc: "Hydraulic system service" }
          ]
        }
      ]
    },

    "utv": {
      sections: [
        {
          title: "1. Off-Road Usage & Safety",
          fields: [
            { id: "trackHours", label: "Track Operating Hours", type: "toggle", default: true, desc: "Require hour meter logging" },
            { id: "ropsStructureCheck", label: "Require ROPS Cage & Seatbelt Latch Audit", type: "toggle", default: true, desc: "Pre-shift safety restraint inspection" },
            { id: "cvtBeltCheck", label: "CVT Drive Belt Wear & Dust Inspection (Hours)", type: "number", default: 100, desc: "Inspect clutch belt" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "sedan": {
      sections: [
        {
          title: "1. Fleet Usage & Maintenance",
          fields: [
            { id: "trackOdometer", label: `Track Odometer (${uomDist})`, type: "toggle", default: true, desc: "Require distance tracking" },
            { id: "cabinFilterInterval", label: `Cabin & Air Filter Replacement (${uomDist})`, type: "number", default: isCanada ? 24000 : 15000, desc: "HVAC maintenance" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "cargovan": {
      sections: [
        {
          title: "1. Payload & Cargo Door Safety",
          fields: [
            { id: "trackOdometer", label: `Track Distance (${uomDist})`, type: "toggle", default: true, desc: "Log odometer" },
            { id: "cargoTieDownCheck", label: "Cargo Lashing & Partition Wall Audit", type: "toggle", default: true, desc: "Inspect load containment anchors" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    // -----------------------------------------------------------------------
    // SECTION 2: HEAVY VOCATIONAL TRUCKS & TRACTORS (CLASS 7-8)
    // -----------------------------------------------------------------------
    "class8semitruck": {
      sections: [
        {
          title: "1. Highway Compliance & Telematics",
          fields: [
            { id: "trackOdometer", label: `Track Distance (${uomDist})`, type: "toggle", default: true, desc: `Log distance for ${roadAuth} & IFTA` },
            { id: "dotAnnualInspectionDays", label: `${roadAuth} Annual Inspection Alert Window (Days)`, type: "number", default: 30, desc: "Advance warning prior to cert expiry" },
            { id: "eldSyncRequired", label: "Require ELD Telematics Synchronization", type: "toggle", default: true, desc: "Enforce HOS log validation" }
          ]
        },
        {
          title: "2. Air Brakes & Safety Coupling",
          fields: [
            { id: "airBrakePressureTest", label: "Require Air Brake Leakage & Bleed Check", type: "toggle", default: true, desc: "Pre-trip air system test" },
            { id: "fifthWheelJawCheck", label: "Fifth Wheel Jaw & Kingpin Lock Test", type: "toggle", default: true, desc: "Verify trailer coupling" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection(),
        {
          title: "6. Maintenance Schedules",
          fields: [
            { id: "pmMilesInterval", label: `Heavy Diesel Oil Service (${uomDist})`, type: "number", default: isCanada ? 25000 : 15000, desc: "Engine oil change limit" },
            { id: "pmCalendarInterval", label: "Chassis Grease & Safety Limit (Days)", type: "number", default: 90, desc: "Quarterly chassis lube cycle" }
          ]
        }
      ]
    },

    "dumptruck": {
      sections: [
        {
          title: "1. Dump Body & Hydraulic Hoist",
          fields: [
            { id: "trackOdometer", label: `Track Distance (${uomDist})`, type: "toggle", default: true, desc: "Log reading" },
            { id: "trackPtoHours", label: "Track PTO Hoist Operating Hours", type: "toggle", default: true, desc: "Log hydraulic dump time" },
            { id: "tailgateLatchCheck", label: "Require Tailgate Air Latch Lock Test", type: "toggle", default: true, desc: "Prevent accidental dumping on road" },
            { id: "dumpBodySafetyPin", label: `${workAuth} Required Dump Body Safety Support Lock Pin`, type: "toggle", default: true, desc: "Mechanical safety prop requirement" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "servicetruck": {
      sections: [
        {
          title: "1. Mounted Crane & Air Compressor PTO",
          fields: [
            { id: "trackOdometer", label: `Track Distance (${uomDist})`, type: "toggle", default: true, desc: "Log odometer reading" },
            { id: "trackPtoHours", label: "Track PTO Crane / Compressor Hours", type: "toggle", default: true, desc: "Log auxiliary engine hours" },
            { id: "craneLmiTest", label: "Mounted Service Crane Overload LMI Test", type: "toggle", default: true, desc: "Verify crane overload cut-off" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "vactruck": {
      sections: [
        {
          title: "1. Hydro-Vac & Blower Metrics",
          fields: [
            { id: "trackPtoHours", label: "Track Blower & Vacuum Engine Hours", type: "toggle", default: true, desc: "Record high-CFM blower runtime" },
            { id: "waterPressureCheck", label: `Monitor High-Pressure Water Pump (${uomPress})`, type: "toggle", default: true, desc: "Flag pressure washer drops" },
            { id: "debrisTankLatchCheck", label: "Debris Tank Rear Door Seal Audit", type: "toggle", default: true, desc: "Prevent slurry leaks during transit" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "mixertruck": {
      sections: [
        {
          title: "1. Drum Drive & Chute Safety",
          fields: [
            { id: "trackDrumHours", label: "Track Drum PTO Operating Hours", type: "toggle", default: true, desc: "Log drum rotation runtime" },
            { id: "chuteLockCheck", label: "Require Discharge Chute Fold-Lock Audit", type: "toggle", default: true, desc: "Pre-trip travel safety check" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    // -----------------------------------------------------------------------
    // SECTION 3: OFF-ROAD EXTREME TERRAIN TRANSPORT
    // -----------------------------------------------------------------------
    "rolligon": {
      sections: [
        {
          title: "1. Low-Ground-Pressure Tires & Articulation",
          fields: [
            { id: "trackHours", label: "Track Operating Hours", type: "toggle", default: true, desc: "Record engine run hours" },
            { id: "lowPressureTirePsi", label: `LGP Bag Tire Inflation Threshold (${uomPress})`, type: "number", default: 5, desc: "Ultra-low pressure audit for tundra/swamp" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "trackedcarrier": {
      sections: [
        {
          title: "1. Track Tension & Bed Dump Hydraulics",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Log run time" },
            { id: "rubberTrackTensionCheck", label: "Rubber Track Sag & Sprocket Audit", type: "toggle", default: true, desc: "Prevent thrown tracks in mud" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    // -----------------------------------------------------------------------
    // SECTION 4: AERIAL WORK PLATFORMS & LIFTING
    // -----------------------------------------------------------------------
    "boomlift": {
      sections: [
        {
          title: "1. Platform & Slope Safety Cut-offs",
          fields: [
            { id: "trackHours", label: "Track Engine / Electric Hours", type: "toggle", default: true, desc: "Log machine hours" },
            { id: "tiltSensorTest", label: "Require Chassis Tilt Level Sensor & Alarm Check", type: "toggle", default: true, desc: "Mandatory slope cut-off test" },
            { id: "harnessAnchorCheck", label: "Inspect Basket Fall Protection Anchor Points", type: "toggle", default: true, desc: "Daily lanyard anchor audit" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection([], [
          { id: "signPlatformCapacity", label: "Platform Max Occupancy & Capacity Decal", type: "toggle", default: true, desc: isCanada ? "CSA B354 / CCOHS decal" : "ANSI A92.20 decal" }
        ]),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "scissorlift": {
      sections: [
        {
          title: "1. Scissor Stack & Pothole Protection",
          fields: [
            { id: "trackHours", label: "Track Hour Meter", type: "toggle", default: true, desc: "Log operating time" },
            { id: "potholeGuardCheck", label: "Pothole Protection Skirt Deployment Test", type: "toggle", default: true, desc: "Verify automatic drop guard" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    // -----------------------------------------------------------------------
    // SECTION 5 & 6: DRILLING RIGS & SUB-COMPONENTS
    // -----------------------------------------------------------------------
    "drillingrig": {
      sections: [
        {
          title: "1. Rig Power & Drawworks Telematics",
          fields: [
            { id: "trackHours", label: "Track Rig Engine & Drawworks Hours", type: "toggle", default: true, desc: "Log engine run hours" },
            { id: "crownSaverTest", label: "Require Crown-Saver Safety Cut-off Test", type: "toggle", default: true, desc: `${workAuth} / API RP 54 requirement` }
          ]
        },
        {
          title: "2. Well Control & BOP Systems",
          fields: [
            { id: "bopPressureTestDays", label: "BOP Stack Pressure Test Interval (Days)", type: "number", default: 14, desc: "Mandatory well-control audit" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "workoverrig": {
      sections: [
        {
          title: "1. Mast & Guywire Safety",
          fields: [
            { id: "trackHours", label: "Track Carrier Engine Hours", type: "toggle", default: true, desc: "Log pulling unit runtime" },
            { id: "guywireTensionCheck", label: "Require Mast Guywire Anchor & Tension Audit", type: "toggle", default: true, desc: "Mandatory before raising derrick" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "coiledtubing": {
      sections: [
        {
          title: "1. Injector Head & Reel Fatigue",
          fields: [
            { id: "trackHours", label: "Track Power Pack Hours", type: "toggle", default: true, desc: "Record unit run hours" },
            { id: "stringFatigueLog", label: "Require Coiled Tubing String Running Fatigue Log", type: "toggle", default: true, desc: "Log depth run per cycle" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "mudpump": {
      sections: [
        {
          title: "1. Triplex / Quintuplex Fluid End",
          fields: [
            { id: "trackHours", label: "Track Pump Operating Hours", type: "toggle", default: true, desc: "Log stroke hours" },
            { id: "dischargePulsationDampener", label: `Pulsation Dampener Nitrogen Pre-Charge (${uomPress})`, type: "number", default: 750, desc: "Check dampener bladder charge" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "bopstack": {
      sections: [
        {
          title: "1. Ram Seals & Accumulator Unit",
          fields: [
            { id: "ramPackingElementCheck", label: "Pipe & Blind Ram Rubber Packing Wear Audit", type: "toggle", default: true, desc: "Inspect ram elastomer seals" },
            { id: "bopHydroTestDays", label: "High/Low Pressure Chart Test Interval (Days)", type: "number", default: 14, desc: "Mandatory chart test schedule" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection()
      ]
    },

    // -----------------------------------------------------------------------
    // SECTION 7: EARTHMOVING, PAVING & ROADWORK
    // -----------------------------------------------------------------------
    "excavator": {
      sections: [
        {
          title: "1. Usage & Engine Telematics",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Require meter entry" },
            { id: "idleTimeThreshold", label: "Max Allowed Idle Time (Mins)", type: "number", default: 30, desc: "Flag excessive idling" }
          ]
        },
        {
          title: "2. Hydraulics & Attachments",
          fields: [
            { id: "quickCouplerCheck", label: "Require Quick Coupler Safety Lock Pin Test", type: "toggle", default: true, desc: "Prevent bucket drops" },
            { id: "bucketToothWearLimit", label: "Bucket Tooth Wear Threshold (%)", type: "number", default: 80, desc: "Trigger replacement prompt" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection(),
        {
          title: "5. Preventative Maintenance Intervals",
          fields: [
            { id: "pmMeterInterval", label: "Engine Oil Service Interval (Hours)", type: "number", default: 250, desc: "PM threshold" },
            { id: "hydraulicFilterInterval", label: "Hydraulic Fluid & Filter Change (Hours)", type: "number", default: 1000, desc: "Major hydraulic PM" }
          ]
        }
      ]
    },

    "dozer": {
      sections: [
        {
          title: "1. Blade & Undercarriage Metrics",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Log run hours" },
            { id: "cuttingEdgeWearLimit", label: "Blade Cutting Edge Wear Threshold (%)", type: "number", default: 85, desc: "Prompt edge reversal" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "loader": {
      sections: [
        {
          title: "1. Articulation & Brake Accumulator",
          fields: [
            { id: "trackHours", label: "Track Engine Hours", type: "toggle", default: true, desc: "Record run hours" },
            { id: "articulationLockCheck", label: "Require Articulation Steering Lock Pin Test", type: "toggle", default: true, desc: "Pre-service transport lock check" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "grader": {
      sections: [
        {
          title: "1. Moldboard & Circle Drive",
          fields: [
            { id: "trackHours", label: "Track Operating Hours", type: "toggle", default: true, desc: "Log total engine hours" },
            { id: "moldboardCuttingEdge", label: "Moldboard Cutting Edge Wear Threshold (%)", type: "number", default: 80, desc: "Replace blade edge before moldboard wear" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "paver": {
      sections: [
        {
          title: "1. Screed Heating & Conveyor Flight Bars",
          fields: [
            { id: "trackHours", label: "Track Engine Hours", type: "toggle", default: true, desc: "Log engine runtime" },
            { id: "screedHeatingSystemCheck", label: "Electric / Diesel Screed Heating Element Audit", type: "toggle", default: true, desc: "Verify uniform screed heating" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    // -----------------------------------------------------------------------
    // SECTION 8: DEEP FOUNDATION, BORING & TUNNELING
    // -----------------------------------------------------------------------
    "hdd": {
      sections: [
        {
          title: "1. Thrust & Mud Pressure Telemetry",
          fields: [
            { id: "trackHours", label: "Track Drill Rig Engine Hours", type: "toggle", default: true, desc: "Log operating runtime" },
            { id: "drillingMudFlowRate", label: `Monitor Mud Pump Pressure & Flow (LPM / GPM)`, type: "toggle", default: true, desc: "Flag downhole circulation loss" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "piledriver": {
      sections: [
        {
          title: "1. Hammer & Lead Alignment",
          fields: [
            { id: "trackHours", label: "Track Power Pack Engine Hours", type: "toggle", default: true, desc: "Log runtime" },
            { id: "vibratoryHammerOil", label: "Vibratory Hammer Eccentric Oil Level Check", type: "toggle", default: true, desc: "Check eccentric gearbox oil daily" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    // -----------------------------------------------------------------------
    // SECTION 9: PLANTS & PRODUCTION FACILITIES
    // -----------------------------------------------------------------------
    "asphaltplant": {
      sections: [
        {
          title: "1. Dryer Drum, Burner & Baghouse",
          fields: [
            { id: "trackHours", label: "Track Plant Burner Run Hours", type: "toggle", default: true, desc: "Log dryer drum runtime" },
            { id: "baghouseDifferentialPressure", label: "Baghouse Differential Pressure Limit (kPa / In. W.C.)", type: "number", default: 6, desc: "Flag filter bag blinding" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "concreteplant": {
      sections: [
        {
          title: "1. Batcher, Cement Silo & Scale Calibration",
          fields: [
            { id: "trackHours", label: "Track Plant Operating Hours", type: "toggle", default: true, desc: "Log batching runtime" },
            { id: "scaleCalibrationDays", label: "Aggregate & Cement Scale Calibration Interval (Days)", type: "number", default: 180, desc: "Semi-annual scale certification" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    // -----------------------------------------------------------------------
    // SECTION 10 & 11: PIPELINE, FORESTRY & AGRICULTURE
    // -----------------------------------------------------------------------
    "sideboom": {
      sections: [
        {
          title: "1. Boom, Drawworks & Wire Rope",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Log engine runtime" },
            { id: "counterweightLockCheck", label: "Extendable Counterweight Safety Lock Test", type: "toggle", default: true, desc: "Verify hydraulic counterweight latch" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "mulcher": {
      sections: [
        {
          title: "1. Rotor Teeth & High-Flow Hydraulics",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Log operating time" },
            { id: "rotorCarbideToothCheck", label: "Mulcher Head Tooth & Carbide Wear Audit", type: "toggle", default: true, desc: "Daily inspection for missing teeth" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "fellerbuncher": {
      sections: [
        {
          title: "1. Saw Head & Hydraulics",
          fields: [
            { id: "trackHours", label: "Track Operating Hours", type: "toggle", default: true, desc: "Record run hours" },
            { id: "sawDiscToothCheck", label: "High-Speed Saw Disc Tooth Tightness Audit", type: "toggle", default: true, desc: "Daily safety check on cutting disc" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "skidder": {
      sections: [
        {
          title: "1. Grapple & Winch Operations",
          fields: [
            { id: "trackHours", label: "Track Engine Hours", type: "toggle", default: true, desc: "Log runtime" },
            { id: "winchCableCheck", label: "Logging Winch Cable & Fairlead Roller Audit", type: "toggle", default: true, desc: "Inspect cable frays" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "agtractor": {
      sections: [
        {
          title: "1. PTO & 3-Point Hitch",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Log tractor hours" },
            { id: "ptoShieldCheck", label: "Require PTO Safety Shield Check", type: "toggle", default: true, desc: "Ensure rotating guard is present" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection([], [
          { id: "signSlowMovingVehicleEmblem", label: "Slow Moving Vehicle (SMV) Triangle Emblem", type: "toggle", default: true, desc: "Required for road transport under 40 km/h (25 mph)" }
        ]),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    // -----------------------------------------------------------------------
    // SECTION 12 & 13: CRANES, LIFTING & MINING
    // -----------------------------------------------------------------------
    "crane": {
      sections: [
        {
          title: "1. Wire Rope & Structural Safety",
          fields: [
            { id: "trackHours", label: "Track Crane Engine & PTO Hours", type: "toggle", default: true, desc: "Record engine and PTO time" },
            { id: "lmiTestRequired", label: "Load Moment Indicator (LMI) Calibration Test", type: "toggle", default: true, desc: `${workAuth} electronic test` },
            { id: "wireRopeInspectionDays", label: "Wire Rope & Sheave Inspection Window (Days)", type: "number", default: 7, desc: "Weekly wire rope audit" },
            { id: "annualCraneCertDays", label: `${workAuth} Certified 3rd-Party Annual Inspection Alert (Days)`, type: "number", default: 30, desc: "Annual crane certification" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection([], [
          { id: "signLoadChartPosted", label: "Certified Load Chart Posted in Cab", type: "toggle", default: true, desc: `${workAuth} load chart posting requirement` }
        ]),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "forklift": {
      sections: [
        {
          title: "1. Mast, Chain & Load Guard Checks",
          fields: [
            { id: "trackHours", label: "Track Hour Meter", type: "toggle", default: true, desc: "Log run time" },
            { id: "forkWearCheck", label: "Fork Blade Heel Thickness Audit (Max 10% Wear)", type: "toggle", default: true, desc: `${workAuth} / B56 safety limit` },
            { id: "chainTensionCheck", label: "Mast Lifting Chain Tension Audit", type: "toggle", default: true, desc: "Inspect lift chains" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection([], [
          { id: "signForkliftCapacity", label: "Capacity Data Plate Clear & Legible", type: "toggle", default: true, desc: `${workAuth} requirement` }
        ]),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "minehaul": {
      sections: [
        {
          title: "1. Ultra-Class Haulage & Retarder Brakes",
          fields: [
            { id: "trackHours", label: "Track Engine & Wheel Motor Hours", type: "toggle", default: true, desc: "Log operating time" },
            { id: "gridBrakeRetarderCheck", label: "Dynamic Electric Grid Retarder Function Test", type: "toggle", default: true, desc: `${workAuth} downhill brake check` }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "crusher": {
      sections: [
        {
          title: "1. Jaw / Cone Wear & Lube Oil",
          fields: [
            { id: "trackHours", label: "Track Crusher Plant Hours", type: "toggle", default: true, desc: "Log crush runtime" },
            { id: "lubeOilTempPressure", label: "Crusher Lube Oil Pressure & Temp Monitor", type: "toggle", default: true, desc: "Automatic trip on oil loss" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    // -----------------------------------------------------------------------
    // SECTION 14, 15, 16: FABRICATION, REFINERIES & UTILITIES
    // -----------------------------------------------------------------------
    "shopwelder": {
      sections: [
        {
          title: "1. Electrical & Gas Manifold Safety",
          fields: [
            { id: "trackHours", label: "Track Arc-On Power Hours", type: "toggle", default: true, desc: "Log power-on hours" },
            { id: "groundCableCheck", label: "Work Clamp & Cable Insulation Audit", type: "toggle", default: true, desc: "Inspect for exposed copper/arcs" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "pressbrake": {
      sections: [
        {
          title: "1. Hydraulic Ram & Guarding",
          fields: [
            { id: "trackHours", label: "Track Power-On Hours", type: "toggle", default: true, desc: "Log operating time" },
            { id: "lightCurtainTest", label: "Presence-Sensing Light Curtain Safety Test", type: "toggle", default: true, desc: `${workAuth} machine guarding test` }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "generator": {
      sections: [
        {
          title: "1. Power Telemetry & Run Time",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Record run duration" },
            { id: "autoTestExercise", label: "Weekly Auto-Exercise Test Log", type: "toggle", default: true, desc: "Emergency backup exercise check" },
            { id: "loadBankIntervalDays", label: "Load Bank Test Schedule (Days)", type: "number", default: 365, desc: "Annual full load test" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "aircomp": {
      sections: [
        {
          title: "1. Pressure Vessel & Air Filters",
          fields: [
            { id: "trackHours", label: "Track Compressor Operating Hours", type: "toggle", default: true, desc: "Log run time" },
            { id: "autoDrainValvetest", label: "Air Receiver Tank Auto-Drain Valve Check", type: "toggle", default: true, desc: "Moisture purge verification" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "centrifugalpump": {
      sections: [
        {
          title: "1. Seal Flush & Vibration Telemetry",
          fields: [
            { id: "trackHours", label: "Track Motor / Engine Hours", type: "toggle", default: true, desc: "Log run time" },
            { id: "mechanicalSealFlush", label: "Mechanical Seal Flush Pressure Check", type: "toggle", default: true, desc: "Verify seal barrier fluid" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    "pressurevessel": {
      sections: [
        {
          title: "1. Pressure Relief & Thickness Inspections",
          fields: [
            { id: "srvPopTestDays", label: "Safety Relief Valve (SRV) Pop Test Schedule (Days)", type: "number", default: 365, desc: "Annual relief valve bench cert" },
            { id: "utThicknessScanDays", label: "UT Shell & Head Thickness Scan Schedule (Days)", type: "number", default: 1825, desc: "5-year shell thickness audit" }
          ]
        },
        createLightingAndPlacardsSection(),
        createOshaMandatesSection()
      ]
    },

    // -----------------------------------------------------------------------
    // SECTION 17: TRAILERS & TRANSPORT EQUIPMENT
    // -----------------------------------------------------------------------
    "trailer": {
      sections: [
        {
          title: "1. Trailer Braking & Mechanical Coupling",
          fields: [
            { id: "emergencyBreakawayBattery", label: "Emergency Breakaway Battery & Cable Engagement Test", type: "toggle", default: true, desc: `${roadAuth} brake breakaway test` },
            { id: "kingpinPintleRingWear", label: "Kingpin / Pintle Ring Wear Gauge Inspection", type: "toggle", default: true, desc: "Coupling tolerance audit" },
            { id: "safetyChainsGrade70", label: "Grade 70 Safety Chain & Clevis Hook Latch Audit", type: "toggle", default: true, desc: "Inspect safety chain loops" }
          ]
        },
        createTireConfigurationSection('multi_axle_trailer'),
        createLightingAndPlacardsSection([
          { id: "lightConspicuityTape", label: `${roadAuth} Reflective Conspicuity Tape Audit`, type: "toggle", default: true, desc: "100% perimeter tape inspection" }
        ]),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    },

    // -----------------------------------------------------------------------
    // DEFAULT FALLBACK SCHEMA
    // -----------------------------------------------------------------------
    "default": {
      sections: [
        {
          title: "1. Usage & Meter Telematics",
          fields: [
            { id: "trackHours", label: "Track Operating Hours", type: "toggle", default: true, desc: "Hour meter logging" },
            { id: "trackOdometer", label: `Track Odometer (${uomDist})`, type: "toggle", default: false, desc: "Log reading" }
          ]
        },
        createTireConfigurationSection('standard_2axle'),
        createLightingAndPlacardsSection(),
        createOshaMandatesSection(),
        createConsumablePartsSection()
      ]
    }
  };

  // Direct Normalizer
  function normalizeCategoryKey(str) {
    if (!str) return "default";
    const s = String(str).toLowerCase().trim();

    if (s.includes("pickup") || s.includes("f-150") || s.includes("f-250") || s.includes("f-350") || s.includes("silverado") || s.includes("ram 1500") || s.includes("sierra")) return "pickup";
    if (s.includes("medium vocational") || s.includes("cab-chassis")) return "medtruck";
    if (s.includes("utv") || s.includes("buggy") || s.includes("side-by-side")) return "utv";
    if (s.includes("sedan") || s.includes("passenger car") || s.includes("suv") || s.includes("crossover")) return "sedan";
    if (s.includes("cargo van") || s.includes("passenger van") || s.includes("shuttle")) return "cargovan";
    if (s.includes("day cab") || s.includes("sleeper") || s.includes("semi")) return "class8semitruck";
    if (s.includes("dump truck")) return "dumptruck";
    if (s.includes("service / utility") || s.includes("bucket")) return "servicetruck";
    if (s.includes("vacuum") || s.includes("hydro-vac")) return "vactruck";
    if (s.includes("concrete mixer")) return "mixertruck";
    if (s.includes("rolligon")) return "rolligon";
    if (s.includes("tracked dump") || s.includes("morooka") || s.includes("panther") || s.includes("vibroseis")) return "trackedcarrier";
    if (s.includes("boom lift") || s.includes("vertical mast")) return "boomlift";
    if (s.includes("scissor lift")) return "scissorlift";
    if (s.includes("drilling rig")) return "drillingrig";
    if (s.includes("workover") || s.includes("pulling unit")) return "workoverrig";
    if (s.includes("coiled tubing")) return "coiledtubing";
    if (s.includes("mud pump")) return "mudpump";
    if (s.includes("blowout preventer") || s.includes("bop stack")) return "bopstack";
    if (s.includes("excavator")) return "excavator";
    if (s.includes("dozer")) return "dozer";
    if (s.includes("wheel loader") || s.includes("skid steer") || s.includes("backhoe") || s.includes("articulated dump")) return "loader";
    if (s.includes("motor grader")) return "grader";
    if (s.includes("paver") || s.includes("milling") || s.includes("reclaimer")) return "paver";
    if (s.includes("directional drill") || s.includes("hdd")) return "hdd";
    if (s.includes("pile driver")) return "piledriver";
    if (s.includes("asphalt plant")) return "asphaltplant";
    if (s.includes("concrete batch plant")) return "concreteplant";
    if (s.includes("sideboom")) return "sideboom";
    if (s.includes("mulcher")) return "mulcher";
    if (s.includes("feller buncher")) return "fellerbuncher";
    if (s.includes("skidder")) return "skidder";
    if (s.includes("agricultural tractor") || s.includes("combine")) return "agtractor";
    if (s.includes("crane") || s.includes("gantry")) return "crane";
    if (s.includes("forklift") || s.includes("telehandler")) return "forklift";
    if (s.includes("mine haul")) return "minehaul";
    if (s.includes("rock crusher")) return "crusher";
    if (s.includes("welder")) return "shopwelder";
    if (s.includes("press brake") || s.includes("ironworker")) return "pressbrake";
    if (s.includes("generator") || s.includes("light tower")) return "generator";
    if (s.includes("air compressor")) return "aircomp";
    if (s.includes("pump")) return "centrifugalpump";
    if (s.includes("pressure vessel") || s.includes("heat exchanger") || s.includes("boiler")) return "pressurevessel";
    if (s.includes("trailer") || s.includes("flatbed") || s.includes("lowboy")) return "trailer";

    return "default";
  }

  try {
    if (method === 'GET') {
      const targetType = url.searchParams.get('targetType') || 'specific';
      const key = url.searchParams.get('key') || '';
      const rawAssetType = url.searchParams.get('assetType') || key || 'default';

      const normKey = normalizeCategoryKey(rawAssetType);
      const schemaKey = CATEGORY_SCHEMAS[normKey] ? normKey : 'default';
      const schema = CATEGORY_SCHEMAS[schemaKey] || CATEGORY_SCHEMAS['default'];

      let savedConfig = null;

      if (env.DRIVEN_KV && key) {
        try {
          const storageKey = `config:${targetType}:${key.toLowerCase()}`;
          savedConfig = await env.DRIVEN_KV.get(storageKey, { type: 'json' });
        } catch (e) {
          console.error("Error fetching specific config from KV:", e);
        }
      }

      if (!savedConfig && targetType === 'specific' && rawAssetType && env.DRIVEN_KV) {
        try {
          const templateKey = `config:template:${normalizeCategoryKey(rawAssetType)}`;
          savedConfig = await env.DRIVEN_KV.get(templateKey, { type: 'json' });
        } catch (e) {
          console.error("Error fetching template fallback from KV:", e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        jurisdiction: isCanada ? 'CA' : 'US',
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

      const { targetType, key, config, action, sourceKey, targetAssetType } = body || {};

      // ASSET OVERRIDE CLONING / COPY-PASTE ROUTE
      if (action === 'copyConfig') {
        if (!sourceKey || !key) {
          return new Response(JSON.stringify({ 
            error: "Copy operation requires both 'sourceKey' and 'key' (destination)" 
          }), { status: 400, headers });
        }

        if (!env.DRIVEN_KV) {
          return new Response(JSON.stringify({ 
            error: "KV storage binding 'DRIVEN_KV' is not configured" 
          }), { status: 500, headers });
        }

        const sourceStorageKey = `config:specific:${sourceKey.toLowerCase()}`;
        const sourceConfigData = await env.DRIVEN_KV.get(sourceStorageKey, { type: 'json' });

        if (!sourceConfigData) {
          return new Response(JSON.stringify({ 
            error: `Source asset configuration '${sourceKey}' was not found.` 
          }), { status: 404, headers });
        }

        const sourceNormalizedType = normalizeCategoryKey(sourceConfigData.assetType || sourceKey);
        const targetNormalizedType = normalizeCategoryKey(targetAssetType || key);

        if (sourceNormalizedType !== targetNormalizedType) {
          return new Response(JSON.stringify({ 
            error: `Asset Type Mismatch: Cannot copy configuration from '${sourceNormalizedType}' to '${targetNormalizedType}'. Both assets must belong to the exact same category.` 
          }), { status: 400, headers });
        }

        const destStorageKey = `config:specific:${key.toLowerCase()}`;
        await env.DRIVEN_KV.put(destStorageKey, JSON.stringify(sourceConfigData));

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Successfully cloned parts, quantities, and overrides from '${sourceKey}' to '${key}'.` 
        }), { status: 200, headers });
      }

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
