form-components.md (v1.0)
Purpose
Defines all reusable form components used across Driv en v1.0, including field types, validation rules, layout rules, and role-based behavior. This file is authoritative. No other file may override these rules.
1. Global Form Layout Rules
Form Container
•	Width: 100% (mobile), 640px (desktop)
•	Background: white
•	Border: 1px solid #e5e5e5
•	Border-radius: 8px
•	Padding: 24px
•	Margin-top: 24px
Form Sections
•	Section header (20px, bold)
•	16px spacing between fields
•	24px spacing between sections
Submit Area
•	Buttons right-aligned
•	Primary button: green (#009933)
•	Secondary button: gray (#666)
2. Field Components (v1.0)
These are the universal field types used across all forms.
Text Input (Short)
Used for: names, titles, short labels.
•	Height: 40px
•	Border: 1px solid #ccc
•	Border-radius: 6px
•	Padding: 8px
•	Font size: 14px
Validation
•	Required fields show red border on error
•	Optional fields show normal border
Text Input (Long)
Used for: notes, descriptions, admin comments.
•	Height: 120px
•	Border: 1px solid #ccc
•	Border-radius: 6px
•	Padding: 8px
•	Font size: 14px
•	Resize: vertical only
Numeric Input
Used for: meter readings, quantities, thresholds.
•	Height: 40px
•	Border: 1px solid #ccc
•	Border-radius: 6px
•	Padding: 8px
•	Font size: 14px
•	Input type: number
Validation
•	Must be numeric
•	Must be ≥ previous value (meter logic)
•	Must not allow negative values
Single Select
Used for: damage severity, safety severity, status fields.
•	Height: 40px
•	Border: 1px solid #ccc
•	Border-radius: 6px
•	Padding: 8px
•	Font size: 14px
Options
•	Provided by table schema
•	Must not allow custom values
Multi-Select
Used for: admin-only tag fields.
•	Height: auto
•	Pills with border-radius: 6px
•	Background: #f2f2f2
Attachment Upload
Used for: PM photos.
Rules
•	Minimum: 1 photo
•	Maximum: unlimited
•	Accepted formats: JPG, PNG
•	Preview thumbnails: 64×64px
•	Delete icon: small “x” in top-right corner
Lookup Fields
Used for: Equipment → Division, PM Template → PM Family, etc.
Rules
•	Always read-only
•	Must not allow editing
•	Must show linked record name only
•	Must not expose internal IDs
Linked Record Selector (Admin Only)
Used for: assigning divisions, technicians, operators.
Rules
•	Admin only
•	Searchable dropdown
•	Must show record name + type
•	Must not expose internal IDs
3. Validation Rules (v1.0)
Required Fields
•	Must show red border on error
•	Must show error text below field
•	Must prevent submission until resolved
Optional Fields
•	No error state
•	No required indicator
Meter Reading Validation
•	Must be ≥ previous reading
•	If lower → error
•	If unusually high → warning
Photo Validation
•	Minimum 1 photo for PM Completion
•	No minimum for issues
Severity Validation
•	Must select one option
•	Cannot submit “None” if photos show damage (admin override only)
4. Role-Based Form Behavior
Technician
•	Can submit PM Completion
•	Can upload photos
•	Can report damage/safety
•	Cannot edit equipment
•	Cannot edit PM templates
•	Cannot edit PM schedules
Operator
•	Can report damage/safety
•	Cannot upload photos
•	Cannot complete PMs
•	Cannot edit equipment
Foreman
•	Read-only forms only
•	Cannot submit any forms
Manager
•	Read-only forms only
•	Cannot submit any forms
Admin
•	Full CRUD
•	Can edit any form
•	Can override validation
•	Can modify linked records
5. Button Components
Primary Button
•	Background: #009933
•	Text: white
•	Border-radius: 6px
•	Height: 40px
•	Padding: 0 16px
•	Font size: 14px
•	Hover: darken to #007a29
Secondary Button
•	Background: #666
•	Text: white
•	Border-radius: 6px
•	Height: 40px
•	Padding: 0 16px
•	Font size: 14px
•	Hover: darken to #4d4d4d
