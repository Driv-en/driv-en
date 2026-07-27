# DRIV‑EN Core Principles (v1.0)

## 1. Simplicity First
Every workflow must be simple enough for field users to complete without training.

## 2. Zero Ambiguity
All data structures, UI patterns, and automations must be deterministic and predictable.

## 3. Role‑Bounded Access
Every action must be tied to a role: Admin, Manager, Foreman, Technician, Operator.

## 4. Equipment‑Centric Architecture
All modules revolve around the Equipment record as the single source of truth.

## 5. Automation Over Manual Work
Cloudflare Workers must handle PM generation, inspection triggers, work order creation, and compliance rollups.

## 6. Airtable Is the Database
Airtable stores all v1.0 data. No schema changes without approval.

## 7. Driv‑en.com Is the UI
All user interaction happens on the website. No UI logic inside Workers.

## 8. Cloudflare Runs the Logic
All backend logic, validation, and triggers run in Cloudflare Workers.

## 9. No New Modules in v1.0
v1.0 = Equipment Management + Equipment Inspections only.

## 10. Audit‑Ready Always
Every automation must log actions, timestamps, and record IDs.
