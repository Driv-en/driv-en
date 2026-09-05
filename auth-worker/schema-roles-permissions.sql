-- ============================================================
-- DRIV-EN D1 Schema — Roles & Permissions Migration
-- Multi-tenant roles, per-org permissions, per-employee overrides
-- Run with: npx wrangler d1 execute driv-en-db --remote --file=schema-roles-permissions.sql
-- ============================================================

-- 1. Make roles multi-tenant
ALTER TABLE roles ADD COLUMN org_id TEXT;
ALTER TABLE roles ADD COLUMN is_system INTEGER DEFAULT 0;

-- 2. Mark DRIV-EN Founder as system role (it's the only one we keep)
UPDATE roles SET is_system = 1, org_id = NULL WHERE name = 'DRIV-EN Founder';

-- 3. Delete all non-system roles (the 26 preset roles)
DELETE FROM roles WHERE is_system = 0;

-- 4. Global permissions table (grows as platform builds out)
CREATE TABLE IF NOT EXISTS permissions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    module      TEXT NOT NULL
);

-- 5. Role-permission junction (which permissions each role has)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 6. Per-employee permission overrides (grant or revoke beyond role defaults)
CREATE TABLE IF NOT EXISTS user_permissions_override (
    user_id       TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    granted       INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, permission_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 7. Seed initial permissions (will grow as platform modules are built)
INSERT OR IGNORE INTO permissions (id, name, description, module) VALUES
    ('PRM-emp-view',   'employees.view',   'View employee records',           'employees'),
    ('PRM-emp-add',    'employees.add',    'Add new employees',                'employees'),
    ('PRM-emp-edit',   'employees.edit',   'Edit employee records',            'employees'),
    ('PRM-emp-delete', 'employees.delete', 'Delete employees',                 'employees'),
    ('PRM-eq-view',    'equipment.view',    'View equipment records',          'equipment'),
    ('PRM-eq-add',     'equipment.add',     'Add new equipment',               'equipment'),
    ('PRM-eq-edit',    'equipment.edit',    'Edit equipment records',          'equipment'),
    ('PRM-eq-delete',  'equipment.delete',  'Delete equipment',               'equipment'),
    ('PRM-proj-view',  'projects.view',     'View projects',                   'projects'),
    ('PRM-proj-add',   'projects.add',      'Add new projects',                'projects'),
    ('PRM-proj-edit',  'projects.edit',     'Edit projects',                   'projects'),
    ('PRM-proj-delete','projects.delete',   'Delete projects',                 'projects'),
    ('PRM-wo-view',    'workorders.view',    'View work orders',               'workorders'),
    ('PRM-wo-add',     'workorders.add',     'Add work orders',               'workorders'),
    ('PRM-wo-edit',    'workorders.edit',    'Edit work orders',              'workorders'),
    ('PRM-wo-delete',  'workorders.delete',  'Delete work orders',            'workorders'),
    ('PRM-insp-view',  'inspections.view',   'View inspections',              'inspections'),
    ('PRM-insp-add',   'inspections.add',    'Add inspections',              'inspections'),
    ('PRM-insp-edit',  'inspections.edit',   'Edit inspections',             'inspections'),
    ('PRM-insp-delete','inspections.delete',  'Delete inspections',          'inspections'),
    ('PRM-pm-view',    'pm.view',            'View PMs',                      'pm'),
    ('PRM-pm-add',     'pm.add',             'Add PMs',                       'pm'),
    ('PRM-pm-edit',    'pm.edit',            'Edit PMs',                       'pm'),
    ('PRM-pm-delete',  'pm.delete',          'Delete PMs',                     'pm'),
    ('PRM-safety-view',    'safety.view',    'View safety forms',              'safety'),
    ('PRM-safety-add',     'safety.add',     'Add safety forms',               'safety'),
    ('PRM-safety-edit',    'safety.edit',    'Edit safety forms',              'safety'),
    ('PRM-safety-approve', 'safety.approve', 'Approve safety forms',           'safety'),
    ('PRM-reports-view',   'reports.view',   'View reports',                   'reports'),
    ('PRM-reports-export', 'reports.export', 'Export reports',                 'reports'),
    ('PRM-users-view',   'users.view',       'View users and roles',           'users'),
    ('PRM-users-add',    'users.add',        'Add users',                      'users'),
    ('PRM-users-edit',   'users.edit',       'Edit users',                     'users'),
    ('PRM-users-delete','users.delete',      'Delete users',                   'users'),
    ('PRM-settings-view', 'settings.view',   'View company settings',          'settings'),
    ('PRM-settings-edit','settings.edit',    'Edit company settings',          'settings');
