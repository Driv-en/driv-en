/* ==========================================================================
   DRIV-EN Platform — Onboarding: Roles & Permissions JavaScript (v1)
   File: /app/onboarding/roles-permissions.js
   Extracted from roles-permissions.html for CSP compliance (no inline scripts).
   ========================================================================== */

// ============================================================
// ROLES & PERMISSIONS — Onboarding Task
// ============================================================
// This page lets the admin create custom roles for their org
// and assign permissions (checkboxes) to each role.
//
// API endpoints (onboarding worker):
//   GET  /api/onboarding/permissions          — list all available permissions
//   GET  /api/onboarding/roles                — list this org's roles + perm counts
//   POST /api/onboarding/roles                — create a new role
//   PUT  /api/onboarding/roles/:id            — update role name/description
//   DELETE /api/onboarding/roles/:id          — delete a non-system role
//   GET  /api/onboarding/roles/:id/permissions — get permissions for a role
//   PUT  /api/onboarding/roles/:id/permissions — set permissions for a role
//   POST /api/onboarding/roles-permissions/complete — mark task complete
// ============================================================

var allPermissions = [];
var allRoles = [];
var currentEditingRoleId = null;
var currentEditingRoleName = '';
var rpDirty = false;

// ---- Auth check & init ----
var canModify = false; // Only KP assigned to "Roles & Permissions" can modify

(async function() {
  try {
    var resp = await fetch('/auth/session');
    var data = await resp.json();
    if (!data.authenticated) {
      window.location.href = '/app/auth/login.html';
      return;
    }
    window.currentUser = data.user;
    // Fill greeting bar (DOM-safe)
    var greetingEl = document.getElementById('dashGreetingText');
    if (greetingEl) {
      var firstName = data.user.first_name || '';
      if (!firstName) { var fullName = data.user.full_name || ''; if (fullName) firstName = fullName.split(' ')[0]; }
      if (firstName) {
        greetingEl.textContent = '';
        greetingEl.appendChild(document.createTextNode('Welcome, ' + firstName + ' — Define roles & permissions.'));
      } else {
        greetingEl.textContent = 'Welcome — Define roles & permissions.';
      }
    }

    // Hide Admin Dashboard return tab for non-admins (matches auth-check.js behavior)
    var rpUserRole = (data.user && data.user.role) ? String(data.user.role) : "";
    var rpIsAdmin = ["admin", "administrator"].indexOf(rpUserRole.toLowerCase()) !== -1 || rpUserRole.toLowerCase().indexOf("founder") !== -1;
    if (!rpIsAdmin) {
      document.querySelectorAll(".driven-admin-only").forEach(function(el) {
        el.style.display = "none";
      });
    }

    // Check if user is assigned to "Roles & Permissions" task
    var customerId = localStorage.getItem('driven_customer_id');
    if (customerId) {
      try {
        var kpResp = await fetch('/api/onboarding/key-personnel/list?customerId=' + encodeURIComponent(customerId));
        var kpData = await kpResp.json();
        if (kpData.success && kpData.keyPersonnel) {
          var myEmail = data.user.email ? data.user.email.toLowerCase() : '';
          var myRecord = kpData.keyPersonnel.find(function(kp) {
            return kp.email && kp.email.toLowerCase() === myEmail;
          });
          if (myRecord && myRecord.roles) {
            var myTasks = myRecord.roles.map(function(r) { return r.role; });
            canModify = myTasks.indexOf('Roles & Permissions') !== -1;
          }
        }
      } catch (e) {
        console.error('KP check error:', e);
      }
    }

    // Admins ALWAYS have modify access — they are the platform owner and
    // should be able to add roles & permissions even if they are not listed
    // as an assigned KP (self-assignment doesn't create a KP record for admins).
    if (rpIsAdmin) {
      canModify = true;
    }

    // If user is admin role but NOT assigned to this task, they can view only
    if (!canModify && rpIsAdmin) {
      // Admin can view but not modify
      canModify = false;
      document.getElementById('viewOnlyNotice').style.display = 'block';
      document.getElementById('addRoleSection').style.display = 'none';
      var saveBtn = document.getElementById('saveContinueBtn');
      if (saveBtn) saveBtn.style.display = 'none';
    } else if (!canModify) {
      // Non-admin, not assigned — shouldn't be here, but show view-only
      document.getElementById('viewOnlyNotice').style.display = 'block';
      document.getElementById('addRoleSection').style.display = 'none';
      var saveBtn2 = document.getElementById('saveContinueBtn');
      if (saveBtn2) saveBtn2.style.display = 'none';
    }

    await loadPermissions();
    await loadRoles();
  } catch (e) {
    console.error('Init error:', e);
    showMessage('Failed to initialize. Please refresh the page.', 'error');
  }
})();

