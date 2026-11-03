/**
 * Cloudflare Pages Function: /api/send-dvir-email
 * Sends official DVIR compliance email via Resend API
 * File: /functions/api/send-dvir-email.js
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  wheelsRims: "Wheels, Rims, Lug Nuts & Stud Security",
  emergencyEquipment: "Emergency Equipment (Fire Extinguisher, Triangles, Spare Fuses)",
  fluidLeaks: "Oil, Coolant, Fuel & Hydraulic Fluid Leaks",
  beltsHoses: "Engine Belts, Hoses & Air Intake System",
  exhaustSystem: "Exhaust System & Emissions (No Leaks / Smoke)"
};

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-org-id',
  'Access-Control-Max-Age': '86400'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Resend API Key (RESEND_API_KEY) is missing in Cloudflare environment variables." }),
        { status: 500, headers: corsHeaders }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON request payload." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { officerEmail, powerUnit, trailer, driverSignature, location, status, defects, remarks } = body;

    if (!officerEmail || !officerEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: "Valid recipient email address is required." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const safePowerUnit = escapeHtml(powerUnit || 'N/A');
    const safeTrailer = escapeHtml(trailer || 'N/A');
    const safeDriverSig = escapeHtml(driverSignature || 'Driver on File');
    const safeLocation = escapeHtml(location || 'N/A');
    const safeRemarks = escapeHtml(remarks || 'No detailed remarks provided.');

    const isOOS = status === 'out_of_service';
    const hasDefects = status === 'defects_found' || isOOS;
    const nowStr = new Date().toLocaleString();

    // Map defect keys to friendly human-readable component labels
    let defectsListHtml = '';
    if (Array.isArray(defects) && defects.length > 0) {
      defectsListHtml = `
        <div style="margin-top: 10px; font-size: 13px;">
          <strong style="color: ${isOOS ? '#991b1b' : '#92400e'};">Failed Inspection Components:</strong>
          <ul style="margin: 4px 0 0 0; padding-left: 20px; color: #334155;">
            ${defects.map(d => `<li>${escapeHtml(ITEM_LABELS[d] || d)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: ${isOOS ? '#991b1b' : '#1e40af'}; color: #ffffff; padding: 16px; text-align: center;">
          <h2 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">OFFICIAL COMMERCIAL VEHICLE INSPECTION REPORT</h2>
          <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">FMCSA 49 CFR § 396.11 & § 396.13 Electronic Compliance Record</div>
        </div>

        <div style="padding: 20px;">
          ${isOOS ? `
            <div style="background-color: #fef2f2; border: 2px solid #dc2626; color: #991b1b; padding: 12px; border-radius: 6px; text-align: center; font-weight: bold; margin-bottom: 16px;">
              🚨 COMMERCIAL VEHICLE PLACED OUT-OF-SERVICE (§ 396.11)
            </div>
          ` : ''}

          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-weight: bold;">Power Unit ID:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #0f172a;">${safePowerUnit}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-weight: bold;">Trailer / Towed Unit:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #0f172a;">${safeTrailer}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-weight: bold;">Driver Signature:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #2563eb;">${safeDriverSig}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-weight: bold;">Inspection Date/Time:</td>
              <td style="padding: 10px 0; text-align: right; color: #334155;">${nowStr}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-weight: bold;">Inspection Location:</td>
              <td style="padding: 10px 0; text-align: right; color: #334155;">${safeLocation}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-weight: bold;">Safety Status:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold; color: ${isOOS ? '#dc2626' : hasDefects ? '#b45309' : '#16a34a'};">
                ${isOOS ? 'OUT-OF-SERVICE' : hasDefects ? 'DEFECTS FOUND' : 'PASS / SATISFACTORY'}
              </td>
            </tr>
          </table>

          ${hasDefects ? `
            <div style="background-color: ${isOOS ? '#fef2f2' : '#fffbeb'}; border-left: 4px solid ${isOOS ? '#dc2626' : '#f59e0b'}; padding: 12px; border-radius: 4px; margin-bottom: 20px;">
              <strong style="color: #0f172a;">Inspector Remarks & Defect Log:</strong>
              <p style="margin: 6px 0 0 0; color: #334155; font-size: 13px; line-height: 1.4;">${safeRemarks}</p>
              ${defectsListHtml}
            </div>
          ` : ''}

          <div style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px;">
            This automated eDVIR record was generated by DRIV-EN Compliance Engine in accordance with federal DOT roadside inspection standards.
          </div>
        </div>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'DRIV-EN Compliance <inspections@driv-en.com>',
        to: [officerEmail],
        subject: `[DVIR Compliance Record] Asset #${safePowerUnit} — ${isOOS ? 'OUT-OF-SERVICE' : 'Inspection Summary'}`,
        html: htmlContent
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(resendData.message || resendData.error || 'Resend API rejected email delivery.');
    }

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error('[RESEND-API-ERROR]', err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to dispatch compliance email." }),
      { status: 500, headers: corsHeaders }
    );
  }
}
