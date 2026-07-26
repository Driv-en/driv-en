global-ui-behavior.md (v1.0)
Purpose
Defines universal UI behavior rules across Driv en v1.0, including navigation, loading, error handling, success states, role enforcement, and component interaction. This file is authoritative. No other file may override these rules.
1. Navigation Behavior (Universal)
Logo Click
•	Always redirects to the user’s dashboard
•	Never exposes role in URL
•	Never redirects to /login
Back Navigation
•	Browser back button allowed
•	Must not expose restricted pages
•	Must redirect to dashboard if user attempts to back into a forbidden page
Forbidden Page Access
If user attempts to access a page outside their role:
•	Redirect to their dashboard
•	No error message
•	No role disclosure
2. Loading Behavior
Global Loading State
•	Gray spinner
•	Text: “Loading…”
•	Centered
•	No animation beyond spinner rotation
Component Loading
•	Tables: show loading component
•	Cards: show skeleton state
•	Forms: show disabled fields until ready
Rules
•	Loading must never reveal restricted data
•	Loading must never show admin-only controls
3. Error Handling Behavior
Field-Level Errors
•	Red border
•	Red text below field
•	Must block submission
Page-Level Errors
•	Banner at top
•	Background: light red
•	Text: dark red
•	Must not expose internal IDs
•	Must not expose server details
Navigation Errors
•	Redirect to dashboard
•	No visible error
4. Success State Behavior
Form Submission Success
•	Green banner
•	Text: “Saved successfully.”
•	Auto-dismiss after 3 seconds
PM Completion Success
•	Redirect to /dashboard/tech
•	Banner: “PM Completed.”
Issue Submission Success
•	Redirect to user’s dashboard
•	Banner: “Issue Reported.”
Admin CRUD Success
•	Modal closes
•	Table refreshes
•	Banner: “Record updated.”
5. Role Enforcement Behavior
Technician
•	Can complete PMs
•	Can report issues
•	Cannot edit equipment
•	Cannot access admin pages
Operator
•	Can report issues
•	Cannot upload photos
•	Cannot complete PMs
•	Cannot access admin pages
Foreman
•	Read-only
•	Cannot submit forms
•	Cannot access admin pages
Manager
•	Read-only
•	Cannot submit forms
•	Cannot access admin pages
Admin
•	Full CRUD
•	Full visibility
•	Can override validation
6. Component Interaction Rules
Cards
•	Entire card is clickable
•	Hover: border darkens
•	Must not show admin-only content to non-admin roles
Tables
•	Admin: clickable rows
•	All other roles: read-only
•	No inline editing
Modals
•	Escape closes modal (except delete modal)
•	Backdrop click closes modal (except delete modal)
•	Must trap focus
Forms
•	Required fields must block submission
•	Optional fields never block submission
•	Linked record selectors must not expose internal IDs
7. Page Transition Rules
Allowed Transitions
•	Dashboard → Detail
•	Dashboard → Form
•	Detail → Form
•	Form → Dashboard
Forbidden Transitions
•	Non-admin → Admin pages
•	Non-technician → PM Completion
•	Non-operator → Operator-only pages
Forbidden transitions always redirect to dashboard.
8. Mobile Behavior
Tables
•	Horizontal scroll allowed
•	Header fixed
•	Status badges remain visible
Cards
•	Full width
•	Stack vertically
Forms
•	Full width
•	Buttons stack if screen < 360px