// ---- Load all available permissions from the API ----
async function loadPermissions() {
  try {
    var resp = await fetch('/api/onboarding/permissions');
    var data = await resp.json();
    if (data.success && data.permissions) {
      allPermissions = data.permissions;
    } else {
      // If endpoint not deployed yet, use hardcoded list as fallback
      allPermissions = getFallbackPermissions();
    }
  } catch (e) {
    console.error('loadPermissions error:', e);
    allPermissions = getFallbackPermissions();
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report(
        "roles-permissions.html: loadPermissions failed — " + (e.message || e),
        "loadPermissions", e && e.stack ? e.stack : null
      );
    }
  }
}

// ---- Fallback permissions (used if API endpoint not deployed yet) ----
function getFallbackPermissions() {
  return [
    { id: 'PRM-emp-view',    name: 'employees.view',    description: 'View employee records',     module: 'employees' },
    { id: 'PRM-emp-add',     name: 'employees.add',     description: 'Add new employees',          module: 'employees' },
    { id: 'PRM-emp-edit',    name: 'employees.edit',    description: 'Edit employee records',      module: 'employees' },
    { id: 'PRM-emp-delete',  name: 'employees.delete',  description: 'Delete employees',           module: 'employees' },
    { id: 'PRM-eq-view',     name: 'equipment.view',    description: 'View equipment records',     module: 'equipment' },
    { id: 'PRM-eq-add',      name: 'equipment.add',     description: 'Add new equipment',          module: 'equipment' },
    { id: 'PRM-eq-edit',     name: 'equipment.edit',    description: 'Edit equipment records',      module: 'equipment' },
    { id: 'PRM-eq-delete',   name: 'equipment.delete',  description: 'Delete equipment',            module: 'equipment' },
    { id: 'PRM-proj-view',   name: 'projects.view',     description: 'View projects',              module: 'projects' },
    { id: 'PRM-proj-add',    name: 'projects.add',      description: 'Add new projects',           module: 'projects' },
    { id: 'PRM-proj-edit',   name: 'projects.edit',     description: 'Edit projects',               module: 'projects' },
    { id: 'PRM-proj-delete', name: 'projects.delete',   description: 'Delete projects',             module: 'projects' },
    { id: 'PRM-wo-view',     name: 'workorders.view',    description: 'View work orders',           module: 'workorders' },
    { id: 'PRM-wo-add',      name: 'workorders.add',     description: 'Add work orders',            module: 'workorders' },
    { id: 'PRM-wo-edit',     name: 'workorders.edit',    description: 'Edit work orders',           module: 'workorders' },
    { id: 'PRM-wo-delete',   name: 'workorders.delete',  description: 'Delete work orders',         module: 'workorders' },
    { id: 'PRM-fu-view',     name: 'fuel.view',          description: 'View fuel management and fuel alerts', module: 'fuel' },
    { id: 'PRM-fu-add',      name: 'fuel.add',           description: 'Add fuel transactions',      module: 'fuel' },
    { id: 'PRM-fu-edit',     name: 'fuel.edit',          description: 'Edit fuel transactions',     module: 'fuel' },
    { id: 'PRM-fu-delete',   name: 'fuel.delete',        description: 'Delete fuel transactions',   module: 'fuel' },
    { id: 'PRM-tr-view',     name: 'transfer.view',      description: 'View equipment transfers',   module: 'transfer' },
    { id: 'PRM-tr-add',      name: 'transfer.add',       description: 'Create transfer tickets',    module: 'transfer' },
    { id: 'PRM-tr-edit',     name: 'transfer.edit',      description: 'Edit transfer tickets',      module: 'transfer' },
    { id: 'PRM-tr-delete',   name: 'transfer.delete',    description: 'Delete transfer tickets',    module: 'transfer' },
    { id: 'PRM-insp-view',   name: 'inspections.view',   description: 'View inspections',           module: 'inspections' },
    { id: 'PRM-insp-add',    name: 'inspections.add',    description: 'Add inspections',            module: 'inspections' },
    { id: 'PRM-insp-edit',   name: 'inspections.edit',   description: 'Edit inspections',           module: 'inspections' },
    { id: 'PRM-insp-delete', name: 'inspections.delete', description: 'Delete inspections',        module: 'inspections' },
    { id: 'PRM-pm-view',     name: 'pm.view',             description: 'View PMs',                   module: 'pm' },
    { id: 'PRM-pm-add',      name: 'pm.add',              description: 'Add PMs',                    module: 'pm' },
    { id: 'PRM-pm-edit',     name: 'pm.edit',             description: 'Edit PMs',                   module: 'pm' },
    { id: 'PRM-pm-delete',   name: 'pm.delete',           description: 'Delete PMs',                 module: 'pm' },
    { id: 'PRM-safety-view',     name: 'safety.view',    description: 'View safety forms',           module: 'safety' },
    { id: 'PRM-safety-add',      name: 'safety.add',     description: 'Add safety forms',           module: 'safety' },
    { id: 'PRM-safety-edit',     name: 'safety.edit',    description: 'Edit safety forms',          module: 'safety' },
    { id: 'PRM-safety-approve',  name: 'safety.approve', description: 'Approve safety forms',        module: 'safety' },
    { id: 'PRM-reports-view',   name: 'reports.view',    description: 'View reports',               module: 'reports' },
    { id: 'PRM-reports-export', name: 'reports.export',  description: 'Export reports',              module: 'reports' },
    { id: 'PRM-users-view',   name: 'users.view',        description: 'View users and roles',       module: 'users' },
    { id: 'PRM-users-add',    name: 'users.add',         description: 'Add users',                  module: 'users' },
    { id: 'PRM-users-edit',   name: 'users.edit',       description: 'Edit users',                 module: 'users' },
    { id: 'PRM-users-delete', name: 'users.delete',     description: 'Delete users',                module: 'users' },
    { id: 'PRM-settings-view', name: 'settings.view',   description: 'View company settings',       module: 'settings' },
    { id: 'PRM-settings-edit',name: 'settings.edit',    description: 'Edit company settings',       module: 'settings' }
  ];
}

