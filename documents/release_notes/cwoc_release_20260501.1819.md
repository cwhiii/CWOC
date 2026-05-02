# Release 20260501.1819

Added a hard guard at the top of showQuickEditModal itself — if a drag just ended or is in progress, the modal refuses to open. This is a single chokepoint that covers every caller (calendar shift+click, long-press, touch gesture callbacks). Also guarded the notes inline-edit long-press path.
