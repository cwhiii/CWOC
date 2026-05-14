# Data Management

The [Settings](/frontend/html/settings.html) page includes a **📦 Data Management** box for exporting and importing your data as JSON files. There are two data categories, each with its own Export and Import buttons:

## Chit Data

Exports all chits (including deleted chits) as a JSON file. This captures every field on every chit — titles, notes, dates, tags, checklists, alerts, recurrence rules, and more.

## User Data

Exports your settings, tags, custom colors, saved locations, and contacts as a JSON file. Use this to back up your configuration or replicate it on another CWOC instance.

## Import Modes

When importing a file, you choose one of two modes:

- **➕ Add** — Merges the imported data with your existing data. Nothing is removed. For chits, each imported chit is added as a new record. For user data, array fields (tags, colors, locations) are merged and deduplicated, and contacts are added unless an exact name match already exists.
- **🔄 Replace** — Deletes all existing data of that type and replaces it with the imported data. A confirmation dialog appears before any data is removed.

## File Format

Exported files are self-contained JSON with metadata including the CWOC version, export timestamp, and instance ID. Files can be imported into any CWOC instance.

## 📅 Calendar Import (.ics)

Import events and tasks from **Google Calendar**, **Apple Calendar**, or **Outlook** using standard iCalendar (.ics) files. Click the **📅 Import Calendar (.ics)** button in the Data Management section to select a file.

### How to Export from Google Calendar

1. Go to [Google Calendar Settings → Export](https://calendar.google.com/calendar/r/settings/export)
2. Click **Export** — this downloads a .zip file containing one .ics file per calendar
3. Unzip the downloaded file
4. In CWOC, go to [Settings](/frontend/html/settings.html) → Data Management → **📅 Import Calendar (.ics)**
5. Select the .ics file(s) you want to import

**Tip:** To export a single Google calendar, open that calendar's settings (click the ⋮ menu next to the calendar name → Settings and sharing) and scroll down to "Export calendar."

### How to Export from Apple Calendar

1. Open the Calendar app on your Mac
2. Select the calendar you want to export in the sidebar
3. Go to File → Export → Export…
4. Save the .ics file, then import it in CWOC

### How to Export from Outlook

1. **Desktop:** File → Open & Export → Import/Export → Export to a file → iCalendar (.ics)
2. **Web:** Settings ⚙️ → Calendar → Shared calendars → Publish a calendar → Download the ICS

### What gets imported

- **Events (VEVENT)** — Title, description, start/end dates, location, categories (as tags), priority, and recurrence rules
- **Tasks (VTODO)** — Title, description, due date, status (ToDo/In Progress/Complete), priority, and categories
- **Recurrence** — Daily, weekly (with specific days), monthly, and yearly patterns are preserved. Unsupported frequencies (hourly, minutely) are dropped and the event imports as a single occurrence.

**How it works:**

- All imported chits are automatically tagged with `cwoc_system/imported` so you can easily find or filter them
- Each import batch is also tagged with `cwoc_system/imported/[calendar name]/[date]` for batch identification
- A user-facing tag `calendar/imported/[calendar name]` is added so you can filter by source calendar in the sidebar
- The calendar name is extracted from the `X-WR-CALNAME` property in the .ics file (Google Calendar always includes this). If not present, it defaults to "Unknown Calendar"
- **Duplicate detection** — If an event with the same title and start time already exists, it's skipped to prevent duplicates when re-importing
- Events without a title (SUMMARY) are skipped with an error noted in the results
- Other calendar components (VTIMEZONE, VJOURNAL, VALARM) are silently ignored

After import, you'll see a summary showing how many events were imported, how many duplicates were skipped, and any errors.

### Import Batches

After importing, a **📦 Import Batches** section appears below the import button showing all your previous imports grouped by calendar name and date. Each batch shows the number of chits and has a **🗑️ Delete** button that sends all chits from that batch to the trash in one click.

This makes it easy to undo an import or clean up a calendar you no longer need — just delete the batch and all its chits go to trash (where they can still be restored if needed).

---

**See also:** [Settings](/frontend/html/settings.html) · [Audit Log](/frontend/html/audit-log.html) · [Trash](/frontend/html/trash.html)