// ---- Load roles for this org ----
async function loadRoles() {
  var listEl = document.getElementById('rolesList');
  listEl.textContent = '';
  var loading = document.createElement('div');
  loading.className = 'rp-empty-state';
  loading.setAttribute('data-i18n', '');
  loading.textContent = 'Loading roles…';
  listEl.appendChild(loading);

  try {
    var resp = await fetch('/api/onboarding/roles');
    var data = await resp.json();
    if (data.success && data.roles) {
      // REVISION: "DRIV-EN Founder" must never appear as a role in a
      // customer organization — it is a platform-level system role.
      // Filter it out as a safety net. — Added per founder directive.
      allRoles = data.roles.filter(function(r) {
        return r.name && r.name.toLowerCase() !== 'driv-en founder';
      });
      renderRoles();
    } else {
      // Fallback: no system roles shown to customer
      allRoles = [];
      renderRoles();
    }
  } catch (e) {
    console.error('loadRoles error:', e);
    allRoles = [];
    renderRoles();
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report(
        "roles-permissions.html: loadRoles failed — " + (e.message || e),
        "loadRoles", e && e.stack ? e.stack : null
      );
    }
  }
}

// ---- Render roles list (DOM-safe — no innerHTML for user values) ----
function renderRoles() {
  var listEl = document.getElementById('rolesList');
  listEl.textContent = '';

  // ──────────────────────────────────────────────────────────────
  // REVISION: "DRIV-EN Founder" must NEVER show up as a role in a
  // customer organization. It is a platform-level system role
  // (is_system = 1, org_id = NULL) used only for the platform owner.
  // Filter it out client-side as a safety net even if the API
  // returns it. — Added per founder directive.
  // ──────────────────────────────────────────────────────────────
  allRoles = allRoles.filter(function(r) {
    return r.name && r.name.toLowerCase() !== 'driv-en founder';
  });

  if (allRoles.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'rp-empty-state';
    empty.setAttribute('data-i18n', '');
    empty.textContent = 'No roles yet. Create your first role below.';
    listEl.appendChild(empty);
    return;
  }

  allRoles.forEach(function(r) {
    var isSystem = r.is_system === 1;
    var initials = r.name.substring(0, 2).toUpperCase();
    var permCount = r.perm_count !== undefined ? r.perm_count : 0;

    var card = document.createElement('div');
    card.className = 'rp-role-card' + (isSystem ? ' system-role' : '');

    var info = document.createElement('div');
    info.className = 'rp-role-info';
    var icon = document.createElement('div');
    icon.className = 'rp-role-icon';
    icon.textContent = initials;
    info.appendChild(icon);
    var infoText = document.createElement('div');
    var nameEl = document.createElement('div');
    nameEl.className = 'rp-role-name';
    nameEl.textContent = r.name;
    infoText.appendChild(nameEl);
    if (r.description) {
      var descEl = document.createElement('div');
      descEl.className = 'rp-role-desc';
      descEl.textContent = r.description;
      infoText.appendChild(descEl);
    }
    info.appendChild(infoText);
    card.appendChild(info);

    var permEl = document.createElement('div');
    permEl.className = 'rp-role-perm-count';
    permEl.textContent = permCount + ' permission' + (permCount === 1 ? '' : 's');
    card.appendChild(permEl);

    var actions = document.createElement('div');
    actions.className = 'rp-role-actions';
    if (isSystem) {
      var span = document.createElement('span');
      span.style.cssText = 'font-size:12px;color:var(--text-muted);';
      span.setAttribute('data-i18n', '');
      span.textContent = 'System role — cannot modify';
      actions.appendChild(span);
    } else if (!canModify) {
      var span2 = document.createElement('span');
      span2.style.cssText = 'font-size:12px;color:var(--text-muted);';
      span2.setAttribute('data-i18n', '');
      span2.textContent = 'View only';
      actions.appendChild(span2);
    } else {
      var btnEditPerms = document.createElement('button');
      btnEditPerms.className = 'rp-role-btn';
      btnEditPerms.setAttribute('data-i18n', '');
      btnEditPerms.textContent = 'Edit Permissions';
      btnEditPerms.addEventListener('click', function() { openPermModal(r.id, r.name); });
      actions.appendChild(btnEditPerms);

      var btnEditName = document.createElement('button');
      btnEditName.className = 'rp-role-btn';
      btnEditName.setAttribute('data-i18n', '');
      btnEditName.textContent = 'Edit Name';
      btnEditName.addEventListener('click', function() { editRole(r.id, r.name, r.description || ''); });
      actions.appendChild(btnEditName);

      var btnDelete = document.createElement('button');
      btnDelete.className = 'rp-role-btn danger';
      btnDelete.setAttribute('data-i18n', '');
      btnDelete.textContent = 'Delete';
      btnDelete.addEventListener('click', function() { deleteRole(r.id, r.name); });
      actions.appendChild(btnDelete);
    }
    card.appendChild(actions);
    listEl.appendChild(card);
  });
}

