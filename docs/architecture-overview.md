# DRIV‑EN Architecture Overview (v1.0)

## System Layers
1. **UI Layer** — Driv‑en.com  
   - Pages, forms, dashboards, mobile behavior  
   - Sends data to Cloudflare Workers  
   - Displays results from Airtable

2. **Automation Layer** — Cloudflare Workers  
   - PM generation  
   - Inspection triggers  
   - Work order creation  
   - Status transitions  
   - Compliance rollups  
   - Validation  
   - Logging

3. **Data Layer** — Airtable (OMNI)  
   - Stores all v1.0 data  
   - Enforces schema  
   - Provides relationships  
   - Stores history and attachments

## Data Flow
UI → Worker → Airtable → Worker → UI

## Module Boundaries
- Equipment Management  
- Equipment Inspections  
- Supporting Data (minimal only)

## Worker Responsibilities
- Validate payloads  
- Enforce workflow rules  
- Write to Airtable  
- Trigger downstream automations  
- Log everything

## UI Responsibilities
- Collect data  
- Display dashboards  
- Enforce role visibility  
- Never perform backend logic

## Airtable Responsibilities
- Store records  
- Maintain schema  
- Provide relationships  
- Never run business logic
