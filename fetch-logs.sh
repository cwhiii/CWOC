#!/bin/bash
# Fetch client-log and server-log from the CWOC server and save locally
# Run this manually: bash fetch-logs.sh

SERVER="http://192.168.1.111:3333"

echo "Fetching client-log..."
curl -sk "$SERVER/api/client-log" > /Users/cwhiii/Personal/Misc/Development/CWOC/.kiro/client-log.json 2>/dev/null
echo "Fetching server-log (email sync filtered)..."
curl -sk "$SERVER/api/server-log?grep=sync" > /Users/cwhiii/Personal/Misc/Development/CWOC/.kiro/server-log.json 2>/dev/null
echo "Fetching full server-log..."
curl -sk "$SERVER/api/server-log" > /Users/cwhiii/Personal/Misc/Development/CWOC/.kiro/server-log-full.json 2>/dev/null
echo "Done. Logs saved to .kiro/"
