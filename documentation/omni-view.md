# Omni View

The Omni View is a command-center dashboard that fuses today's itinerary, pinned chits, and unread email into a single actionable view. It shows what's relevant *right now* without switching between tabs.

## Activating

- **Click "Omni"** — The word "Omni" in the header (*Omni Chits*) is a clickable button. Click it to switch to the Omni View
- `O` — Press the O hotkey from the dashboard to activate the Omni View
- **Exit** — Click any C CAPTN tab to leave the Omni View and return to that tab's content

## Sections

The Omni View displays up to 8 configurable sections in a two-column layout (single column on mobile):

- **HST Bar** — A horizontal strip timeline of today. Shows a progress fill up to the current time, with chit icons at their scheduled positions and weather forecast icons at their predicted hours. Click a chit icon for quick-edit; click a weather icon for the weather modal
- **Weather Bar** — Today's weather summary for your default location
- **⏰ Chrono Anchored** — Timed events happening today, with time-until badges (e.g., "in 45 min"). Renders identically to the itinerary view
- **🔜 On Deck** — All-day events today, untimed tasks due today, and habits due today. Habits show a 🔥 streak counter
- **🗓️ Soon** — Items due this week (not today)
- **📧 Email** — Unread emails from Omni-enabled bundles, 3 at a time with pagination. Email cards support all standard actions (swipe, mark read, reply)
- **📝 Pinned Notes** — Pinned chits that are notes, rendered as compact cards
- **☑️ Pinned Checklists** — Pinned chits with checklist items, with inline check/uncheck

Empty sections are automatically hidden. Each chit appears in exactly one section (deduplication by priority: timed → due today → due this week → pinned).

## Layout Configuration

Configure the Omni View layout in **Settings → 🔮 Omni View**:

- **Drag to reorder** — Drag section cards to change their display order
- **Width toggle** — Set each section to half-width (one column) or full-width (spans both columns)
- **Visibility toggle** — Show or hide individual sections

## Filter Locking

The Omni View starts with a base filter (today's itinerary + pinned + unread Omni-enabled email) that cannot be removed. Standard sidebar filters (status, tags, priority, people, text) narrow results further on top of this base.

- **🔒 Lock Filters** — When the Omni View is active, a 🔒 button appears in the sidebar filter section. Click it to save the current filters as Omni View defaults. Next time you open the Omni View, these filters are pre-applied
- **Clear Defaults** — Remove locked filter defaults from Settings → Omni View

## Bundle Omni View Toggles

Control which email bundles appear in the Omni View email section:

- **Bundle editor modal** — Each bundle has an "Include in Omni View" checkbox in its create/edit modal
- **Settings → Omni View** — Lists all bundles with Omni View checkboxes for quick toggling

## Hotkey Changes

The Omni View introduced the following hotkey reassignments:

- `O` — Omni View (previously Sort/Order)
- `S` — Sort/Order submenu (previously Settings)
- `F9` — Settings (previously unused)

---

**See also:** [Views](views.md) · [Calendar](calendar.md) · [Email](email.md) · [Keyboard Shortcuts](hotkeys.md)
