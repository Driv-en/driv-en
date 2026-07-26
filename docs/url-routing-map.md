url-routing-map.md (v1.0)
Purpose
Defines the complete URL routing structure for Driv en v1.0, including authentication, dashboards, workflows, admin pages, and issue management. This file is authoritative. No other file may override these rules.
1. Authentication Routes
/login
•	Public
•	Shows login form
•	If session exists → redirect to user’s dashboard
/logout
•	Clears session
•	Redirects to /login
2. Dashboard Routes
Technician
•	/dashboard/tech
Operator
•	/dashboard/operator
Foreman
•	/dashboard/foreman
Manager
•	/dashboard/manager
Admin
•	/dashboard/admin
Rules
•	If user visits a dashboard they don’t own → redirect to their dashboard
•	No dashboard may show navigation items for other roles
3. Equipment Routes
/equipment/{id}
•	Read-only for all roles except Admin
•	Admin may edit equipment and specs
/equipment/{id}/specs
•	Read-only for Technician, Operator, Foreman, Manager
•	Editable only by Admin
4. PM Workflow Routes
PM Completion (Technician only)
•	/pm/{scheduleId}/complete
PM Template (Admin only)
•	/pm/template/{templateId}
PM Schedule (Admin only)
•	/pm/schedule/{scheduleId}
Rules
•	Non-admin roles cannot access PM template or schedule pages
•	Non-technician roles cannot access PM completion pages
5. Issue Management Routes
Damage Reports
•	/issue/damage/{id}
o	Visible to Technician, Foreman, Manager, Admin
o	Hidden from Operator unless they created it
Safety Issues
•	/issue/safety/{id}
o	Visible to Technician, Foreman, Manager, Admin
o	Hidden from Operator unless they created it
6. Admin Routes
Equipment
•	/admin/equipment
PM Templates
•	/admin/templates
PM Schedule
•	/admin/schedule
Users
•	/admin/users
Divisions
•	/admin/divisions
System Overview
•	/admin/system
Rules
•	Only Admin may access these routes
•	Non-admin roles → redirect to their dashboard
7. Redirect Rules
If user visits a page outside their role:
•	Redirect to their dashboard
•	No error message
•	No role disclosure
If user visits admin pages without admin role:
•	Redirect to their dashboard
If user visits /login with active session:
•	Redirect to their dashboard
If user visits PM completion without technician role:
•	Redirect to their dashboard
8. Session Enforcement
Every page except /login must enforce:
•	If no session → redirect to /login
•	If session exists → allow access
•	If session exists but role mismatches page → redirect to correct dashboard
