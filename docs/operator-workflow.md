operator-workflow.md (v1.0)
Purpose
Defines the complete workflow for Operators in Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Operator Dashboard Entry Points
Operators may enter their workflow from:
1.	Dashboard → My Equipment
2.	Dashboard → PM Status (read-only)
3.	Dashboard → Report Issue
All entry points must follow the rules below.
2. Operator Equipment Visibility
Rules:
•	Operators may only see equipment assigned to them personally.
•	Operators may not see crew equipment.
•	Operators may not see division equipment.
•	Operators may not see technician assignments.
•	Operators may not see admin tables.
Fields visible:
•	Equipment Name
•	Equipment Type
•	Location
•	Status
•	Meter Reading (read-only)
•	PM Status (read-only)
Fields hidden:
•	PM Templates
•	PM Schedule
•	PM Completion history
•	Equipment Specs (write access)
•	Any admin-only fields
3. PM Status Visibility
Operators may view PM status for their assigned equipment:
Visible:
•	PM Name
•	Due Date
•	Status (Due, Overdue, Completed)
Not Visible:
•	PM Template details
•	PM Schedule details
•	PM Completion history
•	Technician notes
•	Technician photos
Operators cannot complete PMs.
4. Damage Reporting Workflow
Options:
•	None
•	Minor
•	Major
Rules:
•	If Minor or Major → create Damage Report record
•	Damage Report links to Equipment
•	Damage Report links to Operator
•	Damage Report visible to Foreman, Manager, Admin
•	Damage Report hidden from Technician (unless related to PM Completion)
•	Operators cannot upload photos for damage reports (v1.0)
5. Safety Issue Reporting Workflow
Options:
•	None
•	Hazard
•	Critical
Rules:
•	If Hazard or Critical → create Safety Issue record
•	Safety Issue links to Equipment
•	Safety Issue links to Operator
•	Safety Issue visible to Foreman, Manager, Admin
•	Safety Issue hidden from Technician (unless related to PM Completion)
6. Operator-Only UI Rules
Operators may:
•	View their assigned equipment
•	View PM status (read-only)
•	Report damage
•	Report safety issues
Operators may NOT:
•	Complete PMs
•	Upload photos
•	Edit equipment
•	Edit PM templates
•	Edit PM schedules
•	View technician PMs
•	Access foreman/manager/admin dashboards
•	Access customer or vendor tables
7. Cross-Workflow Dependencies
Operator reports must update:
•	Equipment → Damage/Safety Issue backlinks
•	Record Index → Damage/Safety Issue backlinks
•	Manager/Foreman dashboards → Issue counts
•	Admin dashboard → Issue counts
