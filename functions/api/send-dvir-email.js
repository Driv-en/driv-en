/* ==========================================================================
   DRIV-EN DVIR OFFICER EMAIL DISPATCH (Standalone Pages Function)
   Path: /functions/api/send-dvir-email.js
   ========================================================================== */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-org-id',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function onRequestPost({ request, env }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    const {
      officerEmail,
      powerUnit,
      trailer,
      driverSignature,
      location,
      status,
      defects,
      remarks
    } = body || {};

    if (!officerEmail || !officerEmail.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Officer email address is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'RESEND_API_KEY environment variable is not configured in Cloudflare Pages.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
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

    const esc = (s) => !s ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const defectsList = Array.isArray(defects) && defects.length > 0
      ? defects.map(id => `<li><strong>${esc(ITEM_LABELS[id] || id)}</strong></li>`).join('')
      : '<li><em>No specific defect items selected.</em></li>';

    let statusBadge = '<span style="color:#15803d; font-weight:bold;">✅ Certified Safe for Operation</span>';
    if (status === 'out_of_service') {
      statusBadge = '<span style="color:#b91c1c; font-weight:bold;">🚨 OUT-OF-SERVICE (UNSAFE TO OPERATE)</span>';
    } else if (status === 'defects_found') {
      statusBadge = '<span style="color:#b45309; font-weight:bold;">⚠️ Safety Defects Logged</span>';
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 20px; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">Official DVIR Safety Inspection Report</h2>
          <p style="font-size: 14px; color: #64748b;">FMCSA 49 CFR Part 396 Electronic Record Verification</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
          
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #64748b;">Power Unit ID:</td><td style="font-weight: bold; text-align: right;">${esc(powerUnit || 'N/A')}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Trailer / Towed Unit:</td><td style="font-weight: bold; text-align: right;">${esc(trailer || 'N/A')}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Inspection Location:</td><td style="text-align: right;">${esc(location || 'N/A')}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Driver Signature:</td><td style="color: #2563eb; font-weight: bold; text-align: right;">${esc(driverSignature || 'N/A')}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Compliance Status:</td><td style="text-align: right;">${statusBadge}</td></tr>
          </table>

          ${(status === 'defects_found' || status === 'out_of_service') ? `
            <div style="margin-top: 20px; background: #fffbeb; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px;">
              <h4 style="margin: 0 0 8px 0; color: #92400e;">Logbook Reported Defect Items:</h4>
              <ul style="margin: 0; padding-left: 20px; color: #78350f;">${defectsList}</ul>
              ${remarks ? `<p style="margin: 8px 0 0 0; font-size: 13px;"><strong>Inspector Remarks:</strong> ${esc(remarks)}</p>` : ''}
            </div>
          ` : ''}

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">Dispatched automatically via DRIV-EN Electronic Safety Platform</p>
        </div>
      </body>
      </html>
    `;

    const rawFrom = env.RESEND_FROM_EMAIL || 'noreply@driv-en.com';
    const fromAddress = rawFrom.includes('<') ? rawFrom : `DRIV-EN Compliance <${rawFrom}>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [officerEmail.trim()],
        subject: `Official DVIR Vehicle Inspection Report — Unit #${powerUnit || 'N/A'}`,
        html: htmlContent
      })
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: resendData.message || 'Resend API Error' }),
        { status: resendRes.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully', data: resendData }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }
}
