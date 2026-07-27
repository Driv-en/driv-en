# Routing Rules (v1.0)

## UI Routes (Driv‑en.com)
- /equipment
- /equipment/:id
- /pm
- /pm/:id
- /inspections
- /inspections/:id
- /workorders
- /workorders/:id
- /admin

## Worker Endpoints (Cloudflare)
- /equipment/*
- /pm/*
- /inspection/*
- /workorder/*
- /auth/*

## Rules
1. UI must never call Airtable directly.
2. All protected routes must pass through /auth/validate.
3. Workers must reject unauthorized roles.
4. Workers must return structured JSON responses.
5. UI must handle success/error states consistently.
