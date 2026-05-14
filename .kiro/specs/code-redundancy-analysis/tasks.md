# Code Deduplication Tasks

## Phase 1: Analysis (NO code edits)

### Task 1: Analyze Frontend JS for Duplicated Functions
- [ ] Read every frontend JS file and identify functions that exist in multiple files or do the same thing under different names
- [ ] Focus areas: rendering functions, data formatting, API calls, event handlers, modal builders, search/filter logic
- [ ] For each duplicate found, note: which files, how similar (identical vs slight variation), and whether changing one would require changing the other

### Task 2: Analyze Backend Python for Duplicated Functions
- [ ] Read every backend Python file and identify duplicated logic across route modules and utilities
- [ ] Focus areas: data serialization/deserialization, validation patterns, query patterns, response formatting
- [ ] For each duplicate found, note: which files, how similar, and whether changing one would require changing the other

### Task 3: Produce the Tracking File and Present for Review
- [ ] Create `Tasks/deduplication-tracker.md` with all findings in four sections:
  - **Will Fix**: clear duplicates that obviously need consolidation — numbered, with description of what/where
  - **Gray Area**: borderline cases — numbered, with description for user to decide yes/no
  - **Left Alone**: things that look similar but aren't real duplication — with brief reason
  - **Fixed**: empty at this stage — items move here only after code is actually changed
- [ ] Present the full tracker to user for review
- [ ] Wait for user approval before making ANY code edits

## Phase 2: Consolidation (only after user approval)

### Task 4: Consolidate Approved Items
- [ ] For each approved item (from "Will Fix" + user-approved Gray Area items):
  - [ ] Write the shared implementation in the appropriate shared file
  - [ ] Remove duplicate implementations from their original files
  - [ ] Wire up all callers to use the shared version
  - [ ] Verify no behavior change
  - [ ] Move item from "Will Fix" / "Gray Area" to "Fixed" in the tracker
- [ ] Move user-rejected Gray Area items to "Left Alone"

## Phase 3: Finalize

### Task 5: Update Documentation
- [ ] Update INDEX.md to reflect new/moved shared functions
- [ ] Update version number
- [ ] Write release notes