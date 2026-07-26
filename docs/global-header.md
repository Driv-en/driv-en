global-header.md (v1.0)
Purpose
Defines the global header layout, behavior, and role-based visibility rules for Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Header Visibility Rules
Header is visible on:
•	All dashboards
•	All equipment pages
•	All PM workflow pages
•	All issue pages
•	All admin pages
Header is NOT visible on:
•	/login
This ensures clean separation between authentication and application UI.
2. Header Layout (v1.0)
Left Side:
•	DRIV EN logo (locked design)
•	Clicking the logo always redirects to the user’s dashboard based on role
Right Side:
•	Login/Account Icon
o	22×22 px
o	Dark gray (#333)
o	Transparent background
•	Dropdown (when logged in):
o	“Logout”
Spacing & Alignment:
•	Header height: 64px
•	Logo left padding: 24px
•	Icon right padding: 24px
•	Vertical alignment: centered
•	Background: white
•	Border-bottom: 1px solid #e5e5e5
3. Logo Behavior
Clicking the logo redirects to:
•	Technician → /dashboard/tech
•	Operator → /dashboard/operator
•	Foreman → /dashboard/foreman
•	Manager → /dashboard/manager
•	Admin → /dashboard/admin
Rules:
•	Logo must never redirect to /login
•	Logo must never redirect to another role’s dashboard
•	Logo must never expose role information in the URL
4. Login/Account Icon Behavior
If no session:
•	Clicking icon → /login
If session exists:
•	Clicking icon → dropdown
o	Option: “Logout”
Logout behavior:
•	Clears session
•	Redirects to /login
5. Role-Based Header Behavior
Technician
•	Logo → /dashboard/tech
•	Icon → Logout dropdown
•	No admin links
•	No manager links
•	No foreman links
•	No operator links
Operator
•	Logo → /dashboard/operator
•	Icon → Logout dropdown
•	No technician links
•	No foreman links
•	No manager links
•	No admin links
Foreman
•	Logo → /dashboard/foreman
•	Icon → Logout dropdown
•	No technician links
•	No operator links
•	No manager links
•	No admin links
Manager
•	Logo → /dashboard/manager
•	Icon → Logout dropdown
•	No technician links
•	No operator links
•	No foreman links
•	No admin links
Admin
•	Logo → /dashboard/admin
•	Icon → Logout dropdown
•	No restrictions
6. Header Component CSS (v1.0)
Code
.header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e5e5e5;
}

.header-logo {
  padding-left: 24px;
  cursor: pointer;
}

.header-icon {
  width: 22px;
  height: 22px;
  padding-right: 24px;
  cursor: pointer;
}