// ---- Add a new role ----
async function addRole() {
  var nameInput = document.getElementById('newRoleName');
  var descInput = document.getElementById('newRoleDesc');
  var name = nameInput.value.trim();
  var desc = descInput.value.trim();

  if (!name) {
    showMessage('Please enter a role name.', 'error');
    return;
  }

  try {
    var resp = await fetch('/api/onboarding/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, description: desc })
    });
    var data = await resp.json();

    if (data.success) {
      nameInput.value = '';
      descInput.value = '';
      showMessage('Role "' + name + '" created. Click "Edit Permissions" to assign permissions.', 'success');
      rpDirty = true;
      await loadRoles();
    } else {
      if (resp.status < 500 && window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report(
          "roles-permissions.html: addRole returned " + resp.status + " — " + (data.error || "Request failed"),
          "addRole-" + resp.status, "Role: " + name
        );
      }
      showMessage(data.error || 'Failed to create role.', 'error');
    }
  } catch (e) {
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report(
        "roles-permissions.html: addRole failed — " + (e.message || e),
        "addRole-catch", e && e.stack ? e.stack : null
      );
    }
    var newRole = {
      id: 'local-' + Date.now(),
      name: name,
      description: desc,
      is_system: 0,
      perm_count: 0
    };
    allRoles.push(newRole);
    renderRoles();
    nameInput.value = '';
    descInput.value = '';
    showMessage('Role "' + name + '" created locally. Deploy the worker to persist.', 'success');
    rpDirty = true;
  }
}

