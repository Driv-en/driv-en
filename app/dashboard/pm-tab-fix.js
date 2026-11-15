// pm-tab-fix.js — Standalone fix for Project Types and Clients tabs
// Bypasses the main project-management.js for these two tabs only
(function() {
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadAndRenderTypes() {
    var tbody = document.getElementById('pmTypeTableBody');
    var countEl = document.getElementById('pmTypeCount');
    if (!tbody) { console.error('pmTypeTableBody not found'); return; }
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#64748b;">Loading...</td></tr>';

    fetch('/api/project-types')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var records = data.records || data.projectTypes || data.data || data.results || [];
        var types = records.map(function(r) {
          var f = (r.fields && typeof r.fields === 'object') ? r.fields : r;
          return { name: f['Project Type Name'] || f.name || '', description: f['Description'] || f.description || '' };
        }).filter(function(t) { return t.name; });

        if (countEl) countEl.textContent = types.length;

        if (types.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#64748b;">No project types defined yet.</td></tr>';
          return;
        }

        tbody.innerHTML = types.map(function(t) {
          return '<tr>' +
            '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:500;">' + escapeHtml(t.name) + '</td>' +
            '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;">' + escapeHtml(t.description || '') + '</td>' +
            '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">' +
              '<button onclick="pmEditType(' + types.indexOf(t) + ')" style="padding:4px 10px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;cursor:pointer;font-size:12px;">Edit</button>' +
            '</td>' +
            '</tr>';
        }).join('');
      })
      .catch(function(e) {
        console.error('Types load error:', e);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#ef4444;">Error loading: ' + escapeHtml(e.message) + '</td></tr>';
      });
  }

  function loadAndRenderClients() {
    var tbody = document.getElementById('pmClientTableBody');
    var countEl = document.getElementById('pmClientCount');
    if (!tbody) { console.error('pmClientTableBody not found'); return; }
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#64748b;">Loading...</td></tr>';

    fetch('/api/clients')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var records = data.records || data.clients || data.data || data.results || [];
        var clients = records.map(function(r) {
          var f = (r.fields && typeof r.fields === 'object') ? r.fields : r;
          return {
            id: r.id || '',
            clientName: f['Client Name'] || f.client_name || '',
            contactName: f['Contact Name'] || f.contact_name || '',
            contactEmail: f['Contact Email'] || f.contact_email || '',
            contactPhone: f['Contact Phone'] || f.contact_phone || '',
            city: f['City'] || f.city || '',
            state: f['State'] || f.state || '',
            status: f['Status'] || f.status || 'Active'
          };
        });

        if (countEl) countEl.textContent = clients.length;

        if (clients.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#64748b;">No clients found.</td></tr>';
          return;
        }

        tbody.innerHTML = clients.map(function(c) {
          return '<tr>' +
            '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:500;">' + escapeHtml(c.clientName) + '</td>' +
            '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + escapeHtml(c.contactName) + '</td>' +
            '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + escapeHtml(c.contactEmail) + '</td>' +
            '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + escapeHtml(c.contactPhone) + '</td>' +
            '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + escapeHtml(c.city) + '</td>' +
            '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + escapeHtml(c.state) + '</td>' +
            '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + escapeHtml(c.status) + '</td>' +
            '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">' +
              '<button onclick="pmEditClient(\'' + escapeHtml(c.id) + '\')" style="padding:4px 10px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;cursor:pointer;font-size:12px;">Edit</button>' +
            '</td>' +
            '</tr>';
        }).join('');
      })
      .catch(function(e) {
        console.error('Clients load error:', e);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#ef4444;">Error loading: ' + escapeHtml(e.message) + '</td></tr>';
      });
  }

  // Intercept tab clicks
  document.addEventListener('click', function(e) {
    var tab = e.target.closest('.pm-tab');
    if (!tab) return;
    var tabName = tab.getAttribute('data-tab') || tab.textContent.trim().toLowerCase();
    if (tabName === 'types' || tabName === 'project types') {
      setTimeout(loadAndRenderTypes, 100);
    }
    if (tabName === 'clients') {
      setTimeout(loadAndRenderClients, 100);
    }
  });

  // Also expose for manual triggering
  window.pmLoadTypes = loadAndRenderTypes;
  window.pmLoadClients = loadAndRenderClients;
})();
