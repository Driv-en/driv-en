# UI → Worker Integration (v1.0)

## Equipment
UI → POST /equipment/update
UI → POST /equipment/status
UI → POST /equipment/meter
UI → POST /equipment/fuel

## PM
UI → POST /pm/complete
UI → POST /pm/review

## Inspections
UI → POST /inspection/create
UI → POST /inspection/complete
UI → POST /inspection/flag

## Work Orders
UI → POST /workorder/create
UI → POST /workorder/update
UI → POST /workorder/complete

## Rules
- UI must send JSON payloads
- UI must handle Worker responses
- UI must display errors cleanly