// ---- Edit role name/description ----
function editRole(roleId, currentName, currentDesc) {
  var newName = prompt('Role name:', currentName);
  if (newName === null) return;
  newName = newName.trim();
  if (!newName) {
    showMessage('Role name cannot be empty.', 'error');
    return;
  }

  var newDesc = prompt('Description (optional):', currentDesc || '');
  if (newDesc === null) return;

  updateRole(roleId, newName, newDesc.trim());
}

async function updateRole(roleId, name, description) {
  try {
    var resp = await fetch('/api/onboarding/roles/' + roleId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, description: description })
    });
    var data = await resp.json();
    if (data.success) {
      showMessage('Role updated.', 'success');
      rpDirty = true;
      await loadRoles();
    } else {
      if (resp.status < 500 && window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report(
          "roles-permissions.html: updateRole returned " + resp.status + " — " + (data.error || "Request failed"),
          "updateRole-" + resp.status, "Role ID: " + roleId
        );
      }
      showMessage(data.error || 'Failed to update role.', 'error');
    }
  } catch (e) {
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report(
        "roles-permissions.html: updateRole failed — " + (e.message || e),
        "updateRole-catch", e && e.stack ? e.stack : null
      );
    }
    var role = allRoles.find(function(r) { return r.id === roleId; });
    if (role) {
      role.name = name;
      role.description = description;
      renderRoles();
      showMessage('Role updated locally. Deploy the worker to persist.', 'success');
      rpDirty = true;
    }
  }
}

// ---- Delete a role ----
async function deleteRole(roleId, roleName) {
  if (!confirm('Delete role "' + roleName + '"? Users assigned to this role will need to be reassigned.')) return;

  try {
    var resp = await fetch('/api/onboarding/roles/' + roleId, {
      method: 'DELETE'
    });
    var data = await resp.json();
    if (data.success) {
      showMessage('Role "' + roleName + '" deleted.', 'success');
      rpDirty = true;
      await loadRoles();
    } else {
      if (resp.status < 500 && window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report(
          "roles-permissions.html: deleteRole returned " + resp.status + " — " + (data.error || "Request failed"),
          "deleteRole-" + resp.status, "Role: " + roleName
        );
      }
      showMessage(data.error || 'Failed to delete role.', 'error');
    }
  } catch (e) {
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report(
        "roles-permissions.html: deleteRole failed — " + (e.message || e),
        "deleteRole-catch", e && e.stack ? e.stack : null
      );
    }
    allRoles = allRoles.filter(function(r) { return r.id !== roleId; });
    renderRoles();
    showMessage('Role deleted locally. Deploy the worker to persist.', 'success');
    rpDirty = true;
  }
}

