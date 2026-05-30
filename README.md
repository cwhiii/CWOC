# C.W.'s Omni Chits (CWOC)

<p align="center">
  <img src="src/static/images/cwod_logo-large.png" alt="CWOC Logo" width="200">
</p>

A self-hosted, multi-user task, note, calendar, and email management system. One flexible record — the **chit** — serves as a task, note, calendar event, alarm, checklist, project, email, or habit, all in one unified data model.

Unlike most productivity tools, CWOC doesn't force you to pick a category up front. Fill in the fields that matter and the system figures out where it belongs — a chit with a date shows up on the calendar, add a checklist and it appears in checklists too. Multiple users get their own accounts with granular sharing — chit-level and tag-level sharing with viewer/manager roles, RSVP, assignment, and stealth mode. No subscriptions, no cloud dependency. Your data lives on your hardware in a single SQLite file, accessible from any device on your network. The entire stack is vanilla Python and vanilla JS with zero build steps — lightweight enough to run on a Raspberry Pi Zero 2, easy to deploy, easy to hack on, and easy to understand.

Available as a **web app** (desktop + mobile browser) and a **native Android app** (Kotlin/Compose with offline support). Learn more at [cwholemaniii.com/cwoc](https://www.cwholemaniii.com/cwoc).

## The Power of One System

Most productivity setups are a patchwork — a calendar app, a to-do app, a notes app, a maps app, a checklist app — each siloed, each unaware of the others. CWOC replaces that patchwork with a single unified record. That's not just convenient. It unlocks possibilities that never existed before.

**Shopping day, mapped out.** Create a chit for each grocery store you need to hit. Give each one today's date, a checklist of what to buy, and the store's address. Now open the Map view and filter to today. Every shopping list appears on your map, routed and ready. No toggling between a list app and a maps app — it's one view.

**Pack for the weather you're actually going to.** Your calendar has events in three different cities over the next two weeks. The Weather page pulls forecasts for every city you'll be in over the next 16 days, automatically. You're not checking weather.com for each destination one at a time — you see it all at once and pack accordingly.

**Your contacts, on your map, alongside your plans.** The Map page shows your events *and* your contacts at the same time. You're planning a trip to New York and you can see that Frank lives there now. Maybe you reach out, catch up, save yourself a hotel bill. That kind of organic connection doesn't happen when your contacts live in one app and your calendar lives in another.

**Your email, your tasks, one system.** Emails sync via IMAP and become chits. A flight confirmation email auto-detects as a badge on your Badges page. Reply to it, tag it, add it to a project — it's all the same record. No forwarding to a task app, no copy-pasting dates into a calendar.

These aren't edge cases. They're the natural result of a system where everything — dates, locations, checklists, people, notes, emails — lives on the same record. Every field you fill in makes every view smarter. The more you use it, the more connections surface on their own.

## C CAPTN E Views

| View | What it shows |
|---|---|
| **C**alendar | Chits with dates and times — 7 period views including itinerary, work hours, and X-day |
| **C**hecklists | Nested checklist items with drag-drop, multi-select, and batch operations |
| **A**lerts | Alarms, notifications, timers, stopwatches — plus notifications inbox |
| **P**rojects | Kanban-style boards with child chits and prerequisites |
| **T**asks | Status tracking — ToDo, In Progress, Blocked, Complete — plus Habits and Timeline views |
| **N**otes | Markdown content in masonry layout (also Notebook view combining Notes + Checklists) |
| **E**mail | Built-in email client with IMAP sync, compose, reply, forward, bundles, and smart link detection |
| **I**ndicators | Health trend charts — heart rate, blood pressure, SpO2, temperature, weight, glucose, and more |

Plus: **Omni View** (configurable multi-section dashboard), **Maps** (interactive map with chits + contacts), **Badges** (smart link detection command center), **Global Search** (FTS5 full-text search)

## Tech Stack

- **Backend:** FastAPI + SQLite (Python 3, no ORM, 33 route modules)
- **Frontend:** Vanilla JS, HTML5, CSS3 — no frameworks, no build step (25 pages)
- **Android:** Kotlin + Jetpack Compose — full offline support via Room (32 screens)
- **Theme:** 1940s parchment/magic aesthetic with Lora serif font

## Key Features

- **Multi-user** with login, profiles, user admin, and granular sharing (viewer/manager roles, RSVP, stealth mode)
- **Built-in email client** — IMAP/SMTP with bundles, smart link detection, HTML rendering
- **Rules engine** — automated actions based on conditions (auto-tag, set status, notifications)
- **Badges** — auto-detected packages, flights, hotels, events from email content
- **Maps view** — interactive Leaflet map with chits and contacts plotted by location
- **Habits** — goal tracking with progress bars, charts, streaks, and cycle frequencies
- **Timeline** — dependency graph visualization for task relationships
- **Custom Objects** — user-defined data schemas with charting in Indicators view
- **Restic backup** — encrypted backups to local/remote storage with scheduling and restore
- **Kiosk mode** — always-on display for wall-mounted tablets
- **Calculator** — built-in arithmetic calculator
- **45 help topics** — searchable documentation with deep-linking

## Optional Services

| Service | Purpose |
|---|---|
| **[Tailscale](https://tailscale.com/)** | Mesh VPN for secure remote access. Android app auto-falls back to Tailscale IP when primary is unreachable. |
| **[Ntfy](https://ntfy.sh/)** | Push notifications to your phone for alarms, timers, and reminders — even when the browser is closed. |
| **[Home Assistant](https://www.home-assistant.io/)** | Smart home integration via HACS custom component. |
| **[Restic](https://restic.net/)** | Encrypted, deduplicated backups to local or remote storage. |

All are optional. CWOC works fully without them. The `install/configurinator.sh` script handles Tailscale and Ntfy automatically.

## Hardware

Lightweight enough to run on minimal hardware like a Raspberry Pi Zero 2 W. Any modern SBC, small VM, or LXC container with 1+ CPU cores and 512MB RAM will run it comfortably.

**LXC / VM Recommended Specs:**
- 2 vCPUs, 1GB RAM, 4GB disk

**Minimum Functional Specs:**
- 1 vCPU, 256MB RAM, 2GB disk — will run, but expect slower response times under concurrent use

## Android App

A native Android app is available at `install/cwoc_android_app.apk`. This is a full-featured Kotlin/Compose client with 32 screens, offline Room caching, bidirectional sync, push notifications via Ntfy, and Tailscale network fallback — not a browser wrapper. See the [Install as App](src/help/install-app.md) help doc for installation instructions.

## Documentation

- [Full README & Feature List](./documents/README.md)
- [Technical Details](./documents/technical_details.md)
- [License](./documents/LICENSE.md)

---

Created by C.W. Holeman III — [www.cwholemaniii.com](https://www.cwholemaniii.com/pages/home.shtml) · [Support](https://www.paypal.com/paypalme/cwhiii)
