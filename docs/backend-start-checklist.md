# Backend Start Checklist (Cloudflare Workers)

## Setup
- Validate Airtable API keys
- Validate Worker routing
- Validate Worker environment variables

## Build
- Auth Worker
- Equipment Worker
- PM Worker
- Inspection Worker
- Work Order Worker
- Compliance Worker

## Validate
- Payload structure
- Required fields
- Role permissions
- Division permissions
- Status transitions

## Test
- PM generation
- Inspection → Work Order
- PM review → Work Order
- Status → Work Order
- Technician completion
- Foreman review

## Log
- All Worker actions
- All validation failures
- All Airtable syncs