// ---- Open permissions modal ----
async function openPermModal(roleId, roleName) {
  currentEditingRoleId = roleId;
  currentEditingRoleName = roleName;
  document.getElementById('permModalTitle').textContent = 'Edit Permissions — ' + roleName;
  document.getElementById('permModalSubtitle').textContent = 'Check the permissions this role should have.';

  // Render permission groups
  var groups = {};
  allPermissions.forEach(function(p) {
    if (!groups[p.module]) groups[p.module] = [];
    groups[p.module].push(p);
  });

  // Fetch current permissions for this role
  var currentPerms = [];
  try {
    var resp = await fetch('/api/onboarding/roles/' + roleId + '/permissions');
    var data = await resp.json();
    if (data.success && data.permissions) {
      currentPerms = data.permissions.map(function(p) { return p.id || p.permission_id; });
    }
  } catch (e) {
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report(
        "roles-permissions.html: openPermModal fetch permissions failed — " + (e.message || e),
        "openPermModal-fetch", e && e.stack ? e.stack : null
      );
    }
  }

  var permGroupsEl = document.getElementById('permGroups');
  permGroupsEl.textContent = '';
  var moduleOrder = ['employees', 'equipment', 'projects', 'workorders', 'inspections', 'pm', 'safety', 'reports', 'users', 'settings'];
  var sortedModules = Object.keys(groups).sort(function(a, b) {
    var ai = moduleOrder.indexOf(a);
    var bi = moduleOrder.indexOf(b);
    if (ai === -1) ai = 999;
    if (bi === -1) bi = 999;
    return ai - bi;
  });

  sortedModules.forEach(function(moduleName) {
    var perms = groups[moduleName];
    var groupDiv = document.createElement('div');
    groupDiv.className = 'rp-perm-group';
    var titleDiv = document.createElement('div');
    titleDiv.className = 'rp-perm-group-title';
    titleDiv.setAttribute('data-i18n', '');
    titleDiv.textContent = capitalize(moduleName);
    groupDiv.appendChild(titleDiv);
    var itemsDiv = document.createElement('div');
    itemsDiv.className = 'rp-perm-items';
    perms.forEach(function(p) {
      var label = document.createElement('label');
      label.className = 'rp-perm-item';
      label.setAttribute('data-no-translate', '');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'rp-perm-checkbox';
      cb.dataset.permId = p.id;
      if (currentPerms.indexOf(p.id) !== -1) cb.checked = true;
      label.appendChild(cb);
      var span = document.createElement('span');
      span.setAttribute('data-i18n', '');
      span.textContent = capitalize(p.name.split('.')[1] || 'access');
      label.appendChild(span);
      itemsDiv.appendChild(label);
    });
    groupDiv.appendChild(itemsDiv);
    permGroupsEl.appendChild(groupDiv);
  });

  document.getElementById('permModal').classList.add('active');
}

function closePermModal() {
  document.getElementById('permModal').classList.remove('active');
  currentEditingRoleId = null;
}

