# Custom Objects

The Custom Objects registry is a generic system for defining trackable data entities. Objects have a type, category, name, value type (integer, decimal, boolean, or string), optional units, and optional acceptable ranges. They can be assigned to one or more zones (like the Health Indicators zone or the Graphs zone) to control where they appear.

## Custom Objects Editor

Access via the navigation menu (🧊 Objects). The editor page lets you browse, create, edit, and manage all custom objects.

- **Filter bar** — Filter by type (dropdown) or search by name
- **Object list** — Grouped by type, each row shows the object name, zone assignment badges, and action buttons
- **Create** — Click "+ Create Custom Object" to open the create modal. Fill in name, type, category, value type, units, metric units, range min/max, and optional conditional display rule
- **Edit** — Click the edit button on any row to modify its properties
- **Active toggle** — Toggle an object active/inactive. Inactive objects are hidden from zone queries
- **Delete / Restore** — Soft-delete objects (they can be restored if they are standard/seeded objects)
- **Zone management** — Click the zone button to assign or unassign the object to zones, set per-zone config (like `is_default`), and adjust sort order
- **⚡ Quick Log** — Creates a new chit with Point in Time = now and status = Complete, then opens it in the editor for quick health data entry

## Standard Objects

CWOC seeds a standard library of objects for each user:

- **Vitals** — Heart Rate, Blood Pressure (Systolic/Diastolic), Oxygen Saturation, Temperature, Period Active
- **Body** — Weight, Height, Glucose
- **Activity** — Distance, Calories
- **Symptoms** — 10 Illness symptoms, 10 Injury symptoms, 10 Allergy symptoms (all boolean)

Standard objects can be soft-deleted and restored. User-created objects use the same system but cannot be restored after deletion.

## Zone Assignments

Each object can be assigned to multiple zones. Zones are free-text identifiers — any string works. Built-in zones include `indicators_zone` (Health Indicators in the editor) and `graphs` (Charts mode on the dashboard). Each assignment can carry zone-specific config (e.g., `{"is_default": true}` for the indicators zone) and a sort order.

---

**See also:** [Indicators](/frontend/html/help.html#indicators) · [Chit Editor](/editor) · [Settings](/frontend/html/settings.html)
