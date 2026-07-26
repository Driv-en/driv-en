technician-workflow.md (v1.0)
Purpose
Defines the complete PM Completion workflow for Technicians in Driv en v1.0. This file is authoritative. No other file may override these rules.
1. PM Completion Entry Points
Technicians may enter the PM Completion workflow from:
1.	Dashboard → PMs Due Today
2.	Dashboard → Assigned Equipment → PM List
3.	Direct link from PM Schedule (auto-generated)
All entry points must open the same PM Completion Form.
2. PM Completion Form Requirements
Required Fields
•	Meter Reading (numeric)
•	Photos (multiple attachments allowed)
•	Notes (long text)
•	Damage Report (single select: None, Minor, Major)
•	Safety Issue Report (single select: None, Hazard, Critical)
Optional Fields
•	Additional Comments
•	Technician Internal Notes (hidden from non-admin roles)
Hidden Fields (auto-populated)
•	PM Template ID
•	PM Schedule ID
•	Equipment ID
•	Completion Timestamp
•	Technician ID
•	Sync metadata fields
3. Meter Reading Logic
Rules:
•	Meter Reading must be greater than or equal to the previous reading
•	If meter reading is lower → show error: “Meter reading cannot be lower than the previous value.”
•	If meter reading is extremely high (threshold defined in Equipment Specs) → show warning: “This reading is unusually high. Please confirm.”
•	Meter Reading updates Equipment → Meter Reading field
•	Meter Reading updates PM Schedule → Next Meter Threshold
4. Photo Upload Requirements
Rules:
•	Minimum: 1 photo
•	Maximum: unlimited
•	Accepted formats: JPG, PNG
•	Photos stored in PM Completion table
•	Photos linked to Equipment for historical review
•	Photos visible to:
o	Technician
o	Foreman
o	Manager
o	Admin
•	Photos not visible to Operator
5. Damage Reporting Workflow
Options:
•	None
•	Minor
•	Major
Rules:
•	If Minor or Major → create Damage Report record
•	Damage Report links to Equipment
•	Damage Report links to PM Completion
•	Damage Report visible to Foreman, Manager, Admin
•	Damage Report hidden from Operator
6. Safety Issue Reporting Workflow
Options:
•	None
•	Hazard
•	Critical
Rules:
•	If Hazard or Critical → create Safety Issue record
•	Safety Issue links to Equipment
•	Safety Issue links to PM Completion
•	Safety Issue visible to Foreman, Manager, Admin
•	Safety Issue hidden from Operator
7. PM Completion Submission Logic
On Submit:
1.	Validate required fields
2.	Validate meter reading
3.	Save PM Completion record
4.	Update Equipment meter reading
5.	Update PM Schedule next due date
6.	Update PM Schedule next meter threshold
7.	Mark PM Completion as “Completed”
8.	Sync metadata
9.	Redirect Technician to /dashboard/tech
8. Technician-Only UI Rules
Technicians may:
•	Complete PMs
•	Upload photos
•	Report damage
•	Report safety issues
•	Add notes
Technicians may NOT:
•	Edit Equipment
•	Edit PM Templates
•	Edit PM Schedule
•	View other technicians’ PMs
•	Access admin dashboards
•	Access customer or vendor tables
9. Cross-Workflow Dependencies
PM Completion must update:
•	Equipment → Meter Reading
•	PM Schedule → Next Due Date
•	PM Schedule → Next Meter Threshold
•	PM Templates → Historical PM Completion backlink
•	Record Index → PM Completion backlink
