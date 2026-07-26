table-components.md (v1.0)
Purpose
Defines all table components used across Driv en v1.0, including layout, styling, sorting rules, role-based permissions, empty states, and loading states. This file is authoritative. No other file may override these rules.
1. Table Layout (Universal)
Dimensions & Spacing
•	Row height: 48px
•	Header height: 48px
•	Column spacing: 16px
•	Table width: 100%
•	Max width (desktop): 1000px
•	Mobile: full width, horizontal scroll allowed
Borders & Backgrounds
•	Table border: 1px solid #e5e5e5
•	Header background: #f8f8f8
•	Row background: white
•	Row hover: #fafafa
Typography
•	Header text: 14px, bold, #333
•	Row text: 14px, #333
•	Status/severity badges: inline components (defined separately)
2. Table Header Rules
Header Behavior
•	Admin: sortable columns
•	All other roles: non-sortable
•	Sort icon: gray arrow (admin only)
•	Header must never expose internal IDs
•	Header must never expose admin-only fields to non-admin roles
Alignment
•	Text left-aligned
•	Status column right-aligned
•	Action column (admin only) right-aligned
3. Table Row Behavior
Hover Behavior
•	Background changes to #fafafa
•	Cursor:
o	Admin: pointer (clickable rows)
o	All other roles: default (read-only)
Row Click Behavior
•	Technician: opens equipment detail (read-only)
•	Operator: opens equipment detail (read-only)
•	Foreman: opens crew equipment detail (read-only)
•	Manager: opens division equipment detail (read-only)
•	Admin: opens full detail page with edit controls
Row Restrictions
•	No inline editing in v1.0
•	No drag-and-drop
•	No multi-select rows
•	No bulk actions (v1.0)
4. Column Types
Text Column
•	Standard left-aligned text
•	Truncation: ellipsis after 1 line
•	Tooltip on hover (admin only)
Numeric Column
•	Right-aligned
•	No commas for meter readings
•	Commas allowed for large admin-only numeric fields
Status Column
•	Right-aligned
•	Uses PM status badges
•	Must not show admin-only statuses to non-admin roles
Severity Column
•	Left-aligned
•	Uses damage/safety severity badges
•	Must not show admin-only severity overrides to non-admin roles
Action Column (Admin Only)
•	Right-aligned
•	Contains:
o	Edit
o	Delete
o	View
•	Icons: 18×18px, gray
5. Role-Based Table Permissions
Technician
•	Read-only
•	No sorting
•	No actions
•	No admin fields
•	No internal IDs
Operator
•	Read-only
•	No sorting
•	No actions
•	No admin fields
•	No internal IDs
Foreman
•	Read-only
•	No sorting
•	No actions
•	No admin fields
•	No internal IDs
Manager
•	Read-only
•	No sorting
•	No actions
•	No admin fields
•	No internal IDs
Admin
•	Full CRUD
•	Sorting enabled
•	Action column visible
•	All fields visible except internal system IDs
•	Can open detail pages for editing
6. Empty State Rules
Empty State Component
•	Icon: gray outline
•	Text: “No items available”
•	Font size: 14px
•	Padding: 32px
•	Background: white
•	Border: 1px solid #e5e5e5
•	Border-radius: 8px
Rules
•	Must not expose role information
•	Must not show admin-only controls to non-admin roles
•	Must not show “Add Item” button except for Admin
7. Loading State Rules
Loading Component
•	Spinner: gray
•	Text: “Loading…”
•	Font size: 14px
•	Padding: 24px
Rules
•	Must be identical across all dashboards
•	Must not reveal role or data structure
•	Must not show admin-only controls during loading
8. Table Accessibility Rules
Contrast
•	Header background must meet WCAG AA
•	Text must remain readable at 14px
•	Badges must meet contrast requirements
Keyboard Navigation
•	Admin:
o	Tab through action icons
o	Enter to activate
•	All other roles:
o	Tab through rows (read-only)
