#!/bin/bash
# Fetch client-log and server-log from the CWOC server and save locally
# Run this manually: bash fetch-logs.sh

SERVER="https://192.168.1.111"

echo "Fetching client-log..."
curl -sk "$SERVER/api/client-log" > /Users/cwhiii/Personal/Misc/Development/CWOC/.kiro/client-log.json 2>/dev/null
echo "Fetching server-log..."
curl -sk "$SERVER/api/server-log" > /Users/cwhiii/Personal/Misc/Development/CWOC/.kiro/server-log.json 2>/dev/null
echo "Done. Logs saved to .kiro/client-log.json and .kiro/server-log.json"
