/**
 * project-management.js — DRIV-EN Project Management page logic (v1)
 *
 * Extracted from project-management.html inline script.
 * Handles: projects, project types, and clients CRUD, overview KPIs,
 * sortable/paginated tables, column toggle, print/export, and tab switching.
 *
 * Upgrades applied:
 *   - rebuildHeader() replaces fixHeaderLayout() — single-row header matching admin.html
 *   - role_id support in goToMainDashboard()
 *   - Voice integration: initVoice() calls, data-voice-input, data-voice-read
 *   - All event listeners via bindStaticEvents() — no inline handlers
 */
(function() {
  'use strict';

  // ===== STATE =====
  var allProjects = [];
  var allClients = [];
  var projectTypes = [];
  var editingProjectId = null;
  var editingClientId = null;
  var editingTypeIndex = null;
  var canModify = false;
  var pmDirty = false;

  // ===== PROJECT COLUMN DEFINITIONS =====
  var PROJECT_COL_DEFS = [
    { key: 'name',       label: 'Project Name', defaultVisible: true },
    { key: 'code',       label: 'Project Number', defaultVisible: true },
    { key: 'status',     label: 'Status',       defaultVisible: true },
    { key: 'location',   label: 'Location',     defaultVisible: true },
    { key: 'createdAt',  label: 'Created Date', defaultVisible: false },
  ];

  // ===== CLIENT COLUMN DEFINITIONS =====
  var CLIENT_COL_DEFS = [
    { key: 'clientName',   label: 'Client Name',  defaultVisible: true },
    { key: 'contactName',  label: 'Contact Name', defaultVisible: true },
    { key: 'contactEmail', label: 'Email',        defaultVisible: true },
    { key: 'contactPhone', label: 'Phone',        defaultVisible: true },
    { key: 'industry',     label: 'Industry',     defaultVisible: false },
    { key: 'city',         label: 'City',          defaultVisible: false },
    { key: 'state',        label: 'State',         defaultVisible: false },
    { key: 'status',       label: 'Status',        defaultVisible: true },
    { key: 'createdAt',    label: 'Created Date',  defaultVisible: false },
  ];

  // ===== SORTING & PAGINATION STATE =====
  var projectSortKey = 'name';
  var projectSortDir = 'asc';
  var projectPage = 1;
  var projectPageSize = 10;
  var projectVisibleCols = {};

  var clientSortKey = 'clientName';
  var clientSortDir = 'asc';
  var clientPage = 1;
  var clientPageSize = 10;
  var clientVisibleCols = {};

  var projectExportFormat = 'csv';
  var clientExportFormat = 'csv';

  // ===== HEADER REBUILD (matches admin.html pattern) =====
  function rebuildHeader() {
    var header = document.getElementById('dashHeader');
    if (!header) return;

    var title = document.body.getAttribute('data-page-title') || 'Dashboard';

    var logoArea = header.querySelector('#dashCustomerLogoArea');
    var drivenLogo = header.querySelector('.dash-driven-logo') || header.querySelector('img.dash-driven-logo');

    header.innerHTML = '';

    var dashHeader = document.createElement('div');
    dashHeader.className = 'dash-header';

    var row1 = document.createElement('div');
    row1.className = 'dash-header-row1';

    var left = document.createElement('div');
    left.className = 'dash-header-logo-left';
    if (logoArea) {
      left.appendChild(logoArea);
    } else {
      var ph = document.createElement('div');
      ph.id = 'dashCustomerLogoArea';
      ph.innerHTML = '<div class="dash-customer-logo-placeholder">No logo uploaded</div>';
      left.appendChild(ph);
    }
    row1.appendChild(left);

    var h1 = document.createElement('h1');
    h1.id = 'dashPageTitle';
    h1.className = 'dash-header-title';
    h1.textContent = title;
    row1.appendChild(h1);

    var right = document.createElement('div');
    right.className = 'dash-header-logo-right';
    if (drivenLogo) {
      right.appendChild(drivenLogo);
    } else {
      var img = document.createElement('img');
      img.src = '/assets/logo.png?v=2026';
      img.className = 'dash-driven-logo';
      img.alt = 'DRIV-EN Logo';
      right.appendChild(img);
    }
    row1.appendChild(right);

    dashHeader.appendChild(row1);
    header.appendChild(dashHeader);
  }

  function startHeaderObserver() {
    var header = document.getElementById('dashHeader');
    if (!header) return;

    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes.length > 0) {
          observer.disconnect();
          rebuildHeader();
          setTimeout(function() { startHeaderObserver(); }, 100);
          return;
        }
      }
    });
    observer.observe(header, { childList: true, subtree: true });
  }

  function scheduleHeaderRebuilds() {
    setTimeout(rebuildHeader, 50);
    setTimeout(rebuildHeader, 200);
    setTimeout(rebuildHeader, 500);
    setTimeout(rebuildHeader, 1000);
    setTimeout(rebuildHeader, 2000);
    setTimeout(rebuildHeader, 3000);
  }

  // ===== VISIBLE COLS =====
  function initVisibleCols() {
    try {
      var savedP = JSON.parse(localStorage.getItem('driven_pm_proj_cols') || '{}');
      PROJECT_COL_DEFS.forEach(function(c) {
        projectVisibleCols[c.key] = (savedP[c.key] !== undefined) ? savedP[c.key] : c.defaultVisible;
      });
    } catch(e) {
      PROJECT_COL_DEFS.forEach(function(c) { projectVisibleCols[c.key] = c.defaultVisible; });
    }
    try {
      var savedC = JSON.parse(localStorage.getItem('driven_pm_cli_cols') || '{}');
      CLIENT_COL_DEFS.forEach(function(c) {
        clientVisibleCols[c.key] = (savedC[c.key] !== undefined) ? savedC[c.key] : c.defaultVisible;
      });
    } catch(e) {
      CLIENT_COL_DEFS.forEach(function(c) { clientVisibleCols[c.key] = c.defaultVisible; });
    }
  }

  function saveProjectVisibleCols() {
    try { localStorage.setItem('driven_pm_proj_cols', JSON.stringify(projectVisibleCols)); } catch(e) {}
  }
  function saveClientVisibleCols() {
    try { localStorage.setItem('driven_pm_cli_cols', JSON.stringify(clientVisibleCols)); } catch(e) {}
  }

  // ===== INIT =====
  var pmInitDone = false;
  document.addEventListener('dashSessionLoaded', initProjectManagement);
  if (document.readyState !== 'loading') { initProjectManagement(); }

  async function initProjectManagement() {
    if (pmInitDone) return;
    pmInitDone = true;
    rebuildHeader();
    startHeaderObserver();
    scheduleHeaderRebuilds();

    // ===== Dynamically set header height for sticky tab bar =====
    function updateHeaderHeight() {
      var header = document.getElementById('dashHeader');
      if (header) {
        var h = header.offsetHeight;
        if (h > 0) document.documentElement.style.setProperty('--header-height', h + 'px');
      }
    }
    updateHeaderHeight();
    setInterval(updateHeaderHeight, 500);
    window.addEventListener('resize', updateHeaderHeight);

    var user = window.dashUser || window.drivenUser;
    if (!user) {
      try { user = JSON.parse(localStorage.getItem('driven_user') || sessionStorage.getItem('driven_user')); } catch(e) {}
    }
    if (!user) { window.location.href = '/public/login.html'; return; }

    // ===== Populate welcome card =====
    var firstName = user.first_name || user.email || '';
    var orgName = user.org_name || localStorage.getItem('driven_org_name') || '';
    var welcomeNameEl = document.getElementById('pm-welcome-name');
    if (welcomeNameEl) {
      welcomeNameEl.textContent = firstName ? ('Welcome back, ' + firstName + (orgName ? ' - ' + orgName : '')) : 'Welcome back';
    }
    var welcomeRoleEl = document.getElementById('pm-welcome-role');
    if (welcomeRoleEl) welcomeRoleEl.textContent = user.role || user.role_id || '';
    var welcomeEmailEl = document.getElementById('pm-welcome-email');
    if (welcomeEmailEl) welcomeEmailEl.textContent = user.email || '';

    var role = (user.role || '').toLowerCase();
    var isAdmin = role === 'admin' || role === 'administrator' || role.indexOf('founder') !== -1 || role === 'owner';
    canModify = isAdmin;

    if (!isAdmin) {
      var customerId = localStorage.getItem('driven_customer_id');
      if (customerId) {
        try {
          var kpResp = await fetch('/api/onboarding/key-personnel/list?customerId=' + encodeURIComponent(customerId));
          var kpData = await kpResp.json();
          if (kpData.success && kpData.keyPersonnel) {
            var myEmail = user.email ? user.email.toLowerCase() : '';
            var myRecord = kpData.keyPersonnel.find(function(kp) {
              return kp.email && kp.email.toLowerCase() === myEmail;
            });
            if (myRecord && myRecord.roles) {
              var myTasks = myRecord.roles.map(function(r) { return r.role; });
              canModify = myTasks.indexOf('Projects') !== -1 || myTasks.indexOf('Clients') !== -1;
            }
          }
        } catch(e) {
          if (window.DRIVENErrorHandler) {
            window.DRIVENErrorHandler.report(
              'project-management.html: KP permission check failed — ' + (e.message || e),
              'kp-permission-check', e && e.stack ? e.stack : null
            );
          }
        }
      }
    }

    if (!canModify) {
      document.getElementById('addProjectForm').style.display = 'none';
      document.getElementById('addClientForm').style.display = 'none';
      document.getElementById('addTypeForm').style.display = 'none';
    }

    initVisibleCols();
    bindStaticEvents();
    await loadProjectTypes();
    await loadProjects();
    await loadClients();
    renderOverview();

    document.getElementById('pmLoading').style.display = 'none';
    document.getElementById('tab-overview').style.display = 'block';

    if (typeof initVoice === 'function') initVoice();
  }

  // ===== BIND STATIC EVENTS (replaces all inline handlers) =====
  function bindStaticEvents() {
    // Tab bar — delegate clicks for data-tab tabs
    document.querySelectorAll('.pm-tab[data-tab]').forEach(function(tab) {
      tab.addEventListener('click', function() { switchTab(tab.getAttribute('data-tab')); });
    });

    // Dashboard / Logout tabs
    var dashTab = document.getElementById('pmTabDashboard');
    if (dashTab) dashTab.addEventListener('click', goToMainDashboard);
    var logoutTab = document.getElementById('pmTabLogout');
    if (logoutTab) logoutTab.addEventListener('click', confirmLogout);

    // Projects search row
    var ps = document.getElementById('pmProjectSearch');
    if (ps) ps.addEventListener('input', onProjectSearchInput);
    var pfs = document.getElementById('pmProjectFilterStatus');
    if (pfs) pfs.addEventListener('change', renderProjectTable);
    var bpCols = document.getElementById('btnProjectCols');
    if (bpCols) bpCols.addEventListener('click', toggleProjectColPanel);
    var bpPrint = document.getElementById('btnProjectPrint');
    if (bpPrint) bpPrint.addEventListener('click', openProjectPrintModal);
    var bpCsv = document.getElementById('btnProjectExportCsv');
    if (bpCsv) bpCsv.addEventListener('click', function() { openProjectExportModal('csv'); });
    var bpXls = document.getElementById('btnProjectExportExcel');
    if (bpXls) bpXls.addEventListener('click', function() { openProjectExportModal('excel'); });

    // Add Project button
    var btnAddProj = document.getElementById('btnAddProject');
    if (btnAddProj) btnAddProj.addEventListener('click', addProject);

    // Add Type button
    var btnAddType = document.getElementById('btnAddType');
    if (btnAddType) btnAddType.addEventListener('click', addProjectType);

    // Clients search row
    var cs = document.getElementById('pmClientSearch');
    if (cs) cs.addEventListener('input', onClientSearchInput);
    var cfs = document.getElementById('pmClientFilterStatus');
    if (cfs) cfs.addEventListener('change', renderClientTable);
    var bcCols = document.getElementById('btnClientCols');
    if (bcCols) bcCols.addEventListener('click', toggleClientColPanel);
    var bcPrint = document.getElementById('btnClientPrint');
    if (bcPrint) bcPrint.addEventListener('click', openClientPrintModal);
    var bcCsv = document.getElementById('btnClientExportCsv');
    if (bcCsv) bcCsv.addEventListener('click', function() { openClientExportModal('csv'); });
    var bcXls = document.getElementById('btnClientExportExcel');
    if (bcXls) bcXls.addEventListener('click', function() { openClientExportModal('excel'); });

    // Add Client button
    var btnAddCli = document.getElementById('btnAddClient');
    if (btnAddCli) btnAddCli.addEventListener('click', addClient);

    // Edit Project modal
    var btnCancelEP = document.getElementById('btnCancelEditProject');
    if (btnCancelEP) btnCancelEP.addEventListener('click', closeEditProjectModal);
    var btnSaveEP = document.getElementById('btnSaveEditProject');
    if (btnSaveEP) btnSaveEP.addEventListener('click', saveEditProject);

    // Edit Client modal
    var btnCancelEC = document.getElementById('btnCancelEditClient');
    if (btnCancelEC) btnCancelEC.addEventListener('click', closeEditClientModal);
    var btnSaveEC = document.getElementById('btnSaveEditClient');
    if (btnSaveEC) btnSaveEC.addEventListener('click', saveEditClient);

    // Edit Type modal
    var btnCancelET = document.getElementById('btnCancelEditType');
    if (btnCancelET) btnCancelET.addEventListener('click', closeEditTypeModal);
    var btnSaveET = document.getElementById('btnSaveEditType');
    if (btnSaveET) btnSaveET.addEventListener('click', saveEditProjectType);

    // Print/Export modal buttons
    var btnCanPP = document.getElementById('btnCancelProjectPrint');
    if (btnCanPP) btnCanPP.addEventListener('click', function() { closeModal('pmProjectPrintModal'); });
    var btnDoPP = document.getElementById('btnDoProjectPrint');
    if (btnDoPP) btnDoPP.addEventListener('click', doProjectPrint);
    var btnCanPE = document.getElementById('btnCancelProjectExport');
    if (btnCanPE) btnCanPE.addEventListener('click', function() { closeModal('pmProjectExportModal'); });
    var btnDoPE = document.getElementById('pmProjectExportBtn');
    if (btnDoPE) btnDoPE.addEventListener('click', doProjectExport);
    var btnCanCP = document.getElementById('btnCancelClientPrint');
    if (btnCanCP) btnCanCP.addEventListener('click', function() { closeModal('pmClientPrintModal'); });
    var btnDoCP = document.getElementById('btnDoClientPrint');
    if (btnDoCP) btnDoCP.addEventListener('click', doClientPrint);
    var btnCanCE = document.getElementById('btnCancelClientExport');
    if (btnCanCE) btnCanCE.addEventListener('click', function() { closeModal('pmClientExportModal'); });
    var btnDoCE = document.getElementById('pmClientExportBtn');
    if (btnDoCE) btnDoCE.addEventListener('click', doClientExport);

    // Modal overlay clicks (close when clicking outside the card)
    var modals = ['pmEditProjectModal','pmEditClientModal','pmEditTypeModal','pmProjectPrintModal','pmProjectExportModal','pmClientPrintModal','pmClientExportModal'];
    modals.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function(e) { if (e.target === el) closeModal(id); });
    });

    // Keyboard: Enter in project name field triggers Add
    var pn = document.getElementById('pmProjectName');
    if (pn) pn.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); addProject(); } });
    var cn = document.getElementById('pmClientName');
    if (cn) cn.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); addClient(); } });

    // Close column panels on outside click
    document.addEventListener('click', function(e) {
      var pPanel = document.getElementById('pmProjectColPanel');
      if (pPanel && pPanel.classList.contains('active') && !pPanel.contains(e.target) && e.target.textContent !== 'Columns') {
        pPanel.classList.remove('active');
      }
      var cPanel = document.getElementById('pmClientColPanel');
      if (cPanel && cPanel.classList.contains('active') && !cPanel.contains(e.target) && e.target.textContent !== 'Columns') {
        cPanel.classList.remove('active');
      }
    });

    // beforeunload
    window.addEventListener('beforeunload', function(e) {
      if (pmDirty) { e.preventDefault(); e.returnValue = 'You have unsaved changes.'; }
    });
  }

  // ===== NORMALIZE PROJECT =====
  function normalizeProject(r) {
    var f = (r && r.fields && typeof r.fields === 'object') ? r.fields : r;
    return {
      id: r.id || ('prj-' + Math.random().toString(36).substr(2, 9)),
      name:       f['Project Name'] || f.name || '',
      code:       f['Project Code'] || f.code || '',
      status:     f['Status'] || f.status || 'Active',
      location:   f['Location'] || f.location || '',
      createdAt:  f['Created Date'] || f.created_at || '',
    };
  }

  // ===== NORMALIZE CLIENT =====
  function normalizeClient(r) {
    var f = (r && r.fields && typeof r.fields === 'object') ? r.fields : r;
    return {
      id: r.id || ('cli-' + Math.random().toString(36).substr(2, 9)),
      clientName:   f['Client Name'] || f.client_name || '',
      contactName:  f['Contact Name'] || f.contact_name || '',
      contactEmail: f['Contact Email'] || f.contact_email || '',
      contactPhone: f['Contact Phone'] || f.contact_phone || '',
      address:      f['Address'] || f.address || '',
      city:         f['City'] || f.city || '',
      state:        f['State'] || f.state || '',
      zip:          f['Zip Code'] || f.zip_code || '',
      country:      f['Country'] || f.country || '',
      industry:     f['Industry'] || f.industry || '',
      status:       f['Status'] || f.status || 'Active',
      notes:        f['Notes'] || f.notes || '',
      createdAt:    f['Created Date'] || f.created_at || '',
    };
  }

  // ===== LOAD PROJECTS =====
  async function loadProjects() {
    try {
      var resp = await fetch('/api/Project');
      var data = await resp.json();
      if (resp.ok && data && data.records) {
        allProjects = data.records.map(normalizeProject);
      } else {
        allProjects = [];
      }
    } catch(e) {
      console.error('loadProjects error:', e);
      allProjects = [];
      if (window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report('project-management.html: loadProjects failed — ' + (e.message || e), 'loadProjects', e && e.stack ? e.stack : null);
      }
    }
    renderProjectTableHead();
    renderProjectTable();
    renderProjectColTogglePanel();
  }

  // ===== LOAD CLIENTS =====
  async function loadClients() {
    try {
      var resp = await fetch('/api/Clients');
      var data = await resp.json();
      if (resp.ok && data && data.records) {
        allClients = data.records.map(normalizeClient);
      } else {
        allClients = [];
      }
    } catch(e) {
      console.error('loadClients error:', e);
      allClients = [];
      if (window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report('project-management.html: loadClients failed — ' + (e.message || e), 'loadClients', e && e.stack ? e.stack : null);
      }
    }
    renderClientTableHead();
    renderClientTable();
    renderClientColTogglePanel();
  }

  // ===== LOAD PROJECT TYPES (from onboarding settings) =====
  async function loadProjectTypes() {
    try {
      var res = await fetch('/auth/get-settings');
      if (!res.ok) throw new Error('Settings fetch failed: ' + res.status);
      var data = await res.json();
      var settings = (data && data.settings) ? data.settings : {};
      var raw = settings.project_types;
      if (typeof raw === 'string') {
        try { projectTypes = JSON.parse(raw); } catch(e) { projectTypes = []; }
      } else if (Array.isArray(raw)) {
        projectTypes = raw;
      } else {
        try { projectTypes = JSON.parse(localStorage.getItem('driven_project_types') || '[]'); } catch(e) { projectTypes = []; }
      }
    } catch(e) {
      try { projectTypes = JSON.parse(localStorage.getItem('driven_project_types') || '[]'); } catch(e2) { projectTypes = []; }
    }
    renderProjectTypes();
  }

  // ===== SAVE PROJECT TYPES =====
  async function saveProjectTypes() {
    try {
      var res = await fetch('/auth/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_types: JSON.stringify(projectTypes) })
      });
      if (res.ok) {
        try { localStorage.setItem('driven_project_types', JSON.stringify(projectTypes)); } catch(e) {}
      }
    } catch(e) {
      console.error('saveProjectTypes error:', e);
    }
  }

  // ===== RENDER OVERVIEW =====
  function renderOverview() {
    document.getElementById('kpiTotalProjects').textContent = allProjects.length;
    document.getElementById('kpiActiveProjects').textContent = allProjects.filter(function(p) { return String(p.status || '').toLowerCase() === 'active'; }).length;
    document.getElementById('kpiCompletedProjects').textContent = allProjects.filter(function(p) { return String(p.status || '').toLowerCase() === 'completed'; }).length;
    document.getElementById('kpiTotalClients').textContent = allClients.length;

    var recentProjects = allProjects.slice().sort(function(a, b) {
      var da = a.createdAt || ''; var db = b.createdAt || '';
      return db < da ? -1 : db > da ? 1 : 0;
    }).slice(0, 5);
    document.getElementById('recentProjectsCount').textContent = recentProjects.length;
    var projBody = document.getElementById('pmOverviewProjectsBody');
    projBody.textContent = '';
    if (recentProjects.length === 0) {
      projBody.innerHTML = '<tr><td class="pm-empty">No projects yet.</td></tr>';
    } else {
      recentProjects.forEach(function(p) {
        var tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', function() { switchTab('projects'); });
        tr.innerHTML = '<td>' + escapeHtml(p.code || '—') + '</td><td style="font-weight:600;">' + escapeHtml(p.name || '') + '</td><td>' + escapeHtml(p.clientName || p.client_name || '—') + '</td><td>' + statusBadgeHtml(p.status) + '</td>';
        projBody.appendChild(tr);
      });
    }

    var recentClients = allClients.slice().sort(function(a, b) {
      var da = a.createdAt || ''; var db = b.createdAt || '';
      return db < da ? -1 : db > da ? 1 : 0;
    }).slice(0, 5);
    document.getElementById('recentClientsCount').textContent = recentClients.length;
    var cliBody = document.getElementById('pmOverviewClientsBody');
    cliBody.textContent = '';
    if (recentClients.length === 0) {
      cliBody.innerHTML = '<tr><td class="pm-empty">No clients yet.</td></tr>';
    } else {
      recentClients.forEach(function(c) {
        var tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', function() { switchTab('clients'); });
        tr.innerHTML = '<td style="font-weight:600;">' + escapeHtml(c.clientName || '') + '</td><td>' + escapeHtml(c.contactName || c.contactEmail || '—') + '</td><td>' + statusBadgeHtml(c.status) + '</td>';
        cliBody.appendChild(tr);
      });
    }

    if (typeof initVoice === 'function') initVoice();
  }

  function statusBadgeHtml(status) {
    if (!status) return '—';
    var cls = 'pm-badge pm-badge-' + String(status).toLowerCase().replace(/\s+/g, '-');
    return '<span class="' + cls + '">' + escapeHtml(status) + '</span>';
  }

  // ===== RENDER PROJECT TABLE HEAD =====
  function renderProjectTableHead() {
    var thead = document.getElementById('pmProjectTableHead');
    thead.textContent = '';
    var tr = document.createElement('tr');
    PROJECT_COL_DEFS.forEach(function(col) {
      if (!projectVisibleCols[col.key]) return;
      var th = document.createElement('th');
      th.dataset.key = col.key;
      th.textContent = col.label;
      var arrow = document.createElement('span');
      arrow.className = 'pm-sort-arrow';
      if (projectSortKey === col.key) {
        arrow.textContent = projectSortDir === 'asc' ? ' ▲' : ' ▼';
        th.classList.add(projectSortDir === 'asc' ? 'pm-sorted-asc' : 'pm-sorted-desc');
      } else {
        arrow.textContent = ' ↕';
      }
      th.appendChild(arrow);
      th.addEventListener('click', function() { onProjectSortClick(col.key); });
      tr.appendChild(th);
    });
    if (canModify) {
      var thActions = document.createElement('th');
      thActions.textContent = 'Actions';
      thActions.style.cursor = 'default';
      tr.appendChild(thActions);
    }
    thead.appendChild(tr);
  }

  function onProjectSortClick(key) {
    if (projectSortKey === key) {
      projectSortDir = (projectSortDir === 'asc') ? 'desc' : 'asc';
    } else {
      projectSortKey = key;
      projectSortDir = 'asc';
    }
    projectPage = 1;
    renderProjectTableHead();
    renderProjectTable();
  }

  var projectSearchTimer = null;
  function onProjectSearchInput() {
    clearTimeout(projectSearchTimer);
    projectSearchTimer = setTimeout(function() {
      projectPage = 1;
      renderProjectTable();
    }, 200);
  }

  // ===== RENDER PROJECT TABLE =====
  function renderProjectTable() {
    var tbody = document.getElementById('pmProjectTableBody');
    var search = document.getElementById('pmProjectSearch').value.toLowerCase().trim();
    var filterStatus = document.getElementById('pmProjectFilterStatus').value;

    var filtered = allProjects.filter(function(p) {
      var matchesSearch = !search ||
        (p.name && p.name.toLowerCase().indexOf(search) !== -1) ||
        (p.code && p.code.toLowerCase().indexOf(search) !== -1) ||
        (p.location && p.location.toLowerCase().indexOf(search) !== -1);
      var matchesStatus = !filterStatus || (p.status && p.status.toLowerCase() === filterStatus.toLowerCase());
      return matchesSearch && matchesStatus;
    });

    filtered.sort(function(a, b) {
      var va = a[projectSortKey] || '';
      var vb = b[projectSortKey] || '';
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return projectSortDir === 'asc' ? -1 : 1;
      if (va > vb) return projectSortDir === 'asc' ? 1 : -1;
      return 0;
    });

    document.getElementById('pmProjectCount').textContent = filtered.length + ' project' + (filtered.length === 1 ? '' : 's');

    var totalPages = Math.max(1, Math.ceil(filtered.length / projectPageSize));
    if (projectPage > totalPages) projectPage = totalPages;
    var startIdx = (projectPage - 1) * projectPageSize;
    var pageItems = filtered.slice(startIdx, startIdx + projectPageSize);

    tbody.textContent = '';
    if (filtered.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.className = 'pm-empty';
      td.textContent = allProjects.length === 0 ? 'No projects found. Add your first project above.' : 'No projects match your search.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      renderPagination('pmProjectPagination', 0, 1, projectPage, projectPageSize, function(p) { projectPage = p; renderProjectTable(); }, function(sz) { projectPageSize = sz; projectPage = 1; renderProjectTable(); });
      return;
    }

    pageItems.forEach(function(p) {
      var tr = document.createElement('tr');
      PROJECT_COL_DEFS.forEach(function(col) {
        if (!projectVisibleCols[col.key]) return;
        var td = document.createElement('td');
        var val = p[col.key];
        if (col.key === 'status' && val) {
          td.innerHTML = statusBadgeHtml(val);
        } else if (col.key === 'createdAt') {
          td.textContent = val ? new Date(val).toLocaleDateString() : '—';
        } else {
          td.textContent = (val !== undefined && val !== null && val !== '') ? val : '—';
        }
        tr.appendChild(td);
      });
      if (canModify) {
        var actionsTd = document.createElement('td');
        actionsTd.className = 'pm-actions';
        var btnEdit = document.createElement('button');
        btnEdit.className = 'pm-table-btn';
        btnEdit.textContent = 'Edit';
        btnEdit.addEventListener('click', function() { openEditProjectModal(p.id); });
        actionsTd.appendChild(btnEdit);
        var btnDelete = document.createElement('button');
        btnDelete.className = 'pm-table-btn danger';
        btnDelete.textContent = 'Delete';
        btnDelete.addEventListener('click', function() { deleteProject(p.id); });
        actionsTd.appendChild(btnDelete);
        tr.appendChild(actionsTd);
      }
      tbody.appendChild(tr);
    });

    renderPagination('pmProjectPagination', filtered.length, totalPages, projectPage, projectPageSize, function(p) { projectPage = p; renderProjectTable(); }, function(sz) { projectPageSize = sz; projectPage = 1; renderProjectTable(); });
    if (typeof initVoice === 'function') initVoice();
  }

  // ===== RENDER CLIENT TABLE HEAD =====
  function renderClientTableHead() {
    var thead = document.getElementById('pmClientTableHead');
    thead.textContent = '';
    var tr = document.createElement('tr');
    CLIENT_COL_DEFS.forEach(function(col) {
      if (!clientVisibleCols[col.key]) return;
      var th = document.createElement('th');
      th.dataset.key = col.key;
      th.textContent = col.label;
      var arrow = document.createElement('span');
      arrow.className = 'pm-sort-arrow';
      if (clientSortKey === col.key) {
        arrow.textContent = clientSortDir === 'asc' ? ' ▲' : ' ▼';
        th.classList.add(clientSortDir === 'asc' ? 'pm-sorted-asc' : 'pm-sorted-desc');
      } else {
        arrow.textContent = ' ↕';
      }
      th.appendChild(arrow);
      th.addEventListener('click', function() { onClientSortClick(col.key); });
      tr.appendChild(th);
    });
    if (canModify) {
      var thActions = document.createElement('th');
      thActions.textContent = 'Actions';
      thActions.style.cursor = 'default';
      tr.appendChild(thActions);
    }
    thead.appendChild(tr);
  }

  function onClientSortClick(key) {
    if (clientSortKey === key) {
      clientSortDir = (clientSortDir === 'asc') ? 'desc' : 'asc';
    } else {
      clientSortKey = key;
      clientSortDir = 'asc';
    }
    clientPage = 1;
    renderClientTableHead();
    renderClientTable();
  }

  var clientSearchTimer = null;
  function onClientSearchInput() {
    clearTimeout(clientSearchTimer);
    clientSearchTimer = setTimeout(function() {
      clientPage = 1;
      renderClientTable();
    }, 200);
  }

  // ===== RENDER CLIENT TABLE =====
  function renderClientTable() {
    var tbody = document.getElementById('pmClientTableBody');
    var search = document.getElementById('pmClientSearch').value.toLowerCase().trim();
    var filterStatus = document.getElementById('pmClientFilterStatus').value;

    var filtered = allClients.filter(function(c) {
      var matchesSearch = !search ||
        (c.clientName && c.clientName.toLowerCase().indexOf(search) !== -1) ||
        (c.contactName && c.contactName.toLowerCase().indexOf(search) !== -1) ||
        (c.contactEmail && c.contactEmail.toLowerCase().indexOf(search) !== -1) ;
      var matchesStatus = !filterStatus || (c.status && c.status.toLowerCase() === filterStatus.toLowerCase());
      return matchesSearch && matchesStatus;
    });

    filtered.sort(function(a, b) {
      var va = a[clientSortKey] || '';
      var vb = b[clientSortKey] || '';
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return clientSortDir === 'asc' ? -1 : 1;
      if (va > vb) return clientSortDir === 'asc' ? 1 : -1;
      return 0;
    });

    document.getElementById('pmClientCount').textContent = filtered.length + ' client' + (filtered.length === 1 ? '' : 's');

    var totalPages = Math.max(1, Math.ceil(filtered.length / clientPageSize));
    if (clientPage > totalPages) clientPage = totalPages;
    var startIdx = (clientPage - 1) * clientPageSize;
    var pageItems = filtered.slice(startIdx, startIdx + clientPageSize);

    tbody.textContent = '';
    if (filtered.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.className = 'pm-empty';
      td.textContent = allClients.length === 0 ? 'No clients found. Add your first client above.' : 'No clients match your search.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      renderPagination('pmClientPagination', 0, 1, clientPage, clientPageSize, function(p) { clientPage = p; renderClientTable(); }, function(sz) { clientPageSize = sz; clientPage = 1; renderClientTable(); });
      return;
    }

    pageItems.forEach(function(c) {
      var tr = document.createElement('tr');
      CLIENT_COL_DEFS.forEach(function(col) {
        if (!clientVisibleCols[col.key]) return;
        var td = document.createElement('td');
        var val = c[col.key];
        if (col.key === 'status' && val) {
          td.innerHTML = statusBadgeHtml(val);
        } else if (col.key === 'createdAt') {
          td.textContent = val ? new Date(val).toLocaleDateString() : '—';
        } else {
          td.textContent = (val !== undefined && val !== null && val !== '') ? val : '—';
        }
        tr.appendChild(td);
      });
      if (canModify) {
        var actionsTd = document.createElement('td');
        actionsTd.className = 'pm-actions';
        var btnEdit = document.createElement('button');
        btnEdit.className = 'pm-table-btn';
        btnEdit.textContent = 'Edit';
        btnEdit.addEventListener('click', function() { openEditClientModal(c.id); });
        actionsTd.appendChild(btnEdit);
        var btnDelete = document.createElement('button');
        btnDelete.className = 'pm-table-btn danger';
        btnDelete.textContent = 'Delete';
        btnDelete.addEventListener('click', function() { deleteClient(c.id); });
        actionsTd.appendChild(btnDelete);
        tr.appendChild(actionsTd);
      }
      tbody.appendChild(tr);
    });

    renderPagination('pmClientPagination', filtered.length, totalPages, clientPage, clientPageSize, function(p) { clientPage = p; renderClientTable(); }, function(sz) { clientPageSize = sz; clientPage = 1; renderClientTable(); });
    if (typeof initVoice === 'function') initVoice();
  }

  // ===== PAGINATION (shared) =====
  function renderPagination(containerId, totalItems, totalPages, currentPage, pageSize, onPageChange, onPageSizeChange) {
    var container = document.getElementById(containerId);
    container.textContent = '';
    if (totalItems === 0) return;

    var info = document.createElement('span');
    info.className = 'pm-page-info';
    var startIdx = (currentPage - 1) * pageSize + 1;
    var endIdx = Math.min(currentPage * pageSize, totalItems);
    info.textContent = 'Showing ' + startIdx + '–' + endIdx + ' of ' + totalItems;
    container.appendChild(info);

    var sizeDiv = document.createElement('div');
    sizeDiv.style.display = 'flex';
    sizeDiv.style.alignItems = 'center';
    sizeDiv.style.gap = '6px';
    var sizeLabel = document.createElement('span');
    sizeLabel.className = 'pm-page-info';
    sizeLabel.textContent = 'Per page:';
    sizeDiv.appendChild(sizeLabel);
    var sizeSelect = document.createElement('select');
    sizeSelect.className = 'pm-filter-select';
    sizeSelect.style.padding = '4px 8px';
    sizeSelect.style.fontSize = '13px';
    [10, 25, 50].forEach(function(sz) {
      var opt = document.createElement('option');
      opt.value = sz;
      opt.textContent = sz;
      if (sz === pageSize) opt.selected = true;
      sizeSelect.appendChild(opt);
    });
    sizeSelect.addEventListener('change', function() { onPageSizeChange(parseInt(sizeSelect.value)); });
    sizeDiv.appendChild(sizeSelect);
    container.appendChild(sizeDiv);

    var btnsDiv = document.createElement('div');
    btnsDiv.className = 'pm-page-btns';

    var btnPrev = document.createElement('button');
    btnPrev.className = 'pm-page-btn';
    btnPrev.textContent = '◀ Prev';
    btnPrev.disabled = currentPage <= 1;
    btnPrev.addEventListener('click', function() { onPageChange(currentPage - 1); });
    btnsDiv.appendChild(btnPrev);

    var maxVisible = 7;
    var startPage = 1, endPage = totalPages;
    if (totalPages > maxVisible) {
      if (currentPage <= 4) { startPage = 1; endPage = maxVisible; }
      else if (currentPage >= totalPages - 3) { startPage = totalPages - maxVisible + 1; endPage = totalPages; }
      else { startPage = currentPage - 3; endPage = currentPage + 3; }
    }
    for (var p = startPage; p <= endPage; p++) {
      var btn = document.createElement('button');
      btn.className = 'pm-page-btn' + (p === currentPage ? ' active' : '');
      btn.textContent = p;
      btn.addEventListener('click', function(page) { return function() { onPageChange(page); }; }(p));
      btnsDiv.appendChild(btn);
    }

    var btnNext = document.createElement('button');
    btnNext.className = 'pm-page-btn';
    btnNext.textContent = 'Next ▶';
    btnNext.disabled = currentPage >= totalPages;
    btnNext.addEventListener('click', function() { onPageChange(currentPage + 1); });
    btnsDiv.appendChild(btnNext);
    container.appendChild(btnsDiv);
  }

  // ===== COLUMN TOGGLE PANELS =====
  function toggleProjectColPanel(e) {
    e.stopPropagation();
    var panel = document.getElementById('pmProjectColPanel');
    panel.classList.toggle('active');
    if (panel.classList.contains('active')) {
      renderProjectColTogglePanel();
      var rect = e.target.getBoundingClientRect();
      panel.style.position = 'fixed';
      panel.style.top = (rect.bottom + 4) + 'px';
      panel.style.left = rect.left + 'px';
    }
  }

  function renderProjectColTogglePanel() {
    var container = document.getElementById('pmProjectColToggleItems');
    container.textContent = '';
    PROJECT_COL_DEFS.forEach(function(col) {
      var item = document.createElement('label');
      item.className = 'pm-col-toggle-item';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = projectVisibleCols[col.key];
      cb.addEventListener('change', function() {
        projectVisibleCols[col.key] = cb.checked;
        saveProjectVisibleCols();
        renderProjectTableHead();
        renderProjectTable();
      });
      item.appendChild(cb);
      item.appendChild(document.createTextNode(col.label));
      container.appendChild(item);
    });
  }

  function toggleClientColPanel(e) {
    e.stopPropagation();
    var panel = document.getElementById('pmClientColPanel');
    panel.classList.toggle('active');
    if (panel.classList.contains('active')) {
      renderClientColTogglePanel();
      var rect = e.target.getBoundingClientRect();
      panel.style.position = 'fixed';
      panel.style.top = (rect.bottom + 4) + 'px';
      panel.style.left = rect.left + 'px';
    }
  }

  function renderClientColTogglePanel() {
    var container = document.getElementById('pmClientColToggleItems');
    container.textContent = '';
    CLIENT_COL_DEFS.forEach(function(col) {
      var item = document.createElement('label');
      item.className = 'pm-col-toggle-item';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = clientVisibleCols[col.key];
      cb.addEventListener('change', function() {
        clientVisibleCols[col.key] = cb.checked;
        saveClientVisibleCols();
        renderClientTableHead();
        renderClientTable();
      });
      item.appendChild(cb);
      item.appendChild(document.createTextNode(col.label));
      container.appendChild(item);
    });
  }

  // ===== ADD PROJECT =====
  async function addProject() {
    var name = document.getElementById('pmProjectName').value.trim();
    var code = document.getElementById('pmProjectCode').value.trim();
    var status = document.getElementById('pmProjectStatus').value;
    var location = document.getElementById('pmProjectLocation').value.trim();

    if (!name) { showProjectMessage('Please enter a project name.', 'error'); return; }
    if (!code) { showProjectMessage('Please enter a project code.', 'error'); return; }

    var dup = allProjects.find(function(p) {
      return p.code && p.code.toLowerCase() === code.toLowerCase();
    });
    if (dup) {
      showProjectMessage('A project with code "' + code + '" already exists. Project codes must be unique.', 'error');
      return;
    }

    var payload = {
      'Project Name': name,
      'Project Code': code,
      'Status': status,
      'Location': location,
    };

    try {
      var resp = await fetch('/api/Project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.error || data.message || 'Save failed (' + resp.status + ')');

      if (data.record) {
        allProjects.push(normalizeProject(data.record));
      } else {
        await loadProjects();
      }

      document.getElementById('pmProjectName').value = '';
      document.getElementById('pmProjectCode').value = '';
      document.getElementById('pmProjectLocation').value = '';
      document.getElementById('pmProjectStatus').value = 'Active';
      showProjectMessage('Project "' + name + '" added.', 'success');
      renderOverview();
      switchTab('projects');
    } catch(e) {
      showProjectMessage('Failed to add project: ' + e.message, 'error');
      if (window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report('project-management.html: addProject failed — ' + (e.message || e), 'addProject', e && e.stack ? e.stack : null);
      }
    }
  }

  // ===== EDIT PROJECT =====
  function openEditProjectModal(projectId) {
    var project = allProjects.find(function(p) { return p.id === projectId; });
    if (!project) return;
    editingProjectId = projectId;
    document.getElementById('pmEditProjectName').value = project.name || '';
    document.getElementById('pmEditProjectCode').value = project.code || '';
    document.getElementById('pmEditProjectStatus').value = project.status || 'Active';
    document.getElementById('pmEditProjectLocation').value = project.location || '';
    document.getElementById('pmEditProjectModal').classList.add('active');
  }

  function closeEditProjectModal() {
    document.getElementById('pmEditProjectModal').classList.remove('active');
    editingProjectId = null;
  }

  async function saveEditProject() {
    if (!editingProjectId) return;
    var name = document.getElementById('pmEditProjectName').value.trim();
    var code = document.getElementById('pmEditProjectCode').value.trim();
    var status = document.getElementById('pmEditProjectStatus').value;
    var location = document.getElementById('pmEditProjectLocation').value.trim();

    if (!name) { showProjectMessage('Project name is required.', 'error'); return; }
    if (!code) { showProjectMessage('Project code is required.', 'error'); return; }

    var dup = allProjects.find(function(p) {
      return p.id !== editingProjectId && p.code && p.code.toLowerCase() === code.toLowerCase();
    });
    if (dup) {
      showProjectMessage('A project with code "' + code + '" already exists.', 'error');
      return;
    }

    var payload = {
      'Project Name': name,
      'Project Code': code,
      'Status': status,
      'Location': location,
    };

    try {
      var resp = await fetch('/api/Project/' + encodeURIComponent(editingProjectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.error || data.message || 'Update failed (' + resp.status + ')');

      if (data.record) {
        var updated = normalizeProject(data.record);
        var idx = allProjects.findIndex(function(p) { return p.id === editingProjectId; });
        if (idx !== -1) allProjects[idx] = updated;
      } else {
        var project = allProjects.find(function(p) { return p.id === editingProjectId; });
        if (project) { project.name = name; project.code = code; project.status = status; project.location = location; }
      }

      showProjectMessage('Project "' + name + '" updated.', 'success');
      closeEditProjectModal();
      renderProjectTable();
      renderOverview();
    } catch(e) {
      showProjectMessage('Failed to update project: ' + e.message, 'error');
      if (window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report('project-management.html: saveEditProject failed — ' + (e.message || e), 'saveEditProject', e && e.stack ? e.stack : null);
      }
    }
  }

  // ===== DELETE PROJECT =====
  async function deleteProject(projectId) {
    var project = allProjects.find(function(p) { return p.id === projectId; });
    if (!project) return;
    if (!confirm('Delete project "' + (project.name || project.code) + '"? This cannot be undone.')) return;

    try {
      var resp = await fetch('/api/Project/' + encodeURIComponent(projectId), { method: 'DELETE' });
      if (!resp.ok) {
        var data = await resp.json();
        throw new Error(data.error || data.message || 'Delete failed (' + resp.status + ')');
      }
      allProjects = allProjects.filter(function(p) { return p.id !== projectId; });
      showProjectMessage('Project "' + (project.name || project.code) + '" deleted.', 'success');
      renderProjectTable();
      renderOverview();
    } catch(e) {
      showProjectMessage('Failed to delete project: ' + e.message, 'error');
      if (window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report('project-management.html: deleteProject failed — ' + (e.message || e), 'deleteProject', e && e.stack ? e.stack : null);
      }
    }
  }

  // ===== ADD CLIENT =====
  async function addClient() {
    var clientName = document.getElementById('pmClientName').value.trim();
    var contactName = document.getElementById('pmContactName').value.trim();
    var contactEmail = document.getElementById('pmContactEmail').value.trim();
    var contactPhone = document.getElementById('pmContactPhone').value.trim();
    
    var industry = document.getElementById('pmIndustry').value.trim();
    var address = document.getElementById('pmAddress').value.trim();
    var city = document.getElementById('pmCity').value.trim();
    var state = document.getElementById('pmState').value.trim();
    var zip = document.getElementById('pmZip').value.trim();
    var status = document.getElementById('pmClientStatus').value;
    var notes = document.getElementById('pmClientNotes').value.trim();

    if (!clientName) { showClientMessage('Please enter a client name.', 'error'); return; }
    if (!contactName) { showClientMessage('Please enter a contact name.', 'error'); return; }
    if (!contactEmail) { showClientMessage('Please enter a contact email.', 'error'); return; }

    var payload = {
      'Client Name': clientName,
      'Contact Name': contactName,
      'Contact Email': contactEmail,
      'Status': status,
    };
    if (contactPhone) payload['Contact Phone'] = contactPhone;
    if (industry) payload['Industry'] = industry;
    if (address) payload['Address'] = address;
    if (city) payload['City'] = city;
    if (state) payload['State'] = state;
    if (zip) payload['Zip Code'] = zip;
    if (notes) payload['Notes'] = notes;

    try {
      var resp = await fetch('/api/Clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.error || data.message || 'Save failed (' + resp.status + ')');

      if (data.record) {
        allClients.push(normalizeClient(data.record));
      } else {
        await loadClients();
      }

      ['pmClientName','pmContactName','pmContactEmail','pmContactPhone','pmIndustry','pmAddress','pmCity','pmState','pmZip','pmClientNotes'].forEach(function(id) {
        document.getElementById(id).value = '';
      });
      document.getElementById('pmClientStatus').value = 'Active';
      showClientMessage('Client "' + clientName + '" added.', 'success');
      renderOverview();
      switchTab('clients');
    } catch(e) {
      showClientMessage('Failed to add client: ' + e.message, 'error');
      if (window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report('project-management.html: addClient failed — ' + (e.message || e), 'addClient', e && e.stack ? e.stack : null);
      }
    }
  }

  // ===== EDIT CLIENT =====
  function openEditClientModal(clientId) {
    var client = allClients.find(function(c) { return c.id === clientId; });
    if (!client) return;
    editingClientId = clientId;
    document.getElementById('pmEditClientName').value = client.clientName || '';
    document.getElementById('pmEditContactName').value = client.contactName || '';
    document.getElementById('pmEditContactEmail').value = client.contactEmail || '';
    document.getElementById('pmEditContactPhone').value = client.contactPhone || '';
    
    document.getElementById('pmEditIndustry').value = client.industry || '';
    document.getElementById('pmEditAddress').value = client.address || '';
    document.getElementById('pmEditCity').value = client.city || '';
    document.getElementById('pmEditState').value = client.state || '';
    document.getElementById('pmEditZip').value = client.zip || '';
    document.getElementById('pmEditClientStatus').value = client.status || 'Active';
    document.getElementById('pmEditClientNotes').value = client.notes || '';
    document.getElementById('pmEditClientModal').classList.add('active');
  }

  function closeEditClientModal() {
    document.getElementById('pmEditClientModal').classList.remove('active');
    editingClientId = null;
  }

  async function saveEditClient() {
    if (!editingClientId) return;
    var clientName = document.getElementById('pmEditClientName').value.trim();
    var contactName = document.getElementById('pmEditContactName').value.trim();
    var contactEmail = document.getElementById('pmEditContactEmail').value.trim();
    var contactPhone = document.getElementById('pmEditContactPhone').value.trim();
    
    var industry = document.getElementById('pmEditIndustry').value.trim();
    var address = document.getElementById('pmEditAddress').value.trim();
    var city = document.getElementById('pmEditCity').value.trim();
    var state = document.getElementById('pmEditState').value.trim();
    var zip = document.getElementById('pmEditZip').value.trim();
    var status = document.getElementById('pmEditClientStatus').value;
    var notes = document.getElementById('pmEditClientNotes').value.trim();

    if (!clientName) { showClientMessage('Client name is required.', 'error'); return; }
    if (!contactName) { showClientMessage('Contact name is required.', 'error'); return; }
    if (!contactEmail) { showClientMessage('Contact email is required.', 'error'); return; }

    var payload = {
      'Client Name': clientName,
      'Contact Name': contactName,
      'Contact Email': contactEmail,
      'Status': status,
    };
    if (contactPhone) payload['Contact Phone'] = contactPhone;
    if (industry) payload['Industry'] = industry;
    if (address) payload['Address'] = address;
    if (city) payload['City'] = city;
    if (state) payload['State'] = state;
    if (zip) payload['Zip Code'] = zip;
    if (notes) payload['Notes'] = notes;

    try {
      var resp = await fetch('/api/Clients/' + encodeURIComponent(editingClientId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.error || data.message || 'Update failed (' + resp.status + ')');

      if (data.record) {
        var updated = normalizeClient(data.record);
        var idx = allClients.findIndex(function(c) { return c.id === editingClientId; });
        if (idx !== -1) allClients[idx] = updated;
      }

      showClientMessage('Client "' + clientName + '" updated.', 'success');
      closeEditClientModal();
      renderClientTable();
      renderOverview();
    } catch(e) {
      showClientMessage('Failed to update client: ' + e.message, 'error');
      if (window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report('project-management.html: saveEditClient failed — ' + (e.message || e), 'saveEditClient', e && e.stack ? e.stack : null);
      }
    }
  }

  // ===== DELETE CLIENT =====
  async function deleteClient(clientId) {
    var client = allClients.find(function(c) { return c.id === clientId; });
    if (!client) return;
    if (!confirm('Delete client "' + (client.clientName || '') + '"? This cannot be undone.')) return;

    try {
      var resp = await fetch('/api/Clients/' + encodeURIComponent(clientId), { method: 'DELETE' });
      if (!resp.ok) {
        var data = await resp.json();
        throw new Error(data.error || data.message || 'Delete failed (' + resp.status + ')');
      }
      allClients = allClients.filter(function(c) { return c.id !== clientId; });
      showClientMessage('Client "' + (client.clientName || '') + '" deleted.', 'success');
      renderClientTable();
      renderOverview();
    } catch(e) {
      showClientMessage('Failed to delete client: ' + e.message, 'error');
      if (window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report('project-management.html: deleteClient failed — ' + (e.message || e), 'deleteClient', e && e.stack ? e.stack : null);
      }
    }
  }

  // ===== PROJECT TYPES (stored in onboarding settings) =====
  function renderProjectTypes() {
    var tbody = document.getElementById('pmTypeTableBody');
    tbody.textContent = '';
    document.getElementById('pmTypeCount').textContent = projectTypes.length + ' type' + (projectTypes.length === 1 ? '' : 's');
    if (projectTypes.length === 0) {
      tbody.innerHTML = '<tr><td class="pm-empty">No project types defined yet. Add one above.</td></tr>';
      return;
    }
    projectTypes.forEach(function(t, idx) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td style="font-weight:600;">' + escapeHtml(t.name || '') + '</td><td>' + escapeHtml(t.description || '—') + '</td>';
      if (canModify) {
        var actionsTd = document.createElement('td');
        actionsTd.className = 'pm-actions';
        var btnEdit = document.createElement('button');
        btnEdit.className = 'pm-table-btn';
        btnEdit.textContent = 'Edit';
        btnEdit.addEventListener('click', function() { openEditTypeModal(idx); });
        actionsTd.appendChild(btnEdit);
        var btnDelete = document.createElement('button');
        btnDelete.className = 'pm-table-btn danger';
        btnDelete.textContent = 'Delete';
        btnDelete.addEventListener('click', function() { deleteProjectType(idx); });
        actionsTd.appendChild(btnDelete);
        tr.appendChild(actionsTd);
      }
      tbody.appendChild(tr);
    });
    if (typeof initVoice === 'function') initVoice();
  }

  async function addProjectType() {
    var name = document.getElementById('pmTypeName').value.trim();
    var desc = document.getElementById('pmTypeDesc').value.trim();
    if (!name) { showTypeMessage('Please enter a type name.', 'error'); return; }

    var dup = projectTypes.find(function(t) { return t.name && t.name.toLowerCase() === name.toLowerCase(); });
    if (dup) { showTypeMessage('A project type with name "' + name + '" already exists.', 'error'); return; }

    projectTypes.push({ name: name, description: desc });
    await saveProjectTypes();
    document.getElementById('pmTypeName').value = '';
    document.getElementById('pmTypeDesc').value = '';
    showTypeMessage('Project type "' + name + '" added.', 'success');
    renderProjectTypes();
  }

  function openEditTypeModal(idx) {
    editingTypeIndex = idx;
    var t = projectTypes[idx];
    document.getElementById('pmEditTypeName').value = t.name || '';
    document.getElementById('pmEditTypeDesc').value = t.description || '';
    document.getElementById('pmEditTypeModal').classList.add('active');
  }

  function closeEditTypeModal() {
    document.getElementById('pmEditTypeModal').classList.remove('active');
    editingTypeIndex = null;
  }

  async function saveEditProjectType() {
    if (editingTypeIndex === null) return;
    var name = document.getElementById('pmEditTypeName').value.trim();
    var desc = document.getElementById('pmEditTypeDesc').value.trim();
    if (!name) { showTypeMessage('Type name is required.', 'error'); return; }

    var dup = projectTypes.find(function(t, i) { return i !== editingTypeIndex && t.name && t.name.toLowerCase() === name.toLowerCase(); });
    if (dup) { showTypeMessage('A project type with name "' + name + '" already exists.', 'error'); return; }

    projectTypes[editingTypeIndex] = { name: name, description: desc };
    await saveProjectTypes();
    showTypeMessage('Project type "' + name + '" updated.', 'success');
    closeEditTypeModal();
    renderProjectTypes();
  }

  async function deleteProjectType(idx) {
    var t = projectTypes[idx];
    if (!t) return;
    if (!confirm('Delete project type "' + (t.name || '') + '"?')) return;
    projectTypes.splice(idx, 1);
    await saveProjectTypes();
    showTypeMessage('Project type "' + (t.name || '') + '" deleted.', 'success');
    renderProjectTypes();
  }

  // ===== PRINT & EXPORT (Projects) =====
  function openProjectPrintModal() {
    var container = document.getElementById('pmProjectPrintCols');
    container.textContent = '';
    PROJECT_COL_DEFS.forEach(function(col) {
      var item = document.createElement('label');
      item.className = 'pm-check-item';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = projectVisibleCols[col.key];
      cb.dataset.key = col.key;
      item.appendChild(cb);
      item.appendChild(document.createTextNode(col.label));
      container.appendChild(item);
    });
    document.getElementById('pmProjectPrintModal').classList.add('active');
  }

  function doProjectPrint() {
    var checkboxes = document.querySelectorAll('#pmProjectPrintCols input[type="checkbox"]');
    var selectedCols = [];
    checkboxes.forEach(function(cb) {
      if (cb.checked) {
        var col = PROJECT_COL_DEFS.find(function(c) { return c.key === cb.dataset.key; });
        if (col) selectedCols.push(col);
      }
    });
    if (selectedCols.length === 0) { showProjectMessage('Select at least one column to print.', 'error'); return; }

    var filtered = getFilteredSortedProjects();
    var html = '<html><head><title>DRIV-EN Project List</title><style>';
    html += 'body{font-family:Arial,sans-serif;margin:20px;}h2{margin:0 0 16px 0;}table{width:100%;border-collapse:collapse;font-size:12px;}';
    html += 'th{background:#e2e8f0;padding:8px 10px;text-align:left;border:1px solid #94a3b8;}td{padding:6px 10px;border:1px solid #cbd5e1;}';
    html += '.print-date{font-size:12px;color:#64748b;margin-bottom:12px;}</style></head><body>';
    html += '<h2>DRIV-EN Project List</h2>';
    html += '<div class="print-date">Generated: ' + new Date().toLocaleString() + ' | Total: ' + filtered.length + ' projects</div>';
    html += '<table><thead><tr>';
    selectedCols.forEach(function(col) { html += '<th>' + escapeHtml(col.label) + '</th>'; });
    html += '</tr></thead><tbody>';
    filtered.forEach(function(p) {
      html += '<tr>';
      selectedCols.forEach(function(col) {
        var val = p[col.key];
        html += '<td>' + escapeHtml((val !== undefined && val !== null && val !== '') ? String(val) : '—') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></body></html>';
    var printWin = window.open('', '_blank');
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(function() { printWin.print(); }, 300);
    closeModal('pmProjectPrintModal');
  }

  function openProjectExportModal(format) {
    projectExportFormat = format || 'csv';
    var container = document.getElementById('pmProjectExportCols');
    container.textContent = '';
    PROJECT_COL_DEFS.forEach(function(col) {
      var item = document.createElement('label');
      item.className = 'pm-check-item';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = projectVisibleCols[col.key];
      cb.dataset.key = col.key;
      item.appendChild(cb);
      item.appendChild(document.createTextNode(col.label));
      container.appendChild(item);
    });
    if (projectExportFormat === 'excel') {
      document.getElementById('pmProjectExportTitle').textContent = 'Export to Excel';
      document.getElementById('pmProjectExportBtn').textContent = 'Download Excel';
    } else {
      document.getElementById('pmProjectExportTitle').textContent = 'Export to CSV';
      document.getElementById('pmProjectExportBtn').textContent = 'Download CSV';
    }
    document.getElementById('pmProjectExportModal').classList.add('active');
  }

  function doProjectExport() {
    var checkboxes = document.querySelectorAll('#pmProjectExportCols input[type="checkbox"]');
    var selectedCols = [];
    checkboxes.forEach(function(cb) {
      if (cb.checked) {
        var col = PROJECT_COL_DEFS.find(function(c) { return c.key === cb.dataset.key; });
        if (col) selectedCols.push(col);
      }
    });
    if (selectedCols.length === 0) { showProjectMessage('Select at least one column to export.', 'error'); return; }

    var filtered = getFilteredSortedProjects();
    var dateStr = new Date().toISOString().slice(0, 10);
    var label = projectExportFormat === 'excel' ? 'Excel' : 'CSV';

    if (projectExportFormat === 'excel') {
      var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
      html += '<head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';
      selectedCols.forEach(function(col) { html += '<th style="background:#e2e8f0;font-weight:bold;">' + escapeHtml(col.label) + '</th>'; });
      html += '</tr></thead><tbody>';
      filtered.forEach(function(p) {
        html += '<tr>';
        selectedCols.forEach(function(col) {
          var val = p[col.key];
          html += '<td>' + escapeHtml((val !== undefined && val !== null && val !== '') ? String(val) : '') + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table></body></html>';
      var blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'driv-en-projects-' + dateStr + '.xls';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      var csv = selectedCols.map(function(c) { return csvEscape(c.label); }).join(',') + '\n';
      filtered.forEach(function(p) {
        var row = selectedCols.map(function(col) {
          var val = p[col.key];
          return csvEscape((val !== undefined && val !== null && val !== '') ? String(val) : '');
        });
        csv += row.join(',') + '\n';
      });
      var blob2 = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url2 = URL.createObjectURL(blob2);
      var link2 = document.createElement('a');
      link2.href = url2;
      link2.download = 'driv-en-projects-' + dateStr + '.csv';
      document.body.appendChild(link2);
      link2.click();
      document.body.removeChild(link2);
      URL.revokeObjectURL(url2);
    }
    closeModal('pmProjectExportModal');
    showProjectMessage('Exported ' + filtered.length + ' projects to ' + label + '.', 'success');
  }

  function getFilteredSortedProjects() {
    var search = document.getElementById('pmProjectSearch').value.toLowerCase().trim();
    var filterStatus = document.getElementById('pmProjectFilterStatus').value;
    var filtered = allProjects.filter(function(p) {
      var matchesSearch = !search ||
        (p.name && p.name.toLowerCase().indexOf(search) !== -1) ||
        (p.code && p.code.toLowerCase().indexOf(search) !== -1) ||
        (p.location && p.location.toLowerCase().indexOf(search) !== -1);
      var matchesStatus = !filterStatus || (p.status && p.status.toLowerCase() === filterStatus.toLowerCase());
      return matchesSearch && matchesStatus;
    });
    filtered.sort(function(a, b) {
      var va = String(a[projectSortKey] || '').toLowerCase();
      var vb = String(b[projectSortKey] || '').toLowerCase();
      if (va < vb) return projectSortDir === 'asc' ? -1 : 1;
      if (va > vb) return projectSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }

  // ===== PRINT & EXPORT (Clients) =====
  function openClientPrintModal() {
    var container = document.getElementById('pmClientPrintCols');
    container.textContent = '';
    CLIENT_COL_DEFS.forEach(function(col) {
      var item = document.createElement('label');
      item.className = 'pm-check-item';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = clientVisibleCols[col.key];
      cb.dataset.key = col.key;
      item.appendChild(cb);
      item.appendChild(document.createTextNode(col.label));
      container.appendChild(item);
    });
    document.getElementById('pmClientPrintModal').classList.add('active');
  }

  function doClientPrint() {
    var checkboxes = document.querySelectorAll('#pmClientPrintCols input[type="checkbox"]');
    var selectedCols = [];
    checkboxes.forEach(function(cb) {
      if (cb.checked) {
        var col = CLIENT_COL_DEFS.find(function(c) { return c.key === cb.dataset.key; });
        if (col) selectedCols.push(col);
      }
    });
    if (selectedCols.length === 0) { showClientMessage('Select at least one column to print.', 'error'); return; }

    var filtered = getFilteredSortedClients();
    var html = '<html><head><title>DRIV-EN Client List</title><style>';
    html += 'body{font-family:Arial,sans-serif;margin:20px;}h2{margin:0 0 16px 0;}table{width:100%;border-collapse:collapse;font-size:12px;}';
    html += 'th{background:#e2e8f0;padding:8px 10px;text-align:left;border:1px solid #94a3b8;}td{padding:6px 10px;border:1px solid #cbd5e1;}';
    html += '.print-date{font-size:12px;color:#64748b;margin-bottom:12px;}</style></head><body>';
    html += '<h2>DRIV-EN Client List</h2>';
    html += '<div class="print-date">Generated: ' + new Date().toLocaleString() + ' | Total: ' + filtered.length + ' clients</div>';
    html += '<table><thead><tr>';
    selectedCols.forEach(function(col) { html += '<th>' + escapeHtml(col.label) + '</th>'; });
    html += '</tr></thead><tbody>';
    filtered.forEach(function(c) {
      html += '<tr>';
      selectedCols.forEach(function(col) {
        var val = c[col.key];
        html += '<td>' + escapeHtml((val !== undefined && val !== null && val !== '') ? String(val) : '—') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></body></html>';
    var printWin = window.open('', '_blank');
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(function() { printWin.print(); }, 300);
    closeModal('pmClientPrintModal');
  }

  function openClientExportModal(format) {
    clientExportFormat = format || 'csv';
    var container = document.getElementById('pmClientExportCols');
    container.textContent = '';
    CLIENT_COL_DEFS.forEach(function(col) {
      var item = document.createElement('label');
      item.className = 'pm-check-item';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = clientVisibleCols[col.key];
      cb.dataset.key = col.key;
      item.appendChild(cb);
      item.appendChild(document.createTextNode(col.label));
      container.appendChild(item);
    });
    if (clientExportFormat === 'excel') {
      document.getElementById('pmClientExportTitle').textContent = 'Export to Excel';
      document.getElementById('pmClientExportBtn').textContent = 'Download Excel';
    } else {
      document.getElementById('pmClientExportTitle').textContent = 'Export to CSV';
      document.getElementById('pmClientExportBtn').textContent = 'Download CSV';
    }
    document.getElementById('pmClientExportModal').classList.add('active');
  }

  function doClientExport() {
    var checkboxes = document.querySelectorAll('#pmClientExportCols input[type="checkbox"]');
    var selectedCols = [];
    checkboxes.forEach(function(cb) {
      if (cb.checked) {
        var col = CLIENT_COL_DEFS.find(function(c) { return c.key === cb.dataset.key; });
        if (col) selectedCols.push(col);
      }
    });
    if (selectedCols.length === 0) { showClientMessage('Select at least one column to export.', 'error'); return; }

    var filtered = getFilteredSortedClients();
    var dateStr = new Date().toISOString().slice(0, 10);
    var label = clientExportFormat === 'excel' ? 'Excel' : 'CSV';

    if (clientExportFormat === 'excel') {
      var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
      html += '<head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';
      selectedCols.forEach(function(col) { html += '<th style="background:#e2e8f0;font-weight:bold;">' + escapeHtml(col.label) + '</th>'; });
      html += '</tr></thead><tbody>';
      filtered.forEach(function(c) {
        html += '<tr>';
        selectedCols.forEach(function(col) {
          var val = c[col.key];
          html += '<td>' + escapeHtml((val !== undefined && val !== null && val !== '') ? String(val) : '') + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table></body></html>';
      var blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'driv-en-clients-' + dateStr + '.xls';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      var csv = selectedCols.map(function(c) { return csvEscape(c.label); }).join(',') + '\n';
      filtered.forEach(function(c) {
        var row = selectedCols.map(function(col) {
          var val = c[col.key];
          return csvEscape((val !== undefined && val !== null && val !== '') ? String(val) : '');
        });
        csv += row.join(',') + '\n';
      });
      var blob2 = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url2 = URL.createObjectURL(blob2);
      var link2 = document.createElement('a');
      link2.href = url2;
      link2.download = 'driv-en-clients-' + dateStr + '.csv';
      document.body.appendChild(link2);
      link2.click();
      document.body.removeChild(link2);
      URL.revokeObjectURL(url2);
    }
    closeModal('pmClientExportModal');
    showClientMessage('Exported ' + filtered.length + ' clients to ' + label + '.', 'success');
  }

  function getFilteredSortedClients() {
    var search = document.getElementById('pmClientSearch').value.toLowerCase().trim();
    var filterStatus = document.getElementById('pmClientFilterStatus').value;
    var filtered = allClients.filter(function(c) {
      var matchesSearch = !search ||
        (c.clientName && c.clientName.toLowerCase().indexOf(search) !== -1) ||
        (c.contactName && c.contactName.toLowerCase().indexOf(search) !== -1) ||
        (c.contactEmail && c.contactEmail.toLowerCase().indexOf(search) !== -1) ;
      var matchesStatus = !filterStatus || (c.status && c.status.toLowerCase() === filterStatus.toLowerCase());
      return matchesSearch && matchesStatus;
    });
    filtered.sort(function(a, b) {
      var va = String(a[clientSortKey] || '').toLowerCase();
      var vb = String(b[clientSortKey] || '').toLowerCase();
      if (va < vb) return clientSortDir === 'asc' ? -1 : 1;
      if (va > vb) return clientSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }

  // ===== HELPERS =====
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function csvEscape(val) {
    if (val === null || val === undefined) return '';
    var s = String(val);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  }

  function showProjectMessage(msg, type) {
    var el = document.getElementById('pmProjectsMessage');
    if (!el) el = document.getElementById('pmAddProjectMessage');
    el.textContent = msg;
    el.className = 'pm-message ' + type;
    el.style.display = 'block';
    setTimeout(function() { el.style.display = 'none'; }, 5000);
  }

  function showClientMessage(msg, type) {
    var el = document.getElementById('pmClientsMessage');
    if (!el) el = document.getElementById('pmAddClientMessage');
    el.textContent = msg;
    el.className = 'pm-message ' + type;
    el.style.display = 'block';
    setTimeout(function() { el.style.display = 'none'; }, 5000);
  }

  function showTypeMessage(msg, type) {
    var el = document.getElementById('pmTypesMessage');
    el.textContent = msg;
    el.className = 'pm-message ' + type;
    el.style.display = 'block';
    setTimeout(function() { el.style.display = 'none'; }, 5000);
  }

  // ===== TAB SWITCHING =====
  function switchTab(tab) {
    document.querySelectorAll('.pm-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.pm-tab-content').forEach(function(c) { c.style.display = 'none'; });
    document.querySelector('.pm-tab[data-tab="' + tab + '"]').classList.add('active');
    document.getElementById('tab-' + tab).style.display = 'block';
    if (tab === 'overview') renderOverview();
    if (typeof initVoice === 'function') initVoice();
  }

  // ===== GO TO MAIN DASHBOARD (with role_id) =====
  function goToMainDashboard() {
    if (pmDirty) {
      if (!confirm('You have unsaved changes. Click OK to leave without saving, or Cancel to stay.')) return;
    }
    var savedOrigin = sessionStorage.getItem('driven_dashboard_origin');
    if (savedOrigin) { window.location.href = savedOrigin; return; }
    if (document.referrer && document.referrer.indexOf('driv-en.com') !== -1) {
      window.location.href = document.referrer; return;
    }
    var user = window.dashUser;
    if (user) {
      var role = (user.role || '').toLowerCase();
      var rid = (user.role_id || '').toLowerCase();
      if (role === 'driv-en founder' || role === 'owner' || rid === 'ro-founder') {
        window.location.href = '/app/dashboard/owner-dashboard.html'; return;
      } else if (role === 'admin' || rid === 'ro-admin') {
        window.location.href = '/app/dashboard/admin.html'; return;
      } else {
        window.location.href = '/app/dashboard/employee-dashboard.html'; return;
      }
    }
    window.location.href = '/app/dashboard/admin.html';
  }

  // ===== CONFIRM LOGOUT =====
  function confirmLogout() {
    if (pmDirty) {
      if (!confirm('You have unsaved changes. Click OK to log out without saving, or Cancel to stay.')) return;
    }
    if (typeof dashLogout === 'function') dashLogout();
  }

  // ===== PURPOSE & INSTRUCTIONS MODALS =====
  var PM_MODAL_CONTENT = {
    overview: {
      title: 'Project Management — Overview',
      purpose: 'The Overview tab provides a high-level snapshot of all projects and clients in your organization. Use it to quickly see KPIs, active projects, and active clients at a glance.',
      instructions: '<ol><li>Review the KPI cards at the top for Total Projects, Active Projects, Completed Projects, and Total Clients.</li><li>Scroll down to the Active Projects table to see the latest projects. Click a row to jump to the Projects tab.</li><li>Scroll down to the Active Clients table to see the latest clients. Click a row to jump to the Clients tab.</li></ol>'
    },
    projects: {
      title: 'Project Management — Projects',
      purpose: 'The Projects tab lists all projects in your organization with full search, filter, sort, and pagination. Use it to find, view, and edit any project.',
      instructions: '<ol><li>Use the search box to filter by project name, code, or location.</li><li>Use the Status dropdown to filter by project status.</li><li>Click Columns to show/hide specific columns.</li><li>Click a row to view or edit a project.</li><li>Use the pagination controls at the bottom to navigate pages.</li><li>Click Print, Export CSV, or Export Excel to export the current list.</li></ol>'
    },
    addproject: {
      title: 'Project Management — Add New Project',
      purpose: 'The Add New Project tab lets you create a new project by filling out the project details form.',
      instructions: '<ol><li>Enter the Project Name, Project Number (code), and select a Project Type.</li><li>Choose a Client from the dropdown (clients must be added first).</li><li>Set the Project Status (Active, Planning, On Hold, Completed, or Cancelled).</li><li>Fill in optional fields like Location, Start Date, End Date, Budget, and Description.</li><li>Click Save Project to create the project.</li></ol>'
    },
    types: {
      title: 'Project Management — Project Types',
      purpose: 'The Project Types tab lets you define and manage project categories. These types are used when creating or classifying projects.',
      instructions: '<ol><li>To add a new type, fill out the Type Name and Description fields at the top, then click Add Type.</li><li>The Project Type List below shows all existing types.</li><li>Click Edit to modify a type name or description.</li><li>Click Delete to remove a type (only if no projects are using it).</li></ol>'
    },
    clients: {
      title: 'Project Management — Clients',
      purpose: 'The Clients tab lists all clients in your organization with full search, filter, sort, and pagination. Use it to find, view, and edit any client.',
      instructions: '<ol><li>Use the search box to filter by client name, contact, or email.</li><li>Use the Status dropdown to filter by client status.</li><li>Click Columns to show/hide specific columns.</li><li>Click a row to view or edit a client.</li><li>Use the pagination controls at the bottom to navigate pages.</li><li>Click Print, Export CSV, or Export Excel to export the current list.</li></ol>'
    },
    addclient: {
      title: 'Project Management — Add New Client',
      purpose: 'The Add New Client tab lets you create a new client by filling out the client details form.',
      instructions: '<ol><li>Enter the Client Name (this is the company or organization name).</li><li>Fill in Contact Name, Contact Email, and Contact Phone.</li><li>Optionally add Industry, Address, City, State, Zip Code, and Notes.</li><li>Set the Client Status (Active, Inactive, Pending, or Onboarding).</li><li>Click Save Client to create the client.</li></ol>'
    }
  };

  function getActiveContext() {
    var activeTab = document.querySelector('.pm-tab.active');
    if (!activeTab) return 'overview';
    var key = activeTab.getAttribute('data-tab') || 'overview';
    return PM_MODAL_CONTENT[key] ? key : 'overview';
  }

  function openPmModal(type) {
    var ctx = getActiveContext();
    var info = PM_MODAL_CONTENT[ctx] || PM_MODAL_CONTENT.overview;
    if (type === 'purpose') {
      document.getElementById('pmModalPurposeTitle').textContent = info.title + ' — Purpose';
      document.getElementById('pmModalPurposeBody').innerHTML = info.purpose;
      document.getElementById('pmModalPurpose').classList.add('active');
    } else {
      document.getElementById('pmModalInstructionsTitle').textContent = info.title + ' — Instructions';
      document.getElementById('pmModalInstructionsBody').innerHTML = info.instructions;
      document.getElementById('pmModalInstructions').classList.add('active');
    }
  }

  // Wire pill bar buttons
  var btnPurpose = document.getElementById('pmBtnPurpose');
  if (btnPurpose) btnPurpose.addEventListener('click', function() { openPmModal('purpose'); });
  var btnInstructions = document.getElementById('pmBtnInstructions');
  if (btnInstructions) btnInstructions.addEventListener('click', function() { openPmModal('instructions'); });

  // Close modal on overlay click
  document.querySelectorAll('.pm-modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });

})();
