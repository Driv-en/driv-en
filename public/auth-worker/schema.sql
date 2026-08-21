-- ============================================================
-- DRIV-EN D1 Schema — Phase 1: Auth
-- ============================================================

-- Organizations (customers / tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    plan        TEXT NOT NULL DEFAULT 'monthly',   -- 'monthly' | 'annual'
    status      TEXT NOT NULL DEFAULT 'active',     -- 'active' | 'suspended' | 'cancelled'
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Roles (global — same set available to all customers)
CREATE TABLE IF NOT EXISTS roles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
);

-- Users (employees)
-- Email is globally unique — one email = one account, tied to one org.
CREATE TABLE IF NOT EXISTS users (
    id                   TEXT PRIMARY KEY,
    org_id               TEXT NOT NULL,
    email                TEXT NOT NULL UNIQUE,
    role_id              TEXT NOT NULL,
    password_hash        TEXT,
    password_salt        TEXT,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    is_active            INTEGER NOT NULL DEFAULT 1,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES organizations(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Index for login lookups by email
CREATE INDEX IF NOT EXISTS idx_user_email ON users(email);

-- ============================================================
-- Seed default roles
-- ============================================================
INSERT OR IGNORE INTO roles (id, name, description) VALUES
    ('role_admin',       'Admin',              'Full access — manage org, users, projects, equipment'),
    ('role_project_mgr', 'Project Manager',    'Manage projects, assign employees, view reports'),
    ('role_equip_mgr',   'Equipment Manager',   'Manage equipment inventory, assignments, maintenance'),
    ('role_mechanic',    'Mechanic',            'View assigned equipment, log maintenance, inspections'),
    ('role_employee',    'Employee',            'Basic access — view assignments, complete inspections');

