# Mobile Sync

- [How It Works](#how-it-works)
- [Device Management](#device-management)
- [Sync Conflicts](#sync-conflicts)
- [Conflict Notifications](#conflict-notifications)
- [Audit Log](#audit-log)
- [Tombstone Retention](#tombstone-retention)


CWOC supports bidirectional sync between the web app and mobile devices. When you're online, changes sync in real time via WebSocket — the same live connection the web app uses. When a device is offline, edits are queued locally and pushed to the server on reconnect.

## How It Works

Every chit, contact, and settings record has a **sync version** — a number that increments each time the record is modified. When a device reconnects after being offline, it asks the server: "What changed since version X?" The server returns only the records that have been updated since that point, keeping sync fast and efficient.

- **Online** — Changes propagate instantly to all connected devices via WebSocket
- **Offline** — Edits are stored locally on the device and pushed to the server when connectivity returns
- **First sync** — A new device downloads your entire dataset on its first connection

## Device Management

Each mobile device registers with the server using a **device token** — a long-lived credential that survives app restarts and offline periods without requiring you to re-enter your password.

### Registering a Device

When you first sign in on a mobile device, the app sends your username and password to the server. The server generates a secure token and returns it to the device. This token is stored securely on the device and used for all future requests.

### Viewing Registered Devices

The device management interface shows all registered devices with:

- **Device name** — A label you assign (e.g., "My Phone", "Tablet")
- **Registered date** — When the device was first connected
- **Last seen** — The most recent time the device communicated with the server
- **Last sync version** — How up-to-date the device is

### Revoking Access

If a device is lost, stolen, or no longer in use, you can revoke its access. Revocation is immediate — the device will be rejected on its next request. Revoking a device does not delete any data from the server; it only prevents that device from connecting.

## Sync Conflicts

A conflict occurs when the same chit is edited on two devices while both are offline (or before one device has synced the other's changes). For example, you edit a chit's title on your phone while also editing it on the web — both changes happen before either side knows about the other.

### How Conflicts Are Resolved

CWOC uses **field-level merge with last-write-wins (LWW) fallback**:

1. Each field is compared independently (title, note, tags, status, etc.)
2. If only one side changed a field, that change is kept
3. If both sides changed the same field, the version with the later `modified_datetime` wins

This means non-overlapping edits merge cleanly. If you change the title on your phone and the note on the web, both changes are preserved. Only when both sides edit the *same* field does LWW apply.

### What Gets Synced

Sync covers your full dataset:

- **Chits** — All fields, including soft-deleted chits (so deletions propagate to all devices)
- **Contacts** — Field-level merge, same strategy as chits
- **Settings** — Last-write-wins on the entire settings record (no field-level merge)

## Conflict Notifications

When a sync conflict is resolved on a chit, that chit is flagged with a **conflict notification banner**. This banner appears when you open the chit in the [editor](/editor), letting you know that an automatic merge occurred.

- The banner indicates which fields had conflicting values
- A link in the banner takes you to the [Audit Log](/frontend/html/audit-log.html) entry for that conflict, where you can see both versions side-by-side
- **Dismissing** — Once you've reviewed the resolution, dismiss the banner. The flag is cleared and won't reappear unless a new conflict occurs on that chit

The conflict flag syncs across devices — dismissing it on one device clears it everywhere.

## Audit Log

Every sync conflict resolution is recorded in the [Audit Log](/frontend/html/audit-log.html) with action type `sync_conflict_resolved`. The entry includes:

- **Which fields conflicted** — A list of the specific fields that had different values on each side
- **Both versions** — The server's value and the device's value for each conflicting field
- **Resolution** — Which version was kept (server or client) for each field
- **Actor** — The device that pushed the conflicting change (e.g., "device:My Phone")

This gives you full visibility into what happened and lets you manually correct any field if the automatic resolution wasn't what you wanted.

## Tombstone Retention

When you delete a chit, it is soft-deleted and moved to [Trash](/frontend/html/trash.html). Normally, items in trash can be permanently purged after a retention period.

With mobile sync enabled (i.e., when you have registered devices), the system keeps soft-deleted chits in trash slightly longer to ensure all your devices learn about the deletion:

- A deleted chit is only eligible for permanent purge once **all active devices** have synced past its deletion version
- Devices that haven't synced in over 90 days are excluded from this check — they won't block cleanup (they'll perform a full re-sync when they reconnect)
- If you have no registered devices, trash purge works exactly as before

This means you may notice deleted chits staying in [Trash](/frontend/html/trash.html) a bit longer than usual when devices are registered. This is expected behavior to prevent a device from missing a deletion and continuing to show a chit that was already removed.

---

**See also:** [Settings](/frontend/html/settings.html) · [Audit Log](/frontend/html/audit-log.html) · [Trash](/frontend/html/help.html#trash) · [Sharing](/frontend/html/help.html#sharing)
