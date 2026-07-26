manager-workflow.md (v1.0)
Purpose
Defines the complete workflow for Managers in Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Manager Dashboard Entry Points
Managers may enter their workflow from:
1.	Dashboard → Division Equipment
2.	Dashboard → Division PM Status
3.	Dashboard → Division Overview
All entry points must follow the rules below.
2. Division Equipment Visibility
Rules:
•	Managers may see all equipment in their division.
•	Managers may not see equipment from other divisions.
•	Managers may not see admin-only tables.
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
3. Division PM Status Visibility
Managers may view PM status for all division equipment:
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
Managers cannot complete PMs.
4. Damage & Safety Issue Visibility
Managers must see all issues reported by:
•	Technicians
•	Operators
•	Foremen
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
Managers cannot create or edit issues.
5. Division Overview Summary
Managers must see a high-level summary:
•	Total Equipment
•	PMs Due
•	PMs Overdue
•	Damage Reports (count)
•	Safety Issues (count)
This summary is read-only.
6. Manager-Only UI Rules
Managers may:
•	View all division equipment
•	View division PM status
•	View division damage/safety issues
•	View equipment specs (read-only)
Managers may NOT:
•	Complete PMs
•	Upload photos
•	Edit equipment
•	Edit PM templates
•	Edit PM schedules
•	View admin dashboards
•	Access customer or vendor tables
7. Cross-Workflow Dependencies
Manager views must update automatically when:
•	Technicians complete PMs
•	Operators report issues
•	Foremen report issues
•	Equipment meter readings change
•	PM Schedule updates
•	PM Completion records are created
Managers do not trigger any automations.
