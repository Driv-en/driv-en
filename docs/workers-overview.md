# Cloudflare Workers Overview (v1.0)

## Worker Categories
1. Auth Worker
2. Equipment Worker
3. PM Worker
4. Inspection Worker
5. Work Order Worker
6. Compliance Worker

## Responsibilities
- Validate payloads
- Enforce workflow rules
- Write to Airtable
- Trigger downstream automations
- Log all actions

## Required Logging
- Timestamp
- User ID
- Role
- Endpoint
- Payload
- Validation results
- Airtable sync results
- Errors

## Required Validation
- Required fields
- Role permissions
- Division permissions
- Status transitions
- PM logic
- Inspection logic
- Work order logic
