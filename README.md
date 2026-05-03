# C.W.'s Omni Chits (CWOC)

<p align="center">
  <img src="src/static/cwod_logo-large.png" alt="CWOC Logo" width="200">
</p>

A self-hosted multi-user task, note, and calendar management web app. One flexible record — the **chit** — serves as a task, note, calendar event, alarm, checklist, or project, all in one unified data model.

Unlike most productivity tools, CWOC doesn't force you to pick a category up front. Fill in the fields that matter and the system figures out where it belongs — a chit with a date shows up on the calendar, add a checklist and it appears in checklists too. Multiple users get their own accounts with granular sharing — chit-level and tag-level sharing with viewer/manager roles, RSVP, assignment, and stealth mode. No subscriptions, no cloud dependency. Your data lives on your hardware in a single SQLite file, accessible from any device on your network. The entire stack is vanilla Python and vanilla JS with zero build steps — lightweight enough to run on a Raspberry Pi Zero 2, easy to deploy, easy to hack on, and easy to understand.

## C CAPTN Views

| View | What it shows |
|---|---|
| **C**alendar | Chits with dates and times |
| **C**hecklists | Nested checklist items with drag-drop |
| **A**lerts | Alarms, notifications, timers, stopwatches |
| **P**rojects | Kanban-style boards with child chits |
| **T**asks | Status tracking — ToDo, In Progress, Blocked, Complete |
| **N**otes | Markdown content |
| **I**ndicators | Health trend charts — heart rate, blood pressure, SpO2, temperature, weight, glucose, and more |

## Tech Stack

- **Backend:** FastAPI + SQLite (Python 3, no ORM)
- **Frontend:** Vanilla JS, HTML5, CSS3 — no frameworks, no build step
- **Theme:** 1940s parchment/magic aesthetic

## Optional Dependencies

| Service | Purpose |
|---|---|
| **[Tailscale](https://tailscale.com/)** | Mesh VPN for secure remote access. Lets you reach your CWOC instance from anywhere without port forwarding or exposing your server to the internet. Configured and managed from Settings → Dependent Apps. |
| **[Ntfy](https://ntfy.sh/)** | Self-hosted push notification server. Sends alarm, timer, and reminder notifications directly to your phone — even when the browser is closed. Notifications include action buttons (Open, Snooze, Dismiss) with snooze duration pulled from your settings. Requires Tailscale or your own VPN/tunnel back to the server for remote delivery. |

Both are optional. CWOC works fully without them — Tailscale adds remote access, Ntfy adds phone push notifications. The `install/configurinator.sh` script handles installing and configuring both automatically.

## Hardware

Lightweight enough to run on minimal hardware like a Raspberry Pi Zero 2 W, though the original Pi Zero would likely be sluggish due to its single-core CPU and Python overhead. Any modern SBC, small VM, or LXC container with 1+ CPU cores and 512MB RAM will run it comfortably.

**LXC / VM Recommended Specs:**
- 2 vCPUs, 1GB RAM, 4GB disk

**Minimum Functional Specs:**
- 1 vCPU, 256MB RAM, 2GB disk — will run, but expect slower response times under concurrent use

## Documentation

- [Full README & Feature List](./documents/README.md)
- [Technical Details](./documents/technical_details.md)
- [License](./documents/LICENSE.md)
