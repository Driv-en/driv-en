/* FMCSA Audit — build per-driver audit packets (cover + documents) */
(function () {
  "use strict";

  var DOC_CATALOG = [
    { group: "DQF", key: "application", label: "Application for Employment (391.21)", fields: ["dqf_application_doc"] },
    { group: "DQF", key: "emp_verification", label: "Employment Verification (391.23)", fields: ["dqf_emp_verification_doc"] },
    { group: "DQF", key: "mvr", label: "Driving Record / MVR", fields: ["driving_record_doc"] },
    { group: "DQF", key: "medical", label: "Medical Examiner Certificate", fields: ["medical_card_doc"] },
    { group: "DQF", key: "road_test", label: "Road Test Certificate (391.31)", fields: ["dqf_road_test_doc"] },
    { group: "DQF", key: "annual_mvr", label: "Annual MVR Review (391.25)", fields: ["dqf_annual_mvr_doc"] },
    { group: "DQF", key: "cdlis", label: "CDLIS Verification (384.226)", fields: ["dqf_cdlis_doc"] },
    { group: "DQF", key: "safety_perf", label: "Safety Performance History (391.23(h))", fields: ["dqf_safety_perf_doc"] },
    { group: "DQF", key: "twic", label: "TWIC Card", fields: ["dqf_twic_doc"] },
    { group: "DQF", key: "hazmat", label: "Hazmat Background (TSA 1572)", fields: ["dqf_hazmat_doc"] },
    { group: "DQF", key: "dl_front", label: "DL Front Photo", fields: ["dl_photo_front"] },
    { group: "DQF", key: "dl_back", label: "DL Back Photo", fields: ["dl_photo_back"] },
    { group: "D&A", key: "preemp_drug", label: "Pre-Employment Drug Test", fields: ["dqf_preemp_drug_doc"] },
    { group: "D&A", key: "alcohol", label: "Alcohol Test", fields: ["dqf_alcohol_test_doc"] },
    { group: "ACC", key: "additional", label: "Accidents / Citations / Additional", fields: ["dqf_additional_docs"] }
  ];
  var GROUP_LABELS = { DQF: "DQF Documents", "D&A": "Drug & Alcohol (separate — 382.401)", ACC: "Accidents & Citations (only if requested)" };

  var allDrivers = [];
  var selected = {};   // driverId -> true
  var selectedCats = {}; // catKey -> true
  var settings = {};
  var filterText = "";

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  function setStatus(msg, ok) {
    var el = $("faStatus");
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? "#16a34a" : "#dc2626";
  }

  function driverName(d) {
    var n = (d.first_name || "") + " " + (d.last_name || "");
    if (!n.trim()) n = d.full_name || "Driver";
    return n.trim();
  }

  function isCommercial(d) {
    return d.is_commercial_driver === "yes" || d.is_commercial_driver === true || d.is_commercial_driver === 1;
  }

  function loadDrivers() {
    fetch("/api/employees")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var list = data.employees || data.records || data.data || (Array.isArray(data) ? data : []);
        allDrivers = list.filter(isCommercial);
        renderDrivers();
      })
      .catch(function (e) {
        var el = $("faDriverList");
        if (el) el.innerHTML = '<div style="padding:16px;color:#dc2626;font-size:13px;">Could not load drivers: ' + esc(e.message) + "</div>";
      });
  }

  function renderDrivers() {
    var el = $("faDriverList");
    if (!el) return;
    var q = filterText.toLowerCase();
    var shown = allDrivers.filter(function (d) { return !q || driverName(d).toLowerCase().indexOf(q) !== -1; });
    if (!shown.length) { el.innerHTML = '<div style="padding:16px;color:var(--text-muted,#64748b);font-size:13px;">No drivers found.</div>'; return; }
    var html = "";
    shown.forEach(function (d) {
      html += '<div class="fa-driver-row"><input type="checkbox" id="drv_' + esc(d.id) + '" ' + (selected[d.id] ? "checked" : "") + ' onchange="faToggleDriver(\'' + esc(d.id) + '\', this.checked)"><label for="drv_' + esc(d.id) + '">' + esc(driverName(d)) + (d.cdl_class ? ' <span style="color:var(--text-muted,#64748b);font-size:12px;">— CDL ' + esc(d.cdl_class) + "</span>" : "") + "</label></div>";
    });
    el.innerHTML = html;
    updateCount();
  }

  function updateCount() {
    var el = $("faDriverCount");
    var n = Object.keys(selected).filter(function (k) { return selected[k]; }).length;
    if (el) el.textContent = n + " selected";
    faUpdatePreflight();
  }

  window.faFilterDrivers = function (v) { filterText = v || ""; renderDrivers(); };
  window.faToggleDriver = function (id, on) { if (on) selected[id] = true; else delete selected[id]; updateCount(); };
  window.faToggleAll = function (on) {
    var q = filterText.toLowerCase();
    allDrivers.forEach(function (d) {
      if (!q || driverName(d).toLowerCase().indexOf(q) !== -1) { if (on) selected[d.id] = true; else delete selected[d.id]; }
    });
    renderDrivers();
  };

  function renderCategories() {
    var el = $("faCategoryList");
    if (!el) return;
    var groups = { DQF: [], "D&A": [], ACC: [] };
    DOC_CATALOG.forEach(function (c) { groups[c.group].push(c); });
    var html = "";
    ["DQF", "D&A", "ACC"].forEach(function (g) {
      html += '<div class="fa-cat-group"><h4>' + esc(GROUP_LABELS[g]) + "</h4>";
      groups[g].forEach(function (c) {
        var checked = selectedCats[c.key] ? "checked" : "";
        html += '<div class="fa-cat-item"><input type="checkbox" id="cat_' + c.key + '" ' + checked + ' onchange="faToggleCat(\'' + c.key + '\', this.checked)"><label for="cat_' + c.key + '">' + esc(c.label) + "</label></div>";
      });
      html += "</div>";
    });
    el.innerHTML = html;
  }

  window.faToggleCat = function (key, on) { if (on) selectedCats[key] = true; else delete selectedCats[key]; faUpdatePreflight(); };

  function selectedCatDefs() {
    return DOC_CATALOG.filter(function (c) { return selectedCats[c.key]; });
  }

  // Does a driver have a document for a category? (handles additional_docs JSON array)
  function driverHasDoc(d, cat) {
    for (var i = 0; i < cat.fields.length; i++) {
      var f = cat.fields[i];
      if (f === "dqf_additional_docs") {
        try { var arr = JSON.parse(d[f] || "[]"); if (Array.isArray(arr) && arr.length) return true; } catch (e) {}
      } else if (d[f]) { return true; }
    }
    return false;
  }

  window.faUpdatePreflight = function () {
    var el = $("faPreflight");
    if (!el) return;
    var ids = Object.keys(selected).filter(function (k) { return selected[k]; });
    var cats = selectedCatDefs();
    if (!ids.length || !cats.length) { el.innerHTML = '<span style="font-size:13px;color:var(--text-muted,#64748b);">Select at least one driver and one document to see the pre-flight check.</span>'; return; }
    var html = '<div style="font-size:13px;">';
    ids.forEach(function (id) {
      var d = allDrivers.find(function (x) { return x.id === id; });
      if (!d) return;
      var missing = cats.filter(function (c) { return !driverHasDoc(d, c); });
      html += '<div style="margin-bottom:6px;"><strong>' + esc(driverName(d)) + ":</strong> ";
      if (missing.length) html += '<span class="fa-missing">' + missing.length + " not on file (" + esc(missing.map(function (c) { return c.label; }).join(", ")) + ")</span>";
      else html += '<span class="fa-ok">all selected documents on file</span>';
      html += "</div>";
    });
    html += "</div>";
    el.innerHTML = html;
  };

  // ---------- PDF generation ----------
  function fetchDocBytes(key) {
    return fetch("/api/employee-documents/" + encodeURIComponent(key)).then(function (r) {
      if (!r.ok) throw new Error("doc fetch failed");
      var ct = r.headers.get("Content-Type") || "";
      return r.arrayBuffer().then(function (buf) { return { bytes: new Uint8Array(buf), contentType: ct, key: key }; });
    });
  }

  function isPdf(ct, key) { return /pdf/i.test(ct) || /\.pdf($|\?)/i.test(key); }
  function isPng(ct, key) { return /png/i.test(ct) || /\.png($|\?)/i.test(key); }
  function isJpg(ct, key) { return /jpe?g/i.test(ct) || /\.jpe?g($|\?)/i.test(key); }

  function calcStatus(expDate) {
    if (!expDate) return "none";
    var d = new Date(expDate);
    if (isNaN(d.getTime())) return "none";
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var diff = Math.floor((d - today) / 86400000);
    if (diff < 0) return "expired";
    if (diff <= 7) return "7day";
    if (diff <= 30) return "30day";
    return "current";
  }
  function addMonths(dateStr, months) {
    if (!dateStr) return "";
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }
  function statusLabel(s) {
    return { current: "Current", "30day": "Expiring (30d)", "7day": "Expiring (7d)", expired: "Expired", none: "—", Missing: "Missing", "On File": "On File" }[s] || (s || "—");
  }
  function statusColor(PDFLib, s) {
    if (s === "current" || s === "On File") return PDFLib.rgb(0.09, 0.64, 0.29);
    if (s === "30day" || s === "7day") return PDFLib.rgb(0.85, 0.47, 0.02);
    if (s === "expired" || s === "Missing") return PDFLib.rgb(0.86, 0.15, 0.15);
    return PDFLib.rgb(0.4, 0.4, 0.4);
  }
  function summaryRowFor(key, d) {
    switch (key) {
      case "application": return { item: "Application for Employment (391.21)", dates: d.dqf_application_date || "—", status: "" };
      case "emp_verification": return { item: "Employment Verification (391.23)", dates: d.dqf_emp_verification_date || "—", status: d.dqf_emp_verification_status || "" };
      case "mvr": return { item: "Driving Record (MVR)", dates: "Verified " + (d.driving_record_verified || "—") + (d.driving_record_recheck_date ? " · Recheck " + d.driving_record_recheck_date : ""), status: calcStatus(d.driving_record_recheck_date || addMonths(d.driving_record_verified, 12)) };
      case "medical": return { item: "Medical Examiner Certificate", dates: "Expires " + (d.medical_card_expiration || "—"), status: calcStatus(d.medical_card_expiration) };
      case "road_test": return { item: "Road Test (391.31)", dates: (d.dqf_road_test_date || "—") + (d.dqf_road_test_examiner ? " · " + d.dqf_road_test_examiner : ""), status: "" };
      case "annual_mvr": return { item: "Annual MVR Review (391.25)", dates: (d.dqf_annual_mvr_date || "—") + (d.dqf_annual_mvr_reviewer ? " · " + d.dqf_annual_mvr_reviewer : ""), status: "" };
      case "cdlis": return { item: "CDLIS Verification (384.226)", dates: d.dqf_cdlis_date || "—", status: d.dqf_cdlis_result || "" };
      case "safety_perf": return { item: "Safety Performance History (391.23(h))", dates: d.dqf_safety_perf_date || "—", status: d.dqf_safety_perf_result || "" };
      case "twic": return { item: "TWIC Card", dates: (d.dqf_twic_num || "—") + (d.dqf_twic_exp ? " · Exp " + d.dqf_twic_exp : ""), status: "" };
      case "hazmat": return { item: "Hazmat Background (TSA 1572)", dates: d.dqf_hazmat_date || "—", status: d.dqf_hazmat_result || "" };
      case "dl_front": return { item: "DL Front Photo", dates: "", status: d.dl_photo_front ? "On File" : "Missing" };
      case "dl_back": return { item: "DL Back Photo", dates: "", status: d.dl_photo_back ? "On File" : "Missing" };
      case "preemp_drug": return { item: "Pre-Employment Drug Test", dates: d.dqf_preemp_drug_date || "—", status: d.dqf_preemp_drug_result || "" };
      case "alcohol": return { item: "Alcohol Test", dates: d.dqf_alcohol_test_date || "—", status: d.dqf_alcohol_test_result || "" };
      case "additional": return { item: "Accidents / Citations / Additional", dates: "", status: "See exhibit" };
      default: return { item: key, dates: "", status: "" };
    }
  }

  async function buildDriverPdf(driver, cats, info) {
    info = info || {};
    var PDFLib = window.PDFLib;
    var pdfDoc = await PDFLib.PDFDocument.create();
    try { pdfDoc.setTitle("DQF Audit Packet — " + driverName(driver)); pdfDoc.setAuthor("DRIV-EN"); pdfDoc.setProducer("DRIV-EN"); } catch (e) {}
    var font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    var fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    var green = PDFLib.rgb(0.09, 0.64, 0.29), gray = PDFLib.rgb(0.45, 0.45, 0.45), black = PDFLib.rgb(0.1, 0.1, 0.1), lineCol = PDFLib.rgb(0.8, 0.8, 0.8);

    // ---- Page 1: Cover ----
    var cover = pdfDoc.addPage([612, 792]);
    var page = cover;
    var y = 740, mx = 50;
    function line(text, size, bold, color) {
      page.drawText(String(text == null ? "" : text), { x: mx, y: y, size: size || 11, font: bold ? fontBold : font, color: color || black });
      y -= (size || 11) + 6;
    }
    line("DRIVER QUALIFICATION FILE — AUDIT PACKET", 16, true, green);
    y -= 4;
    line("Carrier: " + (settings.carrier_name || "—"), 12, true);
    var cd = [];
    if (settings.carrier_dot) cd.push("USDOT: " + settings.carrier_dot);
    if (settings.carrier_mc) cd.push("MC: " + settings.carrier_mc);
    if (settings.carrier_scac) cd.push("SCAC: " + settings.carrier_scac);
    if (cd.length) line(cd.join("   "), 10);
    if (settings.carrier_address) line(settings.carrier_address, 10);
    if (settings.carrier_phone) line("Phone: " + settings.carrier_phone, 10);
    y -= 8;
    line("Driver: " + driverName(driver), 13, true);
    if (driver.employee_number) line("Employee #: " + driver.employee_number, 10);
    if (driver.cdl_class) line("CDL Class: " + driver.cdl_class, 10);
    line("Generated: " + new Date().toLocaleString(), 10);
    if (info.prepared_by) line("Prepared by: " + info.prepared_by + (info.role ? " — " + info.role : ""), 10);
    if (info.auditor_name || info.auditor_creds) line("Auditor: " + (info.auditor_name || "") + (info.auditor_creds ? " — " + info.auditor_creds : ""), 10);
    if (info.review_date) line("Review date: " + info.review_date, 10);
    if (info.reference) line("Reference: " + info.reference, 10);
    y -= 6;
    page.drawLine({ start: { x: mx, y: y }, end: { x: 562, y: y }, thickness: 0.5, color: lineCol }); y -= 18;
    page.drawText("COMPANY REPRESENTATIVE CERTIFICATION", { x: mx, y: y, size: 11, font: fontBold, color: black }); y -= 16;
    page.drawText("I, the undersigned company representative, certify that the documents provided in this packet are true and complete to the best of my knowledge.", { x: mx, y: y, size: 9, font: font, color: black }); y -= 24;
    page.drawText("Signature (Company Representative): ______________________", { x: mx, y: y, size: 10, font: font, color: black }); y -= 20;
    page.drawText("Printed name: " + (info.prepared_by || "____________________"), { x: mx, y: y, size: 10, font: font, color: black });
    page.drawText("Title: " + (info.role || "____________________"), { x: 330, y: y, size: 10, font: font, color: black }); y -= 20;
    page.drawText("Date: ________________", { x: mx, y: y, size: 10, font: font, color: black }); y -= 26;
    page.drawLine({ start: { x: mx, y: y }, end: { x: 562, y: y }, thickness: 0.5, color: lineCol }); y -= 16;
    page.drawText("RECEIVED BY (AUDITOR) — optional", { x: mx, y: y, size: 10, font: fontBold, color: black }); y -= 16;
    page.drawText("Auditor: " + (info.auditor_name || "____________________") + (info.auditor_creds ? "  (" + info.auditor_creds + ")" : ""), { x: mx, y: y, size: 10, font: font, color: black }); y -= 20;
    page.drawText("Signature: ______________________________", { x: mx, y: y, size: 10, font: font, color: black });
    page.drawText("Date: ________________", { x: 400, y: y, size: 10, font: font, color: black }); y -= 20;
    page.drawLine({ start: { x: mx, y: y }, end: { x: 562, y: y }, thickness: 0.5, color: lineCol }); y -= 18;
    line("DOCUMENTS INCLUDED", 12, true);
    cats.forEach(function (c, i) {
      var has = driverHasDoc(driver, c);
      var status = has ? "ON FILE" : "NOT ON FILE";
      var col = has ? green : PDFLib.rgb(0.7, 0.33, 0.03);
      page.drawText("Exhibit " + String.fromCharCode(65 + i) + " — " + c.label, { x: mx, y: y, size: 10, font: font });
      page.drawText(status, { x: 470, y: y, size: 9, font: fontBold, color: col });
      y -= 16;
      if (y < 80) { page = pdfDoc.addPage([612, 792]); y = 740; }
    });
    // DRIV-EN recognition — COVER PAGE ONLY
    cover.drawText("Generated by DRIV-EN — driv-en.com", { x: mx, y: 40, size: 8, font: font, color: gray });

    // ---- Page 2: Compliance Summary (scoped to selected categories) ----
    var sum = pdfDoc.addPage([612, 792]);
    var sy = 740;
    sum.drawText("COMPLIANCE SUMMARY", { x: mx, y: sy, size: 15, font: fontBold, color: green }); sy -= 22;
    sum.drawText("Driver: " + driverName(driver) + (driver.cdl_class ? "   ·   CDL " + driver.cdl_class : ""), { x: mx, y: sy, size: 10, font: font, color: black }); sy -= 20;
    sum.drawText("Item", { x: mx, y: sy, size: 10, font: fontBold });
    sum.drawText("Date(s)", { x: 250, y: sy, size: 10, font: fontBold });
    sum.drawText("Status", { x: 480, y: sy, size: 10, font: fontBold });
    sy -= 6;
    sum.drawLine({ start: { x: mx, y: sy }, end: { x: 562, y: sy }, thickness: 1, color: lineCol }); sy -= 16;
    cats.forEach(function (c) {
      var row = summaryRowFor(c.key, driver);
      var has = driverHasDoc(driver, c);
      if (sy < 70) { sum = pdfDoc.addPage([612, 792]); sy = 740; }
      sum.drawText(String(row.item).substring(0, 40), { x: mx, y: sy, size: 9, font: font, color: black });
      sum.drawText(String(row.dates || "—").substring(0, 42), { x: 250, y: sy, size: 9, font: font, color: black });
      var st = has ? (row.status || "On File") : "Missing";
      sum.drawText(statusLabel(st), { x: 480, y: sy, size: 9, font: fontBold, color: statusColor(PDFLib, st) });
      sy -= 15;
      sum.drawLine({ start: { x: mx, y: sy + 4 }, end: { x: 562, y: sy + 4 }, thickness: 0.4, color: lineCol });
    });

    // ---- Documents (exhibits) ----
    for (var i = 0; i < cats.length; i++) {
      var cat = cats[i];
      var keys = [];
      cat.fields.forEach(function (f) {
        if (f === "dqf_additional_docs") {
          try { var arr = JSON.parse(driver[f] || "[]"); (arr || []).forEach(function (a) { if (a && a.key) keys.push(a.key); }); } catch (e) {}
        } else if (driver[f]) { keys.push(driver[f]); }
      });
      for (var k = 0; k < keys.length; k++) {
        try {
          var doc = await fetchDocBytes(keys[k]);
          if (isPdf(doc.contentType, doc.key)) {
            var src = await PDFLib.PDFDocument.load(doc.bytes, { ignoreEncryption: true });
            var copied = await pdfDoc.copyPages(src, src.getPageIndices());
            copied.forEach(function (p) { pdfDoc.addPage(p); });
          } else if (isPng(doc.contentType, doc.key) || isJpg(doc.contentType, doc.key)) {
            var img = isPng(doc.contentType, doc.key) ? await pdfDoc.embedPng(doc.bytes) : await pdfDoc.embedJpg(doc.bytes);
            var p2 = pdfDoc.addPage([612, 792]);
            var maxW = 512, maxH = 660;
            var scale = Math.min(maxW / img.width, maxH / img.height, 1);
            var w = img.width * scale, h = img.height * scale;
            p2.drawText("Exhibit " + String.fromCharCode(65 + i) + " — " + cat.label, { x: 50, y: 760, size: 10, font: fontBold });
            p2.drawImage(img, { x: (612 - w) / 2, y: (792 - h) / 2 + 20, width: w, height: h });
          }
        } catch (e) {
          var p3 = pdfDoc.addPage([612, 792]);
          p3.drawText("Exhibit " + String.fromCharCode(65 + i) + " — " + cat.label, { x: 50, y: 760, size: 10, font: fontBold });
          p3.drawText("Document could not be embedded (unsupported format or unavailable).", { x: 50, y: 730, size: 10, font: font });
        }
      }
    }

    // ---- Footer on EVERY page: driver + carrier + DOT + page X of Y ----
    var pages = pdfDoc.getPages();
    var total = pages.length;
    var carrierLine = "Driver: " + driverName(driver) + "   •   Carrier: " + (settings.carrier_name || "—") + (settings.carrier_dot ? "   •   USDOT: " + settings.carrier_dot : "");
    pages.forEach(function (p, idx) {
      var w = p.getWidth();
      p.drawLine({ start: { x: 50, y: 34 }, end: { x: w - 50, y: 34 }, thickness: 0.5, color: lineCol });
      p.drawText(carrierLine, { x: 50, y: 20, size: 8, font: font, color: gray });
      var pg = "Page " + (idx + 1) + " of " + total;
      p.drawText(pg, { x: w - 50 - font.widthOfTextAtSize(pg, 8), y: 20, size: 8, font: font, color: gray });
    });

    return await pdfDoc.save();
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function getTransmittalInfo() {
    return {
      prepared_by: ($("faPreparedBy") || {}).value || "",
      role: ($("faRole") || {}).value || "",
      auditor_name: ($("faAuditorName") || {}).value || "",
      auditor_creds: ($("faAuditorCreds") || {}).value || "",
      review_date: ($("faReviewDate") || {}).value || "",
      reference: ($("faReference") || {}).value || ""
    };
  }

  function prefillTransmittal() {
    var u = {}; try { u = JSON.parse(localStorage.getItem("driven_user") || "{}"); } catch (e) {}
    var name = u.full_name || u.name || ((u.first_name || "") + " " + (u.last_name || "")).trim();
    if ($("faPreparedBy") && name) $("faPreparedBy").value = name;
    if ($("faRole") && (u.role || u.role_name)) $("faRole").value = u.role || u.role_name;
    if ($("faReviewDate")) $("faReviewDate").value = new Date().toISOString().slice(0, 10);
  }

  function renderResults(drivers) {
    var el = $("faResults");
    if (!el) return;
    if (!drivers.length) { el.innerHTML = ""; return; }
    var html = '<h4 style="font-size:14px;margin:0 0 6px 0;">Upload Signed Signature Page (supplement)</h4>';
    html += '<p style="font-size:12px;color:var(--text-muted,#64748b);margin:0 0 10px 0;">After printing and signing the cover, upload the signed page here to attach it to the driver file as a supplement.</p>';
    drivers.forEach(function (d) {
      html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border,#e2e8f0);flex-wrap:wrap;">';
      html += '<span style="flex:1;min-width:140px;font-size:14px;">' + esc(driverName(d)) + '</span>';
      html += '<input type="file" id="signed_' + esc(d.id) + '" accept="image/*,application/pdf" style="font-size:12px;">';
      html += '<button class="fa-btn fa-btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="faUploadSigned(\'' + esc(d.id) + '\')">Upload</button>';
      html += '<span id="signedstatus_' + esc(d.id) + '" style="font-size:12px;"></span>';
      html += '</div>';
    });
    el.innerHTML = html;
  }

  window.faUploadSigned = async function (driverId) {
    var input = $("signed_" + driverId);
    var statusEl = $("signedstatus_" + driverId);
    if (!input || !input.files || !input.files[0]) { if (statusEl) { statusEl.textContent = "Choose a file first."; statusEl.style.color = "#dc2626"; } return; }
    if (statusEl) { statusEl.textContent = "Uploading…"; statusEl.style.color = "#64748b"; }
    try {
      var fd = new FormData();
      fd.append("file", input.files[0]);
      fd.append("docType", "signed_cover");
      fd.append("empId", driverId);
      var up = await fetch("/api/employee-documents/upload", { method: "POST", body: fd });
      var upData = await up.json();
      if (!up.ok || !upData.success) throw new Error(upData.error || "Upload failed");
      var save = await fetch("/api/dqf/" + encodeURIComponent(driverId), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dqf_signed_cover_doc: upData.key })
      });
      var saveData = await save.json();
      if (!save.ok || !saveData.success) throw new Error(saveData.error || "Save failed");
      if (statusEl) { statusEl.textContent = "Uploaded"; statusEl.style.color = "#16a34a"; }
    } catch (e) {
      if (statusEl) { statusEl.textContent = "Failed: " + e.message; statusEl.style.color = "#dc2626"; }
    }
  };

  window.faGenerate = async function () {
    if (!window.PDFLib) { setStatus("PDF library failed to load. Check your connection and refresh.", false); return; }
    var ids = Object.keys(selected).filter(function (k) { return selected[k]; });
    var cats = selectedCatDefs();
    if (!ids.length) { setStatus("Select at least one driver.", false); return; }
    if (!cats.length) { setStatus("Select at least one document category.", false); return; }
    var info = getTransmittalInfo();
    var btn = $("faGenerateBtn");
    if (btn) btn.disabled = true;
    try {
      var pdfs = [];
      var generated = [];
      for (var i = 0; i < ids.length; i++) {
        var d = allDrivers.find(function (x) { return x.id === ids[i]; });
        if (!d) continue;
        setStatus("Building packet " + (i + 1) + " of " + ids.length + " — " + driverName(d) + "…", true);
        var bytes = await buildDriverPdf(d, cats, info);
        var safeName = driverName(d).replace(/[^a-z0-9]+/gi, "_");
        pdfs.push({ name: "DQF_" + safeName + ".pdf", bytes: bytes });
        generated.push(d);
      }
      if (pdfs.length === 1) {
        downloadBlob(new Blob([pdfs[0].bytes], { type: "application/pdf" }), pdfs[0].name);
      } else {
        if (!window.JSZip) { setStatus("ZIP library failed to load. Generating individually…", false); pdfs.forEach(function (p) { downloadBlob(new Blob([p.bytes], { type: "application/pdf" }), p.name); }); }
        else {
          var zip = new window.JSZip();
          pdfs.forEach(function (p) { zip.file(p.name, p.bytes); });
          var zblob = await zip.generateAsync({ type: "blob" });
          downloadBlob(zblob, "DQF_Audit_Packets.zip");
        }
      }
      renderResults(generated);
      setStatus("Done — " + pdfs.length + " packet(s) generated.", true);
    } catch (e) {
      setStatus("Generation failed: " + e.message, false);
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.faOpenModal = function (id) { var m = $(id); if (m) m.classList.add("active"); };
  window.faCloseModal = function (id) { var m = $(id); if (m) m.classList.remove("active"); };
  window.faLogout = function () { fetch("/auth/logout", { method: "POST", credentials: "include" }).catch(function () {}).finally(function () { window.location.href = "/public/login.html"; }); };

  function loadSettings() {
    fetch("/auth/get-settings", { credentials: "include" }).then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.success && data.settings) settings = data.settings;
    }).catch(function () {});
  }

  function syncHeaderHeight() {
    var el = document.getElementById("dashStickyHeader");
    if (el) { var h = el.offsetHeight || el.getBoundingClientRect().height; if (h > 0) document.documentElement.style.setProperty("--header-height", Math.round(h) + "px"); }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var y = $("faYear"); if (y) y.textContent = new Date().getFullYear();
    // default categories: DQF on
    DOC_CATALOG.forEach(function (c) { if (c.group === "DQF") selectedCats[c.key] = true; });
    renderCategories();
    prefillTransmittal();
    loadSettings();
    loadDrivers();
    var bp = $("faBtnPurpose"); if (bp) bp.addEventListener("click", function () { faOpenModal("faPurposeModal"); });
    var bi = $("faBtnInstructions"); if (bi) bi.addEventListener("click", function () { faOpenModal("faInstructionsModal"); });
    [100, 300, 500, 1000].forEach(function (d) { setTimeout(syncHeaderHeight, d); });
    window.addEventListener("resize", syncHeaderHeight);
  });
})();
