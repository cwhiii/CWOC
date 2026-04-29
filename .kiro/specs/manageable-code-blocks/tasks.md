# Implementation Plan: Manageable Code Blocks

## Overview

Restructure the CWOC codebase from a flat directory layout with five monolithic files into a well-organized `src/` directory tree with focused, single-responsibility files. Executed in 12 sequential phases, each leaving the application fully functional. No new features, no new dependencies — purely mechanical restructuring.

Each phase has its own task file in the `phases/` directory for detailed tracking. This file serves as the master index.

## Phase Index

| # | Phase | File | Tasks |
|---|-------|------|-------|
| 1 | Create directory structure | [phase-01](phases/phase-01-create-directory-structure.md) | 1.1–1.6 |
| 2 | Reorganize data directory (contact images) | [phase-02](phases/phase-02-reorganize-data-directory.md) | 2.1–2.5 |
| 3 | Split backend/main.py into Python modules | [phase-03](phases/phase-03-split-backend.md) | 3.1–3.14 |
| 4 | Move backend to src/backend/ | [phase-04](phases/phase-04-move-backend.md) | 4.1–4.12 |
| 5 | Split frontend/shared.js into focused sub-scripts | [phase-05](phases/phase-05-split-shared-js.md) | 5.1–5.14 |
| 6 | Split frontend/main.js into focused sub-scripts | [phase-06](phases/phase-06-split-main-js.md) | 6.1–6.12 |
| 7 | Split frontend/editor.js into focused sub-scripts | [phase-07](phases/phase-07-split-editor-js.md) | 7.1–7.14 |
| 8 | Split frontend/styles.css into focused sub-stylesheets | [phase-08](phases/phase-08-split-styles-css.md) | 8.1–8.13 |
| 9 | Move frontend to src/frontend/ | [phase-09](phases/phase-09-move-frontend.md) | 9.1–9.15 |
| 10 | Move static assets to src/static/ | [phase-10](phases/phase-10-move-static.md) | 10.1–10.5 |
| 11 | Create INDEX.md and finalize documentation | [phase-11](phases/phase-11-index-and-docs.md) | 11.1–11.10 |
| 12 | Cleanup and final verification | [phase-12](phases/phase-12-cleanup.md) | 12.1–12.5 |

## Related Spec Files

- [requirements.md](requirements.md) — Full requirements document (14 requirements)
- [design.md](design.md) — Architecture, components, interfaces, and testing strategy
