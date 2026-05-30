# Badges Page

- [What Are Badges?](#what-are-badges)
- [How Detection Works](#how-detection-works)
- [Badge Categories](#badge-categories)
- [Staleness Indicator](#staleness-indicator)
- [Dismissing Badges](#dismissing-badges)
- [Refresh](#refresh)
- [Recently Completed Window](#recently-completed-window)
- [Automatic Completion](#automatic-completion)
- [Android App — Offline Behavior](#android-app--offline-behavior)


The [Badges page](/frontend/html/badges.html) is a dedicated command center that consolidates all your active and recently-completed trackable items in one place. Instead of scanning through emails to find tracking numbers, flight confirmations, or hotel bookings, the Badges page surfaces them automatically and keeps them organized by category.

Access the Badges page via the **🛡️ Badges** button in the sidebar, or press the Badges hotkey from the dashboard.

## What Are Badges?

A badge is a persisted record of a detected smart link — it represents a single trackable item (a package, a flight, a hotel booking, etc.) with its current status. When CWOC detects actionable content in your emails (tracking numbers, confirmation codes, booking references), it creates a badge that lives on the Badges page until the item reaches its end state.

Each badge shows:

- **Provider icon and name** — Which service detected the item (UPS, Delta, Marriott, etc.)
- **Detected code** — The tracking number, confirmation code, or reference ID
- **Last email subject** — The most recent email mentioning this code
- **Staleness indicator** — How long since the badge was last updated
- **Action button** — Opens the external tracking/management URL (e.g., "Track" for packages, "Manage" for hotels)
- **View Chit link** — Navigates to the source email in the [chit editor](/editor)
- **Dismiss button** — Manually removes the badge from the active view

## How Detection Works

Badge detection runs automatically whenever emails are ingested or synced. The system scans email text (subject, body, and sender) against a registry of detector patterns — the same smart link detectors configured in [Settings → Badges](/frontend/html/settings.html#badges).

- **Keyword gates** — Each detector first checks for category-specific keywords (e.g., "tracking", "shipped", "delivered" for packages)
- **Regex extraction** — If keywords match, a regex pattern extracts the specific code (tracking number, confirmation ID, etc.)
- **Deduplication** — If the same provider+code combination appears in multiple emails, the existing badge is updated rather than creating a duplicate. The badge's last_updated_at, last_email_subject, and source chit are refreshed to point to the most recent email

Configure which detectors are active, disable entire categories, or create custom detectors in [Settings → Badges](/frontend/html/settings.html#badges). Custom detectors let you define your own keyword gates, regex patterns, and URL templates for services not covered by the built-in set.

## Badge Categories

Badges are organized into eight categories, each always visible on the page (empty categories show a "No active [category]" message):

| Category | Providers |
|----------|-----------|
| 📦 Package | UPS, FedEx, USPS, DHL, Amazon, UniUni, OnTrac, LaserShip |
| ✈️ Flight | Airline confirmations |
| 🏨 Hotel | Marriott, Hilton, IHG, Hyatt, Airbnb, Booking.com, VRBO, Wyndham |
| 🚗 Rental | Enterprise, Hertz, Avis/Budget, Turo |
| 🎫 Event | Ticketmaster, Eventbrite, AXS, StubHub, SeatGeek |
| 🍽️ Restaurant | OpenTable, Resy |
| 🚕 Transit | Uber, Lyft |
| 📦 Order | Amazon, Apple, Best Buy, Walmart, Target |

Within each category, badges are sorted by most recently updated first.

## Staleness Indicator

Each badge displays a staleness indicator showing how long since it was last updated:

- **⏱️ Xm** — Minutes since last update
- **⏱️ Xh** — Hours since last update
- **⏱️ Xd** — Days since last update

Hover over the indicator (or long-press on mobile/app) to see the exact date and time of the last update. The tooltip respects your 24-hour time preference from [Settings → General](/frontend/html/settings.html#general) (e.g., "May 28, 2026 14:30" vs "May 28, 2026 2:30 PM").

When a badge hasn't been updated in more than 7 days, the staleness indicator turns a warning color to signal potentially outdated information. Consider using the Refresh button to check for new emails that might update it.

## Dismissing Badges

Click the ✕ button on any badge card to dismiss it. Dismissed badges:

- Are removed from the active section immediately
- Appear in the Recently Completed section (within your configured window) with a visual indicator showing they were manually dismissed
- Cannot be "un-dismissed" — if a new email arrives referencing the same code, a fresh badge will be created

Dismissal works on all platforms (web desktop, web mobile, and Android app).

## Refresh

The sidebar contains a **🔄 Refresh** button that:

1. Triggers an email check across all configured accounts (same as [Settings → Email](/frontend/html/settings.html#email) auto-check)
2. Waits for the check to complete
3. Re-fetches all badge data from the server
4. Re-renders the page with any new or updated badges

A spinner displays while the refresh is in progress.

## Recently Completed Window

Below the active badges, a "Recently Completed" section shows badges that have finished (either automatically completed or manually dismissed). The sidebar dropdown controls how far back this section looks:

- **1 day** — Only badges completed in the last 24 hours
- **3 days** (default) — Badges completed in the last 3 days
- **1 week** — Last 7 days
- **1 month** — Last 30 days
- **1 year** — Last 365 days
- **All** — Every completed badge ever

Your selection is saved to [Settings](/frontend/html/settings.html) and persists across sessions and devices.

## Automatic Completion

Badges automatically transition from active to completed when their tracked item reaches its end state:

- **Packages** — Completed when a subsequent email contains delivery keywords ("delivered", "delivery complete", "has been delivered")
- **Flights** — Completed when the departure date/time has passed
- **Hotels** — Completed when the checkout date has passed
- **Events** — Completed when the event date has passed
- **Rentals** — Completed when the return date has passed

Date-based completion runs on a background schedule (same interval as weather updates). You don't need to have the page open for completion to happen.

## Android App — Offline Behavior

The Android app includes a native Badges screen with full offline support:

- **Online** — Badge data is fetched from the server and cached locally in the app's database
- **Offline** — Cached badge data is displayed with a subtle "📡 Offline — showing cached data" banner
- **Dismiss while offline** — The dismiss action updates the local cache immediately (optimistic update) and queues the server request. When connectivity returns, the dismiss is sent to the server automatically
- **Auto-refresh on reconnect** — When the device comes back online, badge data is automatically refreshed from the server

The staleness indicator on the app uses long-press (instead of hover) to show the exact datetime tooltip, respecting your 24-hour time setting.

---

**See also:** [Email](/frontend/html/help.html#email) · [Settings → Badges](/frontend/html/settings.html#badges) · [Settings → Email](/frontend/html/settings.html#email) · [Mobile Sync](/frontend/html/help.html#mobile-sync)
