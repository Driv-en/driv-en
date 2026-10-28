// ═══════════════════════════════════════════════════════════════════
// DRIV-EN API Worker — D1 & KV Asset Configuration (v19.0 — Clean)
// Route: /api/* and /api/log-error
// ═══════════════════════════════════════════════════════════════════
// BINDINGS:
//   - D1: DB → driv-en-db
//   - D1: EMPLOYEES_DB → employees-db (optional)
//   - KV: DRIVEN_KV / ASSET_CONFIG_KV
//   - Secret: JWT_SECRET (shared with auth worker)
// ═══════════════════════════════════════════════════════════════════

const TABLE_MAP = {
  'project': {
    d1Table: 'projects',
    aliases: ['projects', 'Project', 'Projects'],
    fieldMap: {
      'Project Name':   'name',
      'name':           'name',
      'Project Code':   'code',
      'code':           'code',
      'Project Number': 'project_number',
      'project_number': 'project_number',
      'Status':         'status',
      'status':         'status',
      'Location':       'location',
      'location':       'location',
    },
    defaults: { status: 'active' },
  },
  'project-types': {
    d1Table: 'project_types',
    aliases: ['project_types', 'projecttypes', 'ProjectTypes', 'project-type'],
    fieldMap: {
      'Project Type Name': 'name',
      'name':              'name',
      'Code':              'code',
      'code':              'code',
      'Description':       'description',
      'description':       'description',
      'Status':            'status',
      'status':            'status',
    },
    defaults: { status: 'Active' },
  },
  'clients': {
    d1Table: 'clients',
    aliases: ['client', 'Clients', 'Client'],
    fieldMap: {
      'Client Name':   'client_name',
      'client_name':   'client_name',
      'name':          'client_name',
      'Contact Name':  'contact_name',
      'contact_name':  'contact_name',
      'Contact Email': 'contact_email',
      'contact_email': 'contact_email',
      'Contact Phone': 'contact_phone',
      'contact_phone': 'contact_phone',
      'Company':       'company',
      'company':       'company',
      'Address':       'address',
      'address':       'address',
      'City':          'city',
      'city':          'city',
      'State':         'state',
      'state':         'state',
      'Zip Code':      'zip_code',
      'zip_code':      'zip_code',
      'Zip':           'zip_code',
      'zip':           'zip_code',
      'Country':       'country',
      'country':       'country',
      'Industry':      'industry',
      'industry':      'industry',
      'Status':        'status',
      'status':        'status',
      'Notes':         'notes',
      'notes':         'notes',
    },
    defaults: { status: 'Active' },
  },
  'division': {
    d1Table: 'divisions',
    aliases: ['divisions', 'Division', 'Divisions', 'division'],
    fieldMap: {
      'Division Name': 'name',
      'name':          'name',
      'Division Code': 'code',
      'code':          'code',
      'Description':   'description',
      'description':   'description',
      'Manager':       'manager',
      'manager':       'manager',
      'Status':        'status',
      'status':        'status',
    },
    defaults: { status: 'Active' },
  },
  'locations': {
    d1Table: 'locations',
    aliases: ['location', 'Locations', 'Location', 'locations'],
    fieldMap: {
      'Location Name': 'name',
      'name':          'name',
      'Location Code': 'code',
      'code':          'code',
      'Type':          'type',
      'type':          'type',
      'Address':       'address',
      'address':       'address',
      'City':          'city',
      'city':          'city',
      'State':         'state',
      'state':         'state',
      'Zip Code':      'zip_code',
      'zip_code':      'zip_code',
      'Zip':           'zip_code',
      'zip':           'zip_code',
      'Division':      'division',
      'division':      'division',
      'Status':        'status',
      'status':        'status',
      'Notes':         'notes',
      'notes':         'notes',
    },
    defaults: { status: 'Active' },
  },
  'units-of-measure': {
    d1Table: 'units_of_measure',
    aliases: ['units_of_measure', 'units', 'unit-of-measure', 'UnitsOfMeasure', 'Units'],
    fieldMap: {
      'Unit Name': 'name',
      'name':      'name',
      'Code':      'code',
      'code':      'code',
      'Symbol':    'symbol',
      'symbol':    'symbol',
      'Category':  'category',
      'category':  'category',
      'Status':    'status',
      'status':    'status',
    },
    defaults: { status: 'Active' },
  },
  'equipment': {
    d1Table: 'assets',
    aliases: ['assets', 'Equipment', 'Assets', 'asset', 'equipment'],
    fieldMap: {
      'Equipment Name':             'name',
      'name':                       'name',
      'Equipment ID':               'asset_number',
      'asset_number':               'asset_number',
      'Category':                   'asset_type',
      'category':                   'asset_type',
      'asset_type':                 'asset_type',
      'type':                       'asset_type',
      'equipment_type_id':          'equipment_type_id',
      'Status':                     'status',
      'status':                     'status',
      'Make / OEM':                 'make_oem',
      'make_oem':                   'make_oem',
      'make':                       'make_oem',
      'Model':                      'model',
      'model':                      'model',
      'Year':                       'year',
      'year':                       'year',
      'Drive Config':               'drive_configuration',
      'drive_configuration':        'drive_configuration',
      'Location':                   'current_location',
      'current_location':           'current_location',
      'location_id':                'location_id',
      'location':                   'current_location',
      'Serial Number':              'serial_number',
      'serial_number':              'serial_number',
      'serial':                     'serial_number',
      'current_meter':              'current_meter_reading',
      'current_meter_reading':      'current_meter_reading',
      'Project':                    'current_project',
      'project':                    'current_project',
      'project_id':                 'project_id',
      'current_project':            'current_project',
      'project_name':               'project_name',
      'location_name':              'location_name',
      'division_name':              'division_name',
      'Division':                   'assigned_division',
      'division_id':                'assigned_division',
      'assigned_division':          'assigned_division',
      'Operator':                   'assigned_operator',
      'operator_id':                'assigned_operator',
      'assigned_operator':          'assigned_operator',
      'fuel_type':                  'fuel_type',
      'fuel_tank_capacity':         'fuel_tank_capacity',
      'fuel_consumption_rate':      'fuel_consumption_rate',
      'ownership_type':             'ownership_type',
      'owner_name':                 'owner_name',
      'owner_employee_id':          'owner_employee_id',
      'last_inspection_date':       'last_inspection_date',
      'is_attachment':              'is_attachment',
      'mounted_to_asset_id':        'mounted_to_asset_id',
      'mounting_status':            'mounting_status',
      'allowed_category':           'allowed_category',
      'override_defaults':          'override_defaults',
      'attachment_tracking_mode':    'attachment_tracking_mode',
      'linked_attachment_asset_id': 'linked_attachment_asset_id',
      'pm_hours_interval':          'pm_hours_interval',
      'pm_miles_interval':          'pm_miles_interval',
      'track_pto_hours':             'track_pto_hours',
      'track_tpms_telemetry':        'track_tpms_telemetry',
      'engine_make_model':          'engine_make_model',
      'is_dually':                   'is_dually',
      'trans_type':                  'trans_type',
      'diff_rear_end':               'diff_rear_end',
      'transfer_case':              'transfer_case',
      'fluid_engine_oil':           'fluid_engine_oil',
      'fluid_engine_oil_qty':       'fluid_engine_oil_qty',
      'engine_service_interval':    'engine_service_interval',
      'fluid_trans':                'fluid_trans',
      'trans_service_interval':     'trans_service_interval',
      'fluid_diff':                 'fluid_diff',
      'diff_service_interval':      'diff_service_interval',
      'fluid_coolant':              'fluid_coolant',
      'fluid_hydraulics':            'fluid_hydraulics',
      'hyd_service_interval':       'hyd_service_interval',
      'fluid_final_drives':         'fluid_final_drives',
      'fluid_def':                  'fluid_def',
      'brake_system_type':          'brake_system_type',
      'tire_size_steer':            'tire_size_steer',
      'tire_psi_steer':             'tire_psi_steer',
      'tire_size_drive':            'tire_size_drive',
      'tire_psi_drive':             'tire_psi_drive',
      'track_sag_spec':             'track_sag_spec',
      'undercarriage_type':         'undercarriage_type',
      'lighting_headlights':        'lighting_headlights',
      'lighting_aux':               'lighting_aux',
      'camera_system':              'camera_system',
      'mirrors_type':               'mirrors_type',
      'winch_installed':            'winch_installed',
      'handrails_steps':            'handrails_steps',
      'belts_serpentine':           'belts_serpentine',
      'inspection_rules':           'inspection_rules',
      'parts_inventory':            'parts_inventory',
      'custom_items':               'custom_items',
      'user_custom_attachments':    'user_custom_attachments'
    },
    defaults: { status: 'active', ownership_type: 'company' },
  },
  'fuel-types': {
    d1Table: 'fuel_types',
    aliases: ['fuel_types', 'fueltypes', 'FuelTypes', 'fuel-type', 'fuel'],
    fieldMap: {
      'Fuel Name':   'fuel_name',
      'fuel_name':   'fuel_name',
      'name':        'fuel_name',
      'Fuel Code':   'fuel_code',
      'fuel_code':   'fuel_code',
      'code':        'fuel_code',
      'Description': 'description',
      'description': 'description',
      'Is Custom':   'is_custom',
      'is_custom':   'is_custom',
    },
  },
  'fuel-tanks': {
    d1Table: 'fuel_tanks',
    aliases: ['fuel_tanks', 'fueltanks', 'FuelTanks', 'fuel-tank'],
    fieldMap: {
      'Tank Name':        'name',
      'name':             'name',
      'Tank Type':        'tank_type',
      'tank_type':        'tank_type',
      'Current Quantity': 'current_quantity',
      'current_quantity': 'current_quantity',
      'Capacity':         'capacity',
      'capacity':         'capacity',
      'Fuel Type':        'fuel_type',
      'fuel_type':        'fuel_type'
    },
    defaults: { current_quantity: 0 }
  },
  'fuel-transactions': {
    d1Table: 'fuel_transactions',
    aliases: ['fuel_transactions', 'fueltransactions', 'FuelTransactions', 'fuel-transaction'],
    fieldMap: {
      'Transaction Type': 'transaction_type',
      'transaction_type': 'transaction_type',
      'Quantity':         'quantity',
      'quantity':         'quantity',
      'Meter Reading':    'meter_reading',
      'meter_reading':    'meter_reading'
    }
  },
  'AssetTypes': {
    d1Table: 'asset_types',
    aliases: ['asset_types', 'asset-types', 'AssetTypes', 'assettypes'],
    fieldMap: {
      'Asset Type Code':             'asset_type_code',
      'asset_type_code':             'asset_type_code',
      'Asset Type Name':             'asset_type_name',
      'asset_type_name':             'asset_type_name',
      'Category Group':              'category_group',
      'category_group':              'category_group',
      'Is Custom':                   'is_custom',
      'is_custom':                   'is_custom',
      'default_pm_hours_interval':   'default_pm_hours_interval',
      'default_pm_miles_interval':   'default_pm_miles_interval',
      'track_pto_hours':             'track_pto_hours',
      'track_tpms_telemetry':        'track_tpms_telemetry',
      'default_engine_make_model':   'default_engine_make_model',
      'default_drive_type':          'default_drive_type',
      'default_is_dually':           'default_is_dually',
      'default_trans_type':          'default_trans_type',
      'default_diff_rear_end':        'default_diff_rear_end',
      'default_transfer_case':       'default_transfer_case',
      'default_fluid_engine_oil':    'default_fluid_engine_oil',
      'default_fluid_engine_oil_qty':'default_fluid_engine_oil_qty',
      'default_fluid_trans':         'default_fluid_trans',
      'default_fluid_diff':          'default_fluid_diff',
      'default_fluid_coolant':       'default_fluid_coolant',
      'default_fluid_hydraulics':     'default_fluid_hydraulics',
      'default_fluid_final_drives':  'default_fluid_final_drives',
      'default_fluid_def':           'default_fluid_def',
      'default_brake_system_type':   'default_brake_system_type',
      'default_tire_size_steer':     'default_tire_size_steer',
      'default_tire_psi_steer':      'default_tire_psi_steer',
      'default_tire_size_drive':     'default_tire_size_drive',
      'default_tire_psi_drive':      'default_tire_psi_drive',
      'default_track_sag_spec':      'default_track_sag_spec',
      'default_lighting_headlights': 'default_lighting_headlights',
      'default_lighting_aux':        'default_lighting_aux',
      'default_camera_system':       'default_camera_system',
      'default_mirrors_type':        'default_mirrors_type',
      'default_winch_installed':     'default_winch_installed',
      'default_handrails_steps':     'default_handrails_steps',
      'default_belts_serpentine':    'default_belts_serpentine',
      'default_inspection_rules':    'default_inspection_rules',
      'default_custom_items':        'default_custom_items',
      'default_parts_inventory':     'default_parts_inventory',
      'allowed_attachments':         'allowed_attachments'
    },
    defaults: { category_group: 'General', is_custom: 0 }
  },
  'Users': {
    d1Table: 'users',
    aliases: ['users', 'Users', 'employees', 'Employees'],
    fieldMap: {
      'Full Name':            'full_name',
      'full_name':            'full_name',
      'Email':                'email',
      'email':                'email',
      'Role':                 'role_id',
      'role_id':              'role_id',
      'Active':               'is_active',
      'is_active':            'is_active',
      'Must Reset Password':  'must_change_password',
      'must_change_password': 'must_change_password',
      '2FA Enabled':          'twofa_enabled',
      'twofa_enabled':        'twofa_enabled',
      'Last Login':           'last_login',
      'last_login':           'last_login',
    },
  },
  'Roles': {
    d1Table: 'roles',
    aliases: ['roles', 'Roles'],
    fieldMap: {
      'Role Name':   'name',
      'name':        'name',
      'Description': 'description',
      'description': 'description',
      'System Role': 'is_system',
      'is_system':   'is_system',
    },
  },
  'AuditLog': {
    d1Table: 'audit_log',
    aliases: ['audit_log', 'audit-log', 'AuditLog'],
    fieldMap: {
      'Timestamp':  'created_at',
      'User':       'user_email',
      'Action':     'action',
      'IP Address': 'ip_address',
    },
  },
};

