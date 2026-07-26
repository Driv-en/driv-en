system-navigation.md (v1.0)
Purpose
Defines global navigation rules, header behavior, role-based visibility, and URL structure for Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Global Header Specification
Left Side:
•	DRIV EN logo (locked design)
•	Clicking logo always redirects to the user’s dashboard based on role
Right Side:
•	Login/Account Icon (22×22, dark gray, transparent)
•	Behavior:
o	If no session → redirect to /login
o	If session exists → dropdown with “Logout”
Header Rules:
•	Header appears on every page except /login
•	Header must never show role-specific navigation items
•	Header must never show admin-only controls to non-admin roles
2. Global Navigation Rules
No sidebar navigation in v1.0
All navigation is:
•	Header logo → dashboard
•	Dashboard cards → workflow entry points
•	Role-based dashboards → role-specific pages
•	No multi-level menus
•	No nested navigation
•	No customer-facing navigation
This keeps v1.0 clean and audit-ready.
3. Role-Based Navigation Visibility
Technician
Visible:
•	Dashboard
•	Assigned Equipment
•	PMs Due Today
•	PM Completion Form
•	Issue Reporting
Hidden:
•	All admin pages
•	All manager pages
•	All foreman pages
•	All operator pages
•	All PM template/schedule pages
Operator
Visible:
•	Dashboard
•	My Equipment
•	PM Status
•	Issue Reporting
Hidden:
•	All technician pages
•	All foreman pages
•	All manager pages
•	All admin pages
•	All PM template/schedule pages
Foreman
Visible:
•	Dashboard
•	Crew Equipment
•	Crew PM Status
•	Crew Overview
Hidden:
•	All technician pages
•	All operator pages
•	All manager pages
•	All admin pages
•	All PM template/schedule pages
Manager
Visible:
•	Dashboard
•	Division Equipment
•	Division PM Status
•	Division Overview
Hidden:
•	All technician pages
•	All operator pages
•	All foreman pages
•	All admin pages
•	All PM template/schedule pages
Admin
Visible:
•	Dashboard
•	System Overview
•	Equipment Management
•	PM Templates
•	PM Schedule
•	User Management
•	Division Management
Hidden:
•	Nothing — full access
4. URL Structure (v1.0)
Authentication
•	/login
•	/logout (triggered via header icon)
Dashboards
•	/dashboard/tech
•	/dashboard/operator
•	/dashboard/foreman
•	/dashboard/manager
•	/dashboard/admin
Equipment
•	/equipment/{id} (read-only except admin)
PM Workflows
•	/pm/{scheduleId}/complete (technician only)
•	/pm/{templateId} (admin only)
Issues
•	/issue/damage/{id}
•	/issue/safety/{id}
Admin Pages
•	/admin/equipment
•	/admin/templates
•	/admin/schedule
•	/admin/users
•	/admin/divisions
5. Redirect Logic
If user visits a page outside their role:
•	Redirect to their dashboard
•	No error message
•	No role disclosure
If user visits a dashboard they don’t own:
•	Redirect to their dashboard
If user visits admin pages without admin role:
•	Redirect to their dashboard
If user visits /login with active session:
•	Redirect to their dashboard
6. Session Enforcement
Every page except /login must enforce:
•	If no session → redirect to /login
•	If session exists → allow access
•	If session exists but role mismatches page → redirect to correct dashboard
