foreman-workflow.md (v1.0)
Purpose
Defines the complete workflow for Foremen in Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Foreman Dashboard Entry Points
Foremen may enter their workflow from:
1.	Dashboard → Crew Equipment
2.	Dashboard → Crew PM Status
3.	Dashboard → Crew Overview
All entry points must follow the rules below.
2. Crew Equipment Visibility
Rules:
•	Foremen may see all equipment assigned to their crew.
•	Foremen may not see equipment assigned to other crews.
•	Foremen may not see division-wide equipment.
•	Foremen may not see admin tables.
Fields visible:
•	Equipment Name
•	Equipment Type
•	Location
•	Status
•	Meter Reading (read-only)
•	PM Status (read-only)
•	Equipment Specs (read-only)
Fields hidden:
•	PM Templates
•	PM Schedule
•	PM Completion history (full detail)
•	Technician internal notes
•	Admin-only fields
3. Crew PM Status Visibility
Foremen may view PM status for all crew equipment:
Visible:
•	PM Name
•	Due Date
•	Status (Due, Overdue, Completed)
•	Technician assigned
•	Completion timestamp (read-only)
Not Visible:
•	PM Template details
•	PM Schedule details
•	Technician internal notes
•	Technician photos (unless related to damage/safety)
Foremen cannot complete PMs.
4. Damage & Safety Issue Visibility
Foremen must see all issues reported by:
•	Technicians
•	Operators
Visible:
•	Damage Report severity
•	Safety Issue severity
•	Notes
•	Photos (if provided by Technician)
•	Equipment
•	Reporter
•	Timestamp
Not Visible:
•	Technician internal notes
•	Admin-only metadata
Foremen cannot create or edit issues.
5. Crew Overview Summary
Foremen must see a high-level summary:
•	Total Equipment
•	PMs Due
•	PMs Overdue
•	Damage Reports (count)
•	Safety Issues (count)
This summary is read-only.
6. Foreman-Only UI Rules
Foremen may:
•	View all crew equipment
•	View crew PM status
•	View crew damage/safety issues
•	View equipment specs (read-only)
Foremen may NOT:
•	Complete PMs
•	Upload photos
•	Edit equipment
•	Edit PM templates
•	Edit PM schedules
•	View division equipment
•	Access manager/admin dashboards
•	Access customer or vendor tables
7. Cross-Workflow Dependencies
Foreman views must update automatically when:
•	Technicians complete PMs
•	Operators report issues
•	Technicians report issues
•	Equipment meter readings change
•	PM Schedule updates
•	PM Completion records are created
Foremen do not trigger any automations.
