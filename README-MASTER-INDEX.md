# ==========================================
# DRIV-EN WORKER BACKUP INDEX — MASTER REFERENCE
# Generated: August 30, 2026 (Session 7 — Checkpoint 2)
#
# This file documents all 13 deployed Workers on the DRIV-EN Cloudflare account.
# Each Worker has a corresponding wrangler.toml backup file in this folder.
#
# The binding IDs below were pulled directly from the Cloudflare API on 2026-08-30.
# If any Worker is accidentally deleted or corrupted, use these files to redeploy.
#
# CRITICAL: The 10 Workers marked "SOURCE CODE NOT IN WORKSPACE" were deployed
# via wrangler by GitHub AI and their source code was never saved. If any of these
# break, there is no source code to fix them. Recovering them would require
# pulling the code from the Cloudflare API (if still available) or rewriting
# from scratch based on the binding info below.
# ==========================================

## Account Info
- Account ID: 69a182323c9634338ca8cd64463f8ed1
- Account Name: Jblood@digitalsafetyinspection.com's Account

## D1 Databases
- driv-en-db: c58c4597-57f7-418d-973b-d6c67f32f07e (users, roles, organizations)
- employees-db: 2cc94c17-f60c-4a52-bead-57507b1292f4 (employees, key_personnel_roles)

## KV Namespaces
- ONBOARDING_KV: 743fc6f965af43e580aea945728ae8e7

## R2 Buckets
- w9-uploads (W9 tax form uploads)
- driven-storage (equipment photos, inspection docs, PM docs, attachments)

## Airtable
- Base ID: appbZPijYF3evhSkK
- API Key: stored as secret (AIRTABLE_API_KEY) on Workers that need it
- Token: stored as secret (AIRTABLE_TOKEN) on onboarding-key-personnel worker

## Secrets (names only — values are NOT stored here for security)
- JWT_SECRET (driv-en-auth, employees-api)
- SENDGRID_API_KEY (driv-en-auth, onboarding-key-personnel, driven-checkout-submit)
- AIRTABLE_API_KEY (driven-checkout-submit, airtable-form-handler, 9 equipment workers)
- AIRTABLE_TOKEN (onboarding-key-personnel)
- TURNSTILE_SECRET_KEY (driven-checkout-submit, if configured)
- CHECKOUT_SECRET (driven-checkout-submit, if configured)

---

