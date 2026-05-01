# C.W.'s Omni Chits (CWOC)

<p align="center">
  <img src="src/static/cwod_logo-large.png" alt="CWOC Logo" width="200">
</p>

A self-hosted personal task, note, and calendar management web app with built-in Tailscale support. One flexible record — the **chit** — serves as a task, note, calendar event, alarm, checklist, or project, all in one unified data model.

Unlike most productivity tools, CWOC doesn't force you to pick a category up front. Fill in the fields that matter and the system figures out where it belongs — a chit with a date shows up on the calendar, add a checklist and it appears in checklists too. No accounts, no subscriptions, no cloud dependency. Your data lives on your hardware in a single SQLite file, accessible from any device on your network. The entire stack is vanilla Python and vanilla JS with zero build steps, so it's easy to deploy, easy to hack on, and easy to understand.

## C CAPTN Views

| View | What it shows |
|---|---|
| **C**alendar | Chits with dates and times |
| **C**hecklists | Nested checklist items with drag-drop |
| **A**lerts | Alarms, notifications, timers, stopwatches |
| **P**rojects | Kanban-style boards with child chits |
| **T**asks | Status tracking — ToDo, In Progress, Blocked, Complete |
| **N**otes | Markdown content |

## Tech Stack

- **Backend:** FastAPI + SQLite (Python 3, no ORM)
- **Frontend:** Vanilla JS, HTML5, CSS3 — no frameworks, no build step
- **Theme:** 1940s parchment/magic aesthetic

## Documentation

- [Full README & Feature List](./documents/README.md)
- [Technical Details](./documents/technical_details.md)
- [License](./documents/LICENSE.md)
