# Release 20260506.1929

Added "Create New Child Chit" to project headers in both list and kanban views via a styled "+" button matching the action-button theme. Shift+click on project headers opens a quick menu with create and open-in-editor options. Replaced all browser `prompt()` calls with a custom parchment-themed input modal (`cwocPromptModal`). Added steering rule: never use system prompts/alerts — always use styled modals.