// ---- Save permissions for a role ----
async function savePermissions() {
  if (!currentEditingRoleId) return;

  var checked = [];
  document.querySelectorAll('.rp-perm-checkbox:checked').forEach(function(cb) {
    checked.push(cb.getAttribute('data-perm-id'));
  });

  try {
    var resp = await fetch('/api/onboarding/roles/' + currentEditingRoleId + '/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissionIds: checked })
    });
    var data = await resp.json();
    if (data.success) {
      showMessage('Permissions saved for "' + currentEditingRoleName + '".', 'success');
      rpDirty = true;
      closePermModal();
      await loadRoles();
    } else {
      if (resp.status < 500 && window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report(
          "roles-permissions.html: savePermissions returned " + resp.status + " — " + (data.error || "Request failed"),
          "savePermissions-" + resp.status, "Role: " + currentEditingRoleName
        );
      }
      showMessage(data.error || 'Failed to save permissions.', 'error');
    }
  } catch (e) {
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report(
        "roles-permissions.html: savePermissions failed — " + (e.message || e),
        "savePermissions-catch", e && e.stack ? e.stack : null
      );
    }
    var role = allRoles.find(function(r) { return r.id === currentEditingRoleId; });
    if (role) {
      role.perm_count = checked.length;
      renderRoles();
    }
    closePermModal();
    showMessage('Permissions saved locally. Deploy the worker to persist.', 'success');
    rpDirty = true;
  }
}

// ---- Save & Continue (mark task complete) ----
async function saveAndContinue() {
  try {
    var resp = await fetch('/api/onboarding/roles-permissions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    var data = await resp.json();
    if (data.success) {
      rpDirty = false;
      window.location.href = '/app/dashboard/onboarding-dashboard.html';
    } else {
      if (resp.status < 500 && window.DRIVENErrorHandler) {
        window.DRIVENErrorHandler.report(
          "roles-permissions.html: complete returned " + resp.status + " — " + (data.error || "Request failed"),
          "complete-" + resp.status, null
        );
      }
      rpDirty = false;
      window.location.href = '/app/dashboard/onboarding-dashboard.html';
    }
  } catch (e) {
    if (window.DRIVENErrorHandler) {
      window.DRIVENErrorHandler.report(
        "roles-permissions.html: complete API failed — " + (e.message || e),
        "complete-catch", e && e.stack ? e.stack : null
      );
    }
    rpDirty = false;
    window.location.href = '/app/dashboard/onboarding-dashboard.html';
  }
}

// ---- UNSAVED-CHANGES WARNING ----
// If roles/permissions were changed but the user hasn't continued,
// warn before leaving the page so they don't lose track.
window.confirmLeave = function() {
  if (rpDirty) {
    return confirm("You have unsaved role changes. Click OK to leave without saving, or Cancel to stay.");
  }
  return true;
};
window.confirmLogout = function() {
  if (rpDirty) {
    if (!confirm("You have unsaved role changes. Click OK to log out without saving, or Cancel to stay.")) return;
  }
  dashLogout();
};
window.addEventListener("beforeunload", function(e) {
  if (rpDirty) {
    e.preventDefault();
    e.returnValue = "You have unsaved role changes.";
  }
});

// ---- Expose for inline onclick handlers ----
window.addRole = addRole;
window.closePermModal = closePermModal;
window.savePermissions = savePermissions;
window.saveAndContinue = saveAndContinue;

// ---- Helpers ----
function showMessage(msg, type) {
  var el = document.getElementById('rpMessage');
  el.textContent = msg;
  el.style.display = 'block';
  if (type === 'error') {
    el.style.background = 'rgba(239, 68, 68, 0.1)';
    el.style.color = '#fca5a5';
    el.style.border = '1px solid rgba(239, 68, 68, 0.3)';
  } else {
    el.style.background = 'rgba(34, 197, 94, 0.1)';
    el.style.color = '#86efac';
    el.style.border = '1px solid rgba(34, 197, 94, 0.3)';
  }
  setTimeout(function() { el.style.display = 'none'; }, 5000);
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeJs(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function capitalize(str) {
  return (str || '').charAt(0).toUpperCase() + (str || '').slice(1);
}

// ---- Close modal on overlay click ----
document.getElementById('permModal').addEventListener('click', function(e) {
  if (e.target === this) closePermModal();
});

// ---- INIT — Runs after session loads ----
document.addEventListener("dashSessionLoaded", function(e) {
  // Make the tab bar sticky below the header
  var header = document.getElementById("dashHeader");
  var tabBar = document.getElementById("rpTabBar");
  if (header && tabBar && !header.contains(tabBar)) { header.appendChild(tabBar); }
});