## Worker #1: driv-en-auth
- File: driv-en-auth.toml
- Status: ✅ DEPLOYED, source code in workspace (/auth-worker/src/index.js)
- Routes: driv-en.com/auth/*
- Bindings: D1 (driv-en-db), KV (ONBOARDING_KV), JWT_SECRET, SENDGRID_API_KEY, FROM_EMAIL, ONBOARDING_DOMAIN, SUPPORT_CONTACT
- Purpose: Authentication — login, logout, session, JWT, password hashing, logo management

## Worker #2: onboarding-key-personnel
- File: onboarding-key-personnel.toml
- Status: ✅ DEPLOYED, source code in workspace (/public/onboarding-key-personnel-worker/src/index.js)
- Routes: driv-en.com/api/onboarding/*
- Bindings: D1 (driv-en-db), D1 (employees-db), KV (ONBOARDING_KV), AIRTABLE_TOKEN, SENDGRID_API_KEY, AIRTABLE_BASE_ID, ONBOARDING_DOMAIN, FROM_EMAIL, SUPPORT_CONTACT
- Purpose: Key personnel onboarding — create employees, generate passwords, send emails, manage roles, revoke roles (with org_id security check)
- SECURITY FIX (Session 7): handleRevoke now verifies org_id before revoking

## Worker #3: driven-checkout-submit
- File: driven-checkout-submit.toml
- Status: ✅ DEPLOYED, source code in workspace (/driven-checkout-submit/worker.js)
- Routes: None (invoked via fetch)
- Bindings: AIRTABLE_API_KEY, SENDGRID_API_KEY, TURNSTILE_SECRET_KEY, CHECKOUT_SECRET, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME, ONBOARDING_DOMAIN, SENDGRID_FROM_EMAIL, SUPPORT_CONTACT
- Purpose: Checkout form submission — validates Turnstile, creates Airtable customer, sends confirmation email

## Worker #4: airtable-form-handler
- File: airtable-form-handler.toml
- Status: ✅ DEPLOYED, ⚠️ SOURCE CODE NOT IN WORKSPACE
- Routes: None (invoked via fetch)
- Bindings: AIRTABLE_API_KEY, R2 (w9-uploads), AIRTABLE_BASE_ID
- Purpose: Form submission to Airtable, W9 file uploads to R2

## Worker #5: driven-attachment-update
- File: driven-attachment-update.toml
- Status: ✅ DEPLOYED, ⚠️ SOURCE CODE NOT IN WORKSPACE
- Routes: None (invoked via fetch)
- Bindings: AIRTABLE_API_KEY, R2 (driven-storage), AIRTABLE_BASE_ID
- Purpose: Equipment attachment updates

## Worker #6: driven-equipment-config
- File: driven-equipment-config.toml
- Status: ✅ DEPLOYED, ⚠️ SOURCE CODE NOT IN WORKSPACE
- Routes: None (invoked via fetch)
- Bindings: AIRTABLE_API_KEY, R2 (driven-storage), AIRTABLE_BASE_ID
- Purpose: Equipment configuration management

## Worker #7: driven-equipment-transfer
- File: driven-equipment-transfer.toml
- Status: ✅ DEPLOYED, ⚠️ SOURCE CODE NOT IN WORKSPACE
- Routes: None (invoked via fetch)
- Bindings: AIRTABLE_API_KEY, R2 (driven-storage), AIRTABLE_BASE_ID
- Purpose: Equipment transfers between locations/divisions

## Worker #8: driven-extraction-engine
- File: driven-extraction-engine.toml
- Status: ✅ DEPLOYED, ⚠️ SOURCE CODE NOT IN WORKSPACE
- Routes: None (invoked via fetch)
- Bindings: AIRTABLE_API_KEY, R2 (driven-storage), AIRTABLE_BASE_ID
- Purpose: Document/image extraction engine (FUTURE-3 feature)

## Worker #9: driven-generate-pm-schedule
- File: driven-generate-pm-schedule.toml
- Status: ✅ DEPLOYED, ⚠️ SOURCE CODE NOT IN WORKSPACE
- Routes: None (invoked via fetch)
- Bindings: AIRTABLE_API_KEY, R2 (driven-storage), AIRTABLE_BASE_ID
- Purpose: Generate preventative maintenance schedules from templates

## Worker #10: driven-generate-pm-template
- File: driven-generate-pm-template.toml
- Status: ✅ DEPLOYED, ⚠️ SOURCE CODE NOT IN WORKSPACE
- Routes: None (invoked via fetch)
- Bindings: AIRTABLE_API_KEY, R2 (driven-storage), AIRTABLE_BASE_ID
- Purpose: Generate preventative maintenance templates

## Worker #11: driven-inspection-complete
- File: driven-inspection-complete.toml
- Status: ✅ DEPLOYED, ⚠️ SOURCE CODE NOT IN WORKSPACE
- Routes: None (invoked via fetch)
- Bindings: AIRTABLE_API_KEY, R2 (driven-storage), AIRTABLE_BASE_ID
- Purpose: Complete inspections — save results, store photos, trigger workflows

## Worker #12: driven-meter-update
- File: driven-meter-update.toml
- Status: ✅ DEPLOYED, ⚠️ SOURCE CODE NOT IN WORKSPACE
- Routes: None (invoked via fetch)
- Bindings: AIRTABLE_API_KEY, R2 (driven-storage), AIRTABLE_BASE_ID
- Purpose: Update equipment meter/hours readings

## Worker #13: driven-pm-complete
- File: driven-pm-complete.toml
- Status: ✅ DEPLOYED, ⚠️ SOURCE CODE NOT IN WORKSPACE
- Routes: None (invoked via fetch)
- Bindings: AIRTABLE_API_KEY, R2 (driven-storage), AIRTABLE_BASE_ID
- Purpose: Complete preventative maintenance — save results, store docs, update schedules

---

## NOT DEPLOYED (in workspace but not on Cloudflare)

### employees-api
- File: employees-api.toml
- Status: ❌ NOT DEPLOYED, source code in workspace (/employees-api/src/index.js)
- Bindings needed: D1 (employees-db), JWT_SECRET
- Purpose: Employee data API with JWT auth and org_id filtering
- SECURITY FIX (Session 7): Added JWT auth + org_id multi-tenant filtering

### driv-en-api
- Status: ❌ NOT DEPLOYED, source code in workspace (/driv-en-api/index.js)
- Bindings needed: AIRTABLE_API_KEY, AIRTABLE_BASE_ID
- Purpose: Airtable CRUD proxy (no auth, no org_id filtering — use with caution)
