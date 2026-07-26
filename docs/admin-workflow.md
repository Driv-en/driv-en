admin-workflow.md (v1.0)
Purpose
Defines the complete workflow for Admins in Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Admin Dashboard Entry Points
Admins may enter their workflow from:
1.	Dashboard → System Overview
2.	Dashboard → Equipment Management
3.	Dashboard → PM Templates
4.	Dashboard → PM Schedule
5.	Dashboard → User Management
6.	Dashboard → Division Management
All entry points must follow the rules below.
2. System Overview
Admins must see a high-level summary:
•	Total Equipment
•	Total PM Templates
•	Total PM Schedules
•	Total PM Completions
•	Total Divisions
•	Total Users
•	Total Damage Reports
•	Total Safety Issues
This summary is fully visible and fully editable where applicable.
3. Equipment Management
Admins have full CRUD access.
Admins may:
•	Add equipment
•	Edit equipment
•	Archive equipment
•	Update meter type
•	Update meter reading
•	Update status
•	Assign technician
•	Assign operator
•	Assign division
•	Edit Equipment Specs
•	View all PM relationships
Admins may NOT:
•	Nothing — full access.
4. PM Template Management
Admins have full CRUD access.
Admins may:
•	Add PM Templates
•	Edit PM Templates
•	Delete PM Templates
•	Trigger PM Template generation
•	Modify intervals
•	Modify meter thresholds
•	Modify relationships to PM Families and Equipment Types
Admins may NOT:
•	Nothing — full access.
5. PM Schedule Management
Admins have full CRUD access.
Admins may:
•	Add PM Schedules
•	Edit PM Schedules
•	Delete PM Schedules
•	Modify next due date
•	Modify next meter threshold
•	Modify relationships to Equipment and PM Templates
Admins may NOT:
•	Nothing — full access.
6. User Management
Admins have full CRUD access.
Admins may:
•	Add users
•	Edit users
•	Delete users
•	Assign roles
•	Assign divisions
•	Reset passwords (v1.0 placeholder)
•	View all user activity (read-only)
Admins may NOT:
•	Nothing — full access.
7. Division Management
Admins have full CRUD access.
Admins may:
•	Add divisions
•	Edit divisions
•	Delete divisions
•	Assign managers
•	Assign foremen
•	Assign equipment to divisions
Admins may NOT:
•	Nothing — full access.
8. Issue Visibility (Damage & Safety)
Admins must see all issues reported by:
•	Technicians
•	Operators
•	Foremen
•	Managers
Admins may:
•	View all issue details
•	View all photos
•	Edit issue records
•	Close issues
•	Reassign issues
•	Add admin notes
Admins may NOT:
•	Nothing — full access.
9. Cross-Workflow Dependencies
Admin actions must update:
•	Equipment
•	Equipment Specs
•	PM Templates
•	PM Schedule
•	PM Completion
•	Record Index
•	Division assignments
•	User roles
•	Issue visibility across all dashboards
Admins may trigger automations indirectly through edits.