function resolveTableConfig(requestedTable) {
  if (!requestedTable) return null;
  const target = String(requestedTable).toLowerCase().trim();
  for (const [key, cfg] of Object.entries(TABLE_MAP)) {
    if (key.toLowerCase() === target) return cfg;
    if (cfg.aliases && cfg.aliases.some(a => a.toLowerCase() === target)) return cfg;
  }
  return null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, x-org-id, x-user-id, x-user-email',
  'Access-Control-Allow-Credentials': 'true',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function normalizeCategoryKey(str) {
  if (!str) return "default";
  const s = String(str).toLowerCase().trim();

  if (s.includes("pickup") || s.includes("f-150") || s.includes("f-250") || s.includes("f-350") || s.includes("silverado") || s.includes("ram 1500") || s.includes("sierra")) return "pickup";
  if (s.includes("highway motor vehicles") || s.includes("class 8") || s.includes("semi") || s.includes("day cab") || s.includes("sleeper")) return "class8semitruck";
  if (s.includes("medium vocational") || s.includes("cab-chassis") || s.includes("medium truck")) return "medtruck";
  if (s.includes("dump truck")) return "dumptruck";
  if (s.includes("service / utility") || s.includes("service truck") || s.includes("bucket")) return "servicetruck";
  if (s.includes("vacuum") || s.includes("hydro-vac")) return "vactruck";
  if (s.includes("concrete mixer")) return "mixertruck";
  if (s.includes("cargo van") || s.includes("passenger van") || s.includes("shuttle")) return "cargovan";
  if (s.includes("sedan") || s.includes("passenger car") || s.includes("suv") || s.includes("crossover")) return "sedan";
  if (s.includes("utv") || s.includes("buggy") || s.includes("side-by-side")) return "utv";

  if (s.includes("dozer") || s.includes("dozers & heavy tracked")) return "dozer";
  if (s.includes("excavator")) return "excavator";
  if (s.includes("wheel loader") || s.includes("skid steer") || s.includes("backhoe") || s.includes("articulated dump") || s.includes("loader")) return "loader";
  if (s.includes("motor grader") || s.includes("grader")) return "grader";
  if (s.includes("paver") || s.includes("milling") || s.includes("reclaimer")) return "paver";

  if (s.includes("drilling rig") || s.includes("rigs")) return "drillingrig";
  if (s.includes("directional drill") || s.includes("hdd")) return "hdd";
  if (s.includes("pile driver")) return "piledriver";
  if (s.includes("coiled tubing")) return "coiledtubing";
  if (s.includes("workover") || s.includes("pulling unit")) return "workoverrig";
  if (s.includes("mud pump")) return "mudpump";
  if (s.includes("blowout preventer") || s.includes("bop stack")) return "bopstack";

  if (s.includes("crane") || s.includes("gantry")) return "crane";
  if (s.includes("boom lift") || s.includes("vertical mast")) return "boomlift";
  if (s.includes("scissor lift")) return "scissorlift";
  if (s.includes("forklift") || s.includes("telehandler")) return "forklift";

  if (s.includes("mining") || s.includes("mine haul")) return "minehaul";
  if (s.includes("rock crusher") || s.includes("crusher")) return "crusher";
  if (s.includes("agricultural tractor") || s.includes("ag tractor") || s.includes("combine")) return "agtractor";
  if (s.includes("sideboom")) return "sideboom";
  if (s.includes("mulcher")) return "mulcher";
  if (s.includes("feller buncher")) return "fellerbuncher";
  if (s.includes("skidder")) return "skidder";

  if (s.includes("rolligon")) return "rolligon";
  if (s.includes("tracked dump") || s.includes("morooka") || s.includes("panther") || s.includes("vibroseis")) return "trackedcarrier";
  if (s.includes("asphalt plant")) return "asphaltplant";
  if (s.includes("concrete batch plant")) return "concreteplant";
  if (s.includes("welder")) return "shopwelder";
  if (s.includes("press brake") || s.includes("ironworker")) return "pressbrake";
  if (s.includes("generator") || s.includes("light tower")) return "generator";
  if (s.includes("air compressor")) return "aircomp";
  if (s.includes("pump")) return "centrifugalpump";
  if (s.includes("pressure vessel") || s.includes("heat exchanger") || s.includes("boiler")) return "pressurevessel";
  if (s.includes("trailer") || s.includes("flatbed") || s.includes("lowboy")) return "trailer";

  return "default";
}

function buildCategorySchema(normKey, isCanada) {
  const uomVol = isCanada ? 'Liters' : 'Gallons';
  const uomPress = 'PSI';
  const uomDist = isCanada ? 'Kilometers' : 'Miles';
  const uomDepth = isCanada ? 'mm' : '1/32 in';
  const roadAuth = isCanada ? 'NSC Standard 11' : 'DOT';
  const workAuth = isCanada ? 'CCOHS / COR' : 'OSHA / MSHA';

  const tireSection = {
    title: "Wheel Position, Tire Specs & Pressure Telematics",
    fields: [
      { id: "tireSizeSteer", label: "Front / Steer Tire Size Specification", type: "text", default: "LT275/70R18", desc: "Manufacturer spec steer tire size" },
      { id: "tirePsiSteerRecommended", label: `Front / Steer Recommended Cold Inflation (${uomPress})`, type: "number", default: 60, desc: "Door-jamb recommended inflation" },
      { id: "tireSizeDrive", label: "Rear / Drive Tire Size Specification", type: "text", default: "LT275/70R18", desc: "Manufacturer spec drive tire size" },
      { id: "tirePsiDriveRecommended", label: `Rear / Drive Recommended Cold Inflation (${uomPress})`, type: "number", default: 65, desc: "Door-jamb recommended inflation" },
      { id: "tpmsThresholdLowPsi", label: `TPMS Low Inflation Alarm Trigger (${uomPress})`, type: "number", default: 50, desc: "Telemetry alert threshold" },
      { id: "isDuallyConfiguration", label: "Dually Rear Axle Setup (1-Ton Dual Wheels)", type: "toggle", default: false, desc: "Enable 4-tire tracking on rear axle" },
      { id: "minSteerTread32nd", label: `${workAuth} / ${roadAuth} Minimum Steer Tire Tread Depth (${uomDepth})`, type: "number", default: isCanada ? 3 : 4, desc: `Out-of-service limit` },
      { id: "minDriveTread32nd", label: `${workAuth} / ${roadAuth} Minimum Drive Tire Tread Depth (${uomDepth})`, type: "number", default: 2, desc: `Out-of-service limit` }
    ]
  };

  const consumableSection = {
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
  };

  const lightingSection = {
    title: "Lighting Systems, Required Placards & Safety Signage",
    fields: [
      { id: "lightHeadlightsLowHigh", label: "Low & High Beam Headlights", type: "toggle", default: true, desc: "Illumination check" },
      { id: "lightBrakeAndTail", label: "Tail Lights & Stop / Brake Lights", type: "toggle", default: true, desc: "Rear illumination check" },
      { id: "lightTurnSignalsHazards", label: "Turn Signals, Blinkers & 4-Way Emergency Hazard Flashers", type: "toggle", default: true, desc: "Directional indicators" },
      { id: "lightClearanceMarker", label: "Clearance, Side Marker & ID Lights (>2.03 m / 80 in wide)", type: "toggle", default: true, desc: `${roadAuth} width marker lights` },
      { id: "lightLicensePlate", label: "License Plate Tag Light", type: "toggle", default: true, desc: "Rear tag illumination" },
      { id: "lightReverseBackup", label: "Reverse Backup Lights & Audible Alarm Signal", type: "toggle", default: true, desc: `${workAuth} required backup warning` },
      { id: "lightStrobeBeacon", label: "Amber Strobe Light / Rotating Beacon", type: "toggle", default: true, desc: `${workAuth} jobsite hazard warning light` },
      { id: "placardDotHazmat", label: `${roadAuth} Hazmat Placards & Class Identification Signs`, type: "toggle", default: false, desc: "When carrying hazardous goods" },
      { id: "signEmergencyStop", label: "E-Stop Safety Labeling & Machine Cut-Off Signage", type: "toggle", default: true, desc: `${workAuth} required red E-stop signage` }
    ]
  };

  const oshaSection = {
    title: isCanada ? "Canadian NSC Standard 11 & CCOHS Mandated Safety Devices" : "OSHA / MSHA Mandated Safety Devices & Emergency Equipment",
    fields: [
      { id: "seatBeltMandate", label: `${workAuth} Seat Belt Functional & Webbing Inspection`, type: "toggle", default: true, desc: "Mandatory pre-shift safety restraint inspection" },
      { id: "hornAudible200ft", label: "Audible Warning Horn Operational (Audible at 60 m / 200 ft)", type: "toggle", default: true, desc: `${workAuth} compliance` },
      { id: "fireExtinguisherCharged", label: "On-Board Fire Extinguisher (Gauge Green, Sealed & Mounted)", type: "toggle", default: true, desc: `${workAuth} safety requirement` },
      { id: "firstAidKitStocked", label: `${workAuth} Compliant Stocked First Aid Kit`, type: "toggle", default: true, desc: "Required pre-shift emergency inventory" },
      { id: "dotReflectiveTriangles", label: `Set of 3 ${roadAuth} Emergency Reflective Triangles / Flares`, type: "toggle", default: true, desc: `${roadAuth} emergency breakdown kit` },
      { id: "wheelChocksPair", label: "Pair of Heavy Duty Wheel Chocks Present", type: "toggle", default: true, desc: "Required parking containment" }
    ]
  };

  const usageSection = {
    title: "1. Usage & Meter Telematics",
    fields: [
      { id: "trackOdometer", label: `Track Odometer Mileage (${uomDist})`, type: "toggle", default: true, desc: "Log reading during pre-trip checks" },
      { id: "trackHours", label: "Track Operating Hours", type: "toggle", default: true, desc: "Hour meter logging" },
      { id: "pmMilesInterval", label: `Engine Oil Service Interval (${uomDist})`, type: "number", default: isCanada ? 8000 : 5000, desc: "Service threshold" }
    ]
  };

  return {
    sections: [usageSection, tireSection, lightingSection, oshaSection, consumableSection]
  };
}

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

async function getAuthContext(request, env) {
  let orgId = request.headers.get('x-org-id');
  let userId = request.headers.get('x-user-id');
  let userEmail = request.headers.get('x-user-email') || 'system';

  const url = new URL(request.url);
  if (!orgId) {
    orgId = url.searchParams.get('org_id') || url.searchParams.get('orgId');
  }

  if (env.JWT_SECRET) {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies['driv_en_session'];
    if (token) {
      const payload = await verifyJWT(token, env.JWT_SECRET);
      if (payload) {
        if (!orgId) orgId = payload.org_id || payload.orgId;
        if (!userId) userId = payload.user_id || payload.sub;
        if (userEmail === 'system' && payload.email) userEmail = payload.email;
      }
    }
  }

  if (!orgId || orgId === 'default_org' || orgId === 'null' || orgId === 'undefined') {
    orgId = null;
  }

  return {
    orgId: orgId,
    userId: userId || null,
    userEmail: userEmail
  };
}

function toPrimitiveString(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string') return val.trim() === '' ? null : val.trim();

  if (Array.isArray(val)) {
    const items = val.map(item => toPrimitiveString(item)).filter(Boolean);
    return items.length > 0 ? items.join(', ') : null;
  }
  if (typeof val === 'object') {
    return val.asset_type_name || val.fuel_name || val.name || val.type || val.category || val.asset_type_code || val.code || val.label || JSON.stringify(val);
  }
  return String(val).trim();
}

function mapPayloadToD1(tableConfig, payload) {
  const d1Row = {};

  // 1. Map explicitly defined fields from fieldMap
  for (const [apiFieldName, d1Column] of Object.entries(tableConfig.fieldMap)) {
    if (payload[apiFieldName] !== undefined) {
      d1Row[d1Column] = toPrimitiveString(payload[apiFieldName]);
    }
  }

  // 2. Strict field mapping validation: Only pass through valid database columns
  const validColNameRegex = /^[a-z0-9_]+$/;
  const ignoredKeys = new Set([
    'id', 'org_id', 'user_id', 'created_by', 'updated_by', 'created_at', 'updated_at'
  ]);

  const validTableColumns = new Set(Object.values(tableConfig.fieldMap));

  for (const [key, val] of Object.entries(payload)) {
    if (
      d1Row[key] === undefined &&
      validColNameRegex.test(key) &&
      validTableColumns.has(key) &&
      !ignoredKeys.has(key)
    ) {
      d1Row[key] = toPrimitiveString(val);
    }
  }

  // 3. Set default values for missing required columns
  if (tableConfig.defaults) {
    for (const [col, val] of Object.entries(tableConfig.defaults)) {
      if (d1Row[col] === undefined) d1Row[col] = toPrimitiveString(val);
    }
  }

  return d1Row;
}

function formatRecord(row, tableConfig) {
  if (!row) return null;
  const fields = {};
  const record = { id: row.id, ...row };

  for (const [apiFieldName, d1Column] of Object.entries(tableConfig.fieldMap)) {
    if (row[d1Column] !== undefined) {
      fields[apiFieldName] = row[d1Column];
    }
  }
  for (const [key, val] of Object.entries(row)) {
    if (fields[key] === undefined && key !== 'org_id') {
      fields[key] = val;
    }
  }

  if (tableConfig.d1Table === 'assets') {
    if (row.project_name && (!fields.current_project || fields.current_project === row.project_id)) {
      fields.current_project = row.project_name;
      record.current_project = row.project_name;
    }
    if (row.location_name_resolved && (!fields.current_location || fields.current_location === row.location_id)) {
      fields.current_location = row.location_name_resolved;
      record.current_location = row.location_name_resolved;
    }
    if (row.division_name_resolved) {
      fields.division_name = row.division_name_resolved;
      record.division_name = row.division_name_resolved;
      if (!fields.assigned_division || fields.assigned_division === row.assigned_division) {
        fields.division = row.division_name_resolved;
        record.division = row.division_name_resolved;
      }
    }
  }
  
  record.fields = fields;
  return record;
}

async function ensureTableSchema(db, d1Table) {
  try {
    if (d1Table === 'clients') {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          user_id TEXT,
          client_name TEXT NOT NULL,
          contact_name TEXT,
          contact_email TEXT,
          contact_phone TEXT,
          company TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          zip_code TEXT,
          country TEXT,
          industry TEXT,
          status TEXT DEFAULT 'Active',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT
        )
      `).run();
    } else if (d1Table === 'asset_types') {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS asset_types (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          user_id TEXT,
          asset_type_code TEXT NOT NULL,
          asset_type_name TEXT NOT NULL,
          category_group TEXT DEFAULT 'General',
          is_custom INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT,
          default_pm_hours_interval INTEGER DEFAULT 250,
          default_pm_miles_interval INTEGER DEFAULT 7500,
          track_pto_hours INTEGER DEFAULT 0,
          track_tpms_telemetry INTEGER DEFAULT 1,
          default_engine_make_model TEXT,
          default_drive_type TEXT,
          default_is_dually INTEGER DEFAULT 0,
          default_trans_type TEXT,
          default_diff_rear_end TEXT,
          default_transfer_case TEXT,
          default_fluid_engine_oil TEXT,
          default_fluid_engine_oil_qty TEXT,
          default_fluid_trans TEXT,
          default_fluid_diff TEXT,
          default_fluid_coolant TEXT,
          default_fluid_hydraulics TEXT,
          default_fluid_final_drives TEXT,
          default_fluid_def TEXT,
          default_brake_system_type TEXT,
          default_tire_size_steer TEXT,
          default_tire_psi_steer INTEGER DEFAULT 110,
          default_tire_size_drive TEXT,
          default_tire_psi_drive INTEGER DEFAULT 100,
          default_track_sag_spec TEXT,
          default_lighting_headlights TEXT,
          default_lighting_aux TEXT,
          default_camera_system TEXT,
          default_mirrors_type TEXT,
          default_winch_installed INTEGER DEFAULT 0,
          default_handrails_steps INTEGER DEFAULT 1,
          default_belts_serpentine TEXT,
          default_inspection_rules TEXT,
          default_custom_items TEXT,
          default_parts_inventory TEXT,
          allowed_attachments TEXT
        )
      `).run();
    } else if (d1Table === 'asset_type_defaults') {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS asset_type_defaults (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          asset_type_name TEXT NOT NULL,
          make TEXT,
          model TEXT,
          drive_configuration TEXT,
          fuel_type TEXT,
          engine_oil_spec TEXT,
          hydraulic_fluid_spec TEXT,
          coolant_spec TEXT,
          def_capacity TEXT,
          fuel_capacity TEXT,
          transmission_fluid_spec TEXT,
          pm_schedules_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          brake_fluid_spec TEXT,
          cabin_filter_spec TEXT,
          wiper_blades_spec TEXT,
          category_group TEXT,
          subcategory TEXT,
          gvwr_lbs REAL,
          gcwr_lbs REAL,
          operating_weight_lbs REAL,
          payload_capacity_lbs REAL,
          cab_type TEXT,
          cab_style TEXT,
          mobility_type TEXT,
          engine_make TEXT,
          engine_model TEXT,
          engine_displacement_l REAL,
          transmission_type TEXT,
          transmission_speeds INTEGER,
          wheel_setup TEXT,
          num_axles INTEGER,
          pto_setup TEXT,
          winch_setup TEXT,
          winch_rating TEXT,
          aux_hydraulics TEXT,
          engine_oil_filter_spec TEXT,
          primary_fuel_filter_spec TEXT,
          secondary_fuel_filter_spec TEXT,
          primary_air_filter_spec TEXT,
          secondary_air_filter_spec TEXT,
          hydraulic_filter_spec TEXT,
          transmission_filter_spec TEXT,
          coolant_filter_spec TEXT,
          brake_pads_front_spec TEXT,
          brake_pads_rear_spec TEXT,
          serpentine_belt_spec TEXT,
          tire_size_steer TEXT,
          tire_psi_steer REAL,
          tire_size_drive TEXT,
          tire_psi_drive REAL,
          tire_size_trailer TEXT,
          tire_psi_trailer REAL,
          min_steer_tread_depth REAL,
          min_drive_tread_depth REAL,
          min_trailer_tread_depth REAL,
          inspection_toggles_json TEXT,
          custom_fields_json TEXT
        )
      `).run();
    } else if (d1Table === 'projects') {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          user_id TEXT,
          name TEXT NOT NULL,
          project_number TEXT,
          status TEXT DEFAULT 'active',
          location TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT
        )
      `).run();
    } else if (d1Table === 'assets') {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS assets (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          asset_number TEXT NOT NULL,
          name TEXT,
          asset_type TEXT,
          status TEXT DEFAULT 'active',
          current_location TEXT,
          current_meter_reading REAL DEFAULT 0,
          last_inspection_date TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          equipment_type_id TEXT,
          fuel_tank_capacity REAL,
          fuel_consumption_rate REAL,
          ownership_type TEXT DEFAULT 'company',
          owner_name TEXT,
          owner_employee_id TEXT,
          fuel_type TEXT,
          user_id TEXT,
          created_by TEXT,
          updated_by TEXT,
          serial_number TEXT,
          make_oem TEXT,
          model TEXT,
          year INTEGER,
          drive_configuration TEXT,
          project_id TEXT,
          assigned_division TEXT,
          assigned_operator TEXT,
          location_id TEXT,
          current_project TEXT,
          project_name TEXT,
          location_name TEXT,
          division_name TEXT,
          is_attachment INTEGER DEFAULT 0,
          mounted_to_asset_id TEXT,
          mounting_status TEXT DEFAULT 'mounted',
          allowed_category TEXT DEFAULT 'all',
          override_defaults INTEGER DEFAULT 0,
          attachment_tracking_mode TEXT DEFAULT 'integrated',
          linked_attachment_asset_id TEXT,
          pm_hours_interval INTEGER DEFAULT 250,
          pm_miles_interval INTEGER DEFAULT 7500,
          track_pto_hours INTEGER DEFAULT 0,
          track_tpms_telemetry INTEGER DEFAULT 1,
          engine_make_model TEXT,
          is_dually INTEGER DEFAULT 0,
          trans_type TEXT,
          diff_rear_end TEXT,
          transfer_case TEXT,
          fluid_engine_oil TEXT,
          fluid_engine_oil_qty TEXT,
          engine_service_interval TEXT,
          fluid_trans TEXT,
          trans_service_interval TEXT,
          fluid_diff TEXT,
          diff_service_interval TEXT,
          fluid_coolant TEXT,
          fluid_hydraulics TEXT,
          hyd_service_interval TEXT,
          fluid_final_drives TEXT,
          fluid_def TEXT,
          brake_system_type TEXT,
          tire_size_steer TEXT,
          tire_psi_steer INTEGER DEFAULT 110,
          tire_size_drive TEXT,
          tire_psi_drive INTEGER DEFAULT 100,
          track_sag_spec TEXT,
          undercarriage_type TEXT,
          lighting_headlights TEXT,
          lighting_aux TEXT,
          camera_system TEXT,
          mirrors_type TEXT,
          winch_installed INTEGER DEFAULT 0,
          handrails_steps INTEGER DEFAULT 1,
          belts_serpentine TEXT,
          inspection_rules TEXT,
          parts_inventory TEXT,
          custom_items TEXT,
          user_custom_attachments TEXT
        )
      `).run();

      try {
        await db.prepare('ALTER TABLE assets ADD COLUMN current_project TEXT').run();
      } catch (e) {
        // Column already exists
      }
    } else if (d1Table === 'fuel_tanks') {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS fuel_tanks (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          user_id TEXT,
          name TEXT NOT NULL,
          tank_type TEXT NOT NULL,
          current_quantity REAL DEFAULT 0,
          capacity REAL DEFAULT 0,
          fuel_type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT
        )
      `).run();
    } else if (d1Table === 'fuel_transactions') {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS fuel_transactions (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          user_id TEXT,
          transaction_type TEXT NOT NULL,
          fuel_type TEXT NOT NULL,
          quantity REAL NOT NULL,
          transaction_date TEXT NOT NULL,
          submission_timestamp TEXT,
          from_entity_type TEXT,
          from_entity_id TEXT,
          to_entity_type TEXT,
          to_entity_id TEXT,
          asset_id TEXT,
          meter_reading REAL,
          project_id TEXT,
          location TEXT,
          notes TEXT,
          device_location TEXT,
          manager_review_flags TEXT,
          fuel_photos TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT
        )
      `).run();
    } else if (d1Table === 'fuel_types') {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS fuel_types (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          user_id TEXT,
          fuel_code TEXT NOT NULL,
          fuel_name TEXT NOT NULL,
          description TEXT,
          is_custom INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT
        )
      `).run();
    }
  } catch (e) {
    console.warn(`Schema auto-creation warning for ${d1Table}: ${e.message}`);
  }
}

