automation-validation.md (v1.0)
Purpose
Defines and validates all automations required for Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Generate PM Template Automation
Trigger:
•	When Equipment → Ready? = checked
Logic:
1.	Read Equipment Type
2.	Find matching PM Family Type Map
3.	Apply override-first logic:
o	If override interval exists → use it
o	Else → use default interval
4.	Create PM Template (auto-generated) record
5.	Populate all fields exactly as defined in PM Templates schema
6.	Link to Equipment
7.	Link to PM Family
8.	Link to PM Family Type Map
Validation:
•	Must generate exactly one PM Template per Equipment Type
•	Must not generate duplicates
•	Must not generate templates for Equipment without Equipment Type
•	Must follow override-first logic exactly
2. PM Schedule Generation Automation
Trigger:
•	When PM Template is created
Logic:
1.	Read interval and meter threshold
2.	Create PM Schedule (auto-generated) record
3.	Set Next Due Date
4.	Set Next Meter Threshold
5.	Link to Equipment
6.	Link to PM Template
Validation:
•	Must generate exactly one PM Schedule per PM Template
•	Must not generate duplicates
•	Must not generate schedules for templates missing interval or meter threshold
3. PM Completion Update Automation
Trigger:
•	When PM Completion record is submitted by Technician
Logic:
1.	Read meter reading
2.	Update Equipment meter reading
3.	Update PM Schedule next due date
4.	Update PM Schedule next meter threshold
5.	Mark PM Completion as “Completed”
6.	Sync metadata
Validation:
•	Only Technicians may trigger this automation
•	Must update Equipment meter reading
•	Must update PM Schedule correctly
•	Must not allow non-Technician roles to trigger completion
4. Record Index Automation
Trigger:
•	When Equipment record is created
Logic:
1.	Create Record Index record
2.	Set:
o	Module = Equipment
o	Table Name = Equipment
o	Status = Active
o	Record ID (Raw) = Equipment Record ID
o	Record Reference = Equipment Name
3.	Link Equipment → Record Index
Validation:
•	Must create exactly one Record Index record per Equipment
•	Must not create duplicates
•	Must not create index records for deleted Equipment
5. Compliance Automation (Training Records)
Trigger:
•	When Training Record → Status changes
Logic:
•	If Status = Completed → set % Compliance Numeric = 100
•	Else → set % Compliance Numeric = 0
Validation:
•	Must follow Jackie’s v1.0 specification exactly
•	Must not allow partial compliance values
•	Must not allow non-admin roles to modify compliance logic
6. Override-First Logic Enforcement
Purpose:
Ensures PM Family Type Map override values always take precedence.
Rules:
•	Override Interval > Default Interval
•	Override Meter Threshold > Default Meter Threshold
•	If override exists → use it
•	If override does not exist → use default
•	No exceptions
Validation:
•	Must be applied in PM Template generation
•	Must be applied in PM Schedule generation
•	Must be applied in PM Completion updates
