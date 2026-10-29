    var allAssets = [], assetTypes = [], projects = [], locations = [], divisions = [], operators = [], editingAssetId = null, canModify = false, amDirty = false, amMapInstance = null, amClusterGroup = null, mapMode = 'forms', breadcrumbLayers = [];
    var adjustMapInstance = null, adjustMarker = null, activeStreetViewAsset = null;

    var COL_DEFS = [
      { key: 'assetNumber', label: 'Asset Number', defaultVisible: true, defaultWidth: '130px' },
      { key: 'type', label: 'Asset Type', defaultVisible: true, defaultWidth: '140px' },
      { key: 'isAttachment', label: 'Is Attachment', defaultVisible: false, defaultWidth: '120px' },
      { key: 'allowedCategory', label: 'Allowed Category', defaultVisible: false, defaultWidth: '140px' },
      { key: 'meter', label: 'Meter Reading', defaultVisible: true, defaultWidth: '120px' },
      { key: 'status', label: 'Status', defaultVisible: true, defaultWidth: '110px' },
      { key: 'project', label: 'Project', defaultVisible: true, defaultWidth: '130px' },
      { key: 'location', label: 'Location', defaultVisible: true, defaultWidth: '130px' },
      { key: 'serialNumber', label: 'Serial Number', defaultVisible: false, defaultWidth: '130px' },
      { key: 'division', label: 'Division', defaultVisible: false, defaultWidth: '120px' },
      { key: 'assignedTo', label: 'Assigned Operator', defaultVisible: false, defaultWidth: '140px' },
      { key: 'condition', label: 'Condition', defaultVisible: false, defaultWidth: '110px' },
      { key: 'createdAt', label: 'Created Date', defaultVisible: false, defaultWidth: '130px' }
    ];
    var sortKey = 'assetNumber', sortDir = 'asc', currentPage = 1, pageSize = 10, visibleCols = {}, colWidths = {};

    function extractRecords(data) {
      if (Array.isArray(data)) return data;
      if (!data || typeof data !== "object") return [];
      return data.projects || data.records || data.users || data.inspections || data.transfers || data.workOrders || data.fuelLogs || data.data || data.results || [];
    }

    function makeTabsSticky() {
      var h = document.getElementById("dashHeader") || document.querySelector(".dash-header");
      var tb = document.getElementById("amTabBar");
      if (h && tb && h.nextElementSibling !== tb) {
        h.parentNode.insertBefore(tb, h.nextSibling);
      }
      updateHeaderOffset();
    }

    function updateHeaderOffset() {
      var h = document.getElementById('dashHeader') || document.querySelector('.dash-header');
      if (h) {
        var hh = h.getBoundingClientRect().height || h.offsetHeight || 60;
        document.documentElement.style.setProperty('--header-height', hh + 'px');
      }
    }
    window.addEventListener('resize', updateHeaderOffset);

    function initVisibleCols() {
      try {
        var s = JSON.parse(localStorage.getItem('driven_am_visible_cols') || '{}');
        COL_DEFS.forEach(function(c) {
          visibleCols[c.key] = (s[c.key] !== undefined) ? s[c.key] : c.defaultVisible;
        });
      } catch (e) {
        COL_DEFS.forEach(function(c) { visibleCols[c.key] = c.defaultVisible; });
      }
      try {
        var w = JSON.parse(localStorage.getItem('driven_am_col_widths') || '{}');
        COL_DEFS.forEach(function(c) {
          colWidths[c.key] = w[c.key] || c.defaultWidth;
        });
      } catch (e) {
        COL_DEFS.forEach(function(c) { colWidths[c.key] = c.defaultWidth; });
      }
    }

    function saveVisibleCols() {
      try { localStorage.setItem('driven_am_visible_cols', JSON.stringify(visibleCols)); } catch (e) {}
    }

    function saveColWidths() {
      try { localStorage.setItem('driven_am_col_widths', JSON.stringify(colWidths)); } catch (e) {}
    }

    document.addEventListener('dashSessionLoaded', async function() {
      makeTabsSticky();
      setTimeout(makeTabsSticky, 300);
      var u = window.dashUser || window.drivenUser;
      if (!u) {
        try { u = JSON.parse(localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user")); } catch(e) {}
      }
      if (!u) {
        window.location.href = '/public/login.html';
        return;
      }
      window.dashUser = u;

      try {
        var r = String(u.role || '').toLowerCase().trim();
        canModify = r.indexOf('admin') !== -1 || r.indexOf('owner') !== -1 || r.indexOf('founder') !== -1;
        var ci = u.customerId || u.customer_id || localStorage.getItem('driven_customer_id');

        if (!canModify && ci) {
          try {
            var kp = await fetch('/api/onboarding/key-personnel/list?customerId=' + encodeURIComponent(ci));
            var kd = await kp.json();
            if (kd.success && kd.keyPersonnel) {
              var me = u.email ? u.email.toLowerCase() : '';
              var mr = kd.keyPersonnel.find(function(k) { return k.email && k.email.toLowerCase() === me; });
              if (mr && mr.roles) {
                var mt = mr.roles.map(function(x) { return x.role; });
                canModify = mt.indexOf('Equipment') !== -1 || mt.indexOf('Assets') !== -1;
              }
            }
          } catch (e) {
            if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report('asset-management.html: KP check failed — ' + (e.message || e), 'kp-permission-check', e && e.stack ? e.stack : null);
          }
        }

        if (!canModify) {
          var addForm = document.getElementById('addAssetForm');
          if (addForm) addForm.style.display = 'none';
        }

        var ha = 0, hi = setInterval(function() {
          ha++;
          if (fixHeaderLayout() || ha > 50) {
            clearInterval(hi);
            updateHeaderOffset();
          }
        }, 100);

        initVisibleCols();
        await Promise.allSettled([syncSettings(), loadProjectsDirect(), loadAssets(), loadActiveOperators()]);
      } catch (err) {
        console.error('Asset initialization error:', err);
      } finally {
        var loader = document.getElementById('amLoading');
        if (loader) loader.style.display = 'none';
      }

      var urlParams = new URLSearchParams(window.location.search);
      var initialTab = urlParams.get('tab') || 'overview';
      var initialKpi = urlParams.get('kpi');
      if (initialKpi) {
        filterByKpi(initialKpi);
      } else {
        switchTab(initialTab);
      }
      updateHeaderOffset();
    });

    async function loadProjectsDirect() {
      try {
        var resp = await fetch('/api/projects');
        if (resp.ok) {
          var data = await resp.json();
          var list = extractRecords(data);
          if (list && list.length > 0) {
            projects = list;
            populateDropdown('amProject', projects, true);
            populateDropdown('amEditProject', projects, true);
            buildMultiSelectPanels();
          }
        }
      } catch (e) {
        console.error('Direct projects fetch failed:', e);
      }
    }

    async function loadActiveOperators() {
      try {
        var u = window.dashUser || window.drivenUser || {};
        var ci = u.customerId || u.customer_id || localStorage.getItem('driven_customer_id');
        if (!ci) return;
        var resp = await fetch('/api/users?customerId=' + encodeURIComponent(ci));
        if (!resp.ok) {
          resp = await fetch('/api/onboarding/key-personnel/list?customerId=' + encodeURIComponent(ci));
        }
        if (resp.ok) {
          var data = await resp.json();
          var rawList = extractRecords(data);
          var names = [];
          rawList.forEach(function(item) {
            var active = (item.status === undefined || item.status === null || String(item.status).toLowerCase() === 'active') && !item.disabled;
            if (!active) return;
            var fname = item.first_name || item.firstName || '';
            var lname = item.last_name || item.lastName || '';
            var fullName = (fname + ' ' + lname).trim();
            if (!fullName) {
              fullName = item.full_name || item.fullName || item.name || item.email || '';
            }
            if (fullName && names.indexOf(fullName) === -1) {
              names.push(fullName);
            }
          });
          names.sort();
          operators = names;
          populateDropdown('amAssignedOperator', operators, true);
          populateDropdown('amEditAssignedOperator', operators, true);
        }
      } catch (e) {
        console.error('Failed to load active operators:', e);
      }
    }

    async function syncSettings() {
      try {
        var res = await fetch('/auth/get-settings');
        if (!res.ok) throw new Error('Settings fetch failed: ' + res.status);
        var data = await res.json();
        var s = (data && data.settings) ? data.settings : {};
        var rat = s.asset_types;
        if (typeof rat === 'string') {
          try { assetTypes = JSON.parse(rat); } catch (e) { assetTypes = []; }
        } else if (Array.isArray(rat)) {
          assetTypes = rat;
        } else {
          try { assetTypes = JSON.parse(localStorage.getItem('driven_asset_types') || '[]'); } catch (e) { assetTypes = []; }
        }
        if (assetTypes.length > 0) try { localStorage.setItem('driven_asset_types', JSON.stringify(assetTypes)); } catch (e) {}

        var rp = s.projects;
        if (typeof rp === 'string') {
          try { projects = JSON.parse(rp); } catch (e) { projects = []; }
        } else if (Array.isArray(rp)) {
          projects = rp;
        } else {
          try { projects = JSON.parse(localStorage.getItem('driven_projects') || '[]'); } catch (e) { projects = []; }
        }
        if (projects.length > 0) try { localStorage.setItem('driven_projects', JSON.stringify(projects)); } catch (e) {}

        var rl = s.locations;
        if (typeof rl === 'string') {
          try { locations = JSON.parse(rl); } catch (e) { locations = []; }
        } else if (Array.isArray(rl)) {
          locations = rl;
        } else {
          try { locations = JSON.parse(localStorage.getItem('driven_locations') || '[]'); } catch (e) { locations = []; }
        }
        if (locations.length > 0) try { localStorage.setItem('driven_locations', JSON.stringify(locations)); } catch (e) {}

        var rd = s.divisions;
        if (typeof rd === 'string') {
          try { divisions = JSON.parse(rd); } catch (e) { divisions = []; }
        } else if (Array.isArray(rd)) {
          divisions = rd;
        } else {
          try { divisions = JSON.parse(localStorage.getItem('driven_divisions') || '[]'); } catch (e) { divisions = []; }
        }
      } catch (e) {
        try { assetTypes = JSON.parse(localStorage.getItem('driven_asset_types') || '[]'); } catch (e2) { assetTypes = []; }
        try { projects = JSON.parse(localStorage.getItem('driven_projects') || '[]'); } catch (e2) { projects = []; }
        try { locations = JSON.parse(localStorage.getItem('driven_locations') || '[]'); } catch (e2) { locations = []; }
        try { divisions = JSON.parse(localStorage.getItem('driven_divisions') || '[]'); } catch (e2) { divisions = []; }
      }
      populateDropdown('amAssetType', assetTypes);
      populateDropdown('amProject', projects, true);
      populateDropdown('amLocation', locations, true);
      populateDropdown('amDivision', divisions, true);
      populateDropdown('amAssignedOperator', operators, true);
      populateDropdown('amEditAssetType', assetTypes);
      populateDropdown('amEditProject', projects, true);
      populateDropdown('amEditLocation', locations, true);
      populateDropdown('amEditDivision', divisions, true);
      populateDropdown('amEditAssignedOperator', operators, true);
      buildMultiSelectPanels();
    }

    function populateDropdown(id, items, includeNone) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var cv = sel.value;
      sel.innerHTML = '';
      if (includeNone) {
        var n = document.createElement('option');
        n.value = '';
        n.textContent = '— None —';
        sel.appendChild(n);
      } else {
        var p = document.createElement('option');
        p.value = '';
        p.textContent = '— Select —';
        sel.appendChild(p);
      }
      items.forEach(function(item) {
        var prjNum = typeof item === 'object' ? (item.project_number || item.code || '') : '';
        var prjName = typeof item === 'object' ? (item.name || item.title || item.project_name || item.division_name || '') : String(item);
        var nameVal = prjNum && prjName ? (prjNum + " — " + prjName) : (prjNum || prjName);
        if (nameVal) {
          var o = document.createElement('option');
          o.value = nameVal;
          o.textContent = nameVal;
          sel.appendChild(o);
        }
      });
      var se = Array.from(sel.options).some(function(o) { return o.value === cv; });
      sel.value = se ? cv : '';
    }

    function buildMultiSelectPanels() {
      var pt = document.getElementById('panelTypes');
      if (pt) {
        pt.innerHTML = '';
        assetTypes.forEach(function(at) {
          var nameVal = typeof at === 'object' ? (at.asset_type_name || at.name || at.title || '') : String(at);
          if (nameVal) {
            var lbl = document.createElement('label');
            lbl.className = 'am-multiselect-option';
            lbl.innerHTML = '<input type="checkbox" value="' + escapeHtml(nameVal) + '" onchange="onFilterChange()"> ' + escapeHtml(nameVal);
            pt.appendChild(lbl);
          }
        });
      }
      var pp = document.getElementById('panelProjects');
      if (pp) {
        pp.innerHTML = '';
        projects.forEach(function(pr) {
          var prjNum = typeof pr === 'object' ? (pr.project_number || pr.code || '') : '';
          var prjName = typeof pr === 'object' ? (pr.name || pr.title || pr.project_name || '') : String(pr);
          var nameVal = prjNum && prjName ? (prjNum + " — " + prjName) : (prjNum || prjName);
          if (nameVal) {
            var lbl = document.createElement('label');
            lbl.className = 'am-multiselect-option';
            lbl.innerHTML = '<input type="checkbox" value="' + escapeHtml(nameVal) + '" onchange="onFilterChange()"> ' + escapeHtml(nameVal);
            pp.appendChild(lbl);
          }
        });
      }
      var pl = document.getElementById('panelLocations');
      if (pl) {
        pl.innerHTML = '';
        locations.forEach(function(lo) {
          var nameVal = typeof lo === 'object' ? (lo.name || lo.title || lo.location_name || '') : String(lo);
          if (nameVal) {
            var lbl = document.createElement('label');
            lbl.className = 'am-multiselect-option';
            lbl.innerHTML = '<input type="checkbox" value="' + escapeHtml(nameVal) + '" onchange="onFilterChange()"> ' + escapeHtml(nameVal);
            pl.appendChild(lbl);
          }
        });
      }
    }

    function toggleFilterPanel(panelId, event) {
      event.stopPropagation();
      var target = document.getElementById(panelId);
      var isActive = target.classList.contains('active');
      document.querySelectorAll('.am-multiselect-panel').forEach(function(p) {
        p.classList.remove('active');
      });
      if (!isActive) target.classList.add('active');
    }

    function getSelectedValues(panelId) {
      var cbs = document.querySelectorAll('#' + panelId + ' input[type="checkbox"]:checked');
      return Array.from(cbs).map(function(cb) { return cb.value.toLowerCase(); });
    }

    function updateMultiSelectButtons() {
      var t = getSelectedValues('panelTypes');
      var s = getSelectedValues('panelStatuses');
      var p = getSelectedValues('panelProjects');
      var l = getSelectedValues('panelLocations');

      var btnT = document.querySelector('#ddTypes .am-multiselect-btn');
      if (btnT) btnT.textContent = t.length === 0 ? 'Types (All)' : 'Types (' + t.length + ')';
      var btnS = document.querySelector('#ddStatuses .am-multiselect-btn');
      if (btnS) btnS.textContent = s.length === 0 ? 'Statuses (All)' : 'Statuses (' + s.length + ')';
      var btnP = document.querySelector('#ddProjects .am-multiselect-btn');
      if (btnP) btnP.textContent = p.length === 0 ? 'Projects (All)' : 'Projects (' + p.length + ')';
      var btnL = document.querySelector('#ddLocations .am-multiselect-btn');
      if (btnL) btnL.textContent = l.length === 0 ? 'Locations (All)' : 'Locations (' + l.length + ')';
    }

    function onFilterChange() {
      updateMultiSelectButtons();
      currentPage = 1;
      renderAssetTable();
    }

    function filterByKpi(statusType) {
      document.querySelectorAll('#panelStatuses input[type="checkbox"]').forEach(function(cb) {
        cb.checked = false;
      });
      if (statusType === 'Available' || statusType === 'In Use' || statusType === 'Maintenance') {
        var target = Array.from(document.querySelectorAll('#panelStatuses input[type="checkbox"]')).find(function(cb) {
          return cb.value.toLowerCase() === statusType.toLowerCase();
        });
        if (target) target.checked = true;
      } else if (statusType === 'Active') {
        document.querySelectorAll('#panelStatuses input[type="checkbox"]').forEach(function(cb) {
          if (cb.value === 'Available' || cb.value === 'In Use') cb.checked = true;
        });
      }
      onFilterChange();
      switchTab('assets');
    }

    function parseVal(val) {
      if (val === undefined || val === null) return '';
      if (Array.isArray(val)) return val.map(parseVal).filter(Boolean).join(', ');
      if (typeof val === 'object') return val.asset_type_name || val.name || val.title || val.project_name || val.location_name || val.division_name || '';
      var str = String(val).trim();
      return (str === 'null' || str === 'undefined') ? '' : str;
    }

    function normalizeAsset(r) {
      var f = (r && r.fields && typeof r.fields === 'object') ? r.fields : (r || {});
      var rawType = f.asset_type || f.category || f['Category'] || f['Asset Type'] || 'Unassigned';
      var rawTime = f.updated_at || f['Last Updated'] || f.created_at || new Date().toISOString();

      return {
        id: r.id || f.id || ('eq-' + Math.random().toString(36).substr(2, 9)),
        assetNumber: parseVal(f.asset_number || f['Equipment ID'] || f['Equipment Name'] || f.assetNumber),
        type: parseVal(rawType),
        isAttachment: Number(f.is_attachment || f.isAttachment || 0),
        allowedCategory: parseVal(f.allowed_category || f.allowedCategory || 'all'),
        meter: (f.current_meter_reading !== undefined && f.current_meter_reading !== null) ? f.current_meter_reading : (f['Meter Reading'] || null),
        status: parseVal(f.status || f['Status']) || 'Available',
        project: parseVal(f.current_project || f['Project']),
        location: parseVal(f.current_location || f['Location'] || f.location),
        lat: f.latitude || f.lat || null,
        lng: f.longitude || f.lng || null,
        
        baseProject: parseVal(f.current_project || f['Project']),
        baseLocation: parseVal(f.current_location || f['Location'] || f.location),
        baseLat: (f.latitude || f.lat) ? parseFloat(f.latitude || f.lat) : null,
        baseLng: (f.longitude || f.lng) ? parseFloat(f.longitude || f.lng) : null,
        baseTimeDisplay: new Date(rawTime).toLocaleString(),
        
        lastReportedSource: 'Project Assignment',
        lastReportedTime: rawTime,
        formLat: null,
        formLng: null,
        formLocation: null,
        formProject: null,
        formSource: null,
        formTimeDisplay: null,
        
        serialNumber: parseVal(f.serial_number || f['Serial Number']),
        division: parseVal(r.division_name_resolved || f.division_name || f.division || f['Division'] || f.assigned_division),
        assignedTo: parseVal(f.owner_name || f.assigned_operator || f['Assigned Operator'] || f['Assigned To']),
        condition: parseVal(f.condition || f['Condition']),
        createdAt: parseVal(f.created_at || f['Created Date'])
      };
    }

    /* Dynamic Activity History Engine */
    async function applyLatestLocationActivity(assets) {
      try {
        var ci = localStorage.getItem('driven_customer_id');
        var query = ci ? '?customerId=' + encodeURIComponent(ci) : '';

        var [projRes, inspRes, transRes, woRes, fuelRes] = await Promise.allSettled([
          fetch('/api/projects' + query),
          fetch('/api/inspections' + query),
          fetch('/api/transfers' + query),
          fetch('/api/work-orders' + query),
          fetch('/api/fueling' + query)
        ]);

        var projectCoords = {};
        if (projRes.status === 'fulfilled' && projRes.value.ok) {
          try {
            var pData = await projRes.value.clone().json();
            var pList = extractRecords(pData);
            pList.forEach(function(pr) {
              var pf = pr.fields || pr;
              var pName = parseVal(pf.name || pf.project_name || pf.title || pf.code);
              var pNum = parseVal(pf.project_number || pf.code);
              var pCombined = pNum && pName ? (pNum + " — " + pName) : (pNum || pName);
              
              var pLat = pf.latitude || pf.lat || pf.site_latitude;
              var pLng = pf.longitude || pf.lng || pf.site_longitude;
              
              if (pLat && pLng) {
                var coordObj = { lat: parseFloat(pLat), lng: parseFloat(pLng) };
                if (pName) projectCoords[pName.toLowerCase()] = coordObj;
                if (pNum) projectCoords[pNum.toLowerCase()] = coordObj;
                if (pCombined) projectCoords[pCombined.toLowerCase()] = coordObj;
              }
            });
          } catch(e) { console.error('Error indexing project coordinates:', e); }
        }

        var activities = [];
        async function parseResponse(res, sourceName, numKey, locKey, latKey, lngKey, timeKey, projKey) {
          if (res.status === 'fulfilled' && res.value.ok) {
            try {
              var data = await res.value.clone().json();
              var list = extractRecords(data);
              list.forEach(function(item) {
                var f = item.fields || item;
                var assetNum = f[numKey] || f.asset_number || f.equipment_id;
                var time = f[timeKey] || f.timestamp || f.created_at || f.date || f.updated_at || f.assignment_date;
                var lat = f[latKey] || f.latitude || f.lat;
                var lng = f[lngKey] || f.longitude || f.lng;
                var loc = f[locKey] || f.location || f.address || f.destination_location || f.site_address;
                var proj = projKey ? f[projKey] : (f.project || f.project_name || f.current_project);

                if ((!lat || !lng) && proj && projectCoords[String(proj).toLowerCase()]) {
                  lat = projectCoords[String(proj).toLowerCase()].lat;
                  lng = projectCoords[String(proj).toLowerCase()].lng;
                }

                if (assetNum && time && (lat || lng || loc || proj)) {
                  activities.push({
                    assetNumber: String(assetNum).trim().toLowerCase(),
                    source: sourceName,
                    time: new Date(time).getTime(),
                    timeDisplay: new Date(time).toLocaleString(),
                    lat: (lat !== null && lat !== undefined && !isNaN(lat)) ? parseFloat(lat) : null,
                    lng: (lng !== null && lng !== undefined && !isNaN(lng)) ? parseFloat(lng) : null,
                    location: loc ? String(loc) : null,
                    project: proj ? String(proj) : null
                  });
                }
              });
            } catch (e) {
              console.error('Error parsing ' + sourceName, e);
            }
          }
        }

        await parseResponse(projRes, 'Project Assignment', 'asset_number', 'site_address', 'latitude', 'longitude', 'updated_at', 'project_name');
        await parseResponse(inspRes, 'Inspection Log', 'equipment_id', 'inspection_location', 'latitude', 'longitude', 'inspection_date', 'project');
        await parseResponse(transRes, 'Transfer Log', 'asset_number', 'destination_location', 'destination_lat', 'destination_lng', 'transfer_date', 'destination_project');
        await parseResponse(woRes, 'Work Order', 'asset_number', 'site_location', 'latitude', 'longitude', 'created_at', 'project_name');
        await parseResponse(fuelRes, 'Fueling Record', 'asset_number', 'fuel_site', 'latitude', 'longitude', 'fuel_date', 'project');

        assets.forEach(function(a) {
          if (!a.assetNumber) return;
          var key = a.assetNumber.trim().toLowerCase();

          if ((a.baseLat === null || a.baseLng === null) && a.baseProject && projectCoords[a.baseProject.toLowerCase()]) {
            a.baseLat = projectCoords[a.baseProject.toLowerCase()].lat;
            a.baseLng = projectCoords[a.baseProject.toLowerCase()].lng;
          }

          var assetLogs = activities.filter(function(act) { return act.assetNumber === key; });

          assetLogs.forEach(function(log) {
            if ((log.lat === null || log.lng === null) && log.project && projectCoords[log.project.toLowerCase()]) {
              log.lat = projectCoords[log.project.toLowerCase()].lat;
              log.lng = projectCoords[log.project.toLowerCase()].lng;
            }
          });

          if (assetLogs.length === 0 && a.baseLat !== null && a.baseLng !== null) {
            assetLogs.push({
              assetNumber: key,
              source: 'Project Assignment',
              time: a.lastReportedTime ? new Date(a.lastReportedTime).getTime() : Date.now(),
              timeDisplay: a.baseTimeDisplay || 'Assigned Location',
              lat: a.baseLat,
              lng: a.baseLng,
              location: a.baseLocation,
              project: a.baseProject
            });
          }

          a.locationHistory = assetLogs
            .filter(function(act) { return act.lat !== null && act.lng !== null && !isNaN(act.lat) && !isNaN(act.lng); })
            .sort(function(x, y) { return x.time - y.time; });

          var maxFormTime = 0;
          var maxProjTime = a.lastReportedTime ? new Date(a.lastReportedTime).getTime() : 0;

          assetLogs.forEach(function(log) {
            if (isNaN(log.time)) return;
            if (log.source === 'Project Assignment') {
              if (log.time > maxProjTime) {
                maxProjTime = log.time;
                if (log.project) a.baseProject = log.project;
                if (log.location) a.baseLocation = log.location;
                if (log.lat !== null && !isNaN(log.lat)) a.baseLat = log.lat;
                if (log.lng !== null && !isNaN(log.lng)) a.baseLng = log.lng;
                a.baseTimeDisplay = log.timeDisplay;
              }
            } else {
              if (log.time > maxFormTime) {
                maxFormTime = log.time;
                a.formSource = log.source;
                a.formTimeDisplay = log.timeDisplay;
                if (log.lat !== null && !isNaN(log.lat)) a.formLat = log.lat;
                if (log.lng !== null && !isNaN(log.lng)) a.formLng = log.lng;
                if (log.location) a.formLocation = log.location;
                if (log.project) a.formProject = log.project;
              }
            }
          });

          if (maxFormTime > maxProjTime) {
            a.lastReportedSource = a.formSource;
            a.lastReportedTime = a.formTimeDisplay;
            if (a.formLat !== null) a.lat = a.formLat;
            if (a.formLng !== null) a.lng = a.formLng;
            if (a.formLocation) a.location = a.formLocation;
            if (a.formProject) a.project = a.formProject;
          } else {
            a.lastReportedSource = 'Project Assignment';
            a.lastReportedTime = a.baseTimeDisplay;
            if (a.baseLat !== null) a.lat = a.baseLat;
            if (a.baseLng !== null) a.lng = a.baseLng;
            if (a.baseLocation) a.location = a.baseLocation;
            if (a.baseProject) a.project = a.baseProject;
          }
        });
      } catch (err) {
        console.error('Failed to aggregate dynamic location history:', err);
      }
    }

    function toggleQuickAddAllowedCategory() {
      var isAtt = document.getElementById('amIsAttachment').value;
      var row = document.getElementById('amAllowedCategoryRow');
      if (row) row.style.display = (isAtt === '1') ? 'flex' : 'none';
    }

    function toggleEditAllowedCategory() {
      var isAtt = document.getElementById('amEditIsAttachment').value;
      var row = document.getElementById('amEditAllowedCategoryRow');
      if (row) row.style.display = (isAtt === '1') ? 'flex' : 'none';
    }

    async function addAsset() {
      var an = document.getElementById('amAssetNumber').value.trim();
      var at = document.getElementById('amAssetType').value;
      var isAtt = Number(document.getElementById('amIsAttachment').value || 0);
      var allowedCat = document.getElementById('amAllowedCategory').value || 'all';
      var dv = document.getElementById('amDivision').value;
      var op = document.getElementById('amAssignedOperator').value;
      var m = document.getElementById('amMeter').value.trim();
      var st = document.getElementById('amStatus').value;
      var pr = document.getElementById('amProject').value;
      var lo = document.getElementById('amLocation').value;

      if (!an) { showMessage('Please enter an asset number.', 'error'); return; }
      if (!at) { showMessage('Please select an asset type.', 'error'); return; }

      var AS = ['available', 'in use', 'maintenance'];
      var d = allAssets.find(function(a) { return a.assetNumber && a.assetNumber.toLowerCase() === an.toLowerCase(); });
      if (d) {
        var ds = (d.status || '').toLowerCase();
        if (AS.indexOf(ds) !== -1) {
          showMessage('An asset with number "' + an + '" is already in use (' + (d.status || 'Active') + '). Asset numbers must be unique unless the existing asset is no longer active.', 'error');
          return;
        } else {
          if (!confirm('Asset number "' + an + '" is currently used by an inactive asset (' + (d.status || 'unknown status') + ' — ' + (d.type || 'unknown type') + '). Some companies reuse numbers from assets that are no longer in service.\n\nClick OK to reuse this number, or Cancel to choose a different number.')) return;
        }
      }

      var mv = null;
      if (m !== '') {
        mv = parseFloat(m);
        if (isNaN(mv) || mv < 0) {
          showMessage('Meter Reading must be a valid number (0 or higher).', 'error');
          return;
        }
      }

      var p = {
        asset_number: an,
        category: at,
        asset_type: at,
        is_attachment: isAtt,
        allowed_category: allowedCat,
        division_name: dv,
        assigned_operator: op,
        owner_name: op,
        status: st,
        current_project: pr,
        current_location: lo
      };
      if (mv !== null) p.current_meter_reading = mv;

      try {
        var resp = await fetch('/api/Equipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p)
        });
        var data = await resp.json();
        if (!resp.ok) throw new Error(data.error || data.message || 'Save failed (' + resp.status + ')');

        if (data.record) {
          allAssets.push(normalizeAsset(data.record));
        } else {
          await loadAssets();
          showMessage('Asset "' + an + '" added.', 'success');
          return;
        }

        document.getElementById('amAssetNumber').value = '';
        document.getElementById('amAssetType').value = '';
        document.getElementById('amIsAttachment').value = '0';
        document.getElementById('amAllowedCategory').value = 'all';
        toggleQuickAddAllowedCategory();
        document.getElementById('amDivision').value = '';
        document.getElementById('amAssignedOperator').value = '';
        document.getElementById('amMeter').value = '';
        document.getElementById('amStatus').value = 'Available';
        document.getElementById('amProject').value = '';
        document.getElementById('amLocation').value = '';

        showMessage('Asset "' + an + '" added.', 'success');
        updateKpi();
        currentPage = 1;
        renderAssetTable();
        switchTab('assets');
      } catch (e) {
        showMessage('Failed to add asset: ' + e.message, 'error');
        if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report('asset-management.html: addAsset failed — ' + (e.message || e), 'addAsset', e && e.stack ? e.stack : null);
      }
    }

    function updateKpi() {
      var total = allAssets.length;
      var avail = 0, inuse = 0, maint = 0;
      allAssets.forEach(function(a) {
        var st = (a.status || '').toLowerCase();
        if (st === 'available') avail++;
        else if (st === 'in use') inuse++;
        else if (st === 'maintenance') maint++;
      });
      var active = avail + inuse;
      var elAvail = document.getElementById('kpiAvailable');
      if (elAvail) elAvail.textContent = avail;
      var elInUse = document.getElementById('kpiInUse');
      if (elInUse) elInUse.textContent = inuse;
      var elMaint = document.getElementById('kpiMaint');
      if (elMaint) elMaint.textContent = maint;
      var elActive = document.getElementById('kpiActive');
      if (elActive) elActive.textContent = active + ' / ' + total;
    }

    async function loadAssets() {
      var tb = document.getElementById('amTableBody');
      if (!tb) return;
      tb.textContent = '';
      var lr = document.createElement('tr');
      var lc = document.createElement('td');
      lc.className = 'am-empty';
      lc.textContent = 'Loading assets…';
      lr.appendChild(lc);
      tb.appendChild(lr);

      try {
        var resp = await fetch('/api/Equipment');
        if (resp.status === 404) resp = await fetch('/api/equipment');
        var data = await resp.json();
        var rawRecords = (data && data.records) ? data.records : (Array.isArray(data) ? data : (data.equipment || data.assets || []));
        if (resp.ok && Array.isArray(rawRecords)) {
          allAssets = rawRecords.map(normalizeAsset);
          await applyLatestLocationActivity(allAssets);
        } else if (resp.status === 401) {
          allAssets = [];
          tb.textContent = '';
          var er = document.createElement('tr');
          var ec = document.createElement('td');
          ec.className = 'am-empty';
          ec.style.color = 'var(--error)';
          ec.textContent = 'Your session has expired. Please log in again.';
          er.appendChild(ec);
          tb.appendChild(er);
          updateKpi();
          renderTableHead();
          renderColTogglePanel();
          return;
        } else if (resp.status === 403) {
          allAssets = [];
          tb.textContent = '';
          var er3 = document.createElement('tr');
          var ec3 = document.createElement('td');
          ec3.className = 'am-empty';
          ec3.style.color = 'var(--error)';
          ec3.textContent = 'You do not have permission to view assets.';
          er3.appendChild(ec3);
          tb.appendChild(er3);
          updateKpi();
          renderTableHead();
          renderColTogglePanel();
          return;
        } else {
          allAssets = [];
          tb.textContent = '';
          var er2 = document.createElement('tr');
          var ec2 = document.createElement('td');
          ec2.className = 'am-empty';
          ec2.style.color = 'var(--error)';
          ec2.textContent = 'Failed to load assets (HTTP ' + resp.status + '). Please try again or contact support.';
          er2.appendChild(ec2);
          tb.appendChild(er2);
          updateKpi();
          renderTableHead();
          renderColTogglePanel();
          return;
        }
      } catch (e) {
        console.error('loadAssets error:', e);
        allAssets = [];
        tb.textContent = '';
        var er4 = document.createElement('tr');
        var ec4 = document.createElement('td');
        ec4.className = 'am-empty';
        ec4.style.color = 'var(--error)';
        ec4.textContent = 'Network error — could not reach the server. Please check your connection and try again.';
        er4.appendChild(ec4);
        tb.appendChild(er4);
        updateKpi();
        renderTableHead();
        renderColTogglePanel();
        return;
      }
      updateKpi();
      renderTableHead();
      renderAssetTable();
      renderColTogglePanel();
    }

    /* ===== MAP INITIALIZATION & MODE SWITCHING ===== */
    function setMapMode(mode) {
      mapMode = mode;
      var btnF = document.getElementById('btnMapForms');
      var btnP = document.getElementById('btnMapProjects');
      var btnB = document.getElementById('btnMapBreadcrumbs');
      var filterRow = document.getElementById('breadcrumbFilterRow');

      if (filterRow) {
        filterRow.style.display = (mode === 'breadcrumbs') ? 'grid' : 'none';
      }

      if (mode === 'breadcrumbs') {
        populateBreadcrumbAssetDropdown();
      } else if (typeof breadcrumbLayers !== 'undefined' && breadcrumbLayers.length > 0) {
        breadcrumbLayers.forEach(function(layer) { amMapInstance.removeLayer(layer); });
        breadcrumbLayers = [];
      }

      if (btnF) btnF.classList.remove('active');
      if (btnP) btnP.classList.remove('active');
      if (btnB) btnB.classList.remove('active');

      if (mode === 'projects') {
        if (btnP) btnP.classList.add('active');
        renderAssetMapPins();
      } else if (mode === 'breadcrumbs') {
        if (btnB) btnB.classList.add('active');
        renderBreadcrumbTrails();
      } else {
        if (btnF) btnF.classList.add('active');
        renderAssetMapPins();
      }
    }

    function populateBreadcrumbAssetDropdown() {
      var sel = document.getElementById('amBreadcrumbAssetSelect');
      if (!sel) return;
      var curVal = sel.value;
      sel.innerHTML = '<option value="">— Select an Asset —</option>';

      allAssets.forEach(function(a) {
        if (!a.assetNumber) return;
        var opt = document.createElement('option');
        opt.value = a.assetNumber;
        opt.textContent = a.assetNumber + ' (' + (a.type || 'Equipment') + ')';
        sel.appendChild(opt);
      });

      if (curVal && Array.from(sel.options).some(function(o) { return o.value === curVal; })) {
        sel.value = curVal;
      } else if (allAssets.length > 0 && allAssets[0].assetNumber) {
        sel.value = allAssets[0].assetNumber;
      }
    }

    function initAssetMap() {
      if (amMapInstance) {
        amMapInstance.invalidateSize();
        return;
      }
      var mapContainer = document.getElementById('amMap');
      if (!mapContainer || typeof L === 'undefined') return;
      amMapInstance = L.map('amMap').setView([38.5, -96.0], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(amMapInstance);

      if (typeof L.markerClusterGroup === 'function') {
        amClusterGroup = L.markerClusterGroup({
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          maxClusterRadius: 40
        });
        amMapInstance.addLayer(amClusterGroup);
      }

      if (mapMode === 'breadcrumbs') {
        populateBreadcrumbAssetDropdown();
        renderBreadcrumbTrails();
      } else {
        renderAssetMapPins();
      }
    }

    function renderAssetMapPins() {
      if (!amMapInstance) return;
      
      if (typeof breadcrumbLayers !== 'undefined' && breadcrumbLayers.length > 0) {
        breadcrumbLayers.forEach(function(layer) { amMapInstance.removeLayer(layer); });
        breadcrumbLayers = [];
      }

      if (amClusterGroup) {
        amClusterGroup.clearLayers();
      }
      var bounds = [];

      if (mapMode === 'projects') {
        var projectGroups = {};
        allAssets.forEach(function(a) {
          var latitude = parseFloat(a.baseLat);
          var longitude = parseFloat(a.baseLng);
          if (isNaN(latitude) || isNaN(longitude) || latitude === null || longitude === null) return;

          var projName = a.baseProject || 'Unassigned Project';
          var prjParts = projName.split(' — ');
          var projCode = prjParts[0] || 'PRJ';
          var key = projCode + '_' + latitude.toFixed(5) + '_' + longitude.toFixed(5);

          if (!projectGroups[key]) {
            projectGroups[key] = {
              code: projCode,
              fullName: projName,
              location: a.baseLocation || 'Unassigned Location',
              lat: latitude,
              lng: longitude,
              assets: []
            };
          }
          projectGroups[key].assets.push(a);
        });

        Object.keys(projectGroups).forEach(function(k) {
          var pg = projectGroups[k];
          bounds.push([pg.lat, pg.lng]);

          var pinIcon = L.divIcon({
            className: 'am-map-pin-container',
            html: '<div class="am-map-pin-project">🏗️ ' + escapeHtml(pg.code) + ' (' + pg.assets.length + ')</div>',
            iconSize: [110, 26],
            iconAnchor: [55, 13]
          });

          var popupContent = '<div class="am-map-popup">' +
            '<h4>🏗️ ' + escapeHtml(pg.fullName) + '</h4>' +
            '<p><strong>Location:</strong> ' + escapeHtml(pg.location) + '</p>' +
            '<p><strong>Total Assets Assigned:</strong> ' + pg.assets.length + '</p>' +
            '<hr style="margin:8px 0; border:0; border-top:1px solid #cbd5e1;">' +
            '<div style="max-height:160px; overflow-y:auto; padding-right:4px;">';

          pg.assets.forEach(function(a) {
            popupContent += '<div style="margin-bottom:8px; padding-bottom:6px; border-bottom:1px dashed #e2e8f0;">' +
              '<strong>' + escapeHtml(a.assetNumber || 'EQ') + '</strong> — ' + escapeHtml(a.type || 'Equipment') + ' (' + escapeHtml(a.status || 'Available') + ')' +
              '<div style="margin-top:4px; display:flex; gap:6px; align-items:center;">' +
                '<button onclick="openStreetViewModal(\'' + escapeHtml(a.id) + '\', ' + pg.lat + ', ' + pg.lng + ')" class="am-table-btn" style="background:#16a34a; color:#fff; border-color:#15803d; font-size:10px; padding:2px 6px; cursor:pointer;">📷 Street View</button>' +
                '<a href="/app/asset/asset-detail.html?id=' + encodeURIComponent(a.id) + '" style="color:#2563eb; font-weight:600; text-decoration:none; font-size:11px;">Details →</a>' +
              '</div>' +
            '</div>';
          });

          popupContent += '</div></div>';

          var marker = L.marker([pg.lat, pg.lng], { icon: pinIcon }).bindPopup(popupContent);

          if (amClusterGroup) {
            amClusterGroup.addLayer(marker);
          } else {
            marker.addTo(amMapInstance);
          }
        });
      } else {
        allAssets.forEach(function(a) {
          var latitude = parseFloat(a.formLat !== null ? a.formLat : a.lat);
          var longitude = parseFloat(a.formLng !== null ? a.formLng : a.lng);
          var displayLocation = a.formLocation || a.location || 'Unassigned Location';
          var displayProject = a.formProject || a.project || 'Unassigned Project';
          var displaySource = a.formSource || a.lastReportedSource || 'Asset Record';
          var displayTime = a.formTimeDisplay || a.lastReportedTime || 'Recent Record';

          if (isNaN(latitude) || isNaN(longitude) || latitude === null || longitude === null) return;

          bounds.push([latitude, longitude]);
          var pinIcon = L.divIcon({
            className: 'am-map-pin-container',
            html: '<div class="am-map-pin">' + escapeHtml(a.assetNumber || 'EQ') + '</div>',
            iconSize: [60, 24],
            iconAnchor: [30, 12]
          });

          var popupContent = '<div class="am-map-popup">' +
            '<h4>' + escapeHtml(a.assetNumber || 'Asset') + ' — ' + escapeHtml(a.type || 'Equipment') + '</h4>' +
            '<p><strong>Status:</strong> ' + escapeHtml(a.status || 'Available') + '</p>' +
            '<p><strong>Project:</strong> ' + escapeHtml(displayProject) + '</p>' +
            '<p><strong>Location:</strong> ' + escapeHtml(displayLocation) + '</p>' +
            '<p><strong>GPS:</strong> ' + latitude.toFixed(5) + ', ' + longitude.toFixed(5) + '</p>' +
            '<p class="popup-meta">Last reported via <strong>' + escapeHtml(displaySource) + '</strong> (' + escapeHtml(displayTime) + ')</p>' +
            '<div style="margin-top:10px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">' +
              '<button onclick="openStreetViewModal(\'' + escapeHtml(a.id) + '\', ' + latitude + ', ' + longitude + ')" class="am-table-btn" style="background:#16a34a; color:#fff; border-color:#15803d; font-size:11px; padding:4px 8px; cursor:pointer;">📷 View Street View</button>' +
              '<a href="/app/asset/asset-detail.html?id=' + encodeURIComponent(a.id) + '" style="color:#2563eb; font-weight:600; text-decoration:none; font-size:12px;">Asset Details →</a>' +
            '</div>' +
          '</div>';

          var marker = L.marker([latitude, longitude], { icon: pinIcon }).bindPopup(popupContent);

          if (amClusterGroup) {
            amClusterGroup.addLayer(marker);
          } else {
            marker.addTo(amMapInstance);
          }
        });
      }

      if (bounds.length > 0) {
        amMapInstance.fitBounds(bounds, { padding: [40, 40] });
      }
    }

    /* ===== BREADCRUMB LOCATION TRAIL RENDERER ===== */
    function renderBreadcrumbTrails() {
      if (!amMapInstance) return;

      if (typeof breadcrumbLayers !== 'undefined' && breadcrumbLayers.length > 0) {
        breadcrumbLayers.forEach(function(layer) { amMapInstance.removeLayer(layer); });
        breadcrumbLayers = [];
      }

      if (amClusterGroup) {
        amClusterGroup.clearLayers();
      }

      var selectedAssetNum = document.getElementById('amBreadcrumbAssetSelect') ? document.getElementById('amBreadcrumbAssetSelect').value : '';
      var rangeMode = document.getElementById('amBreadcrumbDateRange') ? document.getElementById('amBreadcrumbDateRange').value : '7days';

      if (!selectedAssetNum) return;

      var now = new Date();
      var cutoffTime = 0;
      if (rangeMode === 'today') {
        cutoffTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      } else if (rangeMode === '7days') {
        cutoffTime = now.getTime() - (7 * 24 * 60 * 60 * 1000);
      } else if (rangeMode === '30days') {
        cutoffTime = now.getTime() - (30 * 24 * 60 * 60 * 1000);
      }

      var targetAsset = allAssets.find(function(a) {
        return a.assetNumber && a.assetNumber.toLowerCase() === selectedAssetNum.toLowerCase();
      });

      if (!targetAsset || !targetAsset.locationHistory) return;

      var filteredHistory = targetAsset.locationHistory.filter(function(pt) {
        return pt.time >= cutoffTime;
      });

      if (filteredHistory.length === 0) return;

      var latLngs = filteredHistory.map(function(pt) { return [pt.lat, pt.lng]; });
      var allBounds = [];

      var polyline = L.polyline(latLngs, {
        color: '#2563eb',
        weight: 3,
        opacity: 0.8,
        dashArray: '6, 6'
      }).addTo(amMapInstance);
      
      breadcrumbLayers.push(polyline);

      filteredHistory.forEach(function(pt, idx) {
        allBounds.push([pt.lat, pt.lng]);
        var isLatest = (idx === filteredHistory.length - 1);
        
        var dotIcon = L.divIcon({
          className: 'am-breadcrumb-dot',
          html: '<div style="background:' + (isLatest ? '#dc2626' : '#2563eb') + '; width:' + (isLatest ? '14px' : '9px') + '; height:' + (isLatest ? '14px' : '9px') + '; border-radius:50%; border: 2px solid #fff; box-shadow: 0 0 5px rgba(0,0,0,0.4);"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        var marker = L.marker([pt.lat, pt.lng], { icon: dotIcon }).bindPopup(
          '<div class="am-map-popup">' +
            '<h4>📍 ' + escapeHtml(targetAsset.assetNumber) + ' Waypoint</h4>' +
            '<p><strong>Source:</strong> ' + escapeHtml(pt.source) + '</p>' +
            '<p><strong>Time:</strong> ' + escapeHtml(pt.timeDisplay) + '</p>' +
            '<p><strong>Location:</strong> ' + escapeHtml(pt.location || 'N/A') + '</p>' +
            '<p><strong>GPS:</strong> ' + pt.lat.toFixed(5) + ', ' + pt.lng.toFixed(5) + '</p>' +
          '</div>'
        ).addTo(amMapInstance);

        breadcrumbLayers.push(marker);
      });

      if (allBounds.length > 0) {
        amMapInstance.fitBounds(allBounds, { padding: [50, 50] });
      }
    }

    /* ===== STREET VIEW & DRAGGABLE PIN ADJUSTER ===== */
    function openStreetViewModal(assetId, lat, lng) {
      activeStreetViewAsset = allAssets.find(function(a) { return a.id === assetId; });
      var titleEl = document.getElementById('streetViewAssetTitle');
      if (titleEl && activeStreetViewAsset) {
        titleEl.textContent = (activeStreetViewAsset.assetNumber || 'Asset') + ' Street View';
      }

      openModal('amStreetViewModal');
      updateStreetViewIframe(lat, lng);

      setTimeout(function() {
        initAdjustMap(lat, lng);
      }, 200);
    }

    function updateStreetViewIframe(lat, lng) {
      var iframe = document.getElementById('streetViewFrame');
      var disp = document.getElementById('streetViewCoordDisplay');
      if (disp) disp.textContent = 'Lat: ' + lat.toFixed(5) + ', Lng: ' + lng.toFixed(5);
      if (iframe) {
        iframe.src = 'https://maps.google.com/maps?q=&layer=c&cbll=' + lat + ',' + lng + '&cbp=11,0,0,0,0&output=svembed';
      }
    }

    function initAdjustMap(lat, lng) {
      var mapContainer = document.getElementById('streetViewAdjustMap');
      if (!mapContainer || typeof L === 'undefined') return;

      if (adjustMapInstance) {
        adjustMapInstance.invalidateSize();
        adjustMapInstance.setView([lat, lng], 17);
        if (adjustMarker) adjustMarker.setLatLng([lat, lng]);
        return;
      }

      adjustMapInstance = L.map('streetViewAdjustMap').setView([lat, lng], 17);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(adjustMapInstance);

      adjustMarker = L.marker([lat, lng], { draggable: true }).addTo(adjustMapInstance);

      adjustMarker.on('dragend', function(e) {
        var coord = e.target.getLatLng();
        onPinAdjusted(coord.lat, coord.lng);
      });

      adjustMapInstance.on('click', function(e) {
        var coord = e.latlng;
        adjustMarker.setLatLng(coord);
        onPinAdjusted(coord.lat, coord.lng);
      });
    }

    function onPinAdjusted(newLat, newLng) {
      updateStreetViewIframe(newLat, newLng);

      if (activeStreetViewAsset) {
        if (mapMode === 'projects') {
          activeStreetViewAsset.baseLat = newLat;
          activeStreetViewAsset.baseLng = newLng;
        } else {
          activeStreetViewAsset.formLat = newLat;
          activeStreetViewAsset.formLng = newLng;
          activeStreetViewAsset.lat = newLat;
          activeStreetViewAsset.lng = newLng;
        }
        renderAssetMapPins();
      }
    }

    function renderTableHead() {
      var th = document.getElementById('amTableHead');
      if (!th) return;
      th.textContent = '';
      var tr = document.createElement('tr');
      COL_DEFS.forEach(function(col) {
        if (!visibleCols[col.key]) return;
        var h = document.createElement('th');
        h.dataset.key = col.key;
        h.style.width = colWidths[col.key] || col.defaultWidth;
        var titleText = document.createTextNode(col.label);
        h.appendChild(titleText);
        var a = document.createElement('span');
        a.className = 'am-sort-arrow';
        if (sortKey === col.key) {
          a.textContent = sortDir === 'asc' ? ' ▲' : ' ▼';
          h.classList.add(sortDir === 'asc' ? 'am-sorted-asc' : 'am-sorted-desc');
        } else {
          a.textContent = ' ↕';
        }
        h.appendChild(a);
        h.addEventListener('click', function(e) {
          if (e.target.classList.contains('am-resizer')) return;
          onSortClick(col.key);
        });

        var resizer = document.createElement('div');
        resizer.className = 'am-resizer';
        resizer.addEventListener('mousedown', function(e) { initColumnResize(e, h, col.key); });
        resizer.addEventListener('touchstart', function(e) { initColumnResize(e, h, col.key); }, { passive: false });
        h.appendChild(resizer);
        tr.appendChild(h);
      });

      if (canModify) {
        var ha = document.createElement('th');
        ha.textContent = 'Actions';
        ha.style.width = '180px';
        ha.style.cursor = 'default';
        tr.appendChild(ha);
      }
      th.appendChild(tr);
    }

    function initColumnResize(e, th, colKey) {
      e.stopPropagation();
      e.preventDefault();
      var resizer = e.target;
      resizer.classList.add('resizing');
      var startX = e.touches ? e.touches[0].pageX : e.pageX;
      var startWidth = th.offsetWidth;
      var colIndex = Array.from(th.parentNode.children).indexOf(th);

      function onMove(me) {
        var currentX = me.touches ? me.touches[0].pageX : me.pageX;
        var newWidth = Math.max(60, startWidth + (currentX - startX)) + 'px';
        th.style.width = newWidth;
        th.style.minWidth = newWidth;
        th.style.maxWidth = newWidth;
        var table = document.getElementById('amTable');
        if (table) {
          var rows = table.querySelectorAll('tbody tr');
          rows.forEach(function(row) {
            var td = row.children[colIndex];
            if (td) {
              td.style.width = newWidth;
              td.style.minWidth = newWidth;
              td.style.maxWidth = newWidth;
            }
          });
        }
        colWidths[colKey] = newWidth;
      }

      function onEnd() {
        resizer.classList.remove('resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        saveColWidths();
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    }

    function onSortClick(key) {
      if (sortKey === key) {
        sortDir = (sortDir === 'asc') ? 'desc' : 'asc';
      } else {
        sortKey = key;
        sortDir = 'asc';
      }
      currentPage = 1;
      renderTableHead();
      renderAssetTable();
    }

    var searchTimer = null;
    function onSearchInput() {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function() {
        currentPage = 1;
        renderAssetTable();
      }, 200);
    }

    function renderAssetTable() {
      var tb = document.getElementById('amTableBody');
      if (!tb) return;
      var searchEl = document.getElementById('amSearch');
      var s = searchEl ? searchEl.value.toLowerCase().trim() : '';

      var selTypes = getSelectedValues('panelTypes');
      var selStatuses = getSelectedValues('panelStatuses');
      var selProjects = getSelectedValues('panelProjects');
      var selLocations = getSelectedValues('panelLocations');

      var filtered = allAssets.filter(function(a) {
        var ms = !s || (a.assetNumber && a.assetNumber.toLowerCase().indexOf(s) !== -1) ||
                       (a.type && a.type.toLowerCase().indexOf(s) !== -1) ||
                       (a.project && a.project.toLowerCase().indexOf(s) !== -1) ||
                       (a.location && a.location.toLowerCase().indexOf(s) !== -1) ||
                       (a.assignedTo && a.assignedTo.toLowerCase().indexOf(s) !== -1);
        var mt = selTypes.length === 0 || (a.type && selTypes.indexOf(a.type.toLowerCase()) !== -1);
        var mst = selStatuses.length === 0 || (a.status && selStatuses.indexOf(a.status.toLowerCase()) !== -1);
        var mp = selProjects.length === 0 || (a.project && selProjects.indexOf(a.project.toLowerCase()) !== -1);
        var ml = selLocations.length === 0 || (a.location && selLocations.indexOf(a.location.toLowerCase()) !== -1);
        return ms && mt && mst && mp && ml;
      });

      filtered.sort(function(a, b) {
        var va = a[sortKey] || '', vb = b[sortKey] || '';
        if (sortKey === 'meter') {
          va = (va === null || va === '' || va === undefined) ? -1 : parseFloat(va);
          vb = (vb === null || vb === '' || vb === undefined) ? -1 : parseFloat(vb);
          return sortDir === 'asc' ? va - vb : vb - va;
        }
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });

      var tp = Math.max(1, Math.ceil(filtered.length / pageSize));
      if (currentPage > tp) currentPage = tp;
      var si = (currentPage - 1) * pageSize;
      var pi = filtered.slice(si, si + pageSize);

      tb.textContent = '';
      if (filtered.length === 0) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.className = 'am-empty';
        td.colSpan = COL_DEFS.filter(function(c) { return visibleCols[c.key]; }).length + (canModify ? 1 : 0);
        td.textContent = allAssets.length === 0 ? 'No assets found. Use the Quick Add Asset tab to add your first asset.' : 'No assets match your search.';
        tr.appendChild(td);
        tb.appendChild(tr);
        renderPagination(0, 1);
        return;
      }

      pi.forEach(function(a) {
        var tr = document.createElement('tr');
        COL_DEFS.forEach(function(col) {
          if (!visibleCols[col.key]) return;
          var td = document.createElement('td');
          td.style.width = colWidths[col.key] || col.defaultWidth;
          var v = a[col.key];

          if (col.key === 'status' && v) {
            var b = document.createElement('span');
            b.className = 'am-badge am-badge-' + String(v).toLowerCase().replace(/\s+/g, '-');
            b.textContent = v;
            td.appendChild(b);
          } else if (col.key === 'isAttachment') {
            td.textContent = (v === 1 || v === '1') ? 'Yes' : 'No';
          } else if (col.key === 'allowedCategory') {
            td.textContent = (v && v !== 'all') ? v : 'Universal (All)';
          } else if (col.key === 'type') {
            var ic = assetTypes.some(function(at) {
              var atName = typeof at === 'object' ? (at.asset_type_name || at.name) : String(at);
              return atName && atName.toLowerCase() === String(v || '').toLowerCase();
            });
            if (v && ic) {
              td.textContent = v;
            } else if (v) {
              td.textContent = v;
              td.style.opacity = '0.85';
            } else {
              td.textContent = '—';
            }
          } else if (col.key === 'meter') {
            td.textContent = (v !== null && v !== undefined && v !== '') ? v : '—';
          } else {
            td.textContent = (v !== undefined && v !== null && v !== '') ? v : '—';
          }
          tr.appendChild(td);
        });

        if (canModify) {
          var atd = document.createElement('td');
          atd.className = 'am-actions';
          atd.style.width = '180px';
          var wrap = document.createElement('div');
          wrap.className = 'am-actions-wrap';

          var bve = document.createElement('button');
          bve.className = 'am-table-btn';
          bve.textContent = 'Edit';
          bve.addEventListener('click', function() {
            openEditModal(a.id);
          });

          var bcfg = document.createElement('a');
          bcfg.className = 'am-table-btn';
          bcfg.textContent = '⚙️ Config';
          bcfg.href = 'asset-config.html?assetNumber=' + encodeURIComponent(a.assetNumber);
          bcfg.title = 'Configure asset specific rules';

          wrap.appendChild(bve);
          wrap.appendChild(bcfg);
          atd.appendChild(wrap);
          tr.appendChild(atd);
        }
        tb.appendChild(tr);
      });
      renderPagination(filtered.length, tp);
    }

    function renderPagination(ti, tp) {
      var c = document.getElementById('amPagination');
      if (!c) return;
      c.textContent = '';
      if (ti === 0) return;

      var i = document.createElement('span');
      i.className = 'am-page-info';
      var si = (currentPage - 1) * pageSize + 1;
      var ei = Math.min(currentPage * pageSize, ti);
      i.textContent = 'Showing ' + si + '–' + ei + ' of ' + ti;
      c.appendChild(i);

      var sd = document.createElement('div');
      sd.style.display = 'flex';
      sd.style.alignItems = 'center';
      sd.style.gap = '6px';
      var sl = document.createElement('span');
      sl.className = 'am-page-info';
      sl.textContent = 'Per page:';
      sd.appendChild(sl);

      var ss = document.createElement('select');
      ss.className = 'am-filter-select';
      ss.style.padding = '4px 8px';
      ss.style.fontSize = '13px';
      ss.style.width = 'auto';
      [10, 25, 50].forEach(function(sz) {
        var o = document.createElement('option');
        o.value = sz;
        o.textContent = sz;
        if (sz === pageSize) o.selected = true;
        ss.appendChild(o);
      });
      ss.addEventListener('change', function() {
        pageSize = parseInt(ss.value);
        currentPage = 1;
        renderAssetTable();
      });
      sd.appendChild(ss);
      c.appendChild(sd);

      var bd = document.createElement('div');
      bd.className = 'am-page-btns';
      var bp = document.createElement('button');
      bp.className = 'am-page-btn';
      bp.textContent = '◀ Prev';
      bp.disabled = currentPage <= 1;
      bp.addEventListener('click', function() { currentPage--; renderAssetTable(); });
      bd.appendChild(bp);

      var mv = 7, sp = 1, ep = tp;
      if (tp > mv) {
        if (currentPage <= 4) { sp = 1; ep = mv; }
        else if (currentPage >= tp - 3) { sp = tp - mv + 1; ep = tp; }
        else { sp = currentPage - 3; ep = currentPage + 3; }
      }

      for (var p = sp; p <= ep; p++) {
        var b = document.createElement('button');
        b.className = 'am-page-btn' + (p === currentPage ? ' active' : '');
        b.textContent = p;
        b.addEventListener('click', (function(pg) { return function() { currentPage = pg; renderAssetTable(); }; })(p));
        bd.appendChild(b);
      }

      var bn = document.createElement('button');
      bn.className = 'am-page-btn';
      bn.textContent = 'Next ▶';
      bn.disabled = currentPage >= tp;
      bn.addEventListener('click', function() { currentPage++; renderAssetTable(); });
      bd.appendChild(bn);

      c.appendChild(bd);
    }

    function toggleColPanel(e) {
      e.stopPropagation();
      var p = document.getElementById('amColPanel');
      if (!p) return;
      p.classList.toggle('active');
      if (p.classList.contains('active')) {
        renderColTogglePanel();
        var b = e.target;
        var r = b.getBoundingClientRect();
        p.style.position = 'fixed';
        p.style.top = (r.bottom + 4) + 'px';
        p.style.left = r.left + 'px';
      }
    }

    function renderColTogglePanel() {
      var c = document.getElementById('amColToggleItems');
      if (!c) return;
      c.textContent = '';
      COL_DEFS.forEach(function(col) {
        var i = document.createElement('label');
        i.className = 'am-col-toggle-item';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = visibleCols[col.key];
        cb.addEventListener('change', function() {
          visibleCols[col.key] = cb.checked;
          saveVisibleCols();
          renderTableHead();
          renderAssetTable();
        });
        i.appendChild(cb);
        i.appendChild(document.createTextNode(col.label));
        c.appendChild(i);
      });
    }

    document.addEventListener('click', function(e) {
      var p = document.getElementById('amColPanel');
      if (p && p.classList.contains('active') && !p.contains(e.target) && e.target.textContent !== 'Columns') p.classList.remove('active');
      if (!e.target.closest('.am-multiselect-dd')) {
        document.querySelectorAll('.am-multiselect-panel').forEach(function(panel) {
          panel.classList.remove('active');
        });
      }
    });

    function openEditModal(id) {
      var a = allAssets.find(function(x) { return x.id === id; });
      if (!a) return;
      editingAssetId = id;
      
      var msgEl = document.getElementById('amEditMessage');
      if (msgEl) msgEl.style.display = 'none';

      document.getElementById('amEditAssetNumber').value = a.assetNumber || '';
      document.getElementById('amEditAssetType').value = a.type || '';
      
      // Load attachment flags & update visibility
      document.getElementById('amEditIsAttachment').value = (a.isAttachment === 1 || a.isAttachment === '1') ? '1' : '0';
      document.getElementById('amEditAllowedCategory').value = a.allowedCategory || 'all';
      toggleEditAllowedCategory();

      document.getElementById('amEditDivision').value = a.division || '';
      document.getElementById('amEditAssignedOperator').value = a.assignedTo || '';
      document.getElementById('amEditMeter').value = (a.meter !== null && a.meter !== undefined) ? a.meter : '';
      document.getElementById('amEditStatus').value = a.status || 'Available';
      document.getElementById('amEditProject').value = a.project || '';
      document.getElementById('amEditLocation').value = a.location || '';
      document.getElementById('amEditModal').classList.add('active');
    }

    function closeEditModal() {
      var m = document.getElementById('amEditModal');
      if (m) m.classList.remove('active');
      editingAssetId = null;
    }

    async function saveEditAsset() {
      if (!editingAssetId) return;
      var an = document.getElementById('amEditAssetNumber').value.trim();
      var at = document.getElementById('amEditAssetType').value;
      
      // Pull attachment form fields
      var isAtt = Number(document.getElementById('amEditIsAttachment').value || 0);
      var allowedCat = document.getElementById('amEditAllowedCategory').value || 'all';
      
      var dv = document.getElementById('amEditDivision').value;
      var op = document.getElementById('amEditAssignedOperator').value;
      var m = document.getElementById('amEditMeter').value.trim();
      var st = document.getElementById('amEditStatus').value;
      var pr = document.getElementById('amEditProject').value;
      var lo = document.getElementById('amEditLocation').value;

      if (!an) { showEditMessage('Asset number is required.', 'error'); return; }
      if (!at) { showEditMessage('Asset type is required.', 'error'); return; }

      var AS = ['available', 'in use', 'maintenance'];
      var d = allAssets.find(function(a) { return a.id !== editingAssetId && a.assetNumber && a.assetNumber.toLowerCase() === an.toLowerCase(); });
      if (d) {
        var ds = (d.status || '').toLowerCase();
        if (AS.indexOf(ds) !== -1) {
          showEditMessage('An asset with number "' + an + '" is already in use (' + (d.status || 'Active') + ').', 'error');
          return;
        } else {
          if (!confirm('Asset number "' + an + '" is currently used by an inactive asset. Click OK to reuse, or Cancel.')) return;
        }
      }

      var mv = null;
      if (m !== '') {
        mv = parseFloat(m);
        if (isNaN(mv) || mv < 0) {
          showEditMessage('Meter Reading must be a valid number (0 or higher).', 'error');
          return;
        }
      }

      var p = {
        asset_number: an,
        category: at,
        asset_type: at,
        is_attachment: isAtt,
        allowed_category: allowedCat,
        division_name: dv,
        assigned_operator: op,
        owner_name: op,
        status: st,
        current_project: pr,
        current_location: lo
      };
      if (mv !== null) p.current_meter_reading = mv;

      try {
        var resp = await fetch('/api/Equipment/' + encodeURIComponent(editingAssetId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p)
        });
        var data = await resp.json();
        if (!resp.ok) throw new Error(data.error || data.message || 'Update failed (' + resp.status + ')');

        if (data.record) {
          var u = normalizeAsset(data.record);
          var i = allAssets.findIndex(function(a) { return a.id === editingAssetId; });
          if (i !== -1) allAssets[i] = u;
        } else {
          var a = allAssets.find(function(x) { return x.id === editingAssetId; });
          if (a) {
            a.assetNumber = an;
            a.type = at;
            a.isAttachment = isAtt;
            a.allowedCategory = allowedCat;
            a.division = dv;
            a.assignedTo = op;
            a.meter = mv;
            a.status = st;
            a.project = pr;
            a.location = lo;
          }
        }

        showMessage('Asset "' + an + '" updated.', 'success');
        updateKpi();
        closeEditModal();
        renderAssetTable();
        renderAssetMapPins();
      } catch (e) {
        showEditMessage('Failed to update asset: ' + e.message, 'error');
        if (window.DRIVENErrorHandler) window.DRIVENErrorHandler.report('asset-management.html: saveEditAsset failed — ' + (e.message || e), 'saveEditAsset', e && e.stack ? e.stack : null);
      }
    }

    function openModal(id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('active');
    }

    function closeModal(id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('active');
    }

    function openPrintModal() {
      var c = document.getElementById('amPrintCols');
      if (!c) return;
      c.textContent = '';
      COL_DEFS.forEach(function(col) {
        var i = document.createElement('label');
        i.className = 'am-check-item';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = visibleCols[col.key];
        cb.dataset.key = col.key;
        i.appendChild(cb);
        i.appendChild(document.createTextNode(col.label));
        c.appendChild(i);
      });
      openModal('amPrintModal');
    }

    function doPrint() {
      var cbs = document.querySelectorAll('#amPrintCols input[type="checkbox"]');
      var sc = [];
      cbs.forEach(function(cb) {
        if (cb.checked) {
          var col = COL_DEFS.find(function(c) { return c.key === cb.dataset.key; });
          if (col) sc.push(col);
        }
      });
      if (sc.length === 0) { showMessage('Select at least one column to print.', 'error'); return; }

      var f = getFilteredSorted();
      var h = '<html><head><title>DRIV-EN Asset List</title><style>body{font-family:Arial,sans-serif;margin:20px;}h2{margin:0 0 16px 0;}table{width:100%;border-collapse:collapse;font-size:12px;}th{background:#e2e8f0;padding:8px 10px;text-align:left;border:1px solid #94a3b8;}td{padding:6px 10px;border:1px solid #cbd5e1;}.print-date{font-size:12px;color:#64748b;margin-bottom:12px;}</style></head><body><h2>DRIV-EN Asset List</h2><div class="print-date">Generated: ' + new Date().toLocaleString() + ' | Total: ' + f.length + ' assets</div><table><thead><tr>';
      sc.forEach(function(col) { h += '<th>' + escapeHtml(col.label) + '</th>'; });
      h += '</tr></thead><tbody>';
      f.forEach(function(a) {
        h += '<tr>';
        sc.forEach(function(col) {
          var v = a[col.key];
          h += '<td>' + escapeHtml((v !== undefined && v !== null && v !== '') ? String(v) : '—') + '</td>';
        });
        h += '</tr>';
      });
      h += '</tbody></table></body></html>';

      var w = window.open('', '_blank');
      if (w) {
        w.document.write(h);
        w.document.close();
        w.focus();
        setTimeout(function() { w.print(); }, 300);
      }
      closeModal('amPrintModal');
    }

    var exportFormat = 'csv';
    function openExportModal(fmt) {
      exportFormat = fmt || 'csv';
      var c = document.getElementById('amExportCols');
      if (!c) return;
      c.textContent = '';
      COL_DEFS.forEach(function(col) {
        var i = document.createElement('label');
        i.className = 'am-check-item';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = visibleCols[col.key];
        cb.dataset.key = col.key;
        i.appendChild(cb);
        i.appendChild(document.createTextNode(col.label));
        c.appendChild(i);
      });
      var tEl = document.getElementById('amExportTitle');
      var bEl = document.getElementById('amExportBtn');
      if (exportFormat === 'excel') {
        if (tEl) tEl.textContent = 'Export to Excel';
        if (bEl) bEl.textContent = 'Download Excel';
      } else {
        if (tEl) tEl.textContent = 'Export to CSV';
        if (bEl) bEl.textContent = 'Download CSV';
      }
      openModal('amExportModal');
    }

    function doExport() {
      var cbs = document.querySelectorAll('#amExportCols input[type="checkbox"]');
      var sc = [];
      cbs.forEach(function(cb) {
        if (cb.checked) {
          var col = COL_DEFS.find(function(c) { return c.key === cb.dataset.key; });
          if (col) sc.push(col);
        }
      });
      if (sc.length === 0) { showMessage('Select at least one column to export.', 'error'); return; }

      var f = getFilteredSorted();
      var ds = new Date().toISOString().slice(0, 10);
      var lb = exportFormat === 'excel' ? 'Excel' : 'CSV';

      if (exportFormat === 'excel') {
        var h = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Assets</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table border="1"><thead><tr>';
        sc.forEach(function(col) { h += '<th style="background:#e2e8f0;font-weight:bold;">' + escapeHtml(col.label) + '</th>'; });
        h += '</tr></thead><tbody>';
        f.forEach(function(a) {
          h += '<tr>';
          sc.forEach(function(col) {
            var v = a[col.key];
            h += '<td>' + escapeHtml((v !== undefined && v !== null && v !== '') ? String(v) : '') + '</td>';
          });
          h += '</tr>';
        });
        h += '</tbody></table></body></html>';

        var b = new Blob([h], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        var u = URL.createObjectURL(b);
        var l = document.createElement('a');
        l.href = u;
        l.download = 'driv-en-assets-' + ds + '.xls';
        document.body.appendChild(l);
        l.click();
        document.body.removeChild(l);
        URL.revokeObjectURL(u);
      } else {
        var csv = sc.map(function(c) { return csvEscape(c.label); }).join(',') + '\n';
        f.forEach(function(a) {
          var row = sc.map(function(col) {
            var v = a[col.key];
            return csvEscape((v !== undefined && v !== null && v !== '') ? String(v) : '');
          });
          csv += row.join(',') + '\n';
        });
        var b = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var u = URL.createObjectURL(b);
        var l = document.createElement('a');
        l.href = u;
        l.download = 'driv-en-assets-' + ds + '.csv';
        document.body.appendChild(l);
        l.click();
        document.body.removeChild(l);
        URL.revokeObjectURL(u);
      }

      closeModal('amExportModal');
      showMessage('Exported ' + f.length + ' assets to ' + lb + '.', 'success');
    }

    function csvEscape(v) {
      if (v === null || v === undefined) return '';
      var s = String(v);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
        return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    function getFilteredSorted() {
      var searchEl = document.getElementById('amSearch');
      var s = searchEl ? searchEl.value.toLowerCase().trim() : '';

      var selTypes = getSelectedValues('panelTypes');
      var selStatuses = getSelectedValues('panelStatuses');
      var selProjects = getSelectedValues('panelProjects');
      var selLocations = getSelectedValues('panelLocations');

      var f = allAssets.filter(function(a) {
        var ms = !s || (a.assetNumber && a.assetNumber.toLowerCase().indexOf(s) !== -1) ||
                       (a.type && a.type.toLowerCase().indexOf(s) !== -1) ||
                       (a.project && a.project.toLowerCase().indexOf(s) !== -1) ||
                       (a.location && a.location.toLowerCase().indexOf(s) !== -1) ||
                       (a.assignedTo && a.assignedTo.toLowerCase().indexOf(s) !== -1);
        var mt = selTypes.length === 0 || (a.type && selTypes.indexOf(a.type.toLowerCase()) !== -1);
        var mst = selStatuses.length === 0 || (a.status && selStatuses.indexOf(a.status.toLowerCase()) !== -1);
        var mp = selProjects.length === 0 || (a.project && selProjects.indexOf(a.project.toLowerCase()) !== -1);
        var ml = selLocations.length === 0 || (a.location && selLocations.indexOf(a.location.toLowerCase()) !== -1);
        return ms && mt && mst && mp && ml;
      });

      f.sort(function(a, b) {
        var va = a[sortKey] || '', vb = b[sortKey] || '';
        if (sortKey === 'meter') {
          va = (va === null || va === '' || va === undefined) ? -1 : parseFloat(va);
          vb = (vb === null || vb === '' || vb === undefined) ? -1 : parseFloat(vb);
          return sortDir === 'asc' ? va - vb : vb - va;
        }
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
      return f;
    }

    function escapeHtml(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    var mEdit = document.getElementById('amEditModal');
    if (mEdit) mEdit.addEventListener('click', function(e) { if (e.target === this) closeEditModal(); });

    var mStreet = document.getElementById('amStreetViewModal');
    if (mStreet) mStreet.addEventListener('click', function(e) { if (e.target === this) closeModal('amStreetViewModal'); });

    var mPrint = document.getElementById('amPrintModal');
    if (mPrint) mPrint.addEventListener('click', function(e) { if (e.target === this) closeModal('amPrintModal'); });

    var mExport = document.getElementById('amExportModal');
    if (mExport) mExport.addEventListener('click', function(e) { if (e.target === this) closeModal('amExportModal'); });

    var mPurp = document.getElementById('amPurposeModal');
    if (mPurp) mPurp.addEventListener('click', function(e) { if (e.target === this) closeModal('amPurposeModal'); });

    var mInst = document.getElementById('amInstructionsModal');
    if (mInst) mInst.addEventListener('click', function(e) { if (e.target === this) closeModal('amInstructionsModal'); });

    function switchTab(tab) {
      document.querySelectorAll('.am-tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.am-tab-content').forEach(function(c) {
        c.style.display = 'none';
        c.classList.remove('active');
      });
      var targetTab = document.querySelector('.am-tab[data-tab="' + tab + '"]');
      if (targetTab) targetTab.classList.add('active');

      var targetContent = document.getElementById('tab-' + tab);
      if (targetContent) {
        targetContent.style.display = 'block';
        targetContent.classList.add('active');
      }

      if (tab === 'location') {
        setTimeout(initAssetMap, 100);
      }
    }

    function goToMainDashboard() {
      if (amDirty) {
        if (!confirm('You have unsaved changes. Click OK to leave without saving, or Cancel to stay.')) return;
      }
      var u = window.dashUser || window.drivenUser;
      if (!u) {
        try { u = JSON.parse(localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user")); } catch(e) {}
      }
      if (!u) { window.location.href = '/public/login.html'; return; }
      var r = String(u.role || '').toLowerCase();
      if (r.indexOf('founder') !== -1 || r.indexOf('owner') !== -1) {
        window.location.href = '/app/dashboard/owner-dashboard.html';
      } else if (r.indexOf('admin') !== -1) {
        window.location.href = '/app/dashboard/admin.html';
      } else {
        window.location.href = '/app/dashboard/employee-dashboard.html';
      }
    }

    function confirmLogout() {
      if (amDirty) {
        if (!confirm('You have unsaved changes. Click OK to log out without saving, or Cancel to stay.')) return;
      }
      if (typeof dashLogout === 'function') dashLogout();
      else window.location.href = '/public/login.html';
    }

    window.addEventListener('beforeunload', function(e) {
      if (amDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes.';
      }
    });

    function fixHeaderLayout() {
      var h = document.querySelector('.dash-header');
      if (!h) return false;
      var r1 = h.querySelector('.dash-header-row1');
      var r2 = h.querySelector('.dash-header-row2');
      var r3 = h.querySelector('.dash-header-row3');
      var h1 = r2 ? r2.querySelector('h1') : null;

      if (!r1 || !h1) return false;
      if (h1.parentNode === r1) return true;

      var dl = r1.querySelector('.dash-driven-logo');
      r1.insertBefore(h1, dl);
      r1.style.cssText = 'display:flex !important; justify-content:space-between !important; align-items:center !important; padding:8px 20px !important; gap:16px !important; width:100% !important; box-sizing:border-box !important;';
      h1.style.cssText = 'margin:0; font-size:20px; font-weight:600; text-align:center; flex:1;';

      if (r2) r2.style.display = 'none';
      if (r3) r3.style.display = 'none';
      return true;
    }

    function showMessage(msg, type) {
      var el = document.getElementById('amMessage');
      if (!el) return;
      el.textContent = msg;
      el.className = 'am-message ' + type;
      el.style.display = 'block';
      setTimeout(function() { el.style.display = 'none'; }, 5000);
    }

    function showEditMessage(msg, type) {
      var el = document.getElementById('amEditMessage');
      if (!el) return;
      el.textContent = msg;
      el.className = 'am-message ' + type;
      el.style.display = 'block';
      setTimeout(function() { el.style.display = 'none'; }, 5000);
    }

    var assetNumInput = document.getElementById('amAssetNumber');
    if (assetNumInput) {
      assetNumInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          addAsset();
        }
      });
    }
