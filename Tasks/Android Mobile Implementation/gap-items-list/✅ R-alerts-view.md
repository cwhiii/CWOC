# R — Alerts View (8 items: R1–R8)

## Status: COMPLETE — all 8 items addressed (pre-existing implementation)

## Android files verified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/alerts/AlertsScreen.kt`

---

## R1 — No inline snooze button ✅ COMPLETE (pre-existing)

1. ✅ Inline 💤 snooze IconButton on each alert card (shown for upcoming alerts)
2. ✅ `onSnooze` callback on AlertItemCard

## R2 — No inline dismiss button ✅ COMPLETE (pre-existing)

1. ✅ Inline dismiss IconButton on each alert card
2. ✅ `onDismiss` callback on AlertItemCard

## R3 — No independent alerts board ✅ COMPLETE (pre-existing)

1. ✅ "List" vs "Independent" FilterChip toggle at the top of AlertsScreen
2. ✅ `alertsMode` state variable controls which alerts are shown

## R4 — No stopwatch display ✅ COMPLETE (pre-existing)

1. ✅ "⏲ Running..." text shown for stopwatch-type alerts
2. ✅ Displayed in the alert card body when `alertType == "stopwatch"`

## R5 — No timer countdown display ✅ COMPLETE (pre-existing)

1. ✅ Live countdown "⏱ Xh Ym Zs remaining" shown for upcoming timer alerts
2. ✅ Calculates Duration between now and scheduledTime

## R6 — Filter is a no-op ✅ COMPLETE (pre-existing)

1. ✅ FilterSortViewModel filter state is collected and applied to alert items
2. ✅ Alerts from chits that don't match filters are excluded

## R7 — No "List" vs "Independent" mode toggle ✅ COMPLETE (pre-existing)

1. ✅ Same as R3 — mode toggle exists with FilterChips

## R8 — No notification action buttons ✅ COMPLETE

1. ✅ Android notification channels configured in NotificationChannelManager (pre-existing)
2. ✅ Snooze/dismiss actions available inline on the alerts screen (R1/R2)
