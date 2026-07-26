issue-reporting-page.md (v1.0)
Purpose
Defines the complete layout, field rules, validation logic, submission behavior, and role based visibility for the Damage Report and Safety Issue reporting pages in Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Page Layout Structure (v1.0)
The Issue Reporting page contains four primary sections, always in this order:
1.	Issue Header
2.	Equipment Summary
3.	Issue Fields
4.	Submit Area
2. Issue Header
Visible Fields
•	Issue Type (Damage or Safety)
•	Equipment Name
•	Equipment Type
•	Severity Badge (updates after selection)
Layout
•	Title: 24px bold
•	Subheader: 16px gray
•	Severity badge: right aligned
Role Rules
•	Technician: visible
•	Operator: visible
•	Foreman/Manager/Admin: visible (read-only)
3. Equipment Summary Section
Visible Fields
•	Equipment Name
•	Equipment Type
•	Division
•	Current Meter Reading
•	Assigned Technician
•	Assigned Operator
Layout
•	Two column layout
•	Labels left, values right
•	Section header: “Equipment Summary”
Role Rules
•	Technician: visible
•	Operator: visible
•	Foreman/Manager/Admin: visible (read-only)
4. Issue Fields Section
Damage Report Fields
•	Severity (single select: None, Minor, Major)
•	Notes (long text)
•	Photos (Technician only; Operator cannot upload photos)
Safety Issue Fields
•	Severity (single select: None, Hazard, Critical)
•	Notes (long text)
•	Photos (Technician only; Operator cannot upload photos)
Field Rules
Severity
•	Required
•	Must match one of the allowed values
•	Cannot be left as “None” if photos show damage (admin override only)
Notes
•	Optional
•	Long text
•	Truncated in tables with tooltip (admin only)
Photos
•	Technician: allowed
•	Operator: not allowed
•	Formats: JPG, PNG
•	Thumbnails: 64×64px
•	Delete icon: small “x”
5. Hidden Auto Populated Fields
These fields are never shown to Technician or Operator.
•	Equipment ID
•	Reporter ID
•	Timestamp
•	Sync metadata fields
These fields are populated automatically on submission.
6. Submission Logic
On Submit:
1.	Validate severity
2.	Validate required fields
3.	Save Issue record
4.	Link Issue → Equipment
5.	Link Issue → Reporter
6.	Sync metadata
7.	Redirect user to their dashboard
Error Handling
•	Severity missing → block submission
•	Technician missing photo (if required by workflow) → block submission
•	Invalid field type → block submission
7. Role Based Page Behavior Summary
Technician
•	Can report damage
•	Can report safety issues
•	Can upload photos
•	Can add notes
•	Cannot edit equipment
•	Cannot edit PM templates
•	Cannot edit PM schedules
Operator
•	Can report damage
•	Can report safety issues
•	Cannot upload photos
•	Cannot edit equipment
•	Cannot edit PM templates
•	Cannot edit PM schedules
Foreman
•	Read-only
•	Sees crew issues
•	Cannot submit issues
Manager
•	Read-only
•	Sees division issues
•	Cannot submit issues
Admin
•	Full CRUD
•	Can edit issues
•	Can close issues
•	Can override validation
8. Page Navigation Rules
Entry Points
Users may reach this page from:
•	Dashboard → Report Issue
•	Equipment Detail → Report Issue
•	PM Completion → Damage/Safety Issue auto creation
Redirect Rules
If a Foreman/Manager attempts to submit an issue:
•	Redirect to their dashboard
•	No error message
•	No role disclosure
