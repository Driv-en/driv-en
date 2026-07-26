admin-crud-pages.md (v1.0)
Purpose
Defines the complete layout, component structure, validation rules, and interaction behavior for all Admin CRUD pages in Driv en v1.0. This file is authoritative. No other file may override these rules.
1. CRUD Page Types Covered
Admin CRUD pages exist for:
1.	Equipment Management
2.	PM Template Management
3.	PM Schedule Management
4.	User Management
5.	Division Management
All CRUD pages must follow the same structural pattern.
2. Page Layout Structure (Universal)
Each CRUD page contains five primary sections, always in this order:
1.	Page Header
2.	Record Table
3.	Create Button
4.	Edit Modal
5.	Delete Modal
3. Page Header
Layout
•	Title: 24px bold
•	Subtitle: 16px gray
•	Right side: “Create New” button (green)
Rules
•	Must not expose internal IDs
•	Must not include role names
•	Must not include system metadata
4. Record Table
Uses the table component defined in table-components.md.
Columns
•	Name / Title
•	Type (if applicable)
•	Status
•	Assigned Division / User / Equipment (if applicable)
•	Action Column (Admin only)
Action Column Icons
•	Edit (pencil)
•	Delete (trash)
•	View (eye)
Rules
•	Admin only
•	Sorting enabled
•	No inline editing
•	No bulk actions in v1.0
5. Create Button
Button Style
•	Background: #009933
•	Text: white
•	Border-radius: 6px
•	Height: 40px
•	Padding: 0 16px
Behavior
•	Opens Create Modal
•	Must not pre-fill fields
•	Must not expose internal IDs
6. Edit Modal (Universal)
Modal Layout
•	Width: 640px
•	Background: white
•	Border-radius: 8px
•	Padding: 24px
•	Section headers: 20px bold
•	Fields spaced 16px apart
Modal Sections
1.	Record Info
2.	Linked Records
3.	Status / Settings
4.	Save / Cancel Buttons
Field Types
•	Text input
•	Numeric input
•	Single select
•	Multi-select
•	Linked record selector
•	Status selector
Rules
•	Must validate required fields
•	Must block submission on error
•	Must not expose internal IDs
•	Must not allow editing of sync metadata
•	Must not allow editing of auto-generated fields
7. Delete Modal (Universal)
Modal Layout
•	Title: “Delete Record”
•	Warning text: red
•	Buttons:
o	Delete (red)
o	Cancel (gray)
Rules
•	Must require explicit confirmation
•	Must not allow bulk deletion
•	Must not expose internal IDs
•	Must not delete linked records
8. CRUD Logic by Page Type
Equipment Management
Editable Fields
•	Equipment Name
•	Equipment Type
•	Division
•	Status
•	Meter Type
•	Meter Reading
•	Assigned Technician
•	Assigned Operator
•	All Equipment Specs fields
Non Editable Fields
•	Equipment ID
•	Sync metadata
PM Template Management
Editable Fields
•	Template Name
•	Interval
•	Meter Threshold
•	PM Family
•	Equipment Type
•	Instructions
Non Editable Fields
•	Template ID
•	Auto-generated relationships
PM Schedule Management
Editable Fields
•	Equipment
•	PM Template
•	Next Due Date
•	Next Meter Threshold
•	Status
Non Editable Fields
•	Schedule ID
•	Auto-generated fields
User Management
Editable Fields
•	Name
•	Email
•	Role
•	Division
•	Status
Non Editable Fields
•	User ID
•	Sync metadata
Division Management
Editable Fields
•	Division Name
•	Manager
•	Foreman
•	Assigned Equipment
Non Editable Fields
•	Division ID
•	Sync metadata
9. Role Based Behavior Summary
Admin
•	Full CRUD
•	Can override validation
•	Can modify linked records
•	Can delete records
•	Can edit any field except internal IDs
All Other Roles
•	Cannot access CRUD pages
•	Redirect to their dashboard
10. Navigation Rules
Entry Points
Admin may reach CRUD pages from:
•	Dashboard → System Overview
•	Dashboard → Equipment Management
•	Dashboard → PM Templates
•	Dashboard → PM Schedule
•	Dashboard → User Management
•	Dashboard → Division Management
Redirect Rules
Non-admin roles attempting access:
•	Redirect to their dashboard
•	No error message
•	No role disclosure
