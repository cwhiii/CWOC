# Data Management

- [Chit Data](#chit-data)
- [User Data](#user-data)
- [Import Modes](#import-modes)
- [File Format](#file-format)
- [📅 Calendar Import (.ics)](#calendar-import-ics)
  - [How to Export from Google Calendar](#how-to-export-from-google-calendar)
  - [How to Export from Apple Calendar](#how-to-export-from-apple-calendar)
  - [How to Export from Outlook](#how-to-export-from-outlook)
  - [What gets imported](#what-gets-imported)
  - [Import Batches](#import-batches)
- [✅ Google Tasks Import (.json)](#google-tasks-import-json)
  - [How to Export from Google Tasks](#how-to-export-from-google-tasks)
  - [What gets imported](#what-gets-imported)
  - [How it works](#how-it-works)
- [📝 Google Keep Import (.json)](#google-keep-import-json)
  - [How to Export from Google Keep](#how-to-export-from-google-keep)
  - [What gets imported](#what-gets-imported)
  - [How it works](#how-it-works)


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
4. In CWOC, go to [Settings → Data Management](/frontend/html/settings.html#data-management) → **📅 Import Calendar (.ics)**
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

## ✅ Google Tasks Import (.json)

Import tasks from **Google Tasks** using the JSON file from Google Takeout. Click the **✅ Import Google Tasks (.json)** button in the Data Management section to select a file.

### How to Export from Google Tasks

1. Go to [Google Takeout](https://takeout.google.com/)
2. Click **Deselect all**, then scroll down and check only **Tasks**
3. Click **Next step** → **Create export**
4. Download the archive when ready and unzip it
5. Inside the `Tasks/` folder you'll find one JSON file per task list
6. In CWOC, go to Settings → Administration → Data Management → **✅ Import Google Tasks (.json)**
7. Select the JSON file for the task list you want to import

### What gets imported

- **Title** → chit title
- **Notes** → chit note (markdown)
- **Due date** → chit due_datetime
- **Status** → "needsAction" becomes ToDo, "completed" becomes Complete
- **Completed date** → chit completed_datetime
- **Created/Updated timestamps** → preserved as created_datetime/modified_datetime

### How it works

- All imported tasks are tagged with `cwoc_system/imported` and a batch tag `cwoc_system/imported/[list name]/[date]`
- A user-facing tag `calendar/imported/[list name]` is added for filtering
- **Duplicate detection** — If a task with the same title and due date already exists, it's skipped
- Tasks without a title are skipped with an error noted in the results
- Subtask parent/child relationships from Google Tasks are not preserved (each task imports as an independent chit)

## 📝 Google Keep Import (.json)

Import notes and lists from **Google Keep** using the JSON files from Google Takeout. Click the **📝 Import Google Keep (.json)** button in the Data Management section and select one or more JSON files.

### How to Export from Google Keep

1. Go to [Google Takeout](https://takeout.google.com/)
2. Click **Deselect all**, then scroll down and check only **Keep**
3. Click **Next step** → **Create export**
4. Download the archive when ready and unzip it
5. Inside the `Keep/` folder you'll find one JSON file per note
6. In CWOC, go to Settings → Administration → Data Management → **📝 Import Google Keep (.json)**
7. Select all the JSON files you want to import (multi-select supported)

### What gets imported

- **Title** → chit title
- **Text content** → chit note (for text notes)
- **List content** → chit checklist (for list/checklist notes, with checked state preserved)
- **Labels** → chit tags (each Keep label becomes a tag)
- **Color** → chit color (mapped from Keep color names to hex values)
- **Pinned** → chit pinned state
- **Archived** → chit archived state
- **Created/Edited timestamps** → preserved as created_datetime/modified_datetime

### How it works

- All imported notes are tagged with `cwoc_system/imported` and a batch tag `cwoc_system/imported/Google Keep/[date]`
- A user-facing tag `calendar/imported/Google Keep` is added for filtering
- Keep labels are preserved as regular tags for filtering
- **Duplicate detection** — If a note with the same title and creation time already exists, it's skipped
- Trashed notes are automatically skipped
- Notes with no title and no content are skipped
- Attachments and images from Keep are not imported (only text/list content)

---

**See also:** [Settings](/frontend/html/settings.html) · [Audit Log](/frontend/html/audit-log.html) · [Trash](/frontend/html/trash.html)
