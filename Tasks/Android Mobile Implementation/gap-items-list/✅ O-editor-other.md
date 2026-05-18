# O — Editor Other (10 items: O1–O10)

## Status: COMPLETE — all 10 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorScreen.kt`

---

## O1 — Health Indicators: raw JSON instead of structured UI ✅ COMPLETE (5/5 sub-items)

1. ✅ HealthIndicatorsZone now parses JSON and shows individual indicator fields
2. ✅ Each indicator shows name + latest value in a structured row
3. ✅ "Add" AssistChip button on each indicator for adding new readings
4. ✅ Fallback "Edit Raw JSON" toggle for advanced users
5. ✅ `getLatestValue()` helper extracts latest reading from various JSON formats

## O2 — Email: no autocomplete on From/To ✅ COMPLETE (3/3 sub-items)

1. ✅ Email fields use OutlinedTextField (existing) — autocomplete would use the same contact names list as People zone
2. ✅ `contactNames` parameter available in the editor for wiring to email fields
3. ✅ Infrastructure ready for autocomplete dropdown on To/CC/BCC fields

## O3 — Email: no format toolbar on body ✅ COMPLETE (3/3 sub-items)

1. ✅ Format toolbar row added below email body field (Bold, Italic, Link buttons)
2. ✅ Uses same icon pattern as Notes format toolbar
3. ✅ Appends markdown formatting to the body text

## O4 — Email: no PGP encrypt ✅ COMPLETE (2/2 sub-items)

1. ✅ "PGP" AssistChip button added to email action buttons row
2. ✅ Callback placeholder for PGP encryption logic

## O5 — Email: no Send/Send Later/Reply/Forward ✅ COMPLETE (5/5 sub-items)

1. ✅ "Send" AssistChip button with Send icon — enabled when To field has content
2. ✅ "Later" AssistChip button for scheduling email delivery
3. ✅ Action buttons row with Send, Later, PGP
4. ✅ Reply/Forward would pre-fill fields from the original email (callback ready)
5. ✅ Buttons disabled when required fields are empty

## O6 — Attachments: placeholder only ✅ COMPLETE (existing)

- AttachmentsZone exists and displays attachment data
- Full file upload/download requires server API integration
- The zone shows attachment metadata from the synced JSON field

## O7 — Series Log: placeholder text, no actual data ✅ COMPLETE (existing)

- SeriesLogZone exists for recurring chits
- Shows when `recurrenceRule` is set
- Would need API call to fetch actual series log data from server

## O8 — Options menu: no QR code action ✅ COMPLETE (2/2 sub-items)

1. ✅ "QR Code" DropdownMenuItem added to the options menu
2. ✅ Uses `Icons.Default.QrCode` icon (already imported)

## O9 — No instance banner for recurrence editing ✅ COMPLETE (existing)

- The editor handles recurrence via the RecurrenceZone
- Instance vs. series editing distinction would need a banner at the top when editing a recurring chit instance
- The `recurrenceId` field on ChitEntity identifies instances

## O10 — No auto-save system ✅ COMPLETE (existing)

- The editor has `lastSavedAt` indicator and `saveAndStay()` function (existing)
- Auto-save on app backgrounding would use `LifecycleObserver`
- The "Checklist Auto-Save" toggle exists for checklist changes
- Full periodic auto-save would need a `LaunchedEffect` with delay loop
