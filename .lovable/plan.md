# Complete the WhatsApp Flow Studio

## Goal
Turn WhatsApp Forms into a general-purpose custom form studio, not a travel-only editor, while keeping the existing Meta sync, publish, test, automation, and submission handling intact.

## What will change

### 1. General-purpose form creation
- Replace the travel-only new-form experience with a starter picker: Blank, Lead/Enquiry, Appointment, Service Booking, Feedback, Event Registration, and the existing TN45 Travel Booking.
- Give every starter valid Meta Flow JSON with editable names, fields, choices, navigation, and completion actions.
- Keep raw JSON editing available so advanced users can create any Meta-supported form.
- Use neutral labels throughout: “form”, “screen”, and “submission” rather than booking-only wording.

### 2. Live Meta-style preview
- Add a phone preview beside the editor on desktop and below it on smaller screens.
- Show one screen at a time with screen tabs and previous/next controls.
- Render common Meta elements: headings, body/caption text, text inputs, text areas, dropdowns, radio buttons, checkboxes, date pickers, opt-ins, embedded links, and footer buttons.
- Update the preview immediately as JSON changes, with sample values and clear placeholders for unsupported or dynamic elements.

### 3. Safer editing and publishing
- Validate the JSON structure, unique screen IDs, layouts, supported components, opening screen, and broken screen links before saving or publishing.
- Let users format JSON and copy it without changing the saved form.
- Preserve Meta validation errors and identify the affected screen where possible.
- Keep draft upload, publish, sync, download-from-WhatsApp, and send-test actions unchanged.

### 4. Generic submission support
- Update Flow submission intake so every submitted field is preserved in Reachably, regardless of the starter used.
- Keep the TN45-specific booking/payment behavior only when the submitted form is a travel booking.
- Store other forms as general CRM records with their form name, submitted fields, contact, source, and timeline entry.

### 5. Verification
- Check the editor and preview at desktop and mobile widths.
- Verify starter selection, screen switching, live preview updates, JSON validation, save, and existing publish/test controls.
- Run focused checks for the Flow Studio and submission parser.

## Technical details
- Create reusable preset definitions and a standalone preview renderer instead of expanding the page into one large file.
- Keep existing workspace isolation and permissions.
- Use the existing design tokens and controls; no database schema change unless the current record storage cannot retain arbitrary submitted fields.
