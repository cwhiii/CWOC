# Parity Spec Process

When the user says something like "spec items 27–43" or "do the same process for items X through Y," follow this exact procedure against the Web Function Index at `Tasks/Android Mobile Implementation/function-parity-audit/Web Function Index.md`.

## Inputs

- A range of item numbers from the Web Function Index (e.g., "items 36–62")
- The definition of "complete": an end user should not be able to tell if they're using the Android app or the mobile browser version. Not layout, not functionality. Identical behavior.

## Process

### Step 1: Identify the incomplete items

Read the specified range from the Web Function Index. Filter to only items that are ❌ Missing or ⚠️ Partial. Items marked ✅ are already done — but VERIFY them by reading the actual Android code. If a ✅ item uses a wrong algorithm or produces different output than the web, it's actually incomplete (like item 5 in the habits spec).

### Step 2: Read the gap files

For each incomplete item that references a gap file (e.g., `W036-initPrerequisites.md`), read it from `Tasks/Android Mobile Implementation/function-parity-audit/gaps/`.

### Step 3: Read the ACTUAL web implementation

Read the actual JavaScript source files that implement the functions. Do NOT rely solely on the gap file descriptions — they may be incomplete or describe intended behavior rather than actual behavior. The web code IS the spec.

**Critical:** Check whether functions are actually CALLED from user-visible code paths. Functions that exist but are never called from the view/page the user sees are dead code — match what the user ACTUALLY sees on the mobile browser, not unused utility functions.

### Step 4: Read the existing Android implementation

Read the corresponding Android Kotlin files to understand what exists, what's wrong, and what's missing.

### Step 5: Write the requirements document

Create `.kiro/specs/{feature-name}/requirements.md` with:
- Introduction explaining the scope
- Glossary of domain terms
- One requirement per logical unit of work, each with:
  - User story
  - Numbered acceptance criteria using EARS patterns (WHEN/SHALL/IF/THEN)
  - Specific enough that implementation is unambiguous

**Rules for requirements:**
- Match the ACTUAL mobile browser behavior, not theoretical/unused code
- Every visual difference, every calculation difference, every data flow difference gets a requirement
- If the Android has a function marked ✅ but it produces wrong results, write a requirement to fix it
- Include edge cases the web handles (null checks, missing data, future dates, etc.)

### Step 6: Write the tasks document

Create `.kiro/specs/{feature-name}/tasks.md` following the Kiro spec format:
- `# Implementation Plan: {title}`
- `## Overview` — one paragraph
- `## Tasks` — checkbox format: `- [ ] N. Title\n  Description\n  Requirements: X, Y`
- `## Task Dependency Graph` — JSON with `"waves"` array
- `## Notes` — important context

**Rules for tasks:**
- Each task should be a coherent unit of work (one file or one tightly-coupled set of files)
- Include the exact file paths to create/modify
- Reference which requirements each task addresses
- Dependency graph groups independent tasks into parallel waves

### Step 7: Update the Web Function Index

Add a "Resolved By" column to the relevant table section. For each incomplete item, add the path to the tasks file + task number. Leave already-complete items blank.

## Naming Convention

- Spec folder: `.kiro/specs/{descriptive-kebab-case-name}/`
- Examples: `habits-calendar-parity`, `editor-prerequisites`, `calendar-month-drag`, `custom-zones-editor`

## Quality Checks

Before finishing:
1. Every ❌ and ⚠️ item in the range maps to at least one requirement
2. Every requirement maps to at least one task
3. Every task specifies exact files to modify/create
4. The dependency graph has no circular dependencies
5. Run `getDiagnostics` on both spec files — zero errors
6. The Web Function Index "Resolved By" column is populated for all incomplete items
