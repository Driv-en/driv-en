# DRIV‑EN UI Architecture (v1.0)

## UI Layer
All UI is built directly on Driv-en.com using:
- HTML
- CSS
- JavaScript
- Reusable components
- Standardized patterns

## UI Responsibilities
- Display data from Airtable (via Workers)
- Collect user input
- Send payloads to Cloudflare Workers
- Enforce role-based visibility
- Maintain consistent patterns

## UI Structure
- /index.html
- /modules.html
- /equipment.html
- /equipment-detail.html
- /pm.html
- /pm-detail.html
- /inspections.html
- /inspection-detail.html
- /workorders.html
- /workorder-detail.html
- /admin.html

## UI Principles
- Simple
- Fast
- Mobile-first
- Consistent
- Role-aware
