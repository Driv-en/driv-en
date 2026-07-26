equipment-detail.md (v1.0)
Purpose
Defines the complete layout, component structure, and role based visibility rules for the Equipment Detail page in Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Page Layout Structure (v1.0)
The Equipment Detail page contains four primary sections, always in this order:
1.	Equipment Header
2.	Equipment Specs
3.	PM History
4.	Issue History
Each section has strict role based visibility rules.
2. Equipment Header
Visible Fields
•	Equipment Name
•	Equipment Type
•	Division
•	Status
•	Meter Reading
•	Assigned Technician
•	Assigned Operator
Layout
•	Title: 24px bold
•	Subheader: 16px gray
•	Status badge: right aligned
•	Meter reading: numeric, right aligned
Role Rules
•	Technician: read only
•	Operator: read only
•	Foreman: read only
•	Manager: read only
•	Admin: full edit controls
3. Equipment Specs Section
Fields
All 34 fields from the locked Equipment Specs schema.
Layout
•	Two column layout
•	Labels left, values right
•	Section header: “Equipment Specifications”
Role Rules
•	Technician: read only
•	Operator: read only
•	Foreman: read only
•	Manager: read only
•	Admin: editable
Admin Edit Controls
•	Inline edit button
•	Opens modal with full CRUD access
•	Must not expose internal IDs
4. PM History Section
Visible Items
Each PM Completion record shows:
•	PM Name
•	Completion Timestamp
•	Technician Name
•	Meter Reading
•	Status Badge
•	Damage Severity Badge
•	Safety Severity Badge
Layout
•	Table component (from table-components.md)
•	Status column right aligned
•	Severity badges left aligned
Role Rules
•	Technician: read only
•	Operator: hidden
•	Foreman: read only
•	Manager: read only
•	Admin: full visibility
Admin Controls
•	Edit PM Completion
•	Delete PM Completion
•	View PM Template
•	View PM Schedule
5. Issue History Section
Visible Items
Each issue record shows:
•	Issue Type (Damage or Safety)
•	Severity Badge
•	Notes
•	Photos (if Technician submitted)
•	Reporter
•	Timestamp
Layout
•	Table component
•	Severity badge left aligned
•	Notes truncated with tooltip (admin only)
Role Rules
•	Technician: sees issues they created
•	Operator: sees issues they created
•	Foreman: sees all crew issues
•	Manager: sees all division issues
•	Admin: sees all issues system wide
Admin Controls
•	Edit issue
•	Close issue
•	Add admin notes
6. Role Based Page Behavior Summary
Technician
•	Read only
•	Sees PM history
•	Sees issues they created
•	Cannot edit anything
Operator
•	Read only
•	Sees issues they created
•	Cannot see PM history
•	Cannot edit anything
Foreman
•	Read only
•	Sees crew PM history
•	Sees crew issues
•	Cannot edit anything
Manager
•	Read only
•	Sees division PM history
•	Sees division issues
•	Cannot edit anything
Admin
•	Full CRUD
•	Can edit equipment
•	Can edit specs
•	Can edit PM history
•	Can edit issues
•	Can override validation
7. Page Navigation Rules
Entry Points
Users may reach this page from:
•	Dashboard cards
•	Equipment tables
•	PM history tables
•	Issue tables
Redirect Rules
If a user attempts to access equipment outside their role scope:
•	Redirect to their dashboard
•	No error message
•	No role disclosure
