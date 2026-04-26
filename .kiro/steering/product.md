---
inclusion: always
---

# Product: C.W.'s Omni Chits (CWOC)

A personal task, note, and calendar management web app. The core concept is a "chit" — a single flexible record that can serve as a task, note, calendar event, alarm, checklist, or project, all using one unified data model.

Chits are organized into six views called **C CAPTN**:
- **C**alendar — chits with dates/times (week, day, month, year, itinerary, X-day views)
- **C**hecklists — chits with checklist items (nested, drag-drop, undo)
- **A**larms — chits with alarm/notification flags
- **P**rojects — project master chits with child chits in Kanban-style boards
- **T**asks — chits with a status (ToDo / In Progress / Blocked / Complete)
- **N**otes — chits with markdown content and no dates

The backend auto-assigns system tags (Calendar, Checklists, Alarms, Projects, Tasks, Notes) based on chit properties. Soft delete is used throughout — chits are never hard-deleted.

Deployed on a Proxmox LXC container at `http://192.168.1.111:3333`.
