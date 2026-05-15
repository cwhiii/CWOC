# Kiosk

- [Setting Up the Kiosk](#setting-up-the-kiosk)
- [Accessing the Kiosk](#accessing-the-kiosk)
- [Kiosk Display](#kiosk-display)
- [Period Navigation](#period-navigation)
- [Auto-Refresh & Interaction](#auto-refresh-interaction)


The Kiosk is a read-only, unauthenticated display designed for wall-mounted screens or shared monitors. It shows calendar events and active tasks filtered by the tags you choose — no login required.

## Setting Up the Kiosk

Configure which tags appear on the kiosk in **[Settings → Tools → Kiosk](/frontend/html/settings.html#kiosk)**:

- **Tag picker** — A tree of your user-created tags (system tags are excluded). Check the tags you want displayed on the kiosk. Selecting a parent tag automatically includes all child tags.
- **Save** — Click Save to persist your kiosk tag selection. This is required for direct-URL access to work.
- **📺 Open Kiosk →** — Opens the kiosk page with the currently selected tags.

## Accessing the Kiosk

- **Direct URL** — Navigate to `/kiosk` on your server. The page loads the saved tag configuration automatically — no login needed. Ideal for bookmarking on a wall display.
- **With specific tags** — Append tags to the URL: `/kiosk?tags=Work,Personal`. URL tags override the saved configuration.
- **Launch button** — Use the "📺 Open Kiosk →" button in Settings to open with the currently selected tags.

## Kiosk Display

The kiosk shows a two-column layout:

- **Calendar** (left) — Upcoming events grouped by day, with time, title, color, and owner name. Today is highlighted with a gold accent.
- **Tasks** (right) — Active tasks (not complete) sorted by status: In Progress first, then Blocked, then ToDo. Each shows status icon, title, due date, and owner.

## Period Navigation

A toolbar at the top lets you switch between Day, Week, and Month views, navigate forward/backward, and jump to Today. The week start day respects your Settings configuration.

## Auto-Refresh & Interaction

- **Auto-refresh** — The kiosk refreshes data every 60 seconds automatically.
- **Click to edit** — Clicking any event or task opens it in the [chit editor](/editor). After saving, you're returned to the kiosk.

A tag legend at the bottom shows which tags are active, and a timestamp shows when data was last refreshed.

---

**See also:** [Views](/frontend/html/help.html#views) · [Tags](/frontend/html/help.html#tags) · [Settings](/frontend/html/settings.html)
