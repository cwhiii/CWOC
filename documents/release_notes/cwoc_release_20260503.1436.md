# CWOC Release 20260503.1436

Added iCalendar (.ics) file import. Users can now import events and tasks from Google Calendar, Apple Calendar, or Outlook via a new "Import Calendar (.ics)" button in the Settings page Data Management section. The import handles VEVENT and VTODO components with field mapping, recurrence rule translation (DAILY/WEEKLY/MONTHLY/YEARLY), and duplicate detection. All imported chits are tagged with `cwoc_system/imported`. Includes 54 unit tests and help page documentation.