async function handleLogError(env, body) {
  try {
    const db = env.DB;
    const id = crypto.randomUUID();
    await db.prepare(
      'INSERT INTO error_log (id, source, error_message, stack_trace, severity, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      body.source || 'API Worker',
      body.message || 'Unknown error',
      body.stack || body.stack_trace || null,
      body.severity || 'error',
      new Date().toISOString()
    ).run();
    return json({ success: true, id });
  } catch (e) {
    console.error('logError failed:', e.message);
    return json({ success: false, error: e.message }, 500);
  }
}

async function logTenantContextError(env, path, request) {
  try {
    const db = env.DB;
    await db.prepare(
      'INSERT INTO error_log (id, source, error_message, stack_trace, severity, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      crypto.randomUUID(),
      'API Worker (' + path + ')',
      'Multi-Tenant Isolation Failure: Missing or invalid org_id context',
      'Header x-org-id: ' + (request.headers.get('x-org-id') || 'none'),
      'critical',
      new Date().toISOString()
    ).run();
  } catch (e) {
    console.error('Failed to write tenant error log:', e.message);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
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

    if (path === '/' && method === 'GET') {
      return json({
        status: 'ok',
        service: 'DRIV-EN API Worker (D1)',
        tables: Object.keys(TABLE_MAP)
      });
    }

    if (path === '/api/log-error' && method === 'POST') {
      try {
        const body = await request.json();
        return await handleLogError(env, body);
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // Direct Endpoint: Dedicated Asset Schema Configuration Handling (Bypasses TABLE_MAP)
    if (path === '/api/asset-config' || path === '/api/asset-config/') {
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

        if (!savedConfig && targetType === 'specific' && kvStore) {
          try {
            const templateKey = `config:template:${normKey}`;
            savedConfig = await kvStore.get(templateKey, { type: 'json' });
          } catch (e) {
            console.error("Error fetching template fallback from KV:", e);
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
          return json({ error: 'Invalid JSON payload in request body' }, 400);
        }

        const { targetType, key, config, action, sourceKey } = body || {};

        if (action === 'copyConfig') {
          if (!sourceKey || !key) {
            return json({ error: "Copy operation requires 'sourceKey' and 'key'" }, 400);
          }
          if (!kvStore) {
            return json({ error: "KV storage binding is not configured" }, 500);
          }

          const sourceStorageKey = `config:specific:${sourceKey.toLowerCase().trim()}`;
          const sourceConfigData = await kvStore.get(sourceStorageKey, { type: 'json' });

          if (!sourceConfigData) {
            return json({ error: `Source asset configuration '${sourceKey}' was not found.` }, 404);
          }

          const destStorageKey = `config:specific:${key.toLowerCase().trim()}`;
          await kvStore.put(destStorageKey, JSON.stringify(sourceConfigData));

          return json({ success: true, message: `Successfully cloned configuration from '${sourceKey}' to '${key}'.` });
        }

        if (!targetType || !key || config === undefined) {
          return json({ error: "Missing required payload parameters: 'targetType', 'key', and 'config' must be supplied" }, 400);
        }

        if (!kvStore) {
          return json({ error: "KV storage binding is not configured on this environment" }, 500);
        }

        const storageKey = targetType === 'template'
          ? `config:template:${normalizeCategoryKey(key)}`
          : `config:specific:${key.toLowerCase().trim()}`;

        await kvStore.put(storageKey, JSON.stringify(config));

        return json({ success: true, message: 'Configuration saved successfully' });
      }

      return json({ error: 'Method not allowed' }, 405);
    }

    // Direct Endpoint: Asset Types / Categories Handling
    if (path === '/api/asset-types' || path === '/api/asset-types/' || path === '/api/asset_types') {
      const authCtx = await getAuthContext(request, env);
      const orgId = authCtx.orgId || 'org_dsi';

      if (method === 'GET') {
        try {
          await ensureTableSchema(env.DB, 'asset_types');

          let records = [];
          if (env.DB) {
            const { results } = await env.DB.prepare(`
              SELECT asset_type_name FROM asset_types WHERE org_id = ? OR org_id = 'system'
              UNION
              SELECT asset_type_name FROM asset_type_defaults WHERE org_id = ? OR org_id = 'system'
              ORDER BY asset_type_name ASC
            `).bind(orgId, orgId).all();

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
    }

    // Direct Endpoint: Assets / Equipment Handling
    if (path === '/api/assets' || path === '/api/assets/' || path === '/api/equipment') {
      const authCtx = await getAuthContext(request, env);
      const orgId = authCtx.orgId;

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
    if (path === '/api/fuel-types' || path === '/api/fuel-types/' || path === '/api/fuel_types') {
      const authCtx = await getAuthContext(request, env);
      const orgId = authCtx.orgId;
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

          let itemsList = Array.isArray(rawTypes) ? rawTypes : (typeof rawTypes === 'object' && rawTypes !== null ? Object.values(rawTypes) : []);
          const stmts = [env.DB.prepare('DELETE FROM fuel_types WHERE org_id = ?').bind(orgId)];

          const now = new Date().toISOString();
          for (const item of itemsList) {
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

          await env.DB.batch(stmts);
          return json({ success: true, count: itemsList.length, org_id: orgId });
        } catch (e) {
          return json({ success: true, count: 0, warning: e.message, org_id: orgId });
        }
      }

      return json({ error: 'Method not allowed' }, 405);
    }

    // Generic Routing for Tables (clients, projects, divisions, locations, fuel-tanks, fuel-transactions, etc.)
    const match = path.match(/^\/api\/([^/]+)(?:\/([^/]+))?$/);
    if (!match) return json({ error: 'Not found' }, 404);

    const requestedTable = decodeURIComponent(match[1]);
    const recordId = match[2] ? decodeURIComponent(match[2]) : null;

    const tableConfig = resolveTableConfig(requestedTable);
    if (!tableConfig) {
      return json({ error: 'Unknown table: ' + requestedTable, availableTables: Object.keys(TABLE_MAP) }, 400);
    }

    const d1Table = tableConfig.d1Table;
    const authCtx = await getAuthContext(request, env);
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const userEmail = authCtx.userEmail;

    if (!orgId) {
      await logTenantContextError(env, path, request);
      return json({ error: 'Multi-tenant error: Organization context missing' }, 401);
    }

    await ensureTableSchema(env.DB, d1Table);

    try {
      // LIST
      if (method === 'GET' && !recordId) {
        let sql = 'SELECT * FROM ' + d1Table + ' WHERE org_id = ? ORDER BY created_at DESC';
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
        }
        const result = await env.DB.prepare(sql).bind(orgId).all();
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
          tanks: records
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

        const cols = ['id', 'org_id', 'user_id'];
        const vals = [id, orgId, userId];

        for (const [col, val] of Object.entries(d1Row)) {
          if (col === 'id' || col === 'org_id' || col === 'user_id' || col === 'created_by' || col === 'updated_by') continue;
          cols.push(col);
          vals.push(val);
        }

        cols.push('created_at');
        vals.push(now);
        cols.push('created_by');
        vals.push(userEmail);
        cols.push('updated_at');
        vals.push(now);
        cols.push('updated_by');
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
          sets.push(col + ' = ?');
          values.push(val);
        }
        if (sets.length === 0) return json({ error: 'No fields to update' }, 400);

        sets.push('updated_at = ?');
        values.push(new Date().toISOString());
        sets.push('updated_by = ?');
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
};
