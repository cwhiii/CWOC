# Release 20260503.1238 — People Dates Field, Sidebar Rename

**Sidebar rename**: "Contacts" button renamed to "People" in the shared sidebar. Changes on all pages (dashboard, maps, weather) automatically since it's in shared-sidebar.js.

**Multi-value dates field for contacts/people**:
- New `dates` column on contacts table (JSON array, same pattern as phones/emails/addresses)
- Each entry has a label (e.g., "Birthday", "Anniversary", "Hire Date") and a date value
- New contacts default to one entry with label "Birthday" and empty date
- Uses HTML5 `type="date"` input for proper date picker
- vCard import/export supports BDAY field (maps to/from "Birthday" label)
- Searchable across dashboard people filter, maps contact search, and people page
- Contact editor has a "📅 Dates" section with "Add Date" button
