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

  async function buildDriverPdf(driver, cats) {
    var PDFLib = window.PDFLib;
    var pdfDoc = await PDFLib.PDFDocument.create();
    var font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    var fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

    // ---- Cover page ----
    var page = pdfDoc.addPage([612, 792]);
    var y = 740;
    var marginX = 50;
    function line(text, size, bold, color) {
      page.drawText(String(text == null ? "" : text), { x: marginX, y: y, size: size || 11, font: bold ? fontBold : font, color: color || PDFLib.rgb(0.1, 0.1, 0.1) });
      y -= (size || 11) + 6;
    }
    line("DRIVER QUALIFICATION FILE — AUDIT PACKET", 16, true, PDFLib.rgb(0.09, 0.64, 0.29));
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
    y -= 10;
    line("DOCUMENTS INCLUDED", 12, true);
    cats.forEach(function (c, i) {
      var has = driverHasDoc(driver, c);
      var status = has ? "ON FILE" : "NOT ON FILE";
      var col = has ? PDFLib.rgb(0.09, 0.64, 0.29) : PDFLib.rgb(0.7, 0.33, 0.03);
      page.drawText("Exhibit " + String.fromCharCode(65 + i) + " — " + c.label, { x: marginX, y: y, size: 10, font: font });
      page.drawText(status, { x: 470, y: y, size: 9, font: fontBold, color: col });
      y -= 16;
      if (y < 60) { page = pdfDoc.addPage([612, 792]); y = 740; }
    });
    // footer
    page.drawText("Generated by DRIV-EN — driv-en.com", { x: marginX, y: 30, size: 8, font: font, color: PDFLib.rgb(0.6, 0.6, 0.6) });

    // ---- Documents ----
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
            var maxW = 512, maxH = 692;
            var scale = Math.min(maxW / img.width, maxH / img.height, 1);
            var w = img.width * scale, h = img.height * scale;
            p2.drawText("Exhibit " + String.fromCharCode(65 + i) + " — " + cat.label, { x: 50, y: 760, size: 10, font: fontBold });
            p2.drawImage(img, { x: (612 - w) / 2, y: (792 - h) / 2, width: w, height: h });
          }
        } catch (e) {
          var p3 = pdfDoc.addPage([612, 792]);
          p3.drawText("Exhibit " + String.fromCharCode(65 + i) + " — " + cat.label, { x: 50, y: 760, size: 10, font: fontBold });
          p3.drawText("Document could not be embedded (unsupported format or unavailable).", { x: 50, y: 730, size: 10, font: font });
        }
      }
    }

    return await pdfDoc.save();
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  window.faGenerate = async function () {
    if (!window.PDFLib) { setStatus("PDF library failed to load. Check your connection and refresh.", false); return; }
    var ids = Object.keys(selected).filter(function (k) { return selected[k]; });
    var cats = selectedCatDefs();
    if (!ids.length) { setStatus("Select at least one driver.", false); return; }
    if (!cats.length) { setStatus("Select at least one document category.", false); return; }
    var btn = $("faGenerateBtn");
    if (btn) btn.disabled = true;
    try {
      var pdfs = [];
      for (var i = 0; i < ids.length; i++) {
        var d = allDrivers.find(function (x) { return x.id === ids[i]; });
        if (!d) continue;
        setStatus("Building packet " + (i + 1) + " of " + ids.length + " — " + driverName(d) + "…", true);
        var bytes = await buildDriverPdf(d, cats);
        var safeName = driverName(d).replace(/[^a-z0-9]+/gi, "_");
        pdfs.push({ name: "DQF_" + safeName + ".pdf", bytes: bytes });
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
    loadSettings();
    loadDrivers();
    var bp = $("faBtnPurpose"); if (bp) bp.addEventListener("click", function () { faOpenModal("faPurposeModal"); });
    var bi = $("faBtnInstructions"); if (bi) bi.addEventListener("click", function () { faOpenModal("faInstructionsModal"); });
    [100, 300, 500, 1000].forEach(function (d) { setTimeout(syncHeaderHeight, d); });
    window.addEventListener("resize", syncHeaderHeight);
  });
})();
