dashboard-definitions.md (v1.0)
Purpose
Defines the complete layout, card structure, table placement, and role based visibility rules for all dashboards in Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Universal Dashboard Layout Rules
All dashboards follow the same structural pattern:
Page Structure
1.	Dashboard Header
2.	Primary Cards Section
3.	Secondary Cards Section (if applicable)
4.	Tables Section
5.	Summary Section (role specific)
Spacing
•	Section header: 20px bold
•	Section spacing: 24px
•	Card spacing: 16px
•	Table spacing: 24px
Rules
•	Dashboards must never expose admin only controls to non admin roles
•	Dashboards must never show role names
•	Dashboards must never show internal IDs
2. Technician Dashboard
Primary Cards
•	Assigned Equipment
•	PMs Due Today
•	Report Issue
Tables
•	Assigned Equipment Table
•	PMs Due Table
Summary Section
•	Total Assigned Equipment
•	PMs Due
•	PMs Overdue
Role Rules
•	Full visibility of technician specific workflows
•	No admin, manager, foreman, or operator content
3. Operator Dashboard
Primary Cards
•	My Equipment
•	PM Status
•	Report Issue
Tables
•	My Equipment Table
•	PM Status Table (read only)
Summary Section
•	Total Equipment
•	PMs Due
•	PMs Overdue
Role Rules
•	No PM completion
•	No photo upload
•	No admin content
4. Foreman Dashboard
Primary Cards
•	Crew Equipment
•	Crew PM Status
•	Crew Overview
Tables
•	Crew Equipment Table
•	Crew PM Status Table
Summary Section
•	Total Crew Equipment
•	PMs Due
•	PMs Overdue
•	Damage Reports
•	Safety Issues
Role Rules
•	Read only
•	No PM completion
•	No issue submission
•	No admin content
5. Manager Dashboard
Primary Cards
•	Division Equipment
•	Division PM Status
•	Division Overview
Tables
•	Division Equipment Table
•	Division PM Status Table
Summary Section
•	Total Division Equipment
•	PMs Due
•	PMs Overdue
•	Damage Reports
•	Safety Issues
Role Rules
•	Read only
•	No PM completion
•	No issue submission
•	No admin content
6. Admin Dashboard
Primary Cards
•	System Overview
•	Equipment Management
•	PM Templates
•	PM Schedule
•	User Management
•	Division Management
Tables
•	System Overview Table
•	Equipment Table
•	PM Template Table
•	PM Schedule Table
•	User Table
•	Division Table
Summary Section
•	Total Equipment
•	Total PM Templates
•	Total PM Schedules
•	Total Users
•	Total Divisions
•	Total Issues
Role Rules
•	Full CRUD
•	Full visibility
•	No restrictions
7. Dashboard Navigation Rules
Entry Points
Dashboards are reached via:
•	Logo click
•	Login redirect
•	Role based routing
Redirect Rules
If user visits a dashboard they don’t own:
•	Redirect to their dashboard
•	No error message
•	No role disclosure
