# Audit Log

CWOC tracks all changes to your data with a built-in audit log. Every create, update, and delete operation on chits, contacts, settings, and system upgrades is recorded automatically.

## What Is Tracked

- **Chits** — Created, updated, and deleted chits
- **Contacts** — Created, updated, and deleted contacts
- **Independent Alerts** — Created, updated, and deleted independent alarms, timers, and stopwatches
- **Settings** — Any changes to your configuration
- **System** — Application upgrades (old and new version recorded)

Each audit entry records the actor (who made the change), a timestamp, the action performed, and for updates, a field-level diff showing old and new values for each changed field.

## Actor

The actor field reflects the username configured in [Settings](/frontend/html/settings.html) → General. If no username is set, the actor defaults to **"Unknown Gremlin"**. The username is stored as a snapshot at the time of the change — if you later change your username, older entries still show the name you had when the change was made.

## Accessing the Audit Log

- **Global Audit Log page** — Access via [Settings](/frontend/html/settings.html) → Data → Audit Log, or the Audit Log link in the navigation header. Shows all audit entries across all entities.
- **Per-chit link** — The [chit editor](/editor) has an "📜 Audit Log" button at the bottom that deep-links to the audit log filtered for that chit.
- **Per-contact link** — The [contact editor](/frontend/html/people.html) has an "📜 Audit Log" button that deep-links to the audit log filtered for that contact.

## Global Audit Log Page

The dedicated audit log page provides a full-featured interface for browsing change history:

- **Real-time filtering** — Filters apply immediately as you change entity type, actor, date range (Start/End), or page size. No "Apply" button needed.
- **Sorting** — Click column headers (Time, Entity, Actor, Action, Entity Type) to toggle ascending/descending sort
- **Entity links** — The Entity column links directly to the [chit editor](/editor), [contact editor](/frontend/html/people.html), settings page, or trash (for deleted chits)
- **Pagination** — Configurable page size (25 / 50 / 100 / 500) with a "Load More" button
- **Change details** — Expand any entry to see which fields changed, with old → new values
- **Revert** — For chit update entries, a "⏪ Revert to Before This Edit" button appears in the expanded detail view. Clicking it reverts the chit's fields to their values before that edit was made. A confirmation modal appears first. The revert itself is recorded as a new audit entry with action "reverted," so you always have a full history trail.

## Log Management

- **Delete Audit Logs** — Opens a modal to prune entries older than a selected timeframe (Past Hour / Day / Week / Month / Year / All Time). Shows the count of entries to be deleted. Option to download CSV before deleting.
- **CSV Export** — Downloads the currently filtered entries as a CSV file

## Audit Log Limits

In [Settings](/frontend/html/settings.html) → Data → Audit Log Limits, you can configure automatic pruning:

- **Enable Pruning** — Checkbox to enable or disable automatic pruning. When unchecked, both limit inputs are disabled and pruning is skipped entirely.
- **Max Age (days)** — Entries older than this are pruned automatically. Default: 1096 (3 years). Minimum: 1.
- **Max Size (MB)** — When the audit log exceeds this size (whole integers only), oldest entries are pruned. Default: 1 MB. Minimum: 1.

Auto-pruning runs at startup and after saving settings. Uncheck "Enable Pruning" to disable all automatic pruning.

## Column Reordering

On the audit log page, you can drag and drop column headers to reorder them. The detail toggle column (first column) is fixed. Column order is not persisted — it resets on page reload.

---

**See also:** [Settings](/frontend/html/settings.html) · [Data Management](/frontend/html/help.html#data-management) · [Chit Editor](/editor)
