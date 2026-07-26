pm-completion-page.md (v1.0)
Purpose
Defines the complete layout, field rules, validation logic, submission behavior, and role based visibility for the PM Completion page in Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Page Layout Structure (v1.0)
The PM Completion page contains five primary sections, always in this order:
1.	PM Header
2.	Equipment Summary
3.	Required Fields
4.	Optional Fields
5.	Submit Area
2. PM Header
Visible Fields
•	PM Name
•	PM Template
•	Equipment Name
•	Equipment Type
•	Status Badge (Due / Overdue)
•	Next Meter Threshold
•	Next Due Date
Layout
•	Title: 24px bold
•	Subheader: 16px gray
•	Status badge: right aligned
Role Rules
•	Technician: visible
•	All other roles: hidden
•	Admin: visible (read-only unless editing PM Completion)
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
•	Admin: visible
•	All other roles: hidden
4. Required Fields Section
These fields must be completed before submission.
Required Fields
•	Meter Reading (numeric)
•	Photos (minimum 1)
•	Damage Report (single select: None, Minor, Major)
•	Safety Issue Report (single select: None, Hazard, Critical)
Field Rules
Meter Reading
•	Must be ≥ previous reading
•	If lower → error
•	If unusually high → warning
•	Updates Equipment → Meter Reading
•	Updates PM Schedule → Next Meter Threshold
Photos
•	Minimum: 1
•	Maximum: unlimited
•	Formats: JPG, PNG
•	Thumbnails: 64×64px
•	Delete icon: small “x”
Damage Report
•	If Minor or Major → create Damage Report record
•	Links to Equipment
•	Links to PM Completion
Safety Issue Report
•	If Hazard or Critical → create Safety Issue record
•	Links to Equipment
•	Links to PM Completion
5. Optional Fields Section
Optional Fields
•	Notes (long text)
•	Additional Comments
•	Technician Internal Notes (hidden from non-admin roles)
Rules
•	Optional fields do not block submission
•	Technician Internal Notes visible only to Admin
6. Hidden Auto Populated Fields
These fields are never shown to Technicians.
•	PM Template ID
•	PM Schedule ID
•	Equipment ID
•	Completion Timestamp
•	Technician ID
•	Sync metadata fields
These fields are populated automatically on submission.
7. Submission Logic
On Submit:
1.	Validate required fields
2.	Validate meter reading
3.	Save PM Completion record
4.	Update Equipment meter reading
5.	Update PM Schedule next due date
6.	Update PM Schedule next meter threshold
7.	Mark PM Completion as “Completed”
8.	Create Damage/Safety Issue records if needed
9.	Sync metadata
10.	Redirect Technician to /dashboard/tech
Error Handling
•	Required fields missing → block submission
•	Meter reading invalid → block submission
•	Photo missing → block submission
•	Severity missing → block submission
8. Role Based Page Behavior Summary
Technician
•	Full access to PM Completion form
•	Can upload photos
•	Can report damage/safety
•	Can add notes
•	Cannot edit equipment
•	Cannot edit PM templates
•	Cannot edit PM schedules
Admin
•	Can view PM Completion
•	Can edit PM Completion
•	Can override validation
•	Can modify linked records
Operator / Foreman / Manager
•	Cannot access PM Completion page
•	Redirect to their dashboard
9. Page Navigation Rules
Entry Points
Technicians may reach this page from:
•	Dashboard → PMs Due Today
•	Dashboard → Assigned Equipment → PM List
•	PM Schedule table
Redirect Rules
If a non technician attempts to access this page:
•	Redirect to their dashboard
•	No error message
•	No role disclosure
