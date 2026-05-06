# CWOC Release 20260505.2035 — Cross-Folder Thread Grouping

Fixed thread grouping to work across email folders. Previously, threads were only grouped within the current folder view (inbox/sent/drafts), so a received email and its sent reply wouldn't stack together. Now builds the thread map from ALL emails regardless of folder, then displays stacked cards for any thread that has at least one message in the current view. Expanding a thread shows all messages including those from other folders, with a small folder tag indicator.
