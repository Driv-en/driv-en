dashboard-components.md (v1.0)
Purpose
Defines all reusable UI components used across Technician, Operator, Foreman, Manager, and Admin dashboards. This file is authoritative. No other file may override these rules.
1. Dashboard Card Components
Dashboard cards are the primary navigation elements for all roles.
Card Layout (v1.0)
•	Width: 100% (mobile), 320px (desktop)
•	Height: 140px
•	Background: white
•	Border: 1px solid #e5e5e5
•	Border-radius: 8px
•	Padding: 16px
•	Shadow: none (v1.0 is flat UI)
•	Hover: border darkens to #d0d0d0
•	Cursor: pointer
Card Content
•	Title (bold, 18px)
•	Subtitle (14px, gray)
•	Optional status badge (right-aligned)
Card Behavior
•	Clicking card → navigates to the associated workflow
•	Cards must never expose role information
•	Cards must never show admin-only controls to non-admin roles
2. Table Components
Tables are used for equipment lists, PM status, issue lists, and admin management pages.
Table Layout (v1.0)
•	Header background: #f8f8f8
•	Header text: 14px, bold
•	Row height: 48px
•	Row hover: background #fafafa
•	Border: 1px solid #e5e5e5
•	Column spacing: 16px
Table Behavior
•	Technician: read-only
•	Operator: read-only
•	Foreman: read-only
•	Manager: read-only
•	Admin: full CRUD
Table Sorting
•	Admin: sortable
•	All other roles: non-sortable
3. Section Headers
Used to divide dashboard content into logical areas.
Section Header Layout
•	Font size: 20px
•	Font weight: bold
•	Margin-top: 24px
•	Margin-bottom: 12px
•	Color: #333
Rules
•	Section headers must be consistent across all dashboards
•	Section headers must not include role names
•	Section headers must not include admin-only indicators
4. Status Indicators (PM Status)
Used in Technician, Foreman, Manager dashboards.
Status Types
•	Due — yellow badge
•	Overdue — red badge
•	Completed — green badge
Badge Layout
•	Font size: 12px
•	Padding: 4px 8px
•	Border-radius: 6px
•	Text color: white
Badge Colors
•	Due: #e6b800
•	Overdue: #cc0000
•	Completed: #009933
5. Issue Severity Badges
Used for Damage Reports and Safety Issues.
Damage Severity
•	None — gray
•	Minor — orange
•	Major — red
Safety Severity
•	None — gray
•	Hazard — orange
•	Critical — red
Badge Layout
•	Font size: 12px
•	Padding: 4px 8px
•	Border-radius: 6px
•	Text color: white
Badge Colors
•	Gray: #666
•	Orange: #ff9900
•	Red: #cc0000
6. Empty State Components
Used when tables or lists have no data.
Empty State Layout
•	Icon: gray outline
•	Text: “No items available”
•	Font size: 14px
•	Padding: 32px
•	Background: white
•	Border: 1px solid #e5e5e5
•	Border-radius: 8px
Rules
•	Empty states must never expose role information
•	Empty states must never show admin-only controls to non-admin roles
7. Loading State Components
Used when data is being fetched.
Loading Layout
•	Spinner: gray
•	Text: “Loading…”
•	Font size: 14px
•	Padding: 24px
Rules
•	Loading states must be identical across all dashboards
•	Loading states must not reveal role or data structure
