dashboard-definitions.md (v1.0)
Purpose
Defines the layout, components, and allowed interactions for each role’s dashboard. This file is authoritative. No other file may override these rules.
Technician Dashboard — /dashboard/tech
Primary Purpose: Complete PMs and report issues.
Sections
1.	Assigned Equipment List
o	Table of equipment assigned to the technician
o	Columns: Equipment Name, Type, Location, Status
o	Click → opens Equipment Detail (read only)
2.	PMs Due Today
o	List of PMs assigned to technician
o	Columns: PM Name, Equipment, Due Date, Status
o	Click → opens PM Completion Form
3.	PM Completion Form
o	Required fields: Meter Reading, Photos, Notes
o	Buttons: Submit, Cancel
4.	Report Issue
o	Damage Report
o	Safety Issue Report
Operator Dashboard — /dashboard/operator
Primary Purpose: Operate equipment and report issues.
Sections
1.	My Equipment
o	Equipment assigned to operator
o	Read only
2.	PM Status
o	Shows PMs for operator’s equipment
o	Read only
3.	Report Issue
o	Damage Report
o	Safety Issue Report
Foreman Dashboard — /dashboard/foreman
Primary Purpose: Oversee crew equipment and PM compliance.
Sections
1.	Crew Equipment
o	All equipment assigned to foreman’s crew
o	Read only
2.	Crew PM Status
o	PMs for all crew equipment
o	Read only
3.	Crew Overview
o	Summary: Total Equipment, PMs Due, PMs Overdue
Manager Dashboard — /dashboard/manager
Primary Purpose: Oversee division level equipment and PM compliance.
Sections
1.	Division Equipment
o	All equipment in manager’s division
o	Read only
2.	Division PM Status
o	PMs for all division equipment
o	Read only
3.	Division Overview
o	Summary: Total Equipment, PMs Due, PMs Overdue
Admin Dashboard — /dashboard/admin
Primary Purpose: Full system access.
Sections
1.	System Overview
o	Total Equipment
o	Total PMs
o	Total Divisions
o	Total Users
2.	Equipment Management
o	Full equipment list
o	Add / Edit / Archive equipment
3.	PM Templates
o	Full PM template list
o	Add / Edit templates
4.	PM Schedule
o	Full schedule
o	Add / Edit schedules
5.	User Management
o	Add / Edit users
o	Assign roles
6.	Division Management
o	Add / Edit divisions
Cross Dashboard Rules
•	No dashboard shows navigation items for other roles.
•	No dashboard shows admin only tables except Admin.
•	No dashboard allows PM completion except Technician.
•	No dashboard allows issue reporting except Technician + Operator.
•	All dashboards use the same header:
o	Left: DRIV EN logo
o	Right: Login/Account Icon (22×22, dark gray, transparent)
