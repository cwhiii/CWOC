#!/bin/bash
# Fetch Android logcat output filtered to CWOC tags and save to project dir.
# Usage: bash fetch-android-logs.sh
# Requires: adb (Android Debug Bridge) with device connected via USB or WiFi.

OUTPUT="/Users/cwhiii/Personal/Misc/Development/CWOC/.kiro/android-logcat.txt"

echo "Pulling CWOC logcat from connected device..."
adb logcat -d | grep -i "CWOC\|cwoc\|standalone\|ALARM_RECV\|NOTIF_SCHED\|CWOC_APP\|CWOC_ALERTS\|CWOC_WS\|CWOC_SYNC" > "$OUTPUT"

LINES=$(wc -l < "$OUTPUT")
echo "Done. $LINES lines saved to .kiro/android-logcat.txt"
