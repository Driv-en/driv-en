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

  // Individual, Granular Configuration Schemas Per Discrete Asset Type
  const CATEGORY_SCHEMAS = {
    // ==========================================
    // SECTION 1: LIGHT & MEDIUM FLEET VEHICLES
    // ==========================================
    "pickup": {
      sections: [
        {
          title: "1. Usage & Odometer Tracking",
          fields: [
            { id: "trackOdometer", label: "Track Odometer Mileage", type: "toggle", default: true, desc: "Require mileage entry during pre-trip checks" },
            { id: "tpmsThreshold", label: "TPMS Low Pressure Alert (PSI)", type: "number", default: 35, desc: "Alert when tire pressure falls below PSI threshold" },
            { id: "4wdSwitchCheck", label: "Require 4WD Actuator Function Check", type: "toggle", default: true, desc: "Seasonal check for 4x4 engagement" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMilesInterval", label: "Engine Oil Service Interval (Miles)", type: "number", default: 5000, desc: "Standard lube/oil/filter threshold" },
            { id: "tireRotationMiles", label: "Tire Rotation Schedule (Miles)", type: "number", default: 7500, desc: "Tire rotation interval" },
            { id: "brakePadCheckMiles", label: "Brake Pad Inspection Interval (Miles)", type: "number", default: 15000, desc: "Brake lining wear audit" }
          ]
        }
      ]
    },
    "medtruck": {
      sections: [
        {
          title: "1. Vocational Usage & Hydraulics",
          fields: [
            { id: "trackOdometer", label: "Track Odometer Mileage", type: "toggle", default: true, desc: "Log mileage for maintenance" },
            { id: "trackPtoHours", label: "Track PTO / Auxiliary Engine Hours", type: "toggle", default: true, desc: "Separate PTO run time from road mileage" },
            { id: "hydraulicFilterAlert", label: "Hydraulic System Pressure Monitor", type: "toggle", default: true, desc: "Flag bed/crane lift hydraulic anomalies" }
          ]
        },
        {
          title: "2. Chassis & Maintenance Schedules",
          fields: [
            { id: "pmMilesInterval", label: "Oil Service Interval (Miles)", type: "number", default: 7500, desc: "Medium diesel service schedule" },
            { id: "pmPtoHoursInterval", label: "PTO Hydraulic Service Interval (Hours)", type: "number", default: 500, desc: "Hydraulic oil change schedule" }
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
            { id: "rollCageCheck", label: "Require ROPS Structure & Belt Lock Audit", type: "toggle", default: true, desc: "Pre-shift safety restraint inspection" },
            { id: "cvtBeltInspection", label: "CVT Drive Belt Inspection Interval (Hours)", type: "number", default: 100, desc: "Check belt wear and clutch dust" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Oil Change Interval (Hours)", type: "number", default: 100, desc: "Severe duty engine PM limit" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 2: HEAVY VOCATIONAL TRUCKS (CLASS 7-8)
    // ==========================================
    "class8semitruck": {
      sections: [
        {
          title: "1. Highway Compliance & Telematics",
          fields: [
            { id: "trackOdometer", label: "Track Mileage / Odometer", type: "toggle", default: true, desc: "Log mileage for DOT & IFTA" },
            { id: "dotAnnualInspectionDays", label: "DOT Annual Inspection Alert Window (Days)", type: "number", default: 30, desc: "Alert window before cert expires" },
            { id: "eldSyncRequired", label: "Require ELD Telematics Synchronization", type: "toggle", default: true, desc: "Enforce HOS log validation" }
          ]
        },
        {
          title: "2. Air Brakes & Safety Coupling",
          fields: [
            { id: "airBrakePressureTest", label: "Require Air Brake Leakage & Bleed Check", type: "toggle", default: true, desc: "Mandatory pre-trip leakage check" },
            { id: "minTreadDepth32nd", label: "Minimum Steer Tire Tread Depth (1/32 in)", type: "number", default: 4, desc: "Out of service threshold" },
            { id: "fifthWheelJawCheck", label: "Fifth Wheel Jaw & Kingpin Lock Check", type: "toggle", default: true, desc: "Verify coupling security" }
          ]
        },
        {
          title: "3. Maintenance Schedules",
          fields: [
            { id: "pmMilesInterval", label: "Oil Service Interval (Miles)", type: "number", default: 15000, desc: "Heavy diesel service interval" },
            { id: "pmCalendarInterval", label: "Chassis Grease & Safety Limit (Days)", type: "number", default: 90, desc: "Quarterly chassis lube cycle" }
          ]
        }
      ]
    },
    "dumptruck": {
      sections: [
        {
          title: "1. Vocational & Dump Body Rules",
          fields: [
            { id: "trackOdometer", label: "Track Mileage", type: "toggle", default: true, desc: "Log road miles" },
            { id: "trackPtoHours", label: "Track PTO / Cylinder Lift Hours", type: "toggle", default: true, desc: "Log hydraulic hoist usage" },
            { id: "tailgateLatchCheck", label: "Require Tailgate Air Latch Lock Test", type: "toggle", default: true, desc: "Prevent accidental load dumps" },
            { id: "tarpMechanismCheck", label: "Require Electric Tarp Roll Test", type: "toggle", default: true, desc: "Verify load containment tarping" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMilesInterval", label: "Engine Service Interval (Miles)", type: "number", default: 10000, desc: "Severe-service oil schedule" },
            { id: "hoistCylinderGreaseDays", label: "Hoist Cylinder & Hinge Grease Cycle (Days)", type: "number", default: 14, desc: "Bi-weekly pivot greasing" }
          ]
        }
      ]
    },
    "vactruck": {
      sections: [
        {
          title: "1. Hydro-Vac & Blower Metrics",
          fields: [
            { id: "trackPtoHours", label: "Track Blower & Vacuum Engine Hours", type: "toggle", default: true, desc: "Record high-CFM blower runtime" },
            { id: "waterPressureCheck", label: "Monitor High-Pressure Water Pump (PSI)", type: "toggle", default: true, desc: "Flag pressure washer dropouts" },
            { id: "debrisTankLatchCheck", label: "Debris Tank Rear Door Seal Audit", type: "toggle", default: true, desc: "Prevent slurry leaks on highway" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "blowerOilChangeHours", label: "Vacuum Blower Oil Change Interval (Hours)", type: "number", default: 500, desc: "Positive displacement blower PM" },
            { id: "pmMilesInterval", label: "Chassis Service Interval (Miles)", type: "number", default: 10000, desc: "Chassis PM threshold" }
          ]
        }
      ]
    },
    "mixertruck": {
      sections: [
        {
          title: "1. Drum Drive & Chute Safety",
          fields: [
            { id: "trackDrumHours", label: "Track Drum PTO Operating Hours", type: "toggle", default: true, desc: "Log drum rotation runtime" },
            { id: "chuteLockCheck", label: "Require Discharge Chute Fold-Lock Audit", type: "toggle", default: true, desc: "Pre-trip travel safety check" },
            { id: "drumWashdownSystem", label: "Verify Washdown Water Pump Pressure", type: "toggle", default: true, desc: "Ensure cleanout system operational" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "drumGearboxOilHours", label: "Drum Drive Gearbox Fluid Service (Hours)", type: "number", default: 1000, desc: "Mixer gearbox fluid change" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 3: EXCAVATORS & HEAVY EARTHMOVING
    // ==========================================
    "excavator": {
      sections: [
        {
          title: "1. Usage & Engine Metrics",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Require meter entry during inspections" },
            { id: "idleTimeThreshold", label: "Max Allowed Idle Time (Mins)", type: "number", default: 30, desc: "Flag excessive idling in telemetry" }
          ]
        },
        {
          title: "2. Hydraulics & Attachments",
          fields: [
            { id: "trackHydraulicPressure", label: "Monitor Hydraulic Pump Pressure", type: "toggle", default: true, desc: "Flag main pump pressure spikes" },
            { id: "bucketToothWearLimit", label: "Bucket Tooth Wear Threshold (%)", type: "number", default: 80, desc: "Trigger replacement prompt" },
            { id: "greaseIntervalHours", label: "Pin & Bushing Grease Interval (Hrs)", type: "number", default: 50, desc: "Daily/weekly lubrication cycle" },
            { id: "quickCouplerCheck", label: "Require Quick Coupler Lock Test", type: "toggle", default: true, desc: "Mandatory pin-retainer check" }
          ]
        },
        {
          title: "3. Undercarriage & Tracks",
          fields: [
            { id: "trackTensionCheck", label: "Track Sag Inspection Interval (Days)", type: "number", default: 14, desc: "Prevent thrown tracks" },
            { id: "sprocketWearCheck", label: "Sprocket & Idler Wear Audit", type: "toggle", default: true, desc: "Include in monthly inspections" }
          ]
        },
        {
          title: "4. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Oil Service Interval (Hours)", type: "number", default: 250, desc: "Main PM threshold" },
            { id: "hydraulicFilterInterval", label: "Hydraulic Fluid & Filter Change (Hours)", type: "number", default: 1000, desc: "Major hydraulic service" }
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
            { id: "cuttingEdgeWearLimit", label: "Blade Cutting Edge Wear Threshold (%)", type: "number", default: 85, desc: "Prompt edge reversal or replacement" },
            { id: "trackEqualizerBarGrease", label: "Equalizer Bar & Pivot Shaft Lubrication (Hours)", type: "number", default: 250, desc: "Heavy chassis pivot greasing" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Oil Service Interval (Hours)", type: "number", default: 250, desc: "Engine PM limit" },
            { id: "finalDriveOilHours", label: "Final Drive Planetary Fluid Service (Hours)", type: "number", default: 1000, desc: "Final drive gear oil change" }
          ]
        }
      ]
    },
    "loader": {
      sections: [
        {
          title: "1. Articulation & Brake Safety",
          fields: [
            { id: "trackHours", label: "Track Engine Hours", type: "toggle", default: true, desc: "Record run hours" },
            { id: "articulationLockCheck", label: "Require Articulation Steering Lock Pin Test", type: "toggle", default: true, desc: "Pre-service transport lock check" },
            { id: "brakeAccumulatorTest", label: "Brake Hydraulic Accumulator Pre-Charge Test", type: "toggle", default: true, desc: "Verify emergency stopping reserve" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Service Interval (Hours)", type: "number", default: 250, desc: "Standard engine PM" },
            { id: "axleOilIntervalHours", label: "Axle Wet Brake Oil Change (Hours)", type: "number", default: 1000, desc: "Axle fluid replacement" }
          ]
        }
      ]
    },
    "grader": {
      sections: [
        {
          title: "1. Moldboard & Circle Drive",
          fields: [
            { id: "trackHours", label: "Track Operating Hours", type: "toggle", default: true, desc: "Log total engine hours" },
            { id: "circleDriveShoePlay", label: "Circle Drive Top Plate & Shoe Play Audit", type: "toggle", default: true, desc: "Check circle gear clearance" },
            { id: "moldboardCuttingEdge", label: "Moldboard Cutting Edge Wear Threshold (%)", type: "number", default: 80, desc: "Replace blade edge before moldboard wear" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Oil Service (Hours)", type: "number", default: 250, desc: "Engine PM" },
            { id: "tandemDriveOilHours", label: "Tandem Housing Oil Service (Hours)", type: "number", default: 1000, desc: "Tandem chain drive fluid change" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 4: DRILLING RIGS & WELL SERVICING
    // ==========================================
    "drillingrig": {
      sections: [
        {
          title: "1. Engine & Drawworks Metrics",
          fields: [
            { id: "trackHours", label: "Track Rig Engine & Drawworks Hours", type: "toggle", default: true, desc: "Log engine run hours" },
            { id: "topDrivePressureCheck", label: "Require Top Drive / Rotary Table Pressure Check", type: "toggle", default: true, desc: "Pre-shift hydraulic check" },
            { id: "crownSaverTest", label: "Require Crown-Saver Safety Cut-off Test", type: "toggle", default: true, desc: "Daily pre-shift test" }
          ]
        },
        {
          title: "2. Well Control & BOP Systems",
          fields: [
            { id: "bopPressureTestDays", label: "BOP Stack Pressure Test Interval (Days)", type: "number", default: 14, desc: "Mandatory well-control audit" },
            { id: "accumulatorCheck", label: "Accumulator Nitrogen Charge Pressure Audit", type: "toggle", default: true, desc: "Pre-well setup check" }
          ]
        },
        {
          title: "3. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Rig Engine Service Interval (Hours)", type: "number", default: 250, desc: "Engine PM schedule" },
            { id: "drawworksGreaseHours", label: "Drawworks & Crown Block Lubrication (Hours)", type: "number", default: 24, desc: "Daily grease schedule" }
          ]
        }
      ]
    },
    "workoverrig": {
      sections: [
        {
          title: "1. Mast & Guywire Safety",
          fields: [
            { id: "trackHours", label: "Track Carrier Engine & Rig Hours", type: "toggle", default: true, desc: "Log pulling unit runtime" },
            { id: "guywireTensionCheck", label: "Require Mast Guywire Anchor & Tension Audit", type: "toggle", default: true, desc: "Mandatory before raising derrick" },
            { id: "tubingTongPressure", label: "Monitor Hydraulic Tubing Tong Torque Pressure", type: "toggle", default: true, desc: "Verify makeup torque hydraulics" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Carrier Engine Service (Hours)", type: "number", default: 250, desc: "Engine PM limit" }
          ]
        }
      ]
    },
    "coiledtubing": {
      sections: [
        {
          title: "1. Injector Head & Reel Fatigue",
          fields: [
            { id: "trackHours", label: "Track Power Pack Hours", type: "toggle", default: true, desc: "Record unit run hours" },
            { id: "stringFatigueLog", label: "Require Coiled Tubing String Running Fatigue Log", type: "toggle", default: true, desc: "Log footage run per cycle" },
            { id: "injectorGripperCheck", label: "Injector Head Gripper Block Tension Audit", type: "toggle", default: true, desc: "Prevent string slippage" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "HPU Engine Service (Hours)", type: "number", default: 250, desc: "Engine PM" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 5: DEEP FOUNDATION, BORING & TUNNELING
    // ==========================================
    "hdd": {
      sections: [
        {
          title: "1. Thrust & Mud Pressure Telemetry",
          fields: [
            { id: "trackHours", label: "Track Drill Rig Engine Hours", type: "toggle", default: true, desc: "Log operating runtime" },
            { id: "drillingMudFlowRate", label: "Monitor Mud Pump Pressure & Flow (GPM)", type: "toggle", default: true, desc: "Flag downhole circulation loss" },
            { id: "carriageRackGrease", label: "Carriage Pinion & Rack Gear Lubrication (Hours)", type: "number", default: 24, desc: "Daily thrust rack greasing" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Drill Engine Service Interval (Hours)", type: "number", default: 250, desc: "Engine PM" }
          ]
        }
      ]
    },
    "piledriver": {
      sections: [
        {
          title: "1. Hammer & Lead Alignment",
          fields: [
            { id: "trackHours", label: "Track Power Pack / Crane Engine Hours", type: "toggle", default: true, desc: "Log runtime" },
            { id: "vibratoryHammerOil", label: "Vibratory Hammer Eccentric Oil Level Check", type: "toggle", default: true, desc: "Check eccentric gearbox oil daily" },
            { id: "leadCushionPadCheck", label: "Hammer Cushion Material Wear Audit", type: "toggle", default: true, desc: "Inspect striker pad thickness" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Hammer Power Pack Engine Service (Hours)", type: "number", default: 250, desc: "Power unit service" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 6: AERIAL LIFTS, CRANES & LIFTING
    // ==========================================
    "crane": {
      sections: [
        {
          title: "1. Wire Rope & Structural Safety",
          fields: [
            { id: "trackHours", label: "Track Crane Engine & PTO Hours", type: "toggle", default: true, desc: "Record engine and PTO time" },
            { id: "wireRopeInspectionDays", label: "Wire Rope & Sheave Inspection Window (Days)", type: "number", default: 7, desc: "Weekly wire rope audit" },
            { id: "lmiTestRequired", label: "Require Load Moment Indicator (LMI) Calibration Test", type: "toggle", default: true, desc: "Mandatory pre-lift electronic test" },
            { id: "outriggerPadCheck", label: "Outrigger Ground Pressure & Pad Verification", type: "toggle", default: true, desc: "Soil stability check before setup" }
          ]
        },
        {
          title: "2. Certifications & Maintenance",
          fields: [
            { id: "pmMeterInterval", label: "Engine Service Interval (Hours)", type: "number", default: 250, desc: "Standard engine oil change" },
            { id: "annualCraneCertDays", label: "Third-Party Annual Crane Cert Alert (Days)", type: "number", default: 30, desc: "Notice prior to OSHA cert expiration" }
          ]
        }
      ]
    },
    "boomlift": {
      sections: [
        {
          title: "1. Platform & Function Cut-off Controls",
          fields: [
            { id: "trackHours", label: "Track Engine / Electric Hours", type: "toggle", default: true, desc: "Log machine hours" },
            { id: "tiltSensorTest", label: "Require Chassis Tilt Level Sensor & Alarm Check", type: "toggle", default: true, desc: "Mandatory slope cut-off test" },
            { id: "harnessAnchorCheck", label: "Inspect Basket Fall Protection Anchor Points", type: "toggle", default: true, desc: "Daily lanyard anchor audit" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Service Interval (Hours)", type: "number", default: 250, desc: "Engine PM" },
            { id: "annualLiftCertDays", label: "Annual ANSI / CSA Lift Cert Alert (Days)", type: "number", default: 30, desc: "Yearly safety cert notice" }
          ]
        }
      ]
    },
    "forklift": {
      sections: [
        {
          title: "1. Mast, Chain & Load Guard Checks",
          fields: [
            { id: "trackHours", label: "Track Hour Meter", type: "toggle", default: true, desc: "Log run time" },
            { id: "forkWearCheck", label: "Require Fork Blade Heel Thickness Audit", type: "toggle", default: true, desc: "Inspect forks for 10% wear limit" },
            { id: "chainTensionCheck", label: "Mast Lifting Chain Tension & Stretch Audit", type: "toggle", default: true, desc: "Inspect lift chains" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Lube & Filter Service (Hours)", type: "number", default: 250, desc: "Standard forklift PM" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 7: PIPELINE & RIGHT-OF-WAY CLEARING
    // ==========================================
    "sideboom": {
      sections: [
        {
          title: "1. Boom, Drawworks & Wire Rope",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Log engine runtime" },
            { id: "counterweightLockCheck", label: "Extendable Counterweight Safety Lock Test", type: "toggle", default: true, desc: "Verify hydraulic counterweight latch" },
            { id: "cableInspectionDays", label: "Boom & Load Line Wire Rope Audit (Days)", type: "number", default: 7, desc: "Weekly cable inspection" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Service Interval (Hours)", type: "number", default: 250, desc: "Engine PM" }
          ]
        }
      ]
    },
    "mulcher": {
      sections: [
        {
          title: "1. Rotor Teeth & High-Flow Hydraulics",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Log operating time" },
            { id: "rotorCarbideToothCheck", label: "Mulcher Head Tooth & Carbide Wear Audit", type: "toggle", default: true, desc: "Daily inspection for missing teeth" },
            { id: "hydraulicCoolerClean", label: "Hydraulic Oil Cooler Debris Blow-out Cycle (Hours)", type: "number", default: 10, desc: "Clean radiator/cooler from wood dust" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Oil Service (Hours)", type: "number", default: 250, desc: "Severe duty engine PM" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 8: FORESTRY & AGRICULTURE
    // ==========================================
    "fellerbuncher": {
      sections: [
        {
          title: "1. Saw Head & Hydraulics",
          fields: [
            { id: "trackHours", label: "Track Operating Hours", type: "toggle", default: true, desc: "Record run hours" },
            { id: "sawDiscToothCheck", label: "High-Speed Saw Disc Tooth & Bolt Tightness Audit", type: "toggle", default: true, desc: "Daily safety check on cutting disc" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Service (Hours)", type: "number", default: 250, desc: "Engine PM schedule" }
          ]
        }
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
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Service Interval (Hours)", type: "number", default: 250, desc: "Engine PM" }
          ]
        }
      ]
    },
    "agtractor": {
      sections: [
        {
          title: "1. PTO & 3-Point Hitch",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Log tractor hours" },
            { id: "ptoShieldCheck", label: "Require 540/1000 RPM PTO Safety Shield Check", type: "toggle", default: true, desc: "Ensure rotating guard is present" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Oil Service (Hours)", type: "number", default: 250, desc: "Tractor engine PM" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 9: ASPHALT & CONCRETE PRODUCTION PLANTS
    // ==========================================
    "asphaltplant": {
      sections: [
        {
          title: "1. Dryer Drum, Burner & Baghouse",
          fields: [
            { id: "trackHours", label: "Track Plant Burner Run Hours", type: "toggle", default: true, desc: "Log dryer drum runtime" },
            { id: "baghouseDifferentialPressure", label: "Monitor Baghouse Differential Pressure (In. W.C.)", type: "number", default: 6, desc: "Flag filter bag blinding" },
            { id: "acTankTempCheck", label: "Asphalt Cement (AC) Tank Heater Temp Log (°F)", type: "number", default: 320, desc: "Maintain liquid asphalt storage temp" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "trunnionBearingGreaseDays", label: "Dryer Drum Trunnion Bearing Lubrication (Days)", type: "number", default: 7, desc: "Weekly heavy bearing grease" }
          ]
        }
      ]
    },
    "concreteplant": {
      sections: [
        {
          title: "1. Batcher, Cement Silo & Scale Calibration",
          fields: [
            { id: "trackHours", label: "Track Plant Operating Hours", type: "toggle", default: true, desc: "Log batching runtime" },
            { id: "siloAviationLightCheck", label: "Cement Silo High-Level Sensor & Vent Filter Audit", type: "toggle", default: true, desc: "Prevent silo overfill blowouts" },
            { id: "scaleCalibrationDays", label: "Aggregate & Cement Scale Calibration Schedule (Days)", type: "number", default: 180, desc: "Semi-annual scale certification" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 10: MINING & QUARRYING OPERATIONS
    // ==========================================
    "minehaul": {
      sections: [
        {
          title: "1. Ultra-Class Haulage & Retarder Brakes",
          fields: [
            { id: "trackHours", label: "Track Engine & Electric Wheel Motor Hours", type: "toggle", default: true, desc: "Log operating time" },
            { id: "gridBrakeRetarderCheck", label: "Dynamic Electric Grid Retarder Function Test", type: "toggle", default: true, desc: "Pre-shift downhill brake check" },
            { id: "dumpBodySafetyPin", label: "Dump Body Up-Lock Pin Inspection", type: "toggle", default: true, desc: "Required before under-body service" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Engine Service Interval (Hours)", type: "number", default: 500, desc: "High-capacity oil pan PM limit" }
          ]
        }
      ]
    },
    "crusher": {
      sections: [
        {
          title: "1. Jaw / Cone Wear & Lube Oil",
          fields: [
            { id: "trackHours", label: "Track Crusher Plant Hours", type: "toggle", default: true, desc: "Log crush runtime" },
            { id: "lubeOilTempPressure", label: "Crusher Lube Oil Pressure & Temp Monitor", type: "toggle", default: true, desc: "Automatic trip on oil loss" },
            { id: "linerPlateWearCheck", label: "Jaw / Cone Mantle Liner Wear Audit", type: "toggle", default: true, desc: "Inspect wear metal thickness" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 11: FABRICATION & METALWORKING
    // ==========================================
    "shopwelder": {
      sections: [
        {
          title: "1. Electrical & Gas Manifold Safety",
          fields: [
            { id: "trackHours", label: "Track Arc-On Power Hours", type: "toggle", default: true, desc: "Log power-on hours" },
            { id: "groundCableCheck", label: "Work Clamp & Cable Insulation Audit", type: "toggle", default: true, desc: "Inspect for exposed copper/arcs" },
            { id: "shieldingGasLeakCheck", label: "Shielding Gas Hose & Regulator Leak Test", type: "toggle", default: true, desc: "Check inert gas lines" }
          ]
        }
      ]
    },
    "pressbrake": {
      sections: [
        {
          title: "1. Hydraulic Ram & Light Curtain Guards",
          fields: [
            { id: "trackHours", label: "Track Power-On Hours", type: "toggle", default: true, desc: "Log operating time" },
            { id: "lightCurtainTest", label: "Require Presence-Sensing Light Curtain Test", type: "toggle", default: true, desc: "Mandatory pre-shift safety test" },
            { id: "hydraulicRamAlignment", label: "Ram Tonnage & Gib Clearance Audit", type: "toggle", default: true, desc: "Check bed parallelism" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 12: REFINERIES, PROCESS & UTILITIES
    // ==========================================
    "generator": {
      sections: [
        {
          title: "1. Power Telemetry & Run Time",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Record run duration" },
            { id: "autoTestExercise", label: "Require Weekly Auto-Exercise Test Log", type: "toggle", default: true, desc: "No-load run verification" },
            { id: "coolantHeaterStatus", label: "Block Heater Temperature Check", type: "toggle", default: true, desc: "Ensure cold-start readiness" }
          ]
        },
        {
          title: "2. Fuel Reserve & Capacity Testing",
          fields: [
            { id: "minFuelLevelPercent", label: "Minimum Fuel Level Reserve Alert (%)", type: "number", default: 50, desc: "Alert when fuel drops below level" },
            { id: "loadBankIntervalDays", label: "Load Bank Test Schedule (Days)", type: "number", default: 365, desc: "Annual full load test" }
          ]
        },
        {
          title: "3. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Oil & Filter Change Interval (Hours)", type: "number", default: 200, desc: "Engine service threshold" },
            { id: "pmCalendarInterval", label: "Annual Comprehensive Service (Days)", type: "number", default: 365, desc: "Yearly maintenance" }
          ]
        }
      ]
    },
    "aircomp": {
      sections: [
        {
          title: "1. Pressure Vessel & Air Filters",
          fields: [
            { id: "trackHours", label: "Track Compressor Engine / Motor Hours", type: "toggle", default: true, desc: "Log run time" },
            { id: "autoDrainValvetest", label: "Air Receiver Tank Auto-Drain Valve Check", type: "toggle", default: true, desc: "Verify moisture purge" },
            { id: "compressorOilTemp", label: "High Discharge Air Temperature Cutoff Test", type: "toggle", default: true, desc: "Test thermal safety trip" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "pmMeterInterval", label: "Compressor Fluid & Separator Filter Service (Hours)", type: "number", default: 500, desc: "Oil & air-oil separator PM" }
          ]
        }
      ]
    },
    "centrifugalpump": {
      sections: [
        {
          title: "1. Seal Flush & Vibration Telemetry",
          fields: [
            { id: "trackHours", label: "Track Motor / Engine Operating Hours", type: "toggle", default: true, desc: "Log run time" },
            { id: "mechanicalSealFlush", label: "Mechanical Seal Flush Pressure & Plan 53 Fluid Level", type: "toggle", default: true, desc: "Verify seal barrier fluid" },
            { id: "vibrationAuditDays", label: "Bearing Housing Vibration Measurement Schedule (Days)", type: "number", default: 90, desc: "Quarterly vibration check" }
          ]
        }
      ]
    },
    "pressurevessel": {
      sections: [
        {
          title: "1. Pressure Relief & Thickness Inspections",
          fields: [
            { id: "srvPopTestDays", label: "Safety Relief Valve (SRV) Pop Test Schedule (Days)", type: "number", default: 365, desc: "Annual relief valve bench cert" },
            { id: "utThicknessScanDays", label: "UT Shell & Head Thickness Scan Schedule (Days)", type: "number", default: 1825, desc: "5-year API 510 thickness audit" }
          ]
        }
      ]
    },

    // ==========================================
    // SECTION 13: TRAILERS & TRANSPORT
    // ==========================================
    "trailer": {
      sections: [
        {
          title: "1. Brakes, Axles & Coupling",
          fields: [
            { id: "airBrakePressureTest", label: "Check Air Brake / Electrical Breakaway System", type: "toggle", default: true, desc: "Pre-trip safety check" },
            { id: "minTreadDepth32nd", label: "Minimum Tire Tread Depth (1/32 in)", type: "number", default: 4, desc: "Out of service limit" },
            { id: "kingpinWearCheck", label: "Kingpin / Pintle Ring Wear Gauge Audit", type: "toggle", default: true, desc: "Verify hitch coupling tolerances" }
          ]
        },
        {
          title: "2. Maintenance Schedules",
          fields: [
            { id: "wheelBearingGreaseDays", label: "Wheel Bearing Repack Interval (Days)", type: "number", default: 180, desc: "Semi-annual wheel bearing service" }
          ]
        }
      ]
    },

    // ==========================================
    // DEFAULT FALLBACK SCHEMA
    // ==========================================
    "default": {
      sections: [
        {
          title: "1. Usage & Meter Tracking",
          fields: [
            { id: "trackHours", label: "Track Engine Operating Hours", type: "toggle", default: true, desc: "Require hour meter logging" },
            { id: "trackOdometer", label: "Track Odometer / Mileage", type: "toggle", default: false, desc: "Log mileage for road assets" }
          ]
        },
        {
          title: "2. Inspection Rules",
          fields: [
            { id: "autoWorkOrder", label: "Auto-Create Work Order on Inspection Failure", type: "toggle", default: true, desc: "Generate work order when an item fails" }
          ]
        },
        {
          title: "3. Maintenance Schedule",
          fields: [
            { id: "pmMeterInterval", label: "PM Meter Interval (Hours)", type: "number", default: 250, desc: "Standard hour-based service threshold" },
            { id: "pmCalendarInterval", label: "PM Calendar Interval (Days)", type: "number", default: 180, desc: "Standard time-based service threshold" }
          ]
        }
      ]
    }
  };

  // Direct string normalizer mapping all discrete onboarding choices
  function normalizeCategoryKey(str) {
    if (!str) return "default";
    const s = String(str).toLowerCase().trim();

    // 1. Light & Medium Fleet
    if (s.includes("pickup")) return "pickup";
    if (s.includes("medium vocational") || s.includes("cab-chassis") || s.includes("cargo van") || s.includes("passenger van") || s.includes("shuttle") || s.includes("sedan") || s.includes("suv")) return "medtruck";
    if (s.includes("utv") || s.includes("buggy") || s.includes("side-by-side")) return "utv";

    // 2. Heavy Vocational Trucks
    if (s.includes("day cab") || s.includes("sleeper") || s.includes("heavy vocational straight")) return "class8semitruck";
    if (s.includes("dump truck")) return "dumptruck";
    if (s.includes("vacuum") || s.includes("hydro-vac")) return "vactruck";
    if (s.includes("concrete mixer")) return "mixertruck";
    if (s.includes("service / utility body") || s.includes("bucket / boom truck") || s.includes("water truck") || s.includes("fuel & lube") || s.includes("roll-off") || s.includes("winch / bed") || s.includes("wireline") || s.includes("perforating") || s.includes("rolligon") || s.includes("tracked dump") || s.includes("vibroseis")) return "class8semitruck";

    // 3. Earthmoving & Paving
    if (s.includes("excavator")) return "excavator";
    if (s.includes("dozer")) return "dozer";
    if (s.includes("wheel loader") || s.includes("skid steer") || s.includes("backhoe") || s.includes("articulated dump") || s.includes("rigid frame haul")) return "loader";
    if (s.includes("motor grader")) return "grader";
    if (s.includes("paver") || s.includes("milling") || s.includes("reclaimer") || s.includes("compactor") || s.includes("scraper") || s.includes("striping")) return "loader";

    // 4. Drilling & Well Servicing
    if (s.includes("drilling rig") || s.includes("water well drilling")) return "drillingrig";
    if (s.includes("workover") || s.includes("pulling unit")) return "workoverrig";
    if (s.includes("coiled tubing")) return "coiledtubing";
    if (s.includes("substructure") || s.includes("mast / derrick") || s.includes("drawworks") || s.includes("mud pumps") || s.includes("shale shakers") || s.includes("blowout preventer") || s.includes("scr / vfd") || s.includes("frac tank")) return "drillingrig";

    // 5. Deep Foundation & Boring
    if (s.includes("directional drill") || s.includes("hdd") || s.includes("rock saw") || s.includes("trencher") || s.includes("tunnel boring") || s.includes("roadheader")) return "hdd";
    if (s.includes("pile driver") || s.includes("pipe jacking")) return "piledriver";

    // 6. Aerial Lifts & Cranes
    if (s.includes("crane") || s.includes("gantry") || s.includes("jib crane")) return "crane";
    if (s.includes("boom lift") || s.includes("scissor lift") || s.includes("vertical mast")) return "boomlift";
    if (s.includes("forklift") || s.includes("telehandler")) return "forklift";

    // 7. Pipeline & Forestry
    if (s.includes("sideboom") || s.includes("pipe bender") || s.includes("pipe tac") || s.includes("padding machine")) return "sideboom";
    if (s.includes("mulcher") || s.includes("stump grinder") || s.includes("chipper") || s.includes("tub grinder") || s.includes("hydro-ax") || s.includes("jarraff")) return "mulcher";
    if (s.includes("feller buncher")) return "fellerbuncher";
    if (s.includes("skidder") || s.includes("log loader") || s.includes("forwarder")) return "skidder";
    if (s.includes("agricultural tractor") || s.includes("combine") || s.includes("sprayer") || s.includes("baler")) return "agtractor";

    // 8. Production Plants & Mining
    if (s.includes("asphalt plant")) return "asphaltplant";
    if (s.includes("concrete batch plant")) return "concreteplant";
    if (s.includes("ultra-class mine haul")) return "minehaul";
    if (s.includes("rock crusher") || s.includes("screening plant") || s.includes("mining shovel") || s.includes("blast hole")) return "crusher";

    // 9. Fabrication & Process
    if (s.includes("welder")) return "shopwelder";
    if (s.includes("press brake") || s.includes("ironworker") || s.includes("shear") || s.includes("cnc cutting") || s.includes("lathe") || s.includes("milling machine")) return "pressbrake";
    if (s.includes("generator") || s.includes("light tower")) return "generator";
    if (s.includes("air compressor")) return "aircomp";
    if (s.includes("pump")) return "centrifugalpump";
    if (s.includes("pressure vessel") || s.includes("heat exchanger") || s.includes("boiler") || s.includes("storage tank") || s.includes("flare stack")) return "pressurevessel";

    // 10. Trailers & Attachments
    if (s.includes("trailer") || s.includes("flatbed") || s.includes("lowboy") || s.includes("step deck") || s.includes("tanker") || s.includes("tag trailer")) return "trailer";
    if (s.includes("bucket") || s.includes("breaker") || s.includes("grapple") || s.includes("auger") || s.includes("man basket") || s.includes("pallet forks")) return "excavator";

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
      const schema = CATEGORY_SCHEMAS[schemaKey] || CATEGORY_SCHEMAS['default'];

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
