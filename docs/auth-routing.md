auth-routing.md (v1.0)
Purpose
Defines all login, logout, session, and role based routing behavior for Driv en v1.0. This file is authoritative. No other file may override these rules.
Login Entry Point
Route: /login Behavior:
•	If user has no active session → show login form
•	If user has active session → redirect to their dashboard (see Role Routing below)
Login Form Requirements
•	Username (email)
•	Password
•	“Forgot Password” link (non-functional in v1.0)
•	Submit button
•	No branding beyond DRIV EN logo
•	No role selection
•	No multi tenant selector (v1.0 is single tenant)
Successful Login Behavior
After authentication:
1.	Create session token
2.	Store role in session
3.	Redirect immediately based on Role Routing table
Failed Login Behavior
•	Show generic error: “Invalid username or password.”
•	Do not reveal which field was incorrect
•	Do not reveal whether the account exists
•	Do not reveal role
•	Do not lock out users in v1.0
Session Enforcement
Every page except /login must enforce:
•	If no session → redirect to /login
•	If session exists → allow access
•	If session exists but role does not match page → redirect to correct dashboard
Logout Behavior
Triggered by clicking the login/account icon in the top right header.
•	Clear session
•	Redirect to /login
Role Routing Table (v1.0)
Role	Dashboard Route	Notes
Technician	/dashboard/tech	PM completion, equipment lookup
Operator	/dashboard/operator	Equipment assignment, basic PM visibility
Foreman	/dashboard/foreman	Crew equipment, PM oversight
Manager	/dashboard/manager	Division-level equipment + PM status
Admin	/dashboard/admin	Full system access
Unauthorized Access Rules
If a user attempts to access a dashboard not assigned to their role:
•	Redirect to their correct dashboard
•	Do not show an error
•	Do not reveal role mismatch
Header Login Icon Behavior
•	If no session → clicking icon goes to /login
•	If session exists → clicking icon shows dropdown with “Logout”
•	Logout immediately clears session and returns to /login
