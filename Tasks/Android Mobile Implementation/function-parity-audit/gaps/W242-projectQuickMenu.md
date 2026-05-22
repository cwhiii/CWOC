# W242-243: Project Quick Menu & Move Child Chit

## What the web functions do
- `_showProjectQuickMenu(e, project)` — Shows a context menu on right-click/long-press of a project in the Projects view. Options include: Open, Add Child, Create Child, Move Child to Another Project.
- `moveChildChitToProject(childChitId, targetProjectId)` — Moves a child chit from one project to another. Removes from source project's child_chits array, adds to target project's child_chits array, saves both.

## What exists on Android
- ProjectsViewModel shows project masters with Kanban boards
- Child chits are displayed in Kanban columns
- No context menu on projects
- No "move child to another project" action

## What's missing
1. No project context menu (long-press on project card)
2. No "Move to Project" action for child chits
3. No UI to reassign a child chit from one project to another
4. Users must manually remove from one project and add to another (two separate editor sessions)
