/* ==========================================================================
   DRIV-EN Platform — Onboarding: Projects JavaScript (v1)
   File: /app/onboarding/projects.js
   Extracted from projects.html for CSP compliance (no inline scripts).
   Fixed: missing `if` guard in dashSessionLoaded title creation.
   ========================================================================== */

    var projects = [];
    var existingProjects = [];
    var prjDirty = false;
    var activeOrgId = null;
    var customerOrgName = "DRIV-EN Org";

    var sessionPageSize = 10, sessionPage = 1, sessionSortCol = 'name', sessionSortAsc = true;
    var existingPageSize = 10, existingPage = 1, existingSortCol = 'name', existingSortAsc = true;

    var prjError = document.getElementById("prjError");
    var prjSuccess = document.getElementById("prjSuccess");
    var prjTableContainer = document.getElementById("prjTableContainer");
    var existingPrjTableContainer = document.getElementById("existingPrjTableContainer");
    var prjStepStatus = document.getElementById("prjStepStatus");
    var prjCountEl = document.getElementById("prjCount");
    var existingPrjCountEl = document.getElementById("existingPrjCount");
    var statusBulk = document.getElementById("statusBulk");
    var bulkPreview = document.getElementById("bulkPreview");

    function normalizeName(str) { 
      if (typeof str === 'object' && str !== null) {
        str = str.name || str.project_name || str.projectName || str["Project Name"] || "";
      }
      return String(str || "").trim().replace(/\s+/g, " "); 
    }
    
    function validateOrgContext() {
      if (!activeOrgId || activeOrgId === "default_org" || activeOrgId === "null") {
        if (prjError) prjError.textContent = "Security Alert: Invalid Organization Context. Action rejected.";
        return false;
      }
      return true;
    }

    function sendPresenceUnload() {
      if (!activeOrgId) return;
      var payload = JSON.stringify({ page: "Projects", action: "leave" });
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
          body: JSON.stringify({ page: "Projects" })
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
      if (prjDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved projects.";
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
      var totalCount = existingProjects.length + projects.length;
      if (prjCountEl) prjCountEl.textContent = totalCount;
      if (existingPrjCountEl) existingPrjCountEl.textContent = existingProjects.length;
      try {
        localStorage.setItem("driven_project_count", String(totalCount));
      } catch (e) {}
    }

    function checkPrerequisites() {
      var clients = JSON.parse(localStorage.getItem("driven_clients") || "[]");
      var clientsDone = clients.length > 0;
      var prereqBanner = document.getElementById("prereqBanner");

      if (!clientsDone) {
        if (prereqBanner) prereqBanner.style.display = "block";
      } else {
        if (prereqBanner) prereqBanner.style.display = "none";
      }
    }

    function loadClientDropdown() {
      var sel = document.getElementById("prjClient");
      if (!sel) return;
      sel.innerHTML = '<option value="" data-i18n>— None —</option>';
      var clients = JSON.parse(localStorage.getItem("driven_clients") || "[]");
      clients.forEach(function(c) {
        var opt = document.createElement("option");
        var val = normalizeName(c.name || c.client_name || c);
        if (val) {
          opt.value = val;
          opt.textContent = val;
          sel.appendChild(opt);
        }
      });
    }

    function loadDivisionDropdown() {
      var sel = document.getElementById("prjDivision");
      if (!sel) return;
      sel.innerHTML = '<option value="" data-i18n>— None —</option>';
      var divisions = JSON.parse(localStorage.getItem("driven_divisions") || "[]");
      divisions.forEach(function(d) {
        var opt = document.createElement("option");
        var val = normalizeName(d.name || d.division_name || d);
        if (val) {
          opt.value = val;
          opt.textContent = val;
          sel.appendChild(opt);
        }
      });
    }

    function doPrintProjects(defaultSelection) {
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
      document.title = customerOrgName + " | Project Directory";

      window.print();

      document.title = origTitle;
      document.body.classList.remove('print-session-only', 'print-existing-only', 'print-both');
      sessionPageSize = origSessionSize;
      existingPageSize = origExistingSize;
      renderTable();
      renderExistingTable();
    }
    window.doPrintProjects = doPrintProjects;

    async function loadExistingProjects() {
      existingPrjTableContainer.textContent = "";

      if (navigator.onLine) {
        try {
          var resp = await fetch("/api/project", {
            headers: { "x-org-id": activeOrgId || "" }
          });
          if (resp.ok) {
            var data = await resp.json();
            var rawList = data.records || data.projects || data.data || (Array.isArray(data) ? data : []);
            existingProjects = rawList.map(function(item) {
              var rec = item.fields ? Object.assign({ id: item.id }, item.fields) : item;
              return {
                id: rec.id || "",
                number: normalizeName(rec.code || rec.number || rec.project_number || rec.projectNumber || rec["Project Code"] || ""),
                name: normalizeName(rec.name || rec.project_name || rec.projectName || rec["Project Name"] || rec),
                client: normalizeName(rec.client || rec.client_name || rec.Client || ""),
                division: normalizeName(rec.division || rec.division_name || rec.Division || "")
              };
            });
            localStorage.setItem("driven_projects", JSON.stringify(existingProjects));
            renderExistingTable();
            updateCount();
            return;
          }
        } catch (e) {
          console.warn("API load for existing projects failed, fallback to local storage:", e.message);
        }
      }

      var cached = JSON.parse(localStorage.getItem("driven_projects") || "[]");
      existingProjects = cached.map(function(item) {
        var rec = item.fields ? Object.assign({ id: item.id }, item.fields) : item;
        return {
          id: rec.id || "",
          number: normalizeName(rec.number || rec.code || rec.project_number || rec.projectNumber || rec["Project Code"] || ""),
          name: normalizeName(rec.name || rec.project_name || rec.projectName || rec["Project Name"] || rec),
          client: normalizeName(rec.client || rec.client_name || rec.Client || ""),
          division: normalizeName(rec.division || rec.division_name || rec.Division || "")
        };
      });
      renderExistingTable();
      updateCount();
    }

    function renderExistingTable() {
      existingPrjTableContainer.textContent = "";
      if (existingProjects.length === 0) {
        var empty = document.createElement("p");
        empty.className = "prj-empty";
        empty.textContent = "No existing projects in the system yet.";
        existingPrjTableContainer.appendChild(empty);
        return;
      }

      var sorted = existingProjects.slice().sort(function(a, b) {
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

      var wrap = document.createElement("div"); wrap.className = "prj-table-wrap";
      var table = document.createElement("table"); table.className = "prj-table";
      var thead = document.createElement("thead"); var headRow = document.createElement("tr");

      var cols = [
        { label: "Project # " + (existingSortCol === 'number' ? (existingSortAsc ? '▲' : '▼') : ''), key: "number" },
        { label: "Project Name " + (existingSortCol === 'name' ? (existingSortAsc ? '▲' : '▼') : ''), key: "name" },
        { label: "Client " + (existingSortCol === 'client' ? (existingSortAsc ? '▲' : '▼') : ''), key: "client" },
        { label: "Division " + (existingSortCol === 'division' ? (existingSortAsc ? '▲' : '▼') : ''), key: "division" }
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
      paged.forEach(function(prj) {
        var row = document.createElement("tr");
        [prj.number, prj.name, prj.client, prj.division].forEach(function(val) {
          var cell = document.createElement("td");
          cell.textContent = (val && val !== "undefined" && val !== "null") ? val : "—";
          row.appendChild(cell);
        });
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

      existingPrjTableContainer.appendChild(wrap);
      existingPrjTableContainer.appendChild(pBar);

      if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
    }

    function renderTable() {
      prjTableContainer.textContent = "";
      if (projects.length === 0) { 
        var empty = document.createElement("p"); 
        empty.className = "prj-empty"; 
        empty.textContent = "No new projects added in this session yet."; 
        prjTableContainer.appendChild(empty); 
        return; 
      }

      var sorted = projects.slice().sort(function(a, b) {
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

      var wrap = document.createElement("div"); wrap.className = "prj-table-wrap";
      var table = document.createElement("table"); table.className = "prj-table";
      var thead = document.createElement("thead"); var headRow = document.createElement("tr");

      var cols = [
        { label: "Project # " + (sessionSortCol === 'number' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "number" },
        { label: "Project Name " + (sessionSortCol === 'name' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "name" },
        { label: "Client " + (sessionSortCol === 'client' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "client" },
        { label: "Division " + (sessionSortCol === 'division' ? (sessionSortAsc ? '▲' : '▼') : ''), key: "division" },
        { label: "Action", key: "" }
      ];

      cols.forEach(function(c) {
        var th = document.createElement("th");
        th.textContent = c.label;
        if (c.label === "Action") th.className = "prj-actions-col";
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
      paged.forEach(function(prj, index) {
        var row = document.createElement("tr");
        [prj.number, prj.name, prj.client, prj.division].forEach(function(val) { 
          var cell = document.createElement("td"); 
          cell.textContent = val || "—"; 
          row.appendChild(cell); 
        });

        var cellAction = document.createElement("td"); 
        cellAction.className = "prj-actions-col"; 
        var btn = document.createElement("button");
        btn.className = "prj-btn-secondary"; 
        btn.style.cssText = "padding:4px 10px;font-size:12px;height:auto;"; 
        btn.textContent = "Remove";
        btn.addEventListener("click", function() { removeProject(start + index); }); 
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

      prjTableContainer.appendChild(wrap);
      prjTableContainer.appendChild(pBar);

      if (window.attachDragAndDropHeaders) window.attachDragAndDropHeaders(table);
    }

    function removeProject(index) { projects.splice(index, 1); renderTable(); updateCount(); prjSuccess.textContent = ""; prjError.textContent = ""; prjDirty = true; }

    window.switchTab = function(tab) {
      var tabSingle = document.getElementById("tabSingle"); var tabBulk = document.getElementById("tabBulk");
      var contentSingle = document.getElementById("tabContentSingle"); var contentBulk = document.getElementById("tabContentBulk");
      if (tab === "single") { tabSingle.classList.add("active"); tabBulk.classList.remove("active"); contentSingle.style.display = "block"; contentBulk.style.display = "none"; }
      else { tabBulk.classList.add("active"); tabSingle.classList.remove("active"); contentBulk.style.display = "block"; contentSingle.style.display = "none"; }
    };

    window.confirmLeave = function() { if (prjDirty) { return confirm("You have unsaved projects. Click OK to leave without saving, or Cancel to stay and save them."); } return true; };
    window.confirmLogout = function() { if (prjDirty) { if (!confirm("You have unsaved projects. Click OK to log out without saving, or Cancel to stay and save them.")) return; } dashLogout(); };

    document.getElementById("btnAddPrj").addEventListener("click", function() {
      if (!validateOrgContext()) return;
      prjError.textContent = ""; prjSuccess.textContent = "";
      var number = normalizeName(document.getElementById("prjNumber").value);
      var name = normalizeName(document.getElementById("prjName").value);
      var client = document.getElementById("prjClient").value;
      var division = document.getElementById("prjDivision").value;

      if (!name) { prjError.textContent = "Project Name is required."; return; }

      var checkName = name.toLowerCase().trim();
      var nameMatch = existingProjects.some(function(p) { 
        return (p.name || "").toLowerCase().trim() === checkName; 
      }) || projects.some(function(p) { 
        return (p.name || "").toLowerCase().trim() === checkName; 
      });

      if (nameMatch) {
        var confirmAdd = confirm("⚠️ A project named '" + name + "' already exists in the system or current batch.\n\nWould you like to add a phase or region code to differentiate it, or proceed anyway?");
        if (!confirmAdd) return;
      }

      projects.push({ number: number, name: name, client: client, division: division, customerId: localStorage.getItem("driven_customer_id") || "" });
      renderTable(); updateCount();
      document.getElementById("prjNumber").value = ""; 
      document.getElementById("prjName").value = ""; 
      document.getElementById("prjClient").value = "";
      document.getElementById("prjDivision").value = "";
      document.getElementById("prjName").focus();
      prjSuccess.textContent = "Project added to current batch. Click Save & Continue when finished.";
      prjDirty = true;
    });

    document.getElementById("prjName").addEventListener("keydown", function(e) { 
      if (e.key === "Enter") { e.preventDefault(); document.getElementById("btnAddPrj").click(); } 
    });

    document.getElementById("btnProcessBulk").addEventListener("click", function() {
      if (!validateOrgContext()) return;
      statusBulk.textContent = ""; statusBulk.className = "prj-error";
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

          var requiredName = "Project Name";
          var header = Object.keys(rows[0]);
          if (header.indexOf(requiredName) === -1) { statusBulk.textContent = "Missing required column: " + requiredName; return; }

          for (var r = 0; r < rows.length; r++) {
            if (!rows[r][requiredName] || String(rows[r][requiredName]).trim() === "") { statusBulk.textContent = "Row " + (r + 2) + ": Project Name is required."; return; }
          }

          var seenNames = {};
          for (var d = 0; d < rows.length; d++) {
            var nm = normalizeName(rows[d][requiredName]).toLowerCase();
            if (seenNames[nm]) { statusBulk.textContent = "Duplicate project name: " + nm + " (rows " + seenNames[nm] + " and " + (d + 2) + ")."; return; }
            seenNames[nm] = (d + 2);
          }

          var bulkProjects = rows.map(function(row) {
            return { 
              number: normalizeName(row["Project #"] || row["Project Number"] || row["Project ID"] || ""), 
              name: normalizeName(row[requiredName]), 
              client: normalizeName(row["Client"] || ""), 
              division: normalizeName(row["Division"] || ""), 
              customerId: localStorage.getItem("driven_customer_id") || "" 
            };
          });

          bulkPreview.textContent = ""; 
          var pTable = document.createElement("table"); 
          var pThead = document.createElement("thead"); 
          var pHeadRow = document.createElement("tr");
          ["Project #", "Project Name", "Client", "Division"].forEach(function(h) { var pTh = document.createElement("th"); pTh.textContent = h; pHeadRow.appendChild(pTh); });
          pThead.appendChild(pHeadRow); pTable.appendChild(pThead); 

          var pTbody = document.createElement("tbody");
          bulkProjects.forEach(function(p) { 
            var pRow = document.createElement("tr"); 
            var pCell1 = document.createElement("td"); pCell1.textContent = p.number || "—"; pRow.appendChild(pCell1); 
            var pCell2 = document.createElement("td"); pCell2.textContent = p.name; pRow.appendChild(pCell2); 
            var pCell3 = document.createElement("td"); pCell3.textContent = p.client || "—"; pRow.appendChild(pCell3); 
            var pCell4 = document.createElement("td"); pCell4.textContent = p.division || "—"; pRow.appendChild(pCell4); 
            pTbody.appendChild(pRow); 
          });
          pTable.appendChild(pTbody); bulkPreview.appendChild(pTable);

          projects = projects.concat(bulkProjects); 
          renderTable(); updateCount();
          statusBulk.textContent = "Uploaded " + bulkProjects.length + " projects. Review above and click Save & Continue."; 
          statusBulk.className = "prj-success"; 
          prjDirty = true;
        } catch(parseErr) {
          statusBulk.textContent = "Could not parse the file. Make sure it is a valid Excel (.xlsx) or CSV file with a 'Project Name' column.";
          statusBulk.className = "prj-error";
          if (window.DRIVENErrorHandler) { window.DRIVENErrorHandler.report("projects.html: bulk upload parse failed — " + (parseErr.message || parseErr), "bulk-upload-parse", parseErr && parseErr.stack ? parseErr.stack : null); }
        }
      };
      if (file.name.toLowerCase().endsWith(".csv")) { reader.readAsText(file); } else { reader.readAsArrayBuffer(file); }
    });

    document.getElementById("btnSavePrj").addEventListener("click", async function() {
      if (!validateOrgContext()) return;
      prjStepStatus.textContent = ""; prjStepStatus.style.color = "var(--error)";

      if (!navigator.onLine) {
        prjStepStatus.textContent = "Network Error: You must be connected to the internet to save project data to Cloudflare D1.";
        return;
      }

      if (projects.length === 0 && existingProjects.length === 0) { 
        prjStepStatus.textContent = "You must add at least one project."; 
        return; 
      }
      
      var btnSave = document.getElementById("btnSavePrj");
      btnSave.disabled = true; 
      btnSave.textContent = "Saving to Database...";

      try {
        var saveErrors = [];
        for (var i = 0; i < projects.length; i++) {
          var p = projects[i];
          var payload = {
            "Project Name": p.name,
            "Project Code": p.number,
            "Client": p.client,
            "Division": p.division,
            "Status": "Active"
          };
          var res = await fetch("/api/project", { 
            method: "POST", 
            headers: { 
              "Content-Type": "application/json",
              "x-org-id": activeOrgId || ""
            }, 
            body: JSON.stringify(payload) 
          });
          if (!res.ok) {
            var errData = await res.json().catch(function() { return {}; });
            saveErrors.push(p.name + ": " + (errData.error || errData.message || "Save failed"));
          }
        }

        if (saveErrors.length > 0) {
          throw new Error("Some projects failed to save: " + saveErrors.join("; "));
        }

        var allProjects = existingProjects.concat(projects);
        localStorage.setItem("driven_projects", JSON.stringify(allProjects));
        localStorage.setItem("driven_project_count", String(allProjects.length));

        prjStepStatus.style.color = "var(--success)";
        prjStepStatus.textContent = projects.length + " project(s) saved directly to D1. Total projects: " + allProjects.length + ". Redirecting to onboarding dashboard…";
        btnSave.textContent = "Saved ✓"; 
        prjDirty = false;
        projects = [];
        await loadExistingProjects();
        renderTable(); 
        updateCount();
        setTimeout(function() { 
          btnSave.disabled = false; 
          btnSave.textContent = "Save & Continue"; 
          window.location.href = "/app/dashboard/onboarding-dashboard.html"; 
        }, 1500);
      } catch(err) {
        prjStepStatus.style.color = "var(--error)";
        prjStepStatus.textContent = "Save failed: " + err.message;
        btnSave.disabled = false; 
        btnSave.textContent = "Save & Continue";
        if (window.DRIVENErrorHandler) { 
          window.DRIVENErrorHandler.report("projects.html: save failed — " + (err.message || err), "save-project-catch", err && err.stack ? err.stack : null); 
        }
      }
    });

    function downloadProjectTemplate() {
      var ws = XLSX.utils.aoa_to_sheet([["Project #", "Project Name", "Client", "Division"]]);
      ws["!cols"] = [{ wch: 18 }, { wch: 40 }, { wch: 30 }, { wch: 25 }];
      downloadXlsxWithFrozenHeader(ws, "Projects", "Project-Mass-Upload-v1.0.xlsx");
    }
    window.downloadProjectTemplate = downloadProjectTemplate;

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
      if (row1 && !document.querySelector(".prj-header-title")) {
        var title = document.createElement("div"); 
        title.className = "prj-header-title";
        title.textContent = "Onboarding — Projects"; 
        var logoArea = document.getElementById("dashCustomerLogoArea"); 
        var drivenLogo = row1.querySelector(".dash-driven-logo"); 
        if (logoArea && drivenLogo) { row1.insertBefore(title, drivenLogo); } 
      }

      loadClientDropdown();
      loadDivisionDropdown();
      loadExistingProjects(); 
      renderTable(); 
      updateCount();
      checkPrerequisites();

      checkActivePresence();
      setInterval(checkActivePresence, 5000);
    });

    checkPrerequisites();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function() {
        var yEl = document.getElementById("dashFooterYear");
        if (yEl) yEl.textContent = new Date().getFullYear();
        checkPrerequisites();
      });
    } else {
      var yEl = document.getElementById("dashFooterYear");
      if (yEl) yEl.textContent = new Date().getFullYear();
    }
