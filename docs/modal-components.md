modal-components.md (v1.0)
Purpose
Defines the layout, spacing, animation, accessibility, and interaction rules for all modal components used across Driv en v1.0. This file is authoritative. No other file may override these rules.
1. Modal Types Covered
All modals in v1.0 must follow this specification:
•	Create Modal
•	Edit Modal
•	Delete Modal
•	View Modal (admin only)
•	Confirmation Modal
2. Modal Container Layout
Dimensions
•	Width: 640px
•	Max width: 90% (mobile)
•	Background: white
•	Border-radius: 8px
•	Padding: 24px
•	Shadow: 0px 4px 12px rgba(0,0,0,0.12)
Positioning
•	Centered vertically and horizontally
•	Backdrop: rgba(0,0,0,0.4)
•	Backdrop click: closes modal only for non-destructive modals
Spacing
•	Section headers: 20px bold
•	Field spacing: 16px
•	Section spacing: 24px
3. Modal Header
Layout
•	Title: 24px bold
•	Subtitle: 16px gray
•	Close icon: top-right, 20×20px, gray
Rules
•	Title must be descriptive (“Edit Equipment”, “Create PM Template”)
•	Must not expose internal IDs
•	Must not include role names
4. Modal Body
Field Types Allowed
•	Text input
•	Numeric input
•	Single select
•	Multi-select
•	Linked record selector
•	Status selector
•	Long text input
Rules
•	Required fields must show red border on error
•	Optional fields must not show error state
•	Linked record selectors must not expose internal IDs
•	Sync metadata fields must never appear
5. Modal Footer
Buttons
•	Primary button (green): Save / Create / Confirm
•	Secondary button (gray): Cancel
•	Delete button (red): Delete (delete modal only)
Button Layout
•	Right-aligned
•	12px spacing between buttons
Button Behavior
•	Primary button validates fields
•	Secondary button closes modal
•	Delete button requires explicit confirmation
6. Modal Animations (v1.0)
Open Animation
•	Fade-in: 150ms
•	Scale-in: 1.00 → 1.02 → 1.00
Close Animation
•	Fade-out: 150ms
•	Scale-out: 1.00 → 0.98
Rules
•	Animations must be subtle
•	No sliding animations in v1.0
•	No sound effects
7. Accessibility Rules
Keyboard Navigation
•	Tab cycles through fields
•	Enter triggers primary button
•	Escape closes modal (except delete modal)
Screen Reader Requirements
•	Modal must trap focus
•	Modal must announce title
•	Modal must announce required fields
Contrast Requirements
•	Text must meet WCAG AA
•	Buttons must meet WCAG AA
8. Delete Modal Specification
Layout
•	Title: “Delete Record”
•	Warning text: red
•	Description: “This action cannot be undone.”
•	Buttons:
o	Delete (red)
o	Cancel (gray)
Rules
•	Backdrop click must NOT close delete modal
•	Escape key must NOT close delete modal
•	Must require explicit confirmation
•	Must not delete linked records
9. View Modal (Admin Only)
Purpose
Allows Admin to view full record details without editing.
Rules
•	All fields read-only
•	No edit controls
•	No delete controls
•	No internal IDs
•	No sync metadata
10. Modal Error Handling
Error Types
•	Required field missing
•	Invalid numeric input
•	Invalid linked record
•	Server-side validation error
Error Display
•	Red border around field
•	Error text below field
•	Modal must not close on error
