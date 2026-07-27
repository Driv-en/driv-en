Role: Run all automations and backend logic via Cloudflare (Workers, triggers, routing). Goal: Make sure Lee knows exactly which automations to implement and how they interact with Airtable + Driv-en.com.
1. What Lee Is Responsible For
•	Automations only:
o	Cloudflare Workers
o	Scheduled jobs
o	Webhooks
o	Validation logic
o	Status transitions
o	PM/Inspection/Work Order triggers
•	Integration:
o	Talk to Airtable (OMNI’s data)
o	Talk to Driv-en.com (UI) via APIs/webhooks
Lee does not own UI—UI lives entirely on Driv-en.com.
2. What Lee Builds First
1.	Core Worker Layer
o	Equipment automation:
	Status changes (In Service, Out of Service, Down, etc.)
	Meter updates → PM schedule checks
	Fuel usage logging
o	PM automation:
	Generate PM schedules from PM Templates
	Auto create PM assignments
	Auto update PM completion status
	Auto create Work Orders when PM fails
o	Inspection automation:
	Create inspection records from Driv-en.com submissions
	Apply Pass/Fail/Safety Flag logic
	Auto create Work Orders on Fail or Safety Flag
2.	Work Order Automation
o	Create Work Orders from:
	Failed inspections
	PM review failures
	Equipment status changes
o	Update Work Orders:
	Technician completion
	Foreman review
o	Sync back to:
	Equipment status
	Equipment downtime history
3.	Compliance & Rollups
o	PM compliance rollups
o	Inspection compliance rollups
o	Equipment health summaries
o	Work order backlog summaries
o	Equipment status summaries
3. How Lee Integrates With Driv-en.com
•	Driv-en.com responsibilities:
o	All UI
o	All forms
o	All dashboards
o	All page layouts
•	Lee’s responsibilities:
o	Receive form submissions (PM, inspections, work orders)
o	Validate payloads
o	Write to Airtable
o	Trigger downstream automations
o	Return success/error responses to Driv-en.com
Lee must not change UI behavior—only respond to it.
4. Rules Lee Must Follow
•	Must:
o	Use existing Airtable schema
o	Respect v1.0 scope (two modules + supporting data)
o	Enforce status and workflow rules defined in docs
o	Log all automation actions
•	Must NOT:
o	Add new modules
o	Add new data structures
o	Change Airtable schema
o	Change Driv-en.com routes or UI
o	Bypass validation
Any change to scope or schema requires Jackie’s explicit approval.
5. Docs Lee Must Read
•	automation-validation.md
•	data-model-validation.md
•	dashboard-definitions.md
•	global-ui-behavior.md (to understand how UI expects backend responses)
•	system-navigation.md
•	url-routing-map.md
