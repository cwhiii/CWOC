# Global Search

Press `G` or click the magnifying glass icon (last in the C CAPTN view bar) to open the Global Search view. Unlike the sidebar filter, Global Search queries ALL fields across ALL chits regardless of which view they belong to.

- **Search Input + Go** — Type a query in the search input and press Enter or click Go. The search performs case-insensitive substring matching across every chit field (title, note, tags, status, priority, location, people, checklist items, dates, color, alerts, and more).
- **Result Cards** — Each matching chit is displayed as a card showing the chit title and every matched field with the matching text highlighted. Click a result card to open that chit in the editor.
- **Sidebar Filters** — Sidebar filters (Status, Priority, Tags, etc.) remain active during Global Search, narrowing results further.
- **Boolean Operators** — `&&` (AND, default), `||` (OR), `!` (NOT), `()` (grouping). Multiple terms without operators default to AND. Example: `(meeting || lunch) && #work && !cancelled`
- **Tag Search** — Prefix with `#` to match tags: `#work`, `#personal/health`. Parent tags match sub-tags.
- **Field-Scoped Search** — Use `field::value` to search only within a specific field. For multi-word values, use parentheses: `field::(multi word value)`. This restricts matching to only the named field instead of searching all fields.

## Available Field Prefixes

- `title::` — Chit title
- `note::` / `notes::` — Note/body content
- `location::` / `loc::` — Location field
- `status::` — Status (ToDo, In Progress, Blocked, Complete, Rejected)
- `priority::` — Priority level
- `severity::` — Severity level
- `people::` / `person::` — People field
- `assigned::` / `assigned_to::` — Assigned user
- `checklist::` — Checklist item text
- `child::` — Child chit titles (for projects)
- `subject::` — Email subject / title
- `sender::` / `from::` — Email sender
- `to::` — Email recipients
- `cc::` — Email CC
- `bcc::` — Email BCC
- `body::` — Email body / note content
- `due::` / `start::` / `end::` — Date fields
- `color::` — Chit color

## Field Search Examples

- `title::email` — Chits with "email" in the title only
- `title::(email stuff)` — Chits with "email stuff" in the title
- `location::park && people::john` — Location contains "park" AND people contains "john"
- `child::deploy && !#done` — Projects with a child chit titled "deploy", excluding #done tag
- `sender::boss || from::ceo` — Emails from "boss" or "ceo"
- `status::blocked && priority::high` — Blocked high-priority tasks

---

**See also:** [Views](views.md) · [Filtering & Sorting](filters.md) · [Tags](tags.md)
