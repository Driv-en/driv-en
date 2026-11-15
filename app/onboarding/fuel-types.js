/* ==========================================================================
   DRIV-EN Platform — Onboarding: Project Types JavaScript (v1)
   File: /app/onboarding/project-types.js
   Extracted from project-types.html for CSP compliance (no inline scripts).
   ========================================================================== */

    var projectTypes = [];
    var existingProjectTypes = [];
    var ptDirty = false;
    var activeOrgId = null;
    var customerOrgName = "DRIV-EN Org";

    var sessionPageSize = 10, sessionPage = 1, sessionSortCol = 'name', sessionSortAsc = true;
    var existingPageSize = 10, existingPage = 1, existingSortCol = 'name', existingSortAsc = true;

    var ptError = document.getElementById("ptError");
    var ptSuccess = document.getElementById("ptSuccess");
    var ptTableContainer = document.getElementById("ptTableContainer");
    var existingPtTableContainer = document.getElementById("existingPtTableContainer");
    var ptStepStatus = document.getElementById("ptStepStatus");
    var ptCountEl = document.getElementById("ptCount");
    var existingPtCountEl = document.getElementById("existingPtCount");
    var statusBulk = document.getElementById("statusBulk");
    var bulkPreview = document.getElementById("bulkPreview");

    function normalizeName(str) { 
      if (typeof str === 'object' && str !== null) {
        str = str.name || str.project_type_name || str.projectTypeName || "";
      }
      return String(str || "").trim().replace(/\s+/g, " "); 
    }
    
    function validateOrgContext() {
      if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "null") {
        if (ptError) ptError.textContent = "Security Alert: Invalid Organization Context. Action rejected.";
        return false;
      }
      return true;
    }

    function sendPresenceUnload() {
      if (!activeOrgId) return;
      var payload = JSON.stringify({ page: "Project Types", action: "leave" });
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/onboarding/presence", blob);
      } else {
        fetch("/api/onboarding/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-org-id": activeOrgId },
          body: payload,
          keepalive: true
        }).catch(function() {});
      }
    }

    async function checkActivePresence() {
      if (!navigator.onLine) return;
      try {
        var resp = await fetch("/api/onboarding/presence", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-org-id": activeOrgId || ""
          },
          body: JSON.stringify({ page: "Project Types" })
        });
        if (resp.ok) {
          var data = await resp.json();
          var banner = document.getElementById("presenceBanner");
          var textEl = document.getElementById("presenceText");
          if (data.activeUsers && data.activeUsers.length > 0) {
            var fullNames = data.activeUsers.map(function(u) {
              if (typeof u === "object") {
                return ((u.firstName || u.first_name || "") + " " + (u.lastName || u.last_name || "")).trim() || u.name || u.email;
              }
              return String(u);
            });
            textEl.textContent = "🟢 " + fullNames.join(", ") + " is also active on this page";
            banner.style.display = "inline-flex";
          } else {
            banner.style.display = "none";
          }
        }
      } catch (e) {}
    }

    window.addEventListener("pagehide", sendPresenceUnload);
    window.addEventListener("beforeunload", function(e) {
      sendPresenceUnload();
      if (ptDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved project types.";
      }
    });
    document.addEventListener("visibilitychange", function() {
      if (document.visibilityState === "hidden") {
        sendPresenceUnload();
      } else if (document.visibilityState === "visible") {
        checkActivePresence();
      }
    });

    function updateCount() {
      var totalCount = existingProjectTypes.length + projectTypes.length;
      if (ptCountEl) ptCountEl.textContent = totalCount;
      if (existingPtCountEl) existingPtCountEl.textContent = existingProjectTypes.length;
      try {
        localStorage.setItem("driven_project_type_count", String(totalCount));
      } catch (e) {}
    }

    function doPrintProjectTypes(defaultSelection) {
      var selId = defaultSelection === 'session' ? 'printTableSelectSession' : 'printTableSelectExisting';
      var mode = document.getElementById(selId).value;
      
      document.body.classList.remove('print-session-only', 'print-existing-only', 'print-both');
      
      if (mode === 'session') {
        document.body.classList.add('print-session-only');
      } else if (mode === 'existing') {
        document.body.classList.add('print-existing-only');
      } else {
        document.body.classList.add('print-both');
      }

      var origSessionSize = sessionPageSize;
      var origExistingSize = existingPageSize;
      sessionPageSize = 9999;
      existingPageSize = 9999;
      renderTable();
      renderExistingTable();

      var origTitle = document.title;
      document.title = customerOrgName + " | Project Type Directory";

      window.print();

      document.title = origTitle;
      document.body.classList.remove('print-session-only', 'print-existing-only', 'print-both');
      sessionPageSize = origSessionSize;
      existingPageSize = origExistingSize;
      renderTable();
      renderExistingTable();
    }
    window.doPrintProjectTypes = doPrintProjectTypes;

    async function loadExistingProjectTypes() {
      existingPtTableContainer.textContent = "";

      if (navigator.onLine) {
        try {
          var resp = await fetch("/api/project-types", {
            headers: { "x-org-id": activeOrgId || "" }
          });
          if (resp.ok) {
            var data = await resp.json();
            var rawList = data.projectTypes || data.records || data.data || (Array.isArray(data) ? data : []);
            existingProjectTypes = rawList.map(function(item) {
              return {
                name: normalizeName(item.name || item.project_type_name || item.projectTypeName || item)
              };
            });
            localStorage.setItem("driven_project_types", JSON.stringify(existingProjectTypes));
            renderExistingTable();
            updateCount();
            return;
          }
        } catch (e) {
          console.warn("API load for existing project types failed, fallback to local storage:", e.message);
        }
      }

      var cached = JSON.parse(localStorage.getItem("driven_project_types") || "[]");
      existingProjectTypes = cached.map(function(item) {
        return {
          name: normalizeName(item.name || item.project_type_name || item.projectTypeName || item)
        };
      });
      renderExistingTable();
      updateCount();
    }

    function renderExistingTable() {
      existingPtTableContainer.textContent = "";
      if (existingProjectTypes.length === 0) {
        var empty = document.createElement("p");
        empty.className = "pt-empty";
        empty.textContent = "No existing project types in the system yet.";
        existingPtTableContainer.appendChild(empty);
        return;
      }

      var sorted = existingProjectTypes.slice().sort(function(a, b) {
        var va = (a[existingSortCol] || '').toString().toLowerCase();
        var vb = (b[existingSortCol] || '').toString().toLowerCase();
        if (va < vb) return existingSortAsc ? -1 : 1;
        if (va > vb) return existingSortAsc ? 1 : -1;
        return 0;
      });

      var totalPages = Math.ceil(sorted.length / existingPageSize) || 1;
      if (existingPage > totalPages) existingPage = totalPages;
      var start = (existingPage - 1) * existingPageSize;
      var paged = sorted.slice(start, start + existingPageSize);

      var wrap = document.createElement("div"); wrap.className = "pt-table-wrap";
      var table = document.createElement("table"); table.className = "pt-table";
      var thead = document.createElement("thead"); var headRow = document.createElement("tr");

      var cols = [
        { label: "Project Type Name " + (existingSortCol === 'name' ? (existingSortAsc ? '▲' : '▼') : ''), key: "name" }
      ];

      cols.forEach(function(c) {
        var th = document.createElement("th");
        th.textContent = c.label;
        if (c.key) {
          th.onclick = function() {
            if (existingSortCol === c.key) existingSortAsc = !existingSortAsc;
            else { existingSortCol = c.key; existingSortAsc = true; }
            renderExistingTable();
          };
        }
        headRow.appendChild(th);
      });
      thead.appendChild(headRow); table.appendChild(thead);

      var tbody = document.createElement("tbody");
      paged.forEach(function(pt) {
        var row = document.createElement("tr");
        var cell = document.createElement("td");
        cell.textContent = (pt.name && pt.name !== "undefined" && pt.name !== "null") ? pt.name : "—";
        row.appendChild(cell);
        tbody.appendChild(row);
      });
      table.appendChild(tbody); wrap.appendChild(table);

      var pBar = document.createElement("div"); pBar.className = "um-pagination-bar";
      var pInfo = document.createElement("div");
      pInfo.textContent = "Showing " + (start + 1) + " - " + Math.min(start + existingPageSize, sorted.length) + " of " + sorted.length;
      
      var pCtrl = document.createElement("div"); pCtrl.className = "um-pagination-controls";
      var pSelect = document.createElement("select");
      [10, 25, 50].forEach(function(sz) {
        var opt = document.createElement("option"); opt.value = sz; opt.textContent = sz + " per page";
        if (sz === existingPageSize) opt.selected = true;
        pSelect.appendChild(opt);
      });
      pSelect.onchange = function() { existingPageSize = parseInt(this.value); existingPage = 1; renderExistingTable(); };

      var btnPrev = document.createElement("button"); btnPrev.className = "um-pagination-btn"; btnPrev.textContent = "◄ Prev";
      btnPrev.disabled = existingPage === 1;
      btnPrev.onclick = function() { existingPage--; renderExistingTable(); };

      var btnNext = document.createElement("button"); btnNext.className = "um-pagination-btn"; btnNext.textContent = "Next ►";
      btnNext.disabled = existingPage === totalPages;
      btnNext.onclick = function() { existingPage++; renderExistingTable(); };

      pCtrl.appendChild(pSelect); pCtrl.appendChild(btnPrev); pCtrl.appendChild(btnNext);
      pBar.appendChild(pInfo); pBar.appendChild(pCtrl);

      existingPtTableContainer.appendChild(wrap);
      existingPtTableContainer.appendChild(pBar);

      if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
    }

    function renderTable() {
      ptTableContainer.textContent = "";
      if (projectTypes.length === 0) { 
        var empty = document.createElement("p"); 
        empty.className = "pt-empty"; 
        empty.textContent = "No new project types added in this session yet."; 
        ptTableContainer.appendChild(empty); 
        return; 
      }

      var sorted = projectTypes.slice().sort(function(a, b) {
        var va = (a[sessionSortCol] || '').toString().toLowerCase();
        var vb = (b[sessionSortCol] || '').toString().toLowerCase();
        if (va < vb) return sessionSortAsc ? -1 : 1;
        if (va > vb) return sessionSortAsc ? 1 : -1;
        return 0;
      });

      var totalPages = Math.ceil(sorted.length / sessionPageSize) || 1;
      if (sessionPage > totalPages) sessionPage = totalPages;
      var start = (sessionPage - 1) * sessionPageSize;
      var paged = sorted.slice(start, start + sessionPageSize);

      var wrap = document.createElement("div"); wrap.className = "pt-table-wrap";
      var table = document.createElement("table"); table.className = "pt-table";
      var thead = document.createElement("thead"); var headRow = document.createElement("tr");

      var cols = [
        { label: "Project Type Name " + (sessionSortCol === 'name' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "name" },
        { label: "Action", key: "" }
      ];

      cols.forEach(function(c) {
        var th = document.createElement("th");
        th.textContent = c.label;
        if (c.label === "Action") th.className = "pt-actions-col";
        if (c.key) {
          th.onclick = function() {
            if (sessionSortCol === c.key) sessionSortAsc = !sessionSortAsc;
            else { sessionSortCol = c.key; sessionSortAsc = true; }
            renderTable();
          };
        }
        headRow.appendChild(th);
      });
      thead.appendChild(headRow); table.appendChild(thead);

      var tbody = document.createElement("tbody");
      paged.forEach(function(pt, index) {
        var row = document.createElement("tr");
        var cellName = document.createElement("td"); 
        cellName.textContent = pt.name || "—"; 
        row.appendChild(cellName);

        var cellAction = document.createElement("td"); 
        cellAction.className = "pt-actions-col"; 
        var btn = document.createElement("button");
        btn.className = "pt-btn-secondary"; 
        btn.style.cssText = "padding:4px 10px;font-size:12px;height:auto;"; 
        btn.textContent = "Remove";
        btn.addEventListener("click", function() { removeProjectType(start + index); }); 
        cellAction.appendChild(btn); 
        row.appendChild(cellAction); 
        tbody.appendChild(row);
      });
      table.appendChild(tbody); wrap.appendChild(table);

      var pBar = document.createElement("div"); pBar.className = "um-pagination-bar";
      var pInfo = document.createElement("div");
      pInfo.textContent = "Showing " + (start + 1) + " - " + Math.min(start + sessionPageSize, sorted.length) + " of " + sorted.length;
      
      var pCtrl = document.createElement("div"); pCtrl.className = "um-pagination-controls";
      var pSelect = document.createElement("select");
      [10, 25, 50].forEach(function(sz) {
        var opt = document.createElement("option"); opt.value = sz; opt.textContent = sz + " per page";
        if (sz === sessionPageSize) opt.selected = true;
        pSelect.appendChild(opt);
      });
      pSelect.onchange = function() { sessionPageSize = parseInt(this.value); sessionPage = 1; renderTable(); };

      var btnPrev = document.createElement("button"); btnPrev.className = "um-pagination-btn"; btnPrev.textContent = "◄ Prev";
      btnPrev.disabled = sessionPage === 1;
      btnPrev.onclick = function() { sessionPage--; renderTable(); };

      var btnNext = document.createElement("button"); btnNext.className = "um-pagination-btn"; btnNext.textContent = "Next ►";
      btnNext.disabled = sessionPage === totalPages;
      btnNext.onclick = function() { sessionPage++; renderTable(); };

      pCtrl.appendChild(pSelect); pCtrl.appendChild(btnPrev); pCtrl.appendChild(btnNext);
      pBar.appendChild(pInfo); pBar.appendChild(pCtrl);

      ptTableContainer.appendChild(wrap);
      ptTableContainer.appendChild(pBar);

      if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
    }

    function removeProjectType(index) { projectTypes.splice(index, 1); renderTable(); updateCount(); ptSuccess.textContent = ""; ptError.textContent = ""; ptDirty = true; }

    window.switchTab = function(tab) {
      var tabSingle = document.getElementById("tabSingle"); var tabBulk = document.getElementById("tabBulk");
      var contentSingle = document.getElementById("tabContentSingle"); var contentBulk = document.getElementById("tabContentBulk");
      if (tab === "single") { tabSingle.classList.add("active"); tabBulk.classList.remove("active"); contentSingle.style.display = "block"; contentBulk.style.display = "none"; }
      else { tabBulk.classList.add("active"); tabSingle.classList.remove("active"); contentBulk.style.display = "block"; contentSingle.style.display = "none"; }
    };

    window.confirmLeave = function() { if (ptDirty) { return confirm("You have unsaved project types. Click OK to leave without saving, or Cancel to stay and save them."); } return true; };
    window.confirmLogout = function() { if (ptDirty) { if (!confirm("You have unsaved project types. Click OK to log out without saving, or Cancel to stay and save them.")) return; } dashLogout(); };

    document.getElementById("btnAddPt").addEventListener("click", function() {
      if (!validateOrgContext()) return;
      ptError.textContent = ""; ptSuccess.textContent = "";
      var name = normalizeName(document.getElementById("ptName").value);

      if (!name) { ptError.textContent = "Project Type Name is required."; return; }

      var checkName = name.toLowerCase().trim();
      var nameMatch = existingProjectTypes.some(function(pt) { 
        return (pt.name || "").toLowerCase().trim() === checkName; 
      }) || projectTypes.some(function(pt) { 
        return (pt.name || "").toLowerCase().trim() === checkName; 
      });

      if (nameMatch) {
        var confirmAdd = confirm("⚠️ A project type named '" + name + "' already exists in the system or current batch.\n\nWould you like to differentiate the name or proceed anyway?");
        if (!confirmAdd) return;
      }

      projectTypes.push({ name: name, customerId: localStorage.getItem("driven_customer_id") || "" });
      renderTable(); updateCount();
      document.getElementById("ptName").value = ""; 
      document.getElementById("ptName").focus();
      ptSuccess.textContent = "Project type added to current batch. Click Save & Continue when finished.";
      ptDirty = true;
    });

    document.getElementById("ptName").addEventListener("keydown", function(e) { 
      if (e.key === "Enter") { e.preventDefault(); document.getElementById("btnAddPt").click(); } 
    });

    document.getElementById("btnProcessBulk").addEventListener("click", function() {
      if (!validateOrgContext()) return;
      statusBulk.textContent = ""; statusBulk.className = "pt-error";
      var file = document.getElementById("bulkFile").files[0];
      if (!file) { statusBulk.textContent = "Please select an Excel or CSV file."; return; }
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var rows; var isCsv = file.name.toLowerCase().endsWith(".csv");
          if (isCsv) {
            var text = e.target.result; var lines = text.split(/\r?\n/).filter(function(l) { return l.trim() !== ""; });
            if (lines.length < 2) { statusBulk.textContent = "The CSV file is empty or has no data rows."; return; }
            var headers = parseCsvLine(lines[0]);
            rows = lines.slice(1).map(function(line) { var values = parseCsvLine(line); var obj = {}; headers.forEach(function(h, i) { obj[h] = values[i] || ""; }); return obj; });
          } else {
            var workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
            var sheet = workbook.Sheets[workbook.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(sheet);
          }
          if (rows.length === 0) { statusBulk.textContent = "The file is empty."; return; }

          var requiredName = "Project Type Name";
          var header = Object.keys(rows[0]);
          if (header.indexOf(requiredName) === -1) { statusBulk.textContent = "Missing required column: " + requiredName; return; }

          for (var r = 0; r < rows.length; r++) {
            if (!rows[r][requiredName] || String(rows[r][requiredName]).trim() === "") { statusBulk.textContent = "Row " + (r + 2) + ": Project Type Name is required."; return; }
          }

          var seenNames = {};
          for (var d = 0; d < rows.length; d++) {
            var nm = normalizeName(rows[d][requiredName]).toLowerCase();
            if (seenNames[nm]) { statusBulk.textContent = "Duplicate project type name: " + nm + " (rows " + seenNames[nm] + " and " + (d + 2) + ")."; return; }
            seenNames[nm] = (d + 2);
          }

          var bulkProjectTypes = rows.map(function(row) {
            return { name: normalizeName(row[requiredName]), customerId: localStorage.getItem("driven_customer_id") || "" };
          });

          bulkPreview.textContent = ""; 
          var pTable = document.createElement("table"); 
          var pThead = document.createElement("thead"); 
          var pHeadRow = document.createElement("tr");
          var pTh = document.createElement("th"); pTh.textContent = "Project Type Name"; pHeadRow.appendChild(pTh);
          pThead.appendChild(pHeadRow); pTable.appendChild(pThead); 

          var pTbody = document.createElement("tbody");
          bulkProjectTypes.forEach(function(pt) { 
            var pRow = document.createElement("tr"); 
            var pCell = document.createElement("td"); pCell.textContent = pt.name; pRow.appendChild(pCell); 
            pTbody.appendChild(pRow); 
          });
          pTable.appendChild(pTbody); bulkPreview.appendChild(pTable);

          projectTypes = projectTypes.concat(bulkProjectTypes); 
          renderTable(); updateCount();
          statusBulk.textContent = "Uploaded " + bulkProjectTypes.length + " project types. Review above and click Save & Continue."; 
          statusBulk.className = "pt-success"; 
          ptDirty = true;
        } catch(parseErr) {
          statusBulk.textContent = "Could not parse the file. Make sure it is a valid Excel (.xlsx) or CSV file with a 'Project Type Name' column.";
          statusBulk.className = "pt-error";
          if (window.DRIVENErrorHandler) { window.DRIVENErrorHandler.report("project-types.html: bulk upload parse failed — " + (parseErr.message || parseErr), "bulk-upload-parse", parseErr && parseErr.stack ? parseErr.stack : null); }
        }
      };
      if (file.name.toLowerCase().endsWith(".csv")) { reader.readAsText(file); } else { reader.readAsArrayBuffer(file); }
    });

    document.getElementById("btnSavePt").addEventListener("click", async function() {
      if (!validateOrgContext()) return;
      ptStepStatus.textContent = ""; ptStepStatus.style.color = "var(--error)";

      if (!navigator.onLine) {
        ptStepStatus.textContent = "Network Error: You must be connected to the internet to save project type data to Cloudflare D1.";
        return;
      }

      if (projectTypes.length === 0 && existingProjectTypes.length === 0) { 
        ptStepStatus.textContent = "You must add at least one project type."; 
        return; 
      }
      
      var allProjectTypes = existingProjectTypes.concat(projectTypes);
      try {
        localStorage.setItem("driven_project_types", JSON.stringify(allProjectTypes));
        localStorage.setItem("driven_project_type_count", String(allProjectTypes.length));
      } catch(lsErr) {
        console.warn("localStorage save failed:", lsErr.message);
        if (window.DRIVENErrorHandler) { 
          window.DRIVENErrorHandler.report("project-types.html: localStorage save failed — " + (lsErr.message || lsErr), "save-localStorage", lsErr && lsErr.stack ? lsErr.stack : null); 
        }
      }

      var btnSave = document.getElementById("btnSavePt");
      btnSave.disabled = true; 
      btnSave.textContent = "Saving to Database...";

      var saveErrors = [];
      for (var i = 0; i < projectTypes.length; i++) {
        var ptItem = projectTypes[i];
        try {
          var d1Res = await fetch("/api/project-types", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-org-id": activeOrgId || ""
            },
            body: JSON.stringify({
              name: ptItem.name,
              status: "Active"
            })
          });
          if (!d1Res.ok) {
            var errJson = await d1Res.json().catch(function() { return {}; });
            saveErrors.push(ptItem.name + ": " + (errJson.error || "D1 insert failed"));
          }
        } catch (d1Err) {
          saveErrors.push(ptItem.name + ": " + d1Err.message);
        }
      }

      if (saveErrors.length > 0) {
        ptStepStatus.style.color = "var(--error)";
        ptStepStatus.textContent = "Save failed: " + saveErrors.join("; ");
        btnSave.disabled = false; 
        btnSave.textContent = "Save & Continue";
        return;
      }

      try {
        var res = await fetch("/auth/save-settings", { 
          method: "POST", 
          headers: { 
            "Content-Type": "application/json",
            "x-org-id": activeOrgId || ""
          }, 
          body: JSON.stringify({ settings: { projectTypes: allProjectTypes } }) 
        });
        var data = await res.json().catch(function() { return {}; });
        if (!res.ok) {
          if (res.status < 500 && window.DRIVENErrorHandler) { 
            window.DRIVENErrorHandler.report("project-types.html: save-settings returned " + res.status + " — " + (data.error || "Request failed"), "save-settings-" + res.status, "URL: /auth/save-settings | Project Types: " + allProjectTypes.length); 
          }
          throw new Error(data.error || "Save settings failed");
        }
        ptStepStatus.style.color = "var(--success)";
        ptStepStatus.textContent = projectTypes.length + " project type(s) saved to D1. Total project types: " + allProjectTypes.length + ". Redirecting to onboarding dashboard…";
        btnSave.textContent = "Saved ✓"; 
        ptDirty = false;
        projectTypes = [];
        await loadExistingProjectTypes();
        renderTable(); 
        updateCount();
        setTimeout(function() { 
          btnSave.disabled = false; 
          btnSave.textContent = "Save & Continue"; 
          window.location.href = "/app/dashboard/onboarding-dashboard.html"; 
        }, 1500);
      } catch(err) {
        ptStepStatus.style.color = "var(--error)";
        ptStepStatus.textContent = "Server save failed: " + err.message;
        btnSave.disabled = false; 
        btnSave.textContent = "Save & Continue";
        if (window.DRIVENErrorHandler) { 
          window.DRIVENErrorHandler.report("project-types.html: save failed — " + (err.message || err), "save-settings-catch", err && err.stack ? err.stack : null); 
        }
      }
    });

    function downloadProjectTypeTemplate() {
      var ws = XLSX.utils.aoa_to_sheet([["Project Type Name"]]);
      ws["!cols"] = [{ wch: 60 }];
      downloadXlsxWithFrozenHeader(ws, "ProjectTypes", "Project-Type-Mass-Upload-v1.0.xlsx");
    }
    window.downloadProjectTypeTemplate = downloadProjectTypeTemplate;

    function parseCsvLine(line) {
      var result = []; var current = ""; var inQuotes = false;
      for (var i = 0; i < line.length; i++) { var ch = line[i]; if (inQuotes) { if (ch === '"') { if (line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; } } else { current += ch; } } else { if (ch === '"') { inQuotes = true; } else if (ch === ",") { result.push(current.trim()); current = ""; } else { current += ch; } } }
      result.push(current.trim()); return result;
    }

    document.addEventListener("dashSessionLoaded", function(e) {
      var userObj = JSON.parse(localStorage.getItem("driven_user") || "{}");
      activeOrgId = userObj.org_id || (e.detail && e.detail.org_id) || localStorage.getItem("driven_org_id");
      customerOrgName = (e.detail && e.detail.org_name) || localStorage.getItem("driven_org_name") || "DRIV-EN Org";

      var row1 = document.querySelector(".dash-header-row1");
      if (row1 && !document.querySelector(".pt-header-title")) { 
        var title = document.createElement("div"); 
        title.className = "pt-header-title"; 
        title.textContent = "Onboarding — Project Types"; 
        var logoArea = document.getElementById("dashCustomerLogoArea"); 
        var drivenLogo = row1.querySelector(".dash-driven-logo"); 
        if (logoArea && drivenLogo) { row1.insertBefore(title, drivenLogo); } 
      }

      loadExistingProjectTypes(); 
      renderTable(); 
      updateCount();

      checkActivePresence();
      setInterval(checkActivePresence, 5000);
    });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function() {
        var yEl = document.getElementById("dashFooterYear");
        if (yEl) yEl.textContent = new Date().getFullYear();
      });
    } else {
      var yEl = document.getElementById("dashFooterYear");
      if (yEl) yEl.textContent = new Date().getFullYear();
    }
