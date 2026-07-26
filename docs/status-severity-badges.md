status-severity-badges.md (v1.0)
Purpose
Defines all PM status badges and issue severity badges used across Driv en v1.0, including color rules, accessibility requirements, and placement guidelines. This file is authoritative. No other file may override these rules.
1. Badge Component Layout (Universal)
All badges follow the same base structure.
Base Layout
•	Font size: 12px
•	Font weight: 600
•	Padding: 4px 8px
•	Border-radius: 6px
•	Text color: white
•	Display: inline-block
•	Vertical alignment: middle
Rules
•	Badges must never expose role information
•	Badges must never include icons in v1.0
•	Badges must be readable on white backgrounds
•	Badges must be consistent across all dashboards
2. PM Status Badges
Used in Technician, Foreman, Manager dashboards.
Status Types & Colors
•	Due — Yellow #e6b800
•	Overdue — Red #cc0000
•	Completed — Green #009933
Placement Rules
•	In tables: right-aligned in the Status column
•	In cards: top-right corner
•	In PM detail views: directly under PM title
Behavior Rules
•	Status text must be uppercase
•	Status must reflect PM Schedule state
•	Status must update automatically after PM Completion
3. Damage Severity Badges
Used for Damage Reports.
Severity Types & Colors
•	None — Gray #666666
•	Minor — Orange #ff9900
•	Major — Red #cc0000
Placement Rules
•	In issue tables: left of issue title
•	In equipment detail: under “Damage Reports” section
•	In PM Completion history: next to completion timestamp
Behavior Rules
•	Severity must match Technician/Operator selection
•	Severity must not be editable by non-admin roles
•	Severity must not be auto-escalated in v1.0
4. Safety Severity Badges
Used for Safety Issues.
Severity Types & Colors
•	None — Gray #666666
•	Hazard — Orange #ff9900
•	Critical — Red #cc0000
Placement Rules
•	In issue tables: left of issue title
•	In equipment detail: under “Safety Issues” section
•	In PM Completion history: next to completion timestamp
Behavior Rules
•	Severity must match Technician/Operator selection
•	Severity must not be editable by non-admin roles
•	Severity must not be auto-escalated in v1.0
5. Accessibility Rules (v1.0)
Contrast Requirements
All badge colors must meet WCAG AA contrast standards against white backgrounds.
Text Requirements
•	Text must remain white
•	Text must be uppercase
•	Text must be bold enough to remain readable at 12px
Colorblind Accessibility
•	Red vs orange must remain visually distinct
•	Gray must remain neutral and non-alerting
•	No reliance on color alone — severity text must always be present
6. Badge Interaction Rules
Badges are non-interactive in v1.0
•	No hover effects
•	No click actions
•	No tooltips
•	No dropdowns
Admin Exception
Admins may edit severity values in the form, not by clicking the badge.
