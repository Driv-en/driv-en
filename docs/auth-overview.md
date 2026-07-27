# Auth Overview (v1.0)

## Auth Flow
1. UI sends token to /auth/validate
2. Worker verifies:
   - Token validity
   - Role
   - Division
   - Employee status
3. Worker injects user context
4. Worker returns access decision

## Roles
- Admin
- Manager
- Foreman
- Technician
- Operator

## Rules
- No anonymous access
- No bypassing auth
- No UI‑side role logic
