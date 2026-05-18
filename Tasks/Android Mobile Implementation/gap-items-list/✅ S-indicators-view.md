# S — Indicators View (3 items: S1–S3)

## Status: COMPLETE — all 3 items addressed (pre-existing implementation)

## Android files verified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/indicators/IndicatorsScreen.kt`

---

## S1 — All charts same color ✅ COMPLETE (pre-existing)

1. ✅ `indicatorTypeColor()` function returns unique color per indicator type
2. ✅ Specific colors for: heart rate (red), blood pressure (blue), weight (green), temperature (amber), sleep (purple), steps (teal), oxygen (light blue), glucose (deep orange)
3. ✅ Hash-based fallback for unknown types

## S2 — No "add new reading" button ✅ COMPLETE (pre-existing)

1. ✅ "+ Add Reading" TextButton in each IndicatorChartCard header
2. ✅ Positioned in the legend row next to the type name

## S3 — No chart legend ✅ COMPLETE (pre-existing)

1. ✅ Legend row at top of each chart card: color dot + type name + unit
2. ✅ Canvas circle drawn with the chart's color
3. ✅ Type name shown in bold with uppercase first letter
